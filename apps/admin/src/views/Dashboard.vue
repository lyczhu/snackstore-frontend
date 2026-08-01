<template>
  <div class="dashboard">
    <!-- 统计卡响应式栅格，小屏不再四卡挤一行 -->
    <el-row :gutter="20">
      <el-col v-for="card in statCards" :key="card.label" :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="stat-card">
          <!-- 加载期间显示骨架屏 -->
          <el-skeleton v-if="loading" :rows="1" animated />
          <template v-else>
            <div class="stat-icon" :class="card.colorClass">
              <el-icon :size="28"><component :is="card.icon" /></el-icon>
            </div>
            <div class="stat-info">
              <p class="stat-value">{{ card.value }}</p>
              <p class="stat-label">{{ card.label }}</p>
            </div>
          </template>
        </el-card>
      </el-col>
    </el-row>

    <!-- 近 7 日订单趋势图 -->
    <el-card class="trend-card" shadow="never">
      <template #header><span>近 7 日订单趋势</span></template>
      <div v-if="trendLoading" class="trend-loading"><el-skeleton :rows="4" animated /></div>
      <div v-show="!trendLoading" ref="chartRef" class="trend-chart"></div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
// 图标按需引入
import { Goods, List, Timer, User } from '@element-plus/icons-vue'
// ECharts 按需引入，控制包体积
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import request from '@/utils/request'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const dashboard = ref({})
const loading = ref(true)
const trendLoading = ref(true)
const chartRef = ref(null)
let chart = null

// 统计卡颜色从 inline style 移入语义化 class
const statCards = computed(() => [
  {
    label: '商品总数',
    value: dashboard.value.productCount || 0,
    icon: Goods,
    colorClass: 'bg-blue'
  },
  { label: '订单总数', value: dashboard.value.orderCount || 0, icon: List, colorClass: 'bg-green' },
  {
    label: '今日订单',
    value: dashboard.value.todayOrderCount || 0,
    icon: Timer,
    colorClass: 'bg-orange'
  },
  { label: '用户总数', value: dashboard.value.userCount || 0, icon: User, colorClass: 'bg-red' }
])

onMounted(async () => {
  try {
    const res = await request.get('/statistics/dashboard')
    dashboard.value = res.data
  } catch (e) {
    /* ignore */
  } finally {
    loading.value = false
  }
  await loadTrend()
  window.addEventListener('resize', resizeChart)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart)
  chart?.dispose()
})

async function loadTrend() {
  trendLoading.value = true
  try {
    const res = await request.get('/statistics/trend')
    const list = res.data || []
    // 先关闭 loading 让容器 v-show 由隐藏变为可见，nextTick 后再 init，
    // 否则 ECharts 在 display:none 的 0×0 容器上初始化，趋势图会空白
    trendLoading.value = false
    await nextTick()
    renderChart(list)
  } catch (e) {
    trendLoading.value = false
  }
}

function renderChart(list) {
  chart = echarts.init(chartRef.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: list.map((i) => i.date) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: '订单量',
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.15 },
        data: list.map((i) => i.orderCount ?? i.count ?? 0)
      }
    ]
  })
}

function resizeChart() {
  chart?.resize()
}
</script>

<style lang="scss" scoped>
.stat-card {
  margin-bottom: 16px;

  :deep(.el-card__body) {
    display: flex;
    align-items: center;
    gap: 16px;
  }
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;

  /* 颜色统一走设计令牌 */
  &.bg-blue {
    background: var(--stat-blue);
  }
  &.bg-green {
    background: var(--stat-green);
  }
  &.bg-orange {
    background: var(--stat-orange);
  }
  &.bg-red {
    background: var(--stat-red);
  }
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: var(--text-primary);
}

.stat-label {
  font-size: 13px;
  /* #999 → 令牌色 #666，对比度 ~5.7:1 达 WCAG AA */
  color: var(--text-secondary);
  margin-top: 4px;
}

.trend-chart {
  height: 320px;
}
</style>
