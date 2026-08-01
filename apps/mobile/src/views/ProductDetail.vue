<template>
  <div class="product-detail-page">
    <PageNavBar title="商品详情" />

    <van-skeleton v-if="loading" title :row="8" class="detail-skeleton" />

    <!-- 详情加载失败显示错误占位 + 重试/返回，不再静默空白 -->
    <van-empty v-else-if="loadError" image="error" description="商品加载失败">
      <van-button round type="primary" size="small" class="retry-btn" @click="loadProduct"
        >重试</van-button
      >
      <van-button round size="small" @click="goBack">返回</van-button>
    </van-empty>

    <template v-else-if="product">
      <div class="image-section">
        <van-image :src="product.coverImage" :alt="product.name" fit="cover" class="main-image" />
      </div>
      <div class="info-section">
        <p class="price">¥{{ product.price }}</p>
        <h2 class="name">{{ product.name }}</h2>
        <p v-if="product.categoryName" class="category">分类: {{ product.categoryName }}</p>
        <p class="stock">库存: {{ product.stock }}</p>
        <p class="description">{{ product.description }}</p>
      </div>
      <!-- 富文本经 DOMPurify 白名单净化后再渲染，防存储型 XSS -->
      <!-- eslint-disable-next-line vue/no-v-html -- 内容已由 sanitizeHtml(DOMPurify) 净化 -->
      <div v-if="sanitizedDetail" class="detail-section" v-html="sanitizedDetail"></div>

      <SubmitBar>
        <div class="action-buttons">
          <!-- 加入购物车=描边次要按钮，立即购买=品牌橙主按钮，取消绿色 -->
          <van-button
            plain
            type="primary"
            size="large"
            :disabled="product.status === 0"
            @click="addToCart"
          >
            加入购物车
          </van-button>
          <van-button type="primary" size="large" :disabled="product.status === 0" @click="buyNow">
            {{ product.status === 0 ? '已下架' : '立即购买' }}
          </van-button>
        </div>
      </SubmitBar>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import { getProductDetail } from '@/api/product'
import { useCartStore } from '@/stores/cart'
import { useUserStore } from '@/stores/user'
import { sanitizeHtml } from '@/utils/sanitize'
import PageNavBar from '@/components/PageNavBar.vue'
import SubmitBar from '@/components/SubmitBar.vue'

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()
const userStore = useUserStore()
const product = ref(null)
const loading = ref(true)
const loadError = ref(false)

// v-html 输出前统一净化
const sanitizedDetail = computed(() => sanitizeHtml(product.value?.detail || ''))

onMounted(() => {
  loadProduct()
})

async function loadProduct() {
  loading.value = true
  loadError.value = false
  try {
    const res = await getProductDetail(route.params.id)
    product.value = res.data
  } catch (e) {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (window.history.state?.back) router.back()
  else router.replace('/')
}

function addToCart() {
  cartStore.addItem(product.value)
  showSuccessToast('已加入购物车')
}

function buyNow() {
  if (!userStore.isLoggedIn) {
    showToast('请先登录')
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  // 直购商品写入独立快照并带标记跳转，确认订单页只结算该商品，不再牵连整个购物车
  cartStore.setBuyNowItem(product.value, 1)
  router.push({ path: '/order/confirm', query: { from: 'buyNow' } })
}
</script>

<style lang="scss" scoped>
.product-detail-page {
  /* 为 fixed 底部操作栏预留空间 */
  padding-bottom: calc(90px + env(safe-area-inset-bottom));
}

.detail-skeleton {
  padding: 24px 16px;
  background: #fff;
}

.retry-btn {
  margin-right: 12px;
}

.image-section {
  .main-image {
    width: 100%;
    height: 360px;
  }
}

.info-section {
  padding: 16px;
  background: #fff;

  .price {
    font-size: 24px;
    color: var(--color-primary);
    font-weight: bold;
    margin-bottom: 8px;
  }

  .name {
    font-size: 18px;
    color: var(--color-text);
    margin-bottom: 8px;
  }

  .category,
  .stock {
    font-size: 13px;
    color: var(--color-text-placeholder);
    margin-bottom: 4px;
  }

  .description {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin-top: 8px;
  }
}

.detail-section {
  padding: 16px;
  background: #fff;
  margin-top: 12px;

  /* 富文本图片防溢出 */
  :deep(img) {
    max-width: 100%;
    height: auto;
  }
}

.action-buttons {
  display: flex;
  gap: 12px;

  .van-button {
    flex: 1;
  }
}
</style>
