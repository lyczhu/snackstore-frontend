# 小程序实现路线对比：微信原生 vs uni-app

> 生成日期：2026-11-06
> 适用仓库：`snackstore-frontend`（`apps/mobile` 为迁移对象）
> 结论口径：**实测数据**均来自本仓库当次量测，附复现口径；**人日估算**为带假设的推断，已在每行标注估算依据，POC 后需回填实测值。

---

## 1. TL;DR

| | 分支 A：微信原生小程序 | 分支 B：uni-app（Vue 3 + Vite CLI） |
| --- | --- | --- |
| 首版工作量（估算） | **35 ~ 45 人日** | **30 ~ 38 人日** |
| 视图层复用率 | 0%（12 页 1845 行全重写） | 约 25%（语法保留，组件与样式仍需改） |
| 逻辑层复用率 | 约 35%（纯函数可搬，绑定层重写） | 约 80%（Vue 运行时存在，可直接搬） |
| 长期双端维护成本 | 每个功能改两遍，成本 +60%~100%（**未实测**，需 §7 POC 后以实际双端 PR 工时回填） | 一份代码 + 条件编译 |
| 微信新能力可达性 | 直通（glass-easel / Skyline / worklet / 分包异步化） | 靠透传开关；不透传的要混编原生页 |
| 编译层调试成本 | 无（报错栈直连源码） | 有（栈落在编译产物上） |
| 主包 2 MB 压力 | 低 | 中（框架运行时 + Vue 运行时占额度） |
| 现有工程化资产 | Vite / `@snackstore/vite-config` / vitest / size-limit 全部作废重建 | 大部分可续用，但需重接到 uni-app 模板 |
| **决定性变量** | 是否只发微信一端 + H5 是否长期共存 | 同一组判定项，两分支共用（见 §6） |

**一句话结论**：

- H5 要长期与小程序功能同步 → **选 B**，A 的双端成本会持续吃人。
- 小程序将成为唯一主力端、H5 退化为分享落地页或可下线 → **选 A**，此时 B 的复用红利归零，还要白付一层编译抽象的调试与体积成本。
- 只做微信小程序一个端 → **默认 A**。跨端框架的收益只有在真发多端时才兑现，而代价是恒定的。

---

## 2. 实测基线（本仓库当次量测）

### 2.1 代码分布（口径：`*.vue` / `*.js`，**排除 `*.test.js`**）

| 目录 | 文件数 | 行数 | 归类 |
| --- | --- | --- | --- |
| `views/` | 12 | 1845 | 视图层 |
| `components/` | 4 | 203 | 视图层 |
| `stores/` | 2 | 137 | 逻辑层 |
| `router/` | 1 | 105 | 逻辑层（平台绑定） |
| `composables/` | 1 | 83 | 逻辑层 |
| `api/` | 4 | 56 | 逻辑层 |
| `utils/` | 4 | 41 | 逻辑层 |
| `src/`（`App.vue` + `main.js`） | 2 | 28 | 入口 |
| **合计** | **30** | **2498** | — |

**关键比例（实测）**：视图层 `2048 / 2498 = **82%**`；逻辑层 `450 / 2498 = **18%**`。

> 这条数据直接修正了我此前对话中的口头估计（「约 60~70% 是视图层」）。真实占比是 **82%**，意味着：**无论选哪条分支，这次迁移的绝对主体都是视图层重写**；跨端框架能省的只是那 18% 的逻辑层搬运 + 视图层的「语法翻译」部分。

### 2.2 样式与组件（口径：`.vue` 文件内）

| 指标 | 实测值 | 影响 |
| --- | --- | --- |
| `<style scoped>` 块 | 15 / 16 个 `.vue` | A 分支无 scoped，样式隔离要手工命名约定；B 保留 scoped |
| 模板内 `Npx` 字面量 | 181 处 | 两分支都要换算 `rpx`（A 手改，B 可配 vite/unplugin 自动转） |
| 全局 css 行数（`styles/`） | 111 行 | 含 `:root` CSS 变量与 `100dvh`，两分支都要改写 |
| `van-*` 组件去重数 | **20 个** | 两分支都要逐个对照 Vant Weapp / uni-ui 的 prop 与 event |
| `van-*` 使用次数 | **94 处** | 对照工作量按次数计，不是按种类计 |
| `<router-link>` | 6 处 | A 无对应物，要改 `navigator` 调用 |

涉及的 20 个组件：`button empty field form icon image list nav-bar popup search skeleton stepper swipe swipe-item switch tab tabbar tabbar-item tabs tag`。

> 注：`van-toast` / `van-dialog` 在本项目是 **JS 调用式**（`showFailToast` / `showConfirmDialog`，并在 `main.js` 手动引样式），Vant Weapp 侧是组件实例 / `wx.showToast` 形态，**不是同名直译**，需单独改造。这部分不在上述 94 处里。

### 2.3 平台耦合点（口径：非测试代码）

| 模式 | 命中数 | A 分支处理 | B 分支处理 |
| --- | --- | --- | --- |
| `localStorage` | 16 | 全部改 `wx.setStorageSync` | 改 `uni.setStorageSync` |
| `document.` | 2 | 删除/重写（路由焦点管理） | 同 A（条件编译屏蔽） |
| `window.` | 3 | 改 `App.onError` 等 | 条件编译 |
| `history.state` | 3 | 改页面栈判断 | 改 `uni.navigateBack` 语义 |
| `import.meta.env` | 0 | — | — |

### 2.4 `packages/shared` 可复用资产（实测行数）

| 文件 | 行数 | 平台耦合 | 复用判断 |
| --- | --- | --- | --- |
| `request.js` | 76 | `axios`（7 处命中） | 概念与错误码映射可复用，代码要按 `wx.request` / `uni.request` 重写 |
| `errorTracking.js` | 130 | `window.`（2 处） | 通道逻辑可复用，监听源要换 `App.onError` |
| `api.js` | 39 | 无 | **可直接搬** |
| `constants.js` | 20 | 无 | **可直接搬** |
| `storage.js` | 15 | 无（`localStorage` 1 处仅注释） | **可直接搬** |
| `index.js` | 5 | 无 | 导出面调整 |

### 2.5 产物体积（实测，`pnpm -F @snackstore/mobile build`）

| 文件 | 体积 | gzip |
| --- | --- | --- |
| `vendor-vant.js` | 155.11 kB | 56.96 kB |
| `vendor-vue.js`（含 router/pinia/axios） | 73.86 kB | 28.14 kB |
| `vendor-misc.js` | 26.87 kB | 10.45 kB |
| `vendor-vant.css` | 97.24 kB | 38.51 kB |
| `dist` 总量 | 2.25 MB（其中 `.map` 1.56 MB，占 69%） | — |

**对照官方限制（已核实）**：单个分包 / 主包 **≤ 2 MB**；整个小程序所有分包 **≤ 30 MB**（服务商代开发 ≤ 20 MB）。

> 小程序端不能复用 Vant H5，需换成 Vant Weapp；上表只作为「当前依赖体量感念」参考。**uni-app 编译后额外占用主包的框架运行时具体 KB 数尚未实测**，见 §7 POC-2。

---

## 3. 分支 A：微信原生小程序

### 3.1 技术映射

| 现有 | 原生小程序 |
| --- | --- |
| `*.vue` SFC | `.wxml` + `.wxss` + `.js` + `.json` 四件套 |
| `ref` / `computed` / 响应式 | `data` + `this.setData()` |
| `v-for` / `@click` | `wx:for` / `bindtap`（`catchtap` 阻冒泡） |
| `props` / `emit` | `properties` / `triggerEvent` |
| unplugin 自动解析 `van-*` | 每个组件 `.json` 手写 `usingComponents` |
| `vue-router` + `createWebHistory` | `app.json` 的 `pages` + `wx.navigateTo` / `switchTab` |
| Pinia | `mobx-miniprogram` / 自建 store |
| axios `/api` 相对路径 | `wx.request` + **绝对 URL**（无 Vite 代理，无相对基址） |
| Vite 构建 + `.env` 注入 | 开发者工具内置编译 + 自写配置注入 |
| `App.onError` / `wx.onError` | 替代 `window` 错误监听 |
| `miniprogram-ci` | 替代 `dist` 上传 + 包体积报告 |

### 3.2 工作量拆解（估算）

| 模块 | 依据 | 人日（估） |
| --- | --- | --- |
| 工程脚手架：`app.json` / 分包规划 / eslint / `miniprogram-ci` / TS 与否 | 全新，无现成 | 2.0 |
| 请求层：`wx.request` 封装 + 拦截器等价物 + 错误码映射（参考 `shared/request.js` 76 行） | 概念复用，代码重写 | 1.5 |
| API 定义（`api.js` 39 + mobile `api/` 56 行） | 纯参数，近乎直译 | 0.5 |
| Store（`stores/` 137 行 + 持久化 16 处） | 逻辑直译，绑定层重写 | 1.5 |
| Utils（41 行）+ `orderStatus` + `safeParse` | 高复用 | 0.3 |
| 错误上报适配（130 行） | 监听源换 `App.onError` | 0.8 |
| **12 个页面视图层重写（1845 行）** | 0 复用；简单页 0.5d / 中等 1~1.5d / 复杂（`OrderConfirm` 表单+地址+提交栏）2d | **15.0** |
| 4 个组件重写（203 行） | 0 复用 | 2.0 |
| 样式落地：111 行全局 + 181 处 px → rpx + scoped 缺失的命名约定 | 语义复用，值重算 | 1.0 |
| Vant Weapp 接入：20 种 / 94 处 prop-event 对照 + toast/dialog 用法改造 | 全新对照工作 | 2.0 |
| 登录改造：`wx.login` + openid（现为手机号+密码） | 前端部分；**后端不在本仓库** | 2.0 |
| 支付接入：`wx.requestPayment`（现为模拟支付） | 前端部分；**后端不在本仓库** | 1.5 |
| 真机联调 + 兼容矩阵 + 提审 | 电商全链路回归 | 4.0 |
| 测试重建（现有 38 例多数作废，`miniprogram-simulate` 只能测组件） | 低复用 | 3.0 |
| **合计** | 逐项相加 = **37.1** | **37.1** |

**报数区间：35 ~ 45 人日**。浮动来源：页面视图层的 1.25 d/页（= 15 ÷ 12）是最脆弱的单一假设，若 POC-1 发现 Vant Weapp 能力缺口，上修至 1.5~1.8 d/页（约 +4~7 人日）。

### 3.3 风险清单

| # | 风险 | 等级 | 依据 | 缓解 |
| --- | --- | --- | --- | --- |
| A1 | **双端功能漂移**：同一需求两套实现，缺陷与体验分叉 | 高 | 视图层 82% 代码两份并行 | 建双端一致性 checklist；把可复用逻辑强制沉到 `packages/shared`；两端同 PR 提交 |
| A2 | **`setData` 性能模型**：频率与数据量是主瓶颈，长列表/富文本页首屏明显 | 中 | ProductDetail 富文本、Home 分页列表 | 列表虚拟化（`recycle-view`）、分页 size 下调、避免整对象 setData；POC-3 |
| A3 | **Vant Weapp 能力/样式与设计 token 不一致** | 中 | 20 种组件要逐个对照；`--van-primary-color` 那套 CSS 变量覆盖方式不同 | POC-1 先出缺口表；缺口组件自建（预算 +1~2d） |
| A4 | 后端未支持微信登录/支付，前端阻塞 | 高（外部依赖） | 现在只有密码登录 + 模拟支付 | 先确认微信商户资质与后端排期，再定开工时间 |
| A5 | **工程化资产断裂**：Vite / `vite-config` / vitest / size-limit / `.env` 约定全不适用 | 中 | 现有 `packages/vite-config`、`vitest.config.js` 与小程序无交集 | 单独建 `apps/weapp`，ESLint 复用 `eslint-config`；体积检查交给 `miniprogram-ci` 报告 |
| A6 | 主包 2 MB 超限 | 低~中 | 依赖体量小，但图片/iconfont 易失控 | 主包只放 tab 页与公共组件；订单/地址/详情进分包；图片走 CDN + 域名白名单 |
| A7 | 团队 Vue 心智切换成本 | 中 | 全员 Vue 3 背景 | 先 1 人做 3 天 spike 再全员铺开 |
| A8 | 提审被拒（类目/资质/诱导分享） | 低 | 电商需相应类目资质 | 预留 1 轮整改缓冲 2d |
| A9 | web-view 混编路线受业务域名白名单约束 | 中 | 需企业主体 + 备案 + https | 见 §5 混合路线 |

---

## 4. 分支 B：uni-app（Vue 3 + Vite CLI）

### 4.1 已核实的事实（避免凭印象）

- uni-app 官方已提供 `glass-easel` 的**透传开关**：`manifest.json` → `mp-weixin.componentFramework: "glass-easel"`、`glassEaselWebview: true`；`pages.json` 也可按页面开。**所以我此前「跨端框架不跟进新组件框架」的说法不成立**，已在对话中更正。
- 但 `Skyline` 的**交互动画体系**（worklet 动画、共享元素转场、自定义路由、半屏手势联动，以及「Skyline 页面无 10 层页面栈限制」）**不是配置项能透传的**，要写原生页面混编。
- glass-easel 自基础库 3.8.12 起支持 WebView 渲染引擎，官方口径覆盖约 98% 微信用户；Skyline 需微信 8.0.33/8.0.34+，Windows/Mac/企业微信端未支持。

### 4.2 工作量拆解（估算）

| 模块 | 与 A 的差异 | 人日（估） |
| --- | --- | --- |
| 工程脚手架：uni-app vue3-vite 模板 + eslint/CI + **重接 vitest / size-limit** | 比 A 多一道工具链缝合 | 2.5 |
| 请求层：`uni.request` 封装（或给 axios 写 adapter） | 逻辑层搬运成本低 | 0.7 |
| API 定义 | 近乎 0 改 | 0.2 |
| Store：Pinia 保留，仅换持久化（16 处） | A 要换库，B 不用 | 0.5 |
| Utils + `safeParse` | 直搬 | 0.2 |
| `usePagedList`（83 行）：`van-list` → `onReachBottom` 语义 | 仍需改 | 0.7 |
| 错误上报：`uni.onError` 适配 | 半复用 | 0.4 |
| **12 个页面**：模板语法保留，但要改 94 处 `van-*` 对照 + 181 处 px（可配自动转换）+ `router-link` 6 处 + 富文本 `v-html` → `rich-text` + DOM 调用条件编译 | 相对 A 省约 30% | **10.5** |
| 4 个组件 | 同上按比例 | 1.5 |
| 样式落地 | scoped 保留，px 可自动转 | 0.7 |
| Vant Weapp / uni-ui 接入（20 种对照） | **与 A 等量**，省不掉 | 2.0 |
| 登录改造 | 同 A | 2.0 |
| 支付接入 | `uni.requestPayment`，与 A 等量 | 1.5 |
| 真机联调 + 提审 + **编译层排错缓冲** | A 无此项 | 5.5 |
| 测试：vitest 组件测试多数可续跑 | 比 A 省 0.5 | 2.5 |
| **合计** | 逐项相加 = **31.4** | **31.4** |

**报数区间：30 ~ 38 人日**。B 的首版优势主要来自逻辑层搬运（37.1 → 31.4，约省 15%），**没有想象中的大**：因为实测视图层占 82% 代码量，而这部分两边都要大改。

### 4.3 风险清单

| # | 风险 | 等级 | 依据 | 缓解 |
| --- | --- | --- | --- | --- |
| B1 | **编译层调试成本**：报错栈落在编译产物上，框架自身 bug 要等发版 | 中高 | SFC → wxml/js 二次转换 | 保留原生基线对照页；关键页做「编译产物可读性」检查 |
| B2 | **新能力滞后 / 需混编**：Skyline worklet、共享元素、自定义路由无透传 | 中 | §4.1 | 需要时用原生混编页；**注意混编会蚕食「一套代码」的立论** |
| B3 | **主包被框架运行时挤占** | 中 | 主包 2 MB 硬线 | POC-2 实测基线；页面激进分包 + 预下载 |
| B4 | **多端红利可能永远兑不了**：只做微信端时，抽象层成本无对应收益 | 高（机会成本） | 需求方未确认是否发其他端 | 立项前确认端清单；只有确认 ≥2 端才选 B |
| B5 | Vant H5 依赖仍在 `apps/mobile/package.json`，小程序端组件库换掉后可能出现**双端 UI 体系分叉** | 中 | 20 种组件两套实现 | 定义设计 token 单一来源（`tokens.css` 语义层） |
| B6 | 工具链重接成本：`@snackstore/vite-config` 的 `compressAssets`/`manualChunks`/proxy 在小程序端**全部无意义** | 中 | 本次实测：`.gz/.br` 产物、`server.proxy` 均为 Web 专属 | 单列小程序端构建配置，不共用 vite-config |
| B7 | 条件编译（`#ifdef`）污染模板可读性 | 低 | 双端差异点约 16 处 | 差异集中到适配层，视图层尽量少写 ifdef |
| B8 | uni-app Vue 3 生态组件少于 Vue 2 版 | 低中 | 市场现状 | 优先用 Vant Weapp 原生组件 |
| B9 | 双端仍需各自真机验证（同源 ≠ 免测） | 中 | 渲染后端不同 | 回归矩阵不可省 |

---

## 5. 混合路线

| 形态 | 做法 | 适用 | 代价 |
| --- | --- | --- | --- |
| **A + web-view** | 原生为主干，低频页（协议、活动、帮助）用 `web-view` 嵌现有 H5 | 想尽快上线、H5 已有内容 | 业务域名白名单（企业主体 + 备案 + https）；web-view 内不能用 `wx.*`；支付/分享要在小程序侧另做 |
| **B + 原生混编** | uni-app 主干，Skyline 强需求页写原生 | 已有 uni-app 又要新交互 | 「一套代码」立论打折，等于同时维护两套心智 |
| **先 A 后合流** | A 上线，之后把可复用逻辑抽进 `shared`，等第三端需求出现再评估 B | 端清单未定 | 迁移二次成本 |

---

## 6. 决策判定表

按下列顺序判定，命中即停：

1. **需求里是否有微信以外的端（支付宝/抖音/H5 同源/App）？** 否 → 倾向 A。
2. **现有 H5 是否要在小程序上线后继续长期承载主流量？** 否 → 选 A（B 的复用红利归零）。
3. **是否强依赖小程序独有能力（Skyline 交互动画、直播、地图深度交互、群工具、云开发）？** 是 → 选 A。
4. **团队是否没有小程序专职人力、且只有 Vue 工程师？** 是且前 3 条都指向多端 → 选 B。
5. 仍不确定 → 先做 §7 的 POC-1 + POC-2（合计约 2 人日），拿到数据再定。

打分表（分数为我的主观判断，**不是实测**；两种场景用不同权重，因为「双端维护」这一维度在 H5 退场后基本不适用）：

| 维度 | 场景 1 权重（仅微信端、H5 可退场） | 场景 2 权重（多端 + H5 长期共存） | A | B |
| --- | --- | --- | --- | --- |
| 首版交付速度 | 20% | 15% | 3 | 4 |
| 长期双端维护成本 | 5% | 30% | 4 / 2* | 4 |
| 能力上限与性能 | 25% | 15% | 5 | 3 |
| 调试与问题定位 | 20% | 15% | 5 | 3 |
| 现有工程化资产保留 | 15% | 15% | 2 | 4 |
| 招聘与交接成本 | 15% | 10% | 4 | 4 |

\* A 分支在场景 1（无双端并存）下「双端维护」几乎不适用，故计 4 分；场景 2 下需两套实现，计 2 分。

| 结果 | A | B | 胜出 |
| --- | --- | --- | --- |
| 场景 1 加权 | **3.95** | 3.55 | A |
| 场景 2 加权 | 3.25 | **3.70** | B |

算法：场景 1 的 A = `3×0.20 + 4×0.05 + 5×0.25 + 5×0.20 + 2×0.15 + 4×0.15 = 3.95`；场景 2 的 B = `4×0.15 + 4×0.30 + 3×0.15 + 3×0.15 + 4×0.15 + 4×0.10 = 3.70`。

> 换权重试算过的结论：只要把「长期双端维护」权重从 30% 压到 5%，胜负方向就会翻转。**这张表最关键的输入不是各维度分数，而是「单端 vs 多端」这一个开关。**

---

## 7. POC 验证计划（把估算换成实测）

| # | 内容 | 人日 | 判定阈值 → 对结论的影响 |
| --- | --- | --- | --- |
| POC-1 | 把 §2.2 的 **20 种 `van-*` 组件**逐个对照 Vant Weapp，产出 prop/event 缺口表；额外核 toast、dialog、submit-bar、form 校验 | 0.5 | 缺口 ≤ 2 且不阻塞主流程 → A 的页面估算维持 1.25 d/页（总量 37 人日附近）；缺口 ≥ 5 → A 上修至 1.5~1.8 d/页（约 +4~7 人日） |
| POC-2 | 用 uni-app vue3-vite 官方模板建空工程 + 1 个 tab 页，编译到微信，读开发者工具的**主包基线体积** | 1.0 | 框架运行时占主包预算 < 15% → B3 风险降级；> 30% → B 必须从第一天就规划分包 |
| POC-3 | 原生实现 `ProductDetail`（富文本 + 长列表）真机测 setData 首屏耗时，与 H5 对照 | 0.5 | 明显劣于 H5 → A2 升为高风险，需要 recycle-view 预算 +2 人日 |
| POC-4 | 在原生工程用「构建 npm」引 `packages/shared` 的 ESM 源码，验证 workspace 包能否直用 | 0.5 | 不能直用 → A 需给 shared 加构建产物步骤（+1 人日），且影响「逻辑层复用 35%」的判断 |
| POC-5 | `wx.login` → 后端换 openid → 现有 JWT 打通（需后端配合） | 1.0 + 后端 | 走不通则两条分支都阻塞，优先级高于框架选型 |

合计前端约 **3.5 人日**，建议在选型会前先跑 POC-1 / POC-2 / POC-5。

---

## 8. 两分支共同的未决项（与选框架无关）

1. **后端不在本仓库**：`wx.login` + openid 换取、JSAPI 支付下单与签名、（可选）客户端错误上报端点，均需后端排期。参考 [api-path-migration-guide.md](./api-path-migration-guide.md)。
2. **资质清单**：小程序主体与服务类目、微信支付商户号、request/uploadFile/downloadFile 合法域名（必须 **HTTPS + 已备案**）。
3. **`localStorage` 语义变更**：16 处耦合点换成小程序存储后，现有游客购物车合并、掉登录边界的行为要重新回归。
4. **富文本渲染**：`v-html` + DOMPurify 在小程序侧不成立，`rich-text` 只支持 HTML 子集，商品详情的排版与净化策略需重设计。
5. **测试策略**：现有 77 例单测（shared 31 / admin 8 / mobile 38）中 mobile 的 38 例，A 分支多数作废、B 分支可续用大部分——这块差异未计入上表的人日，若按重训成本算约 ±1~2 人日。

---

## 9. 附录：量测复现方式

本文件 §2 的数据由以下口径得到，可在仓库根目录复现：

```powershell
# 2.1 生产代码分布（排除 *.test.js）
$s='apps/mobile/src'
gci -Recurse $s -Include *.vue,*.js -File | ?{ $_.Name -notmatch '\.test\.js$' } |
  group { $_.Directory.Name } | %{ "{0} files={1} lines={2}" -f $_.Name,$_.Count,
    (($_.Group | gc | Measure-Object -Line).Sum) }

# 2.2 组件与样式指标
$t = gci -Recurse $s -Include *.vue -File | gc
($t | sls '<van-[a-z][a-z0-9-]*' -AllMatches).Matches.Count   # 使用次数
($t | sls '<van-[a-z][a-z0-9-]*' -AllMatches).Matches.Value | sort -Unique   # 种类
($t | sls '\d+px' -AllMatches).Matches.Count                   # px 字面量

# 2.5 产物体积
pnpm -F @snackstore/mobile build
```

外部事实核实来源（2026-11-06 检索）：

- 分包体积限制（主包/单分包 ≤ 2 MB，全部分包 ≤ 30 MB，服务商代开发 ≤ 20 MB）：微信小程序官方文档「分包加载」
- glass-easel 迁移与配置项、基础库 3.8.12 起支持 WebView 渲染引擎：官方开发者文档 glass-easel 迁移章节
- Skyline 支持版本（安卓 8.0.33+ / iOS 8.0.34+ / Windows、Mac、企业微信未支持）、页面栈层数限制差异：官方 Skyline 兼容性文档
- uni-app 对 glass-easel 的透传配置：uni-app 官方教程「微信小程序适配 glass-easel」
