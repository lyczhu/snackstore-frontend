import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { safeParse } from '@/utils/storage'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(safeParse(localStorage.getItem('userInfo'), null))

  const isLoggedIn = computed(() => !!token.value)

  function setLogin(data) {
    token.value = data.token
    userInfo.value = data.user
    localStorage.setItem('token', data.token)
    localStorage.setItem('userInfo', JSON.stringify(data.user))
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
  }

  function updateUserInfo(data) {
    userInfo.value = { ...userInfo.value, ...data }
    localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
  }

  return { token, userInfo, isLoggedIn, setLogin, logout, updateUserInfo }
})
