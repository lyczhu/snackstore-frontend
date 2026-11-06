# Snackstore Admin

零食商城管理后台，基于 Vue 3 + Element Plus 构建的后台管理系统。

## 技术栈

| 技术         | 版本   |
| ------------ | ------ |
| Vue          | 3.5.30 |
| Element Plus | 2.13.2 |
| Vue Router   | 5.0.3  |
| Pinia        | 3.0.4  |
| Axios        | 1.16.0 |
| Vite         | 8.0.10 |
| Sass         | 1.99.0 |

## 项目结构

```
src/
├── api/           # API 接口封装
├── router/        # 路由配置
├── utils/         # 工具函数
└── views/         # 页面组件
```

## 功能模块

- **用户管理** - 用户列表查询与管理
- **商品管理** - 商品信息管理、分类管理
- **订单管理** - 订单列表、订单详情
- **系统设置** - 系统配置管理

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 预览生产版本
pnpm preview
```

## 注意事项

- API 基址默认是相对路径 `/api`：本地 `pnpm dev` / `pnpm preview` 由 Vite `server.proxy` 在**进程内**转发到 `VITE_API_TARGET`；该代理**不会进入构建产物**，线上必须由部署入口提供 `/api` 反代，并配 SPA fallback 与 `.map` 屏蔽（Nginx 参考配置见 [apps/mobile/README.md](../mobile/README.md#部署说明)，两端一致）
- 使用 Pinia 进行状态管理
- 路由采用按需加载（懒加载）
