import { API_SUCCESS_CODE } from './constants.js'

/**
 * 统一响应判定（纯函数，不依赖任何传输层）——
 * H5/admin 的 axios 拦截器与小程序的 wx.request 适配层共用，
 * 保证「业务成功码 / 401 / 403 / 500 / 网络错误 / 非法响应」的分支与文案只有一份。
 *
 * 单独成文件（不含 axios）以便小程序侧可只复用纯逻辑、不引入浏览器依赖。
 *
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
