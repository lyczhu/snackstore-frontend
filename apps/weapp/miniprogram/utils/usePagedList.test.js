import { describe, it, expect, vi } from 'vitest'
import { createPagedList } from './usePagedList.js'

const page = (data) => Promise.resolve({ data: { data } })

describe('createPagedList', () => {
  it('不足一页置 finished，并关闭首屏骨架', async () => {
    const l = createPagedList({ fetcher: () => page([{ id: 1 }]), pageSize: 10 })
    await l.onLoad()
    expect(l.finished).toBe(true)
    expect(l.items.length).toBe(1)
    expect(l.initialLoading).toBe(false)
    expect(l.loading).toBe(false)
  })

  it('满一页不置 finished，pageNum 自增', async () => {
    const full = Array.from({ length: 10 }, (_, i) => ({ id: i }))
    const l = createPagedList({ fetcher: () => page(full), pageSize: 10 })
    await l.onLoad()
    expect(l.finished).toBe(false)
    expect(l.pageNum).toBe(2)
  })

  it('guard 为假时不拉取', async () => {
    const f = vi.fn()
    const l = createPagedList({ fetcher: f, guard: () => false })
    await l.onLoad()
    expect(f).not.toHaveBeenCalled()
  })

  it('seq 守卫丢弃过期响应', async () => {
    let n = 0
    const l = createPagedList({
      pageSize: 1,
      fetcher: () => {
        n += 1
        const cur = n
        return new Promise((res) => setTimeout(() => res({ data: { data: [{ id: cur }] } }), cur === 1 ? 30 : 0))
      }
    })
    l.onLoad() // seq=1，慢响应
    l.resetAndReload() // seq=2，快响应；items 重置
    await new Promise((r) => setTimeout(r, 60))
    expect(l.items.map((i) => i.id)).toEqual([2]) // 旧 seq=1 被丢
  })

  it('首屏失败置 loadError', async () => {
    const l = createPagedList({ fetcher: () => Promise.reject(new Error('x')), pageSize: 10 })
    await l.onLoad()
    expect(l.loadError).toBe(true)
    expect(l.initialLoading).toBe(false)
  })

  it('翻页失败置 listError（pageNum>1）', async () => {
    let calls = 0
    const l = createPagedList({
      pageSize: 1,
      fetcher: () => {
        calls += 1
        if (calls === 1) return page([{ id: 1 }])
        return Promise.reject(new Error('boom'))
      }
    })
    await l.onLoad()
    await l.onLoad()
    expect(l.listError).toBe(true)
    expect(l.loadError).toBe(false)
  })
})
