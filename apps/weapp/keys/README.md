# 上传私钥目录

本目录内的 `*.key` **不入库**（根 `.gitignore` 已忽略 `apps/weapp/keys/*`，仅本说明随工程分发）。

## 获取方式

1. 登录[小程序后台](https://mp.weixin.qq.com) → 「开发管理」→ 「开发设置」→ 「小程序代码上传」。
2. 下载「小程序代码上传密钥」，重命名为 `private.<appid>.key` 放到本目录：

   ```
   apps/weapp/keys/private.wx1234567890abcdef.key
   ```

3. 同页开启「代码上传安全校验」，并按提示把执行机 IP 加入白名单（IP 白名单变更有生效延迟，CI 机器换 IP 后需重新加白）。
4. 密钥泄露时在该页面「重置」，并同步更新各执行机上的本地副本。

## 使用约定

上传与体积检查通过环境变量驱动，**任何凭证都不写死进仓库**：

| 变量 | 用途 | 缺省行为 |
|---|---|---|
| `WX_APPID` | 真实小程序 appid，同时决定私钥文件名 | 缺失即报错退出（拒绝用 `touristappid` 占位上传） |
| `WX_ROBOT` | 机器人编号 1–20，用于多流水线隔离 | `1` |
| `WX_DESC` | 版本描述（后台「版本管理」可见） | `CI <git-sha>` |

```powershell
$env:WX_APPID = 'wx1234567890abcdef'
pnpm -F @snackstore/weapp checksize   # 主包体积门禁（>1.8MB 失败）
pnpm -F @snackstore/weapp upload      # 上传体验版
```

> 游客 appid（`project.config.json` 里的 `touristappid`）只用于本地开发者工具预览，无法上传，也不应出现在 CI 中。
