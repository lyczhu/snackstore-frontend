import { describe, it, expect, vi } from 'vitest'
import { createStore } from './store.js'

describe('createStore', () => {
  it('patch 合并并通知订阅者，返回新快照', () => {
    const s = createStore({ a: 1, b: 2 })
    const fn = vi.fn()
    const off = s.subscribe(fn)
    s.patch({ b: 9 })
    expect(s.getSnapshot()).toEqual({ a: 1, b: 9 })
    expect(fn).toHaveBeenCalledWith({ a: 1, b: 9 })
    off()
    s.patch({ b: 0 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('多个订阅者都收到通知', () => {
    const s = createStore({ n: 0 })
    const a = vi.fn()
    const b = vi.fn()
    s.subscribe(a)
    s.subscribe(b)
    s.patch({ n: 1 })
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})
