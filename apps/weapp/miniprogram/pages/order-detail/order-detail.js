import { getOrderDetail, payOrder, cancelOrder } from '../../api/order.js'
import { getStatusText, getStatusType } from '../../utils/orderStatus.js'
import { confirm } from '../../utils/confirm.js'
import { ensureLogin } from '../../utils/authGuard.js'
import { toastSuccess } from '../../utils/toast.js'

Page({
  data: {
    order: null,
    statusText: '',
    statusType: 'default',
    loading: true,
    loadError: false,
    actionLoading: false
  },

  id: null,

  onLoad(options) {
    if (!ensureLogin('/pages/order-detail/order-detail?id=' + (options && options.id))) return
    this.id = options && options.id
    this.loadOrder()
  },

  loadOrder() {
    this.setData({ loading: true, loadError: false })
    getOrderDetail(this.id)
      .then((res) => {
        const o = res && res.data
        // WXML 不能调用函数：状态文案/颜色在此物化
        this.setData({
          order: o,
          loading: false,
          statusText: getStatusText(o && o.status),
          statusType: getStatusType(o && o.status)
        })
      })
      .catch(() => this.setData({ loading: false, loadError: true }))
  },

  goBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/home/home' })
  },

  async handlePay() {
    if (this.data.actionLoading) return
    if (!(await confirm('确认支付该订单？', { title: '模拟支付' }))) return
    this.setData({ actionLoading: true })
    try {
      await payOrder(this.data.order.id)
      toastSuccess('支付成功')
      this.loadOrder()
    } catch {
      /* 错误提示已由请求层统一处理 */
    } finally {
      this.setData({ actionLoading: false })
    }
  },

  async handleCancel() {
    if (this.data.actionLoading) return
    if (!(await confirm('确认取消该订单？'))) return
    this.setData({ actionLoading: true })
    try {
      await cancelOrder(this.data.order.id)
      toastSuccess('订单已取消')
      this.loadOrder()
    } catch {
      /* 错误提示已由请求层统一处理 */
    } finally {
      this.setData({ actionLoading: false })
    }
  }
})
