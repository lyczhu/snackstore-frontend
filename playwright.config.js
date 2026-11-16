import { defineConfig, devices } from '@playwright/test'

/**
 * E2E 冒烟配置（M1′-10）。
 *
 * 跑的是 **生产构建包**（`pnpm build:mobile` + `vite preview`），不是 dev server：
 * dev server 首次访问懒加载路由时要做按需编译与依赖重优化，会让 push 式导航偶发失败
 * （实测：点「去结算」后停在购物车）。preview 产物静态、每次结果一致，也更贴近线上。
 * mock 后端仍是真实 HTTP，Vite preview 通过 proxy 转发 /api。
 * 串行执行（workers=1）：mock 状态在内存里，并行会互相干扰。
 */
const MOBILE_PORT = 3101
const MOCK_PORT = 8099

// 本地可直接用已安装的 Chrome（PLAYWRIGHT_CHANNEL=chrome），免下载 Chromium；
// CI 不设该变量，走 pnpm exec playwright install 装好的 Chromium。
const channel = process.env.PLAYWRIGHT_CHANNEL

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${MOBILE_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) }
    }
  ],
  webServer: [
    {
      command: 'node e2e/mock-server.mjs',
      port: MOCK_PORT,
      reuseExistingServer: !process.env.CI,
      env: { MOCK_PORT: String(MOCK_PORT) }
    },
    {
      // 独立端口 + 独立代理目标，不影响开发者本地已起的 3000/3005。
      // preview 默认继承 server.proxy，因此 VITE_API_TARGET 仍然生效。
      command: `pnpm exec vite preview --port ${MOBILE_PORT}`,
      cwd: './apps/mobile',
      port: MOBILE_PORT,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_TARGET: `http://localhost:${MOCK_PORT}` }
    }
  ]
})
