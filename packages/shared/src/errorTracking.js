/**
 * 轻量前端错误上报。
 *
 * 配合构建产物生成的 hidden sourcemap 使用：线上报错时把「错误栈 + 对应 sourcemap」
 * 上传到监控平台即可还原源码位置（这也是 hidden sourcemap 存在的意义）。
 *
 * 默认仅在开发环境 console.error 输出；生产环境通过 configureErrorTracking
 * 注入真实上报函数（Sentry / 自建监控等）即可启用，无需改动业务代码。
 *
 * @typedef {Object} ErrorContext
 * @property {'error'|'unhandledrejection'|'vue'} [type]
 * @property {string} [info]   Vue 错误额外信息（组件 + 生命周期钩子）
 */

let reporter = (error, context) => {
  if (import.meta.env?.DEV) {
    console.error('[error-tracking]', error, context)
  }
}

/**
 * 注入真实上报实现（生产环境调用一次即可）。
 * @param {{ reporter?: (error: unknown, context: ErrorContext) => void }} options
 */
export function configureErrorTracking(options = {}) {
  if (typeof options.reporter === 'function') {
    reporter = options.reporter
  }
}

/** 上报一条错误（业务代码亦可主动调用）。 */
export function reportError(error, context = {}) {
  reporter(error, context)
}

/** 注册全局错误监听（window error / unhandledrejection）。 */
export function setupErrorTracking() {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (event) => {
    reporter(event.error || event.message, {
      type: 'error',
      filename: event.filename,
      lineno: event.lineno
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    reporter(event.reason, { type: 'unhandledrejection' })
  })
}
