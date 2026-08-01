/**
 * 本地缓存容错解析：JSON 损坏时回退默认值，避免 Store 初始化崩溃。
 * web 与 admin 共用，统一收口在共享包，避免两端各写一份。
 *
 * @param {string|null} json
 * @param {*} fallback
 * @returns {*}
 */
export function safeParse(json, fallback) {
  try {
    return JSON.parse(json) ?? fallback
  } catch {
    return fallback
  }
}
