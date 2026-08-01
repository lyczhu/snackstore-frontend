<template>
  <div class="order-list">
    <PageNavBar title="我的订单" />

    <van-tabs v-model:active="activeTab" @change="resetAndReload">
      <van-tab title="全部" name="all" />
      <van-tab title="待支付" name="pending" />
      <van-tab title="已完成" name="completed" />
    </van-tabs>

    <!-- 加载失败错误态，点击重试 -->
    <button v-if="loadError" type="button" class="error-retry" @click="resetAndReload">
      <van-empty image="error" description="加载失败，点击重试" />
    </button>

    <template v-else>
      <van-list
        v-model:loading="loading"
        v-model:error="listError"
        :finished="finished"
        :finished-text="orders.length ? '没有更多了' : ''"
        error-text="加载失败，点击重试"
        @load="onLoad"
      >
        <van-skeleton v-if="initialLoading" :row="6" />
        <div v-else class="orders">
          <!-- 卡片内含支付/取消按钮，无法整体嵌套链接，故用 role=button + 键盘事件兜底 -->
          <div
            v-for="order in orders"
            :key="order.id"
            class="order-card"
            role="button"
            tabindex="0"
            @click="goDetail(order.id)"
            @keydown.enter="goDetail(order.id)"
            @keydown.space.prevent="goDetail(order.id)"
          >
            <div class="order-header">
              <span class="order-no">订单号: {{ order.orderNo }}</span>
              <van-tag :type="getStatusType(order.status)">{{
                getStatusText(order.status)
              }}</van-tag>
            </div>
            <OrderGoodsItem
              v-for="item in order.items"
              :key="item.id"
              :image="item.productImage"
              :name="item.productName"
              :price="item.productPrice"
              :quantity="item.quantity"
              :image-size="50"
            />
            <div class="order-footer">
              <span>合计: ¥{{ order.totalAmount }}</span>
              <div v-if="order.status === 0" class="order-actions">
                <van-button type="primary" size="small" @click.stop="handlePay(order.id)"
                  >支付</van-button
                >
                <van-button type="danger" plain size="small" @click.stop="handleCancel(order.id)"
                  >取消</van-button
                >
              </div>
            </div>
          </div>
        </div>
      </van-list>
      <van-empty v-if="!initialLoading && !loading && orders.length === 0" description="暂无订单" />
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showSuccessToast, showConfirmDialog } from 'vant'
import { getOrderList, payOrder, cancelOrder } from '@/api/order'
import { useUserStore } from '@/stores/user'
import { getStatusText, getStatusType } from '@/utils/orderStatus'
import PageNavBar from '@/components/PageNavBar.vue'
import OrderGoodsItem from '@/components/OrderGoodsItem.vue'
import { usePagedList } from '@/composables/usePagedList'

const router = useRouter()
const userStore = useUserStore()
const activeTab = ref('all')

// 分页加载逻辑已收口至 usePagedList（原与 Home / Category 三处同构重复）
const {
  items: orders,
  loading,
  finished,
  listError,
  initialLoading,
  loadError,
  onLoad,
  resetAndReload
} = usePagedList({
  fetcher: (pageNum, pageSize) => {
    const params = { userId: userStore.userInfo?.id, pageNum, pageSize }
    if (activeTab.value === 'pending') params.status = 0
    if (activeTab.value === 'completed') params.status = 1
    return getOrderList(params)
  }
})
// 订单首屏由 van-list immediate-check 触发 onLoad

function goDetail(id) {
  router.push(`/order/${id}`)
}

async function handlePay(id) {
  try {
    await showConfirmDialog({ title: '模拟支付', message: '确认支付该订单？' })
  } catch {
    return // 用户取消
  }
  try {
    await payOrder(id)
    showSuccessToast('支付成功')
    resetAndReload()
  } catch (e) {
    // 错误提示已由 request 拦截器统一处理
  }
}

async function handleCancel(id) {
  try {
    await showConfirmDialog({ title: '提示', message: '确认取消该订单？' })
  } catch {
    return // 用户取消
  }
  try {
    await cancelOrder(id)
    showSuccessToast('订单已取消')
    resetAndReload()
  } catch (e) {
    // 错误提示已由 request 拦截器统一处理
  }
}
</script>

<style lang="scss" scoped>
.order-list {
  padding-bottom: 16px;
}

.orders {
  padding: 12px 16px;
}

.order-card {
  background: #fff;
  border-radius: var(--radius-card);
  padding: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.98);
  }
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;

  .order-no {
    font-size: 13px;
    color: var(--color-text-placeholder);
  }
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  font-size: 14px;
  color: var(--color-text);
}

.order-actions {
  display: flex;
  gap: 8px;
}
</style>
