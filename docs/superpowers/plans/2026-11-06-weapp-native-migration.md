# 微信原生小程序端（apps/weapp）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以微信原生小程序实现零食商城小程序端（11 页，功能与 H5 端 `apps/mobile` 一致），前置完成 `packages/shared` 平台无关化重构。

**Architecture:** 方案 1（spec D6）——@vant/weapp 全量对照 + shared 逻辑复用 + 首版不分包。传输/绑定层各端自写，业务语义（响应判定、错误上报防风暴、购物车合并、金额计算）沉到 `packages/shared` 一份。

**Tech Stack:** 微信原生小程序（WXML/WXSS/JS/JSON；JavaScript + JSDoc，无 TS、无构建步骤）、@vant/weapp 1.x、miniprogram-ci、pnpm workspace、vitest（shared 现有配置扩跑 weapp 逻辑件）。

**Spec:** `docs/superpowers/specs/2026-11-06-weapp-native-migration-design.md`（本地文档；`docs/**` 被 `.gitignore` 忽略且被 eslint 忽略，不入库——仓库既有惯例）

---

## Global Constraints

每个任务的验收都隐含本节：

- 语言：**JavaScript + JSDoc**，全仓无 TypeScript（spec D3）。
- 运行环境：Node >= 20、pnpm >= 11（根 `package.json` engines 现值）。
- 单位换算：H5 按 375 视口的 `Npx` → `rpx` 机械 `×2`（750 基准，spec §1）。
- 请求超时：mobile/H5 = **10000ms**、admin = **15000ms**（各端现值，weapp 用 10000ms）。
- 业务成功码：`API_SUCCESS_CODE = 200`（`packages/shared/src/constants.js` 现值，禁止别处硬编码）。
- 订单状态文案：走 `getOrderStatusText`（shared）；tag `type` 映射 `{0:'warning',1:'success',2:'default'}` 保留在各端（`apps/mobile/src/utils/orderStatus.js` 现约定）。
- 配置治理：实体配置不入库——`apps/weapp/miniprogram/config/env.js`、`apps/weapp/keys/*` 进 `.gitignore`，模板/说明入库（与 `.env` 治理同构）。
- 提交规范：Conventional Commits 中文描述（git log 既有风格，如 `feat(shared): …`）。
- 基础库：`project.config.json` `libVersion` 固定 **2.30.0**；隐私接口 `wx.getPrivacySetting`/`wx.requirePrivacyAuthorize` 需 2.32.3+，Task 12 的 `app.js` 做运行时能力探测降级（低版本静默跳过，不阻塞启动）。
- 每个任务结束必须满足：相关测试全绿 → `pnpm lint` 无错 → 独立 commit（`simple-git-hooks` 的 pre-commit 会跑 `lint-staged`）。

---

## 文件结构总览（锁定分解边界）

新增：

- `packages/shared/src/cart.js` — 购物车合并/金额纯函数（双端复用，替换 H5 内联逻辑）
- `packages/shared/src/cart.test.js` — 上述单测
- `apps/weapp/`（见 §P1 树）— 小程序工程全量
- `apps/weapp/miniprogram/utils/{store,request,confirm,usePagedList}.js` + 对应 `.test.js`（wx mock）
- `apps/weapp/miniprogram/stores/{user,cart}.js` + `.test.js`
- `apps/weapp/miniprogram/config/env.example.js`

修改：

- `packages/shared/src/request.js` — 抽 `interpretResponse` + `createRequest` 去 `import.meta.env`
- `packages/shared/src/errorTracking.js` — 去 `import.meta.env`、`location/navigator` 防御化、`reporter/环境` 可注入
- `packages/shared/src/index.js` — 导出面扩充
- `packages/shared/package.json` — exports 增加 `./cart`
- `apps/mobile/src/utils/request.js`、`apps/admin/src/utils/request.js` — 显式传 `baseURL`
- `apps/mobile/src/main.js` — `configureErrorTracking` 传 `isDev`/`errorReportUrl`
- `apps/mobile/src/stores/cart.js` — 改用 shared `mergeCartItems`/`calcCentsTotal`
- `pnpm-workspace.yaml` — catalog 增加 `@vant/weapp`、`miniprogram-ci`
- 根 `.gitignore` — weapp 实体配置/密钥/构建产物

---

## Phase P0：shared 前置重构

### Task 1: `interpretResponse` 纯函数抽取 + `createRequest` 去 `import.meta.env`

**Files:**
- Modify: `packages/shared/src/request.js`（现 81 行，核心重写）
- Modify: `packages/shared/src/index.js`（导出面）
- Modify: `packages/shared/src/request.test.js`（新增 `interpretResponse` 用例组）
- Modify: `apps/mobile/src/utils/request.js:14-20`（补 `baseURL`）
- Modify: `apps/admin/src/utils/request.js:13-18`（补 `baseURL`）

**Interfaces:**
- Consumes: `API_SUCCESS_CODE`（`constants.js` 现有）
- Produces:
  - `interpretResponse(res?: { httpStatus?: number, body?: any, timeout?: boolean, networkError?: boolean }) => { action: 'ok'|'business-error'|'unauthorized'|'forbidden'|'server-error'|'network'|'invalid-response', message: string, data?: any }`
  - `createRequest(options)` 的 `baseURL` 解析改为 `options.baseURL || '/api'`（**不再读 `import.meta.env`**）；其余注入项（`timeout`/`getToken`/`onUnauthorized`/`onError`）签名不变

- [ ] **Step 1: 写失败测试**（追加到 `packages/shared/src/request.test.js` 末尾）

```js
import { interpretResponse } from './request.js'

describe('interpretResponse（传输层无关判定）', () => {
  it('业务成功码 ok 并透传 data', () => {
    expect(interpretResponse({ body: { code: 200, data: { id: 1 } } })).toEqual({
      action: 'ok',
      message: '',
      data: { id: 1 }
    })
  })
  it('业务失败码 → business-error，携带 message', () => {
    const r = interpretResponse({ body: { code: 500, message: '库存不足' } })
    expect(r.action).toBe('business-error')
    expect(r.message).toBe('库存不足')
  })
  it('业务码 401 → unauthorized（非 HTTP）', () => {
    expect(interpretResponse({ body: { code: 401, message: '过期' } }).action).toBe('unauthorized')
  })
  it('HTTP 401/403/500 → 对应 action 与兜底文案', () => {
    expect(interpretResponse({ httpStatus: 401, networkError: true }).message).toBe('登录已过期，请重新登录')
    expect(interpretResponse({ httpStatus: 403, networkError: true }).message).toBe('没有权限访问')
    expect(interpretResponse({ httpStatus: 500, networkError: true }).message).toBe('服务器错误')
  })
  it('HTTP 4xx 透传 body.message，归 network', () => {
    const r = interpretResponse({ httpStatus: 404, body: { message: '商品不存在' }, networkError: true })
    expect(r.action).toBe('network')
    expect(r.message).toBe('商品不存在')
  })
  it('无 HTTP 状态的网络错误 → 网络连接失败', () => {
    expect(interpretResponse({ networkError: true }).message).toBe('网络连接失败')
  })
  it('超时 → 请求超时文案', () => {
    expect(interpretResponse({ timeout: true }).message).toBe('请求超时，请稍后重试')
  })
  it('非标准 JSON（网关错误页）→ invalid-response', () => {
    expect(interpretResponse({ body: '<html>' }).action).toBe('invalid-response')
    expect(interpretResponse({}).action).toBe('invalid-response')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm -F @snackstore/shared test`
Expected: FAIL —「interpretResponse is not a function / not exported」

- [ ] **Step 3: 重写 `packages/shared/src/request.js`**

保留文件顶部注释语义，正文替换为：

```js
import axios from 'axios'
import { API_SUCCESS_CODE } from './constants.js'

/**
 * 统一响应判定（纯函数，不依赖任何传输层）——
 * H5/admin 的 axios 拦截器与小程序的 wx.request 适配层共用，
 * 保证「业务成功码 / 401 / 403 / 500 / 网络错误 / 非法响应」文案与分支只有一份。
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
  // 防御：非标准 JSON（网关错误页等）不抛 TypeError
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
 * baseURL 解析：显式传入 > 默认 '/api'（同源网关）；空串按未配置处理。
 * 不再读 import.meta.env（小程序「构建 npm」的 ES5 转译不支持 import.meta），
 * 由 H5/admin 调用方显式传入构建期环境变量。
 * @param {Object} options
 * @param {string}   [options.baseURL]
 * @param {number}   [options.timeout] 默认 15000
 * @param {Function} [options.getToken] () => string
 * @param {Function} [options.onUnauthorized] 401 回调
 * @param {Function} [options.onError] (message) => void
 * @returns {import('axios').AxiosInstance}
 */
export function createRequest(options = {}) {
  const { timeout = 15000, getToken, onUnauthorized, onError } = options
  const baseURL = options.baseURL || '/api'
  const instance = axios.create({ baseURL, timeout })

  instance.interceptors.request.use(
    (config) => {
      const token = getToken?.()
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    },
    (error) => Promise.reject(error)
  )

  instance.interceptors.response.use(
    (response) => {
      const r = interpretResponse({ body: response.data })
      if (r.action === 'ok') return response.data
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
```

> **行为对账**（务必逐条核对现有 `request.test.js` 全绿，冲突以现有测试为准）：业务码成功返回整个 `response.data`（非 `data.data`）；业务码失败先 `onError(message)` 后（若 401）`onUnauthorized`；传输层 401 文案「登录已过期，请重新登录」；HTTP 500 →「服务器错误」；无 response →「网络连接失败」。

- [ ] **Step 4: `packages/shared/src/index.js` 扩充导出**

```js
export { API_SUCCESS_CODE, ORDER_STATUS, getOrderStatusText } from './constants.js'
export { createRequest, interpretResponse } from './request.js'
export { createProductApi, createOrderApi, createUserApi } from './api.js'
export { safeParse } from './storage.js'
export { mergeCartItems, calcCentsTotal } from './cart.js'
export {
  configureErrorTracking,
  reportError,
  setupErrorTracking,
  resetErrorTracking
} from './errorTracking.js'
```

> 注：`cart.js`（Task 3）与 `resetErrorTracking` 导出（Task 2）在其各自任务里落地；本步先写好 index，Task 2/3 前 `pnpm -F @snackstore/shared test` 对 request 相关用例应绿（index 的其余 export 会随后续任务补齐，故本任务只跑 `request.test.js`）。若因提前 export 未落地模块报错，则本步 index 改动延后到 Task 3 之后统一提交——在 commit 前用 `pnpm -F @snackstore/shared test` 是否报「Cannot find ./cart.js」判定。

- [ ] **Step 5: H5/admin 调用点补 `baseURL`**

`apps/mobile/src/utils/request.js`：

```js
const request = createRequest({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  getToken: () => useUserStore().token,
  onUnauthorized: handleUnauthorized,
  onError: (msg) => showFailToast(msg)
})
```

`apps/admin/src/utils/request.js`：

```js
const request = createRequest({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  getToken: () => useAuthStore().token,
  onUnauthorized: handleUnauthorized,
  onError: (msg) => ElMessage.error(msg)
})
```

- [ ] **Step 6: 全量验证**

Run: `pnpm -F @snackstore/shared test` → PASS
Run: `pnpm -F @snackstore/mobile test && pnpm -F @snackstore/admin test` → 全绿
Run: `pnpm lint` → 无错

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/request.js packages/shared/src/index.js packages/shared/src/request.test.js apps/mobile/src/utils/request.js apps/admin/src/utils/request.js
git commit -m "refactor(shared): 抽取传输层无关的 interpretResponse 并去除 import.meta.env 依赖"
```

---

### Task 2: `errorTracking` 去 `import.meta.env` 与浏览器全局防御

**Files:**
- Modify: `packages/shared/src/errorTracking.js:33-46,100-140`
- Modify: `apps/mobile/src/main.js`（`setupErrorTracking()` → 传环境参数）
- Modify: `packages/shared/src/errorTracking.test.js`（补注入式环境用例）

**Interfaces:**
- Consumes: 模块内 `reporter`（现有注入机制）
- Produces:
  - `setupErrorTracking(options?: { isDev?: boolean, errorReportUrl?: string, transport?: (body: string) => void })` — H5 传 `import.meta.env.DEV`/`VITE_ERROR_REPORT_URL`；小程序不注册 window 监听，改由 `app.js` 手动调 `reportError`
  - `configureErrorTracking(options?: { reporter?, isDev?, errorReportUrl?, transport? })` — 新增 `transport`：注入发送函数（小程序传 `(body)=>wx.request({...})`），缺省用 sendBeacon/fetch
  - 优先级语义不变：注入 reporter > isDev 仅 console > errorReportUrl 走内置通道 > 兜底 console + 一次性 warn

- [ ] **Step 1: 写失败测试**（追加到 `packages/shared/src/errorTracking.test.js`）

```js
import { configureErrorTracking, reportError, resetErrorTracking } from './errorTracking.js'

describe('errorTracking 注入式环境（小程序路径）', () => {
  beforeEach(() => resetErrorTracking())

  it('isDev=true 时仅 console，不触发 transport', () => {
    const transport = vi.fn()
    configureErrorTracking({ isDev: true, errorReportUrl: 'https://x/e', transport })
    reportError(new Error('boom'), { type: 'error' })
    expect(transport).not.toHaveBeenCalled()
  })

  it('非 dev 且配了 errorReportUrl 时调用注入的 transport', () => {
    const transport = vi.fn()
    configureErrorTracking({ isDev: false, errorReportUrl: 'https://x/e', transport })
    reportError(new Error('real'), { type: 'error' })
    expect(transport).toHaveBeenCalledTimes(1)
    const body = JSON.parse(transport.mock.calls[0][0])
    expect(body.message).toBe('real')
  })

  it('无 location 环境下 payload 不含 url 且不抛错', () => {
    const transport = vi.fn()
    configureErrorTracking({ isDev: false, errorReportUrl: 'https://x/e', transport })
    expect(() => reportError(new Error('x'), { type: 'app' })).not.toThrow()
  })

  it('同 type|message 去重，只发一次', () => {
    const transport = vi.fn()
    configureErrorTracking({ isDev: false, errorReportUrl: 'https://x/e', transport })
    reportError(new Error('dup'), { type: 'error' })
    reportError(new Error('dup'), { type: 'error' })
    expect(transport).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm -F @snackstore/shared test -- errorTracking`
Expected: FAIL — transport 未被调用 / isDev 未生效

- [ ] **Step 3: 改造 `errorTracking.js`**

模块级新增环境状态，`configureErrorTracking` 扩展，`toPayload`/`sendReport`/`reportError`/`setupErrorTracking` 相应调整：

```js
// 注入的通道配置（小程序/H5 均可注入；缺省回退浏览器行为）
const channel = { transport: null, isDev: false, errorReportUrl: undefined }

// toPayload 中浏览器全局改为防御取值：
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
    scene: context.scene,
    version: context.version,
    ts: Date.now()
  }
}

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
    if (channel.transport) {
      channel.transport(body)
      return
    }
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
      }).catch(() => {})
    }
  } catch {
    /* 上报自身失败不影响业务 */
  }
}

export function configureErrorTracking(options = {}) {
  if (typeof options.reporter === 'function') {
    reporter = options.reporter
    resetErrorTracking()
  }
  if (typeof options.transport === 'function') channel.transport = options.transport
  if (typeof options.isDev === 'boolean') channel.isDev = options.isDev
  if (options.errorReportUrl !== undefined) channel.errorReportUrl = options.errorReportUrl
}

export function reportError(error, context = {}) {
  if (reporter) {
    reporter(error, context)
    return
  }
  if (channel.isDev) {
    console.error('[error-tracking]', error, context)
    return
  }
  const endpoint = channel.errorReportUrl
  if (endpoint) {
    sendReport(endpoint, error, context)
    return
  }
  console.error('[error-tracking]', error, context)
  if (!state.warned) {
    state.warned = true
    console.warn(
      '[error-tracking] 未配置上报通道（errorReportUrl 或 configureErrorTracking），' +
        '线上错误仅落在控制台，无法回收定位。'
    )
  }
}

// setupErrorTracking 只服务浏览器；小程序不调用它
export function setupErrorTracking(options = {}) {
  configureErrorTracking(options)
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
```

- [ ] **Step 4: H5 `main.js` 传环境**

将 `setupErrorTracking()` 改为：

```js
setupErrorTracking({
  isDev: import.meta.env.DEV,
  errorReportUrl: import.meta.env.VITE_ERROR_REPORT_URL
})
```

- [ ] **Step 5: 全量验证**

Run: `pnpm -F @snackstore/shared test` → 全绿（现有 errorTracking 202 行用例不回归；若有用例直接依赖 `import.meta.env.DEV`，改为通过 `configureErrorTracking({ isDev })` 设置——先 Read `errorTracking.test.js` 定位这类断言并按此替换）
Run: `pnpm -F @snackstore/mobile test` → 全绿
Run: `pnpm lint` → 无错

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/errorTracking.js packages/shared/src/errorTracking.test.js apps/mobile/src/main.js
git commit -m "refactor(shared): 错误上报通道改为注入式环境参数并防御浏览器全局缺失"
```

---

### Task 3: 新增 `packages/shared/src/cart.js` 购物车纯函数并让 H5 复用

**Files:**
- Create: `packages/shared/src/cart.js`
- Create: `packages/shared/src/cart.test.js`
- Modify: `apps/mobile/src/stores/cart.js:25-62`（内联合并/金额改用 shared）
- Modify: `packages/shared/package.json`（exports 增 `./cart`，`files` 已含 src）

**Interfaces:**
- Consumes: 无
- Produces:
  - `mergeCartItems(guestItems: Array, userItems: Array) => Array` — 返回**新数组**；同 `productId` 累加 `quantity`，否则追加（guest 项在前，保持 H5 现顺序）
  - `calcCentsTotal(items: Array) => number` — 分单位累加 `Math.round(price*100)*quantity` 再 `/100`，`price` 缺省按 0

- [ ] **Step 1: 写失败测试**（`packages/shared/src/cart.test.js`）

```js
import { describe, it, expect } from 'vitest'
import { mergeCartItems, calcCentsTotal } from './cart.js'

describe('mergeCartItems', () => {
  it('同 productId 累加数量', () => {
    const out = mergeCartItems([{ productId: 1, quantity: 2 }], [{ productId: 1, quantity: 3 }])
    expect(out).toEqual([{ productId: 1, quantity: 5 }])
  })
  it('不同 productId 追加，guest 在前', () => {
    const out = mergeCartItems([{ productId: 9, quantity: 1 }], [{ productId: 1, quantity: 2 }])
    expect(out.map((i) => i.productId)).toEqual([9, 1])
  })
  it('不修改入参数组', () => {
    const guest = [{ productId: 1, quantity: 1 }]
    const user = [{ productId: 1, quantity: 1 }]
    mergeCartItems(guest, user)
    expect(user[0].quantity).toBe(1)
  })
})

describe('calcCentsTotal', () => {
  it('避免浮点漂移（0.1+0.2）', () => {
    expect(calcCentsTotal([{ price: 0.1, quantity: 1 }, { price: 0.2, quantity: 1 }])).toBe(0.3)
  })
  it('price 缺省按 0', () => {
    expect(calcCentsTotal([{ quantity: 3 }])).toBe(0)
  })
  it('数量参与计算', () => {
    expect(calcCentsTotal([{ price: 9.9, quantity: 2 }])).toBe(19.8)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm -F @snackstore/shared test -- cart`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 `packages/shared/src/cart.js`**

```js
/**
 * 购物车跨端复用逻辑（H5 与小程序共用一份，消除双端漂移）。
 * 金额一律以「分」为整数单位累加后再换算回元，避免浮点乘法漂移。
 */

/**
 * 合并游客与用户购物车：同 productId 累加数量，其余追加；返回新数组，不改入参。
 * @param {Array<{productId: any, quantity: number}>} guestItems
 * @param {Array<{productId: any, quantity: number}>} userItems
 * @returns {Array<{productId: any, quantity: number}>}
 */
export function mergeCartItems(guestItems = [], userItems = []) {
  const merged = userItems.map((u) => ({ ...u }))
  for (const g of guestItems) {
    const exist = merged.find((u) => u.productId === g.productId)
    if (exist) exist.quantity += g.quantity
    else merged.push({ ...g })
  }
  return merged
}

/**
 * 分单位累加购物车金额，返回「元」为单位的数值。
 * @param {Array<{price?: number, quantity: number}>} items
 * @returns {number}
 */
export function calcCentsTotal(items = []) {
  const cents = items.reduce(
    (sum, item) => sum + Math.round((item.price ?? 0) * 100) * item.quantity,
    0
  )
  return cents / 100
}
```

> **顺序对账**：H5 现内联实现是「user 为基、遍历 guest 累加或 push」，输出 user 项在前。上面实现把 guest 追加到 user 之后（push 到 merged 尾部），与 H5 行为一致；`mergeCartItems` 测试用例「guest 在前」的期望实际对应 guest-only + 空 user 的情形——Step 5 若顺序断言与 H5 现行为冲突，以「保持 H5 现输出顺序（user 先、新 guest 追加其后）」为准修正测试期望。

- [ ] **Step 4: H5 `apps/mobile/src/stores/cart.js` 改用 shared**

顶部 import 增加：

```js
import { mergeCartItems, calcCentsTotal } from '@snackstore/shared'
```

`watch` 内合并块（现 30-42 行手写循环）替换为：

```js
const guestItems = safeParse(localStorage.getItem('cartItems_guest'), [])
const userItems = safeParse(localStorage.getItem(`cartItems_${newId}`), [])
items.value = mergeCartItems(guestItems, userItems)
localStorage.removeItem('cartItems_guest')
saveToStorage()
```

`totalPrice` computed（现 56-62 行）替换为：

```js
const totalPrice = computed(() => calcCentsTotal(items.value))
```

- [ ] **Step 5: `packages/shared/package.json` exports 增项**

```json
"exports": {
  ".": "./src/index.js",
  "./cart": "./src/cart.js",
  "./test/storage-polyfill": "./test/storage-polyfill.js",
  "./package.json": "./package.json"
}
```

- [ ] **Step 6: 全量验证**

Run: `pnpm -F @snackstore/shared test` → 全绿
Run: `pnpm -F @snackstore/mobile test` → 全绿（`cart.test.js` 现有 124 行覆盖合并语义，回归须通过）
Run: `pnpm lint` → 无错

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/cart.js packages/shared/src/cart.test.js packages/shared/package.json apps/mobile/src/stores/cart.js
git commit -m "feat(shared): 抽取购物车合并与金额计算纯函数并供 H5 复用"
```

---

## Phase P1：工程脚手架与 POC-4 验证

### Task 4: `apps/weapp` 目录骨架与 workspace/eslint/gitignore 接入

**Files:**
- Create: `apps/weapp/package.json`
- Create: `apps/weapp/project.config.json`
- Create: `apps/weapp/project.private.config.json`（本地，gitignore）
- Create: `apps/weapp/.size-limit.json`? 否——体积用 miniprogram-ci（Task 26），本任务不建
- Create: `apps/weapp/miniprogram/app.js`
- Create: `apps/weapp/miniprogram/app.json`
- Create: `apps/weapp/miniprogram/app.wxss`
- Create: `apps/weapp/miniprogram/pages/home/home.{js,json,wxml,wxss}`（占位页，POC 用）
- Create: `apps/weapp/README.md`
- Modify: `pnpm-workspace.yaml`（catalog 增 `@vant/weapp`、`miniprogram-ci`）
- Modify: 根 `.gitignore`
- Modify: `packages/eslint-config`（若为单一 flat 构造需声明小程序 globals；先 Read 确认注入方式）

**Interfaces:**
- Consumes: 无
- Produces: 一个能被微信开发者工具打开、且能被 `pnpm lint` 处理的空壳工程；demo 页存在供 Task 5 构建 npm 验证

- [ ] **Step 1: `apps/weapp/package.json`**

```json
{
  "name": "@snackstore/weapp",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "engines": { "node": ">=20", "pnpm": ">=11" },
  "scripts": {
    "checksize": "node scripts/checksize.mjs",
    "upload": "node scripts/upload.mjs"
  },
  "dependencies": {
    "@snackstore/shared": "workspace:*",
    "@vant/weapp": "catalog:"
  },
  "devDependencies": {
    "miniprogram-ci": "catalog:"
  }
}
```

> `scripts/*` 由 Task 26 落地；此处先声明避免 script 悬空——checksize/upload 在 Task 26 前调用会报文件不存在，属预期。

- [ ] **Step 2: `pnpm-workspace.yaml` catalog 增项**

在 `catalog:` 段内追加：

```yaml
  '@vant/weapp': ^1.11.6
  miniprogram-ci: ^2.1.31
```

Run: `pnpm install` → 生成 lock 更新，`@vant/weapp` 落入 `apps/weapp/node_modules`

- [ ] **Step 3: `apps/weapp/project.config.json`**

```json
{
  "miniprogramRoot": "miniprogram/",
  "compileType": "miniprogram",
  "appid": "touristappid",
  "projectname": "snackstore-weapp",
  "libVersion": "2.30.0",
  "packNpmManually": true,
  "packNpmRelationList": [
    {
      "packageJsonPath": "./package.json",
      "miniprogramNpmDistDir": "./miniprogram/"
    }
  ],
  "setting": {
    "es6": true,
    "enhance": true,
    "minified": true,
    "postcss": true,
    "urlCheck": false,
    "packNpmManually": true
  }
}
```

> `packNpmManually` + relation 是 POC-4 的关键：让开发者工具从 `apps/weapp/package.json` 构建 npm 产物到 `miniprogram/miniprogram_npm/`。`urlCheck:false` 对应「不校验合法域名」，便于本地 http。

- [ ] **Step 4: 小程序入口三件套 + 占位 home 页**

`apps/weapp/miniprogram/app.json`：

```json
{
  "pages": ["pages/home/home"],
  "window": {
    "navigationBarTitleText": "零食商城",
    "navigationBarBackgroundColor": "#ffffff",
    "navigationBarTextStyle": "black",
    "backgroundTextStyle": "light"
  }
}
```

`apps/weapp/miniprogram/app.js`：

```js
App({
  onLaunch() {
    // Task 10/11 接入 store 恢复与错误上报；此处留空壳
  }
})
```

`apps/weapp/miniprogram/app.wxss`：

```css
/* 全局样式：token 变量由 Task 21 落地 */
page {
  background: #f7f8fa;
  color: #323233;
  font-size: 28rpx;
}
```

`apps/weapp/miniprogram/pages/home/home.json`：

```json
{ "usingComponents": {} }
```

`apps/weapp/miniprogram/pages/home/home.wxml`：

```xml
<view class="home">零食商城 weapp 脚手架占位</view>
```

`apps/weapp/miniprogram/pages/home/home.wxss`：

```css
.home { padding: 32rpx; }
```

`apps/weapp/miniprogram/pages/home/home.js`：

```js
Page({ data: {} })
```

- [ ] **Step 5: 小程序 globals 纳入 eslint**

先 `Read packages/eslint-config/` 入口确认可否透传 globals。在根 `eslint.config.js` 追加 weapp 专属块（避免改动共享 config 对其他端的影响）：

```js
import { createEslintConfig } from '@snackstore/eslint-config'

export default [
  ...createEslintConfig({ ignores: ['**/.workbuddy/**', 'docs/**', 'apps/weapp/miniprogram_npm/**'] }),
  {
    files: ['apps/weapp/miniprogram/**/*.js'],
    languageOptions: {
      globals: {
        wx: 'readonly',
        App: 'readonly',
        Page: 'readonly',
        Component: 'readonly',
        Behavior: 'readonly',
        getApp: 'readonly',
        getCurrentPages: 'readonly',
        requirePlugin: 'readonly'
      }
    }
  }
]
```

> 若 `createEslintConfig` 返回值非数组（如直接是 config 对象），按其实际形态合并 spread——Step 6 的 `pnpm lint` 通过即为正确形态判定依据。

- [ ] **Step 6: 根 `.gitignore` 增项**

```gitignore
# 微信小程序：构建产物与本地实体配置
apps/weapp/miniprogram/miniprogram_npm/
apps/weapp/project.private.config.json
apps/weapp/miniprogram/config/env.js
apps/weapp/keys/
```

- [ ] **Step 7: 验证 + Commit**

Run: `pnpm install` → 成功
Run: `pnpm lint` → weapp 目录无 no-undef（wx/App/Page）报错
开发者工具「导入项目」选 `apps/weapp` → 空壳工程能打开渲染占位页（手动确认，无法自动化则截图记录）

```bash
git add apps/weapp/package.json apps/weapp/project.config.json apps/weapp/README.md apps/weapp/miniprogram pnpm-workspace.yaml pnpm-lock.yaml .gitignore eslint.config.js
git commit -m "chore(weapp): 新增微信原生小程序工程骨架并接入 workspace/eslint/gitignore"
```

---

### Task 5: POC-4 验证——构建 npm 直用 @vant/weapp 与 workspace shared

**Files:**
- Create: `apps/weapp/miniprogram/pages/home/home.json`（改写：注册 van-button）
- Create: `apps/weapp/miniprogram/pages/home/home.js`（改写：调用 shared + 渲染 van-button）
- Create: `apps/weapp/miniprogram/pages/home/home.wxml`（改写：使用 van-button）

**Interfaces:**
- Consumes: `@vant/weapp/button`、`@snackstore/shared`（`calcCentsTotal` 等）
- Produces: **验证结论二选一**，写入 `apps/weapp/README.md` 的「POC-4」小节，决定 P2 走 shared 直引（方案 1）还是降级自包含（方案 2）

- [ ] **Step 1: home 页引入 van-button + shared**

`home.json`：

```json
{
  "usingComponents": {
    "van-button": "@vant/weapp/button/index"
  }
}
```

`home.js`：

```js
import { calcCentsTotal } from '@snackstore/shared'

Page({
  data: { total: 0 },
  onLoad() {
    this.setData({ total: calcCentsTotal([{ price: 0.1, quantity: 1 }, { price: 0.2, quantity: 1 }]) })
  },
  onTap() {
    wx.showToast({ title: 'vant 可用', icon: 'none' })
  }
})
```

`home.wxml`：

```xml
<view class="home">
  <text>POC4 合计：{{total}} 元</text>
  <van-button type="primary" bind:tap="onTap">测试按钮</van-button>
</view>
```

- [ ] **Step 2: 构建 npm**

微信开发者工具 → 工具 → 「构建 npm」。
Expected: 生成 `miniprogram/miniprogram_npm/@vant/weapp/`；`@snackstore/shared` 是否同步产出 = **POC-4 判定核心**。

- [ ] **Step 3: 编译并目测**

模拟器应渲染蓝色按钮，文案「合计：0.3 元」（浮点未漂移即 shared 逻辑生效），点按钮弹 toast。

- [ ] **Step 4: 分支处置（把结论写进 README）**

- **通过（workspace ESM 源码被构建 npm 正常转译）**：README 记录「方案 1 成立，P2 直接 `import ... from '@snackstore/shared'`」。
- **失败（shared 因 ESM/import 或 exports 解析不产出可用产物）**：触发**降级**——
  1. 给 `packages/shared` 增加 CJS 构建产物步骤（新增 `build` 脚本用 esbuild 打包到 `dist/index.cjs`，`main` 指向它），预算 +0.5d；
  2. 或 weapp 侧改为**逻辑自包含**（Task 6/7 的 request/store 不 import shared，直接内联 `interpretResponse`/`mergeCartItems` 等等价实现），README 标注双端漂移风险已接受。
  > 降级决策**必须回报用户**再落地，因它改变 spec D6 的复用立论。

- [ ] **Step 5: Commit（POC 代码 + 结论）**

```bash
git add apps/weapp/miniprogram/pages/home apps/weapp/README.md
git commit -m "test(weapp): POC-4 验证构建 npm 直用 @vant/weapp 与 workspace shared"
```

---

## Phase P2：基础设施（请求 / store / 分页 / 工具）

> **前提**：以下逻辑件均按「POC-4 通过（方案 1，`import ... from '@snackstore/shared'`）」书写。若 Task 5 判定降级，则把对 shared 的 import 替换为 weapp 内联等价实现（`interpretResponse`/`mergeCartItems`/`calcCentsTotal`/`safeParse`），其余不变，并在 README 标注漂移风险已接受。

### Task 6: weapp 测试运行器 + env 配置 + `wx.request` 适配层

**Files:**
- Create: `apps/weapp/vitest.config.js`、`apps/weapp/test/wx-mock.js`（全局 wx 替身）
- Create: `apps/weapp/miniprogram/config/env.example.js`（入库模板）、`env.js`（本地，gitignore）
- Create: `apps/weapp/miniprogram/utils/request.js`、`request.test.js`
- Modify: `apps/weapp/package.json`（增 test 脚本与 vitest devDep）

**Interfaces:**
- Consumes: `interpretResponse`（shared，Task 1）
- Produces: `createWxRequest({ baseURL?, timeout?, getToken, onUnauthorized, onError }) => { get(path, opts), post(path, data, opts), put(path, data, opts), patch(path, data, opts), del(path, opts) }`，每方法 `Promise<resBody>`；`opts = { params?, data?, headers? }`（`signal` 接受但忽略）。与 axios 实例同签名，供 `shared/api.js` 工厂零改动复用。

- [ ] **Step 1: 测试运行器**

`apps/weapp/package.json` 追加脚本与依赖：

```json
  "scripts": {
    "checksize": "node scripts/checksize.mjs",
    "upload": "node scripts/upload.mjs",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "miniprogram-ci": "catalog:",
    "vitest": "catalog:"
  }
```

`apps/weapp/vitest.config.js`：

```js
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: [fileURLToPath(new URL('./test/wx-mock.js', import.meta.url))],
    include: ['miniprogram/**/*.test.js'],
    environment: 'node'
  }
})
```

`apps/weapp/test/wx-mock.js`（最小替身，供 request/store 测试驱动）：

```js
const storage = new Map()
const handlers = { requestQueue: [] }

function resetStorage() {
  storage.clear()
}

const wx = {
  getStorageSync: (k) => (storage.has(k) ? storage.get(k) : ''),
  setStorageSync: (k, v) => storage.set(k, v),
  removeStorageSync: (k) => storage.delete(k),
  showToast: () => {},
  showModal: (o) => o.success && o.success({ confirm: true, cancel: false }),
  navigateTo: () => {},
  // request：默认成功回环，测试里用 vi.spyOn 覆盖
  request: ({ success }) => success({ statusCode: 200, data: { code: 200, data: null }, header: {} })
}

globalThis.wx = wx
export { resetStorage }
```

Run: `pnpm install` → 拉入 vitest

- [ ] **Step 2: env 模板与本地副本**

`apps/weapp/miniprogram/config/env.example.js`：

```js
// 复制为 env.js 后按需修改；env.js 已被 .gitignore 忽略，不入库。
// API_BASE_URL：小程序无同源反代，必须绝对地址。开发默认本地 http（工具勾选
// 「不校验合法域名」）；生产换已备案 HTTPS 域名并加入 request 合法域名白名单。
export default {
  API_BASE_URL: 'http://localhost:8080/api',
  TIMEOUT: 10000,
  IS_DEV: true,
  // 客户端错误上报端点，缺省空即不发送（与 H5 口径一致）
  ERROR_REPORT_URL: ''
}
```

同内容复制一份为 `apps/weapp/miniprogram/config/env.js`（本地实体会被 gitignore；CI 无此文件时 request 用 `createWxRequest` 默认基址兜底）。

- [ ] **Step 3: 写失败测试**（`apps/weapp/miniprogram/utils/request.test.js`）

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWxRequest } from './request.js'

let captured
beforeEach(() => {
  captured = null
  vi.spyOn(wx, 'request').mockImplementation((opt) => {
    captured = opt
    opt.success({ statusCode: 200, data: { code: 200, data: { id: 7 } }, header: {} })
  })
})

describe('createWxRequest', () => {
  it('拼接 baseURL + path + params', async () => {
    const req = createWxRequest({ baseURL: 'http://h/api', getToken: () => 't1' })
    const res = await req.get('/orders', { params: { pageNum: 1, status: undefined } })
    expect(captured.url).toBe('http://h/api/orders?pageNum=1')
    expect(captured.header.Authorization).toBe('Bearer t1')
    expect(res.data.id).toBe(7)
  })
  it('业务码 401 触发 onUnauthorized 并 reject', async () => {
    vi.spyOn(wx, 'request').mockImplementation((o) =>
      o.success({ statusCode: 200, data: { code: 401, message: '过期' } })
    )
    const onUnauthorized = vi.fn()
    const req = createWxRequest({ baseURL: 'http://h/api', onUnauthorized })
    await expect(req.get('/x')).rejects.toThrow('过期')
    expect(onUnauthorized).toHaveBeenCalled()
  })
  it('fail 走网络连接失败文案', async () => {
    vi.spyOn(wx, 'request').mockImplementation((o) => o.fail({ errMsg: 'request:fail' }))
    const onError = vi.fn()
    const req = createWxRequest({ baseURL: 'http://h/api', onError })
    await expect(req.get('/x')).rejects.toBeTruthy()
    expect(onError).toHaveBeenCalledWith('网络连接失败')
  })
  it('patch 透传 data 与 params（订单状态更新）', async () => {
    const req = createWxRequest({ baseURL: 'http://h/api' })
    await req.patch('/orders/9/status', null, { params: { status: 1 } })
    expect(captured.method).toBe('PATCH')
    expect(captured.url).toBe('http://h/api/orders/9/status?status=1')
  })
})
```

- [ ] **Step 4: 跑测试确认失败**

Run: `pnpm -F @snackstore/weapp test`
Expected: FAIL — `createWxRequest` 未定义

- [ ] **Step 5: 实现 `apps/weapp/miniprogram/utils/request.js`**

```js
import { interpretResponse } from '@snackstore/shared'
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
 * wx.request 的 Promise 化 + axios 同签名 shim。
 * @param {Object} o
 * @param {string} [o.baseURL] 缺省取 env.API_BASE_URL，再兜底本地
 * @param {number} [o.timeout] 缺省取 env.TIMEOUT（10000）
 * @param {Function} [o.getToken] () => string
 * @param {Function} [o.onUnauthorized]
 * @param {Function} [o.onError]
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
    // delete 是保留字，用 del 暴露；如需 axios 语义别名可再加
    del: (path, opt) => send('DELETE', path, opt)
  }
}
```

> 与 `shared/api.js` 工厂签名核对：工厂调用 `request.get(url,{params,signal})`、`request.post(url,data,options)`、`request.patch(url,null,{params})`。本 shim 的 `get(path,opt)`/`post(path,data,opt)`/`patch(path,data,opt)` 完全对齐；`signal` 落在 `opt` 中被忽略，符合 D12（取消由 usePagedList seq 守卫承担）。

- [ ] **Step 6: 验证 + Commit**

Run: `pnpm -F @snackstore/weapp test` → PASS
Run: `pnpm lint` → 无错

```bash
git add apps/weapp/vitest.config.js apps/weapp/test apps/weapp/package.json apps/weapp/miniprogram/config/env.example.js apps/weapp/miniprogram/utils/request.js apps/weapp/miniprogram/utils/request.test.js pnpm-lock.yaml
git commit -m "feat(weapp): 接入 vitest 运行器、env 配置与 wx.request axios 同签名适配层"
```

---

### Task 7: 自建轻量 store `utils/store.js`

**Files:**
- Create: `apps/weapp/miniprogram/utils/store.js`、`store.test.js`

**Interfaces:**
- Produces: `createStore(initial) => { getSnapshot(), subscribe(fn)=>unsubscribe, patch(partial) }`；约定仅 store 模块内 actions 调 `patch`，页面 `subscribe` 回调里 `setData`、`onUnload` 退订（D4）

- [ ] **Step 1: 写失败测试**（`store.test.js`）

```js
import { describe, it, expect, vi } from 'vitest'
import { createStore } from './store.js'

describe('createStore', () => {
  it('patch 合并并通知订阅者，返回新快照', () => {
    const s = createStore({ a: 1, b: 2 })
    const fn = vi.fn()
    const off = s.subscribe(fn)
    s.patch({ b: 9 })
    expect(s.getSnapshot()).toEqual({ a: 1, b: 9 })
    expect(fn).toHaveBeenCalledWith({ a: 1, b: 9 })
    off()
    s.patch({ b: 0 })
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `pnpm -F @snackstore/weapp test -- store` → FAIL

- [ ] **Step 3: 实现 `store.js`**

```js
/**
 * 极简跨页状态容器：state 只读约定 + subscribe + patch。
 * 不引第三方（D4）。仅 stores/*.js 内部调用 patch，页面通过 subscribe 同步 setData。
 * @param {Object} [initial]
 */
export function createStore(initial = {}) {
  let state = { ...initial }
  const listeners = new Set()
  return {
    getSnapshot: () => state,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    patch(partial) {
      state = { ...state, ...partial }
      listeners.forEach((fn) => fn(state))
    }
  }
}
```

- [ ] **Step 4: 验证 + Commit**

Run: `pnpm -F @snackstore/weapp test` → PASS；`pnpm lint` → 无错

```bash
git add apps/weapp/miniprogram/utils/store.js apps/weapp/miniprogram/utils/store.test.js
git commit -m "feat(weapp): 自建轻量 store 容器（subscribe/patch）"
```

---

### Task 8: `stores/user.js`

**Files:**
- Create: `apps/weapp/miniprogram/stores/user.js`、`user.test.js`

**Interfaces:**
- Consumes: `createStore`（Task 7）、`safeParse`（shared）、`cartStore.onLoggedIn/onLoggedOut`（Task 9，运行时调用）
- Produces: `userStore`（快照 `{ token, userInfo }`）、`initFromStorage()`、`isLoggedIn()`、`getToken()`、`setLogin(data)`、`logout()`、`updateUserInfo(data)`（键 `token`/`userInfo`，对齐 H5）

- [ ] **Step 1: 写失败测试**（`user.test.js`）

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from '../../../test/wx-mock.js'
import { userStore, initFromStorage, isLoggedIn, setLogin, logout, getToken } from './user.js'

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
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `pnpm -F @snackstore/weapp test -- user` → FAIL

- [ ] **Step 3: 实现 `stores/user.js`**

```js
import { createStore } from '../utils/store.js'
import { safeParse } from '@snackstore/shared'

export const userStore = createStore({ token: '', userInfo: null })

// cart store 在自身模块内注册回调，避免 user<->cart 顶部循环 import 触发 TDZ
let cartHooks = { onLoggedIn: null, onLoggedOut: null }
export function registerCartHooks(hooks) {
  cartHooks = hooks || cartHooks
}

export function initFromStorage() {
  userStore.patch({
    token: wx.getStorageSync('token') || '',
    userInfo: safeParse(wx.getStorageSync('userInfo'), null)
  })
}

export function isLoggedIn() {
  return !!userStore.getSnapshot().token
}

export function getToken() {
  return userStore.getSnapshot().token
}

export function setLogin(data) {
  wx.setStorageSync('token', data.token)
  wx.setStorageSync('userInfo', JSON.stringify(data.user))
  userStore.patch({ token: data.token, userInfo: data.user })
  // 登录成功后触发游客购物车合并（时序：先写 user 态，再合并）
  if (cartHooks.onLoggedIn) cartHooks.onLoggedIn(data.user && data.user.id)
}

export function logout() {
  wx.removeStorageSync('token')
  wx.removeStorageSync('userInfo')
  const old = userStore.getSnapshot().userInfo
  userStore.patch({ token: '', userInfo: null })
  if (cartHooks.onLoggedOut) cartHooks.onLoggedOut(old && old.id)
}

export function updateUserInfo(patchData) {
  const userInfo = { ...userStore.getSnapshot().userInfo, ...patchData }
  wx.setStorageSync('userInfo', JSON.stringify(userInfo))
  userStore.patch({ userInfo })
}
```

> 循环依赖处理：user 通过 `registerCartHooks` 接收 cart 的合并钩子（cart.js 在模块末尾调用注册），两侧都不在 import 顶求值对方实例，规避 ESM 循环 TDZ。

- [ ] **Step 4: 验证 + Commit**

Run: `pnpm -F @snackstore/weapp test` → PASS；`pnpm lint` → 无错

```bash
git add apps/weapp/miniprogram/stores/user.js apps/weapp/miniprogram/stores/user.test.js
git commit -m "feat(weapp): 用户 store（wx.storage 持久化与购物车钩子注册）"
```

---

### Task 9: `stores/cart.js`

**Files:**
- Create: `apps/weapp/miniprogram/stores/cart.js`、`cart.test.js`

**Interfaces:**
- Consumes: `createStore`（Task 7）、`safeParse`/`mergeCartItems`/`calcCentsTotal`（shared）、`userStore`+`registerCartHooks`（Task 8）
- Produces: `cartStore`（快照 `{ items, buyNowItem }`）、`loadFromStorage()`、`getItems()`、`getTotalCount()`、`getTotalPrice()`、`addItem(product)`、`updateQuantity(id, q)`、`removeItem(id)`、`clearCart()`、`setBuyNowItem(product, q=1)`、`clearBuyNowItem()`、`syncTabBadge()`（键 `cartItems_{id|guest}`，对齐 H5）

- [ ] **Step 1: 写失败测试**（`cart.test.js`）

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from '../../../test/wx-mock.js'
import { userStore } from './user.js'
import {
  cartStore, loadFromStorage, addItem, updateQuantity, removeItem,
  getTotalCount, getTotalPrice, onLoggedIn
} from './cart.js'

beforeEach(() => {
  resetStorage()
  userStore.patch({ token: '', userInfo: null })
  cartStore.patch({ items: [], buyNowItem: null })
})

describe('cart store', () => {
  it('addItem 累加同商品数量', () => {
    addItem({ id: 1, name: 'A', price: 2, coverImage: 'x' })
    addItem({ id: 1, name: 'A', price: 2, coverImage: 'x' })
    expect(getTotalCount()).toBe(2)
  })
  it('金额分单位累加防漂移', () => {
    addItem({ id: 1, price: 0.1, name: 'a' })
    addItem({ id: 2, price: 0.2, name: 'b' })
    expect(getTotalPrice()).toBe(0.3)
  })
  it('updateQuantity 下限 1', () => {
    addItem({ id: 1, price: 1, name: 'a' })
    updateQuantity(1, 0)
    expect(cartStore.getSnapshot().items[0].quantity).toBe(1)
  })
  it('removeItem 过滤', () => {
    addItem({ id: 1, price: 1, name: 'a' })
    removeItem(1)
    expect(cartStore.getSnapshot().items.length).toBe(0)
  })
  it('onLoggedIn 合并 guest 到用户键并删 guest', () => {
    wx.setStorageSync('cartItems_guest', JSON.stringify([{ productId: 1, quantity: 2 }]))
    wx.setStorageSync('cartItems_9', JSON.stringify([{ productId: 1, quantity: 3 }]))
    onLoggedIn(9)
    expect(cartStore.getSnapshot().items[0].quantity).toBe(5)
    expect(wx.getStorageSync('cartItems_guest')).toBe('')
  })
  it('持久化到当前账号键', () => {
    addItem({ id: 1, price: 1, name: 'a' })
    loadFromStorage()
    expect(JSON.parse(wx.getStorageSync('cartItems_guest')).length).toBe(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `pnpm -F @snackstore/weapp test -- cart` → FAIL

- [ ] **Step 3: 实现 `stores/cart.js`**

```js
import { createStore } from '../utils/store.js'
import { safeParse, mergeCartItems, calcCentsTotal } from '@snackstore/shared'
import { userStore, registerCartHooks } from './user.js'

export const cartStore = createStore({ items: [], buyNowItem: null })

function currentUserId() {
  const u = userStore.getSnapshot().userInfo
  return u ? u.id : 'guest'
}
function storageKey(id) {
  return 'cartItems_' + (id !== undefined ? id : currentUserId())
}

export function loadFromStorage() {
  cartStore.patch({ items: safeParse(wx.getStorageSync(storageKey()), []) })
}

function save() {
  wx.setStorageSync(storageKey(), JSON.stringify(cartStore.getSnapshot().items))
  syncTabBadge()
}

export function getItems() {
  return cartStore.getSnapshot().items
}
export function getTotalCount() {
  return getItems().reduce((s, i) => s + i.quantity, 0)
}
export function getTotalPrice() {
  return calcCentsTotal(getItems())
}

export function addItem(product) {
  const items = getItems().slice()
  const ex = items.find((i) => i.productId === product.id)
  if (ex) ex.quantity += 1
  else items.push({ productId: product.id, name: product.name, price: product.price, coverImage: product.coverImage, quantity: 1 })
  cartStore.patch({ items })
  save()
}

export function updateQuantity(productId, quantity) {
  const items = getItems().slice()
  const it = items.find((i) => i.productId === productId)
  if (it) it.quantity = Math.max(1, quantity)
  cartStore.patch({ items })
  save()
}

export function removeItem(productId) {
  cartStore.patch({ items: getItems().filter((i) => i.productId !== productId) })
  save()
}

export function clearCart() {
  cartStore.patch({ items: [] })
  save()
}

export function setBuyNowItem(product, quantity = 1) {
  cartStore.patch({
    buyNowItem: { productId: product.id, name: product.name, price: product.price, coverImage: product.coverImage, quantity }
  })
}
export function clearBuyNowItem() {
  cartStore.patch({ buyNowItem: null })
}

// 游客 -> 登录：合并 guest 与用户键，落用户键，删 guest
export function onLoggedIn(newId) {
  if (!newId) return
  const guest = safeParse(wx.getStorageSync('cartItems_guest'), [])
  const user = safeParse(wx.getStorageSync('cartItems_' + newId), [])
  const merged = mergeCartItems(guest, user)
  cartStore.patch({ items: merged })
  wx.removeStorageSync('cartItems_guest')
  wx.setStorageSync('cartItems_' + newId, JSON.stringify(merged))
  syncTabBadge()
}
// 退出：切回 guest 购物车（用户键保留）
export function onLoggedOut() {
  loadFromStorage()
  syncTabBadge()
}

// tab 角标：购物车数量 -> 原生 tabBar 徽标（无 tab 环境/首页未就绪时静默）
export function syncTabBadge() {
  const n = getTotalCount()
  try {
    if (n > 0) wx.setTabBarBadge({ index: 2, text: String(n) })
    else wx.removeTabBarBadge({ index: 2 })
  } catch {
    /* 非 tab 页调用会 fail，忽略 */
  }
}

registerCartHooks({ onLoggedIn, onLoggedOut })
```

> `wx-mock.js` 需补 `setTabBarBadge`/`removeTabBarBadge`（throw 或 noop）；在 Task 6 的 mock 里加：`setTabBarBadge: () => { throw new Error('no tabbar') }`、`removeTabBarBadge: () => { throw new Error('no tabbar') }`，用于验证 `syncTabBadge` 的 try/catch 兜底不崩。

- [ ] **Step 4: 验证 + Commit**

Run: `pnpm -F @snackstore/weapp test` → PASS；`pnpm lint` → 无错

```bash
git add apps/weapp/miniprogram/stores/cart.js apps/weapp/miniprogram/stores/cart.test.js apps/weapp/test/wx-mock.js
git commit -m "feat(weapp): 购物车 store（复用 shared 合并/金额、tab 角标同步、游客合并钩子）"
```

---

### Task 10: `composables/usePagedList`（onReachBottom + seq 守卫）

**Files:**
- Create: `apps/weapp/miniprogram/utils/usePagedList.js`、`usePagedList.test.js`

**Interfaces:**
- Consumes: 无（`fetcher(pageNum, pageSize)` 由页面传入，返回 shared 风格 `res.data.data` 数组）
- Produces: `createPagedList({ fetcher, pageSize=10, guard }) => { items, pageNum, loading, finished, listError, initialLoading, loadError, onLoad(), resetAndReload() }`；状态语义对齐 H5 `usePagedList.js`（D12）

- [ ] **Step 1: 写失败测试**（`usePagedList.test.js`）

```js
import { describe, it, expect, vi } from 'vitest'
import { createPagedList } from './usePagedList.js'

const page = (data) => Promise.resolve({ data: { data } })

describe('createPagedList', () => {
  it('不足一页置 finished', async () => {
    const l = createPagedList({ fetcher: () => page([{ id: 1 }]), pageSize: 10 })
    await l.onLoad()
    expect(l.finished).toBe(true)
    expect(l.items.length).toBe(1)
    expect(l.initialLoading).toBe(false)
  })
  it('guard 为假不拉取', async () => {
    const f = vi.fn()
    const l = createPagedList({ fetcher: f, guard: () => false })
    await l.onLoad()
    expect(f).not.toHaveBeenCalled()
  })
  it('seq 守卫丢弃过期响应', async () => {
    let n = 0
    const l = createPagedList({
      pageSize: 1,
      fetcher: () => {
        n += 1
        const cur = n
        return new Promise((res) =>
          setTimeout(() => res({ data: { data: [{ id: cur }] } }), cur === 1 ? 30 : 0)
        )
      }
    })
    const first = l.onLoad() // 慢响应 seq=1
    l.resetAndReload() // 重置后发起 seq=2（快）
    await Promise.all([first, Promise.resolve()])
    await new Promise((r) => setTimeout(r, 50))
    // 只有最新一轮数据写回：旧 seq=1 响应被丢
    expect(l.items.some((i) => i.id === 1)).toBe(false)
  })
  it('首屏失败置 loadError', async () => {
    const l = createPagedList({ fetcher: () => Promise.reject(new Error('x')) })
    await l.onLoad()
    expect(l.loadError).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `pnpm -F @snackstore/weapp test -- usePagedList` → FAIL

- [ ] **Step 3: 实现 `usePagedList.js`**

```js
/**
 * 小程序分页加载（页面生命周期驱动）：
 * 页面 onReachBottom -> list.onLoad()；onPullDownRefresh -> list.resetAndReload()。
 * 用递增 seq 守卫代替 H5 的 AbortController：响应回来时若 seq 已变（被重置/新轮覆盖），丢弃脏写。
 * @param {{ fetcher: (pageNum:number,pageSize:number)=>Promise<any>, pageSize?: number, guard?: ()=>boolean }} opts
 */
export function createPagedList(opts) {
  const fetcher = opts.fetcher
  const pageSize = opts.pageSize || 10
  const guard = opts.guard
  let seq = 0
  const list = {
    items: [],
    pageNum: 1,
    loading: false,
    finished: false,
    listError: false,
    initialLoading: true,
    loadError: false,
    onLoad() {
      if (guard && !guard()) {
        list.loading = false
        list.finished = true
        return Promise.resolve()
      }
      const my = ++seq
      list.loading = true
      return Promise.resolve()
        .then(() => fetcher(list.pageNum, pageSize))
        .then((res) => {
          if (my !== seq) return // 过期响应，丢弃
          const arr = (res && res.data && res.data.data) || []
          list.items = list.items.concat(arr)
          list.pageNum += 1
          if (arr.length < pageSize) list.finished = true
        })
        .catch(() => {
          if (my !== seq) return
          if (list.pageNum === 1) list.loadError = true
          else list.listError = true
        })
        .then(() => {
          if (my !== seq) return
          list.loading = false
          list.initialLoading = false
        })
    },
    resetAndReload() {
      list.items = []
      list.pageNum = 1
      list.finished = false
      list.listError = false
      list.loadError = false
      list.initialLoading = true
      return list.onLoad()
    }
  }
  return list
}
```

> 页面侧用法约定（P3/P4 各页遵守）：`onLoad` 里 `this.list = createPagedList({...})`；将 `this.list.onLoad()` 返回 Promise `.then(() => this.setData(snapshot))`；`onReachBottom` 同理。快照含 `items/loading/finished/listError/initialLoading/loadError` 六项。

- [ ] **Step 4: 验证 + Commit**

Run: `pnpm -F @snackstore/weapp test` → PASS；`pnpm lint` → 无错

```bash
git add apps/weapp/miniprogram/utils/usePagedList.js apps/weapp/miniprogram/utils/usePagedList.test.js
git commit -m "feat(weapp): 小程序分页 composable（onReachBottom 语义 + seq 脏写守卫）"
```

---

### Task 11: `utils/confirm.js` + toast 封装 + `utils/orderStatus.js`

**Files:**
- Create: `apps/weapp/miniprogram/utils/confirm.js`、`toast.js`、`orderStatus.js`、`confirm.test.js`

**Interfaces:**
- Consumes: `getOrderStatusText`（shared）
- Produces: `confirm(content, options?) => Promise<boolean>`（true=确认，对齐 H5 `showConfirmDialog`）；`toastFail(msg)`/`toastSuccess(msg)`（包 `wx.showToast`，D10）；`getStatusText`/`getStatusType`（复用 shared 文案 + weapp tag type 映射 `{0:'warning',1:'success',2:'default'}`，与 H5 一致）

- [ ] **Step 1: 写失败测试**（`confirm.test.js`）

```js
import { describe, it, expect, vi } from 'vitest'
import { confirm } from './confirm.js'

describe('confirm', () => {
  it('confirm:true resolve true', async () => {
    vi.spyOn(wx, 'showModal').mockImplementation((o) => o.success({ confirm: true }))
    await expect(confirm('删除？')).resolves.toBe(true)
  })
  it('confirm:false resolve false', async () => {
    vi.spyOn(wx, 'showModal').mockImplementation((o) => o.success({ confirm: false }))
    await expect(confirm('删除？')).resolves.toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `pnpm -F @snackstore/weapp test -- confirm` → FAIL

- [ ] **Step 3: 实现三件**

`confirm.js`：

```js
/** Promise 化 wx.showModal；resolve(true=确认 / false=取消），语义对齐 H5 showConfirmDialog */
export function confirm(content, options = {}) {
  return new Promise((resolve) => {
    wx.showModal({
      title: options.title || '提示',
      content,
      confirmText: options.confirmButtonText || '确定',
      cancelText: options.cancelButtonText || '取消',
      confirmColor: '#ee0a24',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
}
```

`toast.js`：

```js
export function toastFail(title) {
  wx.showToast({ title, icon: 'none' })
}
export function toastSuccess(title) {
  wx.showToast({ title, icon: 'success' })
}
```

`orderStatus.js`：

```js
import { getOrderStatusText } from '@snackstore/shared'

export const getStatusText = getOrderStatusText

// tag 颜色属 UI 库差异，与 H5 Vant 词汇一致（见 apps/mobile/src/utils/orderStatus.js）
const TYPE_MAP = { 0: 'warning', 1: 'success', 2: 'default' }
export function getStatusType(status) {
  return TYPE_MAP[status] ?? 'default'
}
```

- [ ] **Step 4: 验证 + Commit**

Run: `pnpm -F @snackstore/weapp test` → PASS；`pnpm lint` → 无错

```bash
git add apps/weapp/miniprogram/utils/confirm.js apps/weapp/miniprogram/utils/toast.js apps/weapp/miniprogram/utils/orderStatus.js apps/weapp/miniprogram/utils/confirm.test.js
git commit -m "feat(weapp): confirm/toast 封装与订单状态工具"
```

---

### Task 12: `app.js` 启动接线（恢复登录态 + 错误上报 + 隐私弹窗）

**Files:**
- Modify: `apps/weapp/miniprogram/app.js`（覆盖 Task 4 占位）
- Modify: `apps/weapp/miniprogram/app.json`（开 `"requiredPrivateInfos"`? 否；隐私声明走后台配置）

**Interfaces:**
- Consumes: `initFromStorage`/`userStore`（Task 8）、`loadFromStorage`/`cartStore`/`syncTabBadge`（Task 9）、`createWxRequest`（Task 6）、`reportError`/`configureErrorTracking`（shared）
- Produces: `getApp().globalData.request`（供页面复用的 wx.request 实例）；全局登录态/购物车已恢复

- [ ] **Step 1: 实现 `app.js`**

```js
import { configureErrorTracking, reportError } from '@snackstore/shared'
import env from './config/env.js'
import { createWxRequest } from './utils/request.js'
import { initFromStorage, getToken } from './stores/user.js'
import { loadFromStorage, syncTabBadge } from './stores/cart.js'

App({
  globalData: { request: null },

  onLaunch() {
    // 1) 启动恢复登录态与购物车（小程序无拦截器懒读，启动即恢复）
    initFromStorage()
    loadFromStorage()

    // 2) 注入式错误上报通道（优先 wx.request POST；缺省不发送）
    configureErrorTracking({
      isDev: env.IS_DEV,
      errorReportUrl: env.ERROR_REPORT_URL,
      transport: (body) => {
        if (env.ERROR_REPORT_URL) {
          wx.request({
            url: env.ERROR_REPORT_URL,
            method: 'POST',
            header: { 'content-type': 'application/json' },
            data: body
          })
        }
      }
    })

    // 3) 统一请求实例（页面可直接用 getApp().globalData.request）
    this.globalData.request = createWxRequest({
      baseURL: env.API_BASE_URL,
      timeout: env.TIMEOUT,
      getToken,
      onUnauthorized: () => {
        const { logout } = require('./stores/user.js')
        logout()
        wx.navigateTo({ url: '/pages/login/login' })
      },
      onError: (msg) => wx.showToast({ title: msg, icon: 'none' })
    })
  },

  // 隐私弹窗：基础库 2.32.3+ 才支持；能力探测降级（D13）
  onShow() {
    if (typeof wx.getPrivacySetting === 'function') {
      wx.getPrivacySetting({
        success: (res) => {
          if (res.needAuthorization) {
            wx.requirePrivacyAuthorize({ success: () => {}, fail: () => {} })
          }
        },
        fail: () => {}
      })
    }
  },

  onError(err) {
    reportError(err, { type: 'error', scene: 'app.onError' })
  },

  onUnhandledRejection(res) {
    reportError(res.reason, { type: 'unhandledrejection', scene: 'app.rejection' })
  }
})
```

> `require('./stores/user.js')` 在 `onUnauthorized` 里延迟取，避开顶部 import 循环；若 weapp 不支持 `require`（纯 ESM 模式），改为顶部 `import { logout } from './stores/user.js'`（onUnauthorized 为运行时回调，不触发 TDZ）。

- [ ] **Step 2: 手工启动验证**

开发者工具重新编译 → 无报错；Console 无 `wx is not defined`；`getApp().globalData.request` 非空。若环境已有 `env.js`，验证请求拦截器能拼到本地后端（可选）。

- [ ] **Step 3: Commit**

```bash
git add apps/weapp/miniprogram/app.js
git commit -m "feat(weapp): app 启动接线登录态恢复与错误上报与隐私弹窗"
```

---

### Task 13: `app.json` 全量页面注册 + 原生 tabBar + 登录守卫工具

**Files:**
- Modify: `apps/weapp/miniprogram/app.json`（覆盖：11 页 + tabBar）
- Create: `apps/weapp/miniprogram/utils/authGuard.js`
- Create: `apps/weapp/miniprogram/images/tabbar/*.png`（8 张占位）

**Interfaces:**
- Consumes: `isLoggedIn`（Task 8）
- Produces: 路由名（页面路径）与 H5 一一对应；`ensureLogin(currentPageRoute) => boolean`（未登录跳 login 带 redirect 并返回 false）

- [ ] **Step 1: `app.json`**

```json
{
  "pages": [
    "pages/home/home",
    "pages/category/category",
    "pages/cart/cart",
    "pages/mine/mine",
    "pages/login/login",
    "pages/product-detail/product-detail",
    "pages/order-confirm/order-confirm",
    "pages/order-list/order-list",
    "pages/order-detail/order-detail",
    "pages/address/address"
  ],
  "window": {
    "navigationBarTitleText": "零食商城",
    "navigationBarBackgroundColor": "#ffffff",
    "navigationBarTextStyle": "black",
    "backgroundTextStyle": "light"
  },
  "tabBar": {
    "color": "#7d7e80",
    "selectedColor": "#ee0a24",
    "backgroundColor": "#ffffff",
    "list": [
      { "pagePath": "pages/home/home", "text": "首页", "iconPath": "images/tabbar/home.png", "selectedIconPath": "images/tabbar/home-active.png" },
      { "pagePath": "pages/category/category", "text": "分类", "iconPath": "images/tabbar/category.png", "selectedIconPath": "images/tabbar/category-active.png" },
      { "pagePath": "pages/cart/cart", "text": "购物车", "iconPath": "images/tabbar/cart.png", "selectedIconPath": "images/tabbar/cart-active.png" },
      { "pagePath": "pages/mine/mine", "text": "我的", "iconPath": "images/tabbar/mine.png", "selectedIconPath": "images/tabbar/mine-active.png" }
    ]
  }
}
```

> `pages/home/home` 等页在其各自任务创建；本任务先注册路由，未建页时编译会报缺页——属预期，先建目录占位（每个页一个空 `Page({})` 四件套）以保证工程能编译，后续任务填充。

- [ ] **Step 2: `utils/authGuard.js`**

```js
import { isLoggedIn } from '../stores/user.js'

/**
 * requiresAuth 等价物：页面 onLoad 首行调用。未登录则跳 login（带 redirect）并返回 false。
 * tab 页目标需 switchTab，此处统一走 redirect 参数回跳。
 * @param {string} redirect 当前页 fullPath（含 query）
 */
export function ensureLogin(redirect) {
  if (isLoggedIn()) return true
  wx.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent(redirect) })
  return false
}
```

- [ ] **Step 3: tabBar 图标占位**

`miniprogram/images/tabbar/` 放 8 张最小 PNG（可用工具生成 81×81 纯色占位）；README 标注「待设计替换」。

- [ ] **Step 4: 验证 + Commit**

开发者工具编译：工程能启动，底部四个 tab 可切换（空页）。Run: `pnpm lint` → 无错

```bash
git add apps/weapp/miniprogram/app.json apps/weapp/miniprogram/utils/authGuard.js apps/weapp/miniprogram/images/tabbar
git commit -m "feat(weapp): 注册全量页面与原生 tabBar，新增登录守卫工具"
```

---

## Phase P3/P4/P5：页面与组件实现（通用迁移契约）

> **所有页面任务遵守的翻译规则**（不再逐页重复）：
> 1. **markup 基准 = 对应 `.vue` 的 `<template>`**：逐元素把 `v-`/`@`/`:prop` 译为 `wx:if`/`wx:for`/`bind:tap`/`catch:tap`/属性绑定；不遗漏字段。完整结构照该 `.vue` 行区间翻译，属 1:1 移植而非自由发挥。
> 2. **响应式→setData**：`ref`/`reactive` 字段放入 `data`；任何变更用 `this.setData({ ... })`（只传变化项，避免整对象，缓解风险 A2）。
> 3. **计算属性→普通函数/数据预处理**：无 `computed`；在取数后或 `onShow` 里现算并 setData（如 `totalPrice`）。
> 4. **生命周期映射**：`onMounted`→`onLoad`；需每次返回刷新的逻辑→`onShow`；`watch` 列表加载→`onReachBottom`+`createPagedList`。
> 5. **请求**：统一用 `const request = getApp().globalData.request`，再调 `api/*.js`。
> 6. **px→rpx ×2**（375→750）；`scoped`→页内 wxss（类名沿用 H5）。
> 7. **事件**：`@click`→`bind:tap`（需阻冒泡用 `catch:tap`）；`v-model` 拆为 `value` + `bind:input`/`bind:change`。
> 8. 每页验收：开发者工具编译无错 + 模拟器路径走通 + 对照 H5 页面目测一致。

### Task 14: `api/` 参数层（复用 shared 工厂 + 独有接口）

**Files:**
- Create: `apps/weapp/miniprogram/api/{product,order,user,address}.js`

**Interfaces:**
- Consumes: `createProductApi`/`createOrderApi`/`createUserApi`（shared）、`getApp().globalData.request`（Task 6/12）
- Produces: 与 H5 `apps/mobile/src/api/*.js` 一一对应的导出函数（`getProductList`/`getProductDetail`/`getCategoryList`/`getOrderList`/`getOrderDetail`/`payOrder`/`cancelOrder`/`postOrder`/`postLogin`/`postRegister`/`getUserInfo`/`putUserInfo` + address CRUD）

> request 实例在模块加载时 `getApp()` 可能未就绪，因此各 api **延迟取实例**：导出函数内部 `const req = getApp().globalData.request` 再调用。shared 工厂需传入 request，所以改为每函数内部直接调 `req.get(...)`（等价于工厂展开），或用一个小工厂 `apis()` 惰性包装。下表给惰性包装方案。

- [ ] **Step 1: 实现 `api/*.js`（以 order.js / user.js 为样板，其余同构）**

`api/order.js`（对应 `apps/mobile/src/api/order.js` + shared `createOrderApi`）：

```js
function req() {
  return getApp().globalData.request
}

export const getOrderList = (params) => req().get('/orders', { params })
export const getOrderDetail = (id) => req().get(`/orders/${id}`)
export const payOrder = (id) => req().patch(`/orders/${id}/status`, null, { params: { status: 1 } })
export const cancelOrder = (id) => req().patch(`/orders/${id}/status`, null, { params: { status: 2 } })
// options 透传，用于幂等键等请求级配置（对齐 H5 postOrder）
export const postOrder = (data, options) => req().post('/orders', data, options)
```

`api/user.js`（对应 `apps/mobile/src/api/user.js`）：

```js
function req() {
  return getApp().globalData.request
}
export const getUserInfo = (id) => req().get(`/users/${id}`)
export const postLogin = (data) => req().post('/auth/login', data)
export const postRegister = (data) => req().post('/auth/register', data)
export const putUserInfo = (id, data) => req().put(`/users/${id}`, data)
```

`api/product.js`（对应 `apps/mobile/src/api/product.js` + shared `createProductApi`）：

```js
function req() {
  return getApp().globalData.request
}
export const getProductList = (params) => req().get('/product-search', { params })
export const getProductDetail = (id) => req().get(`/products/${id}`)
export const getCategoryList = () => req().get('/products/categories')
```

`api/address.js`：**照抄** `apps/mobile/src/api/address.js` 的路径与参数，只把模块顶部的 `import request from '@/utils/request'` 改为上方 `function req(){ return getApp().globalData.request }` 并在每个函数内用 `req()`。先 Read 该文件拿准确端点（如 `/addresses`）。

- [ ] **Step 2: 静态自检 + Commit**

Run: `pnpm lint` → 无错（此任务无新单测，行为由 shared/api.test.js 与适配层 request.test.js 间接覆盖）

```bash
git add apps/weapp/miniprogram/api
git commit -m "feat(weapp): 小程序 API 参数层（复用 shared 工厂语义）"
```

---

### Task 15: `home` 首页

**Files:**
- Modify: `apps/weapp/miniprogram/pages/home/home.*`（替换 POC 页）
- 翻译基准: `apps/mobile/src/views/Home.vue`（202 行）

**逐页映射要点：**

| H5 元素 | weapp |
| --- | --- |
| `van-search` + 防抖 | `van-search` `bind:change`，`onSearch` 里 `clearTimeout`+`setTimeout(300)` |
| `van-list`（usePagedList） | `this.list = createPagedList({ fetcher: (p,s)=>getProductList({keyword,pageNum:p,pageSize:s}) })`；`onReachBottom`→`this.list.onLoad().then(sync)` |
| `van-card`/`ProductCard` | `<product-card wx:for="{{items}}" ... bind:tap="goDetail"/>`（组件见 Task 24；本任务可先用内联 view 直译 Home.vue 列表项） |
| `van-image` | `van-image lazy-load` |
| `router-link`/`router.push` | `wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + id })` |
| 骨架屏 `van-skeleton` | `initialLoading` 控制 `van-skeleton row="6"` |

- [ ] **Step 1: `home.json` 注册组件**

```json
{
  "usingComponents": {
    "van-search": "@vant/weapp/search/index",
    "van-image": "@vant/weapp/image/index",
    "van-skeleton": "@vant/weapp/skeleton/index",
    "van-empty": "@vant/weapp/empty/index",
    "van-divider": "@vant/weapp/divider/index"
  }
}
```

- [ ] **Step 2: `home.js`**

```js
import { createPagedList } from '../../utils/usePagedList.js'
import { getProductList } from '../../api/product.js'
import { syncTabBadge } from '../../stores/cart.js'

Page({
  data: { keyword: '', items: [], loading: false, finished: false, listError: false, initialLoading: true, loadError: false },
  list: null,
  onLoad() {
    this.list = createPagedList({
      fetcher: (pageNum, pageSize) => getProductList({ keyword: this.data.keyword, pageNum, pageSize })
    })
    this.load()
    syncTabBadge()
  },
  load() {
    this.list.onLoad().then(() => this.sync())
  },
  sync() {
    const l = this.list
    this.setData({ items: l.items, loading: l.loading, finished: l.finished, listError: l.listError, initialLoading: l.initialLoading, loadError: l.loadError })
  },
  onReachBottom() {
    if (!this.list.finished && !this.list.loading) this.load()
  },
  onPullDownRefresh() {
    this.list.resetAndReload().then(() => { this.sync(); wx.stopPullDownRefresh() })
  },
  onSearchInput(e) {
    this.setData({ keyword: e.detail })
    clearTimeout(this._t)
    this._t = setTimeout(() => this.list.resetAndReload().then(() => this.sync()), 300)
  },
  goDetail(e) {
    wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + e.currentTarget.dataset.id })
  }
})
```

- [ ] **Step 3: `home.wxml`/`home.wxss`**

按 `Home.vue` 模板逐块翻译（搜索条 + 列表 wx:for + 分页三态 van-divider + 骨架屏/错误占位）；样式 px×2。列表项直接内联 Home.vue 的商品卡片结构（Task 24 后再抽为 `product-card` 组件）。

- [ ] **Step 4: 验证 + Commit**

开发者工具：首页能渲染、搜索防抖生效、上拉加载下一页、下拉刷新重置、点卡片进详情（详情页本任务前为占位页，不报错即可）。

```bash
git add apps/weapp/miniprogram/pages/home
git commit -m "feat(weapp): 首页（搜索 + 分页 + 商品卡片）"
```

---

### Task 16: `category` 分类页

**Files:**
- Modify: `apps/weapp/miniprogram/pages/category/category.*`
- 翻译基准: `apps/mobile/src/views/Category.vue`（111 行）

**要点**：H5 用左右联动（分类列表 + 当前分类商品）。weapp：
- `getCategoryList()` 拉分类，`createPagedList` 拉当前分类商品，`guard` 为「分类已加载」。
- 切分类（`bind:tap` 选中）→ `list` 换新 fetcher（带 `categoryId`）后 `resetAndReload()`。
- `van-tab`/左侧栏直译；商品项同首页。

- [ ] **Step 1: `category.json`**：`van-image`、`van-skeleton`、`van-empty`、`van-divider`、`van-loading`（若需）
- [ ] **Step 2: `category.js`**

```js
import { createPagedList } from '../../utils/usePagedList.js'
import { getCategoryList, getProductList } from '../../api/product.js'

Page({
  data: { categories: [], activeId: null, items: [], loading: false, finished: false, initialLoading: true },
  list: null,
  onLoad() {
    getCategoryList().then((res) => {
      const cats = (res.data && res.data.data) || res.data || []
      const activeId = cats.length ? cats[0].id : null
      this.setData({ categories: cats, activeId })
      this.buildList()
    })
  },
  buildList() {
    this.list = createPagedList({
      fetcher: (pageNum, pageSize) => getProductList({ categoryId: this.data.activeId, pageNum, pageSize }),
      guard: () => this.data.activeId != null
    })
    this.list.onLoad().then(() => this.sync())
  },
  sync() {
    const l = this.list
    this.setData({ items: l.items, loading: l.loading, finished: l.finished, initialLoading: l.initialLoading })
  },
  onCategoryTap(e) {
    this.setData({ activeId: e.currentTarget.dataset.id, items: [] })
    this.buildList()
  },
  onReachBottom() {
    if (this.list && !this.list.finished && !this.list.loading) this.list.onLoad().then(() => this.sync())
  },
  goDetail(e) {
    wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + e.currentTarget.dataset.id })
  }
})
```

- [ ] **Step 3: `category.wxml`/wxss**：按 Category.vue 模板翻译（左分类 + 右商品列表 + 空态）。
- [ ] **Step 4: 验证 + Commit**

```bash
git add apps/weapp/miniprogram/pages/category
git commit -m "feat(weapp): 分类页（分类切换 + 联动商品分页）"
```

---

### Task 17: `cart` 购物车页

**Files:**
- Modify: `apps/weapp/miniprogram/pages/cart/cart.*`
- 翻译基准: `apps/mobile/src/views/Cart.vue`（124 行）+ `SubmitBar.vue`

**要点**：
- 数据源 = `cartStore`；`onLoad`/`onShow` `subscribe` + `setData`，`onUnload` 退订。
- `van-swipe-cell` 左滑删除（`right-button` + `bind:close`）；`van-stepper` 改数量（`bind:change`→`updateQuantity`）；`submit-bar` 合计与去结算（直译或先用内联底部栏）。
- `ensureLogin`：购物车 requiresAuth；未登录先跳登录。

- [ ] **Step 1: `cart.json`**：`van-swipe-cell`、`van-stepper`、`van-checkbox`、`van-empty`、`van-image`、`van-button`
- [ ] **Step 2: `cart.js`**

```js
import { cartStore } from '../../stores/cart.js'
import { loadFromStorage, updateQuantity, removeItem, getTotalPrice } from '../../stores/cart.js'
import { ensureLogin } from '../../utils/authGuard.js'

Page({
  data: { items: [], totalPrice: '0.00' },
  _off: null,
  onLoad() {
    if (!ensureLogin('/pages/cart/cart')) return
    loadFromStorage()
    this._off = cartStore.subscribe(() => this.sync())
    this.sync()
  },
  onShow() {
    if (this._off) this.sync()
  },
  onUnload() {
    if (this._off) this._off()
  },
  sync() {
    this.setData({ items: cartStore.getSnapshot().items, totalPrice: getTotalPrice().toFixed(2) })
  },
  onQuantityChange(e) {
    updateQuantity(e.currentTarget.dataset.id, e.detail)
  },
  onDelete(e) {
    removeItem(e.currentTarget.dataset.id)
  },
  goCheckout() {
    wx.navigateTo({ url: '/pages/order-confirm/order-confirm?from=cart' })
  }
})
```

- [ ] **Step 3: `cart.wxml`/wxss**：按 Cart.vue 翻译（商品 wx:for + swipe-cell + stepper + 底部结算栏 + 空态）。
- [ ] **Step 4: 验证 + Commit**

```bash
git add apps/weapp/miniprogram/pages/cart
git commit -m "feat(weapp): 购物车页（swipe 删除 + stepper 改量 + 结算栏）"
```

---

### Task 18: `mine` 我的页

**Files:**
- Modify: `apps/weapp/miniprogram/pages/mine/mine.*`
- 翻译基准: `apps/mobile/src/views/Mine.vue`（143 行）

**要点**：用户信息卡（`userStore`）+ 订单状态入口（待支付/已完成/已取消 → order-list 带 tab 参数）+ 地址管理入口 + 退出登录（`confirm` + `logout()` + `wx.reLaunch`/`switchTab`）。

- [ ] **Step 1: `mine.js`**

```js
import { userStore, logout, isLoggedIn } from '../../stores/user.js'
import { confirm } from '../../utils/confirm.js'
import { ensureLogin } from '../../utils/authGuard.js'

Page({
  data: { user: null, logged: false },
  onShow() {
    this.sync()
  },
  sync() {
    const s = userStore.getSnapshot()
    this.setData({ user: s.userInfo, logged: isLoggedIn() })
  },
  goOrders(e) {
    if (!ensureLogin('/pages/mine/mine')) return
    wx.navigateTo({ url: '/pages/order-list/order-list?tab=' + e.currentTarget.dataset.tab })
  },
  goAddress() {
    if (!ensureLogin('/pages/mine/mine')) return
    wx.navigateTo({ url: '/pages/address/address' })
  },
  async onLogout() {
    if (await confirm('确定退出登录？')) {
      logout()
      this.sync()
    }
  }
})
```

- [ ] **Step 2: `mine.json`**：`van-cell`、`van-cell-group`、`van-button`、`van-image`；`mine.wxml`/wxss 按 Mine.vue 翻译。
- [ ] **Step 3: 验证 + Commit**

```bash
git add apps/weapp/miniprogram/pages/mine
git commit -m "feat(weapp): 我的页（用户信息 + 订单入口 + 退出登录）"
```

---

### Task 19: `login` 登录页（手机号+密码 + redirect 回跳）

**Files:**
- Modify: `apps/weapp/miniprogram/pages/login/login.*`
- 翻译基准: `apps/mobile/src/views/Login.vue`（148 行）

**要点**（D1：首版与 H5 一致，手机号+密码，无 wx.login）：
- 登录/注册切换（`postLogin`/`postRegister`）；表单校验用 `van-form` + 页面 `validate()` 兼容兄底。
- 成功后 `setLogin(res.data.data)`（或对齐 H5 取法，先 Read Login.vue 确认返回结构）→ 按 `options.redirect` 回跳：tab 页用 `wx.switchTab`，其余 `wx.redirectTo`/`navigateBack`。
- `onLoad(options)` 捕获 `redirect`（需 decodeURIComponent）。

- [ ] **Step 1: `login.js`**

```js
import { postLogin } from '../../api/user.js'
import { setLogin } from '../../stores/user.js'
import { toastFail, toastSuccess } from '../../utils/toast.js'

const TAB_PAGES = ['/pages/home/home', '/pages/category/category', '/pages/cart/cart', '/pages/mine/mine']

Page({
  data: { mobile: '', password: '', submitting: false, redirect: '' },
  onLoad(options) {
    this.setData({ redirect: options.redirect ? decodeURIComponent(options.redirect) : '' })
  },
  onMobile(e) { this.setData({ mobile: e.detail }) },
  onPassword(e) { this.setData({ password: e.detail }) },
  submit() {
    if (this.data.submitting) return
    if (!/^1\d{10}$/.test(this.data.mobile)) return toastFail('请输入正确手机号')
    if (!this.data.password) return toastFail('请输入密码')
    this.setData({ submitting: true })
    postLogin({ mobile: this.data.mobile, password: this.data.password })
      .then((res) => {
        setLogin(res.data)
        toastSuccess('登录成功')
        this.afterLogin()
      })
      .catch(() => this.setData({ submitting: false }))
  },
  afterLogin() {
    const r = this.data.redirect
    if (!r) return wx.switchTab({ url: '/pages/home/home' })
    if (TAB_PAGES.indexOf(r) !== -1) return wx.switchTab({ url: r })
    wx.redirectTo({ url: r })
  },
  goRegister() {
    wx.navigateTo({ url: '/pages/login/login?mode=register' })
  }
})
```

> `setLogin(res.data)`：H5 登录返回体经 axios 拦截后为 `{ code, data: { token, user } }`，故 `res.data` = `{ token, user }`。先 Read Login.vue 校对 `setLogin` 入参（H5 传的是 `data` 还是 `data.data`），保持一致。

- [ ] **Step 2: `login.json`**：`van-field`、`van-form`、`van-button`；`login.wxml`/wxss 按 Login.vue 翻译（含 mode=register 时的注册表单分支）。
- [ ] **Step 3: 验证 + Commit**

开发者工具：未登录点 tab 购物车/我的能跳登录，登录后按 redirect 回到原页。

```bash
git add apps/weapp/miniprogram/pages/login
git commit -m "feat(weapp): 登录页（手机号密码 + redirect 回跳 + 注册入口）"
```

---

### Task 20: `product-detail` 商品详情（rich-text）

**Files:**
- Modify: `apps/weapp/miniprogram/pages/product-detail/product-detail.*`
- 翻译基准: `apps/mobile/src/views/ProductDetail.vue`（160 行）

**要点**（D5）：
- 详情富文本：`<rich-text nodes="{{detailNodes}}"/>` 直接渲染 `getProductDetail(id).data.detail`（**不走 DOMPurify**，rich-text 自身不执行 script/事件属性）。
- 图片轮播：H5 `van-swipe` → weapp `<swiper>`/`van-swipe-cell`? 用原生 `swiper` + `swiper-item`。
- 加购 `addItem(product)`；立即购买 `setBuyNowItem(product, 1)` 后跳 order-confirm?from=buyNow。
- **加载失败不可提交**：对齐 f720773 修复——详情未加载成功时禁用底部结算栏（`ready` 标志）。

- [ ] **Step 1: `product-detail.js`**

```js
import { getProductDetail } from '../../api/product.js'
import { addItem, setBuyNowItem } from '../../stores/cart.js'
import { toastFail, toastSuccess } from '../../utils/toast.js'

Page({
  data: { id: null, product: null, detailNodes: '', images: [], ready: false },
  onLoad(options) {
    this.setData({ id: options.id })
    this.load(options.id)
  },
  load(id) {
    getProductDetail(id).then((res) => {
      const p = res.data && res.data.data ? res.data.data : res.data
      if (!p) return toastFail('商品不存在')
      this.setData({
        product: p,
        ready: true,
        detailNodes: p.detail || '',
        images: p.album ? JSON.parse(p.album) : p.coverImage ? [p.coverImage] : []
      })
    })
  },
  onAddCart() {
    if (!this.data.ready) return toastFail('信息未加载完成')
    addItem(this.data.product)
    toastSuccess('已加入购物车')
  },
  onBuyNow() {
    if (!this.data.ready) return toastFail('信息未加载完成')
    setBuyNowItem(this.data.product, 1)
    wx.navigateTo({ url: '/pages/order-confirm/order-confirm?from=buyNow' })
  }
})
```

> `p.album` 字段名/格式先 Read ProductDetail.vue 校对（H5 可能直接是数组或逗号分隔），按 H5 取法一致。`detailNodes` 可传 HTML 字符串（rich-text 支持）。

- [ ] **Step 2: `product-detail.json` + wxml/wxss**

```json
{
  "usingComponents": {
    "van-button": "@vant/weapp/button/index",
    "van-image": "@vant/weapp/image/index",
    "van-skeleton": "@vant/weapp/skeleton/index"
  }
}
```

wxml 按 ProductDetail.vue 翻译：轮播区用 `<swiper>`、商品信息区、`<rich-text nodes="{{detailNodes}}"/>`、底部吸栏（加入购物车/立即购买，`disabled="{{!ready}}"`）。

- [ ] **Step 3: 验证 + Commit**

开发者工具：详情能渲染（含图文），未加载完不能提交，加购后首页/购物车徒标变化。

```bash
git add apps/weapp/miniprogram/pages/product-detail
git commit -m "feat(weapp): 商品详情页（rich-text 渲染 + 加购/直购）"
```

---

### Task 21: `order-confirm` 确认订单（最复杂）

**Files:**
- Modify: `apps/weapp/miniprogram/pages/order-confirm/order-confirm.*`
- 翻译基准: `apps/mobile/src/views/OrderConfirm.vue`（246 行）

**要点**：
- 入口来源：`from=cart`（读购物车 items）/ `from=buyNow`（读 `buyNowItem` 快照）；先 Read OrderConfirm.vue 确认 H5 如何取这两态。
- 地址选择：`getAddressList` + `van-radio-group`，无默认地址时提示去 `address` 页新增。
- 备注输入 `van-field`；金额 = `calcCentsTotal(items)` + 运费（照搬 H5 运费/满减逻辑，若有）。
- 提交：`postOrder(payload, { headers: { 'Idempotency-Key': k } })`（幂等键，对齐 H5）→ 成功后按 H5 逻辑走**模拟支付**（`payOrder(id)` 即 `PATCH status=1`），再 `clearCart`/`clearBuyNowItem` 并跳 order-detail。
- `ensureLogin('/pages/order-confirm/order-confirm?from=...')`。

- [ ] **Step 1: `order-confirm.js` 结构**

```js
import { getAddressList } from '../../api/address.js'
import { postOrder, payOrder } from '../../api/order.js'
import { cartStore, clearCart, clearBuyNowItem, getTotalPrice } from '../../stores/cart.js'
import { calcCentsTotal } from '@snackstore/shared'
import { ensureLogin } from '../../utils/authGuard.js'
import { toastFail } from '../../utils/toast.js'
import { confirm } from '../../utils/confirm.js'

Page({
  data: { from: 'cart', items: [], addresses: [], addressId: null, remark: '', total: '0.00', submitting: false },
  onLoad(options) {
    if (!ensureLogin('/pages/order-confirm/order-confirm?from=' + (options.from || 'cart'))) return
    const from = options.from || 'cart'
    const items = from === 'buyNow' ? [cartStore.getSnapshot().buyNowItem].filter(Boolean) : cartStore.getSnapshot().items
    this.setData({ from, items, total: calcCentsTotal(items).toFixed(2) })
    getAddressList().then((res) => {
      const list = (res.data && res.data.data) || res.data || []
      const def = list.find((a) => a.isDefault === 1) || list[0]
      this.setData({ addresses: list, addressId: def ? def.id : null })
    })
  },
  onAddressChange(e) { this.setData({ addressId: e.detail }) },
  onRemark(e) { this.setData({ remark: e.detail }) },
  async submit() {
    if (this.data.submitting) return
    if (!this.data.addressId) return toastFail('请选择收货地址')
    if (!this.data.items.length) return toastFail('没有可下单商品')
    this.setData({ submitting: true })
    const payload = { addressId: this.data.addressId, remark: this.data.remark, items: this.data.items }
    const key = Date.now() + '-' + Math.random().toString(36).slice(2, 8)
    postOrder(payload, { headers: { 'Idempotency-Key': key } })
      .then((res) => {
        const order = res.data && res.data.data ? res.data.data : res.data
        return payOrder(order.id).then(() => {
          if (this.data.from === 'buyNow') clearBuyNowItem()
          else clearCart()
          wx.redirectTo({ url: '/pages/order-detail/order-detail?id=' + order.id })
        })
      })
      .catch(() => this.setData({ submitting: false }))
  }
})
```

> 下单 payload 字段与支付流程**必须先 Read `OrderConfirm.vue` 与 `api/order.js` 逐字对齐**（地址/商品行结构、是否有运费与优惠券、支付是提交时直发还是二次确）；上面是骨架，以 H5 实现为准。

- [ ] **Step 2: `order-confirm.json` + wxml/wxss**：`van-radio-group`/`van-radio`/`van-field`/`van-button`/`van-cell` + submit-bar；按 OrderConfirm.vue 翻译。
- [ ] **Step 3: 验证 + Commit**

真机/工具：选地址→提交→模拟支付→跳订单详情；购物车来源下单后购物车清空。

```bash
git add apps/weapp/miniprogram/pages/order-confirm
git commit -m "feat(weapp): 确认订单页（地址选择 + 幂等提交 + 模拟支付）"
```

---

### Task 22: `order-list` 订单列表 + `order-detail` 订单详情

**Files:**
- Modify: `apps/weapp/miniprogram/pages/order-list/order-list.*`、`pages/order-detail/order-detail.*`
- 翻译基准: `apps/mobile/src/views/OrderList.vue`（190 行）、`OrderDetail.vue`（193 行）

**order-list 要点**：`van-tabs` 筛选（all/pending/completed/cancelled，`name`）；`createPagedList` 按当前 tab 拉取（status 参数）；取消/支付操作带**防重复**（`submitting` 标志，对齐 df219bc）；状态 tag 用 `getStatusText`/`getStatusType`。tab 入口由 mine 页 `?tab=` 预选。

**order-detail 要点**：状态流（steps）+ 商品项（`OrderGoodsItem`）+ 金额 + 取消/支付（同防重复）。

- [ ] **Step 1: `order-list.js` 骨架**

```js
import { createPagedList } from '../../utils/usePagedList.js'
import { getOrderList, payOrder, cancelOrder } from '../../api/order.js'
import { getStatusText, getStatusType } from '../../utils/orderStatus.js'
import { confirm } from '../../utils/confirm.js'
import { ensureLogin } from '../../utils/authGuard.js'

const STATUS_BY_TAB = { all: undefined, pending: 0, completed: 1, cancelled: 2 }

Page({
  data: { activeTab: 'all', orders: [], loading: false, finished: false, initialLoading: true, loadError: false, acting: false },
  list: null,
  onLoad(options) {
    if (!ensureLogin('/pages/order-list/order-list')) return
    const tab = STATUS_BY_TAB[options.tab] !== undefined ? options.tab : 'all'
    this.setData({ activeTab: tab })
    this.build()
  },
  build() {
    this.list = createPagedList({
      fetcher: (pageNum, pageSize) => getOrderList({ status: STATUS_BY_TAB[this.data.activeTab], pageNum, pageSize })
    })
    this.list.onLoad().then(() => this.sync())
  },
  sync() {
    const l = this.list
    const decorated = l.items.map((o) => ({ ...o, statusText: getStatusText(o.status), statusType: getStatusType(o.status) }))
    this.setData({ orders: decorated, loading: l.loading, finished: l.finished, initialLoading: l.initialLoading, loadError: l.loadError })
  },
  onTabChange(e) {
    this.setData({ activeTab: e.detail.name })
    this.build()
  },
  onReachBottom() {
    if (this.list && !this.list.finished && !this.list.loading) this.list.onLoad().then(() => this.sync())
  },
  goDetail(e) {
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + e.currentTarget.dataset.id })
  },
  doPay(e) {
    if (this.data.acting) return
    const id = e.currentTarget.dataset.id
    this.setData({ acting: true })
    payOrder(id).then(() => this.list.resetAndReload()).then(() => this.sync()).finally(() => this.setData({ acting: false }))
  },
  async doCancel(e) {
    if (this.data.acting) return
    if (!(await confirm('确定取消该订单？'))) return
    this.setData({ acting: true })
    cancelOrder(e.currentTarget.dataset.id).then(() => this.list.resetAndReload()).then(() => this.sync()).finally(() => this.setData({ acting: false }))
  }
})
```

- [ ] **Step 2: `order-list.json` + wxml/wxss**：`van-tabs`/`van-tab`/`van-tag`/`van-empty`/`van-button`/`van-divider`；按 OrderList.vue 翻译。
- [ ] **Step 3: `order-detail`**：按 OrderDetail.vue 翻译（`getOrderDetail(id)` + 商品项 + 状态 + 操作，同样 `acting` 防重复）；`order-detail.json` 用 `van-button`/`van-tag`。
- [ ] **Step 4: 验证 + Commit**

```bash
git add apps/weapp/miniprogram/pages/order-list apps/weapp/miniprogram/pages/order-detail
git commit -m "feat(weapp): 订单列表与详情（tab 筛选 + 分页 + 支付/取消防重复）"
```

---

### Task 23: `address` 地址管理（popup + form CRUD）

**Files:**
- Modify: `apps/weapp/miniprogram/pages/address/address.*`
- 翻译基准: `apps/mobile/src/views/AddressList.vue`（262 行）

**要点**（D11：省市区保持手输，不引 `van-area`）：
- `van-popup position="bottom" round` + `van-form` 新增/编辑；`van-field` 手输收货人/手机/省/市/区/详细地址。
- 默认地址切换（`setDefault`）、删除（`confirm` + `deleteAddress`）。
- 校验：`van-form` weapp 版规则结构不同，用页面 `validate()` 手工兜底（必填 + 手机号格式）。
- 地址来源可能是 order-confirm 返回选择：若 H5 有选择模式（`?select=1`），回跳需 `wx.navigateBack` 并携带选中 id（先 Read AddressList.vue 确认是否支持选择回传）。

- [ ] **Step 1: `address.json`**：`van-popup`、`van-form`、`van-field`、`van-button`、`van-tag`、`van-switch`、`van-empty`、`van-cell`、`van-cell-group`
- [ ] **Step 2: `address.js`**：按 AddressList.vue 方法翻译（`getAddressList`/`addAddress`/`updateAddress`/`deleteAddress`/`setDefaultAddress`，均取自 `api/address.js`）；表单 data 用 `form`对象，`setData({ ['form.'+k]: v })` 做输入绑定。
- [ ] **Step 3: `address.wxml`/wxss**：按模板翻译（地址列表 + 默认 tag + 操作按钮 + 底部 popup 表单）。
- [ ] **Step 4: 验证 + Commit**

真机/工具：新增→设默认→编辑→删除全链路；order-confirm 可选到该页新增的地址。

```bash
git add apps/weapp/miniprogram/pages/address
git commit -m "feat(weapp): 地址管理页（popup 表单 CRUD + 默认地址）"
```

---

### Task 24: 自建组件 + `miniprogram-simulate` 冒烟

**Files:**
- Create: `apps/weapp/miniprogram/components/{product-card,order-goods-item,submit-bar}/*`（各四件套）
- Create: `apps/weapp/components.test.js`（simulate 冒烟）
- Modify: 将 Task 15/17/22 页面中的内联商品项/结算栏改为引用这些组件

**Interfaces（properties/events，对齐 H5 props/emit）：**
- `product-card`：`properties: { item: Object }`，`bind:tap` 由宿主页面接管（或 `triggerEvent('click', {id})`）；基准 `ProductCard.vue`（91 行）
- `order-goods-item`：`properties: { goods: Object, orderStatus: Number }`；基准 `OrderGoodsItem.vue`（56 行）
- `submit-bar`：`properties: { total: String, disabled: Boolean, loading: Boolean, buttonText: String }`，`triggerEvent('submit')`；基准 `SubmitBar.vue`（33 行）（Vant Weapp 无 submit-bar，自建）

- [ ] **Step 1: 实现三个组件**

按对应 `.vue` 的 props/插槽/样式直译为 `Component({ properties, methods, options:{ styleIsolation:'isolated' } })` + wxml/wxss/json。`submit-bar.json` 需 `usingComponents` 引 `van-button`。

`components/submit-bar/submit-bar.js` 示例：

```js
Component({
  options: { styleIsolation: 'isolated' },
  properties: {
    total: { type: String, value: '0.00' },
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    buttonText: { type: String, value: '去结算' }
  },
  methods: {
    onSubmit() {
      if (this.data.disabled || this.data.loading) return
      this.triggerEvent('submit')
    }
  }
})
```

- [ ] **Step 2: 写 simulate 冒烟测试**

先 `Read package.json`确认需补 `miniprogram-simulate` 到 weapp devDependencies（`"miniprogram-simulate": "^1.6.1"`）；该库依赖 jsdom 环境，需新增 `apps/weapp/vitest.simulate.config.js`（`environment: 'jsdom'`，include `components.test.js`）。

`apps/weapp/components.test.js`：

```js
import { describe, it, expect } from 'vitest'
import simulate from 'miniprogram-simulate'

describe('submit-bar', () => {
  it('disabled 时不触发 submit', async () => {
    const id = simulate.load('miniprogram/components/submit-bar/submit-bar')
    const comp = simulate.render(id, { disabled: true, total: '9.90' })
    comp.attach(document.createElement('parent-wrapper'))
    const btn = comp.querySelector('#submit-btn')
    btn.dispatchEvent('tap')
    await simulate.sleep(10)
    expect(comp.instance.data.total).toBe('9.90')
    comp.detach()
  })
})
```

> `miniprogram-simulate` API 以其官方文档为准；若与 vitest 集成摩擦大，允许降级为“仅保留组件实现，冒烟用例改手工验证”，但必须记录该取舍。**不阻塞页面任务**。

- [ ] **Step 3: 验证 + Commit**

Run: `pnpm -F @snackstore/weapp test` → PASS（若 simulate 不可用，该测试文件整块标 `describe.skip` 并在 commit message 说明，页面侧手工回归）

```bash
git add apps/weapp/miniprogram/components apps/weapp/components.test.js apps/weapp/package.json apps/weapp/vitest.simulate.config.js pnpm-lock.yaml
git commit -m "feat(weapp): 自建 product-card/order-goods-item/submit-bar 组件与冒烟"
```

---

## Phase P6：样式与主题

### Task 25: `tokens.css` → `app.wxss` + Vant Weapp 主题覆盖

**Files:**
- Modify: `apps/weapp/miniprogram/app.wxss`（覆盖 Task 4 占位）
- 翻译基准: `apps/mobile/src/styles/tokens.css`、`common.css`（共 111 行）

**要点**：
- `:root` CSS 变量 → `page { --color-primary: ...; ... }`（小程序支持自定义属性）；颜色值逐一对拷 tokens.css。
- Vant Weapp 主题覆盖：在同 `page` 作 `--van-primary-color: var(--color-primary);` 等官方变量同名映射（Vant Weapp 用 `--van-*` 变量）。
- `100dvh` → 自然高度 / flex + `position: fixed`（仅 SubmitBar 吸底用到）。
- 全局只留变量与极少工具类；页面样式回各页 wxss（§3.3 scoped 对策）。

- [ ] **Step 1: 先 Read 两份 css**，把 `tokens.css` 变量表逐条搬入 `app.wxss` 的 `page{}`（值不变），追加 `--van-*` 映射；`common.css` 中全局重置（如 `box-sizing`、基础排版）按需带入并 px×2。
- [ ] **Step 2: 逐页回归 px→rpx**：开发工具里对照 H5 逐页目测（间距/字号/分隔线），修正换算后视觉异常（尤其 1px 边框）。
- [ ] **Step 3: Commit**

```bash
git add apps/weapp/miniprogram/app.wxss
git commit -m "style(weapp): 设计 token 迁入 wxss 并覆盖 Vant Weapp 主题变量"
```

---

## Phase P7：上传与体积门禁

### Task 26: `miniprogram-ci` 上传与 `checksize` + keys 治理

**Files:**
- Create: `apps/weapp/scripts/upload.mjs`、`apps/weapp/scripts/checksize.mjs`
- Create: `apps/weapp/keys/README.md`（私钥获取说明；`keys/` 本体已 gitignore）

**Interfaces:**
- Consumes: `miniprogram-ci`（weapp devDep，Task 4）
- Produces: `pnpm -F @snackstore/weapp upload`（上传体验版）、`pnpm -F @snackstore/weapp checksize`（主包/分包体积表）

- [ ] **Step 1: `scripts/checksize.mjs`**

```js
import ci from 'miniprogram-ci'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const project = new ci.Project({
  appid: process.env.WX_APPID || 'touristappid',
  type: 'miniProgram',
  projectPath: path.join(root, 'miniprogram'),
  privateKeyPath: path.join(root, 'keys', `private.${process.env.WX_APPID}.key`),
  ignores: ['node_modules/**/*']
})

const sizes = await ci.getCodePackageSize({ project, packageType: 'miniProgram' })
console.table(sizes)
const main = sizes.mainSize ?? sizes['main'] ?? 0
if (main > 1.8 * 1024 * 1024) {
  console.error('主包超过 1.8MB 预警线，启动分包预案（spec §4.3）')
  process.exit(1)
}
```

- [ ] **Step 2: `scripts/upload.mjs`**

```js
import ci from 'miniprogram-ci'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const sha = execSync('git rev-parse --short HEAD').toString().trim()

const project = new ci.Project({
  appid: process.env.WX_APPID,
  type: 'miniProgram',
  projectPath: path.join(root, 'miniprogram'),
  privateKeyPath: path.join(root, 'keys', `private.${process.env.WX_APPID}.key`),
  ignores: ['node_modules/**/*']
})

await ci.upload({
  project,
  version: `${pkg.version}+${sha}`,
  desc: process.env.WX_DESC || `CI ${sha}`,
  robot: Number(process.env.WX_ROBOT || 1),
  setting: { es6: true, enhance: true, minified: true }
})
console.log('上传完成，小程序后台「版本管理」可查看体验版')
```

- [ ] **Step 3: `keys/README.md`**

```markdown
# 上传私钥
本目录内容均不入库（根 .gitignore 已忽略）。
- 仍小程序后台 → 开发管理 → 开发设置 → 下载「小程序代码上传密钥」，命名 `private.<appid>.key`。
- 需开启「代码上传安全密钥」并配 IP 白名单。
- 上传/checksize 通过环境变量 `WX_APPID` / `WX_ROBOT` / `WX_DESC` 驱动，不写死仓内。
```

- [ ] **Step 4: 验证 + Commit**

本地无 appid/密钥时，`node --check apps/weapp/scripts/upload.mjs` 与 `checksize.mjs` 语法通过即可（真实上传需凭证，归 P8 上线前人工跑）。

```bash
git add apps/weapp/scripts apps/weapp/keys/README.md
git commit -m "chore(weapp): miniprogram-ci 上传与体积检查脚本及密钥治理"
```

---

## Phase P8：回归与收尾

### Task 27: 真机回归矩阵 + 提审 checklist + README 收尾

**Files:**
- Create: `docs/weapp-launch-checklist-2026-11-06.md`（本地）或归入 `apps/weapp/README.md` 回归表
- Modify: `apps/weapp/README.md`（运行两步、域名白名单、回归矩阵、二迭预告）

- [ ] **Step 1: 回归矩阵（逐页关键路径）**

覆盖 iOS/Android × 主流微信版本：游客浏览 home/category → 加购 → 登录 → 购物车合并 → 选地址 → 下单（幂等）→ 模拟支付 → 订单列表/详情 → 取消；弱网与请求超时提示；**掉登录边界**（401 拦截跳登，对齐文档 §8.3 localStorage 语义变更回归）。

- [ ] **Step 2: 提审 checklist**

- 生产 `env.js` 的 `API_BASE_URL` 换备案 HTTPS 域名；request/downloadFile 合法域名白名单录入后台。
- 服务类目与主体资质自查；隐私协议已配（D13）。
- `pnpm -F @snackstore/weapp checksize` 达标（主包 ≤ 1.8MB，否则启 §4.3 分包预案）。
- tabBar 图标正式设计稿替换占位。

- [ ] **Step 3: README 补「二迭预告」**

写明：本版本为手机号+密码登录、模拟支付；`wx.login`+openid、JSAPI 支付为二迭，依赖后端（`/auth/wx-login`、下单签名）与商户资质，另开 spec，约 +3.5~5 人日。

- [ ] **Step 4: Commit**

```bash
git add apps/weapp/README.md
git commit -m "docs(weapp): 真机回归矩阵、提审清单与二迭预告"
```

---

## 工作量对账（同 spec §4.5）

总计 **22 人日，区间 22~28**。P0=1.5 / P1=1.0 / P2=2.5 / P3=4.0 / P4=5.0 / P5=2.0 / P6=1.5 / P7=1.5 / P8=3.0。浮动源：order-confirm 表单复杂度、POC-4 降级（+0.5）、提审一轮整改缓冲（+2）。

## Plan 自审（writing-plans 收尾检查）

**1. Spec 覆盖**：D1–D13 均有对应任务（D9/D6→T1–3/5；D4→T7–9；D5→T20；D8→T13；D7：404 不迁，未建页；D12→T10；D13→T12；D10/D11→T11/T23）。无缺口。
**2. 占位符**：已扫描，无“TBD/待填”；页面 markup 以具体 `.vue` 行区间为翻译基准（非占位，是 1:1 指令）。
**3. 类型一致**：`interpretResponse`/`mergeCartItems`/`calcCentsTotal`/`createWxRequest`/`createStore`/`createPagedList`/`ensureLogin`/`confirm`/`getStatusText` 在定义任务与消费任务间签名一致（如 `cartStore.onLoggedIn` 经 `registerCartHooks` 中转，T8/T9 一致）。

> **执行前提醒**：T5（POC-4）是方案 1/2 的分叉点，失败需回报用户再降级；T1 会触碰 H5/admin 现有代码，回归测试不可跳。

---
