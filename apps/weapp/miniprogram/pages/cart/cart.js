import {
  cartStore,
  loadFromStorage,
  getItems,
  getTotalPrice,
  getTotalCount,
  updateQuantity,
  removeItem,
  syncTabBadge
} from '../../stores/cart.js'
import { isLoggedIn } from '../../stores/user.js'
import { ensureLogin } from '../../utils/authGuard.js'

Page({
  data: { items: [], totalPrice: '0.00', totalCount: 0 },

  _unsub: null,

  onLoad() {
    // 购物车在 H5 是 requiresAuth 路由。小程序 tabBar 页不能被 replace，若在 onShow 反复
    // ensureLogin，从登录页返回后会立刻再次 push 登录页形成循环，故只在 onLoad 拦一次；
    // goCheckout 仍保留 isLoggedIn 兜底（对齐 Cart.vue 自身的 goCheckout）。
    if (!ensureLogin('/pages/cart/cart')) return
    loadFromStorage()
    // 订阅 store：数量/删除变更后重算合计并 setData（对齐 D4 页面订阅）
    this._unsub = cartStore.subscribe(() => this.sync())
    this.sync()
  },

  onShow() {
    this.sync()
    syncTabBadge()
  },

  onUnload() {
    if (this._unsub) this._unsub()
  },

  sync() {
    this.setData({
      items: getItems(),
      totalPrice: getTotalPrice().toFixed(2),
      totalCount: getTotalCount()
    })
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + e.currentTarget.dataset.id })
  },

  onStepperChange(e) {
    updateQuantity(e.currentTarget.dataset.id, Number(e.detail))
  },

  onRemove(e) {
    removeItem(e.currentTarget.dataset.id)
  },

  goCheckout() {
    if (!isLoggedIn()) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      wx.navigateTo({
        url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/order-confirm/order-confirm')
      })
      return
    }
    wx.navigateTo({ url: '/pages/order-confirm/order-confirm' })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  }
})
