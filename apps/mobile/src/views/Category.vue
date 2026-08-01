<template>
  <div class="category-page">
    <h3 class="page-main-title">商品分类</h3>

    <div class="category-tabs">
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        class="category-tab-btn"
        :class="{ active: currentCategoryId === category.id }"
        @click="selectCategory(category.id)"
      >
        {{ category.name }}
      </button>
    </div>

    <!-- 分类或商品加载失败均可重试 -->
    <button v-if="loadError" type="button" class="error-retry" @click="init">
      <van-empty image="error" description="加载失败，点击重试" />
    </button>

    <template v-else>
      <van-list
        v-model:loading="loading"
        v-model:error="listError"
        :finished="finished"
        :finished-text="products.length ? '没有更多了' : ''"
        error-text="加载失败，点击重试"
        @load="onLoad"
      >
        <van-skeleton v-if="initialLoading" :row="6" />
        <div v-else class="product-list">
          <ProductCard
            v-for="product in products"
            :key="product.id"
            :product="product"
            mode="list"
            class="product-item"
          />
        </div>
      </van-list>
      <van-empty
        v-if="!initialLoading && !loading && products.length === 0"
        description="暂无商品"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getProductList, getCategoryList } from '@/api/product'
import ProductCard from '@/components/ProductCard.vue'
import { usePagedList } from '@/composables/usePagedList'

const categories = ref([])
const currentCategoryId = ref(null)

// 分页加载逻辑已收口至 usePagedList；guard：分类未就绪时不触发加载，保持骨架屏
const {
  items: products,
  loading,
  finished,
  listError,
  initialLoading,
  loadError,
  onLoad,
  resetAndReload
} = usePagedList({
  fetcher: (pageNum, pageSize) =>
    getProductList({ categoryId: currentCategoryId.value, pageNum, pageSize, status: 1 }),
  guard: () => !!currentCategoryId.value
})

onMounted(() => {
  init()
})

async function init() {
  loadError.value = false
  initialLoading.value = true
  try {
    const res = await getCategoryList()
    categories.value = res.data || []
    if (categories.value.length > 0) {
      currentCategoryId.value = categories.value[0].id
      resetAndReload()
      return
    }
  } catch (e) {
    loadError.value = true // 分类接口失败给出统一错误态
  }
  initialLoading.value = false
}

function selectCategory(id) {
  if (currentCategoryId.value === id) return
  currentCategoryId.value = id
  resetAndReload()
}
</script>

<style lang="scss" scoped>
.category-page {
  padding: 16px;

  h3 {
    margin-bottom: 16px;
    color: var(--color-text);
  }
}

.category-tabs {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  margin-bottom: 20px;
}

.product-item {
  margin-bottom: 12px;
}
</style>
