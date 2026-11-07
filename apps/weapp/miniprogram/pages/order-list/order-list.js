import { createPagedList } from '../../utils/usePagedList.js'
import { getOrderList, payOrder, cancelOrder } from '../../api/order.js'
import { userStore } from '../../stores/user.js'
import { getStatusText, getStatusType } from '../../utils/orderStatus.js'
import { confirm } from '../../utils/confirm.js'
import { ensureLogin } from '../../utils/authGuard.js'
import { toastSuccess } from '../../utils/toast.js'

// tab → status 查询参数：与 OrderList.vue 一致只有 全部/待支付/已完成 三档（后端无已取消 tab）
const TAB_STATUS = { all: undefined, pending: 0, completed: 1 }
const TABS = ['all', 'pending', 'completed']

Page({
  data: {
    activeTab: 'all',
    orders: [],
    loading: false,
    finished: false,
    listError: false,
    initialLoading: true,
    loadError: false,
    // 正在执行支付/取消的订单 id：该订单按钮进入 loading 不可点，防双击并发（对齐 df219bc）
    actionId: null
  },

  list: null,

  onLoad(options) {
    if (!ensureLogin('/pages/order-list/order-list')) return
    const tab = options && options.tab && TABS.indexOf(options.tab) !== -1 ? options.tab : 'all'
    this.setData({ activeTab: tab })
    this.build()
  },

  build() {
    this.list = createPagedList({
      fetcher: (pageNum, pageSize) => {
        const u = userStore.getSnapshot().userInfo
        const params = { userId: u && u.id, pageNum, pageSize }
        const st = TAB_STATUS[this.data.activeTab]
        if (st !== undefined) params.status = st
        return getOrderList(params).then((res) => {
          // WXML 不能调用函数，状态文案/颜色在取数时物化到条目上
          const arr = (res && res.data && res.data.data) || []
          arr.forEach((o) => {
            o.statusText = getStatusText(o.status)
            o.statusType = getStatusType(o.status)
          })
          return res
        })
      }
    })
    this.reload()
  },

  sync() {
    const l = this.list
    this.setData({
      orders: l.items,
      loading: l.loading,
      finished: l.finished,
      listError: l.listError,
      initialLoading: l.initialLoading,
      loadError: l.loadError
    })
  },

  reload() {
    return this.list.resetAndReload().then(() => this.sync())
  },

  onTabChange(e) {
    // van-tabs change 事件：有 name 用 name，只给 index 时映射回 TABS（不依赖组件内部形参）
    const detail = e.detail || {}
    const name = detail.name || TABS[detail.index]
    if (!name || name === this.data.activeTab) return
    this.setData({ activeTab: name })
    this.reload()
  },

  onReachBottom() {
    if (!this.list.finished && !this.list.loading) {
      this.list.onLoad().then(() => this.sync())
    }
  },

  onPullDownRefresh() {
    this.reload().then(() => wx.stopPullDownRefresh())
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + e.currentTarget.dataset.id })
  },

  // catch:tap：卡片本身可点进详情，操作按钮必须阻止冒泡（对齐 H5 @click.stop）
  async handlePay(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.actionId !== null) return
    if (!(await confirm('确认支付该订单？', { title: '模拟支付' }))) return
    this.setData({ actionId: id })
    try {
      await payOrder(id)
      toastSuccess('支付成功')
      await this.reload()
    } catch {
      /* 错误提示已由请求层统一处理 */
    } finally {
      this.setData({ actionId: null })
    }
  },

  async handleCancel(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.actionId !== null) return
    if (!(await confirm('确认取消该订单？'))) return
    this.setData({ actionId: id })
    try {
      await cancelOrder(id)
      toastSuccess('订单已取消')
      await this.reload()
    } catch {
      /* 错误提示已由请求层统一处理 */
    } finally {
      this.setData({ actionId: null })
    }
  }
})
