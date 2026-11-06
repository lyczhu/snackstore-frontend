import { describe, it, expect, vi, beforeEach } from 'vitest'

// 捕获 axios 实例上注册的拦截器，便于直接单测拦截器逻辑
const handlers = {}
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: {
          use: (fulfilled, rejected) => {
            handlers.reqFulfilled = fulfilled
            handlers.reqRejected = rejected
          }
        },
        response: {
          use: (fulfilled, rejected) => {
            handlers.resFulfilled = fulfilled
            handlers.resRejected = rejected
          }
        }
      }
    }))
  }
}))

const { createRequest, interpretResponse } = await import('./request.js')
// 同一份 mock 实例，用于断言 axios.create 的入参
const { default: axios } = await import('axios')

function setup(options = {}) {
  return {
    onError: vi.fn(),
    onUnauthorized: vi.fn(),
    getToken: vi.fn(() => 'test-token'),
    ...options
  }
}

beforeEach(() => {
  handlers.reqFulfilled = null
  handlers.resFulfilled = null
  handlers.resRejected = null
  axios.create.mockClear()
})

describe('createRequest 请求拦截器', () => {
  it('有 token 时注入 Authorization 头', () => {
    const opts = setup()
    createRequest(opts)
    const config = handlers.reqFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBe('Bearer test-token')
  })

  it('无 token 时不注入 Authorization 头', () => {
    const opts = setup({ getToken: () => '' })
    createRequest(opts)
    const config = handlers.reqFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBeUndefined()
  })
})

describe('createRequest 响应拦截器 - 业务结果', () => {
  it('code=200 时返回响应体', () => {
    const opts = setup()
    createRequest(opts)
    const body = { code: 200, message: 'ok', data: { id: 1 } }
    expect(handlers.resFulfilled({ data: body })).toBe(body)
    expect(opts.onError).not.toHaveBeenCalled()
  })

  it('业务错误码时提示并 reject', async () => {
    const opts = setup()
    createRequest(opts)
    await expect(
      handlers.resFulfilled({ data: { code: 500, message: '库存不足' } })
    ).rejects.toThrow('库存不足')
    expect(opts.onError).toHaveBeenCalledWith('库存不足')
  })

  it('业务 401 时触发 onUnauthorized', async () => {
    const opts = setup()
    createRequest(opts)
    await expect(
      handlers.resFulfilled({ data: { code: 401, message: '未登录' } })
    ).rejects.toThrow()
    expect(opts.onUnauthorized).toHaveBeenCalled()
  })

  it('非标准 JSON 响应（网关错误页）不再抛 TypeError，而是统一提示', async () => {
    const opts = setup()
    createRequest(opts)
    await expect(handlers.resFulfilled({ data: '<html>502</html>' })).rejects.toThrow(
      '响应格式非法'
    )
    expect(opts.onError).toHaveBeenCalledWith('服务响应异常，请稍后重试')
  })
})

describe('createRequest 响应拦截器 - HTTP 错误', () => {
  function httpError(status, data) {
    return { response: { status, data } }
  }

  it('HTTP 401 提示登录过期并触发 onUnauthorized', async () => {
    const opts = setup()
    createRequest(opts)
    await expect(handlers.resRejected(httpError(401))).rejects.toBeTruthy()
    expect(opts.onUnauthorized).toHaveBeenCalled()
    expect(opts.onError).toHaveBeenCalledWith('登录已过期，请重新登录')
  })

  it('HTTP 403 提示无权限', async () => {
    const opts = setup()
    createRequest(opts)
    await expect(handlers.resRejected(httpError(403))).rejects.toBeTruthy()
    expect(opts.onError).toHaveBeenCalledWith('没有权限访问')
    expect(opts.onUnauthorized).not.toHaveBeenCalled()
  })

  it('HTTP 500 提示服务器错误', async () => {
    const opts = setup()
    createRequest(opts)
    await expect(handlers.resRejected(httpError(500))).rejects.toBeTruthy()
    expect(opts.onError).toHaveBeenCalledWith('服务器错误')
  })

  it('其他 HTTP 错误透传后端 message', async () => {
    const opts = setup()
    createRequest(opts)
    await expect(handlers.resRejected(httpError(400, { message: '参数错误' }))).rejects.toBeTruthy()
    expect(opts.onError).toHaveBeenCalledWith('参数错误')
  })

  it('无 response 时判定为网络失败', async () => {
    const opts = setup()
    createRequest(opts)
    await expect(handlers.resRejected(new Error('timeout'))).rejects.toBeTruthy()
    expect(opts.onError).toHaveBeenCalledWith('网络连接失败')
  })
})

describe('createRequest baseURL 解析', () => {
  // 重构后 shared 不再读 import.meta.env；环境变量优先级下沉到 H5/admin 调用点。
  // shared 层只保证：显式传入 > 默认 '/api'；空串按未配置处理。
  it('未传入时默认同源 /api', () => {
    createRequest(setup())
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: '/api' }))
  })

  it('显式传入的 baseURL 生效', () => {
    createRequest(setup({ baseURL: 'https://api.example.com/api' }))
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'https://api.example.com/api' })
    )
  })

  it("空串 baseURL 按未配置处理，回退 '/api'", () => {
    createRequest(setup({ baseURL: '' }))
    expect(axios.create.mock.calls[0][0].baseURL).toBe('/api')
  })
})

describe('interpretResponse（传输层无关判定）', () => {
  it('业务成功码 ok 并透传 data', () => {
    expect(interpretResponse({ body: { code: 200, data: { id: 1 } } })).toEqual({
      action: 'ok',
      message: '',
      data: { id: 1 }
    })
  })
  it('业务失败码 → business-error，携带 message', () => {
    const r = interpretResponse({ body: { code: 500, message: '库存不足' } })
    expect(r.action).toBe('business-error')
    expect(r.message).toBe('库存不足')
  })
  it('业务码 401 → unauthorized（非 HTTP）', () => {
    expect(interpretResponse({ body: { code: 401, message: '过期' } }).action).toBe('unauthorized')
  })
  it('HTTP 401/403/500 → 对应文案', () => {
    expect(interpretResponse({ httpStatus: 401, networkError: true }).message).toBe('登录已过期，请重新登录')
    expect(interpretResponse({ httpStatus: 403, networkError: true }).message).toBe('没有权限访问')
    expect(interpretResponse({ httpStatus: 500, networkError: true }).message).toBe('服务器错误')
  })
  it('HTTP 4xx 透传 body.message，归 network', () => {
    const r = interpretResponse({ httpStatus: 404, body: { message: '商品不存在' }, networkError: true })
    expect(r.action).toBe('network')
    expect(r.message).toBe('商品不存在')
  })
  it('无 HTTP 状态的网络错误 → 网络连接失败', () => {
    expect(interpretResponse({ networkError: true }).message).toBe('网络连接失败')
  })
  it('超时 → 请求超时文案', () => {
    expect(interpretResponse({ timeout: true }).message).toBe('请求超时，请稍后重试')
  })
  it('非标准 JSON（网关错误页）→ invalid-response', () => {
    expect(interpretResponse({ body: '<html>' }).action).toBe('invalid-response')
    expect(interpretResponse({}).action).toBe('invalid-response')
  })
})
