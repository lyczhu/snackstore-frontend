<template>
  <div class="order-detail-page">
    <PageNavBar title="订单详情" />

    <van-skeleton v-if="loading" title :row="8" class="detail-skeleton" />

    <!-- 加载失败错误占位 + 重试/返回 -->
    <van-empty v-else-if="loadError" image="error" description="订单加载失败">
      <van-button round type="primary" size="small" class="retry-btn" @click="loadOrder"
        >重试</van-button
      >
      <van-button round size="small" @click="goBack">返回</van-button>
    </van-empty>

    <template v-else-if="order">
      <div class="status-bar">
        <van-tag :type="getStatusType(order.status)" size="large">{{
          getStatusText(order.status)
        }}</van-tag>
      </div>
      <div class="address-info">
        <p class="receiver">{{ order.receiverName }} {{ order.receiverPhone }}</p>
        <p class="address">{{ order.receiverAddress }}</p>
      </div>
      <div class="items-section">
        <OrderGoodsItem
          v-for="item in order.items"
          :key="item.id"
          :image="item.productImage"
          :name="item.productName"
          :price="item.productPrice"
          :quantity="item.quantity"
        />
      </div>
      <div class="info-section">
        <p>订单号: {{ order.orderNo }}</p>
        <p>下单时间: {{ order.createdAt }}</p>
        <p v-if="order.payTime">支付时间: {{ order.payTime }}</p>
        <p class="total">
          合计: <span>¥{{ order.totalAmount }}</span>
        </p>
      </div>

      <SubmitBar v-if="order.status === 0">
        <div class="action-buttons">
          <van-button
            plain
            type="danger"
            size="large"
            :loading="actionLoading"
            @click="handleCancel"
            >取消订单</van-button
          >
          <van-button type="primary" size="large" :loading="actionLoading" @click="handlePay"
            >模拟支付</van-button
          >
        </div>
      </SubmitBar>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showSuccessToast, showConfirmDialog } from 'vant'
import { getOrderDetail, payOrder, cancelOrder } from '@/api/order'
import { getStatusText, getStatusType } from '@/utils/orderStatus'
import PageNavBar from '@/components/PageNavBar.vue'
import SubmitBar from '@/components/SubmitBar.vue'
import OrderGoodsItem from '@/components/OrderGoodsItem.vue'

const route = useRoute()
const router = useRouter()
const order = ref(null)
const loading = ref(true)
const loadError = ref(false)
const actionLoading = ref(false)

onMounted(() => {
  loadOrder()
})

async function loadOrder() {
  loading.value = true
  loadError.value = false
  try {
    const res = await getOrderDetail(route.params.id)
    order.value = res.data
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

async function handlePay() {
  try {
    await showConfirmDialog({ title: '模拟支付', message: '确认支付该订单？' })
  } catch {
    return
  }
  actionLoading.value = true
  try {
    await payOrder(order.value.id)
    showSuccessToast('支付成功')
    await loadOrder()
  } catch (e) {
    // 错误提示已由 request 拦截器统一处理
  } finally {
    actionLoading.value = false
  }
}

async function handleCancel() {
  try {
    await showConfirmDialog({ title: '提示', message: '确认取消该订单？' })
  } catch {
    return
  }
  actionLoading.value = true
  try {
    await cancelOrder(order.value.id)
    showSuccessToast('订单已取消')
    await loadOrder()
  } catch (e) {
    // 错误提示已由 request 拦截器统一处理
  } finally {
    actionLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
.order-detail-page {
  padding: 16px;
  padding-bottom: calc(90px + env(safe-area-inset-bottom));
}

.detail-skeleton {
  padding: 8px 0;
}

.retry-btn {
  margin-right: 12px;
}

.status-bar {
  text-align: center;
  padding: 20px;
  background: #fff;
  border-radius: var(--radius-card);
  margin-bottom: 12px;
}

.address-info {
  background: #fff;
  border-radius: var(--radius-card);
  padding: 16px;
  margin-bottom: 12px;

  .receiver {
    font-size: 16px;
    color: var(--color-text);
    margin-bottom: 4px;
  }

  .address {
    font-size: 13px;
    color: var(--color-text-secondary);
  }
}

.items-section {
  background: #fff;
  border-radius: var(--radius-card);
  padding: 12px;
  margin-bottom: 12px;
}

.info-section {
  background: #fff;
  border-radius: var(--radius-card);
  padding: 16px;

  p {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-bottom: 4px;
  }

  .total {
    margin-top: 8px;
    font-size: 16px;
    color: var(--color-text);

    span {
      color: var(--color-primary);
      font-weight: bold;
      font-size: 20px;
    }
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
