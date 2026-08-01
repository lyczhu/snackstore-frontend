<template>
  <div class="login-page">
    <div class="login-card">
      <h2>零食商城管理后台</h2>
      <el-form ref="formRef" :model="form" :rules="rules">
        <el-form-item prop="phone">
          <!-- 补充 aria-label，保证屏幕阅读器可读 -->
          <el-input
            v-model="form.phone"
            placeholder="管理员手机号"
            aria-label="管理员手机号"
            :prefix-icon="Phone"
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            aria-label="密码"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="login-btn" :loading="loading" @click="handleLogin"
            >登录</el-button
          >
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
// 图标改为按需引入，配合 unplugin 生效
import { Phone, Lock } from '@element-plus/icons-vue'
import { postAdminLogin } from '@/api/user'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const formRef = ref(null)
const loading = ref(false)
// 移除预填真实凭据
const form = reactive({ phone: '', password: '' })
const rules = {
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  // validate 失败会 reject，包 try/catch 避免 unhandled rejection
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  loading.value = true
  try {
    const res = await postAdminLogin(form)
    authStore.login(res.data.token, res.data.user)
    ElMessage.success('登录成功')
    // 登录成功后回跳原目标路由（仅允许站内相对路径，防开放重定向）
    const redirect = route.query.redirect
    const target =
      typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/dashboard'
    router.push(target)
  } catch (e) {
    /* handled */
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand-bg-gradient);
}

.login-card {
  /* 移动端自适应，避免 400px 定宽溢出 */
  width: 92%;
  max-width: 400px;
  background: #fff;
  border-radius: 12px;
  padding: 40px 32px;

  h2 {
    text-align: center;
    margin-bottom: 32px;
    color: var(--text-primary);
  }
}

.login-btn {
  width: 100%;
}
</style>
