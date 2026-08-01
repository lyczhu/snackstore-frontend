<template>
  <div class="home-page">
    <h2 class="page-main-title">零食商城</h2>

    <!-- van-search 自带清除按钮；输入 400ms 防抖自动搜索 -->
    <van-search v-model="keyword" placeholder="搜索零食" @search="handleSearch" />

    <!-- 轮播 Banner 运营位（暂取推荐流前 3 个商品，后续可替换为 Banner 接口） -->
    <van-swipe
      v-if="banners.length > 0"
      class="home-banner"
      :autoplay="3500"
      lazy-render
      indicator-color="var(--color-primary)"
    >
      <van-swipe-item v-for="item in banners" :key="item.id">
        <router-link :to="`/product/${item.id}`" class="banner-link">
          <van-image :src="item.coverImage" :alt="item.name" fit="cover" lazy-load />
          <span class="banner-title">{{ item.name }}</span>
        </router-link>
      </van-swipe-item>
    </van-swipe>

    <div class="category-section">
      <h3>商品分类</h3>
      <div class="category-list">
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
    </div>

    <div class="product-section">
      <h3>{{ sectionTitle }}</h3>

      <!-- 加载失败错误态，点击重试，不再静默停留空状态 -->
      <button v-if="loadError" type="button" class="error-retry" @click="resetAndReload">
        <van-empty image="error" description="加载失败，点击重试" />
      </button>

      <template v-else>
        <!-- van-list 上拉分页加载 -->
        <van-list
          v-model:loading="loading"
          v-model:error="listError"
          :finished="finished"
          :finished-text="products.length ? '没有更多了' : ''"
          error-text="加载失败，点击重试"
          @load="onLoad"
        >
          <van-skeleton v-if="initialLoading" :row="6" />
          <div v-else class="product-grid">
            <ProductCard
              v-for="product in products"
              :key="product.id"
              :product="product"
              mode="grid"
            />
          </div>
        </van-list>
        <van-empty
          v-if="!initialLoading && !loading && products.length === 0"
          :description="keyword ? `未找到与“${keyword}”相关的商品` : '暂无商品'"
        />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { getProductList, getCategoryList } from '@/api/product'
import ProductCard from '@/components/ProductCard.vue'
import { usePagedList } from '@/composables/usePagedList'

const keyword = ref('')
const categories = ref([])
const currentCategoryId = ref(null)
const currentCategoryName = ref('')

// 分页加载逻辑已收口至 usePagedList（原与 Category / OrderList 三处同构重复）
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
  fetcher: (pageNum, pageSize) => {
    const params = { pageNum, pageSize, status: 1 }
    if (currentCategoryId.value) params.categoryId = currentCategoryId.value
    if (keyword.value) params.keyword = keyword.value
    return getProductList(params)
  }
})

// 仅默认推荐流展示 Banner，避免搜索/筛选结果被当成运营位
const banners = computed(() => {
  return !keyword.value && !currentCategoryId.value ? products.value.slice(0, 3) : []
})

// 搜索关键词显示在标题处，明确当前浏览上下文
const sectionTitle = computed(() => {
  if (keyword.value) return `搜索“${keyword.value}”`
  return currentCategoryName.value || '推荐商品'
})

onMounted(() => {
  loadCategories()
  // 商品首屏由 van-list immediate-check 自动触发 onLoad
})

async function loadCategories() {
  try {
    const res = await getCategoryList()
    categories.value = res.data || []
  } catch (e) {
    // 分类加载失败不阻塞主流程，降级为无分类栏（接口错误已由拦截器提示）
  }
}

function selectCategory(id) {
  // 再次点击已选分类则取消筛选，回到推荐流
  if (currentCategoryId.value === id) {
    currentCategoryId.value = null
    currentCategoryName.value = ''
  } else {
    currentCategoryId.value = id
    const cat = categories.value.find((c) => c.id === id)
    currentCategoryName.value = cat ? cat.name : ''
  }
  resetAndReload()
}

// 输入防抖自动搜索；清空关键词自动恢复完整列表（即"返回全部"出口）
let searchTimer = null
watch(keyword, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(handleSearch, 400)
})

function handleSearch() {
  clearTimeout(searchTimer)
  currentCategoryId.value = null
  currentCategoryName.value = ''
  resetAndReload()
}
</script>

<style lang="scss" scoped>
.home-page {
  padding: 16px;
}

.page-main-title {
  margin-bottom: 12px;
  color: var(--color-text);
}

.home-banner {
  margin-bottom: 16px;
  border-radius: var(--radius-card);
  overflow: hidden;

  .banner-link {
    display: block;
    position: relative;
    height: 150px;
  }

  .van-image {
    width: 100%;
    height: 100%;
  }

  .banner-title {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 8px 12px;
    font-size: 13px;
    color: #fff;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.55));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.category-section {
  margin: 16px 0;

  h3 {
    margin-bottom: 12px;
    color: var(--color-text);
  }
}

.category-list {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.product-section {
  h3 {
    margin-bottom: 12px;
    color: var(--color-text);
  }
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
</style>
