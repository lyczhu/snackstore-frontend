/**
 * 购物车跨端复用逻辑（H5 与小程序共用一份，消除双端漂移）。
 * 纯函数，不依赖任何传输层 / DOM / wx。
 */

/**
 * 合并游客与用户购物车：同 productId 累加数量，其余追加；返回新数组，不改入参。
 * 顺序对齐 H5 现行为：以用户项为基（保持其顺序），游客新项追加其后。
 * @param {Array<{productId: any, quantity: number}>} [guestItems]
 * @param {Array<{productId: any, quantity: number}>} [userItems]
 * @returns {Array<{productId: any, quantity: number}>}
 */
export function mergeCartItems(guestItems = [], userItems = []) {
  const merged = userItems.map((u) => ({ ...u }))
  for (const g of guestItems) {
    const exist = merged.find((u) => u.productId === g.productId)
    if (exist) exist.quantity += g.quantity
    else merged.push({ ...g })
  }
  return merged
}

/**
 * 分单位累加购物车金额，返回「元」为单位的数值。
 * 以「分」为整数单位累加后再除 100，避免浮点乘法漂移（如 0.1 + 0.2 !== 0.3）。
 * @param {Array<{price?: number, quantity: number}>} [items]
 * @returns {number}
 */
export function calcCentsTotal(items = []) {
  const cents = items.reduce(
    (sum, item) => sum + Math.round((item.price ?? 0) * 100) * item.quantity,
    0
  )
  return cents / 100
}
