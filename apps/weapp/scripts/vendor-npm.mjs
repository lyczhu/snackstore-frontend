// 生成 miniprogram_npm —— 绕过微信开发者工具「构建 npm」在 pnpm workspace 布局下的空跑（POC-4 实测结论）。
// - @vant/weapp：把 node_modules/@vant/weapp/lib 内容铺到 miniprogram_npm/@vant/weapp/（对齐 devtools 构建产物结构）
// - @snackstore/shared：只 vendor 平台无关纯模块（cart/storage/constants/response），不引入 axios
import { cp, rm, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url)) // apps/weapp/scripts
const weappDir = resolve(scriptDir, '..') // apps/weapp
const outDir = resolve(weappDir, 'miniprogram', 'miniprogram_npm')
const vantLib = resolve(weappDir, 'node_modules', '@vant', 'weapp', 'lib')
const sharedSrc = resolve(weappDir, '..', '..', 'packages', 'shared', 'src')

const sharedFiles = ['cart.js', 'storage.js', 'constants.js', 'response.js']

if (!existsSync(vantLib)) {
  console.error('[vendor-npm] 未找到 @vant/weapp/lib：' + vantLib)
  process.exit(1)
}
if (!existsSync(sharedSrc)) {
  console.error('[vendor-npm] 未找到 shared 源码：' + sharedSrc)
  process.exit(1)
}

await rm(outDir, { recursive: true, force: true })
await mkdir(resolve(outDir, '@snackstore', 'shared'), { recursive: true })

// @vant/weapp：lib 内容直接铺到包根（组件路径 @vant/weapp/button/index → miniprogram_npm/@vant/weapp/button/index）
await cp(vantLib, resolve(outDir, '@vant', 'weapp'), { recursive: true })

// @snackstore/shared：仅纯模块
for (const f of sharedFiles) {
  await cp(resolve(sharedSrc, f), resolve(outDir, '@snackstore', 'shared', f))
}

// 防御性：提供一个不含 axios 的 index 入口，避免任何残留的裸导入 '@snackstore/shared' 解析失败
const barrel = [
  "export { mergeCartItems, calcCentsTotal } from './cart.js'",
  "export { safeParse } from './storage.js'",
  "export { API_SUCCESS_CODE, ORDER_STATUS, getOrderStatusText } from './constants.js'",
  "export { interpretResponse } from './response.js'",
  ''
].join('\n')
await writeFile(resolve(outDir, '@snackstore', 'shared', 'index.js'), barrel, 'utf8')

console.log('[vendor-npm] done ->', outDir)
