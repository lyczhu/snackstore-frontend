import request from '@/utils/request'
import { useUserStore } from '@/stores/user'

// 新地址接口要求把当前登录用户 ID 拼进 URL 路径（原接口靠 X-User-Id 请求头识别）。
// 该 ID 必须与登录 Token 中的用户一致，否则服务端返回 403。
// 登录态统一从 Pinia user store 读取（单一数据源），localStorage 仅作 store 的持久化层。
// userId 缺失时不应拼出 /users/undefined/... 的非法请求，直接按未登录拒绝。
function withUserId(fn) {
  const userId = useUserStore().userInfo?.id
  if (userId == null) {
    return Promise.reject(new Error('登录信息缺失，请重新登录'))
  }
  return fn(userId)
}

export function getAddressList() {
  return withUserId((userId) => request.get(`/users/${userId}/addresses`))
}

export function getAddressById(id) {
  return withUserId((userId) => request.get(`/users/${userId}/addresses/${id}`))
}

export function postAddress(data) {
  return withUserId((userId) => request.post(`/users/${userId}/addresses`, data))
}

export function putAddress(id, data) {
  return withUserId((userId) => request.put(`/users/${userId}/addresses/${id}`, data))
}

export function deleteAddress(id) {
  return withUserId((userId) => request.delete(`/users/${userId}/addresses/${id}`))
}

export function setDefaultAddress(id) {
  return withUserId((userId) => request.patch(`/users/${userId}/addresses/${id}/default`))
}
