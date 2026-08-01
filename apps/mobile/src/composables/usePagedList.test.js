import { describe, it, expect, vi } from 'vitest'
import { usePagedList } from './usePagedList'

// 构造后端 Result 包装：res.data.data 为数组
function page(list) {
  return Promise.resolve({ data: { data: list } })
}
const items10 = () => Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }))

describe('usePagedList', () => {
  it('onLoad 成功时推入数据、pageNum 自增', async () => {
    const fetcher = vi.fn(() => page(items10()))
    const { items, pageNum, onLoad, loading, initialLoading } = usePagedList({ fetcher })
    await onLoad()
    expect(items.value).toHaveLength(10)
    expect(pageNum.value).toBe(2)
    expect(loading.value).toBe(false)
    expect(initialLoading.value).toBe(false)
    expect(fetcher).toHaveBeenCalledWith(1, 10)
  })

  it('返回不足一页时置 finished', async () => {
    const fetcher = vi.fn(() => page([{ id: 1 }]))
    const { finished, onLoad } = usePagedList({ fetcher })
    await onLoad()
    expect(finished.value).toBe(true)
  })

  it('首屏失败置 loadError（整页错误态），翻页失败置 listError', async () => {
    let call = 0
    const fetcher = vi.fn(() => {
      call += 1
      return call === 1 ? Promise.reject(new Error('x')) : page(items10())
    })
    const { loadError, listError, onLoad, resetAndReload, pageNum } = usePagedList({ fetcher })
    await onLoad() // 第一页失败
    expect(loadError.value).toBe(true)
    expect(listError.value).toBe(false)
    expect(pageNum.value).toBe(1) // 失败不翻页

    // 用户点击重试：resetAndReload 清除错误态并重新加载（本次成功）
    await resetAndReload()
    expect(loadError.value).toBe(false)
    expect(pageNum.value).toBe(2)

    // 第二页失败：走 van-list 内置错误态，不再整页报错
    fetcher.mockImplementationOnce(() => Promise.reject(new Error('y')))
    await onLoad()
    expect(listError.value).toBe(true)
    expect(loadError.value).toBe(false)
  })

  it('resetAndReload 清空并回到第一页重新加载', async () => {
    const fetcher = vi.fn(() => page(items10()))
    const { items, pageNum, resetAndReload } = usePagedList({ fetcher })
    await resetAndReload()
    await resetAndReload()
    expect(items.value).toHaveLength(10) // 重置后不累加
    expect(pageNum.value).toBe(2)
  })

  it('guard 返回 false 时结束加载且保持首屏态', async () => {
    const fetcher = vi.fn(() => page(items10()))
    const { onLoad, loading, finished, initialLoading } = usePagedList({
      fetcher,
      guard: () => false
    })
    await onLoad()
    expect(fetcher).not.toHaveBeenCalled()
    expect(loading.value).toBe(false)
    expect(finished.value).toBe(true)
    expect(initialLoading.value).toBe(true) // 保持骨架屏，等待外部驱动
  })

  it('支持自定义 pageSize', async () => {
    const fetcher = vi.fn(() => page([{ id: 1 }]))
    const { onLoad, finished } = usePagedList({ fetcher, pageSize: 5 })
    await onLoad()
    expect(fetcher).toHaveBeenCalledWith(1, 5)
    expect(finished.value).toBe(true) // 1 < 5
  })
})
