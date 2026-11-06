import { createEslintConfig } from '@snackstore/eslint-config'

export default [
  ...createEslintConfig({
    ignores: ['**/.workbuddy/**', 'docs/**', 'apps/weapp/miniprogram_npm/**']
  }),
  {
    // 小程序源码运行时全局（wx/App/Page/…），避免 no-undef 误报
    files: ['apps/weapp/miniprogram/**/*.js'],
    languageOptions: {
      globals: {
        wx: 'readonly',
        App: 'readonly',
        Page: 'readonly',
        Component: 'readonly',
        Behavior: 'readonly',
        getApp: 'readonly',
        getCurrentPages: 'readonly',
        requirePlugin: 'readonly'
      }
    }
  }
]
