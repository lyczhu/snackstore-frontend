import { calcCentsTotal } from '@snackstore/shared/cart'
import { addItem, clearCart, getTotalPrice, getTotalCount } from '../../stores/cart.js'

Page({
  data: { pureTotal: '0.00', total: '0.00', count: 0 },

  onLoad() {
    // 1) shared 纯函数：0.1 + 0.2 防浮点漂移应得 0.30
    const pure = calcCentsTotal([{ price: 0.1, quantity: 1 }, { price: 0.2, quantity: 1 }])
    // 自检页幂等：先清空再加两件，避免持久化导致每次编译累加
    clearCart()
    addItem({ id: 'poc-a', name: 'A', price: 0.1, coverImage: '' })
    addItem({ id: 'poc-b', name: 'B', price: 0.2, coverImage: '' })
    this.setData({
      pureTotal: pure.toFixed(2),
      total: getTotalPrice().toFixed(2),
      count: getTotalCount()
    })
  },

  onTap() {
    wx.showToast({ title: '@vant/weapp + shared 可用', icon: 'none' })
  }
})
