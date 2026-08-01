import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore } from './cart'
import { useUserStore } from './user'

const productA = { id: 1, name: '薯片', price: 5.5, coverImage: 'a.png' }
const productB = { id: 2, name: '可乐', price: 3, coverImage: 'b.png' }

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('cart store - 基本操作', () => {
  it('addItem 新商品入购物车并持久化', () => {
    const cart = useCartStore()
    cart.addItem(productA)
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]).toMatchObject({ productId: 1, name: '薯片', price: 5.5, quantity: 1 })
    // 游客命名空间持久化
    expect(JSON.parse(localStorage.getItem('cartItems_guest'))).toHaveLength(1)
  })

  it('addItem 重复商品数量累加', () => {
    const cart = useCartStore()
    cart.addItem(productA)
    cart.addItem(productA)
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].quantity).toBe(2)
  })

  it('updateQuantity 最小为 1', () => {
    const cart = useCartStore()
    cart.addItem(productA)
    cart.updateQuantity(1, 5)
    expect(cart.items[0].quantity).toBe(5)
    cart.updateQuantity(1, 0)
    expect(cart.items[0].quantity).toBe(1)
  })

  it('removeItem / clearCart', () => {
    const cart = useCartStore()
    cart.addItem(productA)
    cart.addItem(productB)
    cart.removeItem(1)
    expect(cart.items.map((i) => i.productId)).toEqual([2])
    cart.clearCart()
    expect(cart.items).toHaveLength(0)
    expect(cart.totalCount).toBe(0)
  })

  it('totalCount / totalPrice 计算正确', () => {
    const cart = useCartStore()
    cart.addItem(productA) // 5.5
    cart.addItem(productA) // 5.5
    cart.addItem(productB) // 3
    expect(cart.totalCount).toBe(3)
    expect(cart.totalPrice).toBe(14)
  })

  it('buyNowItem 仅内存、不持久化', () => {
    const cart = useCartStore()
    cart.setBuyNowItem(productA, 2)
    expect(cart.buyNowItem).toMatchObject({ productId: 1, quantity: 2 })
    expect(localStorage.getItem('cartItems_guest')).toBeNull()
    cart.clearBuyNowItem()
    expect(cart.buyNowItem).toBeNull()
  })
})

describe('cart store - 账号隔离与游客合并', () => {
  // watch 回调在 nextTick 才执行，登录态变更后需等待
  it('登录后购物车切换到账号命名空间', async () => {
    const cart = useCartStore()
    cart.addItem(productA) // 游客加购 1 件

    const user = useUserStore()
    user.setLogin({ token: 't', user: { id: 42, nickname: 'u' } })
    await nextTick()

    // 游客购物车合并进账号购物车，并使用 cartItems_42 持久化
    expect(localStorage.getItem('cartItems_42')).not.toBeNull()
    expect(JSON.parse(localStorage.getItem('cartItems_42'))).toHaveLength(1)
    // 游客数据已清除
    expect(localStorage.getItem('cartItems_guest')).toBeNull()
  })

  it('游客商品与账号已有商品按 productId 合并数量', async () => {
    // 预置账号 42 的购物车：商品 1 已有 2 件
    localStorage.setItem(
      'cartItems_42',
      JSON.stringify([{ productId: 1, name: '薯片', price: 5.5, quantity: 2 }])
    )
    const cart = useCartStore()
    cart.addItem(productA) // 游客加购商品 1 ×1
    cart.addItem(productB) // 游客加购商品 2 ×1

    const user = useUserStore()
    user.setLogin({ token: 't', user: { id: 42 } })
    await nextTick()

    const merged = JSON.parse(localStorage.getItem('cartItems_42'))
    expect(merged).toHaveLength(2)
    expect(merged.find((i) => i.productId === 1).quantity).toBe(3) // 2 + 1 合并
    expect(merged.find((i) => i.productId === 2).quantity).toBe(1)
  })

  it('退出登录回到游客购物车，账号数据保留', async () => {
    const cart = useCartStore()
    const user = useUserStore()
    user.setLogin({ token: 't', user: { id: 42 } })
    await nextTick() // 等待登录合并 watcher 完成（真实场景登录与退出不会同 tick 发生）
    cart.addItem(productA)
    expect(localStorage.getItem('cartItems_42')).not.toBeNull()

    user.logout()
    await nextTick()
    // 当前购物车切回游客（空），账号数据仍在
    expect(cart.items).toHaveLength(0)
    expect(localStorage.getItem('cartItems_42')).not.toBeNull()
  })
})

describe('user store', () => {
  it('setLogin 持久化 token 与 userInfo，logout 清除', () => {
    const user = useUserStore()
    user.setLogin({ token: 'tok', user: { id: 1, nickname: 'n' } })
    expect(user.isLoggedIn).toBe(true)
    expect(localStorage.getItem('token')).toBe('tok')

    user.logout()
    expect(user.isLoggedIn).toBe(false)
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('userInfo')).toBeNull()
  })

  it('userInfo 缓存损坏时视为未登录而不是崩溃', () => {
    localStorage.setItem('userInfo', '{broken json')
    const user = useUserStore()
    expect(user.userInfo).toBeNull()
  })
})
