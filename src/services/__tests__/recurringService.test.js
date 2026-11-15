import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {}
}))

import { calculateNextDueDate } from '../recurringService.js'

describe('recurringService - calculateNextDueDate (UC24)', () => {
  it('cộng đúng 1 ngày cho chu kỳ daily và 7 ngày cho chu kỳ weekly', () => {
    expect(calculateNextDueDate('2026-11-30', 'daily')).toBe('2026-12-01')
    expect(calculateNextDueDate('2026-11-15', 'weekly')).toBe('2026-11-22')
  })

  it('kẹp ngày cuối tháng và giữ nguyên day_of_month gốc cho chu kỳ monthly (31/01 -> 28/02 -> 31/03)', () => {
    const feb = calculateNextDueDate('2026-01-31', 'monthly', 31)
    expect(feb).toBe('2026-02-28')

    const mar = calculateNextDueDate(feb, 'monthly', 31)
    expect(mar).toBe('2026-03-31')
  })

  it('xử lý đúng tháng 2 năm nhuận (2024) cho chu kỳ monthly và yearly', () => {
    expect(calculateNextDueDate('2024-01-31', 'monthly', 31)).toBe('2024-02-29')
    expect(calculateNextDueDate('2024-02-29', 'yearly')).toBe('2025-02-28')
  })

  it('ném lỗi khi ngày hoặc chu kỳ không hợp lệ', () => {
    expect(() => calculateNextDueDate('2026-02-30', 'monthly')).toThrow()
    expect(() => calculateNextDueDate('2026-11-15', 'hourly')).toThrow()
  })
})
