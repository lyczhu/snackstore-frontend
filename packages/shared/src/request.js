import axios from 'axios'
import { interpretResponse } from './response.js'

// 纯函数本体已下沉到 './response.js'（不引入 axios，供小程序侧单独复用）；
// 这里重新导出以保持既有从 './request.js' 取 interpretResponse 的调用方不变。
export { interpretResponse } from './response.js'

/**
 * 创建 axios request 实例 —— admin 与 mobile 共享的请求基线。
 *
 * baseURL 解析：显式传入 > 默认 '/api'（同源网关）；空串按未配置处理。
 * 不再读 import.meta.env（小程序「构建 npm」的 ES5 转译不支持 import.meta），
 * 由 H5/admin 调用方显式传入各自的构建期环境变量 VITE_API_BASE_URL。
 *
 * 注意：'/api' 是相对路径，依赖部署入口（Nginx `location /api/`）提供反代；
 * 本地 dev/preview 由 Vite server.proxy 兜底。线上独立网关域名须由调用方传入。
 *
 * @param {Object} options
 * @param {string}   [options.baseURL]
 * @param {number}   [options.timeout] 超时毫秒，默认 15000
 * @param {Function} [options.getToken] () => string 返回当前 token
 * @param {Function} [options.onUnauthorized] 401 回调
 * @param {Function} [options.onError] (message) => void 错误提示回调
 * @returns {import('axios').AxiosInstance}
 */
export function createRequest(options = {}) {
  const { timeout = 15000, getToken, onUnauthorized, onError } = options
  const baseURL = options.baseURL || '/api'

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
      const r = interpretResponse({ body: response.data })
      if (r.action === 'ok') return response.data
      // 保留既有契约：非法响应提示统一文案，reject 仍抛「响应格式非法」
      if (r.action === 'invalid-response') {
        onError?.(r.message)
        return Promise.reject(new Error('响应格式非法'))
      }
      onError?.(r.message)
      if (r.action === 'unauthorized') onUnauthorized?.()
      return Promise.reject(new Error(r.message))
    },
    (error) => {
      const r = interpretResponse({
        httpStatus: error.response && error.response.status,
        body: error.response && error.response.data,
        timeout: error.code === 'ECONNABORTED',
        networkError: true
      })
      if (r.action === 'unauthorized') onUnauthorized?.()
      onError?.(r.message)
      return Promise.reject(error)
    }
  )

  return instance
}
