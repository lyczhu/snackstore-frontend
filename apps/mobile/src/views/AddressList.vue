<template>
  <div class="address-list">
    <PageNavBar title="收货地址">
      <template #right>
        <van-button size="small" type="primary" plain @click="showAddDialog">新增地址</van-button>
      </template>
    </PageNavBar>

    <!-- 加载失败错误态，点击重试 -->
    <button v-if="loadError" type="button" class="error-retry" @click="loadAddresses">
      <van-empty image="error" description="加载失败，点击重试" />
    </button>

    <template v-else>
      <van-skeleton v-if="initialLoading" :row="4" />
      <div v-else class="addresses">
        <div v-for="addr in addresses" :key="addr.id" class="address-card">
          <div class="address-info">
            <div class="receiver">
              <span class="name">{{ addr.receiverName }}</span>
              <span class="phone">{{ addr.receiverPhone }}</span>
              <van-tag v-if="addr.isDefault === 1" type="primary">默认</van-tag>
            </div>
            <p class="detail">
              {{ addr.province }}{{ addr.city }}{{ addr.district }}{{ addr.detail }}
            </p>
          </div>
          <div class="actions">
            <van-button size="small" plain type="primary" @click="editAddress(addr)"
              >编辑</van-button
            >
            <van-button v-if="addr.isDefault !== 1" size="small" plain @click="setDefault(addr.id)"
              >设为默认</van-button
            >
            <van-button size="small" plain type="danger" @click="handleDelete(addr.id)"
              >删除</van-button
            >
          </div>
        </div>
        <van-empty v-if="addresses.length === 0" description="暂无收货地址" />
      </div>
    </template>

    <!-- 地址表单：底部弹层替代 90% 宽对话框，移动端标准范式 -->
    <van-popup v-model:show="dialogVisible" position="bottom" round>
      <div class="address-form">
        <h4>{{ isEdit ? '编辑地址' : '新增地址' }}</h4>
        <van-form ref="formRef" @submit="submitForm">
          <van-field
            v-model="form.receiverName"
            name="receiverName"
            label="收货人"
            placeholder="请输入收货人姓名"
            :rules="[{ required: true, message: '请输入收货人姓名' }]"
          />
          <van-field
            v-model="form.receiverPhone"
            name="receiverPhone"
            label="手机号"
            type="tel"
            maxlength="11"
            placeholder="请输入手机号"
            :rules="[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }
            ]"
          />
          <van-field v-model="form.province" name="province" label="省份" placeholder="省份" />
          <van-field v-model="form.city" name="city" label="城市" placeholder="城市" />
          <van-field v-model="form.district" name="district" label="区县" placeholder="区县" />
          <van-field
            v-model="form.detail"
            name="detail"
            label="详细地址"
            placeholder="请输入详细地址"
            :rules="[{ required: true, message: '请输入详细地址' }]"
          />
          <van-field name="isDefault" label="默认地址">
            <template #input>
              <van-switch
                :model-value="form.isDefault === 1"
                size="22"
                @update:model-value="form.isDefault = $event ? 1 : 0"
              />
            </template>
          </van-field>
          <div class="form-actions">
            <van-button block round type="primary" native-type="submit">确定</van-button>
            <van-button block round class="cancel-btn" @click="dialogVisible = false"
              >取消</van-button
            >
          </div>
        </van-form>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { showSuccessToast, showConfirmDialog } from 'vant'
import {
  getAddressList,
  postAddress,
  putAddress,
  deleteAddress,
  setDefaultAddress
} from '@/api/address'
import PageNavBar from '@/components/PageNavBar.vue'

const addresses = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const formRef = ref(null)
const initialLoading = ref(true)
const loadError = ref(false)

const form = reactive({
  receiverName: '',
  receiverPhone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: 0
})

onMounted(() => {
  loadAddresses()
})

async function loadAddresses() {
  loadError.value = false
  try {
    const res = await getAddressList()
    addresses.value = res.data || []
  } catch (e) {
    loadError.value = true // 失败可重试，不再静默
  } finally {
    initialLoading.value = false
  }
}

function showAddDialog() {
  isEdit.value = false
  editId.value = null
  Object.assign(form, {
    receiverName: '',
    receiverPhone: '',
    province: '',
    city: '',
    district: '',
    detail: '',
    isDefault: 0
  })
  dialogVisible.value = true
}

function editAddress(addr) {
  isEdit.value = true
  editId.value = addr.id
  Object.assign(form, {
    receiverName: addr.receiverName,
    receiverPhone: addr.receiverPhone,
    province: addr.province,
    city: addr.city,
    district: addr.district,
    detail: addr.detail,
    isDefault: addr.isDefault
  })
  dialogVisible.value = true
}

async function submitForm() {
  try {
    if (isEdit.value) {
      await putAddress(editId.value, form)
      showSuccessToast('修改成功')
    } else {
      await postAddress(form)
      showSuccessToast('添加成功')
    }
    dialogVisible.value = false
    loadAddresses()
  } catch (e) {
    // 错误提示已由 request 拦截器统一处理
  }
}

async function setDefault(id) {
  try {
    await setDefaultAddress(id)
    showSuccessToast('已设为默认')
    loadAddresses()
  } catch (e) {
    // 错误提示已由 request 拦截器统一处理
  }
}

async function handleDelete(id) {
  try {
    await showConfirmDialog({ title: '提示', message: '确定删除该地址？' })
  } catch {
    return // 用户取消
  }
  try {
    await deleteAddress(id)
    showSuccessToast('已删除')
    loadAddresses()
  } catch (e) {
    // 错误提示已由 request 拦截器统一处理
  }
}
</script>

<style lang="scss" scoped>
.address-list {
  padding: 16px;
}

.address-card {
  background: #fff;
  border-radius: var(--radius-card);
  padding: 12px;
  margin-bottom: 12px;
}

.receiver {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;

  .name {
    font-size: 15px;
    color: var(--color-text);
    font-weight: 500;
  }

  .phone {
    font-size: 13px;
    color: var(--color-text-secondary);
  }
}

.detail {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.actions {
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--color-border);
  padding-top: 8px;
}

.address-form {
  padding: 20px 0 calc(16px + env(safe-area-inset-bottom));
  max-height: 85vh;
  overflow-y: auto;

  h4 {
    text-align: center;
    color: var(--color-text);
    margin-bottom: 8px;
  }
}

.form-actions {
  padding: 16px;
}

.cancel-btn {
  margin-top: 12px;
}
</style>
