/**
 * 小程序分页加载（页面生命周期驱动，spec D12）：
 * 页面 onReachBottom -> list.onLoad()；onPullDownRefresh -> list.resetAndReload()。
 * 用递增 seq 守卫代替 H5 的 AbortController：响应回来时若 seq 已变（被重置/新轮覆盖），
 * 说明这是过期响应，直接丢弃，避免脏写回已重置的列表。
 *
 * 状态语义对齐 apps/mobile/src/composables/usePagedList.js。
 * @param {{ fetcher: (pageNum:number, pageSize:number)=>Promise<any>, pageSize?: number, guard?: ()=>boolean }} opts
 */
export function createPagedList(opts) {
  const fetcher = opts.fetcher
  const pageSize = opts.pageSize || 10
  const guard = opts.guard
  let seq = 0
  const list = {
    items: [],
    pageNum: 1,
    loading: false,
    finished: false,
    listError: false,
    initialLoading: true,
    loadError: false,
    onLoad() {
      // 前置条件未就绪：结束本次触发，保持骨架屏，等待外部 resetAndReload 驱动
      if (guard && !guard()) {
        list.loading = false
        list.finished = true
        return Promise.resolve()
      }
      const my = ++seq
      list.loading = true
      return Promise.resolve()
        .then(() => fetcher(list.pageNum, pageSize))
        .then((res) => {
          if (my !== seq) return // 过期响应，丢弃
          const arr = (res && res.data && res.data.data) || []
          list.items = list.items.concat(arr)
          list.pageNum += 1
          if (arr.length < pageSize) list.finished = true
        })
        .catch(() => {
          if (my !== seq) return
          if (list.pageNum === 1) list.loadError = true
          else list.listError = true
        })
        .then(() => {
          if (my !== seq) return
          list.loading = false
          list.initialLoading = false
        })
    },
    resetAndReload() {
      list.items = []
      list.pageNum = 1
      list.finished = false
      list.listError = false
      list.loadError = false
      list.initialLoading = true
      return list.onLoad()
    }
  }
  return list
}
