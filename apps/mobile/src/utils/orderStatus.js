// 状态文案已收口到 @snackstore/shared（后端契约，两端共用），
// 这里 re-export 以兼容既有 @/utils/orderStatus 调用方
export { getOrderStatusText as getStatusText } from '@snackstore/shared'

// 对应 van-tag 的 type（default/primary/success/warning/danger），
// 与 Element Plus 的类型词汇不同（如中性色 Vant 为 default、EP 为 info），故保留在本端
const TYPE_MAP = { 0: 'warning', 1: 'success', 2: 'default' }

export function getStatusType(status) {
  return TYPE_MAP[status] ?? 'default'
}
