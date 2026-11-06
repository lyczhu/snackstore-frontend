import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from '../../test/wx-mock.js'
import { userStore } from './user.js'
import {
  cartStore,
  loadFromStorage,
  addItem,
  updateQuantity,
  removeItem,
  getTotalCount,
  getTotalPrice,
  onLoggedIn,
  setBuyNowItem,
  clearBuyNowItem
} from './cart.js'

beforeEach(() => {
  resetStorage()
  userStore.patch({ token: '', userInfo: null })
  cartStore.patch({ items: [], buyNowItem: null })
})

describe('cart store', () => {
  it('addItem 累加同商品数量', () => {
    addItem({ id: 1, name: 'A', price: 2, coverImage: 'x' })
    addItem({ id: 1, name: 'A', price: 2, coverImage: 'x' })
    expect(getTotalCount()).toBe(2)
  })

  it('金额分单位累加防漂移（0.1+0.2=0.3）', () => {
    addItem({ id: 1, price: 0.1, name: 'a' })
    addItem({ id: 2, price: 0.2, name: 'b' })
    expect(getTotalPrice()).toBe(0.3)
  })

  it('updateQuantity 下限 1', () => {
    addItem({ id: 1, price: 1, name: 'a' })
    updateQuantity(1, 0)
    expect(cartStore.getSnapshot().items[0].quantity).toBe(1)
  })

  it('removeItem 过滤', () => {
    addItem({ id: 1, price: 1, name: 'a' })
    removeItem(1)
    expect(cartStore.getSnapshot().items.length).toBe(0)
  })

  it('onLoggedIn 合并 guest 到用户键并删 guest', () => {
    wx.setStorageSync('cartItems_guest', JSON.stringify([{ productId: 1, quantity: 2 }]))
    wx.setStorageSync('cartItems_9', JSON.stringify([{ productId: 1, quantity: 3 }]))
    onLoggedIn(9)
    expect(cartStore.getSnapshot().items[0].quantity).toBe(5)
    expect(wx.getStorageSync('cartItems_guest')).toBe('')
  })

  it('持久化到当前账号键，loadFromStorage 可读回', () => {
    addItem({ id: 1, price: 1, name: 'a' })
    loadFromStorage()
    expect(JSON.parse(wx.getStorageSync('cartItems_guest')).length).toBe(1)
  })

  it('buyNowItem 仅内存不持久化', () => {
    setBuyNowItem({ id: 7, name: 'x', price: 3, coverImage: 'c' }, 2)
    expect(cartStore.getSnapshot().buyNowItem).toEqual({
      productId: 7,
      name: 'x',
      price: 3,
      coverImage: 'c',
      quantity: 2
    })
    clearBuyNowItem()
    expect(cartStore.getSnapshot().buyNowItem).toBeNull()
  })
})
