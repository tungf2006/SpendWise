import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuthGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: (...args) => mockAuthGetUser(...args)
    },
    from: (...args) => mockFrom(...args)
  }
}))

import {
  getBudgetStatus,
  calculateBudgetUsage,
  getBudgets,
  setBudget
} from '../budgetService.js'

const VALID_CAT_UUID = '11111111-1111-4111-8111-111111111111'
const VALID_USER_UUID = '22222222-2222-4222-8222-222222222222'

describe('budgetService - UC14 & UC15', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: VALID_USER_UUID } },
      error: null
    })
  })

  describe('getBudgetStatus & calculateBudgetUsage (3 mức cảnh báo)', () => {
    it('phân loại đúng 3 ngưỡng: <80% An toàn, 80–99.9% Sắp vượt, >=100% Đã vượt', () => {
      expect(getBudgetStatus(0)).toBe('safe')
      expect(getBudgetStatus(79.99)).toBe('safe')
      expect(getBudgetStatus(80)).toBe('warning')
      expect(getBudgetStatus(99.9)).toBe('warning')
      expect(getBudgetStatus(100)).toBe('exceeded')
      expect(getBudgetStatus(145)).toBe('exceeded')
    })

    it('ném lỗi khi tỷ lệ phần trăm âm hoặc không hợp lệ', () => {
      expect(() => getBudgetStatus(-1)).toThrow()
      expect(() => getBudgetStatus(NaN)).toThrow()
    })

    it('tính toán chính xác mức An toàn (<80%)', () => {
      const res = calculateBudgetUsage({
        amount_limit: 2000000,
        spent_amount: 1000000,
        category_name: 'Ăn uống'
      })
      expect(res.status).toBe('safe')
      expect(res.status_label).toBe('An toàn')
      expect(res.progress_color).toBe('emerald')
      expect(res.actual_percentage).toBe(50)
      expect(res.remaining_amount).toBe(1000000)
      expect(res.is_alert).toBe(false)
      expect(res.alert_message).toBeNull()
    })

    it('tính toán chính xác mức Sắp vượt (80–99%)', () => {
      const res = calculateBudgetUsage({
        amount_limit: 1000000,
        spent_amount: 850000,
        category_name: 'Mua sắm'
      })
      expect(res.status).toBe('warning')
      expect(res.status_label).toBe('Sắp vượt')
      expect(res.progress_color).toBe('amber')
      expect(res.is_alert).toBe(true)
      expect(res.alert_message).toContain('85.0%')
    })

    it('tính toán chính xác mức Đã vượt (>=100%) và kẹp thanh tiến độ tối đa 100%', () => {
      const res = calculateBudgetUsage({
        amount_limit: 1000000,
        spent_amount: 1250000,
        category_name: 'Giải trí'
      })
      expect(res.status).toBe('exceeded')
      expect(res.status_label).toBe('Đã vượt')
      expect(res.progress_color).toBe('rose')
      expect(res.percentage).toBe(100)
      expect(res.actual_percentage).toBe(125)
      expect(res.remaining_amount).toBe(-250000)
      expect(res.exceeded_amount).toBe(250000)
    })
  })

  describe('getBudgets & setBudget (UC14)', () => {
    it('từ chối khi tháng/năm không hợp lệ', async () => {
      const res = await getBudgets(13, 2026)
      expect(res.data).toEqual([])
      expect(res.error.message).toContain('Tháng')
    })

    it('từ chối setBudget khi hạn mức <= 0 hoặc rỗng', async () => {
      const res = await setBudget({
        category_id: VALID_CAT_UUID,
        month: 11,
        year: 2026,
        amount_limit: 0
      })
      expect(res.data).toBeNull()
      expect(res.error.message).toContain('lớn hơn 0')
    })

    it('từ chối setBudget cho danh mục thu nhập (income)', async () => {
      const catQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: VALID_CAT_UUID, user_id: null, type: 'income' },
          error: null
        })
      }
      mockFrom.mockReturnValue(catQuery)

      const res = await setBudget({
        category_id: VALID_CAT_UUID,
        month: 11,
        year: 2026,
        amount_limit: 3000000
      })
      expect(res.data).toBeNull()
      expect(res.error.message).toContain('không phải danh mục chi tiêu')
    })

    it('setBudget thành công với danh mục chi tiêu hợp lệ (upsert)', async () => {
      const catQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: VALID_CAT_UUID, user_id: null, type: 'expense' },
          error: null
        })
      }
      const budgetQuery = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'b1', category_id: VALID_CAT_UUID, month: 11, year: 2026, amount_limit: 3000000 },
          error: null
        })
      }
      mockFrom.mockImplementation((table) => (table === 'categories' ? catQuery : budgetQuery))

      const res = await setBudget({
        category_id: VALID_CAT_UUID,
        month: 11,
        year: 2026,
        amount_limit: 3000000
      })
      expect(res.error).toBeNull()
      expect(res.data.amount_limit).toBe(3000000)
    })
  })
})
