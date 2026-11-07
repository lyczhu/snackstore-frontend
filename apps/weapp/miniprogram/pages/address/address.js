import {
  getAddressList,
  postAddress,
  putAddress,
  deleteAddress,
  setDefaultAddress
} from '../../api/address.js'
import { ensureLogin } from '../../utils/authGuard.js'
import { confirm } from '../../utils/confirm.js'
import { toastSuccess } from '../../utils/toast.js'

const PHONE_RE = /^1[3-9]\d{9}$/

const emptyForm = () => ({
  receiverName: '',
  receiverPhone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: 0
})

Page({
  data: {
    addresses: [],
    initialLoading: true,
    loadError: false,
    dialogVisible: false,
    isEdit: false,
    editId: null,
    submitting: false,
    form: emptyForm(),
    errors: { receiverName: '', receiverPhone: '', detail: '' }
  },

  onLoad() {
    if (!ensureLogin('/pages/address/address')) return
    this.loadAddresses()
  },

  loadAddresses() {
    this.setData({ loadError: false })
    getAddressList()
      .then((res) => this.setData({ addresses: (res && res.data) || [], initialLoading: false }))
      .catch(() => this.setData({ loadError: true, initialLoading: false }))
  },

  retry() {
    this.setData({ initialLoading: true })
    this.loadAddresses()
  },

  showAddDialog() {
    this.setData({
      isEdit: false,
      editId: null,
      form: emptyForm(),
      errors: { receiverName: '', receiverPhone: '', detail: '' },
      dialogVisible: true
    })
  },

  editAddress(e) {
    const addr = this.data.addresses.find((a) => a.id === e.currentTarget.dataset.id)
    if (!addr) return
    this.setData({
      isEdit: true,
      editId: addr.id,
      errors: { receiverName: '', receiverPhone: '', detail: '' },
      form: {
        receiverName: addr.receiverName,
        receiverPhone: addr.receiverPhone,
        province: addr.province,
        city: addr.city,
        district: addr.district,
        detail: addr.detail,
        isDefault: addr.isDefault
      },
      dialogVisible: true
    })
  },

  closeDialog() {
    this.setData({ dialogVisible: false })
  },

  onField(e) {
    const key = e.currentTarget.dataset.field
    this.setData({ ['form.' + key]: e.detail, ['errors.' + key]: '' })
  },

  onDefaultChange(e) {
    this.setData({ 'form.isDefault': e.detail ? 1 : 0 })
  },

  // van-form 在 Vant Weapp 中不存在，规则同 H5 在页面层实现
  validate() {
    const f = this.data.form
    const errors = { receiverName: '', receiverPhone: '', detail: '' }
    if (!f.receiverName) errors.receiverName = '请输入收货人姓名'
    if (!f.receiverPhone) errors.receiverPhone = '请输入手机号'
    else if (!PHONE_RE.test(f.receiverPhone)) errors.receiverPhone = '手机号格式不正确'
    if (!f.detail) errors.detail = '请输入详细地址'
    this.setData({ errors })
    return !errors.receiverName && !errors.receiverPhone && !errors.detail
  },

  submitForm() {
    if (this.data.submitting || !this.validate()) return
    this.setData({ submitting: true })
    const isEdit = this.data.isEdit
    const request = isEdit
      ? putAddress(this.data.editId, this.data.form)
      : postAddress(this.data.form)
    request
      .then(() => {
        toastSuccess(isEdit ? '修改成功' : '添加成功')
        this.setData({ dialogVisible: false })
        this.loadAddresses()
      })
      .catch(() => {
        /* 错误提示已由请求层统一处理 */
      })
      .then(() => this.setData({ submitting: false }))
  },

  setDefault(e) {
    const id = e.currentTarget.dataset.id
    setDefaultAddress(id)
      .then(() => {
        toastSuccess('已设为默认')
        this.loadAddresses()
      })
      .catch(() => {
        /* 错误提示已由请求层统一处理 */
      })
  },

  async handleDelete(e) {
    const id = e.currentTarget.dataset.id
    if (!(await confirm('确定删除该地址？'))) return
    deleteAddress(id)
      .then(() => {
        toastSuccess('已删除')
        this.loadAddresses()
      })
      .catch(() => {
        /* 错误提示已由请求层统一处理 */
      })
  }
})
