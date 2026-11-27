import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetSession = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args)
    },
    from: (...args) => mockFrom(...args)
  }
}))

vi.mock('../safeToSpendService', () => ({
  calculateSafeToSpend: vi.fn().mockResolvedValue({
    safeToSpendToday: 180000,
    daysLeft: 4,
    upcomingRecurring: 500000
  }),
  getCurrentMonthDates: vi.fn().mockReturnValue({
    month: 11,
    year: 2026,
    todayDate: '2026-11-27',
    endOfMonthDate: '2026-11-30'
  }),
  toLocalDateString: vi.fn().mockReturnValue('2026-11-27')
}))

vi.mock('../budgetService', () => ({
  getBudgetProgress: vi.fn().mockResolvedValue({
    data: [
      {
        category_name: 'Ăn uống',
        budget_amount: 3000000,
        spent_amount: 2700000,
        remaining_amount: 300000,
        actual_percentage: 90,
        status: 'warning'
      }
    ],
    error: null
  })
}))

import {
  QUICK_REPLY_CHIPS,
  buildClientFallbackReply,
  askGeminiAssistant
} from '../aiAssistantService.js'

describe('aiAssistantService - UC21', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt-test-token' } }
    })
    mockFrom.mockImplementation((table) => {
      if (table === 'wallets') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [{ name: 'Ví MoMo', type: 'ewallet', balance: 2500000 }],
            error: null
          })
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ type: 'expense', amount: 45000, transaction_date: '2026-11-27', note: 'cafe', category: { name: 'Ăn uống' } }],
          error: null
        })
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('có đủ 4 Quick Reply Chips mặc định', () => {
    expect(QUICK_REPLY_CHIPS).toHaveLength(4)
  })

  it('buildClientFallbackReply: trả lời đúng 4 nhóm câu hỏi (Safe-to-spend, Ăn uống, Ngân sách, Tổng quan)', () => {
    const ctx = {
      ngay_hien_tai: '2026-11-27',
      thang_nam: '11/2026',
      so_ngay_con_lai_trong_thang: 4,
      tong_so_du_vi: 2500000,
      safe_to_spend_hom_nay: 180000,
      khoan_dinh_ky_sap_toi: 500000,
      danh_sach_vi: [{ name: 'Ví MoMo', balance: 2500000 }],
      ngan_sach_thang: [
        { danh_muc: 'Ăn uống', han_muc: 3000000, da_chi: 2700000, con_lai: 300000, phan_tram: '90%', trang_thai: 'warning' }
      ],
      giao_dich_gan_day: []
    }

    expect(buildClientFallbackReply('Hôm nay tôi có thể tiêu bao nhiêu tiền an toàn?', ctx)).toContain('Safe-to-spend')
    expect(buildClientFallbackReply('Tháng này đã chi bao nhiêu cho Ăn uống?', ctx)).toContain('Ăn uống')
    expect(buildClientFallbackReply('Ngân sách nào sắp vượt hạn mức?', ctx)).toContain('Sắp vượt')
    expect(buildClientFallbackReply('Cho lời khuyên phân bổ tiền', ctx)).toContain('Tổng quan')
  })

  it('askGeminiAssistant: từ chối câu hỏi rỗng ngay ở client', async () => {
    const res = await askGeminiAssistant('   ')
    expect(res.source).toBe('validation_error')
    expect(res.error.message).toContain('không được để trống')
  })

  it('askGeminiAssistant: gửi Bearer JWT lên Backend /api/ai/chat và nhận phản hồi thành công', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        success: true,
        reply: 'Hôm nay bạn nên chi dưới 180.000 VNĐ.',
        mode: 'gemini_live'
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    const res = await askGeminiAssistant('Hôm nay tiêu bao nhiêu?')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/ai/chat')
    expect(options.headers.Authorization).toBe('Bearer jwt-test-token')
    expect(res.error).toBeNull()
    expect(res.reply).toContain('180.000 VNĐ')
    expect(res.source).toBe('gemini_live')
  })

  it('askGeminiAssistant: xử lý đúng lỗi 401 (hết phiên) và 429 (quá giới hạn tần suất)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ message: 'Token hết hạn' })
    }))
    const unauth = await askGeminiAssistant('Hỏi AI')
    expect(unauth.source).toBe('auth_error')
    expect(unauth.error).toBeTruthy()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: vi.fn().mockResolvedValue({ message: 'Vượt giới hạn 10 request/phút' })
    }))
    const limited = await askGeminiAssistant('Hỏi AI liên tục')
    expect(limited.source).toBe('rate_limited')
    expect(limited.reply).toContain('10 request/phút')
  })
})
