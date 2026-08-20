// 后端统一响应体 { code, message, data } 中的业务成功码
export const API_SUCCESS_CODE = 200

// 订单状态枚举（与后端契约对齐，两端共用）
export const ORDER_STATUS = {
  PENDING: 0, // 待支付
  COMPLETED: 1, // 已完成
  CANCELLED: 2 // 已取消
}

const ORDER_STATUS_TEXT = {
  [ORDER_STATUS.PENDING]: '待支付',
  [ORDER_STATUS.COMPLETED]: '已完成',
  [ORDER_STATUS.CANCELLED]: '已取消'
}

/**
 * 订单状态 → 业务文案（两端共用）。
 * tag 颜色映射属 UI 库差异（Vant 用 default、Element Plus 用 info），保留在各端。
 */
export function getOrderStatusText(status) {
  return ORDER_STATUS_TEXT[status] ?? '未知'
}
