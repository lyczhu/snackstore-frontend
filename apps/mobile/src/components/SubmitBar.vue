<template>
  <div class="submit-bar" :class="{ 'above-tabbar': aboveTabbar }">
    <slot />
  </div>
</template>

<script setup>
// 统一 fixed 底部操作栏（原在 Cart/OrderConfirm/ProductDetail/OrderDetail 重复实现）
defineProps({
  // 购物车页需悬浮在 tabbar 正上方
  aboveTabbar: { type: Boolean, default: false }
})
</script>

<style lang="scss" scoped>
.submit-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  margin: 0 auto;
  width: 100%;
  max-width: 480px; /* 随全局容器限宽 */
  /* iOS 底部安全区，避免 Home 指示条遮挡按钮 */
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: var(--shadow-bar);
  z-index: 10;
}

.above-tabbar {
  /* 贴紧 50px 高 tabbar，不再留 10px 缝隙 */
  bottom: calc(50px + env(safe-area-inset-bottom));
  padding-bottom: 12px;
}
</style>
