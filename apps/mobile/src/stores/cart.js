import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useUserStore } from './user'
import { safeParse } from '@/utils/storage'
import { mergeCartItems, calcCentsTotal } from '@snackstore/shared'

export const useCartStore = defineStore('cart', () => {
  const userStore = useUserStore()

  // 购物车按账号隔离存储，多账号共用设备不再串号；游客使用 guest 命名空间
  function storageKey() {
    return `cartItems_${userStore.userInfo?.id ?? 'guest'}`
  }

  function loadFromStorage() {
    items.value = safeParse(localStorage.getItem(storageKey()), [])
  }

  const items = ref([])
  loadFromStorage()

  // 「立即购买」直购快照，仅存在于内存，不进入购物车、不持久化
  const buyNowItem = ref(null)

  // 登录/退出时切换购物车归属
  watch(
    () => userStore.userInfo?.id,
    (newId, oldId) => {
      if (newId && !oldId) {
        // 游客 → 登录：把游客购物车合并进该账号购物车，避免加购成果丢失
        // 合并算法收口到 @snackstore/shared，与小程序共用一份（消除双端漂移）
        const guestItems = safeParse(localStorage.getItem('cartItems_guest'), [])
        const userItems = safeParse(localStorage.getItem(`cartItems_${newId}`), [])
        items.value = mergeCartItems(guestItems, userItems)
        localStorage.removeItem('cartItems_guest')
        saveToStorage()
      } else if (!newId && oldId) {
        // 退出登录：切换到游客购物车；原账号数据保留在本地，重新登录后恢复
        loadFromStorage()
      }
    }
  )

  const totalCount = computed(() => {
    return items.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  // 金额累加改用 @snackstore/shared 的分单位纯函数，与小程序共用一份防浮点漂移实现
  const totalPrice = computed(() => calcCentsTotal(items.value))

  function addItem(product) {
    const existing = items.value.find((item) => item.productId === product.id)
    if (existing) {
      existing.quantity += 1
    } else {
      items.value.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        coverImage: product.coverImage,
        quantity: 1
      })
    }
    saveToStorage()
  }

  function updateQuantity(productId, quantity) {
    const item = items.value.find((item) => item.productId === productId)
    if (item) {
      item.quantity = Math.max(1, quantity)
    }
    saveToStorage()
  }

  function removeItem(productId) {
    items.value = items.value.filter((item) => item.productId !== productId)
    saveToStorage()
  }

  function clearCart() {
    items.value = []
    saveToStorage()
  }

  function setBuyNowItem(product, quantity = 1) {
    buyNowItem.value = {
      productId: product.id,
      name: product.name,
      price: product.price,
      coverImage: product.coverImage,
      quantity
    }
  }

  function clearBuyNowItem() {
    buyNowItem.value = null
  }

  function saveToStorage() {
    localStorage.setItem(storageKey(), JSON.stringify(items.value))
  }

  return {
    items,
    totalCount,
    totalPrice,
    buyNowItem,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    setBuyNowItem,
    clearBuyNowItem
  }
})
