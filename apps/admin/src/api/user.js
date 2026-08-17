import request from '@/utils/request'
import { createUserApi } from '@snackstore/shared'

// 共享接口
export const { getUserInfo } = createUserApi(request)

// admin 独有
export function postAdminLogin(data) {
  return request.post('/auth/admin/login', data)
}

export function getUserList(params, signal) {
  return request.get('/admin/users', { params, signal })
}

export function patchUserStatus(id, status) {
  return request.patch(`/admin/users/${id}/status`, null, { params: { status } })
}
