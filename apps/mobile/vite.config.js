import { defineConfig, loadEnv } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { VantResolver } from 'unplugin-vue-components/resolvers'
import {
  createBasePlugins,
  createBaseConfig,
  compressAssets,
  createManualChunks
} from '@snackstore/vite-config'

export default defineConfig(({ mode }) => {
  // 环境变量从 .env.[mode] 加载；VITE_API_TARGET 缺省回退本地后端，行为与改造前一致
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      ...createBasePlugins({ resolver: VantResolver() }),
      compressAssets(),
      // pnpm build:analyze 时生成产物构成报告 dist/report.html
      mode === 'analyze' &&
        visualizer({ filename: 'dist/report.html', gzipSize: true, brotliSize: true })
    ].filter(Boolean),
    ...createBaseConfig({ port: 3000, apiTarget: env.VITE_API_TARGET || 'http://localhost:8080' }),
    build: {
      // hidden：生成 sourcemap 但产物不引用，配合错误监控平台上传使用
      sourcemap: mode === 'production' ? 'hidden' : false,
      rollupOptions: {
        output: {
          // 拆分核心 vendor chunk，提升长缓存命中率
          manualChunks: createManualChunks({
            'vendor-vant': ['/node_modules/vant/', '/node_modules/@vant/'],
            'vendor-vue': [
              '/node_modules/vue/',
              '/node_modules/@vue/',
              '/node_modules/vue-router/',
              '/node_modules/pinia/',
              '/node_modules/axios/'
            ],
            _default: 'vendor-misc'
          })
        }
      }
    }
  }
})
