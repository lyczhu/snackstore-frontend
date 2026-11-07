import { postLogin, postRegister } from '../../api/user.js'
import { setLogin } from '../../stores/user.js'
import { toastSuccess } from '../../utils/toast.js'

// tabBar 页只能用 switchTab 回跳（navigateTo/redirectTo 对 tab 页无效）
const TAB_PAGES = ['/pages/home/home', '/pages/category/category', '/pages/cart/cart', '/pages/mine/mine']

// @vant/weapp 没有 form 组件、field 也没有 rules，因此校验放在页面层，
// 规则与 Login.vue 的 van-field rules 逐条对齐，错误文案经 error-message 内联展示。
const PHONE_RE = /^1[3-9]\d{9}$/

Page({
  data: {
    phone: '',
    password: '',
    showPassword: false,
    loading: false,
    errors: { phone: '', password: '' },
    redirect: ''
  },

  onLoad(options) {
    this.setData({ redirect: options && options.redirect ? decodeURIComponent(options.redirect) : '' })
  },

  onPhone(e) {
    this.setData({ phone: e.detail, 'errors.phone': '' })
  },

  onPassword(e) {
    this.setData({ password: e.detail, 'errors.password': '' })
  },

  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword })
  },

  validate() {
    const { phone, password } = this.data
    const errors = { phone: '', password: '' }
    if (!phone) errors.phone = '请输入手机号'
    else if (!PHONE_RE.test(phone)) errors.phone = '手机号格式不正确'
    if (!password) errors.password = '请输入密码'
    else if (password.length < 6) errors.password = '密码至少6位'
    this.setData({ errors })
    return !errors.phone && !errors.password
  },

  submit() {
    if (this.data.loading || !this.validate()) return
    this.send(postLogin, { phone: this.data.phone, password: this.data.password }, '登录成功', false)
  },

  // 注册按钮非 submit，需手动触发校验（对齐 Login.vue handleRegister）；
  // 验证码仍是后端约定的固定值，待后端验证码接口就绪后改为表单收集
  register() {
    if (this.data.loading || !this.validate()) return
    this.send(
      postRegister,
      { phone: this.data.phone, password: this.data.password, code: '123456' },
      '注册成功',
      true
    )
  },

  send(api, payload, successText, isRegister) {
    this.setData({ loading: true })
    api(payload)
      .then((res) => {
        // 请求层已把业务/网络错误统一 toast（对齐 H5 axios 拦截器），这里只做成功态
        setLogin(res.data)
        toastSuccess(successText)
        this.afterAuth(isRegister)
      })
      .catch(() => {
        this.setData({ loading: false })
      })
  },

  afterAuth(isRegister) {
    // 注册成功对齐 H5：固定回首页；登录成功按 redirect 回跳
    const r = isRegister ? '' : this.data.redirect
    // 仅允许站内相对路径，防开放重定向（对齐 Login.vue 的 startsWith('/') && !startsWith('//')）
    const target = typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/'
    if (target === '/' || TAB_PAGES.indexOf(target) !== -1) {
      wx.switchTab({ url: target === '/' ? '/pages/home/home' : target })
      return
    }
    wx.redirectTo({ url: target })
  }
})
