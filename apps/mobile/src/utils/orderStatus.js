// 订单状态映射统一收口（原在 OrderList.vue 与 OrderDetail.vue 重复定义）
const TEXT_MAP = { 0: '待支付', 1: '已完成', 2: '已取消' }
// 对应 van-tag 的 type（default/primary/success/warning/danger）
const TYPE_MAP = { 0: 'warning', 1: 'success', 2: 'default' }

export function getStatusText(status) {
  return TEXT_MAP[status] ?? '未知'
}

export function getStatusType(status) {
  return TYPE_MAP[status] ?? 'default'
}
