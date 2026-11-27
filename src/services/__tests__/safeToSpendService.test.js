import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  mockGetUser,
  mockGetSession,
  mockFrom,
  mockGetBudgetProgress,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetSession: vi.fn(),
  mockFrom: vi.fn(),
  mockGetBudgetProgress: vi.fn(),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: (...args) => mockGetUser(...args),
      getSession: (...args) => mockGetSession(...args),
    },
    from: (...args) => mockFrom(...args),
  },
}))

vi.mock('../budgetService', () => ({
  getBudgetProgress: (...args) => mockGetBudgetProgress(...args),
}))

import {
  calculateSafeToSpend,
  calculateSafeToSpendAmount,
  validateSafeToSpendInput,
  buildSafeToSpendData,
  countRecurringOccurrences,
  getRemainingDaysInMonth,
  toLocalDateString,
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

  it('countRecurringOccurrences đếm chính xác kỳ định kỳ trong phần còn lại của tháng', () => {
    expect(countRecurringOccurrences('daily', '2026-11-28', '2026-11-28', '2026-11-30')).toBe(3)
    expect(countRecurringOccurrences('weekly', '2026-11-01', '2026-11-15', '2026-11-30')).toBe(3) // 15, 22, 29
    expect(countRecurringOccurrences('monthly', '2026-11-20', '2026-11-15', '2026-11-30')).toBe(1)
    expect(countRecurringOccurrences('yearly', '2026-11-10', '2026-11-15', '2026-11-30')).toBe(0)
  })

  describe('calculateSafeToSpend (R3 #7 Backend & Local Fallback)', () => {
    const originalFetch = globalThis.fetch
    const testToday = new Date(2026, 10, 21) // 2026-11-21 -> 10 daysLeft

    const setupSupabaseHappyData = (recurringRules = []) => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-001' } }, error: null })
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'jwt-token' } } })
      mockGetBudgetProgress.mockResolvedValue({
        data: [{ id: 'b1', amount_limit: 5000000 }],
        totalBudget: 5000000,
        totalSpent: 1500000,
        error: null,
      })

      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: recurringRules, error: null }),
      }
      mockFrom.mockReturnValue(chain)
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('ưu tiên kết quả từ backend khi API phản hồi hợp lệ', async () => {
      setupSupabaseHappyData([
        { amount: 500000, frequency: 'monthly', next_due_date: '2026-11-25' },
      ])
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { safeToSpendToday: 300000, remainingBudget: 3500000, upcomingRecurring: 500000, daysLeft: 10 },
        }),
      })

      const res = await calculateSafeToSpend(testToday)
      expect(res.error).toBeNull()
      expect(res.calculationSource).toBe('backend')
      expect(res.safeToSpendToday).toBe(300000)
      expect(res.fallbackReason).toBeNull()
    })

    it('fallback sang calculateSafeToSpendAmount khi cổng 5000 unreachable (ECONNREFUSED)', async () => {
      setupSupabaseHappyData([
        { amount: 500000, frequency: 'monthly', next_due_date: '2026-11-25' },
      ])
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5000'))

      const res = await calculateSafeToSpend(testToday)
      expect(res.error).toBeNull()
      expect(res.calculationSource).toBe('local_fallback')
      expect(res.safeToSpendToday).toBe(calculateSafeToSpendAmount(3500000, 500000, 10))
      expect(res.fallbackReason).toContain('ECONNREFUSED')
    })

    it('fallback cục bộ khi gọi API bị timeout (AbortError)', async () => {
      setupSupabaseHappyData([])
      const abortErr = new Error('The operation was aborted')
      abortErr.name = 'AbortError'
      globalThis.fetch = vi.fn().mockRejectedValue(abortErr)

      const res = await calculateSafeToSpend(testToday)
      expect(res.error).toBeNull()
      expect(res.calculationSource).toBe('local_fallback')
      expect(res.safeToSpendToday).toBe(350000)
    })

    it('fallback cục bộ khi API trả HTTP 500', async () => {
      setupSupabaseHappyData([])
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ success: false, message: 'Internal Server Error' }),
      })

      const res = await calculateSafeToSpend(testToday)
      expect(res.error).toBeNull()
      expect(res.calculationSource).toBe('local_fallback')
      expect(res.safeToSpendToday).toBe(350000)
      expect(res.fallbackReason).toContain('Internal Server Error')
    })

    it('trả về calculationSource=no_budget khi người dùng chưa đặt ngân sách', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-001' } }, error: null })
      mockGetBudgetProgress.mockResolvedValue({
        data: [],
        totalBudget: 0,
        totalSpent: 0,
        error: null,
      })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [], error: null }),
      })
      const fetchSpy = vi.fn()
      globalThis.fetch = fetchSpy

      const res = await calculateSafeToSpend(testToday)
      expect(res.error).toBeNull()
      expect(res.calculationSource).toBe('no_budget')
      expect(res.safeToSpendToday).toBe(0)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('xử lý an toàn nếu today truyền vào là Date không hợp lệ', async () => {
      setupSupabaseHappyData([])
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'))

      const res = await calculateSafeToSpend(new Date('invalid'))
      expect(res.error).toBeNull()
      expect(res.calculationSource).toBe('local_fallback')
      expect(res.daysLeft).toBeGreaterThanOrEqual(1)
    })
  })
})
