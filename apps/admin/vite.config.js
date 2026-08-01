import { defineConfig, loadEnv } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
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
      ...createBasePlugins({ resolver: ElementPlusResolver() }),
      compressAssets(),
      // pnpm build:analyze 时生成产物构成报告 dist/report.html
      mode === 'analyze' &&
        visualizer({ filename: 'dist/report.html', gzipSize: true, brotliSize: true })
    ].filter(Boolean),
    ...createBaseConfig({ port: 3001, apiTarget: env.VITE_API_TARGET || 'http://localhost:8080' }),
    build: {
      // hidden：生成 sourcemap 但产物不引用，配合错误监控平台上传使用
      sourcemap: mode === 'production' ? 'hidden' : false,
      rollupOptions: {
        output: {
          // vendor 分包，利于浏览器长效缓存
          manualChunks: createManualChunks({
            echarts: ['echarts', 'zrender'],
            'element-plus': ['element-plus', '@element-plus'],
            'vendor-axios': ['axios'],
            _default: 'vendor'
          })
        }
      }
    }
  }
})
