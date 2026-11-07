import { initFromStorage, getToken } from './stores/user.js'
import { loadFromStorage } from './stores/cart.js'
import { createWxRequest } from './utils/request.js'
import env from './config/env.js'

App({
  globalData: { request: null },

  onLaunch() {
    // 启动恢复登录态与购物车（小程序无拦截器懒读，启动即恢复）
    initFromStorage()
    loadFromStorage()

    // 统一请求实例，页面通过 getApp().globalData.request 复用
    this.globalData.request = createWxRequest({
      baseURL: env.API_BASE_URL,
      timeout: env.TIMEOUT,
      getToken,
      onUnauthorized: () => {
        const { logout } = require('./stores/user.js')
        logout()
      },
      onError: (msg) => wx.showToast({ title: msg, icon: 'none' })
    })
  },

  onError(err) {
    console.error('[app.onError]', err)
  }
})
