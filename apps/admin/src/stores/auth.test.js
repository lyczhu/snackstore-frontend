import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('auth store', () => {
  it('login 写入 state 并持久化', () => {
    const auth = useAuthStore()
    auth.login('tok123', { id: 1, name: 'admin', role: 'admin' })
    expect(auth.token).toBe('tok123')
    expect(auth.adminInfo.role).toBe('admin')
    expect(localStorage.getItem('adminToken')).toBe('tok123')
    expect(JSON.parse(localStorage.getItem('adminInfo')).role).toBe('admin')
  })

  it('logout 清空 state 与持久化', () => {
    const auth = useAuthStore()
    auth.login('tok123', { id: 1 })
    auth.logout()
    expect(auth.token).toBe('')
    expect(auth.adminInfo).toBeNull()
    expect(localStorage.getItem('adminToken')).toBeNull()
    expect(localStorage.getItem('adminInfo')).toBeNull()
  })

  it('从 localStorage 恢复登录态', () => {
    localStorage.setItem('adminToken', 'saved')
    localStorage.setItem('adminInfo', JSON.stringify({ id: 2, role: 'admin' }))
    const auth = useAuthStore()
    expect(auth.token).toBe('saved')
    expect(auth.adminInfo.id).toBe(2)
  })
})
