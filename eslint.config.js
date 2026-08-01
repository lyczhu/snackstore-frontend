import { createEslintConfig } from '@snackstore/eslint-config'

export default createEslintConfig({
  ignores: ['**/.workbuddy/**', 'docs/**']
})
