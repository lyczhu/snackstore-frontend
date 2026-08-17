import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { usePagedList } from './usePagedList'

// usePagedList 依赖 onBeforeUnmount，需在组件上下文中运行
function withSetup(options) {
  let api
  const wrapper = mount(
    defineComponent({
      setup() {
        api = usePagedList(options)
        return () => null
      }
    })
  )
  return { api, wrapper }
}

// 构造后端 Result 包装：res.data.data 为数组
function page(list) {
  return Promise.resolve({ data: { data: list } })
}
const items10 = () => Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }))

describe('usePagedList', () => {
  it('onLoad 成功时推入数据、pageNum 自增', async () => {
    const fetcher = vi.fn(() => page(items10()))
    const { api } = withSetup({ fetcher })
    await api.onLoad()
    expect(api.items.value).toHaveLength(10)
    expect(api.pageNum.value).toBe(2)
    expect(api.loading.value).toBe(false)
    expect(api.initialLoading.value).toBe(false)
    expect(fetcher).toHaveBeenCalledWith(1, 10, expect.any(AbortSignal))
  })

  it('返回不足一页时置 finished', async () => {
    const fetcher = vi.fn(() => page([{ id: 1 }]))
    const { api } = withSetup({ fetcher })
    await api.onLoad()
    expect(api.finished.value).toBe(true)
  })

  it('首屏失败置 loadError（整页错误态），翻页失败置 listError', async () => {
    let call = 0
    const fetcher = vi.fn(() => {
      call += 1
      return call === 1 ? Promise.reject(new Error('x')) : page(items10())
    })
    const { api } = withSetup({ fetcher })
    await api.onLoad() // 第一页失败
    expect(api.loadError.value).toBe(true)
    expect(api.listError.value).toBe(false)
    expect(api.pageNum.value).toBe(1) // 失败不翻页

    // 用户点击重试：resetAndReload 清除错误态并重新加载（本次成功）
    await api.resetAndReload()
    expect(api.loadError.value).toBe(false)
    expect(api.pageNum.value).toBe(2)

    // 第二页失败：走 van-list 内置错误态，不再整页报错
    fetcher.mockImplementationOnce(() => Promise.reject(new Error('y')))
    await api.onLoad()
    expect(api.listError.value).toBe(true)
    expect(api.loadError.value).toBe(false)
  })

  it('resetAndReload 清空并回到第一页重新加载', async () => {
    const fetcher = vi.fn(() => page(items10()))
    const { api } = withSetup({ fetcher })
    await api.resetAndReload()
    await api.resetAndReload()
    expect(api.items.value).toHaveLength(10) // 重置后不累加
    expect(api.pageNum.value).toBe(2)
  })

  it('guard 返回 false 时结束加载且保持首屏态', async () => {
    const fetcher = vi.fn(() => page(items10()))
    const { api } = withSetup({ fetcher, guard: () => false })
    await api.onLoad()
    expect(fetcher).not.toHaveBeenCalled()
    expect(api.loading.value).toBe(false)
    expect(api.finished.value).toBe(true)
    expect(api.initialLoading.value).toBe(true) // 保持骨架屏，等待外部驱动
  })

  it('支持自定义 pageSize', async () => {
    const fetcher = vi.fn(() => page([{ id: 1 }]))
    const { api } = withSetup({ fetcher, pageSize: 5 })
    await api.onLoad()
    expect(fetcher).toHaveBeenCalledWith(1, 5, expect.any(AbortSignal))
    expect(api.finished.value).toBe(true) // 1 < 5
  })

  it('新一轮加载会取消前一个未完成请求（AbortController 防脏写）', async () => {
    const signals = []
    const fetcher = vi.fn((_pageNum, _pageSize, signal) => {
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
      return page([{ id: 99 }])
    })
    const { api } = withSetup({ fetcher })
    const p1 = api.onLoad()
    const p2 = api.resetAndReload() // 重置应取消第一次的未完成请求
    await Promise.all([p1, p2])
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
    // 被取消的旧响应不污染重置后的列表
    expect(api.items.value).toEqual([{ id: 99 }])
    expect(api.loadError.value).toBe(false)
    expect(api.listError.value).toBe(false)
  })

  it('请求被取消时静默处理（不置错误态、不覆写加载状态）', async () => {
    let call = 0
    const fetcher = vi.fn((_pageNum, _pageSize, _signal) => {
      call += 1
      if (call === 1) {
        const err = new Error('canceled')
        err.code = 'ERR_CANCELED'
        return Promise.reject(err)
      }
      return page(items10())
    })
    const { api } = withSetup({ fetcher })
    api.loading.value = true // 模拟 van-list 触发 onLoad 时置位
    await api.onLoad()
    expect(api.loadError.value).toBe(false)
    expect(api.listError.value).toBe(false)
    // 取消的请求不覆写 loading，新一轮加载仍保持加载态
    expect(api.loading.value).toBe(true)
    await api.onLoad()
    expect(api.loading.value).toBe(false)
  })

  it('组件卸载时取消未完成请求', async () => {
    const signals = []
    const fetcher = vi.fn((_pageNum, _pageSize, signal) => {
      signals.push(signal)
      return new Promise(() => {}) // 永不 resolve
    })
    const { api, wrapper } = withSetup({ fetcher })
    api.onLoad()
    wrapper.unmount()
    expect(signals[0].aborted).toBe(true)
  })
})
