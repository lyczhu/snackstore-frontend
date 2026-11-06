import axios from 'axios'
import { API_SUCCESS_CODE } from './constants.js'

/**
 * 创建 axios request 实例 —— admin 与 web 共享的请求基线
 *
 * 两端差异通过注入项收敛：
 * - baseURL：默认读构建期环境变量 `VITE_API_BASE_URL`，未配置时为 '/api'（同源网关）
 * - getToken：返回当前 token（两端均从各自的 Pinia store 读取，localStorage 仅作持久化层）
 * - onUnauthorized：401 时的清登录态（走 store.logout）+ 跳转逻辑
 * - onError：错误提示（admin 用 ElMessage，web 用 showFailToast）
 *
 * 注意：'/api' 是相对路径，依赖部署入口（Nginx `location /api/`）提供反代。
 * 本地 dev/preview 由 Vite `server.proxy` 兜底，该代理不进构建产物，因此线上
 * 若要把请求打到独立网关域名，必须显式配置 `VITE_API_BASE_URL`（同时后端需
 * CORS 放行 Authorization 头），而不是 `VITE_API_TARGET`——后者只喂给本地代理。
 *
 * @param {Object} options
 * @param {string}   [options.baseURL]        请求基址，缺省取 VITE_API_BASE_URL，再缺省 '/api'
 * @param {number}   options.timeout          超时毫秒，默认 15000
 * @param {Function} options.getToken         () => string 返回当前 token
 * @param {Function} options.onUnauthorized   401 回调
 * @param {Function} options.onError          (message) => void 错误提示回调
 * @returns {import('axios').AxiosInstance}
 */
export function createRequest(options = {}) {
  const { timeout = 15000, getToken, onUnauthorized, onError } = options
  // 显式传入 > 构建期环境变量 > 同源 '/api'；空串按未配置处理，
  // 避免 `.env` 里写 `VITE_API_BASE_URL=` 就把基址清空（请求打到相对根路径）
  const baseURL = options.baseURL || import.meta.env?.VITE_API_BASE_URL || '/api'

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
