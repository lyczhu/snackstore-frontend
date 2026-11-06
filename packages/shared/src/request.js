import axios from 'axios'
import { API_SUCCESS_CODE } from './constants.js'

/**
 * 统一响应判定（纯函数，不依赖任何传输层）——
 * H5/admin 的 axios 拦截器与小程序的 wx.request 适配层共用，
 * 保证「业务成功码 / 401 / 403 / 500 / 网络错误 / 非法响应」的分支与文案只有一份。
 * @param {Object} [res]
 * @param {number} [res.httpStatus] 传输层错误时提供的 HTTP 状态码
 * @param {*} [res.body] 响应体（已 JSON 解析）
 * @param {boolean} [res.timeout] 是否超时
 * @param {boolean} [res.networkError] 是否传输层错误（有 httpStatus 时按状态码细分）
 * @returns {{ action: 'ok'|'business-error'|'unauthorized'|'forbidden'|'server-error'|'network'|'invalid-response', message: string, data?: any }}
 */
export function interpretResponse(res = {}) {
  const { httpStatus, body, timeout, networkError } = res
  if (timeout) return { action: 'network', message: '请求超时，请稍后重试' }
  if (networkError) {
    if (typeof httpStatus === 'number') {
      if (httpStatus === 401) return { action: 'unauthorized', message: '登录已过期，请重新登录' }
      if (httpStatus === 403) return { action: 'forbidden', message: '没有权限访问' }
      if (httpStatus === 500) return { action: 'server-error', message: '服务器错误' }
      return { action: 'network', message: (body && body.message) || '请求失败' }
    }
    return { action: 'network', message: '网络连接失败' }
  }
  // 防御性判断：非标准 JSON 响应（网关错误页等）不再抛 TypeError
  if (!body || typeof body !== 'object' || typeof body.code === 'undefined') {
    return { action: 'invalid-response', message: '服务响应异常，请稍后重试' }
  }
  if (body.code === API_SUCCESS_CODE) return { action: 'ok', message: '', data: body.data }
  const message = body.message || '请求失败'
  if (body.code === 401) return { action: 'unauthorized', message }
  return { action: 'business-error', message }
}

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
