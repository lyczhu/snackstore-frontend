import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src')
    }
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.js'],
    setupFiles: ['@snackstore/shared/test/storage-polyfill'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,vue}'],
      exclude: [
        '**/*.test.js',
        'src/main.js',
        'src/router/**',
        'src/views/**',
        'src/components/**',
        'src/App.vue',
        'src/utils/request.js',
        'src/stores/user.js',
        'src/api/order.js',
        'src/api/user.js'
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 60
      }
    }
  }
})
