<template>
  <div class="cart-page">
    <h3 class="page-main-title">购物车</h3>

    <div v-if="cartStore.items.length > 0" class="cart-list">
      <div v-for="item in cartStore.items" :key="item.productId" class="cart-item">
        <router-link :to="`/product/${item.productId}`" class="item-link">
          <van-image
            :src="item.coverImage"
            :alt="item.name"
            fit="cover"
            lazy-load
            class="item-image"
          />
        </router-link>
        <div class="item-info">
          <p class="name">{{ item.name }}</p>
          <p class="price">¥{{ item.price }}</p>
          <!-- 步进器按钮 36px，触控目标达标；min=1 与 Store 双重防 0 -->
          <van-stepper
            :model-value="item.quantity"
            min="1"
            button-size="36"
            @change="(val) => cartStore.updateQuantity(item.productId, Number(val))"
          />
        </div>
        <van-button
          class="remove-btn"
          type="danger"
          plain
          icon="delete-o"
          aria-label="删除该商品"
          @click="cartStore.removeItem(item.productId)"
        />
      </div>
    </div>
    <van-empty v-else description="购物车是空的">
      <van-button round type="primary" size="small" to="/home">去逛逛</van-button>
    </van-empty>

    <!-- 结算栏贴紧 tabbar（above-tabbar），列表底部留白防遮挡 -->
    <SubmitBar v-if="cartStore.items.length > 0" above-tabbar>
      <div class="cart-footer">
        <div class="total">
          合计: <span class="total-price">¥{{ cartStore.totalPrice.toFixed(2) }}</span>
        </div>
        <van-button type="primary" round @click="goCheckout">
          去结算 ({{ cartStore.totalCount }})
        </van-button>
      </div>
    </SubmitBar>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useCartStore } from '@/stores/cart'
import { useUserStore } from '@/stores/user'
import SubmitBar from '@/components/SubmitBar.vue'

const router = useRouter()
const cartStore = useCartStore()
const userStore = useUserStore()

function goCheckout() {
  if (!userStore.isLoggedIn) {
    showToast('请先登录')
    router.push({ path: '/login', query: { redirect: '/order/confirm' } })
    return
  }
  router.push('/order/confirm')
}
</script>

<style lang="scss" scoped>
.cart-page {
  padding: 16px;
  /* 底部留白 = 结算栏高度余量，防止最后一个条目被 fixed 结算栏遮挡 */
  padding-bottom: 80px;

  h3 {
    margin-bottom: 16px;
    color: var(--color-text);
  }
}

.cart-item {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: var(--radius-card);
  padding: 12px;
  margin-bottom: 12px;
}

.item-link {
  flex-shrink: 0;
}

.item-image {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-card);
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
    font-size: 16px;
    color: var(--color-primary);
    font-weight: bold;
    margin: 4px 0 8px;
  }
}

.remove-btn {
  flex-shrink: 0;
}

.cart-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.total-price {
  color: var(--color-primary);
  font-size: 20px;
  font-weight: bold;
}
</style>
