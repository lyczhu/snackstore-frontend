import { createStore } from '../utils/store.js'
import { safeParse } from '@snackstore/shared'

// 用户态唯一数据源（token / userInfo），wx.storage 仅作持久化层（对齐 H5「守卫不直读 storage」）
export const userStore = createStore({ token: '', userInfo: null })

// cart store 在自身模块末尾注册合并钩子，避免 user<->cart 顶部循环 import 触发 TDZ
let cartHooks = {}
export function registerCartHooks(hooks) {
  cartHooks = hooks || cartHooks
}

export function initFromStorage() {
  userStore.patch({
    token: wx.getStorageSync('token') || '',
    userInfo: safeParse(wx.getStorageSync('userInfo'), null)
  })
}

export function isLoggedIn() {
  return !!userStore.getSnapshot().token
}

export function getToken() {
  return userStore.getSnapshot().token
}

export function setLogin(data) {
  wx.setStorageSync('token', data.token)
  wx.setStorageSync('userInfo', JSON.stringify(data.user))
  userStore.patch({ token: data.token, userInfo: data.user })
  // 登录成功后触发游客购物车合并（时序：先写 user 态，再合并）
  if (cartHooks.onLoggedIn) cartHooks.onLoggedIn(data.user && data.user.id)
}

export function logout() {
  wx.removeStorageSync('token')
  wx.removeStorageSync('userInfo')
  const old = userStore.getSnapshot().userInfo
  userStore.patch({ token: '', userInfo: null })
  if (cartHooks.onLoggedOut) cartHooks.onLoggedOut(old && old.id)
}

export function updateUserInfo(patchData) {
  const userInfo = { ...userStore.getSnapshot().userInfo, ...patchData }
  wx.setStorageSync('userInfo', JSON.stringify(userInfo))
  userStore.patch({ userInfo })
}
