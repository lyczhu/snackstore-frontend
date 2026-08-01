<template>
  <!-- aria-live 向读屏用户播报页面状态 -->
  <div class="not-found" role="alert" aria-live="polite">
    <h1>404</h1>
    <p>页面不存在</p>
    <van-button type="primary" round @click="router.push('/')">返回首页</van-button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<style lang="scss" scoped>
.not-found {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-placeholder);

  h1 {
    font-size: 72px;
    margin-bottom: 8px;
    color: #ddd;
  }

  p {
    font-size: 16px;
    margin-bottom: 24px;
  }
}
</style>
