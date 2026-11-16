import { describe, it, expect } from 'vitest'
import { parseCents, reconcileOrderAmount } from './orderAmount.js'

describe('parseCents', () => {
  it('数字与字符串都换算成整数分', () => {
    expect(parseCents(18)).toBe(1800)
    expect(parseCents('18.00')).toBe(1800)
    expect(parseCents(0)).toBe(0)
  })

  it('缺失或无法解析的金额返回 null，不能当成 0', () => {
    expect(parseCents(null)).toBeNull()
    expect(parseCents(undefined)).toBeNull()
    expect(parseCents('')).toBeNull()
    expect(parseCents('abc')).toBeNull()
    expect(parseCents(NaN)).toBeNull()
  })
})

describe('reconcileOrderAmount', () => {
  it('本地与服务端一致时不提示', () => {
    expect(reconcileOrderAmount(18, '18.00').mismatch).toBe(false)
    expect(reconcileOrderAmount('18.00', 18).mismatch).toBe(false)
  })

  it('浮点误差不会误报', () => {
    // 0.1 + 0.2 === 0.30000000000000004
    expect(reconcileOrderAmount(0.1 + 0.2, '0.30').mismatch).toBe(false)
  })

  it('服务端金额更高：判定不一致并给出实际应付分值', () => {
    expect(reconcileOrderAmount(18, '28.00')).toEqual({
      localCents: 1800,
      serverCents: 2800,
      mismatch: true
    })
  })

  it('服务端金额更低：同样判定不一致（降价也要如实告知）', () => {
    expect(reconcileOrderAmount('18.00', 12.5)).toEqual({
      localCents: 1800,
      serverCents: 1250,
      mismatch: true
    })
  })

  it('服务端未返回金额时不误报，serverCents 为 null', () => {
    expect(reconcileOrderAmount(18, undefined)).toEqual({
      localCents: 1800,
      serverCents: null,
      mismatch: false
    })
  })
})
