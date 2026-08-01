<template>
  <div class="order-confirm">
    <PageNavBar title="确认订单" />

    <template v-if="settleItems.length > 0">
      <!-- 地址选择区改为语义化 button -->
      <button v-if="addressError" type="button" class="address-section" @click="loadAddresses">
        <p>地址加载失败，点击重试</p>
        <van-icon name="replay" class="arrow-icon" />
      </button>
      <button
        v-else-if="defaultAddress"
        type="button"
        class="address-section"
        @click="showAddressPicker = true"
      >
        <div class="address-info">
          <p class="receiver">
            {{ defaultAddress.receiverName }} {{ defaultAddress.receiverPhone }}
          </p>
          <p class="address">
            {{ defaultAddress.province }}{{ defaultAddress.city }}{{ defaultAddress.district
            }}{{ defaultAddress.detail }}
          </p>
        </div>
        <van-icon name="arrow" class="arrow-icon" />
      </button>
      <button v-else type="button" class="address-section" @click="router.push('/address')">
        <p>请添加收货地址</p>
        <van-icon name="arrow" class="arrow-icon" />
      </button>

      <!-- 结算列表按来源计算（购物车 或 直购快照） -->
      <div class="items-section">
        <OrderGoodsItem
          v-for="item in settleItems"
          :key="item.productId"
          :image="item.coverImage"
          :name="item.name"
          :price="item.price"
          :quantity="item.quantity"
        />
      </div>

      <div class="total-section">
        <span>合计:</span>
        <span class="total-price">¥{{ settleTotal.toFixed(2) }}</span>
      </div>

      <SubmitBar>
        <van-button block round type="primary" size="large" :loading="loading" @click="submitOrder">
          提交订单
        </van-button>
      </SubmitBar>
    </template>

    <van-empty v-else description="暂无待结算商品">
      <van-button round type="primary" size="small" to="/home">去逛逛</van-button>
    </van-empty>

    <!-- 地址选择弹层：移动端标准底部弹出，替代 90% 宽对话框 -->
    <van-popup v-model:show="showAddressPicker" position="bottom" round>
      <div class="address-picker">
        <h4>选择收货地址</h4>
        <button
          v-for="addr in addresses"
          :key="addr.id"
          type="button"
          class="address-option"
          :class="{ active: defaultAddress && defaultAddress.id === addr.id }"
          @click="selectAddress(addr)"
        >
          <p class="option-receiver">{{ addr.receiverName }} {{ addr.receiverPhone }}</p>
          <p class="option-detail">
            {{ addr.province }}{{ addr.city }}{{ addr.district }}{{ addr.detail }}
          </p>
        </button>
        <van-empty v-if="addresses.length === 0" description="暂无收货地址" />
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import { postOrder } from '@/api/order'
import { getAddressList } from '@/api/address'
import { useCartStore } from '@/stores/cart'
import PageNavBar from '@/components/PageNavBar.vue'
import SubmitBar from '@/components/SubmitBar.vue'
import OrderGoodsItem from '@/components/OrderGoodsItem.vue'

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()
const loading = ref(false)
const addresses = ref([])
const defaultAddress = ref(null)
const addressError = ref(false)
const showAddressPicker = ref(false)

// 直购模式只结算直购快照，购物车结算不受影响
const isBuyNow = computed(() => route.query.from === 'buyNow' && !!cartStore.buyNowItem)
const settleItems = computed(() => (isBuyNow.value ? [cartStore.buyNowItem] : cartStore.items))
// 金额改用「分」为整数单位累加再换算回元，避免浮点漂移
const settleTotal = computed(() => {
  const cents = settleItems.value.reduce(
    (sum, item) => sum + Math.round((item.price ?? 0) * 100) * item.quantity,
    0
  )
  return cents / 100
})

onMounted(() => {
  // 直购页刷新后内存快照丢失，引导重新下单，防止误按购物车结算
  if (route.query.from === 'buyNow' && !cartStore.buyNowItem) {
    showToast('直购信息已失效，请重新下单')
    router.replace('/')
    return
  }
  loadAddresses()
})

async function loadAddresses() {
  addressError.value = false
  try {
    const res = await getAddressList()
    addresses.value = res.data || []
    defaultAddress.value =
      addresses.value.find((a) => a.isDefault === 1) || addresses.value[0] || null
  } catch (e) {
    addressError.value = true // 地址失败给出可重试错误态
  }
}

function selectAddress(addr) {
  defaultAddress.value = addr
  showAddressPicker.value = false
}

async function submitOrder() {
  if (!defaultAddress.value) {
    showToast('请选择收货地址')
    return
  }
  loading.value = true
  try {
    const data = {
      items: settleItems.value.map((item) => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      receiverName: defaultAddress.value.receiverName,
      receiverPhone: defaultAddress.value.receiverPhone,
      receiverAddress: `${defaultAddress.value.province || ''}${defaultAddress.value.city || ''}${defaultAddress.value.district || ''}${defaultAddress.value.detail}`
    }
    // 幂等键：防网络重试/重复提交产生重复订单（按钮 loading 只能防双击，防不了重试）
    const idempotencyKey =
      globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    await postOrder(data, { headers: { 'Idempotency-Key': idempotencyKey } })
    // 直购仅清理快照；购物车结算才清空购物车
    if (isBuyNow.value) {
      cartStore.clearBuyNowItem()
    } else {
      cartStore.clearCart()
    }
    showSuccessToast('下单成功')
    // replace 避免回退到确认页重复提交
    router.replace('/order/list')
  } catch (e) {
    // 错误提示已由 request 拦截器统一处理
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.order-confirm {
  padding: 16px;
  padding-bottom: calc(90px + env(safe-area-inset-bottom));
}

.address-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  text-align: left;
  background: #fff;
  padding: 16px;
  border-radius: var(--radius-card);
  margin-bottom: 16px;

  .receiver {
    font-size: 16px;
    color: var(--color-text);
    margin-bottom: 4px;
  }

  .address {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .arrow-icon {
    color: var(--color-text-placeholder); /* 原 #ccc 对比度不足 */
    flex-shrink: 0;
    margin-left: 8px;
  }
}

.items-section {
  background: #fff;
  border-radius: var(--radius-card);
  padding: 12px;
  margin-bottom: 16px;
}

.total-section {
  text-align: right;
  padding: 12px 0;

  .total-price {
    font-size: 20px;
    color: var(--color-primary);
    font-weight: bold;
  }
}

.address-picker {
  padding: 20px 16px calc(16px + env(safe-area-inset-bottom));
  max-height: 70vh;
  overflow-y: auto;

  h4 {
    margin-bottom: 12px;
    color: var(--color-text);
    text-align: center;
  }
}

.address-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  margin-bottom: 8px;
  transition:
    border-color 0.2s,
    background-color 0.2s;

  &.active {
    border-color: var(--color-primary);
    background: rgba(229, 90, 43, 0.06);
  }

  .option-receiver {
    font-size: 14px;
    color: var(--color-text);
    margin-bottom: 4px;
  }

  .option-detail {
    font-size: 13px;
    color: var(--color-text-secondary);
  }
}
</style>
