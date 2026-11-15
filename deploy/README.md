# 部署说明（H5 两站点）

本目录承载 `apps/mobile`（C 端 H5）与 `apps/admin`（管理后台）的容器化部署配置。
小程序的发布不在这里，见 `docs/weapp-release-checklist-2026-11-06.md`。

## 目录

| 文件                      | 作用                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| `Dockerfile.web`          | 通用镜像：Node 构建 → Nginx 承载；用 `--build-arg APP=mobile\|admin` 选择站点 |
| `nginx/spa.conf.template` | 站点配置模板，容器启动时由官方镜像的 envsubst 渲染                            |
| `docker-compose.yml`      | 两站点一起起，端口 8081 / 8082                                                |
| `../.dockerignore`        | 排除 `node_modules`、`dist`、`docs`，避免宿主产物带进镜像                     |

## 快速开始

```bash
# 仓库根目录执行
docker compose -f deploy/docker-compose.yml up -d --build

# 查看状态（两个服务都应为 healthy）
docker compose -f deploy/docker-compose.yml ps

# 访问
# C 端：  http://localhost:8081
# 后台：  http://localhost:8082
```

单独构建某一个站点：

```bash
docker build -f deploy/Dockerfile.web --build-arg APP=mobile -t snackstore-mobile .
docker build -f deploy/Dockerfile.web --build-arg APP=admin  -t snackstore-admin .
```

## 运行时环境变量

| 变量                   | 默认值                             | 说明                                                            |
| ---------------------- | ---------------------------------- | --------------------------------------------------------------- |
| `API_UPSTREAM`         | `http://host.docker.internal:8080` | `/api` 的反代目标。**结尾不要带斜杠**，否则 `/api` 前缀会被截掉 |
| `SERVER_NAME`          | `_`                                | nginx `server_name`，域名部署时填真实域名                       |
| `CLIENT_MAX_BODY_SIZE` | `10m`                              | 请求体上限                                                      |

后端网关若和前端在同一个 compose 网络里，把 `API_UPSTREAM` 改成服务名即可，例如
`http://api-gateway:8080`，此时 `extra_hosts` 可以删掉。

## 不用 Docker 的等价部署

构建产物是纯静态文件，任何静态服务器都可承载，但**必须补齐三条规则**，缺任何一条都会出线上故障：

| 规则                               | 缺失后果                                                  |
| ---------------------------------- | --------------------------------------------------------- |
| `try_files $uri $uri/ /index.html` | 深链刷新（如 `/home`、`/product/1`）直接 404              |
| `/api/` 反代到后端网关             | 所有接口 404 或返回 index.html，前端弹「响应格式非法」    |
| `index.html` 不缓存                | 发版后浏览器仍用旧 `index.html`，指向已删除的 chunk，白屏 |

可直接复用 `nginx/spa.conf.template`，把 `${...}` 换成实际值。

## 产物约定

- **默认不产出 sourcemap**（见各 app 的 `vite.config.js`）。需要排查线上问题时用
  `VITE_SOURCEMAP=true pnpm build:mobile` 单独构建一份，`.map` 只上传到错误监控平台，
  不得进静态站点。CI 有断言拦截。
- `dist/assets/*.js` 旁边会预生成 `.js.gz` 与 `.js.br`，由 `gzip_static on` 直接复用。
  `.br` 需要 ngx_brotli 模块，官方 nginx 镜像未内置，模板里已注释掉 `brotli_static`。

## 验收清单

| #   | 检查项     | 判定标准                                                                                |
| --- | ---------- | --------------------------------------------------------------------------------------- |
| 1   | 容器健康   | `docker compose ps` 两个服务均为 `healthy`                                              |
| 2   | 首屏可用   | 打开 `/` 能看到页面，控制台无 404                                                       |
| 3   | 深链刷新   | 直接访问 `/order/list`（或后台 `/orders`）不出现 404                                    |
| 4   | 接口连通   | 登录接口返回 `{ code: 200 }`，不是 HTML                                                 |
| 5   | 缓存策略   | `curl -I http://localhost:8081/index.html` 含 `no-cache`；`/assets/*.js` 含 `immutable` |
| 6   | 压缩生效   | `curl -H 'Accept-Encoding: gzip' -I http://localhost:8081/` 含 `Content-Encoding: gzip` |
| 7   | 无源码泄漏 | 镜像内 `find /usr/share/nginx/html -name '*.map'` 无输出                                |
