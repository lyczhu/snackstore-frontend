import request from '@/utils/request'
import { createUserApi } from '@snackstore/shared'

// 共享接口
export const { getUserInfo } = createUserApi(request)

// web 独有
export function postLogin(data) {
  return request.post('/auth/login', data)
}

export function postRegister(data) {
  return request.post('/auth/register', data)
}

export function putUserInfo(id, data) {
  return request.put(`/users/${id}`, data)
}
