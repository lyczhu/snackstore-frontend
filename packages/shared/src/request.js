import axios from 'axios'
import { API_SUCCESS_CODE } from './constants.js'

/**
 * 创建 axios request 实例 —— admin 与 web 共享的请求基线
 *
 * 两端差异通过注入项收敛：
 * - getToken：返回当前 token（两端均从各自的 Pinia store 读取，localStorage 仅作持久化层）
 * - onUnauthorized：401 时的清登录态（走 store.logout）+ 跳转逻辑
 * - onError：错误提示（admin 用 ElMessage，web 用 showFailToast）
 *
 * @param {Object} options
 * @param {string}   options.baseURL        默认 '/api'
 * @param {number}   options.timeout        超时毫秒，默认 15000
 * @param {Function} options.getToken       () => string 返回当前 token
 * @param {Function} options.onUnauthorized 401 回调
 * @param {Function} options.onError        (message) => void 错误提示回调
 * @returns {import('axios').AxiosInstance}
 */
export function createRequest(options = {}) {
  const { baseURL = '/api', timeout = 15000, getToken, onUnauthorized, onError } = options

  const instance = axios.create({ baseURL, timeout })

  instance.interceptors.request.use(
    (config) => {
      const token = getToken?.()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    (error) => Promise.reject(error)
  )

  instance.interceptors.response.use(
    (response) => {
      const res = response.data
      // 防御性判断：非标准 JSON 响应（网关错误页等）不再抛 TypeError
      if (!res || typeof res !== 'object' || typeof res.code === 'undefined') {
        onError?.('服务响应异常，请稍后重试')
        return Promise.reject(new Error('响应格式非法'))
      }
      if (res.code !== API_SUCCESS_CODE) {
        onError?.(res.message || '请求失败')
        if (res.code === 401) onUnauthorized?.()
        return Promise.reject(new Error(res.message || '请求失败'))
      }
      return res
    },
    (error) => {
      if (error.response) {
        const status = error.response.status
        if (status === 401) {
          onUnauthorized?.()
          onError?.('登录已过期，请重新登录')
        } else if (status === 403) {
          onError?.('没有权限访问')
        } else if (status === 500) {
          onError?.('服务器错误')
        } else {
          onError?.(error.response.data?.message || '请求失败')
        }
      } else {
        onError?.('网络连接失败')
      }
      return Promise.reject(error)
    }
  )

  return instance
}
