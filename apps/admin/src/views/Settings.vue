<template>
  <div class="settings">
    <el-card>
      <template #header><span>系统设置</span></template>
      <el-form label-width="120px" style="max-width: 400px">
        <el-form-item label="管理员账号">
          <!-- 改从 auth store 读取，与 Layout 保持同步 -->
          <el-input :model-value="authStore.adminInfo?.phone" disabled />
        </el-form-item>
        <el-form-item label="修改密码">
          <el-input v-model="newPassword" type="password" placeholder="输入新密码" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleChangePassword">修改密码</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const newPassword = ref('')

function handleChangePassword() {
  if (!newPassword.value || newPassword.value.length < 6) {
    ElMessage.warning('密码至少6位')
    return
  }
  ElMessage.info('MVP版本暂不支持密码修改')
}
</script>
