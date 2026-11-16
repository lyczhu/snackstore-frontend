# 零食商城生产可用化路线图（M1 / M2 / M3）

> 生成日期：2026-11-15
> 依据：2026-11-15 全仓代码走查（`apps/mobile`、`apps/admin`、`apps/weapp`、`packages/shared`、`.github/workflows/ci.yml`）
> 关联文档：[微信小程序上线清单](./weapp-release-checklist-2026-11-06.md)、[小程序迁移设计 spec](./superpowers/specs/2026-11-06-weapp-native-migration-design.md)
> 范围：本文档登记 M1/M2/M3 三个里程碑，并展开 M1 的可执行工作分解；M2/M3 仅登记，细化另开文档。
> 项目定位：个人开发的微信小程序 + H5，用于学习与案例展示，同时作为可交付项目的技术底座——支付层必须能被客户替换为自己的商户号。

---

## 0. 结论与缺口全景

### 0.1 一句话判断

交易闭环已跑通，但**缺少生产级骨架**：支付是一次裸状态改写（无支付单、无回调、无关单）、订单只有三个状态、金额由前端快照计算、仓库里没有一行部署配置。

项目定位是案例展示且要能长成真实交付项目，因此缺口不是"页面不够多"，也不是"能不能真扣款"，而是三件事：**支付流程能否原样换成真实商户号 / 金额与库存会不会算错 / 上线后看不见能不能救回**。

### 0.2 已经具备，不重复投入

| 能力 | 证据 |
| --- | --- |
| 前端已发送 `Idempotency-Key`（**后端尚未消费**，见 §2.3 对齐约束） | `apps/mobile/src/views/OrderConfirm.vue:159-162` |
| 401 统一登出，Pinia 为单一数据源 | `apps/mobile/src/utils/request.js:7-11`、`apps/admin/src/utils/request.js:8-11` |
| 金额按「分」整数累加 | `packages/shared/src/cart.js` `calcCentsTotal` |
| 富文本 XSS 净化（DOMPurify） | `apps/mobile/src/views/ProductDetail.vue:71` |
| 错误上报四级通道 + 防风暴 | `packages/shared/src/errorTracking.js`、`apps/mobile/src/main.js:27-30` |
| 游客购物车合并、按账号隔离 | `apps/mobile/src/stores/cart.js:26-42` |
| 体积预算（size-limit）、路由懒加载 | 各 app `package.json`、`router/index.js` 动态 import |
| CI lint + test + weapp vendor 校验 | `.github/workflows/ci.yml` |
| 无障碍基础（路由焦点复位、语义化 button） | `apps/mobile/src/router/index.js:99-108` |

### 0.3 缺口 → 里程碑映射

| 缺口 | 严重度 | 归属 |
| --- | --- | --- |
| 支付是一次裸状态改写：无支付单、无回调、无关单，且无 provider 抽象，接真实商户号需重写 | P0 | M1 |
| 订单状态机仅 0/1/2，无待发货/待收货，后台无发货 | P0 | M1 |
| 结算金额用本地快照，与服务端实付可能不一致；无库存校验 | P0 | M1 |
| 省市区为三个自由文本框 | P1 | M1 |
| 无演示环境声明 / 隐私说明 / 个人信息清单 | P1（转为真实交付时升 P0） | M1 |
| 仓库无 Dockerfile / nginx.conf，部署要求只写在 README | P0 | M1 |
| CI 不 build、不校验 size、不校验 `.map` 泄漏 | P0 | M1 |
| 无运费/优惠券/满减 | P1 | M2 |
| 无 SKU/规格（零食多口味刚需） | P1 | M2 |
| 无图片上传（商品封面只能填 URL） | P1 | M2 |
| 无售后（退款/退货/换货）、无客服 | P1 | M2 |
| 无 Banner CMS、无评价、无收藏 | P2 | M2 |
| 后台无 RBAC、无操作日志/审计 | P1 | M2 |
| 注册验证码硬编码 `123456`、无找回/修改密码、无登录风控 | P0 | M2 |
| 无业务埋点、无 RUM/告警（错误上报端点默认未配置=线上无数据） | P1 | M2 |
| 无 staging 环境、无版本号注入、无灰度/回滚方案 | P1 | M2 |
| 小程序无 `wx.login` / JSAPI 支付 / 订阅消息 | P2（主体受限，暂不可用） | M3 |

---

## 1. 三个里程碑总览

### M1「可收款形态」（案例展示 + 可交付底座）

- **目标**：把支付做成「契约对齐微信支付 APIv3 的抽象层 + 可切换的 DemoProvider」，跑通下单 → 支付 → 发货 → 收货 → 退款全链路；同步补齐金额/库存一致性、演示环境合规说明、部署与 CI 门禁。
- **完成判据**：Demo 支付全链路可复现（含超时、重复回调、乱序、签名失败等异常场景）；客户接入自己的商户号只需替换 provider 与配置，业务代码零改动；CI 产出可部署制品。
- **估算**：约 **18.5 人日**（M1-1 10 / M1-2 3 / M1-3 2 / M1-4 1 / M1-5 1.5 / M1-6 1），其中前端 12.5、后端 6。单人约 **4 周**；前后端各一人约 **2.5 周**。
- **口径修正说明**：上一版 M1-1 按「后端薄适配」估 6 人日；对齐真实 Java 服务后确认需新建 2 张表、10 个支付/履约端点、超时关单任务与下单幂等改造，故按前后端分列重估。
- **前置外部依赖**：仅备案 HTTPS 域名（H5 公网演示必需）。真实商户号**不再是 M1 前置**，转为客户交付时的接入事项（见 §2.3）。

### M2「能运营」

- **目标**：运营不碰数据库也能上架、定价、促销、发货、处理售后；出问题能看见、能量化。
- **范围**：运费模板 + 优惠券/满减、SKU/规格、图片上传（对象存储直传）、售后与客服、Banner CMS、评价、后台 RBAC + 操作日志、埋点与看板、staging 环境与版本号注入、账号安全（短信/图形验证码、找回与修改密码、登录风控）。
- **完成判据**：一位运营可在无研发介入下完成「新建商品 → 配促销 → 上架 → 处理售后」全流程；核心漏斗（曝光→加购→下单→支付）在后台可查。
- **估算**：约 30~35 人日，1 前端 + 1 后端约 **3~4 周**。

### M3「可规模化」

- **目标**：微信生态内原生体验与增长能力，多人协作下的稳定性。
- **范围**：小程序 `wx.login` + openid 静默注册、微信 JSAPI 支付、订阅消息、分享卡片；灰度发布与一键回滚；监控告警与错误看板；依赖审计（Dependabot / `pnpm audit`）。
- **完成判据**：小程序内可完成登录→支付→接收发货通知；线上发布可按版本灰度并可 5 分钟内回滚。
- **估算**：约 15~20 人日。

### 依赖关系

```
M1（可切换的支付与履约闭环）
  ├─ 是 M2 全部营销能力的前置（优惠金额必须进服务端试算）
  ├─ 是 M3 JSAPI 支付的前置（支付抽象层先落地）
  └─ 是 M2 埋点的前置（支付/履约事件是漏斗主干）
```

**M1 不依赖 M2/M3，必须单独可交付上线。**

---

## 2. M1 详细展开

### 2.1 完成判据（DoD）

全部满足才算 M1 完成：

- [ ] 在 Chrome 移动端与微信内置浏览器各跑通一次 Demo 支付，金额、订单号、支付时间与后台一致。
- [ ] 支付回调丢失场景下，前端轮询/查单可自愈，订单最终态正确。
- [ ] 四个异常场景可演示且行为正确：回调重复投递（不重复发货）、回调乱序（先退款后支付）、支付超时关单、签名校验失败被拒绝。
- [ ] 支付中关闭页面后重进订单详情，能通过查单恢复为「待发货」。
- [ ] 下单前价格或库存发生变动时，用户看到差异并被要求确认，不会出现"页面显示 9.9、实付 12.9"。
- [ ] 后台可录入运单号发货，用户端可见待收货状态与物流单号。
- [ ] 用户可发起退款申请，后台可审批，退款成功后订单状态与支付单状态一致。
- [ ] 购物车中已下架/超库存商品被显式标记，不可直接结算。
- [ ] 地址省市区为级联选择，无法填入非法区划。
- [ ] 三端均可打开《演示环境说明》，且收银台页面明确标注"演示环境，不产生真实扣款"。
- [ ] **切换演练通过**：把 provider 从 `demo` 换成桩实现，业务代码零改动（前端 diff 为空）。
- [ ] `deploy/` 下的 Nginx 配置与 Dockerfile 可直接构建并部署，无需口头补充。
- [ ] CI 在 PR 上完成 `lint → test → build → size → .map 泄漏断言`，任一失败阻断合并。

### 2.2 M1 明确不做（防 scope creep）

运费/优惠券/满减、SKU 多规格、图片上传、售后工单以外的营销能力、评价/收藏、后台 RBAC、埋点看板、短信验证码与找回密码、小程序微信登录与订阅消息。以上全部归 M2/M3。

可选加分项（不阻塞 M1）：**支付宝沙箱 provider**，仅 H5 可用，约 2 人日。它是唯一能在无营业执照前提下真实跑通签名、验签、异步通知的沙箱；等有客户明确询问支付对接能力时再补，边际收益更高。

---

### 2.3 支付策略与主体约束（先决结论）

**结论：采用「契约对齐 APIv3 的抽象层 + 可切换 Provider」，不接真实商户号，也不依赖沙箱。**

#### 为什么不用微信支付沙箱

| 接口版本 | 沙箱支持 | 前提条件 |
| --- | --- | --- |
| APIv2（`sandboxnew`） | 曾提供，需调 `/pay/getsignkey` 换沙箱密钥 | **必须持有真实商户号**，且多年不维护、兼容性差 |
| APIv3（JSON/RSA） | **官方明确不提供** | 官方社区答复：「微信支付 V3 是没有沙箱的，只能申请一个真实的商户号进行开发」 |

沙箱是从"已有商户号"派生出的测试通道，不是"无商户号也能测"的通道。而个人主体连商户号申请入口都没有：微信支付支持的商户类型仅有个体工商户、企业、事业单位、政府机关、社会组织。

#### 主体能力对照（2026-11 现状）

| 主体 | 微信认证 | 微信支付 | 商城类小程序发布 |
| --- | --- | --- | --- |
| 个人 | 不支持 | **无申请入口** | **暂不支持** |
| 个体工商户 | 支持（300 元/次） | 可开通 | 支持 |
| 企业 | 支持（300 元/次） | 可开通 | 支持 |

> 2026-08 新增的「虚拟支付：个人」通道仅允许售卖数字权益（功能解锁 / 次数包 / 会员），且要求类目含「工具」，**实物商品不适用**。

#### 三个候选方案的关系

```
方案 2：支付抽象层（PaymentProvider）
   ├─ DemoProvider          ← 现在实现：假密钥，真流程
   ├─ WechatProvider        ← 客户交付时：替换 provider + 配置，业务零改动
   └─ AlipaySandboxProvider ← 可选：唯一能跑真实签名/验签的免费沙箱（仅 H5）
```

- **方案 1（纯模拟流程）不单独存在**：脱离真实契约写的模拟支付，将来接商户号等于重写订单 / 支付 / 退款 / 对账，前面的工作作废。
- **方案 3（微信沙箱）已排除**：见上表。

#### 与后端现状的对齐约束（代码实证）

决策不是凭空定的，以下约束来自后端工程 `snackstore-cloud`（`order-service` 与 `api-gateway` 模块）实测：

| 事实 | 证据 | 对决策的影响 |
| --- | --- | --- |
| 网关只把 `/api/orders/**`、`/api/users/**`、`/api/products/**` 等转发到对应服务，`StripPrefix=1` | `nacos-config/api-gateway-routes.yml:14-48` | 支付端点若走 `/api/payments/**`，必须在 Nacos 补一条路由 |
| `POST /orders` **完全没有消费** `Idempotency-Key`（全仓 grep `Idempotency` 无命中） | `OrderController.java:26-30`、`OrderCreateDTO.java` | 前端发了幂等头但后端丢弃，需补后端实现才能叫幂等 |
| 订单状态是 `int` 常量，DDL 注释写死 `0/1/2` | `OrderStatusConstants.java:9-11`、`V1__init_order_tables.sql:10` | 重定义必须同时改常量、DDL、VO、前端 TYPE_MAP |
| 库存在**下单时**扣减，取消时回滚 | `OrderServiceImpl.java:72-76`、`203-210` | 支付超时关单可直接复用 `cancelOrder` 的库存回滚逻辑 |
| 用户身份由网关注入 `X-User-Id` 头，服务内不再解析 token | `OrderController.java:27`、`AuthConstants.HEADER_USER_ID` | 支付单归属校验沿用它，无需改鉴权 |
| 统一响应 `Result<T>` / `PageResult<T>` + `ResultCode` 业务码 | `OrderController.java:6-7`、`BusinessExceptionEnum.java` | 新端点沿用，不自定义错误结构 |

#### 契约对齐清单（Demo 与真实 APIv3 保持一致）

| 真实微信支付 V3 | Demo 实现 | 一致性 |
| --- | --- | --- |
| `out_trade_no`（商户订单号） | 复用现有 `orderNo` | 完全一致 |
| 统一下单返回 `prepay_id` | 生成同格式伪 `prepay_id` | 结构一致 |
| JSAPI 唤起参数 `{appId, timeStamp, nonceStr, package, signType, paySign}` | 同结构，`paySign` 用 HMAC 代替 RSA | 结构一致 |
| `trade_state`：`NOTPAY / USERPAYING / SUCCESS / CLOSED / PAYERROR` | 同一套枚举 | 完全一致 |
| 回调头 `Wechatpay-Signature / Timestamp / Nonce / Serial` | 同结构，HMAC 代替 RSA | 结构一致 |
| 回调体 `resource` 用 AES-256-GCM 加密 | 同算法，固定测试密钥 | 完全一致 |
| 关单 `POST /v3/pay/transactions/out-trade-no/{no}/close` | 同语义 | 一致 |
| 退款 `out_refund_no` + 反向流水 | 同结构 | 一致 |

**关键约束**：验签失败拒绝、重复回调幂等、乱序回调容错，这三段在 Demo 里就是真代码，换真密钥时一行不改。**前端永远不接触商户私钥与 APIv3 密钥。**

#### 运行模式三档

| `VITE_PAYMENT_MODE` | 行为 | 用途 |
| --- | --- | --- |
| `local` | 纯前端模拟，不依赖后端 | H5 静态部署（Vercel 等）时保证链接可直接演示支付流程 |
| `demo` | 走后端 DemoProvider，完整状态机 + 幂等 + 回调 | 本地 / 服务器完整演示、录制演示视频 |
| `wechat` | 真实商户号 | 客户交付时 |

#### 切换真实支付需要改什么

- **后端**：`PaymentService` 中 provider 由 Demo 换成 Wechat（1 处）+ 配置商户号 / appId / APIv3 密钥 / 商户证书序列号 / 私钥路径。
- **前端**：**0 行**（前提是契约对齐，见上表）。

> 交付物：同步产出 `docs/payment-integration-guide.md`，写明申请材料、5 个配置项、回调地址与域名白名单要求、切换步骤、已知差异（JSAPI 需 `openid`，依赖 `wx.login`）。

---

### 2.4 工作分解

#### M1-1 支付抽象层 + 收银台 + 履约链路（后端待启动）

> **执行状态（2026-11-16）**：后端仓库 `snackstore-cloud` 暂不修改，本节的 b/c/d 子任务与 `D-M1-1` 状态机改造全部冻结。契约、DDL、网关配置已交付到后端仓库 `docs/订单状态机与支付域改造说明.md`，等后端启动时直接执行。前端可独立推进的部分已拆到 §2.9 M1′。

**现状证据**

- 支付 = 状态改写：`payOrder: (id) => request.patch('/orders/${id}/status', null, { params: { status: 1 } })` — `packages/shared/src/api.js:21-28`。
- 用户端按钮文案即「模拟支付」— `apps/mobile/src/views/OrderDetail.vue:54-56`、`apps/mobile/src/views/OrderList.vue:125`、`apps/weapp/miniprogram/pages/order-list/order-list.js:99`。
- 状态枚举只有三个 — `packages/shared/src/constants.js:5-9`；Vant 侧类型映射 `{0:'warning',1:'success',2:'default'}` — `apps/mobile/src/utils/orderStatus.js:7`；小程序侧同名文件 `apps/weapp/miniprogram/utils/orderStatus.js`。
- 后台只有「确认支付 / 取消订单」，无发货 — `apps/admin/src/views/OrderList.vue:147-182`。
- 无支付单实体、无回调端点、无关单逻辑，`payOrder` 可被任意登录用户对任意订单直接调用。

**拆成四个子任务，按序交付**

| 编号 | 子任务 | 交付物 | 前端 | 后端 | 合计 |
| --- | --- | --- | --- | --- | --- |
| M1-1a | 支付契约与抽象层 | `packages/shared/src/payment/*`、后端 DTO | 1 | 1 | 2 |
| M1-1b | 收银台与 DemoProvider | `Payment.vue`、`pages/payment/*`、`t_payment` + 支付端点 | 2.5 | 2 | 4.5 |
| M1-1c | 退款、关单与对账 | `t_refund` + 退款端点、超时关单任务、对账日志 | 1.5 | 1 | 2.5 |
| M1-1d | 故障注入与演示剧本 | `?scenario=` 注入开关 + 演示脚本文档 | 0.5 | 0.5 | 1 |
| — | **合计** | — | **5.5** | **4.5** | **10** |

##### 定稿 D-M1-1：订单状态码重定义（已决策，前后端锁定）

**决策：一次性重定义为 7 态，不在旧码上追加。** 理由：项目尚未上线，`t_order` 无生产数据；追加式改法会让 `1=已完成` 与 `1=待发货` 语义冲突，后续谁看谁错。

| 码 | 常量名 | 状态 | 进入条件 | 允许的下一步 |
| --- | --- | --- | --- | --- |
| 0 | `PENDING` | 待支付 | 下单成功（现为默认值，不变） | → 1 / 4 |
| 1 | `PAID` | 待发货 | 支付单回调成功 | → 2 / 5 |
| 2 | `SHIPPED` | 待收货 | 后台发货并填运单号 | → 3 / 5 |
| 3 | `COMPLETED` | 已完成 | 用户确认收货 / 超时自动确认 | 终态 |
| 4 | `CANCELLED` | 已取消 | 未支付取消 / 超时关单 | 终态（可删除） |
| 5 | `REFUNDING` | 退款中 | 用户申请退款 | → 6 / 回退原状态 |
| 6 | `REFUNDED` | 已退款 | 审批通过且退款成功 | 终态 |

迁移表（服务端硬校验，其余组合返回 `ORDER_STATUS_ERROR`）：

```
0 → 1 | 4
1 → 2 | 5
2 → 3 | 5
5 → 6 | 1（待发货时申请，驳回回退到 1）
5 → 2（待收货时申请，驳回回退到 2）
```

**后端改动（已定）**

- `OrderStatusConstants.java` — 常量改为 `PENDING=0 / PAID=1 / SHIPPED=2 / COMPLETED=3 / CANCELLED=4 / REFUNDING=5 / REFUNDED=6`，补 `isTerminal()` 与 `canTransit(from, to)`。
- `OrderServiceImpl.payOrder` — 由 `0→COMPLETED` 改为 `0→PAID`。当前 `OrderServiceImpl.java:170` 写死 COMPLETED，是重定义后最容易漏的语义陷阱。
- `OrderServiceImpl.deleteOrder` — 判定条件由 `CANCELLED(2)` 改为 `CANCELLED(4)`（`OrderServiceImpl.java:219`）。
- `OrderController.updateOrderStatus` — 删除 `PATCH /orders/{id}/status`，改由支付与履约动作驱动。
- `Order` 实体与 `t_order` — 新增 `ship_time`、`ship_company`、`ship_no`、`confirm_time`、`cancel_time` 五个字段。
- `OrderVO` — 透出上述字段，前端物流区直接复用。
- `OrderQueryDTO.status` 过滤逻辑不变（仍是精确匹配）。

**迁移脚本 `order-service/src/main/resources/db/migration/V2__redefine_order_status.sql`（Flyway，与 V1 同目录）**

```sql
ALTER TABLE t_order
  ADD COLUMN ship_time DATETIME DEFAULT NULL COMMENT '发货时间',
  ADD COLUMN ship_company VARCHAR(50) DEFAULT NULL COMMENT '快递公司',
  ADD COLUMN ship_no VARCHAR(64) DEFAULT NULL COMMENT '运单号',
  ADD COLUMN confirm_time DATETIME DEFAULT NULL COMMENT '确认收货时间',
  ADD COLUMN cancel_time DATETIME DEFAULT NULL COMMENT '取消时间',
  ADD COLUMN idempotency_key VARCHAR(64) DEFAULT NULL COMMENT '下单幂等键',
  MODIFY COLUMN status TINYINT NOT NULL DEFAULT 0
    COMMENT '订单状态：0-待支付 1-待发货 2-待收货 3-已完成 4-已取消 5-退款中 6-已退款',
  ADD UNIQUE KEY uk_user_idem (user_id, idempotency_key);

-- 旧语义 → 新语义：先处理 2，避免与 1 的目标值冲突
-- 本项目无生产数据，本段仅作用于存量开发库
UPDATE t_order SET status = 4 WHERE status = 2;
UPDATE t_order SET status = 3 WHERE status = 1;
```

> `uk_user_idem` 允许多行 `idempotency_key` 为 NULL（MySQL 唯一索引对 NULL 不冲突），因此历史订单不受影响。

**前端改动（已定）**

- `packages/shared/src/constants.js` — `ORDER_STATUS` 改为上述 7 值，`getOrderStatusText` 同步；导出 `ORDER_STATUS_FLOW` 供 UI 判断可执行动作。
- `apps/mobile/src/utils/orderStatus.js` — Vant `TYPE_MAP`：`{0:'warning',1:'primary',2:'primary',3:'success',4:'default',5:'danger',6:'default'}`。
- `apps/weapp/miniprogram/utils/orderStatus.js` — 与 Vant 侧同表。
- `apps/admin/src/views/OrderList.vue:186-188` — Element Plus `getStatusType`：`{0:'warning',1:'primary',2:'primary',3:'success',4:'info',5:'danger',6:'info'}`。

##### 定稿 D-M1-2：支付单与订单分离（已决策，含表结构）

**决策：订单只承载交易结果，支付单承载每一次支付尝试，退款单承载逆向流水。** 一单可多次支付（失败重试），订单状态只由支付单最终态驱动。`payOrder` 与 `PATCH /orders/{id}/status` 必须下线。

**表结构（`snackstore_order` 库，`V3__init_payment_tables.sql`）**

```sql
CREATE TABLE `t_payment` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `payment_no` VARCHAR(64) NOT NULL COMMENT '商户支付单号，对应微信 out_trade_no',
  `order_id` BIGINT NOT NULL,
  `order_no` VARCHAR(64) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0-已创建 1-已支付 2-已失败 3-已关闭',
  `trade_state` VARCHAR(20) NOT NULL DEFAULT 'NOTPAY' COMMENT '与微信 trade_state 对齐',
  `provider` VARCHAR(20) NOT NULL DEFAULT 'demo' COMMENT 'demo | wechat',
  `prepay_id` VARCHAR(128) DEFAULT NULL,
  `transaction_id` VARCHAR(64) DEFAULT NULL COMMENT '支付平台交易号',
  `expire_at` DATETIME NOT NULL COMMENT '支付截止时间，默认创建后 15 分钟',
  `paid_at` DATETIME DEFAULT NULL,
  `closed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_no` (`payment_no`),
  UNIQUE KEY `uk_transaction_id` (`transaction_id`),
  KEY `idx_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付单';

CREATE TABLE `t_refund` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `refund_no` VARCHAR(64) NOT NULL COMMENT '对应微信 out_refund_no',
  `payment_id` BIGINT NOT NULL,
  `order_id` BIGINT NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0-待审批 1-已通过/退款中 2-已退款 3-已驳回',
  `order_status_before` TINYINT NOT NULL COMMENT '申请时的订单状态，驳回时回退用',
  `reason` VARCHAR(200) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `refunded_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refund_no` (`refund_no`),
  KEY `idx_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='退款单';
```

**关键约束**

- `t_payment.transaction_id` 唯一索引 = 回调幂等的第一道闸；重复推送命中唯一键，捕获后直接返回成功。
- 同一订单同时只允许一个未关闭支付单：服务层 `SELECT ... FOR UPDATE` 保证，MySQL 不支持部分唯一索引。
- 退款 M1 仅支持**全额退款**，`t_refund.amount` 恒等于 `t_payment.amount`；部分退款归 M2。
- 支付单金额永远取 `t_order.total_amount`，**不信任前端传入的 amount**（防金额篡改）。

**需要改的前端文件**

- `packages/shared/src/payment/index.js` — 导出 `PAYMENT_STATUS`、`TRADE_STATE` 与状态映射纯函数。
- `packages/shared/src/payment/provider.js` — `PaymentProvider` 契约（JSDoc）：`create(orderId)` / `query(paymentId)` / `close(paymentId)`。
- `packages/shared/src/payment/demo-provider.js` — Demo 实现：可控延迟、可注入失败、生成伪 `prepay_id`、HMAC 伪造签名。
- `packages/shared/src/payment/wechat-provider.js` — 真实接入预留骨架（只转发后端，不持密钥），注释标注待补位置。
- `packages/shared/src/constants.js` — 扩展 `ORDER_STATUS` 与 `getOrderStatusText`。
- `packages/shared/src/api.js` — 删除 `payOrder`；`createOrderApi` 增加 `shipOrder`、`confirmOrder`；新增 `createPaymentApi({ createPayment, getPayment, cancelPayment, applyRefund })`。
- `apps/mobile/src/api/payment.js` — 按 `VITE_PAYMENT_MODE` 选择 provider 并导出统一入口。
- `apps/mobile/src/views/Payment.vue` — 收银台：金额（服务端返回）、倒计时、演示横幅、支付按钮、结果态。
- `apps/weapp/miniprogram/pages/payment/*` — 同构收银台。
- `apps/mobile/src/utils/orderStatus.js`、`apps/weapp/miniprogram/utils/orderStatus.js` — `TYPE_MAP` 扩展；`apps/admin/src/views/OrderList.vue:186-188` 的 `getStatusType` 同步。
- `apps/mobile/src/views/OrderDetail.vue` — `handlePay` 改为跳转收银台；区分「支付成功 / 用户取消 / 支付失败」；展示运单号；待收货显示「确认收货」；已完成显示「申请退款」。
- `apps/mobile/src/views/OrderList.vue:5-9` — Tab 改为 全部 / 待支付 / 待发货 / 待收货 / 已完成 / 已取消。
- `apps/admin/src/views/OrderList.vue` — 操作列按状态渲染：待发货显示「发货」（弹窗录入快递公司 + 运单号），退款中显示「同意/驳回」。
- `apps/mobile/.env.production`、`apps/admin/.env.production` — 新增 `VITE_PAYMENT_MODE`。

**后端契约（已定稿，可直接开工）**

网关对外统一带 `/api` 前缀，`StripPrefix=1` 后进入服务侧路径：

| 方法 | 网关路径 | 服务内路径 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/orders/preview` | `/orders/preview` | 结算试算（M1-2），返回服务端最终金额 |
| POST | `/api/orders` | `/orders` | 创建订单，**读取 `Idempotency-Key` 头**，重复键返回已有订单 |
| GET | `/api/orders` | `/orders` | 列表，`status` 精确过滤 |
| GET | `/api/orders/{id}` | `/orders/{id}` | 详情（含运单与时间戳） |
| DELETE | `/api/orders/{id}` | `/orders/{id}` | 仅 `CANCELLED(4)` 可删 |
| POST | `/api/orders/{id}/payments` | `/orders/{id}/payments` | 创建支付单；已有未关闭支付单则直接返回该单 |
| GET | `/api/payments/{paymentId}` | `/payments/{paymentId}` | 查单，前端轮询（3s × 20 次后转手动刷新） |
| POST | `/api/payments/{paymentId}/cancel` | `/payments/{paymentId}/cancel` | 用户主动取消支付 |
| POST | `/api/payments/{paymentId}/simulate-success` | `/payments/{paymentId}/simulate-success` | **仅 `demo` profile 注册**；`wechat` profile 下该路由不存在 |
| POST | `/api/payments/notify/wechat` | `/payments/notify/wechat` | 真实回调：验签 → AES-256-GCM 解密 → 幂等落库 |
| POST | `/api/orders/{id}/ship` | `/orders/{id}/ship` | 发货，body `{ companyCode, companyName, trackingNo }` |
| POST | `/api/orders/{id}/confirm` | `/orders/{id}/confirm` | 确认收货 |
| POST | `/api/orders/{id}/refunds` | `/orders/{id}/refunds` | 退款申请（全额） |
| POST | `/api/orders/{id}/refunds/{refundId}/approve` | 同左 | 后台同意 |
| POST | `/api/orders/{id}/refunds/{refundId}/reject` | 同左 | 后台驳回 |

**必须同步的网关路由（Nacos 热更新，`nacos-config/api-gateway-routes.yml`）**

```yaml
  - id: order-service-payments
    uri: lb://order-service
    predicates:
      - Path=/api/payments/**
    filters:
      - StripPrefix=1
    order: 2
```

> 漏掉这一条，所有支付端点直接 404。落地后需在网关日志确认路由命中。

**验收**

- Demo 支付一笔，金额、订单号、支付时间在用户端与后台一致。
- 支付后关闭页面，重进订单详情能通过查单自愈为「待发货」。
- 后台发货后可查运单号；用户确认收货后状态为「已完成」。
- 对非待支付订单调用 `POST /api/orders/{id}/payments` 返回 `ORDER_STATUS_ERROR`，前端不发起支付。
- 同一 `Idempotency-Key` 重复调用 `POST /api/orders` 返回同一订单（当前会建两单，属待修）。
- 旧接口 `PATCH /api/orders/{id}/status` 已下线（404/405），前端无残留调用。

##### M1-1d 故障注入剧本（演示核心）

| 场景 | 触发方式 | 期望行为 |
| --- | --- | --- |
| 支付超时 | `?scenario=timeout` 或等待 15 分钟 | 支付单关闭、订单转已取消、库存释放 |
| 回调重复 | `?scenario=dup-notify` | 幂等：订单不重复流转、不重复发货 |
| 回调乱序 | `?scenario=out-of-order` | 先收退款回调后收支付回调，状态不回退 |
| 签名错误 | `?scenario=bad-sign` | 拒绝并记录告警日志 |
| 金额篡改 | 前端改参数 | 服务端以订单金额为准，拒绝支付 |

**人日**：前端 5.5 / 后端 4.5 = **10**

---

#### M1-2 结算试算与价格/库存一致性

**现状证据**

- 结算页金额全部来自本地快照：`settleTotal` 用 `item.price` 累加 — `apps/mobile/src/views/OrderConfirm.vue:104-114`。
- 提交订单只传 `productId + quantity` — `apps/mobile/src/views/OrderConfirm.vue:150-158`，由服务端重新计价，前端**没有任何对账或提示**。
- 加购不校验库存与上下架 — `apps/mobile/src/stores/cart.js:51-65`；购物车条目也没有失效态。

**前端改动**

- 新增 `previewOrder(items)`：`apps/mobile/src/api/order.js`。
- `OrderConfirm.vue` — 进入页面先试算，页面所有金额（商品小计/运费/优惠/应付）**一律渲染服务端返回**；本地 `settleTotal` 仅作骨架屏占位。
- 试算返回 `changed: true` 时（价格变动/库存不足/商品下架），弹出差异确认框，列出变动项；用户确认后以新金额继续，拒绝则返回购物车。
- `Cart.vue` — 失效条目（下架/库存 0）置灰、禁止勾选、给出「已失效」标签；`stores/cart.js` 的 `addItem` 增加 `stock`/`status` 字段与上限钳制，加购即超库存时 Toast 拦截。

**后端契约（提案）**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/orders/preview` | body `{ items:[{productId,quantity}] }`，返回 `{ items:[{productId,price,quantity,available,stock}], goodsAmount, freight, discount, payableAmount, changed }` |

**验收**

- 加购后后台改价，再进结算页：用户看到新价并被要求确认。
- 商品下架后购物车条目变灰且无法结算。
- 库存 1 件时把数量加到 5，被拦截。
- 断网重试提交订单不会产生重复单（复用既有 `Idempotency-Key`）。

**人日**：前端 2 / 后端 1 = **3**

---

#### M1-3 收货地址省市区级联

**现状证据**

- 省/市/区是三个自由文本框 — `apps/mobile/src/views/AddressList.vue:68-70`；小程序端 `pages/address` 同构。

**前端改动**

- 引入 `@vant/area-data`（离线区划数据，无需后端接口），新增 `apps/mobile/src/components/RegionField.vue`：只读 `van-field` + `van-popup` + `van-area`。
- `AddressList.vue` 三项文本框替换为该组件，保存时写回 `province/city/district` 名称；若后端需要区划编码，同时提交 `provinceCode/cityCode/districtCode`。
- 小程序端 `@vant/weapp` 无 `area` 组件，用 `picker` + `mode="region"` 原生实现，保持字段一致。

**验收**

- 无法录入非标准区划；编辑既有地址时能回显并正确选中。
- 三端提交的地址字段结构一致。

**人日**：前端 1.5 / 后端 0.5 = **2**

---

#### M1-4 演示环境说明与合规页

**现状证据**

- 全仓无「隐私 / 用户协议 / 客服 / 注销」相关实现（关键词检索仅命中 `apps/weapp/miniprogram/app.js` 的平台隐私弹窗注释）。
- 登录页无同意勾选 — `apps/mobile/src/views/Login.vue:34-49`。

**前端改动**

- 新增 `apps/mobile/src/views/Agreement.vue`，路由 `/agreement/:type`（`user` / `privacy` / `personal-info`），内容从 `apps/mobile/src/content/agreements/` 下的 Markdown 渲染。
- `Login.vue` 增加勾选框：未勾选时禁用登录与注册按钮，并给出可点击的协议链接；已登录用户可在「我的」中随时查看。
- 「我的」页增加「关于我们 / 隐私政策 / 注销账号」入口；注销账号在 M1 只提交工单或走客服（真正的自助注销归 M2）。
- 小程序端同步新增 `pages/agreement/agreement` 并在「我的」放入口。
- 隐私政策必须写明收集字段（手机号、收货地址、设备信息、错误日志）、用途、存储期限、第三方共享清单（支付、物流、对象存储）。
- 首页或「我的」页放置《演示环境说明》：数据为演示数据、支付为演示实现不产生真实扣款、可随时清空。这既是合规要求，也是避免客户误解的关键。

**验收**

- 三端均可打开《演示环境说明》与隐私说明，链接为站内路由而非外链。
- 未勾选时无法登录/注册。
- 隐私政策内容与代码实际收集项一致（逐项对照 `localStorage` 写入项与上报字段）。

**人日**：前端 1（含三端同步）= **1**

---

#### M1-5 部署配置入库

**现状证据**

- 仓库无 `Dockerfile` / `docker-compose.yml` / `nginx.conf`（`Get-ChildItem` 全量检索仅命中 `.github/workflows/ci.yml` 与 pnpm 配置）。
- Nginx 必配项（`try_files`、`/api/` 反代、`.map` 屏蔽、`gzip_static`）只以 Markdown 形式写在 `README.md:71` 与 `apps/mobile/README.md`，靠人记。

**新增文件**

- `deploy/Dockerfile.web` — 多阶段：`node:20` 构建 → `nginx:alpine` 承载，构建参数区分 `admin` / `mobile`。
- `deploy/nginx/spa.conf.template` — 单应用 SPA 通用模板（见下方片段）。
- `deploy/nginx/mobile.conf`、`deploy/nginx/admin.conf` — 两站点实例，反代目标与基础路径不同。
- `deploy/docker-compose.yml` — 编排 mobile / admin / 后端反代（后端地址走环境变量）。
- `deploy/README.md` — 一页部署步骤 + 上线前校验清单。

`spa.conf.template` 核心片段（逐项均有实测依据）：

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;

  # 压缩产物复用，避免动态压缩占 CPU
  gzip_static on;
  brotli_static on;

  # 源码防泄漏：hidden sourcemap 仍会生成 .map 且文件名可推导
  location ~ \.map$ { deny all; }

  # API 反代，缺失会导致所有接口 404 或返回 HTML
  location /api/ {
    proxy_pass http://backend:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # 带 hash 的静态资源长缓存
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # SPA fallback：缺失会导致深链刷新 404
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

**验收**

- `docker build -f deploy/Dockerfile.web --build-arg APP=mobile .` 成功。
- 容器内 `/home`、`/product/1` 直接访问返回 200；`/api/**` 正确转发；`*.map` 返回 403。
- 上传制品时剔除 `.map`（Dockerfile 内 `rm -rf dist/**/*.map` 或 CI 断言拦截）。

**人日**：**1.5**

---

#### M1-6 CI 门禁补齐

**现状证据**

- `.github/workflows/ci.yml` 只跑 install / lint / test / weapp vendor 校验，**不 build、不跑 size、不校验 `.map`**；`pnpm size` 在根 `package.json:28` 已定义但无调用方。

**改动**

- `.github/workflows/ci.yml` 在 test 之后追加：

```yaml
      - name: Build all apps
        run: pnpm build

      - name: Size budget
        # 根 pnpm size 会重复跑 build，此处直接调用各包 size 校验
        run: pnpm -r run size

      - name: Assert no sourcemap leaked to dist
        run: |
          set -e
          if find apps/*/dist -name '*.map' | grep -q .; then
            echo "dist 中存在 .map，禁止发布"; exit 1
          fi
          echo "无 .map 泄漏"
```

- 构建失败、体积超预算、`.map` 泄漏任一命中即阻断 PR 合并。
- 同时把 `pnpm format:check` 纳入校验（README 已声明其用途为 CI，但目前未接入）。

**验收**

- 故意提交一个 `.map` 到 `dist` 的模拟 PR，CI 红灯。
- 故意把某 chunk 撑大超预算，CI 红灯。
- 正常 PR 全绿，耗时增加不超过 3 分钟。

**人日**：**1**

---

### 2.5 文件改动清单（汇总）

**新增**

| 路径 | 职责 |
| --- | --- |
| `deploy/Dockerfile.web` | 多阶段构建，产出 Nginx 静态站点镜像 |
| `deploy/nginx/spa.conf.template` | SPA 通用 Nginx 模板（反代/缓存/防泄漏） |
| `deploy/nginx/mobile.conf`、`deploy/nginx/admin.conf` | 两站点实例配置 |
| `deploy/docker-compose.yml`、`deploy/README.md` | 编排与部署说明 |
| `apps/mobile/src/components/RegionField.vue` | 省市区级联选择 |
| `apps/mobile/src/views/Agreement.vue` | 协议/隐私政策渲染页 |
| `apps/mobile/src/content/agreements/*.md` | 协议正文 |
| `apps/weapp/miniprogram/pages/agreement/*` | 小程序协议页 |
| `apps/mobile/src/components/OrderShipment.vue` | 运单号与物流信息展示 |
| `packages/shared/src/payment/index.js` | 支付状态枚举与映射纯函数 |
| `packages/shared/src/payment/provider.js` | `PaymentProvider` 契约定义 |
| `packages/shared/src/payment/demo-provider.js` | Demo 实现（延迟/失败注入/伪签名） |
| `packages/shared/src/payment/wechat-provider.js` | 真实接入预留骨架 |
| `apps/mobile/src/api/payment.js` | 按 `VITE_PAYMENT_MODE` 选择 provider 的统一入口 |
| `apps/mobile/src/views/Payment.vue` | 收银台页面（H5） |
| `apps/weapp/miniprogram/pages/payment/*` | 收银台页面（小程序） |
| `docs/payment-integration-guide.md` | 真实支付接入指引（交付物） |
| `order-service/db/migration/V2__redefine_order_status.sql`（后端） | 状态重定义 + 履约字段 + 幂等键 |
| `order-service/db/migration/V3__init_payment_tables.sql`（后端） | `t_payment` / `t_refund` 建表 |
| `order-service/.../payment/PaymentController.java`（后端） | 支付单创建/查询/取消/模拟成功/微信回调 |
| `order-service/.../payment/PaymentService.java`、`DemoPaymentProvider.java`（后端） | 支付单生命周期与 Demo provider |
| `order-service/.../payment/RefundController.java`、`RefundService.java`（后端） | 退款申请与审批 |
| `order-service/.../job/OrderTimeoutCloseJob.java`（后端） | 15 分钟未支付自动关单并释放库存 |

**修改**

| 路径 | 改什么 |
| --- | --- |
| `packages/shared/src/constants.js` | 扩展订单状态枚举与文案 |
| `packages/shared/src/api.js` | 新增支付/发货/确认收货/退款 API 工厂 |
| `apps/mobile/src/api/order.js` | 新增 `previewOrder` |
| `apps/mobile/src/views/OrderConfirm.vue` | 改为服务端试算驱动全部金额 + 变动确认 |
| `apps/mobile/src/views/OrderDetail.vue` | 跳转收银台、物流区、确认收货、申请退款 |
| `apps/mobile/src/views/OrderList.vue` | 状态 Tab 扩展与操作按钮分支 |
| `apps/mobile/src/views/Cart.vue` | 失效条目态与不可结算拦截 |
| `apps/mobile/src/stores/cart.js` | 库存/上下架字段与失效态支持 |
| `apps/mobile/src/views/AddressList.vue` | 省市区级联替换 |
| `apps/mobile/src/views/Login.vue` | 协议勾选与链接 |
| `apps/mobile/src/views/Mine.vue` | 协议/隐私/注销入口 |
| `apps/mobile/src/utils/orderStatus.js` | `TYPE_MAP` 扩展 |
| `apps/admin/src/views/OrderList.vue` | 发货弹窗、退款审批、状态类型映射 |
| `apps/weapp/miniprogram/utils/orderStatus.js` | 同上（小程序侧） |
| `apps/weapp/miniprogram/pages/address/*` | `picker mode="region"` |
| `apps/weapp/miniprogram/pages/order-*/*` | 支付与状态对齐 |
| `.github/workflows/ci.yml` | build + size + `.map` 断言 + format:check |
| `apps/mobile/package.json` | 新增 `@vant/area-data` 依赖 |
| `pnpm-workspace.yaml` | catalog 增补 `@vant/area-data` |
| `apps/mobile/.env.production`、`apps/admin/.env.production` | 新增 `VITE_PAYMENT_MODE` |
| `nacos-config/api-gateway-routes.yml`（后端） | 新增 `/api/payments/**` → `lb://order-service` |
| `OrderStatusConstants.java`、`OrderServiceImpl.java`、`OrderController.java`（后端） | 状态常量、`payOrder` 改写、删除 `PATCH .../status` |
| `Order.java`、`OrderVO.java`（后端） | 透出发货/确认/取消时间与运单字段 |
| `OrderCreateDTO` / `OrderController`（后端） | 消费 `Idempotency-Key`，重复键返回已有订单 |

---

### 2.6 依赖顺序与排期

```
第 1 周
  D1     D-M1-1 / D-M1-2 定稿（前后端对齐，写入本文件）
  D1-D2  M1-1a 支付契约与抽象层
  D1-D2  M1-5 部署配置 + M1-6 CI 门禁（独立，可先合并）
  D3-D4  M1-1b 收银台 + DemoProvider（三端）
  D3-D5  M1-2 试算接口与结算页改造（可与 M1-1b 并行）

第 2 周
  D6-D7  M1-1c 退款 / 关单 / 对账
  D7-D8  M1-1d 故障注入 + 演示剧本
  D8-D9  M1-3 省市区级联（三端）
  D9     M1-4 演示环境说明与隐私页（三端）

第 3 周
  D10-D11 端到端演练：下单 → 支付 → 发货 → 收货 → 退款 + 四个异常场景
  D11      DoD 逐条验收 + 部署演练（按 deploy/README）+ 录制演示视频
```

> **2026-11-16 修订**：后端暂停改动，上面的三周排期已失效。M1-1b/c/d 与 M1-2 的服务端部分无法执行，实际排期以 §2.9 M1′ 为准。

**串行硬依赖**：`D-M1-1 / D-M1-2 定稿` → M1-1 全部；`M1-1a 契约` → `M1-1b` → `M1-1c/d`；`M1-2 试算接口` → `OrderConfirm` 改造。
**可完全并行**：M1-5、M1-6 不依赖任何业务改动，第一周即可合并；M1-3、M1-4 与支付链路无耦合。

---

### 2.7 风险与回滚

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 支付回调丢失 / 重复回调 | 订单状态错乱、重复发货 | 回调幂等（以 `transactionId` 去重）+ 前端轮询查单兜底 + 后台对账任务 |
| 状态码重定义与后端不同步 | 三端状态显示错乱 | `D-M1-1` 必须前后端签字后再改代码；`constants.js` 为唯一来源，禁止硬编码数字 |
| 试算与服务端下单结果不一致 | 客诉「价格欺诈」 | 下单返回最终金额，前端若与试算差异 > 0 必须二次确认；后端保证试算与下单同一套计价逻辑 |
| Nginx 配置入库后与实际网关冲突 | 部署后 404/502 | 配置中后端地址全部走环境变量；上线前按 `deploy/README` 跑校验清单 |
| 协议内容与实际收集项不符 | 合规风险 | 隐私政策逐项对照 `localStorage` 写入项与上报字段，作为 M1-4 验收硬条件 |
| Provider 契约与真实 APIv3 漂移 | 切换真实支付时仍需改业务代码 | 以 §2.3 契约表为唯一依据；`wechat-provider.js` 骨架随契约同步维护；切换演练纳入 DoD |
| `local` 模式与后端 `demo` 行为不一致 | 客户在 H5 看到的流程与真实不一致 | 两种模式共用同一份状态映射与 UI，差异只允许存在于"数据来源"；DoD 要求两模式各跑一次 |

**回滚**：M1-5/M1-6 是纯增量，可独立回滚；M1-1 通过 `VITE_PAYMENT_MODE` 可回退到 `local` 模式（不依赖后端）；M1-4 说明页为静态资源，回滚即下线路由。

---

### 2.8 前置外部依赖

**M1 阻塞项（仅一项）**

| 依赖 | 归属 | 阻塞范围 | 状态 |
| --- | --- | --- | --- |
| 备案 HTTPS 域名（H5 公网演示入口） | 运维 | M1-5、对外展示 | 未确认 |
| 后端改造（支付域 / 7 态状态码 / 下单幂等 / 试算接口） | 后端 | M1-1b/c/d、M1-2 | 已冻结（2026-11-16），契约见后端仓库 `docs/订单状态机与支付域改造说明.md` |

**客户交付时才需要（不阻塞 M1）**

| 依赖 | 触发时机 |
| --- | --- |
| 微信支付商户号 + API 证书 | 客户主体为个体工商户/企业，且要接真实支付 |
| 小程序 AppID + 类目资质 | 客户要正式发布小程序；流程见 release-checklist §2 |
| 《食品经营许可证》 | 客户真实售卖食品 |

> M1 不再依赖真实商户号。域名未就绪时可用临时预览域名（Vercel / Netlify）先对外展示，但正式演示建议用备案域名。

---

### 2.9 M1′ 前端可独立交付清单（后端不改的前提）

> **前提**：后端 `snackstore-cloud` 暂不修改，M1-1 的支付单 / 回调 / 关单 / 退款、7 态状态机、下单幂等、服务端试算全部冻结。本节把 M1 中**零后端依赖**的部分抽出，作为当前可执行的交付范围。

**冻结清单（等后端启动）**

| 原任务 | 卡点 | 解冻条件 |
| --- | --- | --- |
| 支付单 / 回调 / 关单 / 退款 | 无 `/api/payments/**` 端点 | 后端完成 `docs/订单状态机与支付域改造说明.md` §3 |
| 待发货 / 待收货状态 | `t_order.status` 仍为 0/1/2 | 后端执行 `V2__redefine_order_status.sql` |
| 下单幂等生效 | 后端不消费 `Idempotency-Key` | 后端完成 §4 |
| 服务端试算 | 无 `/orders/preview` 端点 | 后端新增端点 |

> 状态码 `1` 当前语义是「已完成」，**禁止**前端提前把文案改成「待发货」——支付成功的订单会直接以错误状态展示给客户。

**可执行清单**

| # | 任务 | 人日 | 状态 | 交付内容 |
| --- | --- | --- | --- | --- |
| M1′-1 | 部署配置入库 | 1.5 | 已完成 | `deploy/`：`Dockerfile.web`、nginx 模板、compose、README；镜像实测构建通过，两容器 healthy |
| M1′-2 | CI 门禁补齐 | 1 | 已完成 | `format:check` / `build` / `size` / `.map` 断言；`sourcemap` 改为默认关闭 |
| M1′-3 | 支付抽象层 + 收银台 | 2 | 已完成 | `packages/shared/src/payment.js`（`PaymentProvider` 契约 + `local` 实现）；独立收银台页（订单号 / 金额 / 15 分钟倒计时 / 演示横幅 / 结果态），内部仍调现有 `PATCH /orders/{id}/status` |
| M1′-4 | 演示环境说明与隐私页 | 1 | 已完成 | `packages/shared/src/agreements.js` + `/agreement/:type` + 登录页勾选 + 「我的」入口，三端同构 |
| M1′-5 | 补「已取消」Tab 与后台删除订单 | 0.5 | 已完成 | 三端订单列表补 `status=2` Tab；后台接 `DELETE /orders/{id}`（仅已取消订单） |
| M1′-6 | 下单金额对账提示 | 0.5 | 已完成 | `packages/shared/src/orderAmount.js` 对比 `POST /orders` 返回的 `totalAmount` 与本地快照，不一致时弹窗告知实际应付并进详情页；服务端未返回金额时不误报 |
| M1′-7 | 购物车失效态 | 1 | 已完成 | `shared/cart.js` 的 `getCartItemIssue`（下架/售罄/超库存）+ 详情页加购与直购校验；结算页按最新商品校验，失效条目置灰不入单、不计入合计，全失效时给空态出口 |
| M1′-8 | 省市区级联 | 2 | 已完成 | `@vant/area-data` + Vant `van-area`（H5）与 `@vant/weapp/area`（小程序）；`shared/area.js` 按名称反查编码回填；字段仍为省/市/区三个字符串，后端不变 |
| M1′-9 | 后台分类排序 | 0.5 | 待开始 | 列表按 `sort` 排序 + 上下移按钮 |
| M1′-10 | E2E 冒烟 | 2 | 待开始 | Playwright 覆盖 登录 → 加购 → 下单 → 支付 → 取消 |
| — | **合计** | **12** | 已完成 9.5，剩余 2.5 | — |

**建议顺序**：M1′-3 → M1′-4 → M1′-5 → M1′-6 → M1′-7 → M1′-8 → M1′-9 → M1′-10（前六项已完成）。

**M1′ 完成判据**

- 备案域名（或临时预览域名）可访问 C 端与后台，深链刷新不 404；
- 收银台能完整演示「下单 → 支付 → 完成」，页面明确标注「演示环境，不产生真实扣款」；
- `VITE_PAYMENT_MODE` 切到 `demo` 时页面代码零改动，只需新增 provider 实现；
- CI 四项门禁全绿，镜像内无 `.map`，`size` 达标。

---

## 3. M2 / M3 任务登记（细化另开文档）

### M2「能运营」待细化的任务

- M2-1 运费模板与包邮规则（进入服务端试算）
- M2-2 优惠券 / 满减 / 活动价（与试算、订单快照、退款金额分配绑定）
- M2-3 SKU/规格模型与三端选择器
- M2-4 图片上传：对象存储直传签名 + 后台图库选择器 + 前端图片压缩
- M2-5 售后与客服（退款工单、退货物流、在线客服或客服消息）
- M2-6 Banner/首页装修 CMS
- M2-7 商品评价与收藏
- M2-8 后台 RBAC + 操作日志/审计 + 数据导出
- M2-9 账号安全：短信/图形验证码、找回密码、修改密码（`apps/admin/src/views/Settings.vue:29-35` 现为占位）、登录失败锁定
- M2-10 埋点与看板：曝光/点击/加购/下单/支付漏斗、GMV/客单价/退货率、RUM 与告警
- M2-11 staging 环境、构建版本号注入、灰度与回滚方案

### M3「可规模化」待细化的任务

- M3-1 小程序 `wx.login` + openid 静默注册（依赖后端 `/auth/wx-login`）
- M3-2 微信 JSAPI 支付 —— **当前主体受限，暂不适用**；仅当主体升级为个体工商户/企业后启用，届时在 M1 支付抽象层上新增 `WechatProvider` 实现即可
- M3-3 订阅消息（发货/退款通知）
- M3-4 分享卡片与增长位
- M3-5 发布灰度、监控告警看板、依赖审计（Dependabot / `pnpm audit`）

---

## 4. 变更记录

| 日期 | 变更 | 说明 |
| --- | --- | --- |
| 2026-11-15 | 初版 | 登记 M1/M2/M3，展开 M1 工作分解；`D-M1-1` 与后端契约待确认 |
| 2026-11-15 | 第二次修订 | 支付方案改为「契约对齐 APIv3 的抽象层 + 可切换 Provider」；M1-1 拆为 a/b/c/d；新增 §2.3 支付策略与主体约束；排除微信沙箱；M1 估算 20.5 → 14.5 人日；M3-2 标注主体受限 |
| 2026-11-15 | 第三次修订（决策定稿） | 基于 `snackstore-cloud` 代码实证定稿 D-M1-1（7 态 + 迁移脚本）与 D-M1-2（支付单/退款单表 + 15 个端点 + 网关路由）；修正「下单幂等已具备」的错误结论（后端未消费 `Idempotency-Key`）；M1-1 按前后端分列重估 6 → 10 人日，M1 总计 18.5 人日 |
| 2026-11-16 | 第四次修订（后端暂停） | 后端仓库暂不修改：M1-1 标注「后端待启动」并指向已交付的后端文档；§2.6 排期声明失效；新增 §2.9 M1′ 前端可独立交付清单（10 项 / 12 人日，M1′-1、M1′-2 已完成）；§2.8 增补后端改造为阻塞项 |
| 2026-11-16 | 第五次修订 | M1′-3 ~ M1′-6 完成并实测：支付抽象层与三端收银台、协议页与登录勾选、三端「已取消」Tab 与后台删除、下单金额对账（`orderAmount.js` + 不一致弹窗）；合计已完成 6 / 12 人日 |
| 2026-11-16 | 第六次修订 | M1′-7 完成并实测：购物车失效态（`getCartItemIssue`，加购/直购/结算三处校验，失效条目置灰不入单）；合计已完成 7 / 12 人日 |
| 2026-11-16 | 第七次修订 | M1′-8 完成并实测：省市区级联（`@vant/area-data` + 两端 van-area + `shared/area.js` 编码回填），H5 面积数据拆为地址页按需加载 chunk 并单独设体积门禁；小程序主包 712KB。合计口径修正：已完成 9.5 / 12（前两次误记为 6、7） |
