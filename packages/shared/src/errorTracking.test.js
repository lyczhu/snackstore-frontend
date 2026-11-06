import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * errorTracking 单测。
 *
 * 模块持有 reporter 注入态与内置通道限流态，故每个用例重新 import 一次，
 * 保证用例之间互不影响。
 */
async function load() {
  vi.resetModules()
  return await import('./errorTracking.js')
}

let consoleError
let consoleWarn

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('开发环境', () => {
  it('DEV 下只 console.error，不产生任何网络请求', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_ERROR_REPORT_URL', 'https://monitor.example.com/errors')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { reportError } = await load()
    reportError(new Error('boom'), { type: 'vue' })

    expect(consoleError).toHaveBeenCalledWith('[error-tracking]', expect.any(Error), {
      type: 'vue'
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('DEV 下若已注入 reporter，仍然完全接管（保持改造前契约）', async () => {
    vi.stubEnv('DEV', true)

    const { configureErrorTracking, reportError } = await load()
    const reporter = vi.fn()
    configureErrorTracking({ reporter })
    reportError(new Error('boom'), { type: 'vue' })

    expect(reporter).toHaveBeenCalledTimes(1)
    expect(consoleError).not.toHaveBeenCalled()
  })
})

describe('上报通道优先级', () => {
  it('configureErrorTracking 注入的 reporter 优先于内置 beacon 通道', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_ERROR_REPORT_URL', 'https://monitor.example.com/errors')
    const fetchSpy = vi.fn().mockResolvedValue({})
    vi.stubGlobal('fetch', fetchSpy)

    const { configureErrorTracking, reportError } = await load()
    const reporter = vi.fn()
    configureErrorTracking({ reporter })
    reportError(new Error('boom'), { type: 'vue', info: 'render' })

    expect(reporter).toHaveBeenCalledWith(expect.any(Error), { type: 'vue', info: 'render' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('非 DEV 且未注入 reporter 时，走内置通道 POST 到 VITE_ERROR_REPORT_URL', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_ERROR_REPORT_URL', 'https://monitor.example.com/errors')
    const fetchSpy = vi.fn().mockResolvedValue({})
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('navigator', { userAgent: 'test-ua' }) // 无 sendBeacon → 回落 fetch

    const { reportError } = await load()
    reportError(new Error('网络崩了'), { type: 'unhandledrejection' })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://monitor.example.com/errors')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    const payload = JSON.parse(init.body)
    expect(payload).toMatchObject({
      message: '网络崩了',
      type: 'unhandledrejection',
      ua: 'test-ua'
    })
  })

  it('navigator.sendBeacon 可用时优先使用 sendBeacon', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_ERROR_REPORT_URL', 'https://monitor.example.com/errors')
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { sendBeacon, userAgent: 'test-ua' })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { reportError } = await load()
    reportError('裸字符串错误', { type: 'error', filename: 'a.js', lineno: 3 })

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(fetchSpy).not.toHaveBeenCalled()
    const [url, blob] = sendBeacon.mock.calls[0]
    expect(url).toBe('https://monitor.example.com/errors')
    const payload = JSON.parse(await blob.text())
    expect(payload).toMatchObject({ message: '裸字符串错误', filename: 'a.js', lineno: 3 })
  })

  it('两者都没配置时不静默丢弃：console.error + 首次一次性告警', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_ERROR_REPORT_URL', '')

    const { reportError } = await load()
    reportError(new Error('a'), { type: 'vue' })
    reportError(new Error('b'), { type: 'vue' })

    expect(consoleError).toHaveBeenCalledTimes(2)
    expect(consoleWarn).toHaveBeenCalledTimes(1)
  })
})

describe('内置通道限流', () => {
  it('同一 type + message 只上报一次', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_ERROR_REPORT_URL', 'https://monitor.example.com/errors')
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { sendBeacon })

    const { reportError } = await load()
    reportError(new Error('重复'), { type: 'error' })
    reportError(new Error('重复'), { type: 'error' })
    reportError(new Error('重复'), { type: 'vue' }) // type 不同视为不同错误

    expect(sendBeacon).toHaveBeenCalledTimes(2)
  })

  it('上报总量封顶 20 条，超出后丢弃', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_ERROR_REPORT_URL', 'https://monitor.example.com/errors')
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { sendBeacon })

    const { reportError } = await load()
    for (let i = 0; i < 30; i++) reportError(new Error(`错误 ${i}`), { type: 'error' })

    expect(sendBeacon).toHaveBeenCalledTimes(20)
  })

  it('上报端点抛异常时不影响调用方', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_ERROR_REPORT_URL', 'https://monitor.example.com/errors')
    vi.stubGlobal('navigator', {
      sendBeacon: () => {
        throw new Error('beacon 挂了')
      }
    })

    const { reportError } = await load()
    expect(() => reportError(new Error('x'), { type: 'error' })).not.toThrow()
  })
})

describe('setupErrorTracking', () => {
  it('window 不存在时直接返回（SSR / 测试环境安全）', async () => {
    vi.stubGlobal('window', undefined)
    const { setupErrorTracking } = await load()
    expect(() => setupErrorTracking()).not.toThrow()
  })

  it('注册 error 与 unhandledrejection 监听并转交上报通道', async () => {
    vi.stubEnv('DEV', false)
    const listeners = {}
    vi.stubGlobal('window', {
      addEventListener: (type, handler) => {
        listeners[type] = handler
      }
    })

    const { configureErrorTracking, setupErrorTracking } = await load()
    const reporter = vi.fn()
    configureErrorTracking({ reporter })
    setupErrorTracking()

    listeners.error({ error: new Error('E1'), filename: 'a.js', lineno: 7 })
    listeners.unhandledrejection({ reason: new Error('E2') })

    expect(reporter).toHaveBeenNthCalledWith(1, expect.any(Error), {
      type: 'error',
      filename: 'a.js',
      lineno: 7
    })
    expect(reporter).toHaveBeenNthCalledWith(2, expect.any(Error), {
      type: 'unhandledrejection'
    })
  })
})
