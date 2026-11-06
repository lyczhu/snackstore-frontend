import { describe, it, expect, vi } from 'vitest'
import { confirm } from './confirm.js'

describe('confirm', () => {
  it('confirm:true resolve true', async () => {
    vi.spyOn(wx, 'showModal').mockImplementation((o) => o.success({ confirm: true }))
    await expect(confirm('删除？')).resolves.toBe(true)
  })

  it('confirm:false resolve false', async () => {
    vi.spyOn(wx, 'showModal').mockImplementation((o) => o.success({ confirm: false }))
    await expect(confirm('删除？')).resolves.toBe(false)
  })

  it('showModal fail resolve false', async () => {
    vi.spyOn(wx, 'showModal').mockImplementation((o) => o.fail && o.fail())
    await expect(confirm('x')).resolves.toBe(false)
  })
})
