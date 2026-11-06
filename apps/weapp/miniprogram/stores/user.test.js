import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from '../../test/wx-mock.js'
import {
  userStore,
  initFromStorage,
  isLoggedIn,
  getToken,
  setLogin,
  logout,
  updateUserInfo,
  registerCartHooks
} from './user.js'

beforeEach(() => {
  resetStorage()
  userStore.patch({ token: '', userInfo: null })
})

describe('user store', () => {
  it('未登录 isLoggedIn 为 false', () => {
    expect(isLoggedIn()).toBe(false)
  })

  it('setLogin 写 storage 与快照，isLoggedIn 转 true', () => {
    setLogin({ token: 'tk', user: { id: 3, mobile: '138' } })
    expect(getToken()).toBe('tk')
    expect(wx.getStorageSync('token')).toBe('tk')
    expect(isLoggedIn()).toBe(true)
  })

  it('initFromStorage 从 storage 恢复', () => {
    wx.setStorageSync('token', 'tk2')
    wx.setStorageSync('userInfo', JSON.stringify({ id: 5 }))
    initFromStorage()
    expect(getToken()).toBe('tk2')
    expect(userStore.getSnapshot().userInfo.id).toBe(5)
  })

  it('logout 清 token 与 userInfo', () => {
    setLogin({ token: 'tk', user: { id: 3 } })
    logout()
    expect(getToken()).toBe('')
    expect(wx.getStorageSync('token')).toBe('')
  })

  it('updateUserInfo 合并并持久化', () => {
    setLogin({ token: 'tk', user: { id: 3, nickname: 'a' } })
    updateUserInfo({ nickname: 'b' })
    expect(userStore.getSnapshot().userInfo).toEqual({ id: 3, nickname: 'b' })
    expect(JSON.parse(wx.getStorageSync('userInfo')).nickname).toBe('b')
  })

  it('setLogin 触发已注册的 onLoggedIn 钩子', () => {
    let calledId = null
    // cart store 在真实运行时注册；测试手动注册验证时序
    registerCartHooks({ onLoggedIn: (id) => (calledId = id) })
    setLogin({ token: 'tk', user: { id: 42 } })
    expect(calledId).toBe(42)
    registerCartHooks({})
  })
})
