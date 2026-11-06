import { getOrderStatusText } from '@snackstore/shared'

// 状态文案走 shared（后端契约，两端共用）
export const getStatusText = getOrderStatusText

// tag 颜色属 UI 库词汇差异，与 H5 Vant 保持一致（见 apps/mobile/src/utils/orderStatus.js）
const TYPE_MAP = { 0: 'warning', 1: 'success', 2: 'default' }

export function getStatusType(status) {
  return TYPE_MAP[status] ?? 'default'
}
