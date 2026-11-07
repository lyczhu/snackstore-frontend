import ci from 'miniprogram-ci'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 主包/分包体积门禁（spec §4.3 / Task 26）。
 * projectPath 指向 **apps/weapp**（含 project.config.json），由 miniprogramRoot 定位 miniprogram/，
 * 不能直接指向 miniprogram/ —— 否则 ci 读不到项目配置。
 * 需要真实 appid + 上传私钥，与 upload.mjs 同一套环境变量。
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appid = process.env.WX_APPID
const privateKeyPath = path.join(root, 'keys', `private.${appid}.key`)

if (!appid) {
  console.error('缺少 WX_APPID：checksize 需要真实 appid（游客 appid 无法取到包体信息）')
  process.exit(1)
}
if (!existsSync(privateKeyPath)) {
  console.error(`缺少上传私钥：${privateKeyPath}（见 keys/README.md）`)
  process.exit(1)
}

const project = new ci.Project({
  appid,
  type: 'miniProgram',
  projectPath: root,
  privateKeyPath,
  ignores: ['node_modules/**/*']
})

const MB = 1024 * 1024
const sizes = await ci.getCodePackageSize({ project, packageType: 'miniProgram' })
const main = sizes.mainSize ?? 0
const sub = sizes.subSize ?? 0

console.table({
  '主包 (MB)': (main / MB).toFixed(2),
  '分包合计 (MB)': (sub / MB).toFixed(2)
})

// 1.8MB 为预警线（硬限 2MB）：越线即触发分包预案讨论，而不是等提审被打回
if (main > 1.8 * MB) {
  console.error(`主包 ${(main / MB).toFixed(2)}MB 超过 1.8MB 预警线，启动分包预案（spec §4.3）`)
  process.exit(1)
}
console.log('体积门禁通过')
