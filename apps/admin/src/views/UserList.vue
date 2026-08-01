<template>
  <!-- 列表页统一包 el-card -->
  <el-card class="user-list">
    <!-- 表格加载态 -->
    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="phone" label="手机号" width="140" />
      <el-table-column prop="nickname" label="昵称" />
      <el-table-column prop="role" label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="row.role === 'ADMIN' ? 'danger' : ''">{{
            row.role === 'ADMIN' ? '管理员' : '用户'
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'">{{
            row.status === 1 ? '正常' : '禁用'
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <!-- 操作按钮防重复 -->
          <el-button
            v-if="row.role !== 'ADMIN'"
            size="small"
            :type="row.status === 1 ? 'danger' : 'success'"
            :loading="actionId === row.id"
            @click="toggleStatus(row)"
          >
            {{ row.status === 1 ? '禁用' : '启用' }}
          </el-button>
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
      @size-change="load"
    />
  </el-card>
</template>

<script setup>
import { ref } from 'vue'
import { getUserList, putUserStatus } from '@/api/user'
import { ElMessage } from 'element-plus'
import { useTable } from '@/composables/useTable'

// 分页/加载逻辑收敛到 useTable
const { rows, loading, pageNum, pageSize, total, load } = useTable((params, signal) =>
  getUserList(params, signal)
)

const actionId = ref(null)

async function toggleStatus(row) {
  const newStatus = row.status === 1 ? 0 : 1
  actionId.value = row.id
  try {
    await putUserStatus(row.id, newStatus)
    ElMessage.success(newStatus === 1 ? '已启用' : '已禁用')
    load()
  } catch (e) {
    /* ignore */
  } finally {
    actionId.value = null
  }
}
</script>

<style lang="scss" scoped>
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
