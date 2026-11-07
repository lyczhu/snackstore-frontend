function req() {
  return getApp().globalData.request
}

export const getOrderList = (params) => req().get('/orders', { params })
export const getOrderDetail = (id) => req().get(`/orders/${id}`)
export const payOrder = (id) => req().patch(`/orders/${id}/status`, null, { params: { status: 1 } })
export const cancelOrder = (id) => req().patch(`/orders/${id}/status`, null, { params: { status: 2 } })
// options 透传，用于幂等键等请求级配置（对齐 H5 postOrder）
export const postOrder = (data, options) => req().post('/orders', data, options)
