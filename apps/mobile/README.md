# Snackstore Mobile

零食商城用户端，基于 Vue 3 + Vant 构建的移动端 B2C 电商平台前端。

## 技术栈

| 技术       | 版本   |
| ---------- | ------ |
| Vue        | 3.5.30 |
| Vant       | 4.9.24 |
| Vue Router | 5.0.3  |
| Pinia      | 3.0.4  |
| Axios      | 1.16.0 |
| Vite       | 8.0.10 |
| Sass       | 1.99.0 |
| DOMPurify  | 3.x    |

## 项目结构

```
src/
├── api/           # API 接口封装
├── router/        # 路由配置
├── stores/        # Pinia 状态管理
├── utils/         # 工具函数
└── views/         # 页面组件
```

## 功能模块

- **首页** - 商品展示、分类入口
- **分类** - 商品分类浏览
- **购物车** - 购物车管理、商品增减
- **订单确认** - 地址选择、订单提交
- **我的** - 用户中心、订单列表、收货地址

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

- 请求已配置代理，API 请求会自动转发到后端网关
- 使用 Pinia 进行状态管理（用户信息、购物车），购物车按账号隔离存储（`cartItems_<userId>`，游客为 `cartItems_guest`），登录时游客购物车自动合并
- 路由采用按需加载（懒加载）
- 商品详情富文本经 DOMPurify 白名单净化后渲染，防存储型 XSS
- 设计 Token 集中在 `src/styles/tokens.css`（品牌色/文字色/圆角等），Vant 主题通过 `--van-primary-color` 覆盖

## 部署说明

### SPA History 路由回退

项目使用 `createWebHistory`，生产环境必须配置 SPA fallback，否则刷新二级页面会 404。Nginx 参考配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;  # SPA fallback，必配
    }

    location /api/ {
        proxy_pass http://backend:8080;
    }

    # 静态资源开启 gzip（构建已分包，配合长缓存）
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1k;
}
```

### 其他

- 构建产物已按 `vendor-vue` / `vendor-vant` 分包，可为 `assets` 目录配置长缓存（`Cache-Control: max-age=31536000, immutable`）
- 若使用 CDN/OSS 图片服务，可在图片 URL 后拼接尺寸参数（如 `?x-oss-process=image/resize,w_400/format,webp`）进一步降低流量
