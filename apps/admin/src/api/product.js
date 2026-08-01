import request from '@/utils/request'
import { createProductApi } from '@snackstore/shared'

// 共享的读接口
export const { getProductList, getProductDetail, getCategoryList } = createProductApi(request)

// admin 独有的 CRUD 接口
export function postProduct(data) {
  return request.post('/products', data)
}

export function putProduct(id, data) {
  return request.put(`/products/${id}`, data)
}

export function deleteProduct(id) {
  return request.delete(`/products/${id}`)
}

export function putProductStatus(id, status) {
  return request.patch(`/products/${id}/status`, null, { params: { status } })
}

export function postCategory(data) {
  return request.post('/products/categories', data)
}

export function putCategory(id, data) {
  return request.put(`/products/categories/${id}`, data)
}

export function deleteCategory(id) {
  return request.delete(`/products/categories/${id}`)
}
