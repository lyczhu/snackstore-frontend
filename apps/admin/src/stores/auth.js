import { defineStore } from 'pinia'
import { safeParse } from '@snackstore/shared'

// 统一认证状态管理，替代散落在各组件的
// computed(() => JSON.parse(localStorage...)) 非响应式写法
export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('adminToken') || '',
    // 容错解析：adminInfo 损坏时回退 null，避免应用启动崩溃（与 web 端对齐）
    adminInfo: safeParse(localStorage.getItem('adminInfo'), null)
  }),
  actions: {
    login(token, adminInfo) {
      this.token = token
      this.adminInfo = adminInfo
      localStorage.setItem('adminToken', token)
      localStorage.setItem('adminInfo', JSON.stringify(adminInfo))
    },
    logout() {
      this.token = ''
      this.adminInfo = null
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminInfo')
    }
  }
})
