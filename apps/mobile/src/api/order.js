import request from '@/utils/request'
import { createOrderApi } from '@snackstore/shared'

export const { getOrderList, getOrderDetail, payOrder, cancelOrder } = createOrderApi(request)

// web 独有
// options 透传给 axios，用于携带幂等键等请求级配置
export function postOrder(data, options) {
  return request.post('/orders', data, options)
}
