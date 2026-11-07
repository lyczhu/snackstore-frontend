import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// weapp 无构建步骤：测试用 vitest（node 环境）+ wx mock。
// @snackstore/shared 通过 alias 直接指向源码入口，避免依赖「构建 npm」产物
// （真实小程序运行时由 packNpm 生成 miniprogram_npm，二者解析路径不同）。
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [fileURLToPath(new URL('./test/wx-mock.js', import.meta.url))],
    include: ['miniprogram/**/*.test.js'],
    alias: [
      {
        find: '@snackstore/shared/cart',
        replacement: fileURLToPath(new URL('../../packages/shared/src/cart.js', import.meta.url))
      },
      {
        find: '@snackstore/shared/storage',
        replacement: fileURLToPath(new URL('../../packages/shared/src/storage.js', import.meta.url))
      },
      {
        find: '@snackstore/shared/constants',
        replacement: fileURLToPath(new URL('../../packages/shared/src/constants.js', import.meta.url))
      },
      {
        find: '@snackstore/shared/response',
        replacement: fileURLToPath(new URL('../../packages/shared/src/response.js', import.meta.url))
      },
      {
        find: '@snackstore/shared',
        replacement: fileURLToPath(new URL('../../packages/shared/src/index.js', import.meta.url))
      }
    ]
  }
})
