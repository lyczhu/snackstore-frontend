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
        'src/api/**'
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
