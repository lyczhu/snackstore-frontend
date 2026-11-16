/**
 * 分类拖动排序的计算（M1′-9）。
 *
 * 后端 `GET /products/categories` 已按 sort 升序返回，这里只负责算出「移动到相邻位置」
 * 需要提交哪些 sort。优先交换相邻两条的 sort（保留人工设置的间隔，如 10/20/30）；
 * 两条 sort 相同时交换无效，退化为按当前顺序重排为紧凑值。
 */

/**
 * @param {Array<{id: any, sort?: number}>} list 当前显示顺序的列表
 * @param {any} rowId 要移动的条目 id
 * @param {-1|1} delta 上移 -1 / 下移 1
 * @returns {Array<{id: any, sort: number}>} 需要提交的 sort 变更（仅变化的条目）
 */
export function buildSortUpdates(list, rowId, delta) {
  const i = list.findIndex((item) => item.id === rowId)
  const j = i + delta
  if (i < 0 || j < 0 || j >= list.length) return []

  const current = Number(list[i].sort) || 0
  const target = Number(list[j].sort) || 0

  // 按原列表顺序输出，方便调用方按 id 回填行数据
  if (current !== target) {
    const patch = new Map([
      [list[i].id, target],
      [list[j].id, current]
    ])
    return list
      .filter((item) => patch.has(item.id) && (Number(item.sort) || 0) !== patch.get(item.id))
      .map((item) => ({ id: item.id, sort: patch.get(item.id) }))
  }

  // sort 相同：按「交换后」的顺序重排为 0..n-1
  const reordered = list.slice()
  ;[reordered[i], reordered[j]] = [reordered[j], reordered[i]]
  const sortById = new Map(reordered.map((item, index) => [item.id, index]))
  return list
    .filter((item) => (Number(item.sort) || 0) !== sortById.get(item.id))
    .map((item) => ({ id: item.id, sort: sortById.get(item.id) }))
}
