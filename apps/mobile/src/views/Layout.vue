<template>
  <div class="layout">
    <div class="main-content">
      <router-view />
    </div>
    <van-tabbar v-model="activeTab" route>
      <van-tabbar-item to="/home" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/category" icon="apps-o">分类</van-tabbar-item>
      <van-tabbar-item to="/cart" icon="shopping-cart-o" :badge="cartStore.totalCount || ''"
        >购物车</van-tabbar-item
      >
      <van-tabbar-item to="/mine" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useCartStore } from '@/stores/cart'

const cartStore = useCartStore()
const activeTab = ref(0)
</script>

<style lang="scss" scoped>
.layout {
  min-height: 100vh;
  min-height: 100dvh; /* iOS Safari 地址栏适配 */
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  /* 为 50px tabbar + iOS 底部安全区预留空间 */
  padding-bottom: calc(66px + env(safe-area-inset-bottom));
}
</style>
