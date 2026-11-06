import { describe, it, expect } from 'vitest'
import { mergeCartItems, calcCentsTotal } from './cart.js'

describe('mergeCartItems', () => {
  it('同 productId 累加数量', () => {
    const out = mergeCartItems([{ productId: 1, quantity: 2 }], [{ productId: 1, quantity: 3 }])
    expect(out).toEqual([{ productId: 1, quantity: 5 }])
  })
  it('不同 productId：用户项在前，游客新项追加其后（对齐 H5）', () => {
    const out = mergeCartItems([{ productId: 9, quantity: 1 }], [{ productId: 1, quantity: 2 }])
    expect(out.map((i) => i.productId)).toEqual([1, 9])
  })
  it('不修改入参数组', () => {
    const guest = [{ productId: 1, quantity: 1 }]
    const user = [{ productId: 1, quantity: 1 }]
    mergeCartItems(guest, user)
    expect(user[0].quantity).toBe(1)
    expect(guest[0].quantity).toBe(1)
  })
  it('空用户项时全量落游客项', () => {
    expect(mergeCartItems([{ productId: 2, quantity: 4 }], [])).toEqual([
      { productId: 2, quantity: 4 }
    ])
  })
})

describe('calcCentsTotal', () => {
  it('避免浮点漂移（0.1 + 0.2 === 0.3）', () => {
    expect(calcCentsTotal([{ price: 0.1, quantity: 1 }, { price: 0.2, quantity: 1 }])).toBe(0.3)
  })
  it('price 缺省按 0', () => {
    expect(calcCentsTotal([{ quantity: 3 }])).toBe(0)
  })
  it('数量参与计算', () => {
    expect(calcCentsTotal([{ price: 9.9, quantity: 2 }])).toBe(19.8)
  })
})
