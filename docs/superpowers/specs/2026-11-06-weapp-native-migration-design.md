# 微信原生小程序端（apps/weapp）迁移设计

> 生成日期：2026-11-06
> 状态：已与需求方逐节确认通过
> 上游依据：[miniprogram-branch-comparison-2026-11-06.md](../../miniprogram-branch-comparison-2026-11-06.md) 分支 A（微信原生小程序）
> 迁移对象：`apps/mobile`（Vue 3 + Vant 4 H5 SPA，12 页 2498 行生产代码；小程序端落地 11 页，404 页按 D7 不迁）

---

## 0. 目标与决议总表

**目标**：以微信原生小程序（WXML/WXSS/JS/JSON 四件套）实现小程序端，功能与 H5 端保持一致。

| # | 决议项 | 结论 | 决策时点 |
| --- | --- | --- | --- |
| D1 | 登录/支付口径 | **首版与 H5 完全一致**：手机号+密码登录、模拟支付（`PATCH /orders/:id/status`）；不依赖后端新接口。`wx.login`/JSAPI 支付留作二迭，另开 spec | 澄清问答 |
| D2 | 工程落位 | monorepo 新建 `apps/weapp` 子包，纳入 pnpm workspace；复用 `eslint-config`/prettier；`@vant/weapp` + `@snackstore/shared` 走 npm + 开发者工具「构建 npm」 | 澄清问答 |
| D3 | 语言 | JavaScript + JSDoc（与仓库现有风格一致，无构建步骤） | 澄清问答 |
| D4 | 状态管理 | 自建轻量 store（~40 行，`state + subscribe + patch`），不引 mobx | 澄清问答 |
| D5 | 富文本 | `rich-text` 组件直接渲染详情 HTML（其自身不执行 script/事件属性）；DOMPurify/`sanitizeHtml` 在小程序侧无对应物也不需对应物 | 澄清问答 |
| D6 | 方案骨架 | 方案 1：@vant/weapp 全量对照 + shared 逻辑复用 + 首版不分包；POC-4（构建 npm 直用 workspace 包）作为实施第一步，失败降级为逻辑层自包含 | 方案选择 |
| D7 | 404 页 | **不迁移**（小程序无 URL 直达任意路径的场景，YAGNI）；这是与 H5 的唯一功能差异点 | §1 确认 |
| D8 | 导航栏 | 原生导航栏 + `navigationBarTitleText` 替代 `van-nav-bar`/`PageNavBar.vue`；tabBar 用 `app.json` 原生配置替代 `van-tabbar`/`Layout.vue` | §1 确认 |
| D9 | shared 重构 | 允许触碰 `packages/shared`：抽取 `interpretResponse` 纯函数 + 去 `import.meta.env` 全局化 + 购物车纯函数；H5/admin 同步切注入式配置 | §2 确认 |
| D10 | toast/dialog | 提示走原生 `wx.showToast`；确认弹窗封装 Promise 化 `wx.showModal`（`utils/confirm.js`） | §2 确认 |
| D11 | 省市区选择 | 不引 `van-area` + 行政区划数据，地址表单省市区保持与 H5 一致的手输 `van-field` | §3 确认 |
| D12 | 分页机制 | weapp 版 `usePagedList` 走页面生命周期 `onReachBottom` + `onPullDownRefresh`，不引 weapp-list 组件；请求取消由 AbortController 改为 **seq 序号守卫** | §3 确认 |
| D13 | 隐私弹窗 | P7 纳入 `wx.requirePrivacyAuthorize` 隐私协议弹窗——H5 无此物，但提审硬要求 | §4 确认 |

**明确不含（本 spec 范围外）**：

- `wx.login` + openid 换取、JSAPI 支付下单签名（二迭，前端约 +3.5~5 人日，且依赖后端排期与商户资质）；
- web-view 混编路线（文档 §5，未选用）；
- Skyline / glass-easel 新渲染引擎专项（首版用默认 WebView 渲染）。

---

## 1. 工程结构与脚手架

```
apps/weapp/
├── miniprogram/              # 小程序源码根（开发者工具项目目录指向此处）
│   ├── app.js                # App()：onLaunch 恢复登录态/购物车；onError/onUnhandledRejection 接错误上报；隐私弹窗
│   ├── app.json              # 11 页面注册 + 原生 tabBar + window 样式
│   ├── app.wxss              # 全局样式：tokens.css 语义变量 → page{} CSS 变量 + rpx
│   ├── pages/
│   │   ├── home/ category/ cart/ mine/          # 4 个 tab 页
│   │   ├── login/ product-detail/ order-confirm/
│   │   ├── order-list/ order-detail/ address/
│   ├── components/           # 自建组件：product-card / order-goods-item / submit-bar
│   ├── stores/               # 自建轻量 store：user.js / cart.js（订阅 + wx.storage 持久化）
│   ├── api/                  # product / order / user / address（复用 shared 参数工厂）
│   ├── utils/                # store.js / request.js / usePagedList / confirm / orderStatus / storage
│   ├── config/               # env.js（API 基址注入）
│   └── images/tabbar/        # tabBar 图标 8 张 PNG（4 tab × 选中/未选）
├── scripts/upload.mjs        # miniprogram-ci 上传 + checksize
├── project.config.json       # appid 占位、es6/enhance 编译开关、packNpmManually
├── package.json              # @vant/weapp + @snackstore/shared（构建 npm → miniprogram_npm/）
├── keys/                     # 上传私钥（.gitignore 忽略，仅 README 说明获取方式）
├── config/env.example.js     # 模板入库；env.js 进 .gitignore（与 .env 治理同构）
└── README.md                 # 运行两步（构建 npm → 打开工具）、域名白名单清单、上传流程
```

要点：

- **tabBar 角标**：购物车数量用 `wx.setTabBarBadge` / `removeTabBarBadge`，在 cart store 订阅回调里同步。
- **登录拦截**（`requiresAuth` 等价物）：需登录页面在 `onLoad` 检查 `userStore.isLoggedIn()`，未登录 `wx.navigateTo('/pages/login/login?redirect=当前页全路径')`；登录成功后按 redirect 回跳（`wx.redirectTo`，tab 页目标改用 `wx.switchTab`），对齐 H5 `query.redirect` 语义。
- **ESLint**：`apps/weapp` 纳入根 `eslint.config.js`，为小程序全局（`wx` / `App` / `Page` / `Component` / `getApp` / `requirePlugin`）声明 `globals`；风格与现仓库一致（JSDoc、无 TS）。
- **尺寸换算**：H5 按 375 视口的 `Npx` → `rpx` 机械 `×2`（750 基准）；1px 边框换算后视觉异常在各页回归时目测修正。

---

## 2. 请求层与状态管理

### 2.1 请求层分层

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 传输适配 | `apps/weapp/miniprogram/utils/request.js`（~60 行） | `wx.request` Promise 化，实现与 axios 实例**同签名 shim**：`get/post/put/patch/delete(url, { params, data, headers })` → `Promise<resBody>`；`shared/api.js` 三个参数工厂**零改动直接复用**。signal 参数接受但忽略（取消语义由 usePagedList 的 seq 守卫承担） |
| 业务码语义 | `packages/shared/request.js`（本次重构） | 新增导出纯函数 `interpretResponse({ httpStatus, body, timeout, networkError }) → { action: 'ok' \| 'business-error' \| 'unauthorized' \| 'forbidden' \| 'server-error' \| 'network', message, data }`；H5/admin 的 axios 拦截器与小程序适配层都调它——**401/403/500 文案映射、`API_SUCCESS_CODE` 判定、非法响应防御只存在一份** |
| 页面调用 | `apps/weapp/miniprogram/api/*.js` | 与 H5 `src/api/` 一一对应；`postOrder` 幂等键经 `headers` 透传 |

**shared 必要重构（D9）**：

1. `createRequest` 拦截器内部改为调用 `interpretResponse`，对外行为不变；
2. `shared/request.js` / `errorTracking.js` 去除 `import.meta.env` 直读（小程序「构建 npm」的 ES5 转译对 `import.meta` 语法报错）：环境配置一律 options 注入（`baseURL` / `errorReportUrl` / `isDev`）；H5 侧改在 `apps/mobile/utils/request.js` 与 `main.js` 传值。`apps/admin` 同步适配注入调用点。
3. 新增 `packages/shared/src/cart.js`：`mergeCartItems(guestItems, userItems)`（同 productId 累加、否则追加）与 `calcCentsTotal(items)`（分单位累加再除 100 防浮点漂移）两个纯函数 + 单测。
4. shared 增量全部配 vitest 单测；mobile/admin 现有测试保持全绿。

**baseURL 与配置注入**（遵循多级回退规范：显式传入 > 环境配置 > 默认值，空串视为未配置）：

- `apps/weapp/miniprogram/config/env.js`：`baseURL: options.baseURL || env.API_BASE_URL || 'http://localhost:8080/api'`（小程序无同源反代，**必须绝对地址**）。
- 治理复制 H5 惯例：`config/env.example.js` 入库、`config/env.js` 进 `.gitignore`；开发默认 `http://localhost:8080/api`（开发者工具勾选「不校验合法域名」可打本地 http），生产占位 `https://api.example.com/api`（上线前换备案 HTTPS 域名并加入 request 合法域名白名单，README 列清单）。
- `timeout` 对齐 mobile 现值 10000ms。

**401 / 登录态**：

- `getToken: () => userStore.token`（store 唯一数据源，`wx.storage` 仅持久化层）；
- `onUnauthorized`：`userStore.logout()` + `wx.navigateTo('/pages/login/login?redirect=…')`；
- `onError`：`wx.showToast({ icon: 'none' })`（D10）。

### 2.2 自建轻量 store（D4）

`utils/store.js`（~40 行）：`createStore(initialState)` → `{ state（约定仅 actions 可改）, getSnapshot(), subscribe(fn), patch(partial) }`。页面 `onLoad` subscribe + 回调 `setData`，`onUnload` 退订。

**`stores/user.js`**：

- 结构对齐 H5：`token` / `userInfo`；`isLoggedIn()` getter；actions `setLogin(data)` / `logout()` / `updateUserInfo(data)`。
- 持久化键沿用 `'token'` / `'userInfo'`，`wx.setStorageSync`；`initFromStorage()` 在 `app.js onLaunch` 调用一次。
- `setLogin` 内部：写用户态 → 显式调用 `cart.onLoggedIn(newId)`（函数直调，不做双 store 订阅，避免循环依赖）。

**`stores/cart.js`**：

- 状态 `items` / `buyNowItem`（内存快照不持久化，对齐 H5）；派生 `getTotalCount()` / `getTotalPrice()`（调 shared `calcCentsTotal`）。
- 键 `cartItems_{userId|guest}` 语义不变；读写走 `wx.getStorageSync` / `wx.setStorageSync`；`safeParse` 复用 shared。
- **游客合并**（shared `mergeCartItems` 同一份实现）：
  - `onLoggedIn(id)`：读 guest 键 + 读用户键 → merge → 写用户键 → 删 guest 键 → `patch`；
  - `onLoggedOut()`：切换到 guest 键重载（用户键数据保留，重登恢复）；
  - H5 侧现有 `watch` 写法同步改为在 `setLogin` 里显式调用同一纯函数——合并语义两份实现收口为一份。
- `addItem` / `updateQuantity`（`Math.max(1, q)`）/ `removeItem` / `clearCart` / `setBuyNowItem` / `clearBuyNowItem` 按 H5 行为直译。

### 2.3 错误上报通道（对齐四级优先级设计）

- shared `errorTracking.js` 重构后保留平台无关逻辑：`type|message` 去重、`MAX_SENDS=20` 封顶、payload 截断；`location`/`navigator` 取值改 `typeof` 防御式（小程序下自然缺省）。
- weapp 侧监听源：`App()` 的 `onError` + `onUnhandledRejection` → `reportError(err, { type })`；context 补充 `scene` / `version`。
- 通道优先级语义不变：注入 `reporter`（weapp 内置注入 `wx.request` POST 实现）> `isDev` 仅 console > 配置 `errorReportUrl` 走内置通道 > 兜底 console + 一次性告警。

---

## 3. 页面层与组件对照

### 3.1 二十种 van-\* → Vant Weapp 映射

| H5 用法 | Weapp 等价 | 处理 |
| --- | --- | --- |
| `van-button` | `van-button` | `type/size/plain` 同名；`@click`→`bind:tap`；loading 防重复点击语义保留（对齐订单操作防重复机制） |
| `van-empty` | `van-empty` | `image="error"` 可用；点击重试外层 view `bindtap` |
| `van-list` | `onReachBottom` 页面事件（D12） | loading/finished/error 三态映射 `van-divider` 文案；seq 守卫丢过期响应 |
| `van-skeleton` | `van-skeleton` | `row` 同名 |
| `van-tag` | `van-tag` | `type` 同名；颜色走主题变量覆盖 |
| `van-tabs / van-tab` | `van-tabs / van-tab` | `name` 同名；`v-model:active`→`bind:change` 受控 |
| `van-search` | `van-search` | `v-model`→`bind:change`，300ms 防抖保留 |
| `van-field / van-form` | `van-field / van-form` | 校验规则结构不同：weapp 用 `{required,maxlength,validator}` + `bind:submit` 的 `event.detail.values`；页面 `validate()` 手工兜底 |
| `van-popup` | `van-popup` | `position="bottom" round` 同名 |
| `van-image` | `van-image` | `lazy-load` 原生支持（无需 Lazyload 插件）；error slot 等价 |
| `van-swipe-cell` | `van-swipe-cell` | 购物车左滑删除；`right-button` slot 机制不同，`bind:close` 手工控制 |
| `van-stepper` | `van-stepper` | `min/max/step` 同名；`bind:change` |
| `van-switch` | `van-switch` | `use-slot` 差异忽略 |
| `van-icon` | `van-icon` | 名称体系一致 |
| `van-radio-group` | `van-radio-group / van-radio` | 订单确认选地址；`bind:change` |
| `van-nav-bar` + `PageNavBar.vue` | 不迁（D8） | 原生导航栏替代 |
| `van-tabbar`（Layout.vue） | 不迁（D8） | 原生 tabBar 替代 |
| SubmitBar.vue（自封装） | 自建 `submit-bar` 组件 | 结算栏 + disabled + loading，对齐 33 行现行为 |
| `showFailToast` | `wx.showToast({icon:'none'})` | D10 |
| `showConfirmDialog` | `utils/confirm.js`：Promise 化 `wx.showModal` | 取消/确认 resolve-reject 分支语义与 H5 一致 |

### 3.2 页面清单（11 页，全主包）

| 页面 | H5 行数 | 难度 | 关键点 |
| --- | --- | --- | --- |
| home | 202 | 中 | 搜索 + 分页列表 + 分类入口 |
| category | 111 | 易 | tabs + 列表 |
| cart | 124 | 中 | swipe-cell 删除、stepper、submit-bar、空态 |
| mine | 143 | 易 | 用户信息 + 订单入口 |
| login | 148 | 中 | 手机号+密码、redirect 回跳、register 切换 |
| product-detail | 160 | 复杂 | `rich-text` 渲染详情（D5）、加购/立即购买（`setBuyNowItem`）、图片轮播 |
| order-confirm | 246 | **最复杂** | 地址 radio + 商品清单 + 备注 + 金额 + 幂等键提交 + 模拟支付 |
| order-list | 190 | 中 | tabs 筛选 + 分页 + 取消/支付（防重复） |
| order-detail | 193 | 中 | 状态流 + 商品项 + 金额 |
| address | 262 | 复杂 | popup+form CRUD、默认地址、省市区手输（D11） |
| （404） | — | — | 不迁移（D7） |

自建组件：`OrderGoodsItem`（56 行）、`ProductCard`（91 行）直译；`PageNavBar`/`Layout`/`SubmitBar` 分别由 D8/D8/自建 submit-bar 替代。

### 3.3 样式与 token

- `tokens.css` 的 `:root` 变量 → `app.wxss` 的 `page { --color-primary: … }`（小程序支持 CSS 变量）；Vant Weapp 主题覆盖走其官方 `--van-*` 变量同名机制。
- **scoped 缺失对策**：全局只放变量与极少工具类；页面样式写页内 wxss；自定义组件 `styleIsolation: 'isolated'` 天然隔离；类名沿用 H5 BEM 风格。
- `100dvh` 场景（吸底 SubmitBar）用 flex 布局 + `position: fixed` 实现。

### 3.4 tabBar 图标

原生 tabBar 需 PNG（81×81），4 tab × 2 态 = 8 张放 `miniprogram/images/tabbar/`。实施期用最简图形占位，README 标注待设计替换。

---

## 4. 测试、CI、分包预案与实施拆解

### 4.1 测试策略

| 层 | 工具 | 范围 |
| --- | --- | --- |
| shared 纯逻辑 | vitest（现有配置扩跑） | `interpretResponse` 全分支、`mergeCartItems`、`calcCentsTotal`、`getOrderStatusText`、`safeParse`、API 工厂 URL 拼装（新增 15~20 例，现有 31 例不回归） |
| weapp 逻辑件 | vitest + `wx` mock（参照 shared `test/storage-polyfill.js` 做法） | request 适配层（shim 签名、Header 注入、超时）、user/cart store（游客合并/切 guest/下限 1）、weapp usePagedList（seq 守卫）、env 回退链——对应平移 mobile 4 文件约 29 例 |
| weapp 组件 | `miniprogram-simulate`（2 例冒烟） | submit-bar 渲染 + disabled、product-card 点击 detail |
| 页面 | 不做自动化，真机回归矩阵（P8） | 11 页 × 关键路径 checklist；承认缺口，矩阵兜底 |

`sanitize.test.js` 随 DOMPurify 链路消亡作废（D5）。

### 4.2 CI 上传与体积门禁

- `scripts/upload.mjs`：miniprogram-ci 上传；版本号 = `package.json version` + `git rev-parse --short HEAD`；`--robot` 区分 CI/人工；私钥 `keys/private.{appid}.key` 进 `.gitignore`（模板/说明入库，与 `.env` 治理同构）。
- `checksize`：miniprogram-ci 代码包大小查询输出主包/分包体积表，替代 size-limit 门禁。
- 本地开发零上传依赖：开发者工具直接打开 `apps/weapp/miniprogram`（构建 npm 后）。

### 4.3 分包预案（首版不分包）

- 触发条件：`checksize` 报告主包 > 1.8 MB（2 MB 红线留 10% 余量）。
- 拆分顺序：`order/` 分包（confirm/list/detail）→ `user/` 分包（address）；product-detail 与 tab 页、公共组件、store 恒留主包。
- 预案启用时加 `preloadRule`（tab 页 `onShow` 预下载 `order` 分包）。
- 图片一律 CDN + downloadFile 域名白名单；`images/` 只放 tabBar 图标与兜底图（单图 > 50 KB 上 CDN）。

### 4.4 实施 Phase 拆解

| Phase | 内容 | 验收标准 | 人日 |
| --- | --- | --- | --- |
| P0 shared 前置重构 | `interpretResponse` 抽取、去 `import.meta.env`、cart 纯函数 + 单测；mobile/admin 切注入式 | 三端 vitest 全绿；H5 手工冒烟登录+列表+下单 | 1.5 |
| P1 脚手架 + POC-4 | `apps/weapp` 骨架（app.json/ESLint/目录/README）；构建 npm 实测 @vant/weapp 与 workspace shared 直用；**失败触发降级**（shared 加 CJS 产物 +0.5d，转逻辑自包含） | 工具打开空壳工程，demo 页渲染 van-button 并调通 mock 请求 | 1.0 |
| P2 基础设施 | request shim、env、user/cart store、usePagedList（seq）、confirm/toast 封装、错误上报接线 | 4.1 第二行全部 vitest 绿 | 2.5 |
| P3 tab 页 + 登录 | home/category/cart/mine/login、tabBar 图标与角标、登录拦截回跳 | 真机：游客浏览→加购→登录→购物车合并全链路 | 4.0 |
| P4 核心交易页 | product-detail（rich-text）/ order-confirm / order-list / order-detail | 真机：下单→支付→取消完整回归 | 5.0 |
| P5 address + 组件收尾 | address CRUD、simulate 冒烟 2 例 | 4.1 第三行绿；地址 CRUD 真机过 | 2.0 |
| P6 样式 token 与视觉回归 | tokens→wxss、px→rpx 全页、Vant Weapp 主题覆盖 | 对照 H5 逐页截图 checklist | 1.5 |
| P7 CI/体积/提审材料 | upload.mjs、checksize、域名白名单清单、类目资质自查、**隐私协议弹窗（D13）** | 体验版可扫码；checksize 达标 | 1.5 |
| P8 真机回归 + 缓冲 | iOS/Android × 微信版本矩阵、弱网、掉登录边界回归 | checklist 签字 | 3.0 |
| **合计** | | | **22.0** |

### 4.5 工作量对账（vs 对比文档 §3.2 的 37.1）

| 差异项 | 文档 | 本计划 | 原因 |
| --- | --- | --- | --- |
| 登录改造 | 2.0 | 0 | D1 首版手机号+密码 |
| 支付接入 | 1.5 | 0 | D1 沿用模拟支付 |
| 页面+组件+样式 | 18.0 | 12.5 | 对照表与页面难点已在设计期判定；shared 复用后 api/merge/金额零搬运 |
| 脚手架/请求/上报/测试 | 7.6 | 7.0 | 逻辑测试平移而非全重建；POC-4 不过 +0.5 |
| 真机联调+提审 | 4.0 | 3.0 | 无微信登录/支付链路联调；新增隐私弹窗（含 P7） |
| 净增 | — | +1.5 | shared 重构（P0），文档未单列 |

**报数：22 人日，区间 22 ~ 28**（浮动源：order-confirm 表单复杂度、POC-4 降级、提审一轮整改缓冲 2d）。口径声明：与文档 37.1 **非同口径**——本计划不含登录/支付改造（二迭另开 spec，约 +3.5~5 人日）。

---

## 5. 风险承接（对照文档 §3.3）

| 风险 | 本设计的承接 |
| --- | --- |
| A1 双端漂移 | D9：判定逻辑/合并算法/金额计算沉 shared 一份；双端同 PR 提交约定写入 weapp README |
| A2 setData 性能 | seq 守卫防脏写；分页 size 与 H5 一致；列表不做整对象 setData；超标再引 recycle-view（预案） |
| A3 Vant Weapp 能力缺口 | §3.1 对照表已按实测用法逐项判定；缺口组件自建预算已含（submit-bar） |
| A4 后端依赖 | D1 首版归零该风险；二迭前需后端确认 `/auth/wx-login` 与 JSAPI 下单排期 |
| A5 工程化断裂 | eslint-config 复用、`.env` 治理同构、size-limit 由 checksize 替代 |
| A6 主包超限 | §4.3 分包预案 + 图片 CDN 纪律 |
| A7 心智切换 | TDD：逻辑层先测后页；页面层 checklist 化 |
| A8 提审被拒 | 类目资质自查进 P7 checklist；隐私弹窗（D13）提前到首版；预留 2d 整改缓冲已含区间 |

## 6. 未决项（与选型无关，上线前需外部确认）

1. 生产 API 域名（备案 HTTPS）与 request/downloadFile 合法域名白名单；
2. 小程序 appid 与主体、服务类目资质；
3. tabBar 图标的正式设计稿；
4. 错误上报端点 `errorReportUrl` 是否启用（缺省不发送，与 H5 口径一致）。
