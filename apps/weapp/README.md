# apps/weapp — 零食商城微信原生小程序

微信原生小程序端（WXML/WXSS/JS/JSON，JavaScript + JSDoc，无 TS、无打包步骤），
功能与 H5 端（`apps/mobile`）保持一致。业务逻辑复用 `@snackstore/shared` 的平台无关纯模块。

## ⚠️ 关键前提：不要用开发者工具的「构建 npm」

微信开发者工具（实测 2.02.2609250）在本工程的
**pnpm workspace + 嵌套 app（`project.config.json` 在 `apps/weapp`、`miniprogramRoot=miniprogram/`）**
布局下，「构建 npm」会**静默空跑**（耗时几十毫秒、零 `miniprogram_npm` 产物、无打包日志），
即便 `dependencies` 只剩一个普通包也一样。POC-4 已定性验证此结论。

因此本端改为**用脚本 vendor 生成 `miniprogram_npm`**：`scripts/vendor-npm.mjs` 把
- `@vant/weapp` 的 `lib/` 内容铺到 `miniprogram/miniprogram_npm/@vant/weapp/`；
- `@snackstore/shared` 的平台无关纯模块（`cart/storage/constants/response` + 纯 `index.js`）拷到 `miniprogram/miniprogram_npm/@snackstore/shared/`（**不含 axios**）。

weapp 代码一律用**子路径导入**（如 `@snackstore/shared/cart`），避免把带 axios 的 `shared` 入口拖进小程序。

## 本地开发步骤

```bash
# 1) 安装依赖（仓库根）
pnpm install

# 2) 生成 miniprogram_npm（每次新增/升级依赖后都要重跑）
pnpm --filter @snackstore/weapp run vendor:npm

# 3) 用微信开发者工具打开项目根目录 apps/weapp（不是 apps/weapp/miniprogram）
#    只点「普通编译」，绝对不要点「工具 → 构建 npm」（会覆盖/清空上面的产物）
```

- `miniprogram/miniprogram_npm/` 是**构建产物**，已在根 `.gitignore` 中忽略，不入库。
- `apps/weapp/project.private.config.json`（个人本地配置）与 `keys/`（上传私钥）同样不入库；
  `apps/weapp/project.config.json`（共享工程配置）与 `miniprogram/config/env.js`（无密钥）入库。

## CI

GitHub Actions（仓库根 `.github/workflows/ci.yml`）在 lint + 单测之后会执行：

```bash
pnpm --filter @snackstore/weapp run vendor:npm
```

并断言 `miniprogram_npm/@vant/weapp` 与 `miniprogram_npm/@snackstore/shared/index.js` 已生成，
确保「依赖变了但忘了 vendor」时流水线直接失败。

`miniprogram-ci` 上传（`pnpm --filter @snackstore/weapp upload`，见下方「上传体验版与体积门禁」）时，
**上传前必须先 vendor**（`miniprogram_npm` 不存在则上传会缺组件）。

## 测试

逻辑层用 vitest（node 环境 + `test/wx-mock.js`），`@snackstore/shared` 经 `vitest.config.js`
的 alias 直指 shared 源码，不依赖 `miniprogram_npm`：

```bash
pnpm --filter @snackstore/weapp test
```

### 组件层为何没有冒烟用例

`components/` 下的三个自建组件**未**接 `miniprogram-simulate`：该库需要 jsdom 环境，
与本工程逻辑层用的 node 环境 vitest 冲突，得再加一套独立运行时配置，收益不抵成本。

因此组件正确性走两条更便宜的路径：

1. **开发者工具「普通编译」**：能编译过就证明 `usingComponents` 路径、properties 名与
   wxml 绑定成立（这一步真实抓过 `@vant/weapp` 无 `swipe` 组件导致的整包启动失败）。
2. **页面走查**：即下方「真机回归矩阵」，覆盖插槽内容与样式在真实页面上的渲染。

_附带两个小程序组件写法（本次实现已按此处理）：组件根节点在自身作用域里恒为唯一子节点，
用 `:last-child` 去分隔线会反向失效（所有条目都判为 last）；宿主节点默认不保证是块级，
需要页面侧排版时用 `:host { display: block }` 显式声明。_

后续若组件分支逻辑多到值得投入，再单独开一个 jsdom project 补冒烟用例。

## 上传体验版与体积门禁

```bash
pnpm --filter @snackstore/weapp checksize
WX_APPID=wx... pnpm --filter @snackstore/weapp upload
```

两者都需要真实 appid 与上传私钥（获取方式与环境变量约定见 `keys/README.md`）；
缺凭证时脚本明确报错退出，不会用 `touristappid` 静默上传。
`checksize` 的主包预警线是 1.8MB（硬限 2MB），越线即触发 spec §4.3 的分包预案。

## 页面与 H5 对照

| 小程序页面 | H5 基准 | 要点 |
|---|---|---|
| `pages/home` | `Home.vue` | 搜索 400ms 防抖、分类筛选、Banner（推荐前 3，原生 `swiper`）、分页三态 |
| `pages/category` | `Category.vue` | 分类 tab + `createPagedList` 的 guard 分页 |
| `pages/cart` | `Cart.vue` | store 订阅合计、`van-stepper` 改量、删除、吸底结算栏 |
| `pages/mine` | `Mine.vue` | 用户卡、订单/地址入口、退出登录 |
| `pages/login` | `Login.vue` | 手机号+密码、页面层校验、`redirect` 回跳、注册入口 |
| `pages/product-detail` | `ProductDetail.vue` | `rich-text` 渲染详情（D5）、加购/直购、下架禁用 |
| `pages/order-confirm` | `OrderConfirm.vue` | 地址底部弹层、分单位合计、幂等键提交 |
| `pages/order-list` | `OrderList.vue` | 全部/待支付/已完成 三 tab、支付与取消防并发 |
| `pages/order-detail` | `OrderDetail.vue` | 状态 tag、地址、金额、模拟支付/取消 |
| `pages/address` | `AddressList.vue` | 列表 CRUD、设默认、弹层表单 |

有意差异（平台约束，非功能缺失）：

- tabBar 当前是纯文本无图标，仓库内没有设计稿资源，提审前需替换。
- Vant Weapp 没有 `form` 组件、`field` 也没有 `rules`，登录与地址表单的校验在页面层实现，
  规则与 H5 逐条一致（手机号 `^1[3-9]\d{9}$`、密码至少 6 位），错误文案走 `error-message`。
- Vant Weapp 没有 `swipe`，轮播一律用原生 `swiper`。
- 需登录的 tabBar 页（购物车）只在 `onLoad` 拦一次：tab 页无法被 `replace`，每
  次 `onShow` 自动跳登录会在返回后立刻再次 push 形成循环。

## 真机回归矩阵（Task 27）

iOS + Android 各跑一轮主流微信版本；下列路径需逐条打钩：

| 场景 | 路径 | 关注点 |
|---|---|---|
| 游客浏览 | home → category → product-detail | 列表分页/骨架/空态/错误重试；下拉刷新 |
| 游客加购 | product-detail 加入购物车 → cart | tab 角标数量、金额分单位无浮点漂移、stepper 不为 0 |
| 登录拦截 | cart / order-confirm / order-list / address | 未登录跳登录；登录后按 `redirect` 回到原页（tab 页走 `switchTab`） |
| 购物车合并 | 游客加购 → 登录 | guest 键合入用户键、guest 键清除（`mergeCartItems`） |
| 下单全链路 | cart → 选/新增地址 → 提交订单 | 幂等键生效（重试不产生重复单）、提交后购物车清空、直购快照只结算单件 |
| 支付与取消 | order-list / order-detail | 模拟支付后状态与列表刷新；操作进行中按钮不可点（防双击） |
| 地址管理 | address | 新增/编辑/设默认/删除；确认订单页返回后选择保持有效 |
| 弱网与超时 | 任意页 | 10s 超时提示、「加载失败，点击重试」不白屏 |
| 掉登录 | token 过期后请求 | 401 统一登出并跳登录，不静默失败（对齐 §8.3 存储语义变更） |
| 退出登录 | mine → 确定 | 购物车不清空，重登自动恢复 |

## 提审清单

- [ ] `miniprogram/config/env.js` 的生产 `API_BASE_URL` 换成**已备案 HTTPS** 域名。
- [ ] 后台「开发设置 → 服务器域名」录入 request（及 downloadFile，若有）合法域名；
      `urlCheck` 仅在开发者工具里关闭，线上域名必须配置正确。
- [ ] `pnpm --filter @snackstore/weapp checksize` 达标（主包 ≤ 1.8MB），否则启用分包预案。
- [ ] tabBar 图标按设计稿补齐，并把 `app.json` 的 `iconPath`/`selectedIconPath` 填上。
- [ ] 服务类目与主体资质自查；隐私保护指引已配置（D13，`wx.getPrivacySetting` 能力探测已就位）。
- [ ] `WX_APPID` + `keys/private.<appid>.key` 就位后跑 `upload`，体验版验证通过再提审。

## 二迭预告（本版不做）

本版登录为**手机号+密码**、支付为**模拟支付**（`PATCH /orders/{id}/status`），与 H5 完全对齐。
以下属于二迭范围，需后端与商户资质先行，另开 spec，估 3.5~5 人日：

- `wx.login` + openid 静默注册/登录（后端需 `/auth/wx-login`）。
- 微信 JSAPI 真实支付（需商户号、下单签名与支付回调对账）。
- 订阅消息、分享卡片等增长能力。

