import { describe, it, expect } from 'vitest'
import { safeParse } from './storage'

describe('safeParse', () => {
  it('解析合法 JSON', () => {
    expect(safeParse('{"a":1}', null)).toEqual({ a: 1 })
    expect(safeParse('[1,2]', [])).toEqual([1, 2])
  })

  it('JSON 损坏时回退默认值', () => {
    expect(safeParse('{broken', null)).toBeNull()
    expect(safeParse('not json', [])).toEqual([])
  })

  it('null/undefined 输入回退默认值', () => {
    expect(safeParse(null, 'fb')).toBe('fb')
    expect(safeParse(undefined, 'fb')).toBe('fb')
  })

  it('JSON 字面量 null 时回退默认值（?? 语义）', () => {
    expect(safeParse('null', 'fb')).toBe('fb')
  })
})
