import { describe, it, expect } from 'vitest'
import { getAgreement, AGREEMENT_TYPES } from './agreements.js'

describe('getAgreement', () => {
  it('未知类型返回 null，由页面渲染空态', () => {
    expect(getAgreement('unknown')).toBeNull()
    expect(getAgreement(undefined)).toBeNull()
  })

  it('覆盖演示说明 / 隐私政策 / 用户协议三种类型', () => {
    expect(AGREEMENT_TYPES).toEqual(['demo', 'privacy', 'user'])
    for (const type of AGREEMENT_TYPES) {
      expect(getAgreement(type)?.title).toBeTruthy()
    }
  })

  it('每份文档都有修订日期与至少两个章节', () => {
    for (const type of AGREEMENT_TYPES) {
      const doc = getAgreement(type)
      expect(doc.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(doc.sections.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('每个章节都有标题和内容，避免渲染出空章节', () => {
    for (const type of AGREEMENT_TYPES) {
      for (const section of getAgreement(type).sections) {
        expect(section.heading).toBeTruthy()
        const count = (section.paragraphs?.length || 0) + (section.bullets?.length || 0)
        expect(count).toBeGreaterThan(0)
      }
    }
  })

  it('隐私政策逐项列出实际写入 localStorage 的键名（代码改名时这里必须同步）', () => {
    const bullets = getAgreement('privacy')
      .sections.flatMap((s) => s.bullets || [])
      .join('\n')
    expect(bullets).toContain('token')
    expect(bullets).toContain('userInfo')
    expect(bullets).toContain('cartItems_guest')
    expect(bullets).toContain('cartItems_')
  })

  it('演示说明明确不产生真实扣款', () => {
    const doc = getAgreement('demo')
    const text = [
      ...doc.sections.flatMap((s) => s.paragraphs || []),
      ...doc.sections.flatMap((s) => s.bullets || [])
    ].join('\n')
    expect(text).toContain('不会产生真实扣款')
  })
})
