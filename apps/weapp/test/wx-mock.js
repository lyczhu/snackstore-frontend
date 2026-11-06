// 最小 wx 运行时替身，供 weapp 逻辑件（request/store）在 vitest(node) 下驱动。
// 各测试可用 vi.spyOn(wx, 'request') 等覆盖具体行为。
const storage = new Map()

export function resetStorage() {
  storage.clear()
}

const wx = {
  // 同步存储
  getStorageSync: (k) => (storage.has(k) ? storage.get(k) : ''),
  setStorageSync: (k, v) => storage.set(k, v),
  removeStorageSync: (k) => storage.delete(k),

  // 交互（多数用例不校验具体表现，仅保证不抛）
  showToast: () => {},
  showModal: (o) => o.success && o.success({ confirm: true, cancel: false }),
  navigateTo: () => {},
  redirectTo: () => {},
  switchTab: () => {},
  reLaunch: () => {},
  stopPullDownRefresh: () => {},

  // tabBar 徽标：非 tab 场景抛错，用于验证 syncTabBadge 的 try/catch 兜底
  setTabBarBadge: () => {
    throw new Error('no tabbar')
  },
  removeTabBarBadge: () => {
    throw new Error('no tabbar')
  },

  // 网络：默认成功回环，测试内按需覆盖
  request: ({ success }) =>
    success({ statusCode: 200, data: { code: 200, data: null }, header: {} })
}

globalThis.wx = wx
