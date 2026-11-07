import { userStore } from '../stores/user.js'

function req() {
  return getApp().globalData.request
}

// 地址接口把当前登录用户 ID 拼进 URL（对齐 H5 api/address.js）；
// userId 缺失时不拼出 /users/undefined/... 非法请求，直接按未登录拒绝。
function withUserId(fn) {
  const userId = userStore.getSnapshot().userInfo && userStore.getSnapshot().userInfo.id
  if (userId == null) return Promise.reject(new Error('登录信息缺失，请重新登录'))
  return fn(userId)
}

export const getAddressList = () => withUserId((userId) => req().get(`/users/${userId}/addresses`))
export const getAddressById = (id) => withUserId((userId) => req().get(`/users/${userId}/addresses/${id}`))
export const postAddress = (data) => withUserId((userId) => req().post(`/users/${userId}/addresses`, data))
export const putAddress = (id, data) => withUserId((userId) => req().put(`/users/${userId}/addresses/${id}`, data))
export const deleteAddress = (id) => withUserId((userId) => req().del(`/users/${userId}/addresses/${id}`))
export const setDefaultAddress = (id) => withUserId((userId) => req().patch(`/users/${userId}/addresses/${id}/default`))
