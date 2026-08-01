import { ref } from 'vue'

/**
 * van-list 上拉分页加载的通用逻辑
 * （Home / Category / OrderList 三处同构代码，已收口为 composable）
 *
 * 状态语义与 van-list 的对应：
 * - loading / listError：van-list 双向绑定的加载中与翻页错误态
 * - finished：数据不足一页时置位，停止继续触发 onLoad
 * - initialLoading：首屏骨架屏；loadError：首屏失败整页错误占位（区别于翻页失败）
 *
 * @param {Object} options
 * @param {(pageNum: number, pageSize: number) => Promise<Object>} options.fetcher
 *        拉取一页数据，需返回后端 Result 包装（res.data.data 为数组）
 * @param {number} [options.pageSize=10]
 * @param {() => boolean} [options.guard]
 *        返回 false 时本次加载直接结束并保持首屏态（用于前置数据未就绪，如分类未加载完）
 */
export function usePagedList({ fetcher, pageSize = 10, guard } = {}) {
  const items = ref([])
  const pageNum = ref(1)
  const loading = ref(false)
  const finished = ref(false)
  const listError = ref(false)
  const initialLoading = ref(true)
  const loadError = ref(false)

  async function onLoad() {
    // 前置条件未就绪：结束本次触发，保持骨架屏，等待外部调用 resetAndReload 驱动
    if (guard && !guard()) {
      loading.value = false
      finished.value = true
      return
    }
    try {
      const res = await fetcher(pageNum.value, pageSize)
      const list = res.data?.data || []
      items.value.push(...list)
      pageNum.value += 1
      if (list.length < pageSize) finished.value = true
    } catch {
      // 首屏失败显示整页错误占位；翻页失败走 van-list 内置错误态
      if (pageNum.value === 1) loadError.value = true
      else listError.value = true
    } finally {
      loading.value = false
      initialLoading.value = false
    }
  }

  function resetAndReload() {
    items.value = []
    pageNum.value = 1
    finished.value = false
    listError.value = false
    loadError.value = false
    initialLoading.value = true
    loading.value = true
    onLoad()
  }

  return {
    items,
    pageNum,
    loading,
    finished,
    listError,
    initialLoading,
    loadError,
    onLoad,
    resetAndReload
  }
}
