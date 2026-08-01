<template>
  <!-- 商品卡本质是链接，用 router-link 包裹，获得键盘/右键新标签能力 -->
  <router-link :to="`/product/${product.id}`" class="product-card" :class="`mode-${mode}`">
    <van-image
      class="card-image"
      :src="product.coverImage"
      :alt="product.name"
      fit="cover"
      lazy-load
    />
    <div class="card-info">
      <p class="name">{{ product.name }}</p>
      <p v-if="mode === 'list' && product.description" class="desc">{{ product.description }}</p>
      <p class="price">¥{{ product.price }}</p>
    </div>
  </router-link>
</template>

<script setup>
// 商品卡复用组件（原在 Home/Category 两处手写重复）
defineProps({
  product: { type: Object, required: true },
  mode: {
    type: String,
    default: 'grid',
    validator: (v) => ['grid', 'list'].includes(v)
  }
})
</script>

<style lang="scss" scoped>
.product-card {
  display: block;
  background: #fff;
  border-radius: var(--radius-card);
  overflow: hidden;
  transition:
    transform 0.2s,
    box-shadow 0.2s;

  /* 移动端按压反馈替代 hover 浮起 */
  &:active {
    transform: scale(0.97);
  }
}

.mode-grid {
  .card-image {
    width: 100%;
    height: 160px;
  }

  .card-info {
    padding: 8px 12px;
  }
}

.mode-list {
  display: flex;

  .card-image {
    width: 120px;
    height: 120px;
    flex-shrink: 0;
  }

  .card-info {
    flex: 1;
    padding: 12px;
    min-width: 0;
  }

  .desc {
    font-size: 12px;
    color: var(--color-text-placeholder);
    margin: 4px 0 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .price {
    font-size: 18px;
  }
}

.name {
  font-size: 14px;
  color: var(--color-text);
  /* 商品名两行截断，提升信息展示量 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.price {
  font-size: 16px;
  color: var(--color-primary);
  font-weight: bold;
  margin-top: 4px;
}
</style>
