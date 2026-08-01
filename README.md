# 零食商城前端 Monorepo

零食品商城的前端仓库，采用 pnpm workspace 管理的 monorepo，包含两个 Vue 3 应用与一个共享包。

## 项目结构

```
snackstore-frontend/
├── apps/
│   ├── mobile/    # C 端用户商城（Vant + Vue Router + Pinia）
│   └── admin/     # 管理后台（Element Plus + ECharts + Vue Router + Pinia）
├── packages/
│   ├── shared/        # 共享库：请求工厂、API 常量、工具（axios 封装）
│   ├── vite-config/   # 共享 Vite 配置（分包策略、br/gz 双压缩）
│   └── eslint-config/ # 共享 ESLint flat config（mobile/admin 通用）
├── docs/          # 文档（API 迁移指南、代码审查与整改报告）
└── pnpm-workspace.yaml
```

## 技术栈

- **构建**：Vite 8 + Rolldown
- **框架**：Vue 3.5（`<script setup>`）
- **路由**：Vue Router 5
- **状态**：Pinia 3
- **UI**：C 端 Vant 4 / 后台 Element Plus 2
- **图表**：ECharts 6（后台，懒加载 chunk）
- **工具链**：ESLint 10 + Prettier 3 + lint-staged + simple-git-hooks、Vitest 4、size-limit

## 环境要求

- Node >= 20
- pnpm >= 11

## 快速开始

```bash
pnpm install        # 安装依赖（首次需联网拉取 pnpm store）
pnpm dev            # 并行启动 mobile + admin 开发服务器
pnpm dev:mobile     # 仅启动 C 端
pnpm dev:admin      # 仅启动后台
```

## 常用脚本

| 脚本                                 | 说明                                                   |
| ------------------------------------ | ------------------------------------------------------ |
| `pnpm dev` / `dev:mobile` / `dev:admin` | 启动开发服务器                                         |
| `pnpm build`                         | 构建全部应用                                           |
| `pnpm preview`                       | 本地预览构建产物                                       |
| `pnpm lint`                          | ESLint 检查（`.` 全量）                                |
| `pnpm lint:fix`                      | ESLint 自动修复                                        |
| `pnpm format`                        | Prettier 格式化全量                                    |
| `pnpm format:check`                  | Prettier 校验（CI 用）                                 |
| `pnpm test`                          | 运行全部包的单测（Vitest）                             |
| `pnpm size`                          | 构建 + 首屏/分块体积预算检查（size-limit）             |
| `pnpm clean`                         | 清理 node_modules 与 dist（**不会**删除 `.workbuddy`） |

各 app 还支持 `build:analyze`（生成 `dist/report.html` 产物构成报告，不输出 sourcemap）。

## 环境变量

每个 app 支持 `.env.development` / `.env.production`（git 未跟踪，按需创建）：

| 变量              | 说明                                 | 默认                    |
| ----------------- | ------------------------------------ | ----------------------- |
| `VITE_API_TARGET` | 后端 API 地址（开发/生产可分别配置） | `http://localhost:8080` |

生产构建默认生成 **hidden** sourcemap（产物不引用、外部不可见，配合错误监控平台上传定位线上问题）；`build:analyze` 仅产出产物构成报告，不输出完整 sourcemap。

## 测试

测试基于 Vitest + @vue/test-utils / happy-dom，覆盖：

- `packages/shared`：请求拦截器、API 常量
- `apps/mobile`：`utils`（storage/orderStatus/sanitize）、`stores/cart`（账号隔离与游客合并）、`composables/usePagedList`
- `apps/admin`：`composables/useTable`（含 AbortController 防脏写）、`stores/auth`

```bash
pnpm test            # 全量
pnpm --filter @snackstore/mobile test   # 单包
```

## Git Hooks

`simple-git-hooks` 在 pre-commit 触发 `lint-staged`：暂存区的 `.js/.vue` 自动 `eslint --fix` + `prettier --write`，样式/文档类仅 `prettier --write`。