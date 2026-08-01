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

const { createRequest } = await import('./request.js')

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
