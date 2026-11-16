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
      // 默认不产出 sourcemap：hidden 模式仍会把 .map 写到 dist，且文件名可由 chunk 名推导，
      // 一旦随静态资源上传即等于源码外泄。需要排查线上问题时用：
      //   VITE_SOURCEMAP=true pnpm build:mobile
      // 这类产物只允许上传到错误监控平台，禁止进静态站点（CI 有断言）。
      sourcemap: env.VITE_SOURCEMAP === 'true' ? 'hidden' : false,
      rollupOptions: {
        output: {
          // 拆分核心 vendor chunk，提升长缓存命中率
          // area-data（116KB 省市区数据）必先命中：只被地址页懒加载路由引用，不进首屏
          manualChunks: createManualChunks({
            'area-data': ['/node_modules/@vant/area-data/'],
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
