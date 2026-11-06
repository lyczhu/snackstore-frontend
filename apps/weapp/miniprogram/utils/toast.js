// 轻提示统一走原生 wx.showToast（不挂 Vant Weapp toast 实例，spec D10）
export function toastFail(title) {
  wx.showToast({ title, icon: 'none' })
}

export function toastSuccess(title) {
  wx.showToast({ title, icon: 'success' })
}
