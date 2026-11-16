import { getAgreement } from '@snackstore/shared/agreements'

Page({
  data: { doc: null, notFound: false },

  onLoad(options) {
    const doc = getAgreement(options && options.type)
    if (!doc) {
      this.setData({ notFound: true })
      return
    }
    wx.setNavigationBarTitle({ title: doc.title })
    this.setData({ doc })
  },

  goBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/mine/mine' })
  }
})
