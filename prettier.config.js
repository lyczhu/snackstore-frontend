/**
 * Prettier 共享配置 —— 与仓库现有代码风格对齐（无分号、单引号、无尾逗号）
 * endOfLine 'auto'：Windows 协作环境行尾混合（IDE 写入 CRLF），保持各文件现状不强制转换
 * @see https://prettier.io/docs/configuration
 */
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  printWidth: 100,
  endOfLine: 'auto',
  vueIndentScriptAndStyle: false
}
