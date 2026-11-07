import { getProductDetail } from '../../api/product.js'
import { addItem, setBuyNowItem } from '../../stores/cart.js'
import { isLoggedIn } from '../../stores/user.js'
import { toastFail, toastSuccess } from '../../utils/toast.js'

Page({
  data: {
    product: null,
    loading: true,
    loadError: false,
    offShelf: false,
    detailHtml: ''
  },

  id: null,

  onLoad(options) {
    this.id = options && options.id
    this.load()
  },

  load() {
    this.setData({ loading: true, loadError: false })
    getProductDetail(this.id)
      .then((res) => {
        const p = res && res.data
        if (!p) {
          this.setData({ loading: false, loadError: true })
          return
        }
        this.setData({
          product: p,
          loading: false,
          // 下架态禁用加购/直购（对齐 ProductDetail.vue 的 status === 0）
          offShelf: p.status === 0,
          // spec D5：详情富文本直接交给 rich-text 渲染，不走 DOMPurify
          // —— rich-text 不执行 script、不响应 on* 事件属性，无存储型 XSS 执行面
          detailHtml: p.detail || ''
        })
      })
      .catch(() => {
        this.setData({ loading: false, loadError: true })
      })
  },

  goBack() {
    // 对齐 H5 goBack：有历史则返回，否则回首页（小程序里首页是 tab，用 switchTab）
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/home/home' })
  },

  onAddCart() {
    if (!this.data.product) return toastFail('信息未加载完成')
    addItem(this.data.product)
    toastSuccess('已加入购物车')
  },

  onBuyNow() {
    if (!this.data.product) return toastFail('信息未加载完成')
    if (!isLoggedIn()) {
      toastFail('请先登录')
      wx.navigateTo({
        url:
          '/pages/login/login?redirect=' +
          encodeURIComponent('/pages/product-detail/product-detail?id=' + this.id)
      })
      return
    }
    // 直购写入独立快照并带标记跳转，确认订单页只结算该商品（对齐 H5）
    setBuyNowItem(this.data.product, 1)
    wx.navigateTo({ url: '/pages/order-confirm/order-confirm?from=buyNow' })
  }
})
