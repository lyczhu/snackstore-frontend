import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useTable } from './useTable'

// useTable 依赖 onMounted/onBeforeUnmount，需在组件上下文中运行
function withSetup(fetchFn, options) {
  let api
  mount(
    defineComponent({
      setup() {
        api = useTable(fetchFn, options)
        return () => null
      }
    })
  )
  return api
}

const pageOf = (rows, total) => Promise.resolve({ data: { data: rows, total } })

describe('useTable', () => {
  it('immediate 时挂载即加载，rows/total 写入正确', async () => {
    const fetchFn = vi.fn(() => pageOf([{ id: 1 }], 21))
    const { rows, total, loading } = withSetup(fetchFn)
    await vi.waitFor(() => expect(loading.value).toBe(false))
    expect(rows.value).toEqual([{ id: 1 }])
    expect(total.value).toBe(21)
    expect(fetchFn).toHaveBeenCalledWith({ pageNum: 1, pageSize: 10 }, expect.any(AbortSignal))
  })

  it('immediate=false 时不自动加载', () => {
    const fetchFn = vi.fn(() => pageOf([], 0))
    withSetup(fetchFn, { immediate: false })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('search 重置到第一页并携带筛选参数', async () => {
    const fetchFn = vi.fn(() => pageOf([], 0))
    const { pageNum, search } = withSetup(fetchFn)
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1))
    pageNum.value = 3
    search({ keyword: '薯片' })
    await vi.waitFor(() =>
      expect(fetchFn).toHaveBeenLastCalledWith(
        { pageNum: 1, pageSize: 10, keyword: '薯片' },
        expect.any(AbortSignal)
      )
    )
    expect(pageNum.value).toBe(1)
  })

  it('连续 load 会取消前一个未完成的请求（AbortController 防脏写）', async () => {
    const signals = []
    const fetchFn = vi.fn((params, signal) => {
      signals.push(signal)
      if (signals.length === 1) {
        // 模拟 axios 遵循 signal 的行为：被 abort 后以 ERR_CANCELED 拒绝
        return new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            const err = new Error('canceled')
            err.code = 'ERR_CANCELED'
            reject(err)
          })
        })
      }
      return pageOf([{ id: 2 }], 1)
    })
    const { load, rows } = withSetup(fetchFn, { immediate: false })
    const p1 = load()
    const p2 = load() // 第二次 load 应取消第一次
    await Promise.all([p1, p2])
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
    // 被取消的请求不覆盖新数据
    expect(rows.value).toEqual([{ id: 2 }])
  })

  it('请求被取消时静默处理（不视为错误）', async () => {
    const fetchFn = vi.fn(() => {
      const err = new Error('canceled')
      err.code = 'ERR_CANCELED'
      return Promise.reject(err)
    })
    const { loading } = withSetup(fetchFn)
    await vi.waitFor(() => expect(loading.value).toBe(false))
    // 不抛出、不写入 rows，即视为通过
  })
})
