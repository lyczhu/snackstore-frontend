import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * 列表页通用 composable，收敛三个列表页 90% 重复的
 * loading / 分页 / 搜索 / 刷新逻辑。
 *
 * @param {(params: object, signal: AbortSignal) => Promise} fetchFn 列表请求函数，
 *   需返回 { data: { data: [], total: number } } 结构
 * @param {{ pageSize?: number, immediate?: boolean }} options
 */
export function useTable(fetchFn, { pageSize = 10, immediate = true } = {}) {
  const rows = ref([])
  const loading = ref(false)
  const pageNum = ref(1)
  const size = ref(pageSize)
  const total = ref(0)
  const extraParams = ref({})

  // 组件卸载/路由切换后取消未完成请求，避免脏数据写回
  let controller = null

  async function load() {
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    try {
      const res = await fetchFn(
        { pageNum: pageNum.value, pageSize: size.value, ...extraParams.value },
        controller.signal
      )
      rows.value = res.data.data
      total.value = res.data.total
    } catch (e) {
      if (e?.name !== 'CanceledError' && e?.code !== 'ERR_CANCELED') {
        /* 拦截器已提示 */
      }
    } finally {
      loading.value = false
    }
  }

  /** 搜索/筛选前重置到第一页，避免结果“凭空消失” */
  function search(params = {}) {
    extraParams.value = params
    pageNum.value = 1
    load()
  }

  onMounted(() => {
    if (immediate) load()
  })
  onBeforeUnmount(() => controller?.abort())

  return { rows, loading, pageNum, pageSize: size, total, load, search }
}
