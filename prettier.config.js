/**
 * Prettier 共享配置 —— 与仓库现有代码风格对齐（无分号、单引号、无尾逗号）
 * endOfLine 'lf'：与 .gitattributes 的 eol=lf 策略一致，全仓统一 LF 换行
 * @see https://prettier.io/docs/configuration
 */
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  printWidth: 100,
  endOfLine: 'lf',
  vueIndentScriptAndStyle: false
}
