import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {}
}))

import {
  calculateSafeToSpendAmount,
  validateSafeToSpendInput,
  buildSafeToSpendData,
  getRemainingDaysInMonth,
  toLocalDateString
} from '../safeToSpendService.js'

describe('safeToSpendService (UC20)', () => {
  it('tính chính xác công thức Safe-to-spend và làm tròn VNĐ', () => {
    expect(calculateSafeToSpendAmount(4000000, 500000, 14)).toBe(250000)
    expect(calculateSafeToSpendAmount(100000, 0, 3)).toBe(33333)
  })

  it('không trả về số âm khi chi vượt ngân sách hoặc khoản định kỳ lớn hơn ngân sách còn lại', () => {
    expect(calculateSafeToSpendAmount(-500000, 200000, 10)).toBe(0)
    expect(calculateSafeToSpendAmount(500000, 1200000, 5)).toBe(0)
  })

  it('validateSafeToSpendInput kiểm tra chặt kiểu dữ liệu và biên giá trị', () => {
    expect(validateSafeToSpendInput(null)).toHaveLength(1)
    expect(validateSafeToSpendInput([])).toHaveLength(1)
    expect(
      validateSafeToSpendInput({ remainingBudget: -100000, upcomingRecurring: 0, daysLeft: 1 })
    ).toEqual([])

    const errs = validateSafeToSpendInput({
      remainingBudget: Number.NaN,
      upcomingRecurring: -1,
      daysLeft: 32
    })
    expect(errs).toHaveLength(3)
  })

  it('buildSafeToSpendData trả kết quả chuẩn hoặc ném lỗi 400 khi sai input', () => {
    const res = buildSafeToSpendData({
      remainingBudget: 3500000,
      upcomingRecurring: 500000,
      daysLeft: 10
    })
    expect(res.safeToSpendToday).toBe(300000)
    expect(res.formula).toBe('max(0, (remainingBudget - upcomingRecurring) / daysLeft)')

    expect(() =>
      buildSafeToSpendData({ remainingBudget: 1000, upcomingRecurring: 0, daysLeft: 0 })
    ).toThrow()
  })

  it('tính số ngày còn lại trong tháng (kể cả hôm nay, >= 1) và định dạng ngày địa phương', () => {
    expect(getRemainingDaysInMonth(new Date(2026, 10, 15))).toBe(16) // Tháng 11 có 30 ngày
    expect(getRemainingDaysInMonth(new Date(2026, 10, 30))).toBe(1)
    expect(getRemainingDaysInMonth(new Date(2024, 1, 29))).toBe(1) // Năm nhuận 2024
    expect(toLocalDateString(new Date(2026, 10, 5))).toBe('2026-11-05')
  })
})
