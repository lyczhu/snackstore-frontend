import { describe, it, expect } from 'vitest'
import { buildSortUpdates } from './sort.js'

const LIST = [
  { id: 1, name: 'A', sort: 0 },
  { id: 2, name: 'B', sort: 10 },
  { id: 3, name: 'C', sort: 20 }
]

describe('buildSortUpdates', () => {
  it('上移：与上一条交换 sort，只提交这两条', () => {
    expect(buildSortUpdates(LIST, 2, -1)).toEqual([
      { id: 1, sort: 10 },
      { id: 2, sort: 0 }
    ])
  })

  it('下移：与下一条交换 sort', () => {
    expect(buildSortUpdates(LIST, 2, 1)).toEqual([
      { id: 2, sort: 20 },
      { id: 3, sort: 10 }
    ])
  })

  it('首项上移、末项下移返回空数组（前端按钮已禁用，这里是二道防线）', () => {
    expect(buildSortUpdates(LIST, 1, -1)).toEqual([])
    expect(buildSortUpdates(LIST, 3, 1)).toEqual([])
  })

  it('未知 id 返回空数组', () => {
    expect(buildSortUpdates(LIST, 999, -1)).toEqual([])
  })

  it('sort 相同时交换无效，按当前顺序重排为紧凑值', () => {
    const dup = [
      { id: 1, sort: 0 },
      { id: 2, sort: 0 },
      { id: 3, sort: 0 }
    ]
    // C 上移后顺序变为 A、C、B
    expect(buildSortUpdates(dup, 3, -1)).toEqual([
      { id: 2, sort: 2 },
      { id: 3, sort: 1 }
    ])
  })

  it('返回的更新项应用后，排序顺序与移动后的预期一致', () => {
    const moved = buildSortUpdates(LIST, 2, -1)
    const applied = LIST.map((item) => {
      const patch = moved.find((m) => m.id === item.id)
      return patch ? { ...item, sort: patch.sort } : { ...item }
    })
    expect(applied.sort((a, b) => a.sort - b.sort).map((i) => i.id)).toEqual([2, 1, 3])
  })

  it('不修改入参', () => {
    buildSortUpdates(LIST, 2, -1)
    expect(LIST.map((i) => i.sort)).toEqual([0, 10, 20])
  })
})
