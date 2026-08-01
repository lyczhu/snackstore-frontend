<template>
  <div class="goods-item">
    <van-image
      class="item-image"
      :src="image"
      :alt="name"
      fit="cover"
      lazy-load
      :width="imageSize"
      :height="imageSize"
      :radius="8"
    />
    <div class="item-info">
      <p class="name">{{ name }}</p>
      <p class="price">¥{{ price }} × {{ quantity }}</p>
    </div>
  </div>
</template>

<script setup>
// 订单商品条目复用组件（原在 OrderConfirm/OrderList/OrderDetail 三处重复）
defineProps({
  image: { type: String, default: '' },
  name: { type: String, required: true },
  price: { type: [Number, String], required: true },
  quantity: { type: Number, required: true },
  imageSize: { type: [Number, String], default: 60 }
})
</script>

<style lang="scss" scoped>
.goods-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
}

.item-image {
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  padding: 0 12px;
  min-width: 0;

  .name {
    font-size: 14px;
    color: var(--color-text);
  }

  .price {
    font-size: 14px;
    color: var(--color-primary);
    margin-top: 4px;
  }
}
</style>
