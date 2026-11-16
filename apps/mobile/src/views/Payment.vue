<template>
  <div class="payment-page">
    <PageNavBar title="收银台" />

    <van-skeleton v-if="loading" title :row="5" />

    <van-empty v-else-if="loadError" image="error" description="订单加载失败">
      <van-button round type="primary" size="small" @click="loadOrder">重试</van-button>
    </van-empty>

    <template v-else-if="intent">
      <van-notice-bar
        left-icon="info-o"
        wrapable
        :scrollable="false"
        text="演示环境：不会发起真实扣款，也不会产生任何支付记录。"
      />

      <div class="amount-card">
        <p class="label">应付金额</p>
        <p class="amount"><span>¥</span>{{ intent.amount }}</p>
        <p v-if="countdownText" class="countdown">支付剩余 {{ countdownText }}</p>
        <p v-else-if="expired" class="countdown">支付窗口已结束，仍可尝试支付</p>
      </div>

      <div class="info-card">
        <p>订单号：{{ intent.orderNo }}</p>
        <p>支付单号：{{ intent.paymentNo }}</p>
      </div>

      <template v-if="paid">
        <div class="result">
          <van-icon name="checked" size="64" color="var(--color-primary)" />
          <p class="result-text">支付成功</p>
        </div>
        <van-button type="primary" size="large" block @click="goOrder">查看订单</van-button>
      </template>
      <template v-else>
        <van-button type="primary" size="large" block :loading="paying" @click="handlePay">
          确认支付 ¥{{ intent.amount }}
        </van-button>
        <van-button plain size="large" block class="later-btn" @click="goOrder">
          稍后支付
        </van-button>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showSuccessToast, showToast } from 'vant'
import { createPaymentProvider } from '@snackstore/shared'
import { getOrderDetail, payOrder } from '@/api/order'
import PageNavBar from '@/components/PageNavBar.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const loadError = ref(false)
const intent = ref(null)
const paying = ref(false)
const paid = ref(false)
const now = ref(Date.now())
let timer = null

// 支付模式的唯一切换点：接入真实支付时改这里，页面其余代码不动
const provider = createPaymentProvider({
  mode: import.meta.env.VITE_PAYMENT_MODE || 'local',
  payOrder
})

const remainingMs = computed(() => {
  if (!intent.value?.expireAt) return null
  return Math.max(0, intent.value.expireAt - now.value)
})
const expired = computed(() => remainingMs.value === 0)
const countdownText = computed(() => {
  if (!remainingMs.value) return ''
  const total = Math.ceil(remainingMs.value / 1000)
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
})

onMounted(loadOrder)
onUnmounted(stopTimer)

async function loadOrder() {
  loading.value = true
  loadError.value = false
  try {
    const res = await getOrderDetail(route.params.id)
    const order = res.data
    if (order.status !== 0) {
      showToast('该订单无需支付')
      router.replace(`/order/${order.id}`)
      return
    }
    intent.value = provider.createIntent(order)
    startTimer()
  } catch (e) {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

function startTimer() {
  stopTimer()
  now.value = Date.now()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function handlePay() {
  if (paying.value) return
  paying.value = true
  try {
    await provider.pay(intent.value)
    paid.value = true
    stopTimer()
    showSuccessToast('支付成功')
  } catch (e) {
    // 错误提示已由 request 拦截器统一处理
  } finally {
    paying.value = false
  }
}

function goOrder() {
  router.replace(`/order/${intent.value.orderId}`)
}
</script>

<style lang="scss" scoped>
.payment-page {
  min-height: 100vh;
  padding: 16px;
  background: var(--color-bg);
}

.amount-card {
  background: #fff;
  border-radius: var(--radius-card);
  padding: 24px 16px;
  text-align: center;
  margin-bottom: 12px;

  .label {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-bottom: 8px;
  }

  .amount {
    font-size: 32px;
    font-weight: bold;
    color: var(--color-primary);

    span {
      font-size: 18px;
      margin-right: 2px;
    }
  }

  .countdown {
    margin-top: 8px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }
}

.info-card {
  background: #fff;
  border-radius: var(--radius-card);
  padding: 16px;
  margin-bottom: 20px;

  p {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-bottom: 4px;
  }
}

.result {
  text-align: center;
  padding: 24px 0;

  .result-text {
    margin-top: 8px;
    font-size: 16px;
    color: var(--color-text);
  }
}

.later-btn {
  margin-top: 12px;
}
</style>
