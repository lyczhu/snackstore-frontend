<template>
  <!-- 列表页统一包 el-card -->
  <el-card class="order-list">
    <div class="toolbar">
      <!-- 筛选变更回到第一页 -->
      <el-select
        v-model="statusFilter"
        placeholder="订单状态"
        style="width: 140px"
        clearable
        @change="onSearch"
      >
        <el-option label="待支付" :value="0" />
        <el-option label="已完成" :value="1" />
        <el-option label="已取消" :value="2" />
      </el-select>
    </div>
    <!-- 表格加载态 -->
    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="orderNo" label="订单号" width="180" />
      <el-table-column prop="receiverName" label="收货人" width="100" />
      <el-table-column prop="totalAmount" label="金额" width="100">
        <template #default="{ row }">¥{{ row.totalAmount }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ getOrderStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="下单时间" width="180" />
      <el-table-column label="操作" width="240">
        <template #default="{ row }">
          <el-button size="small" @click="viewDetail(row)">详情</el-button>
          <!-- 操作按钮防重复提交 -->
          <el-button
            v-if="row.status === 0"
            size="small"
            type="success"
            :loading="actionId === row.id"
            @click="handlePay(row.id)"
            >确认支付</el-button
          >
          <!-- 补上取消订单操作，消除 API 死代码 -->
          <el-button
            v-if="row.status === 0"
            size="small"
            type="danger"
            :loading="cancelId === row.id"
            @click="handleCancel(row.id)"
            >取消订单</el-button
          >
        </template>
      </el-table-column>
    </el-table>
    <!-- 分页补 sizes/jumper -->
    <el-pagination
      v-model:current-page="pageNum"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next, jumper"
      class="pagination"
      @current-change="load"
      @size-change="onSearch"
    />

    <!-- 弹窗宽度小屏自适应 -->
    <el-dialog v-model="detailVisible" title="订单详情" width="min(600px, 92vw)">
      <template v-if="currentOrder">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="订单号">{{ currentOrder.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentOrder.status)">{{
              getOrderStatusText(currentOrder.status)
            }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="收货人">{{
            currentOrder.receiverName
          }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{
            currentOrder.receiverPhone
          }}</el-descriptions-item>
          <el-descriptions-item label="收货地址" :span="2">{{
            currentOrder.receiverAddress
          }}</el-descriptions-item>
          <el-descriptions-item label="下单时间">{{ currentOrder.createdAt }}</el-descriptions-item>
          <el-descriptions-item label="支付时间">{{
            currentOrder.payTime || '-'
          }}</el-descriptions-item>
        </el-descriptions>
        <el-table :data="currentOrder.items" border style="margin-top: 16px">
          <el-table-column prop="productName" label="商品" />
          <el-table-column prop="productPrice" label="单价" width="100">
            <template #default="{ row }">¥{{ row.productPrice }}</template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column label="小计" width="100">
            <template #default="{ row }"
              >¥{{ (row.productPrice * row.quantity).toFixed(2) }}</template
            >
          </el-table-column>
        </el-table>
        <p class="order-total">
          合计: <span>¥{{ currentOrder.totalAmount }}</span>
        </p>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref } from 'vue'
import { getOrderList, getOrderDetail, payOrder, cancelOrder } from '@/api/order'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getOrderStatusText } from '@snackstore/shared'
import { useTable } from '@/composables/useTable'

const statusFilter = ref(null)
// 分页/加载/筛选逻辑收敛到 useTable
const { rows, loading, pageNum, pageSize, total, load, search } = useTable((params, signal) => {
  if (statusFilter.value !== null && statusFilter.value !== '') {
    params.status = statusFilter.value
  }
  return getOrderList(params, signal)
})

const detailVisible = ref(false)
const currentOrder = ref(null)
const actionId = ref(null)
const cancelId = ref(null)

/** 筛选变更回到第一页 */
function onSearch() {
  search()
}

async function viewDetail(row) {
  try {
    const res = await getOrderDetail(row.id)
    currentOrder.value = res.data
    detailVisible.value = true
  } catch (e) {
    /* ignore */
  }
}

async function handlePay(id) {
  try {
    await ElMessageBox.confirm('确认该订单已支付？', '确认支付')
  } catch {
    return
  }
  actionId.value = id
  try {
    await payOrder(id)
    ElMessage.success('已确认支付')
    load()
  } catch (e) {
    /* ignore */
  } finally {
    actionId.value = null
  }
}

/** 取消订单 */
async function handleCancel(id) {
  try {
    await ElMessageBox.confirm('确定取消该订单？', '取消订单')
  } catch {
    return
  }
  cancelId.value = id
  try {
    await cancelOrder(id)
    ElMessage.success('已取消')
    load()
  } catch (e) {
    /* ignore */
  } finally {
    cancelId.value = null
  }
}

// 状态文案 getOrderStatusText 来自 @snackstore/shared（后端契约，两端共用）
// el-tag 的 type 映射（与 Vant 的类型词汇不同，故保留在本端）
function getStatusType(status) {
  return { 0: 'warning', 1: 'success', 2: 'info' }[status] || 'info'
}
</script>

<style lang="scss" scoped>
.toolbar {
  margin-bottom: 16px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.order-total {
  text-align: right;
  margin-top: 12px;
  font-size: 16px;

  span {
    color: var(--stat-red);
    font-weight: bold;
  }
}
</style>
