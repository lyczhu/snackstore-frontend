/**
 * Promise 化 wx.showModal：resolve(true=确认 / false=取消)，语义对齐 H5 showConfirmDialog。
 * @param {string} content
 * @param {{ title?: string, confirmButtonText?: string, cancelButtonText?: string }} [options]
 * @returns {Promise<boolean>}
 */
export function confirm(content, options = {}) {
  return new Promise((resolve) => {
    wx.showModal({
      title: options.title || '提示',
      content,
      confirmText: options.confirmButtonText || '确定',
      cancelText: options.cancelButtonText || '取消',
      confirmColor: '#ee0a24',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
}
