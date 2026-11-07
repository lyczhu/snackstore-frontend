import ci from 'miniprogram-ci'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 上传体验版（Task 26）。真实上传需要 appid + 上传私钥，凭证不入库（keys/ 已 gitignore）。
 * projectPath 指向 apps/weapp（含 project.config.json），miniprogramRoot 由该配置定位。
 *
 *   WX_APPID=wx1234567890abcdef WX_DESC="迭代说明" pnpm -F @snackstore/weapp upload
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appid = process.env.WX_APPID
const privateKeyPath = path.join(root, 'keys', `private.${appid}.key`)

if (!appid) {
  console.error('缺少 WX_APPID，禁止使用占位 appid 上传')
  process.exit(1)
}
if (!existsSync(privateKeyPath)) {
  console.error(`缺少上传私钥：${privateKeyPath}（获取方式见 keys/README.md）`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
// argv 数组形式调用，不经过 shell，避开元字符注入面
const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root })
  .toString()
  .trim()

const project = new ci.Project({
  appid,
  type: 'miniProgram',
  projectPath: root,
  privateKeyPath,
  ignores: ['node_modules/**/*']
})

await ci.upload({
  project,
  version: `${pkg.version}+${sha}`,
  desc: process.env.WX_DESC || `CI ${sha}`,
  robot: Number(process.env.WX_ROBOT || 1),
  // 本工程无构建步骤：es6 让 ci 侧转译 miniprogram_npm 里的 ESM（与开发者工具 es6:true 一致），
  // 切勿在此调用「构建 npm」——pnpm workspace 布局下该步骤会静默产出空 miniprogram_npm（POC-4）。
  setting: { es6: true, enhance: true, minified: true }
})

console.log(`上传完成：${pkg.version}+${sha}，小程序后台「版本管理」可查看体验版`)
