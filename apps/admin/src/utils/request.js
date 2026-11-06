import { ElMessage } from 'element-plus'
import router from '@/router'
import { createRequest } from '@snackstore/shared'
import { useAuthStore } from '@/stores/auth'

// 401 统一登出：走 authStore.logout()，保证 Pinia 与 localStorage 状态一致
// （与 web 端保持一致，避免接口 401 后内存 token 仍有效、守卫放行带死 token 操作）
function handleUnauthorized() {
  useAuthStore().logout()
  router.push('/login')
}

const request = createRequest({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  getToken: () => useAuthStore().token,
  onUnauthorized: handleUnauthorized,
  onError: (msg) => ElMessage.error(msg)
})

export default request
