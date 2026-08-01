<template>
  <div class="login-page">
    <div class="login-card">
      <h2 class="page-main-title">零食商城</h2>
      <p class="subtitle">欢迎登录</p>
      <van-form ref="formRef" @submit="handleLogin">
        <van-field
          v-model="form.phone"
          name="phone"
          type="tel"
          maxlength="11"
          clearable
          left-icon="phone-o"
          placeholder="请输入手机号"
          :rules="[
            { required: true, message: '请输入手机号' },
            { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }
          ]"
        />
        <van-field
          v-model="form.password"
          name="password"
          :type="showPassword ? 'text' : 'password'"
          clearable
          left-icon="lock"
          placeholder="请输入密码"
          :right-icon="showPassword ? 'eye-o' : 'closed-eye'"
          :rules="[
            { required: true, message: '请输入密码' },
            { validator: (val) => val.length >= 6, message: '密码至少6位' }
          ]"
          @click-right-icon="showPassword = !showPassword"
        />
        <div class="form-actions">
          <van-button block round type="primary" native-type="submit" :loading="loading">
            登录
          </van-button>
          <van-button
            block
            round
            plain
            type="primary"
            class="register-btn"
            :loading="loading"
            @click="handleRegister"
          >
            注册
          </van-button>
        </div>
      </van-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showSuccessToast } from 'vant'
import { postLogin, postRegister } from '@/api/user'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const formRef = ref(null)
const loading = ref(false)
const showPassword = ref(false)

// 移除预填测试账号，测试凭据不得随构建发布到生产环境
const form = reactive({
  phone: '',
  password: ''
})

async function handleLogin() {
  loading.value = true
  try {
    const res = await postLogin(form)
    userStore.setLogin(res.data)
    showSuccessToast('登录成功')
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (e) {
    // 错误提示已由 request 拦截器统一处理
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  // 注册按钮非 submit 类型，需手动触发表单校验
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  loading.value = true
  try {
    // 验证码仍为后端约定的固定值；待后端短信/图形验证码接口就绪后，
    // 改为表单收集用户输入（ 决策：本次仅移除预填账号）
    const res = await postRegister({ ...form, code: '123456' })
    userStore.setLogin(res.data)
    showSuccessToast('注册成功')
    router.push('/')
  } catch (e) {
    // 错误提示已由 request 拦截器统一处理
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 装饰性渐变保留原品牌橙（文字为 28px 粗体大字，对比度达标） */
  background: linear-gradient(135deg, var(--color-primary-raw) 0%, var(--color-primary-light) 100%);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 40px 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);

  h2 {
    text-align: center;
    color: var(--color-text);
    font-size: 28px;
    margin-bottom: 8px;
  }

  .subtitle {
    text-align: center;
    color: var(--color-text-placeholder);
    margin-bottom: 24px;
  }
}

.form-actions {
  margin-top: 24px;
}

.register-btn {
  margin-top: 12px;
}
</style>
