# Snackstore Weapp

零食商城的微信原生小程序端，功能与 H5 端（`apps/mobile`）保持一致。
WXML/WXSS/JS/JSON 四件套，JavaScript + JSDoc，**无 TypeScript、无打包步骤**——改完直接编译。

## 技术栈

- 微信原生小程序（基础库 3.18.0，开发者工具建议 ≥ 2.02）
- UI 库 `@vant/weapp`（Vant Weapp）
- 业务逻辑复用 `@snackstore/shared` 的平台无关纯模块（购物车合并、金额、状态文案、响应判定、存储）
- 状态管理：自建轻量 store（`state + subscribe + patch`，见 `utils/store.js`），不引第三方
- 测试：vitest（node 环境 + `wx` mock）

## 项目结构

```
apps/weapp
├── miniprogram/            # 小程序源码根（project.config.json 的 miniprogramRoot）
│   ├── app.js/json/wxss    # 启动接线、10 页注册、tabBar、设计 token
│   ├── api/                # product / order / user / address 参数层
│   ├── components/         # 自建组件：product-card / order-goods-item / submit-bar
│   ├── config/env.js       # 环境值（无密钥，入库）
│   ├── pages/              # home category cart mine login product-detail
│   │                       # order-confirm order-list order-detail address
│   ├── stores/             # user / cart（按账号隔离，游客态可合并）
│   ├── utils/              # request 适配层、usePagedList、confirm、toast、authGuard
│   └── miniprogram_npm/    # 构建产物，由脚本生成，不入库
├── scripts/                # vendor-npm.mjs / upload.mjs / checksize.mjs
├── test/wx-mock.js         # vitest 的 wx API 桩
├── keys/                   # 上传私钥（不入库，见 keys/README.md）
└── project.config.json     # 共享工程配置，入库
```

## 功能模块

| 页面 | 对应 H5 | 能力 |
| --- | --- | --- |
| `pages/home` | `Home.vue` | 搜索、分类筛选、Banner、分页列表 |
| `pages/category` | `Category.vue` | 分类切换 + 商品列表 |
| `pages/cart` | `Cart.vue` | 改数量、删除、合计、去结算 |
| `pages/mine` | `Mine.vue` | 用户信息、订单/地址入口、退出登录 |
| `pages/login` | `Login.vue` | 手机号+密码登录、注册、登录后回跳原页 |
| `pages/product-detail` | `ProductDetail.vue` | 图文详情、加购、立即购买 |
| `pages/order-confirm` | `OrderConfirm.vue` | 选收货地址、提交订单 |
| `pages/order-list` | `OrderList.vue` | 按状态筛选、支付/取消 |
| `pages/order-detail` | `OrderDetail.vue` | 订单详情、支付/取消 |
| `pages/address` | `AddressList.vue` | 地址增删改、设默认 |

与 H5 的差异（平台所致，不是功能缺失）：

- **tabBar 是纯文本**，没有图标；提审前需补设计稿并填 `iconPath`。
- 表单校验在页面层实现（Vant Weapp 无 `form` 组件、`field` 无 `rules`），规则与 H5 逐条一致。
- 轮播用原生 `swiper`（Vant Weapp 无 `swipe`）。
- 登录为手机号+密码、支付为模拟支付，与 H5 同口径；`wx.login` 与 JSAPI 支付不在本版。

## 开发

```bash
# 1) 安装依赖（仓库根执行）
pnpm install

# 2) 生成 miniprogram_npm（新增/升级依赖后必须重跑）
pnpm --filter @snackstore/weapp run vendor:npm

# 3) 用微信开发者工具打开 apps/weapp（不是 apps/weapp/miniprogram），点「普通编译」
```

> ⚠️ **绝对不要点「工具 → 构建 npm」**：本工程的 pnpm workspace + 嵌套 app 布局下它会静默空跑，
> 把第 2 步生成的产物清空，且没有任何报错。产物由 `scripts/vendor-npm.mjs` 生成。

- 引用 `@snackstore/shared` 必须写子路径（如 `@snackstore/shared/cart`），走裸包名会拖进 axios 导致运行时报错。
- `miniprogram_npm/`、`project.private.config.json`、`keys/` 不入库；`project.config.json` 与 `config/env.js` 入库。
- 后端基址在 `miniprogram/config/env.js`；本地联调需起 `http://localhost:8080`，没起时列表显示「加载失败，点击重试」属正常。
- 改 `packages/shared` 里的判定/算法/金额逻辑时，H5 与小程序在同一 PR 里一起改一起测：
  shared 是双端唯一数据源，只改一端就是引入漂移。

## 测试

```bash
pnpm --filter @snackstore/weapp test
```

覆盖 request 适配层、user/cart store、usePagedList、confirm 等逻辑件；
shared 经 `vitest.config.js` 的 alias 直指源码，不依赖 `miniprogram_npm`。
页面与组件层不做自动化，靠开发者工具编译 + [上线清单](../../docs/weapp-release-checklist-2026-11-06.md) 的回归矩阵兜底。

## 构建与上传

```bash
pnpm --filter @snackstore/weapp checksize   # 主包体积门禁，> 1.8MB 失败
pnpm --filter @snackstore/weapp upload      # 上传体验版，需 WX_APPID + keys/ 私钥
```

凭证获取与环境变量约定见 [keys/README.md](keys/README.md)。上传前必须先跑 `vendor:npm`，
否则上传的包里会缺组件。

## CI

仓库根 `.github/workflows/ci.yml`：lint → 单测 → `vendor:npm` → 断言产物存在。
上传不进 CI 主流程，按发布节奏人工触发（需要真实 appid 与私钥）。

## 相关文档

- 设计决策与实施修订：[docs/superpowers/specs/2026-11-06-weapp-native-migration-design.md](../../docs/superpowers/specs/2026-11-06-weapp-native-migration-design.md)
- 上线清单（回归矩阵、提审 checklist、范围外）：[docs/weapp-release-checklist-2026-11-06.md](../../docs/weapp-release-checklist-2026-11-06.md)
