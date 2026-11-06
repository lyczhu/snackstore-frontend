/**
 * 极简跨页状态容器（spec D4）：state 只读约定 + subscribe + patch。
 * 仅 stores/*.js 内部调用 patch；页面通过 subscribe 回调 setData，onUnload 退订。
 * @param {Object} [initial]
 */
export function createStore(initial = {}) {
  let state = { ...initial }
  const listeners = new Set()
  return {
    getSnapshot: () => state,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    patch(partial) {
      state = { ...state, ...partial }
      listeners.forEach((fn) => fn(state))
    }
  }
}
