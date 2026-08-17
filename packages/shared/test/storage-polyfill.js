// Node 24+ 内置实验性 localStorage 全局 getter（未提供 --localstorage-file 时
// 访问结果为 undefined），导致 vitest populateGlobal 跳过注入环境实现的
// localStorage/sessionStorage。此处用内存实现覆盖，保证测试环境可用。
function createMemoryStorage() {
  let map = new Map()
  return {
    getItem: (key) => (map.has(String(key)) ? map.get(String(key)) : null),
    setItem: (key, value) => {
      map.set(String(key), String(value))
    },
    removeItem: (key) => {
      map.delete(String(key))
    },
    clear: () => {
      map = new Map()
    },
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size
    }
  }
}

for (const name of ['localStorage', 'sessionStorage']) {
  Object.defineProperty(globalThis, name, {
    value: createMemoryStorage(),
    configurable: true,
    writable: true
  })
  // 部分代码经由 window 访问存储；vitest 中 window === globalThis 时无需再定义（否则会递归）
  if (typeof window !== 'undefined' && window !== globalThis) {
    Object.defineProperty(window, name, {
      get: () => globalThis[name],
      configurable: true
    })
  }
}
