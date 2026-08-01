/**
 * 共享的 product API（两端通用的读接口）
 * admin 独有的 CRUD 接口保留在 apps/admin/src/api/product.js
 *
 * @param {import('axios').AxiosInstance} request
 */
export function createProductApi(request) {
  return {
    getProductList: (params, signal) => request.get('/product-search', { params, signal }),
    getProductDetail: (id) => request.get(`/products/${id}`),
    getCategoryList: () => request.get('/products/categories')
  }
}

/**
 * 共享的 order API（两端通用）
 * web 独有的 postOrder 保留在 apps/mobile/src/api/order.js
 *
 * @param {import('axios').AxiosInstance} request
 */
export function createOrderApi(request) {
  return {
    getOrderList: (params, signal) => request.get('/orders', { params, signal }),
    getOrderDetail: (id) => request.get(`/orders/${id}`),
    payOrder: (id) => request.patch(`/orders/${id}/status`, null, { params: { status: 1 } }),
    cancelOrder: (id) => request.patch(`/orders/${id}/status`, null, { params: { status: 2 } })
  }
}

/**
 * 共享的 user API（两端通用的 getUserInfo）
 * admin 独有接口保留在 apps/admin/src/api/user.js
 * web 独有接口保留在 apps/mobile/src/api/user.js
 *
 * @param {import('axios').AxiosInstance} request
 */
export function createUserApi(request) {
  return {
    getUserInfo: (id) => request.get(`/users/${id}`)
  }
}
