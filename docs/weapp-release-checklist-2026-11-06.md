# 微信小程序上线清单（apps/weapp）

> 生成日期：2026-11-06　最后更新：2026-11-07
> 适用范围：`apps/weapp` 首版提交体验版 → 提审 → 发布
> 设计依据：[迁移设计 spec](superpowers/specs/2026-11-06-weapp-native-migration-design.md)（§4.2 CI 与体积、§4.3 分包预案、§6 未决项）
> 操作入口：[apps/weapp/README.md](../apps/weapp/README.md)

本文件承接"上线前要执行的动作"，不属于 README（README 只讲怎么把工程跑起来）。
页面口径为 10 页（spec §3.2 中的 404 页按 D7 不迁移）。

## 1. 真机回归矩阵

iOS + Android 各跑一轮主流微信版本，逐条打钩。后端用真实环境，不用本地 mock。

| ☑ | 场景 | 路径 | 关注点 |
| --- | --- | --- | --- |
| ☐ | 游客浏览 | home → category → product-detail | 列表分页、骨架屏、空态、错误重试；下拉刷新与触底加载 |
| ☐ | 游客加购 | product-detail 加入购物车 → cart | tab 角标数量、金额分单位无浮点漂移、stepper 不会到 0 |
| ☐ | 登录拦截 | cart / order-confirm / order-list / address | 未登录跳登录；登录后按 `redirect` 回到原页（tab 页走 `switchTab`） |
| ☐ | 购物车合并 | 游客加购 → 登录 | guest 键合入用户键、guest 键清除（shared `mergeCartItems`） |
| ☐ | 下单全链路 | cart → 选/新增地址 → 提交订单 | 幂等键生效（重试不产生重复单）、提交后购物车清空、直购快照只结算单件 |
| ☐ | 支付与取消 | order-list / order-detail | 模拟支付后状态与列表刷新；操作进行中按钮不可点（防双击并发） |
| ☐ | 地址管理 | address | 新增/编辑/设默认/删除；从本页返回确认订单页后所选地址仍有效 |
| ☐ | 弱网与超时 | 任意列表页 | 10s 超时提示、「加载失败，点击重试」不白屏 |
| ☐ | 掉登录 | token 过期后发请求 | 401 统一登出并跳登录，不静默失败 |
| ☐ | 退出登录 | mine → 退出登录 | 购物车不清空（按账号隔离），重登自动恢复 |
| ☐ | 隐私弹窗 | 首次冷启动 | 基础库 ≥2.32.3 出现隐私授权；低版本降级不报错（D13） |

## 2. 提审前 checklist

- [ ] `miniprogram/config/env.js` 的生产 `API_BASE_URL` 换成**已备案 HTTPS** 域名。
- [ ] 小程序后台「开发设置 → 服务器域名」录入 request（及 downloadFile，若启用）合法域名。
      `urlCheck: false` 只允许出现在本地 `project.config.json`，线上必须靠白名单放行。
- [ ] `pnpm --filter @snackstore/weapp checksize` 达标：主包 ≤ 1.8 MB；越线启用 spec §4.3 分包预案。
- [ ] tabBar 图标按正式设计稿补齐，并在 `app.json` 填入 `iconPath` / `selectedIconPath`
      （当前为**纯文本占位**，spec §3.4 的未达成项）。
- [ ] 服务类目与主体资质自查；隐私保护指引已在后台配置。
- [ ] `WX_APPID` 与 `keys/private.<appid>.key` 就位后跑 `upload`，体验版真机扫码验证通过再提审。
- [ ] 确认本版口径对外描述正确：登录为手机号+密码、支付为模拟支付（spec D1），
      与 H5 一致，不含微信登录/JSAPI 支付。

## 3. 范围外（二迭，另开 spec）

以下内容**不在本版**，若被问起统一口径为二迭范围（spec §0「明确不含」）：

- `wx.login` + openid 静默注册/登录（依赖后端 `/auth/wx-login`）；
- 微信 JSAPI 真实支付（依赖商户号、下单签名与支付回调对账）；
- 订阅消息、分享卡片等增长能力。

前端估 3.5~5 人日，不含在 spec §4.5 的 22 人日口径内。
