import { describe, it, expect } from 'vitest'
import { getStatusText, getStatusType } from './orderStatus'

describe('getStatusText', () => {
  it('已知状态映射正确', () => {
    expect(getStatusText(0)).toBe('待支付')
    expect(getStatusText(1)).toBe('已完成')
    expect(getStatusText(2)).toBe('已取消')
  })

  it('未知状态返回「未知」', () => {
    expect(getStatusText(99)).toBe('未知')
    expect(getStatusText(undefined)).toBe('未知')
  })
})

describe('getStatusType', () => {
  it('已知状态映射正确', () => {
    expect(getStatusType(0)).toBe('warning')
    expect(getStatusType(1)).toBe('success')
    expect(getStatusType(2)).toBe('default')
  })

  it('未知状态回退 default', () => {
    expect(getStatusType(99)).toBe('default')
  })
})
