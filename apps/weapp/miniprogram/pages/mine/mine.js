import { userStore, logout, isLoggedIn } from '../../stores/user.js'
import { confirm } from '../../utils/confirm.js'
import { ensureLogin } from '../../utils/authGuard.js'
import { toastSuccess } from '../../utils/toast.js'

Page({
  data: { user: null, logged: false },

  onShow() {
    this.sync()
  },

  sync() {
    const s = userStore.getSnapshot()
    this.setData({ user: s.userInfo, logged: isLoggedIn() })
  },

  // 未登录用户卡：Mine.vue 用 router-link 跳 /login，这里带 redirect 回跳本页。
  // 注意不在 onLoad 自动 ensureLogin —— mine 是 tabBar 页，无法被 replace，
  // 自动跳会在返回后再次触发形成循环；改为 UI 上的显式「点击登录」入口。
  goLogin() {
    wx.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/mine/mine') })
  },

  goOrders() {
    if (!ensureLogin('/pages/mine/mine')) return
    wx.navigateTo({ url: '/pages/order-list/order-list' })
  },

  goAddress() {
    if (!ensureLogin('/pages/mine/mine')) return
    wx.navigateTo({ url: '/pages/address/address' })
  },

  async onLogout() {
    if (!(await confirm('确定要退出登录吗？'))) return
    logout()
    this.sync()
    toastSuccess('已退出登录')
    // 对齐 Mine.vue：退出后 push('/login')；购物车不清空（按账号隔离，重登自动恢复）
    wx.navigateTo({ url: '/pages/login/login' })
  }
})
