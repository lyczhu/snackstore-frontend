import { showFailToast } from 'vant'
import router from '@/router'
import { useUserStore } from '@/stores/user'
import { createRequest } from '@snackstore/shared'

// 401 统一登出：走 userStore.logout()，保证 Pinia 与 localStorage 状态一致
function handleUnauthorized() {
  const userStore = useUserStore()
  userStore.logout()
  router.push('/login')
}

const request = createRequest({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  getToken: () => {
    const userStore = useUserStore()
    return userStore.token
  },
  onUnauthorized: handleUnauthorized,
  onError: (msg) => showFailToast(msg)
})

export default request
