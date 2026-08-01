<template>
  <!-- 列表页统一包 el-card -->
  <el-card class="category-list">
    <div class="toolbar">
      <h3>分类管理</h3>
      <el-button type="primary" @click="showAddDialog">新增分类</el-button>
    </div>
    <!-- 表格加载态 -->
    <el-table v-loading="loading" :data="categories" border stripe>
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
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
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
import { ref, reactive, nextTick, onMounted } from 'vue'
import { getCategoryList, postCategory, putCategory, deleteCategory } from '@/api/product'
import { ElMessage, ElMessageBox } from 'element-plus'

const categories = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const formRef = ref(null)
const submitting = ref(false)

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
