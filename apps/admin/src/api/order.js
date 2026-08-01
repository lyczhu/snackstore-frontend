import request from '@/utils/request'
import { createOrderApi } from '@snackstore/shared'

export const { getOrderList, getOrderDetail, payOrder, cancelOrder } = createOrderApi(request)
