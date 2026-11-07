import { configureErrorTracking, reportError } from '@snackstore/shared/errorTracking'
import env from './config/env.js'
import { createWxRequest } from './utils/request.js'
import { initFromStorage, getToken, logout } from './stores/user.js'
import { loadFromStorage } from './stores/cart.js'

App({
  globalData: { request: null },

  onLaunch() {
    // 1) 启动恢复登录态与购物车（小程序无拦截器懒读，启动即恢复）
    initFromStorage()
    loadFromStorage()

    // 2) 注入式错误上报通道（优先 wx.request POST；缺省不发送）
    configureErrorTracking({
      isDev: env.IS_DEV,
      errorReportUrl: env.ERROR_REPORT_URL,
      transport: (body) => {
        if (env.ERROR_REPORT_URL) {
          wx.request({
            url: env.ERROR_REPORT_URL,
            method: 'POST',
            header: { 'content-type': 'application/json' },
            data: body
          })
        }
      }
    })

    // 3) 统一请求实例（页面用 getApp().globalData.request）
    this.globalData.request = createWxRequest({
      baseURL: env.API_BASE_URL,
      timeout: env.TIMEOUT,
      getToken,
      onUnauthorized: () => {
        logout()
        wx.navigateTo({ url: '/pages/login/login' })
      },
      onError: (msg) => wx.showToast({ title: msg, icon: 'none' })
    })
  },

  // 隐私弹窗：基础库 2.32.3+ 才支持；能力探测降级（D13）
  onShow() {
    if (typeof wx.getPrivacySetting === 'function') {
      wx.getPrivacySetting({
        success: (res) => {
          if (res.needAuthorization) {
            wx.requirePrivacyAuthorize({ success: () => {}, fail: () => {} })
          }
        },
        fail: () => {}
      })
    }
  },

  onError(err) {
    reportError(err, { type: 'error', scene: 'app.onError' })
  },

  onUnhandledRejection(res) {
    reportError(res.reason, { type: 'unhandledrejection', scene: 'app.rejection' })
  }
})
