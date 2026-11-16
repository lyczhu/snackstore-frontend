import { createPaymentProvider } from '@snackstore/shared/payment'
import { getOrderDetail, payOrder } from '../../api/order.js'
import { ensureLogin } from '../../utils/authGuard.js'
import { toastSuccess } from '../../utils/toast.js'

// 小程序没有构建期环境变量，支付模式在此固定；接入真实支付时改这一处
const PAYMENT_MODE = 'local'

Page({
  data: {
    loading: true,
    loadError: false,
    intent: null,
    paying: false,
    paid: false,
    countdownText: '',
    expired: false
  },

  id: null,
  provider: null,
  timer: null,

  onLoad(options) {
    if (!ensureLogin('/pages/payment/payment?id=' + (options && options.id))) return
    this.id = options && options.id
    this.provider = createPaymentProvider({ mode: PAYMENT_MODE, payOrder })
    this.loadOrder()
  },

  onUnload() {
    this.stopTimer()
  },

  loadOrder() {
    this.setData({ loading: true, loadError: false })
    getOrderDetail(this.id)
      .then((res) => {
        const order = res && res.data
        if (!order || order.status !== 0) {
          wx.showToast({ title: '该订单无需支付', icon: 'none' })
          this.goOrder(order && order.id)
          return
        }
        this.setData({ intent: this.provider.createIntent(order), loading: false })
        this.startTimer()
      })
      .catch(() => this.setData({ loading: false, loadError: true }))
  },

  startTimer() {
    this.stopTimer()
    this.tick()
    this.timer = setInterval(() => this.tick(), 1000)
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  tick() {
    const expireAt = this.data.intent && this.data.intent.expireAt
    if (!expireAt) return
    const remaining = Math.max(0, expireAt - Date.now())
    if (remaining === 0) {
      this.setData({ countdownText: '', expired: true })
      this.stopTimer()
      return
    }
    const total = Math.ceil(remaining / 1000)
    const mm = String(Math.floor(total / 60)).padStart(2, '0')
    const ss = String(total % 60).padStart(2, '0')
    this.setData({ countdownText: mm + ':' + ss, expired: false })
  },

  async handlePay() {
    if (this.data.paying) return
    this.setData({ paying: true })
    try {
      await this.provider.pay(this.data.intent)
      this.stopTimer()
      this.setData({ paid: true })
      toastSuccess('支付成功')
    } catch {
      /* 错误提示已由请求层统一处理 */
    } finally {
      this.setData({ paying: false })
    }
  },

  goOrder(id) {
    const target = id || (this.data.intent && this.data.intent.orderId) || this.id
    wx.redirectTo({ url: '/pages/order-detail/order-detail?id=' + target })
  }
})
