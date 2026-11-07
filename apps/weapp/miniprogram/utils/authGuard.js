import { isLoggedIn } from '../stores/user.js'

/**
 * requiresAuth 等价物：需登录页面的 onLoad/onShow 首行调用。
 * 未登录则跳 login（带 redirect 当前页 fullPath）并返回 false，调用方据此中止渲染逻辑。
 * @param {string} redirect 当前页 fullPath（含 query）
 * @returns {boolean} 已登录 true；未登录已跳转，返回 false
 */
export function ensureLogin(redirect) {
  if (isLoggedIn()) return true
  wx.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent(redirect) })
  return false
}
