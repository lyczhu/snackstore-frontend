<template>
  <van-nav-bar :title="title" left-arrow fixed placeholder safe-area-inset-top @click-left="onBack">
    <template v-if="$slots.right" #right>
      <slot name="right" />
    </template>
  </van-nav-bar>
</template>

<script setup>
import { useRouter } from 'vue-router'

// 二级页面统一顶部导航（返回箭头 + 标题），解决"困死"问题
defineProps({
  title: { type: String, required: true }
})

const router = useRouter()

// 无浏览历史（直接打开链接）时回退到首页兜底
function onBack() {
  if (window.history.state?.back) {
    router.back()
  } else {
    router.replace('/')
  }
}
</script>
