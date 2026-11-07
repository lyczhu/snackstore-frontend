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

后续接入 `miniprogram-ci` 上传（`pnpm --filter @snackstore/weapp upload`）时，
**上传前必须先 vendor**（`miniprogram_npm` 不存在则上传会缺组件）。

## 测试

逻辑层用 vitest（node 环境 + `test/wx-mock.js`），`@snackstore/shared` 经 `vitest.config.js`
的 alias 直指 shared 源码，不依赖 `miniprogram_npm`：

```bash
pnpm --filter @snackstore/weapp test
```
