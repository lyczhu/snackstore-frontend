import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import skipFormatting from 'eslint-config-prettier'

/**
 * 创建共享的 ESLint flat config —— web 与 admin 通用
 *
 * 设计决策：
 * - flat/recommended：vue3 必备规则 + 强烈建议规则，保证模板与脚本质量
 * - eslint-config-prettier 置于末尾，关闭所有与 Prettier 冲突的格式规则
 * - 代码已全部显式 import vue API（未依赖 unplugin-auto-import 隐式全局），
 *   故无需注入 auto-import globals
 *
 * @param {Object} options
 * @param {string[]} [options.ignores] 额外的忽略 glob
 */
export function createEslintConfig({ ignores = [] } = {}) {
  return [
    {
      ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', ...ignores]
    },
    js.configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    {
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: {
          ...globals.browser,
          ...globals.node
        }
      },
      rules: {
        // 路由视图允许单词组件名（Home、Cart、Mine 等）
        'vue/multi-word-component-names': 'off',
        // 下划线前缀视为有意忽略（如 catch (_)、(_event)）
        // caughtErrors: 'none' —— 本项目的 catch 统一交由全局 axios 拦截器提示，
        // 错误变量无消费场景，故不校验 catch 绑定是否使用
        'no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
        ],
        // 允许空 catch（项目惯用的静默忽略），但其他空块仍报错
        'no-empty': ['error', { allowEmptyCatch: true }]
      }
    },
    skipFormatting
  ]
}
