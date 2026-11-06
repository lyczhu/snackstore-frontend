import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWxRequest } from './request.js'

let captured
beforeEach(() => {
  captured = null
  vi.spyOn(wx, 'request').mockImplementation((opt) => {
    captured = opt
    opt.success({ statusCode: 200, data: { code: 200, data: { id: 7 } }, header: {} })
  })
})

describe('createWxRequest', () => {
  it('拼接 baseURL + path + params，注入 Authorization', async () => {
    const req = createWxRequest({ baseURL: 'http://h/api', getToken: () => 't1' })
    const res = await req.get('/orders', { params: { pageNum: 1, status: undefined } })
    expect(captured.url).toBe('http://h/api/orders?pageNum=1')
    expect(captured.header.Authorization).toBe('Bearer t1')
    expect(res.data.id).toBe(7)
  })

  it('无 token 时不注入 Authorization', async () => {
    const req = createWxRequest({ baseURL: 'http://h/api', getToken: () => '' })
    await req.get('/orders')
    expect(captured.header.Authorization).toBeUndefined()
  })

  it('业务码 401 触发 onUnauthorized 并 reject', async () => {
    vi.spyOn(wx, 'request').mockImplementation((o) =>
      o.success({ statusCode: 200, data: { code: 401, message: '过期' } })
    )
    const onUnauthorized = vi.fn()
    const req = createWxRequest({ baseURL: 'http://h/api', onUnauthorized })
    await expect(req.get('/x')).rejects.toThrow('过期')
    expect(onUnauthorized).toHaveBeenCalled()
  })

  it('fail 走网络连接失败文案', async () => {
    vi.spyOn(wx, 'request').mockImplementation((o) => o.fail({ errMsg: 'request:fail' }))
    const onError = vi.fn()
    const req = createWxRequest({ baseURL: 'http://h/api', onError })
    await expect(req.get('/x')).rejects.toBeTruthy()
    expect(onError).toHaveBeenCalledWith('网络连接失败')
  })

  it('patch 透传 data 与 params（订单状态更新）', async () => {
    const req = createWxRequest({ baseURL: 'http://h/api' })
    await req.patch('/orders/9/status', null, { params: { status: 1 } })
    expect(captured.method).toBe('PATCH')
    expect(captured.url).toBe('http://h/api/orders/9/status?status=1')
  })

  it('默认 baseURL 走 env（未显式传入时）', async () => {
    const req = createWxRequest({})
    await req.get('/ping')
    expect(captured.url.startsWith('http://localhost:8080/api/ping')).toBe(true)
  })
})
