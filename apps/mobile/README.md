# Snackstore Mobile

零食商城用户端，基于 Vue 3 + Vant 构建的移动端 B2C 电商平台前端。

## 技术栈

版本列为 `package.json` / pnpm catalog 声明的最低兼容范围；实际安装版本随 `^` 演进，以 lockfile 或 `pnpm list` 为准。

| 技术       | 版本范围 |
| ---------- | -------- |
| Vue        | ^3.5.30  |
| Vant       | ^4.9.24  |
| Vue Router | ^5.0.3   |
| Pinia      | ^3.0.4   |
| Axios      | ^1.16.0  |
| Vite       | ^8.0.10  |
| Sass       | ^1.99.0  |
| DOMPurify  | ^3.4.12  |

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

- API 基址默认是相对路径 `/api`：本地 `pnpm dev` / `pnpm preview` 由 Vite `server.proxy` 在**进程内**转发到 `VITE_API_TARGET`；该代理**不会进入构建产物**，线上必须由 Nginx 提供 `/api` 反代（见下方部署说明）
- 使用 Pinia 进行状态管理（用户信息、购物车），购物车按账号隔离存储（`cartItems_<userId>`，游客为 `cartItems_guest`），登录时游客购物车自动合并
- 路由采用按需加载（懒加载）
- 商品详情富文本经 DOMPurify 白名单净化后渲染，防存储型 XSS
- 设计 Token 集中在 `src/styles/tokens.css`（品牌色/文字色/圆角等），Vant 主题通过 `--van-primary-color` 覆盖

## 部署说明

### SPA History 路由回退与 API 反代

项目使用 `createWebHistory`，且 API 基址为相对路径 `/api`。生产环境有三处必配，缺一项直接可观测到的故障（均已在本地用静态服务器实测复现）：

| 配置项                      | 缺失后果                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `try_files ... /index.html` | 刷新或直达二级页（`/home`、`/product/1`）返回 404 白页                                                                                                             |
| `location /api/` 反代       | 数据全挂：无 rewrite 时接口 404，Toast 报「请求失败」；配了 rewrite 时 `/api/*` 命中 SPA 回退拿到 HTML，响应体无 `code` 字段，Toast 报「服务响应异常，请稍后重试」 |
| 屏蔽 `.map`                 | 还原后的源码对外可读（见下文）                                                                                                                                     |

```nginx
server {
    listen 443 ssl;
    http2 on;                        # nginx 1.25+；旧版本写进 listen 行
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;  # SPA fallback，必配
    }

    location /api/ {
        # ⚠️ 末尾不要加 '/'：加了会剥掉 /api 前缀，而网关外部路径本身就带 /api，将全量 404
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # hidden sourcemap 不生成 sourceMappingURL 注释，但 .map 文件仍在产物里，
    # 且文件名可由 index.html 的 chunk 名直接推出（xxx.js → xxx.js.map）
    location ~ \.map$ {
        return 404;
    }

    # 构建期已为 js/css/html/svg 同时产出 .gz 与 .br（见 packages/vite-config
    # 的 compressAssets），直接复用可省掉每次请求重复压缩的 CPU
    gzip_static on;                  # 先用 nginx -V 确认已编入 ngx_http_gzip_static_module
    # brotli_static on;              # 需自编译 ngx_brotli，官方包无此指令，照抄会启动失败

    # 预压缩文件缺失时的兜底
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1k;
}

# 80 仅用于强制跳转 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

### HTTPS

页面本身不依赖 secure context API（无 clipboard / Service Worker / 定位），http 下也能渲染。但仍必须上 HTTPS：

- 微信 JSAPI 支付的「支付授权目录」与「JS 接口安全域名」均要求 https 且已备案，http 页面会被拒绝（当前订单页为模拟支付，接入真实支付时需一并满足）
- 页面 https 而接口 http 时，错误上报请求会被浏览器作为 mixed content 拦掉
- 微信/QQ 内置浏览器对 http 外链有安全提示，直接吃掉转化

另：token 与购物车存在页面 origin 的 localStorage 里，**域名与协议一经上线不要更换**，否则全体用户掉登录、购物车清空。

### 上传产物时排除 sourcemap

`production` 使用 `sourcemap: 'hidden'`，含义是「生成文件但 JS 不引用」，而不是「不生成」。本地实测 `dist/assets` 下共 29 个 `.map`、1.56 MB，占产物总量 2.25 MB 的 69%：既白花流量，又泄露源码。

优先在 CI 上传阶段剔除（如 `rsync --exclude='*.map'`），Nginx 的 `return 404` 作为第二道防线。需上报平台还原堆栈时，只把 `.map` 传到监控平台，不传到公网服务器。

### 环境变量

均为构建期注入（`import.meta.env.VITE_*`），修改后必须重新 build 才生效：

| 变量                    | 作用                                                                  | 缺省                                        |
| ----------------------- | --------------------------------------------------------------------- | ------------------------------------------- |
| `VITE_API_TARGET`       | **仅** dev / preview 进程内 `server.proxy` 的转发目标，对构建产物无效 | `http://localhost:8080`                     |
| `VITE_API_BASE_URL`     | 运行时 API 基址，用于把请求指向独立网关域名                           | `/api`（同源）                              |
| `VITE_ERROR_REPORT_URL` | 前端错误上报端点，见 `packages/shared/src/errorTracking.js`           | 不发网络请求，错误仅 console 输出并告警一次 |

若不用 Nginx 同源反代，可改设 `VITE_API_BASE_URL=https://api.example.com/api`；此时后端需 CORS 放行 `Authorization` 头（拦截器会带 Bearer token，因而每次请求前多一次 OPTIONS 预检）。

### 其他

- 构建产物已按 `vendor-vue` / `vendor-vant` 分包，可为 `assets` 目录配置长缓存（`Cache-Control: max-age=31536000, immutable`）
- 若使用 CDN/OSS 图片服务，可在图片 URL 后拼接尺寸参数（如 `?x-oss-process=image/resize,w_400/format,webp`）进一步降低流量
