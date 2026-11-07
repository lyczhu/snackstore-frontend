import { interpretResponse } from '@snackstore/shared/response'
import env from '../config/env.js'

/** 绝对地址 + path + query 拼装；undefined/null 参数剔除 */
function buildUrl(base, path, params) {
  const head = (base || '').replace(/\/$/, '')
  let url = head + (String(path).startsWith('/') ? path : '/' + path)
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    if (qs) url += (url.includes('?') ? '&' : '?') + qs
  }
  return url
}

/**
 * wx.request 的 Promise 化 + 与 axios 实例同签名的 shim。
 * 让 shared/api.js 的三个参数工厂零改动直接复用（get/post/put/patch + { params, data, headers }）。
 * signal 参数接受但忽略：取消语义由 usePagedList 的 seq 守卫承担（spec D12）。
 * @param {Object} [o]
 * @param {string} [o.baseURL] 缺省取 env.API_BASE_URL，再兜底本地
 * @param {number} [o.timeout] 缺省取 env.TIMEOUT（10000）
 * @param {Function} [o.getToken] () => string
 * @param {Function} [o.onUnauthorized] 401 回调
 * @param {Function} [o.onError] (message) => void
 */
export function createWxRequest(o = {}) {
  const baseURL = o.baseURL || env.API_BASE_URL || 'http://localhost:8080/api'
  const timeout = o.timeout || env.TIMEOUT || 10000
  const { getToken, onUnauthorized, onError } = o

  function send(method, path, opt) {
    opt = opt || {}
    const header = Object.assign({ 'content-type': 'application/json' }, opt.headers || {})
    const token = getToken && getToken()
    if (token) header.Authorization = 'Bearer ' + token
    const url = buildUrl(baseURL, path, opt.params)
    return new Promise((resolve, reject) => {
      wx.request({
        url,
        method,
        header,
        timeout,
        data: opt.data,
        success: (res) => {
          const r = interpretResponse({ body: res.data })
          if (r.action === 'ok') return resolve(res.data)
          if (onError) onError(r.message)
          if (r.action === 'unauthorized' && onUnauthorized) onUnauthorized()
          reject(new Error(r.message))
        },
        fail: (err) => {
          const timed = err && /timeout/i.test(err.errMsg || '')
          const r = interpretResponse({ networkError: true, timeout: timed })
          if (r.action === 'unauthorized' && onUnauthorized) onUnauthorized()
          if (onError) onError(r.message)
          reject(err)
        }
      })
    })
  }

  return {
    get: (path, opt) => send('GET', path, opt),
    post: (path, data, opt) => send('POST', path, Object.assign({ data }, opt)),
    put: (path, data, opt) => send('PUT', path, Object.assign({ data }, opt)),
    patch: (path, data, opt) => send('PATCH', path, Object.assign({ data }, opt)),
    // delete 是 JS 保留字，暴露为 del
    del: (path, opt) => send('DELETE', path, opt)
  }
}
