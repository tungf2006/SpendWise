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
  getFinancialSummary,
  getCategoryExpenseBreakdown,
  getIncomeExpenseTrend,
  getPeriodComparison
} from '../reportService.js'

function createTxnQueryMock(rows, error = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue({ data: rows, error })
  }
  return query
}

describe('reportService - UC17', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-report-1' } },
      error: null
    })
  })

  it('getFinancialSummary: tính đúng tổng thu, tổng chi và chênh lệch ròng (loại trừ transfer)', async () => {
    mockFrom.mockReturnValue(
      createTxnQueryMock([
        { type: 'income', amount: 15000000, transaction_date: '2026-11-01' },
        { type: 'expense', amount: 2500000, transaction_date: '2026-11-05' },
        { type: 'expense', amount: 1500000, transaction_date: '2026-11-10' }
      ])
    )

    const res = await getFinancialSummary('2026-11-01', '2026-11-30')
    expect(res.error).toBeNull()
    expect(res.totalIncome).toBe(15000000)
    expect(res.totalExpense).toBe(4000000)
    expect(res.netSavings).toBe(11000000)
  })

  it('getCategoryExpenseBreakdown: gom nhóm theo danh mục và sắp xếp giảm dần', async () => {
    mockFrom.mockReturnValue(
      createTxnQueryMock([
        { type: 'expense', amount: 300000, transaction_date: '2026-11-02', id: '1', category: { id: 'cat-move', name: 'Di chuyển', color: '#3B82F6' } },
        { type: 'expense', amount: 500000, transaction_date: '2026-11-03', id: '2', category: { id: 'cat-food', name: 'Ăn uống', color: '#10B981' } },
        { type: 'expense', amount: 700000, transaction_date: '2026-11-04', id: '3', category: { id: 'cat-food', name: 'Ăn uống', color: '#10B981' } },
        { type: 'expense', amount: 100000, transaction_date: '2026-11-05', id: '4', category: null },
        { type: 'income', amount: 5000000, transaction_date: '2026-11-01', id: '5', category: { id: 'cat-sal', name: 'Lương', color: '#22C55E' } }
      ])
    )

    const res = await getCategoryExpenseBreakdown(11, 2026)
    expect(res.error).toBeNull()
    expect(res.labels).toEqual(['Ăn uống', 'Di chuyển', 'Khác'])
    expect(res.datasets[0].data).toEqual([1200000, 300000, 100000])
  })

  it('getCategoryExpenseBreakdown: báo lỗi khi tháng ngoài phạm vi 1–12', async () => {
    const res = await getCategoryExpenseBreakdown(0, 2026)
    expect(res.error.message).toContain('1–12')
    expect(res.labels).toEqual([])
  })

  it('getIncomeExpenseTrend: sinh đủ 7 bucket tuần, 12 bucket năm và từ chối kỳ sai', async () => {
    mockFrom.mockReturnValue(createTxnQueryMock([
      { type: 'income', amount: 10000000, transaction_date: '2026-11-05' },
      { type: 'expense', amount: 2000000, transaction_date: '2026-11-05' }
    ]))
    const yearRes = await getIncomeExpenseTrend('year', new Date(2026, 10, 27))
    expect(yearRes.error).toBeNull()
    expect(yearRes.labels).toHaveLength(12)
    expect(yearRes.income[10]).toBe(10000000)
    expect(yearRes.expense[10]).toBe(2000000)

    mockFrom.mockReturnValue(createTxnQueryMock([]))
    const weekRes = await getIncomeExpenseTrend('week', new Date(2026, 10, 27))
    expect(weekRes.labels).toHaveLength(7)

    const badRes = await getIncomeExpenseTrend('quarter', new Date(2026, 10, 27))
    expect(badRes.error.message).toContain('không hợp lệ')
  })

  it('getPeriodComparison: tính đúng phần trăm tăng giảm giữa 2 tháng liền kề', async () => {
    mockFrom
      .mockReturnValueOnce(createTxnQueryMock([
        { type: 'income', amount: 12000000, transaction_date: '2026-11-05' },
        { type: 'expense', amount: 6000000, transaction_date: '2026-11-10' }
      ]))
      .mockReturnValueOnce(createTxnQueryMock([
        { type: 'income', amount: 10000000, transaction_date: '2026-10-05' },
        { type: 'expense', amount: 5000000, transaction_date: '2026-10-10' }
      ]))

    const res = await getPeriodComparison(11, 2026)
    expect(res.error).toBeNull()
    expect(res.diffIncomePercent).toBe(20)
    expect(res.diffExpensePercent).toBe(20)
    expect(res.current.net).toBe(6000000)
    expect(res.previous.net).toBe(5000000)
  })
})
