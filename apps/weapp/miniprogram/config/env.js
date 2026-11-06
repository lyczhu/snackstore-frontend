// weapp 运行期配置（无构建步骤，直接以模块形式被源码 import）。
// 治理口径见 apps/weapp/README.md：生产上线前把 API_BASE_URL 换成「已备案 HTTPS 域名」，
// 并在小程序后台加入 request / downloadFile 合法域名白名单。
//
// 与 H5 的 .env 不同：小程序不存在 import.meta.env，也没有同源反代，
// 因此 API_BASE_URL 必须是绝对地址；开发默认本地 http（配合开发者工具「不校验合法域名」）。
export default {
  API_BASE_URL: 'http://localhost:8080/api',
  TIMEOUT: 10000,
  IS_DEV: true,
  // 客户端错误上报端点，缺省空字符串即不发送网络请求（与 H5 口径一致）
  ERROR_REPORT_URL: ''
}
