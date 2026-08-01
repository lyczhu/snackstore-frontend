import { describe, it, expect, vi } from 'vitest'
import { createProductApi, createOrderApi, createUserApi } from './api.js'

// 用 stub 替代真实 axios 实例，验证 API 工厂拼出的路径 / 方法 / 参数
function stubRequest() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}

describe('createProductApi', () => {
  it('getProductList 走 /product-search 并透传 params 与 signal', () => {
    const request = stubRequest()
    const api = createProductApi(request)
    const signal = new AbortController().signal
    api.getProductList({ pageNum: 1 }, signal)
    expect(request.get).toHaveBeenCalledWith('/product-search', {
      params: { pageNum: 1 },
      signal
    })
  })

  it('getProductDetail / getCategoryList 路径正确', () => {
    const request = stubRequest()
    const api = createProductApi(request)
    api.getProductDetail(123)
    api.getCategoryList()
    expect(request.get).toHaveBeenCalledWith('/products/123')
    expect(request.get).toHaveBeenCalledWith('/products/categories')
  })
})

describe('createOrderApi', () => {
  it('支付 / 取消合并为 PATCH status，分别以 status=1 / 2 区分', () => {
    const request = stubRequest()
    const api = createOrderApi(request)
    api.payOrder(5)
    api.cancelOrder(5)
    expect(request.patch).toHaveBeenNthCalledWith(1, '/orders/5/status', null, {
      params: { status: 1 }
    })
    expect(request.patch).toHaveBeenNthCalledWith(2, '/orders/5/status', null, {
      params: { status: 2 }
    })
  })

  it('列表与详情路径正确', () => {
    const request = stubRequest()
    const api = createOrderApi(request)
    const signal = new AbortController().signal
    api.getOrderList({ pageNum: 2 }, signal)
    api.getOrderDetail(9)
    expect(request.get).toHaveBeenCalledWith('/orders', { params: { pageNum: 2 }, signal })
    expect(request.get).toHaveBeenCalledWith('/orders/9')
  })
})

describe('createUserApi', () => {
  it('getUserInfo 路径正确', () => {
    const request = stubRequest()
    const api = createUserApi(request)
    api.getUserInfo(7)
    expect(request.get).toHaveBeenCalledWith('/users/7')
  })
})
