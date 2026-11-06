/**
 * 轻量前端错误上报。
 *
 * 配合构建产物生成的 hidden sourcemap 使用：线上报错时把「错误栈 + 对应 sourcemap」
 * 上传到监控平台即可还原源码位置（这也是 hidden sourcemap 存在的意义）。
 *
 * 上报通道按优先级四选一：
 * 1. `configureErrorTracking({ reporter })` 注入的实现（Sentry / 自建监控 SDK 等）——
 *    注入即完全接管，DEV / PROD 均生效（与改造前一致）
 * 2. 开发环境（`import.meta.env.DEV`）→ 仅 `console.error`，不产生网络请求，
 *    避免本地调试污染监控数据
 * 3. 生产环境且配置了 `VITE_ERROR_REPORT_URL` → 内置 beacon 通道，POST JSON 到该端点
 * 4. 以上都不满足 → `console.error`，并在首次调用时告警一次「线上错误无法回收」
 *
 * 改造前第 4 种情况在生产环境是完全静默的（错误直接被丢弃），这会让
 * “配了 hidden sourcemap 却从没见过上报数据” 的问题无从发现。
 *
 * @typedef {Object} ErrorContext
 * @property {'error'|'unhandledrejection'|'vue'} [type]
 * @property {string} [info]      Vue 错误额外信息（组件 + 生命周期钩子）
 * @property {string} [filename]  window error 的脚本地址
 * @property {number} [lineno]    行号
 */

// 内置通道的限流状态：同一错误只发一次，总量封顶，防止错误风暴打爆上报端点
const state = { seen: new Set(), sent: 0, warned: false }

const MAX_SEEN_KEYS = 50
const MAX_SENDS = 20
const MAX_MESSAGE_LENGTH = 500

/** 组装上报体（纯数据，可 JSON 序列化）。 */
function toPayload(error, context) {
  const raw = error && error.message ? error.message : String(error)
  return {
    message: raw.slice(0, MAX_MESSAGE_LENGTH),
    stack: error && error.stack ? String(error.stack).slice(0, 2000) : undefined,
    type: context.type,
    info: context.info,
    filename: context.filename,
    lineno: context.lineno,
    url: typeof location !== 'undefined' ? location.href : undefined,
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    ts: Date.now()
  }
}

/** 内置 beacon 通道：sendBeacon 优先（页面卸载时仍能送出），否则 fetch keepalive。 */
function sendReport(endpoint, error, context) {
  if (state.sent >= MAX_SENDS) return
  const payload = toPayload(error, context)
  const key = `${payload.type}|${payload.message}`
  if (state.seen.has(key)) return
  if (state.seen.size >= MAX_SEEN_KEYS) state.seen.clear()
  state.seen.add(key)
  state.sent += 1

  const body = JSON.stringify(payload)
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))
      return
    }
    if (typeof fetch === 'function') {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {
        /* 上报自身失败不再二次上报 */
      })
    }
  } catch {
    /* 上报通道异常不能影响业务 */
  }
}

let reporter = null

/**
 * 注入真实上报实现（生产环境调用一次即可，优先级高于内置通道）。
 * 同时重置内置通道的限流状态。
 * @param {{ reporter?: (error: unknown, context: ErrorContext) => void }} options
 */
export function configureErrorTracking(options = {}) {
  if (typeof options.reporter === 'function') {
    reporter = options.reporter
    resetErrorTracking()
  }
}

/** 重置内置通道的去重与限流状态（测试或需要重新计数时调用）。 */
export function resetErrorTracking() {
  state.seen.clear()
  state.sent = 0
  state.warned = false
}

/** 上报一条错误（业务代码亦可主动调用）。 */
export function reportError(error, context = {}) {
  // 注入的实现完全接管，不再叠加内置通道
  if (reporter) {
    reporter(error, context)
    return
  }
  if (import.meta.env?.DEV) {
    console.error('[error-tracking]', error, context)
    return
  }
  const endpoint = import.meta.env?.VITE_ERROR_REPORT_URL
  if (endpoint) {
    sendReport(endpoint, error, context)
    return
  }
  // 生产环境未配置任何上报通道：保留 console 输出并显式告警一次，不再静默丢弃
  console.error('[error-tracking]', error, context)
  if (!state.warned) {
    state.warned = true
    console.warn(
      '[error-tracking] 未配置上报通道（VITE_ERROR_REPORT_URL 或 configureErrorTracking），' +
        '线上错误仅落在用户控制台，无法回收定位。'
    )
  }
}

/** 注册全局错误监听（window error / unhandledrejection）。 */
export function setupErrorTracking() {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (event) => {
    reportError(event.error || event.message, {
      type: 'error',
      filename: event.filename,
      lineno: event.lineno
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, { type: 'unhandledrejection' })
  })
}
