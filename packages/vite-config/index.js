import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import path from 'node:path'
import { gzip, brotliCompress, constants } from 'node:zlib'
import { promisify } from 'node:util'

const gzipAsync = promisify(gzip)
const brotliAsync = promisify(brotliCompress)

/**
 * 产物压缩插件：为 js/css/html/svg 资源同时生成 .gz 与 .br
 * （第三方 vite-plugin-compression 已停更，与 Vite 8/rolldown 兼容性差，故内联实现）
 */
export function compressAssets() {
  return {
    name: 'compress-assets',
    apply: 'build',
    async generateBundle(_, bundle) {
      await Promise.all(
        Object.values(bundle).map(async (item) => {
          if (!/\.(js|css|html|svg)$/.test(item.fileName)) return
          const source = item.type === 'asset' ? item.source : item.code
          if (!source) return
          const buf = Buffer.isBuffer(source) ? source : Buffer.from(source)
          this.emitFile({
            type: 'asset',
            fileName: `${item.fileName}.gz`,
            source: await gzipAsync(buf)
          })
          this.emitFile({
            type: 'asset',
            fileName: `${item.fileName}.br`,
            source: await brotliAsync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
          })
        })
      )
    }
  }
}

/**
 * 归一化 Windows 路径中的反斜杠，用于 manualChunks 判断
 */
function normalizePath(id) {
  return id.replaceAll('\\', '/')
}

/**
 * 创建 vendor 分包函数
 * @param {Object} groups - { chunkName: [pattern, ...], ..., _default: 'fallbackChunkName' }
 */
export function createManualChunks(groups = {}) {
  const { _default = 'vendor', ...named } = groups
  return (id) => {
    const p = normalizePath(id)
    if (!p.includes('/node_modules/')) return undefined
    for (const [chunkName, patterns] of Object.entries(named)) {
      if (patterns.some((pattern) => p.includes(pattern))) return chunkName
    }
    return _default
  }
}

/**
 * 创建共享的 Vite 基础插件数组（vue + AutoImport + Components）
 * @param {Object} options
 * @param {import('unplugin-vue-components/resolvers').ComponentResolver} options.resolver UI 库解析器
 */
export function createBasePlugins({ resolver }) {
  return [
    vue(),
    AutoImport({
      resolvers: [resolver],
      imports: ['vue', 'vue-router', 'pinia']
    }),
    Components({
      resolvers: [resolver]
    })
  ]
}

/**
 * 创建共享的 Vite 基础配置（alias + server proxy）
 * @param {Object} options
 * @param {number} options.port     开发服务器端口
 * @param {string} options.apiTarget API 代理目标地址
 */
export function createBaseConfig({ port = 3000, apiTarget = 'http://localhost:8080' }) {
  return {
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src')
      }
    },
    server: {
      port,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true
        }
      }
    }
  }
}
