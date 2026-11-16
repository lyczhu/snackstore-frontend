<template>
  <!-- 列表页统一包 el-card -->
  <el-card class="category-list">
    <div class="toolbar">
      <h3>分类管理</h3>
      <el-button type="primary" @click="showAddDialog">新增分类</el-button>
    </div>
    <!-- 表格加载态；展示顺序按 sort 升序（后端已排序，前端兜底兼容 sort 缺失） -->
    <el-table v-loading="loading" :data="sortedCategories" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="分类名称" />
      <el-table-column prop="sort" label="排序" width="100" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">{{
            row.status === 1 ? '启用' : '禁用'
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="320">
        <template #default="{ row, $index }">
          <el-button
            size="small"
            :disabled="$index === 0"
            :loading="movingId === row.id"
            @click="moveCategory(row, -1)"
            >上移</el-button
          >
          <el-button
            size="small"
            :disabled="$index === sortedCategories.length - 1"
            :loading="movingId === row.id"
            @click="moveCategory(row, 1)"
            >下移</el-button
          >
          <el-button size="small" @click="editCategory(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 弹窗宽度小屏自适应 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑分类' : '新增分类'"
      width="min(400px, 92vw)"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { getCategoryList, postCategory, putCategory, deleteCategory } from '@/api/product'
import { buildSortUpdates } from '@/utils/sort'
import { ElMessage, ElMessageBox } from 'element-plus'

const categories = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const formRef = ref(null)
const submitting = ref(false)
// 正在调整排序的分类 id，用于按钮 loading 防重复提交
const movingId = ref(null)

// sort 升序，sort 相同按 id 稳定排序（避免同值时每次刷新顺序跳动）
const sortedCategories = computed(() =>
  [...categories.value].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id)
)

const form = reactive({ name: '', sort: 0, status: 1 })
const rules = { name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }] }

onMounted(() => loadCategories())

async function loadCategories() {
  loading.value = true
  try {
    const res = await getCategoryList()
    categories.value = res.data
  } catch (e) {
    /* ignore */
  } finally {
    loading.value = false
  }
}

/** 打开弹窗时清掉残留校验态 */
function openDialog() {
  dialogVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

function showAddDialog() {
  isEdit.value = false
  editId.value = null
  Object.assign(form, { name: '', sort: 0, status: 1 })
  openDialog()
}

function editCategory(row) {
  isEdit.value = true
  editId.value = row.id
  Object.assign(form, { name: row.name, sort: row.sort, status: row.status })
  openDialog()
}

async function submitForm() {
  // 捕获校验失败的 rejection，避免 unhandled rejection
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    if (isEdit.value) {
      await putCategory(editId.value, form)
      ElMessage.success('修改成功')
    } else {
      await postCategory(form)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadCategories()
  } catch (e) {
    /* ignore */
  } finally {
    submitting.value = false
  }
}

/**
 * 与相邻分类交换排序：只提交 sort 发生变化的条目，
 * 保留人工设置的间隔（如 10/20/30），而非整体重排。
 */
async function moveCategory(row, delta) {
  if (movingId.value) return
  const list = sortedCategories.value
  const updates = buildSortUpdates(list, row.id, delta)
  if (!updates.length) return
  movingId.value = row.id
  try {
    await Promise.all(
      updates.map((update) => {
        const source = list.find((item) => item.id === update.id)
        // 后端 DTO 的 name 必填，因此带上原字段一起提交
        return putCategory(update.id, {
          name: source.name,
          sort: update.sort,
          status: source.status
        })
      })
    )
    ElMessage.success('排序已更新')
    loadCategories()
  } catch (e) {
    /* 错误提示已由请求拦截器统一处理 */
  } finally {
    movingId.value = null
  }
}

async function handleDelete(id) {
  try {
    await ElMessageBox.confirm('确定删除该分类？', '提示')
    await deleteCategory(id)
    ElMessage.success('已删除')
    loadCategories()
  } catch (e) {
    /* cancel */
  }
}
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
</style>
