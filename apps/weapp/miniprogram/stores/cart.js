import { createStore } from '../utils/store.js'
import { mergeCartItems, calcCentsTotal } from '@snackstore/shared/cart'
import { safeParse } from '@snackstore/shared/storage'
import { userStore, registerCartHooks } from './user.js'

// 购物车按账号隔离存储；游客用 guest 命名空间（键语义对齐 H5 cartItems_{id|guest}）
export const cartStore = createStore({ items: [], buyNowItem: null })

function currentUserId() {
  const u = userStore.getSnapshot().userInfo
  return u ? u.id : 'guest'
}
function storageKey(id) {
  return 'cartItems_' + (id !== undefined ? id : currentUserId())
}

export function loadFromStorage() {
  cartStore.patch({ items: safeParse(wx.getStorageSync(storageKey()), []) })
}

function save() {
  wx.setStorageSync(storageKey(), JSON.stringify(cartStore.getSnapshot().items))
  syncTabBadge()
}

export function getItems() {
  return cartStore.getSnapshot().items
}
export function getTotalCount() {
  return getItems().reduce((s, i) => s + i.quantity, 0)
}
// 金额走 shared 分单位纯函数，与 H5 同一份防浮点漂移实现
export function getTotalPrice() {
  return calcCentsTotal(getItems())
}

export function addItem(product) {
  const items = getItems().slice()
  const ex = items.find((i) => i.productId === product.id)
  if (ex) {
    ex.quantity += 1
  } else {
    items.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      coverImage: product.coverImage,
      quantity: 1
    })
  }
  cartStore.patch({ items })
  save()
}

export function updateQuantity(productId, quantity) {
  const items = getItems().slice()
  const it = items.find((i) => i.productId === productId)
  if (it) it.quantity = Math.max(1, quantity)
  cartStore.patch({ items })
  save()
}

export function removeItem(productId) {
  cartStore.patch({ items: getItems().filter((i) => i.productId !== productId) })
  save()
}

export function clearCart() {
  cartStore.patch({ items: [] })
  save()
}

// 「立即购买」直购快照，仅存在于内存，不进入购物车、不持久化（对齐 H5）
export function setBuyNowItem(product, quantity = 1) {
  cartStore.patch({
    buyNowItem: {
      productId: product.id,
      name: product.name,
      price: product.price,
      coverImage: product.coverImage,
      quantity
    }
  })
}
export function clearBuyNowItem() {
  cartStore.patch({ buyNowItem: null })
}

// 游客 -> 登录：合并 guest 到用户键，落用户键，删 guest（算法在 shared）
export function onLoggedIn(newId) {
  if (!newId) return
  const guest = safeParse(wx.getStorageSync('cartItems_guest'), [])
  const user = safeParse(wx.getStorageSync('cartItems_' + newId), [])
  const merged = mergeCartItems(guest, user)
  cartStore.patch({ items: merged })
  wx.removeStorageSync('cartItems_guest')
  wx.setStorageSync('cartItems_' + newId, JSON.stringify(merged))
  syncTabBadge()
}
// 退出：切回 guest 购物车（用户键数据保留，重登恢复）
export function onLoggedOut() {
  loadFromStorage()
  syncTabBadge()
}

// tab 角标：购物车数量 -> 原生 tabBar 徽标（非 tab 环境调用会 fail，静默兜底）
export function syncTabBadge() {
  const n = getTotalCount()
  try {
    if (n > 0) wx.setTabBarBadge({ index: 2, text: String(n) })
    else wx.removeTabBarBadge({ index: 2 })
  } catch {
    /* 非 tab 页调用，忽略 */
  }
}

registerCartHooks({ onLoggedIn, onLoggedOut })
