// DOMPurify 依赖完整 DOM 特性检测，happy-dom 下净化结果不可靠，本文件单独使用 jsdom
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from './sanitize'

describe('sanitizeHtml', () => {
  it('保留安全的排版标签', () => {
    const out = sanitizeHtml('<p>好吃<b>不贵</b></p>')
    expect(out).toContain('<p>')
    expect(out).toContain('<b>不贵</b>')
  })

  it('剔除 script 标签', () => {
    const out = sanitizeHtml('<p>正常</p><script>alert(1)</script>')
    expect(out).not.toContain('script')
    expect(out).not.toContain('alert')
  })

  it('剔除事件属性（onclick 等）', () => {
    const out = sanitizeHtml(
      '<img src="a.png" onerror="steal()"><a href="#" onclick="x()">link</a>'
    )
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('onclick')
  })

  it('额外禁用 style 标签与 style 属性', () => {
    const out = sanitizeHtml('<style>.x{}</style><p style="position:fixed">t</p>')
    expect(out).not.toContain('<style')
    expect(out).not.toContain('style=')
  })

  it('禁用 form/input/button 标签', () => {
    const out = sanitizeHtml('<form><input type="text"><button>提交</button></form>')
    expect(out).not.toContain('<form')
    expect(out).not.toContain('<input')
    expect(out).not.toContain('<button')
  })

  it('空输入安全返回', () => {
    expect(sanitizeHtml('')).toBe('')
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
  })
})
