/**
 * 支付抽象层：隔离「怎么支付」与「支付结果从哪来」。
 *
 * 字段语义对齐微信支付 APIv3（paymentNo ↔ out_trade_no、tradeState ↔ trade_state），
 * 将来接入真实支付时只需新增一个 provider 实现，收银台页面代码不用改。
 */

// 与后端 t_payment.expire_at 约定一致：下单后 15 分钟
export const PAYMENT_WINDOW_MS = 15 * 60 * 1000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 解析后端返回的时间字符串（`YYYY-MM-DD HH:mm:ss`）。
 *
 * iOS Safari 与小程序 JS 内核不接受空格分隔的写法，直接 `new Date('2026-11-16 10:00:00')`
 * 得到 Invalid Date，必须先归一成 `T` 分隔。
 * 无法解析时返回 NaN，由调用方决定降级策略。
 */
export function parseServerTime(value) {
  if (!value || typeof value !== 'string') return NaN
  return new Date(value.trim().replace(' ', 'T')).getTime()
}

/**
 * 本地演示 Provider：不依赖任何支付后端。
 *
 * 支付动作最终落到现有的 `PATCH /orders/{id}/status`，因此与真实支付的差别只在于
 * 「支付结果从哪里来」——这正是将来替换成 demo / wechat provider 时唯一需要改的地方。
 *
 * @param {Object} options
 * @param {(orderId: number) => Promise<unknown>} options.payOrder 实际的支付接口（由各端注入）
 * @param {() => number} [options.now] 时间源，便于测试
 * @param {number} [options.delayMs] 模拟支付耗时，测试传 0
 */
export function createLocalProvider({ payOrder, now = Date.now, delayMs = 1200 } = {}) {
  return {
    name: 'local',

    createIntent(order) {
      const createdAt = parseServerTime(order.createdAt)
      return {
        orderId: order.id,
        orderNo: order.orderNo,
        paymentNo: `LOCAL-${order.orderNo}`,
        amount: order.totalAmount,
        expireAt: Number.isNaN(createdAt) ? null : createdAt + PAYMENT_WINDOW_MS,
        tradeState: 'NOTPAY'
      }
    },

    async pay(intent) {
      if (!payOrder) throw new Error('local provider 缺少 payOrder 实现')
      if (delayMs > 0) await sleep(delayMs)
      await payOrder(intent.orderId)
      return { tradeState: 'SUCCESS', paidAt: now() }
    }
  }
}

/**
 * 支付 Provider 工厂——支付模式的唯一切换点。
 *
 * 新增模式（demo 走后端 DemoProvider、wechat 走真实 APIv3）时在此登记实现，
 * 收银台页面代码不需要改动。
 */
export function createPaymentProvider(options = {}) {
  const { mode = 'local', ...rest } = options
  if (mode === 'local') return createLocalProvider(rest)
  throw new Error(`支付模式 ${mode} 尚未实现（需后端支付端点就绪）`)
}
