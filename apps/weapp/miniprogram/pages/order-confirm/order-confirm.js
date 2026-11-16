import { getAddressList } from '../../api/address.js'
import { postOrder } from '../../api/order.js'
import { getProductDetail } from '../../api/product.js'
import { cartStore, clearCart, clearBuyNowItem } from '../../stores/cart.js'
import { calcCentsTotal, getCartItemIssue, CART_ISSUE_TEXT } from '@snackstore/shared/cart'
import { reconcileOrderAmount } from '@snackstore/shared/orderAmount'
import { ensureLogin } from '../../utils/authGuard.js'
import { toastFail, toastSuccess } from '../../utils/toast.js'

const toYuan = (cents) => (cents / 100).toFixed(2)

Page({
  data: {
    from: 'cart',
    items: [],
    // 失效条目不进订单也不计入合计（productId 命中 itemIssues 即失效）
    validItems: [],
    invalidItems: [],
    itemIssues: {},
    checking: false,
    total: '0.00',
    addresses: [],
    address: null,
    addressError: false,
    showPicker: false,
    loading: false
  },

  initialized: false,

  onLoad(options) {
    const from = (options && options.from) || 'cart'
    const redirect = '/pages/order-confirm/order-confirm?from=' + from
    if (!ensureLogin(redirect)) return
    // 直购快照只存在于内存：刷新/进程回收后丢失，引导重新下单防误结算购物车（对齐 H5 onMounted）
    if (from === 'buyNow' && !cartStore.getSnapshot().buyNowItem) {
      toastFail('直购信息已失效，请重新下单')
      wx.switchTab({ url: '/pages/home/home' })
      return
    }
    this.setData({ from })
    this.syncItems()
    this.initialized = true
    this.loadAddresses()
    this.validateItems()
  },

  // 从地址页返回时刷新：新增/删除/改默认都要让当前选择保持有效
  // （H5 靠组件重新挂载拉取，小程序页面实例会复用，故放 onShow）
  onShow() {
    if (!this.initialized || !this.data.address) return
    getAddressList()
      .then((res) => {
        const list = (res && res.data) || []
        const keep = list.find((a) => a.id === this.data.address.id)
        this.setData({
          addresses: list,
          address: keep || list.find((a) => a.isDefault === 1) || list[0] || null
        })
      })
      .catch(() => {
        /* 保持原列表，提交时仍有地址可用 */
      })
  },

  syncItems() {
    const s = cartStore.getSnapshot()
    const items = this.data.from === 'buyNow' ? [s.buyNowItem].filter(Boolean) : s.items
    this.setData({
      items,
      validItems: items,
      invalidItems: [],
      total: calcCentsTotal(items).toFixed(2)
    })
  },

  // 结算快照可能已过期：按服务端最新商品校验，失效条目不参与结算（对齐 OrderConfirm.vue）
  validateItems() {
    const items = this.data.items
    if (!items.length) return
    this.setData({ checking: true })
    Promise.all(
      items.map((item) =>
        getProductDetail(item.productId)
          .then((res) => ({ id: item.productId, issue: getCartItemIssue(item, res && res.data) }))
          .catch(() => ({ id: item.productId, issue: null }))
      )
    ).then((list) => {
      const issueMap = {}
      list.forEach((x) => {
        if (x.issue) issueMap[x.id] = x.issue
      })
      const validItems = items.filter((i) => !issueMap[i.productId])
      const invalidItems = items
        .filter((i) => issueMap[i.productId])
        .map((i) => ({ ...i, issueText: CART_ISSUE_TEXT[issueMap[i.productId]] }))
      this.setData({
        checking: false,
        itemIssues: issueMap,
        validItems,
        invalidItems,
        total: calcCentsTotal(validItems).toFixed(2)
      })
    })
  },

  loadAddresses() {
    this.setData({ addressError: false })
    getAddressList()
      .then((res) => {
        const list = (res && res.data) || []
        this.setData({
          addresses: list,
          address: list.find((a) => a.isDefault === 1) || list[0] || null
        })
      })
      .catch(() => this.setData({ addressError: true }))
  },

  openPicker() {
    this.setData({ showPicker: true })
  },

  closePicker() {
    this.setData({ showPicker: false })
  },

  selectAddress(e) {
    const id = e.currentTarget.dataset.id
    const addr = this.data.addresses.find((a) => a.id === id)
    this.setData({ address: addr, showPicker: false })
  },

  goAddAddress() {
    wx.navigateTo({ url: '/pages/address/address' })
  },

  retryAddresses() {
    this.loadAddresses()
  },

  async submitOrder() {
    if (this.data.loading) return
    if (!this.data.address) {
      toastFail('请选择收货地址')
      return
    }
    if (!this.data.validItems.length) {
      toastFail('商品已失效，无法结算')
      return
    }
    this.setData({ loading: true })
    const a = this.data.address
    const data = {
      items: this.data.validItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      receiverName: a.receiverName,
      receiverPhone: a.receiverPhone,
      // 地址是「省市区+详细」拼出的纯文本快照（与 H5 后端约定一致，不传 addressId）
      receiverAddress: `${a.province || ''}${a.city || ''}${a.district || ''}${a.detail}`
    }
    // 幂等键：防网络重试/重复提交产生重复订单（按钮 loading 防不了重试）
    const idempotencyKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    try {
      const res = await postOrder(data, { headers: { 'Idempotency-Key': idempotencyKey } })
      const order = (res && res.data) || {}
      // 本地快照 vs 服务端实收：调价或快照过期时以后端金额为准，并如实告知用户
      const check = reconcileOrderAmount(this.data.total, order.totalAmount)
      // 直购仅清快照；购物车结算才清空购物车
      if (this.data.from === 'buyNow') clearBuyNowItem()
      else clearCart()
      if (check.mismatch) {
        this.setData({ loading: false })
        this.showAmountChanged(check, order.id)
        return
      }
      toastSuccess('下单成功')
      // replace 语义：避免回退到确认页重复提交
      wx.redirectTo({ url: '/pages/order-list/order-list' })
    } catch {
      // 错误提示已由请求层统一处理（对齐 H5 拦截器）
      this.setData({ loading: false })
    }
  },

  // 金额已变：告知实际应付金额后进详情页（可再取消订单）
  showAmountChanged(check, orderId) {
    wx.showModal({
      title: '订单金额已更新',
      content: `本地显示 ¥${toYuan(check.localCents)}，实际应付 ¥${toYuan(check.serverCents)}。商品价格可能已调整，请以下单金额为准。`,
      showCancel: false,
      confirmText: '查看订单',
      success: () => {
        wx.redirectTo({
          url: orderId
            ? '/pages/order-detail/order-detail?id=' + orderId
            : '/pages/order-list/order-list'
        })
      }
    })
  },

  goBackAfterInvalid() {
    if (this.data.from === 'buyNow') {
      wx.switchTab({ url: '/pages/home/home' })
      return
    }
    wx.switchTab({ url: '/pages/cart/cart' })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  }
})
