/**
 * 下单金额对账（M1′-6，H5 与小程序共用）。
 *
 * 前端展示的是本地快照金额（购物车 / 直购），服务端按库中当前价格重算并写入订单。
 * 商品调价、快照过期都会让两者不一致，此时以服务端为准，如实告知用户实际应付金额。
 */

/**
 * 金额换算为整数分。
 * 后端 BigDecimal 序列化可能是数字也可能是字符串（'18.00'），两种都要吃。
 * 无法解析时返回 null —— 调用方据此判定「金额未知」，绝不能当成 0。
 * @param {number|string|null|undefined} value 「元」为单位的金额
 * @returns {number|null}
 */
export function parseCents(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return null
  return Math.round(num * 100)
}

/**
 * 对比本地快照金额与服务端下单返回的 totalAmount。
 * 全程按整数分比较，避免 0.1 + 0.2 这类浮点误差触发误报。
 * @param {number|string} localTotal 本地快照金额（元）
 * @param {number|string} serverTotal 服务端 OrderVO.totalAmount
 * @returns {{ localCents: number|null, serverCents: number|null, mismatch: boolean }}
 *   serverCents 为 null 表示服务端未返回可解析金额，此时 mismatch 恒为 false（不误报）。
 */
export function reconcileOrderAmount(localTotal, serverTotal) {
  const localCents = parseCents(localTotal)
  const serverCents = parseCents(serverTotal)
  const mismatch = localCents !== null && serverCents !== null && localCents !== serverCents
  return { localCents, serverCents, mismatch }
}
