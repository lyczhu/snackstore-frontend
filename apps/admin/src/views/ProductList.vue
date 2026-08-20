<template>
  <!-- 列表页统一包 el-card，消除质感割裂 -->
  <el-card class="product-list">
    <div class="toolbar">
      <!-- 加 clearable，清空时回到第一页刷新；输入防抖 300ms -->
      <el-input
        v-model="keyword"
        placeholder="搜索商品"
        style="width: 200px"
        clearable
        @input="onKeywordInput"
        @clear="onSearch"
        @keyup.enter="onSearch"
      />
      <el-button type="primary" @click="showAddDialog">新增商品</el-button>
    </div>
    <!-- 表格加载态 -->
    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="商品名称" min-width="200" />
      <el-table-column prop="categoryName" label="分类" width="120" />
      <el-table-column prop="price" label="价格" width="100">
        <template #default="{ row }">¥{{ row.price }}</template>
      </el-table-column>
      <el-table-column prop="stock" label="库存" width="80" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">{{
            row.status === 1 ? '上架' : '下架'
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="editProduct(row)">编辑</el-button>
          <el-button
            size="small"
            :type="row.status === 1 ? 'warning' : 'success'"
            :loading="actionId === row.id"
            @click="toggleStatus(row)"
          >
            {{ row.status === 1 ? '下架' : '上架' }}
          </el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
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
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑商品' : '新增商品'"
      width="min(600px, 92vw)"
    >
      <el-form
        ref="formRef"
        v-loading="detailLoading"
        :model="form"
        :rules="rules"
        label-width="80px"
      >
        <el-form-item label="商品名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.categoryId" placeholder="选择分类">
            <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="价格" prop="price">
          <el-input-number v-model="form.price" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="库存">
          <el-input-number v-model="form.stock" :min="0" />
        </el-form-item>
        <el-form-item label="封面图">
          <el-input v-model="form.coverImage" placeholder="图片URL" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="详情">
          <el-input v-model="form.detail" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <!-- 详情加载失败：阻断提交并提供重试，避免用空 detail 覆盖后端已有详情 -->
      <el-alert
        v-if="detailFailed"
        class="detail-error"
        type="error"
        show-icon
        :closable="false"
        title="商品详情加载失败，重试成功后方可提交"
      >
        <el-button link type="primary" @click="loadEditDetail(editId)">重试</el-button>
      </el-alert>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <!-- 提交防重复；详情未就绪/加载失败时禁用，防止空 detail 覆盖后端数据 -->
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="detailLoading || detailFailed"
          @click="submitForm"
          >确定</el-button
        >
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, nextTick } from 'vue'
import {
  getProductList,
  getProductDetail,
  postProduct,
  putProduct,
  deleteProduct,
  putProductStatus,
  getCategoryList
} from '@/api/product'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTable } from '@/composables/useTable'

const keyword = ref('')
// 分页/加载/搜索逻辑收敛到 useTable
const { rows, loading, pageNum, pageSize, total, load, search } = useTable((params, signal) =>
  getProductList({ ...params, keyword: keyword.value }, signal)
)

const categories = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const formRef = ref(null)
const submitting = ref(false)
const detailLoading = ref(false)
const detailFailed = ref(false)
const actionId = ref(null)

const form = reactive({
  name: '',
  categoryId: null,
  price: 0,
  stock: 0,
  coverImage: '',
  description: '',
  detail: ''
})

const rules = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }]
}

loadCategories()

/** 搜索/清空时回到第一页 */
function onSearch() {
  search()
}

// 搜索输入防抖 300ms，避免每次按键都发请求
let debounceTimer = null
function onKeywordInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(onSearch, 300)
}

async function loadCategories() {
  try {
    const res = await getCategoryList()
    categories.value = res.data
  } catch (e) {
    /* ignore */
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
  // 新增模式无详情加载，清掉编辑态残留的失败标记
  detailFailed.value = false
  Object.assign(form, {
    name: '',
    categoryId: null,
    price: 0,
    stock: 0,
    coverImage: '',
    description: '',
    detail: ''
  })
  openDialog()
}

/**
 * 编辑前先拉取商品详情回填，避免列表行数据不含 detail
 * 导致保存时用空串覆盖后端详情造成数据丢失
 */
async function editProduct(row) {
  isEdit.value = true
  editId.value = row.id
  Object.assign(form, {
    name: row.name,
    categoryId: row.categoryId,
    price: row.price,
    stock: row.stock,
    coverImage: row.coverImage,
    description: row.description,
    detail: ''
  })
  openDialog()
  loadEditDetail(row.id)
}

/**
 * 拉取商品详情回填表单（列表行数据不含 detail）。
 * 失败时置 detailFailed 阻断提交并提供重试，避免用空串覆盖后端已有详情
 */
async function loadEditDetail(id) {
  detailLoading.value = true
  detailFailed.value = false
  try {
    const res = await getProductDetail(id)
    const p = res.data
    Object.assign(form, {
      name: p.name,
      categoryId: p.categoryId,
      price: p.price,
      stock: p.stock,
      coverImage: p.coverImage,
      description: p.description,
      detail: p.detail || ''
    })
  } catch (e) {
    // 错误提示已由 request 拦截器统一处理
    detailFailed.value = true
  } finally {
    detailLoading.value = false
  }
}

async function submitForm() {
  // 捕获校验失败的 rejection
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    if (isEdit.value) {
      await putProduct(editId.value, form)
      ElMessage.success('修改成功')
    } else {
      await postProduct(form)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    load()
  } catch (e) {
    /* ignore */
  } finally {
    submitting.value = false
  }
}

async function toggleStatus(row) {
  const newStatus = row.status === 1 ? 0 : 1
  actionId.value = row.id
  try {
    await putProductStatus(row.id, newStatus)
    ElMessage.success(newStatus === 1 ? '已上架' : '已下架')
    load()
  } catch (e) {
    /* ignore */
  } finally {
    actionId.value = null
  }
}

async function handleDelete(id) {
  try {
    await ElMessageBox.confirm('确定删除该商品？', '提示')
    await deleteProduct(id)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    /* cancel */
  }
}
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.detail-error {
  margin-top: 12px;
}
</style>
