import { describe, it, expect, vi } from 'vitest'
import { createPaymentProvider, parseServerTime, PAYMENT_WINDOW_MS } from './payment.js'

const ORDER = {
  id: 7,
  orderNo: 'SO202611160001',
  totalAmount: 39.9,
  createdAt: '2026-11-16 10:00:00'
}

describe('parseServerTime', () => {
  it('解析后端 "YYYY-MM-DD HH:mm:ss" 形式', () => {
    const t = parseServerTime('2026-11-16 10:30:00')
    expect(Number.isNaN(t)).toBe(false)
    const d = new Date(t)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(10)
    expect(d.getDate()).toBe(16)
    expect(d.getHours()).toBe(10)
    expect(d.getMinutes()).toBe(30)
  })

  it('空格分隔与 T 分隔得到同一时刻（iOS / 小程序 JS 内核不接受空格写法）', () => {
    expect(parseServerTime('2026-11-16T10:30:00')).toBe(parseServerTime('2026-11-16 10:30:00'))
  })

  it('空值与非法值返回 NaN', () => {
    expect(Number.isNaN(parseServerTime(''))).toBe(true)
    expect(Number.isNaN(parseServerTime(null))).toBe(true)
    expect(Number.isNaN(parseServerTime(undefined))).toBe(true)
    expect(Number.isNaN(parseServerTime('not-a-date'))).toBe(true)
  })
})

describe('createPaymentProvider', () => {
  it('缺省返回 local provider', () => {
    expect(createPaymentProvider().name).toBe('local')
  })

  it('未实现的模式直接抛错，避免静默降级成演示支付', () => {
    expect(() => createPaymentProvider({ mode: 'wechat' })).toThrow(/尚未实现/)
  })
})

describe('local provider 创建支付单', () => {
  const provider = createPaymentProvider({ mode: 'local', now: () => 0 })

  it('支付单号带 LOCAL 前缀并关联订单号，金额取自订单', () => {
    const intent = provider.createIntent(ORDER)
    expect(intent.paymentNo).toBe('LOCAL-SO202611160001')
    expect(intent.orderId).toBe(7)
    expect(intent.amount).toBe(39.9)
    expect(intent.tradeState).toBe('NOTPAY')
  })

  it('截止时间 = 下单时间 + 支付窗口', () => {
    const intent = provider.createIntent(ORDER)
    expect(intent.expireAt - parseServerTime(ORDER.createdAt)).toBe(PAYMENT_WINDOW_MS)
  })

  it('下单时间不可解析时 expireAt 为 null，由页面隐藏倒计时', () => {
    const intent = provider.createIntent({ ...ORDER, createdAt: '' })
    expect(intent.expireAt).toBeNull()
  })
})

describe('local provider 支付', () => {
  it('调用注入的 payOrder 并返回成功状态与支付时间', async () => {
    const payOrder = vi.fn().mockResolvedValue({ code: 200 })
    const provider = createPaymentProvider({
      mode: 'local',
      payOrder,
      delayMs: 0,
      now: () => 1700000000000
    })

    const result = await provider.pay(provider.createIntent(ORDER))

    expect(payOrder).toHaveBeenCalledWith(7)
    expect(result).toEqual({ tradeState: 'SUCCESS', paidAt: 1700000000000 })
  })

  it('payOrder 失败时向上抛出，不吞掉异常', async () => {
    const payOrder = vi.fn().mockRejectedValue(new Error('ORDER_STATUS_ERROR'))
    const provider = createPaymentProvider({ mode: 'local', payOrder, delayMs: 0 })

    await expect(provider.pay(provider.createIntent(ORDER))).rejects.toThrow('ORDER_STATUS_ERROR')
  })
})
