import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'

const geminiMock = vi.hoisted(() => ({
  constructorCalls: [],
  getGenerativeModel: vi.fn(),
  generateContent: vi.fn()
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function (apiKey) {
    geminiMock.constructorCalls.push(apiKey)
    return {
      getGenerativeModel: geminiMock.getGenerativeModel
    }
  })
}))

import { createApp } from '../app.js'
import { resetRateLimiters } from '../middleware/rateLimiter.js'
import { clearAuthCache } from '../middleware/authMiddleware.js'
import { parseQuickEntryServer, resolveQuickWallet } from '../routes/quickEntryRoutes.js'

function createFakeJwt(payloadOverrides = {}) {
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const payload = encode({
    sub: 'user-lead-001',
    email: 'tung@spendwise.vn',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payloadOverrides
  })
  return `${header}.${payload}.test-signature`
}

const ENV_KEYS = [
  'NODE_ENV',
  'GEMINI_API_KEY',
  'VITE_GEMINI_API_KEY',
  'GEMINI_MODEL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SKIP_SUPABASE_REMOTE_AUTH',
  'STRICT_API_AUTH'
]

describe('SpendWise Backend Express API (Security, Auth, Rate Limit & Finance)', () => {
  let app
  let savedEnv

  beforeEach(() => {
    savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))

    process.env.NODE_ENV = 'test'
    delete process.env.GEMINI_API_KEY
    delete process.env.VITE_GEMINI_API_KEY
    delete process.env.GEMINI_MODEL
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_ANON_KEY
    delete process.env.VITE_SUPABASE_URL
    delete process.env.VITE_SUPABASE_ANON_KEY
    delete process.env.SKIP_SUPABASE_REMOTE_AUTH
    delete process.env.STRICT_API_AUTH

    geminiMock.constructorCalls.length = 0
    geminiMock.getGenerativeModel.mockReset()
    geminiMock.generateContent.mockReset()
    geminiMock.getGenerativeModel.mockReturnValue({
      generateContent: geminiMock.generateContent
    })

    resetRateLimiters()
    clearAuthCache()
    app = createApp()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    resetRateLimiters()
    clearAuthCache()

    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
  })

  it('GET /api/finance/health trả về trạng thái online kèm Security & RateLimit headers', async () => {
    const res = await request(app).get('/api/finance/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('online')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['x-ratelimit-limit']).toBeDefined()
    expect(res.headers['x-ratelimit-remaining']).toBeDefined()
  })

  it('POST /api/ai/chat chặn 401 khi không có Authorization Bearer token', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ prompt: 'Hôm nay tiêu bao nhiêu?', context: {} })

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('POST /api/ai/chat chặn 401 khi JWT hết hạn hoặc sai định dạng', async () => {
    const expiredJwt = createFakeJwt({ exp: Math.floor(Date.now() / 1000) - 60 })

    const expiredRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${expiredJwt}`)
      .send({ prompt: 'Xin chào' })
    expect(expiredRes.status).toBe(401)

    const malformedRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer not.a.valid-jwt')
      .send({ prompt: 'Xin chào' })
    expect(malformedRes.status).toBe(401)
  })

  it('POST /api/ai/chat trả 400 nếu prompt rỗng khi đã xác thực', async () => {
    const token = createFakeJwt()
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: '   ' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('POST /api/ai/chat trả 503 kèm fallbackReply khi Server chưa cấu hình GEMINI_API_KEY', async () => {
    const token = createFakeJwt()
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Hôm nay tôi có thể tiêu bao nhiêu tiền an toàn?',
        context: {
          ngay_hien_tai: '2026-11-15',
          so_ngay_con_lai_trong_thang: 16,
          tong_so_du_vi: 5000000,
          safe_to_spend_hom_nay: 250000,
          khoan_dinh_ky_sap_toi: 500000
        }
      })

    expect(res.status).toBe(503)
    expect(res.body.success).toBe(false)
    expect(res.body.mode).toBe('smart_context_advisor')
    expect(res.body.fallbackReply).toContain('250.000 VNĐ')
  })

  it('POST /api/ai/chat trả 429 Too Many Requests khi vượt quá giới hạn 20 req/phút', async () => {
    const token = createFakeJwt({ sub: 'rate-limit-user' })

    for (let i = 0; i < 20; i++) {
      const okRes = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'Test rate limit' })
      expect(okRes.status).toBe(503)
    }

    const blockedRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Test rate limit vượt ngưỡng' })

    expect(blockedRes.status).toBe(429)
    expect(blockedRes.body.success).toBe(false)
    expect(blockedRes.headers['retry-after']).toBeDefined()
  })

  it('POST /api/finance/safe-to-spend trả 400 với dữ liệu không hợp lệ và 200 (giữ số âm) với dữ liệu hợp lệ', async () => {
    const invalidRes = await request(app)
      .post('/api/finance/safe-to-spend')
      .send({ remainingBudget: 1000000, upcomingRecurring: -500, daysLeft: 0 })

    expect(invalidRes.status).toBe(400)
    expect(invalidRes.body.success).toBe(false)
    expect(invalidRes.body.errors.length).toBeGreaterThanOrEqual(2)

    const negativeBudgetRes = await request(app)
      .post('/api/finance/safe-to-spend')
      .send({ remainingBudget: -500000, upcomingRecurring: 200000, daysLeft: 10 })

    expect(negativeBudgetRes.status).toBe(200)
    expect(negativeBudgetRes.body.success).toBe(true)
    expect(negativeBudgetRes.body.data.remainingBudget).toBe(-500000)
    expect(negativeBudgetRes.body.data.safeToSpendToday).toBe(0)

    const validRes = await request(app)
      .post('/api/finance/safe-to-spend')
      .send({ remainingBudget: 4000000, upcomingRecurring: 500000, daysLeft: 14 })

    expect(validRes.status).toBe(200)
    expect(validRes.body.data.safeToSpendToday).toBe(250000)
  })

  it('POST /api/finance/safe-to-spend từ chối 401 nếu gửi kèm token rác nhưng cho phép khi không gửi token', async () => {
    const badAuthRes = await request(app)
      .post('/api/finance/safe-to-spend')
      .set('Authorization', 'Bearer bad-token')
      .send({ remainingBudget: 1000000, upcomingRecurring: 0, daysLeft: 10 })

    expect(badAuthRes.status).toBe(401)
  })

  it('Trả về 413 Payload Too Large khi body vượt quá giới hạn 100kb', async () => {
    const hugePrompt = 'a'.repeat(120 * 1024)
    const token = createFakeJwt()
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: hugePrompt })

    expect(res.status).toBe(413)
    expect(res.body.success).toBe(false)
  })

  describe('R2 #2 — authMiddleware fail-closed & timeout ngoài NODE_ENV=test', () => {
    it('requireAuth fail-closed 503 khi thiếu cấu hình Supabase ở production (bỏ qua SKIP_SUPABASE_REMOTE_AUTH)', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SKIP_SUPABASE_REMOTE_AUTH = 'true'
      const token = createFakeJwt()

      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'Xin chào' })

      expect(res.status).toBe(503)
      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain('Supabase')
    })

    it('requireAuth vẫn gọi Supabase Auth từ xa ở production kể cả khi bật SKIP_SUPABASE_REMOTE_AUTH=true', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SKIP_SUPABASE_REMOTE_AUTH = 'true'
      process.env.SUPABASE_URL = 'https://example.supabase.co'
      process.env.SUPABASE_ANON_KEY = 'anon-test-key'

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401
      })
      vi.stubGlobal('fetch', fetchMock)

      const token = createFakeJwt()
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'Xin chào' })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
    })

    it('requireAuth trả 502 khi Supabase Auth trả HTTP 5xx (500/503) thay vì 401', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_URL = 'https://example.supabase.co'
      process.env.SUPABASE_ANON_KEY = 'anon-test-key'

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 503
      })
      vi.stubGlobal('fetch', fetchMock)

      const token = createFakeJwt()
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'Xin chào' })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.status).toBe(502)
      expect(res.body.success).toBe(false)
    })

    it('requireAuth trả 504 khi fetch tới Supabase Auth bị TimeoutError (kèm AbortSignal)', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_URL = 'https://example.supabase.co'
      process.env.SUPABASE_ANON_KEY = 'anon-test-key'

      const timeoutErr = new Error('The operation was aborted due to timeout')
      timeoutErr.name = 'TimeoutError'
      const fetchMock = vi.fn().mockRejectedValue(timeoutErr)
      vi.stubGlobal('fetch', fetchMock)

      const token = createFakeJwt()
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'Xin chào' })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [, fetchInit] = fetchMock.mock.calls[0]
      expect(fetchInit.signal).toBeInstanceOf(AbortSignal)
      expect(res.status).toBe(504)
      expect(res.body.success).toBe(false)
    })

    it('requireAuth trả 503 khi fetch tới Supabase Auth gặp lỗi mạng khác', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_URL = 'https://example.supabase.co'
      process.env.SUPABASE_ANON_KEY = 'anon-test-key'

      const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
      vi.stubGlobal('fetch', fetchMock)

      const token = createFakeJwt()
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'Xin chào' })

      expect(res.status).toBe(503)
      expect(res.body.success).toBe(false)
    })

    it('requireAuth xác thực thành công từ xa (200) và cache token cho lần gọi kế tiếp', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SUPABASE_URL = 'https://example.supabase.co'
      process.env.SUPABASE_ANON_KEY = 'anon-test-key'

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'user-lead-001',
          email: 'tung@spendwise.vn',
          role: 'authenticated'
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      const token = createFakeJwt()
      const first = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'Lần 1' })
      const second = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'Lần 2' })

      expect(first.status).toBe(503)
      expect(second.status).toBe(503)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('optionalAuth cho phép request không có Bearer khi thiếu Supabase env nhưng fail-closed 503 nếu gửi kèm Bearer', async () => {
      process.env.NODE_ENV = 'production'

      const anonRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'cafe 35k' })
      expect(anonRes.status).toBe(200)
      expect(anonRes.body.success).toBe(true)

      const token = createFakeJwt()
      const authedRes = await request(app)
        .post('/api/quick-entry/parse')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'cafe 35k' })
      expect(authedRes.status).toBe(503)
      expect(authedRes.body.success).toBe(false)
    })
  })

  describe('R2 #4 — aiRoutes key validation, systemInstruction & 15s timeout', () => {
    it('Từ chối VITE_GEMINI_API_KEY khi không có GEMINI_API_KEY (503 + fallbackReply, không gọi SDK)', async () => {
      process.env.VITE_GEMINI_API_KEY = 'AIzaSyFakeClientKeyShouldNeverBeUsed'
      const token = createFakeJwt()

      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prompt: 'Hôm nay tiêu bao nhiêu?',
          context: { safe_to_spend_hom_nay: 120000 }
        })

      expect(res.status).toBe(503)
      expect(res.body.success).toBe(false)
      expect(res.body.mode).toBe('smart_context_advisor')
      expect(res.body.fallbackReply).toContain('120.000 VNĐ')
      expect(geminiMock.constructorCalls).toHaveLength(0)
    })

    it('Từ chối placeholder hoặc key quá ngắn trong GEMINI_API_KEY', async () => {
      const token = createFakeJwt()

      for (const badKey of ['your_gemini_api_key_here', '<put_key_here>', 'changeme_123456', 'short']) {
        process.env.GEMINI_API_KEY = badKey
        const res = await request(app)
          .post('/api/ai/chat')
          .set('Authorization', `Bearer ${token}`)
          .send({ prompt: 'Tư vấn chi tiêu' })

        expect(res.status).toBe(503)
        expect(res.body.success).toBe(false)
        expect(res.body.mode).toBe('smart_context_advisor')
      }
      expect(geminiMock.constructorCalls).toHaveLength(0)
    })

    it('Chấp nhận GEMINI_API_KEY không bắt đầu bằng AIza, truyền systemInstruction vào getGenerativeModel và timeout/signal vào generateContent', async () => {
      process.env.GEMINI_API_KEY = 'AQ.Ab8RN6ValidNonAizaSecretKey'
      process.env.GEMINI_MODEL = 'gemini-2.5-flash'
      geminiMock.generateContent.mockResolvedValue({
        response: {
          text: () => 'Hôm nay bạn có thể chi tối đa 250.000 VNĐ.'
        }
      })

      const token = createFakeJwt()
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prompt: '  Hôm nay tiêu được bao nhiêu?  ',
          context: { safe_to_spend_hom_nay: 250000 }
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.mode).toBe('gemini_backend')
      expect(res.body.model).toBe('gemini-2.5-flash')
      expect(res.body.reply).toBe('Hôm nay bạn có thể chi tối đa 250.000 VNĐ.')

      expect(geminiMock.constructorCalls).toEqual(['AQ.Ab8RN6ValidNonAizaSecretKey'])
      expect(geminiMock.getGenerativeModel).toHaveBeenCalledTimes(1)
      const modelParams = geminiMock.getGenerativeModel.mock.calls[0][0]
      expect(modelParams.model).toBe('gemini-2.5-flash')
      expect(modelParams.systemInstruction).toContain('250000')

      expect(geminiMock.generateContent).toHaveBeenCalledTimes(1)
      const [contentArg, requestOptions] = geminiMock.generateContent.mock.calls[0]
      expect(contentArg).toBe('Hôm nay tiêu được bao nhiêu?')
      expect(requestOptions).toMatchObject({ timeout: 15000 })
      expect(requestOptions.signal).toBeInstanceOf(AbortSignal)
    })

    it('Trả 504 kèm fallbackReply khi Gemini generateContent vượt quá timeout 15 giây', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      process.env.GEMINI_API_KEY = 'AQ.Ab8RN6TimeoutKey123456'

      let resolveCall
      const generateCalled = new Promise((resolve) => {
        resolveCall = resolve
      })
      geminiMock.generateContent.mockImplementation((_prompt, options) => {
        resolveCall(options)
        return new Promise(() => {})
      })

      const token = createFakeJwt()
      const reqPromise = request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prompt: 'Hôm nay tiêu bao nhiêu?',
          context: { safe_to_spend_hom_nay: 180000 }
        })
        .then((res) => res)

      const callOptions = await generateCalled
      expect(callOptions.signal.aborted).toBe(false)

      await vi.advanceTimersByTimeAsync(15000)
      const res = await reqPromise

      expect(callOptions.signal.aborted).toBe(true)
      expect(res.status).toBe(504)
      expect(res.body.success).toBe(false)
      expect(res.body.mode).toBe('smart_context_advisor')
      expect(res.body.fallbackReply).toContain('180.000 VNĐ')
    })

    it('Trả 502 kèm fallbackReply khi Gemini SDK ném lỗi không phải timeout', async () => {
      process.env.GEMINI_API_KEY = 'AQ.Ab8RN6ErrorKey123456'
      geminiMock.generateContent.mockRejectedValue(new Error('503 Service Unavailable'))

      const token = createFakeJwt()
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prompt: 'Kiểm tra ngân sách',
          context: { safe_to_spend_hom_nay: 90000 }
        })

      expect(res.status).toBe(502)
      expect(res.body.success).toBe(false)
      expect(res.body.mode).toBe('smart_context_advisor')
      expect(res.body.fallbackReply).toBeTruthy()
    })

    it('Không crash 500 khi context fallback chứa null, phần tử không phải object hoặc trường không phải chuỗi (Challenger 1)', async () => {
      const token = createFakeJwt()
      const malformedCases = [
        { prompt: 'kiểm tra ngân sách', context: { ngan_sach_thang: [null] } },
        { prompt: 'ăn uống bao nhiêu', context: { ngan_sach_thang: [{ danh_muc: 123 }] } },
        { prompt: 'ăn uống bao nhiêu', context: { giao_dich_gan_day: [null] } },
        { prompt: 'tư vấn chi tiêu', context: { danh_sach_vi: [null] } },
        { prompt: 'kiểm tra ngân sách', context: { ngan_sach_thang: [undefined, 'bad', 42, { danh_muc: null, trang_thai: 'warning', phan_tram: null, da_chi: 'abc', han_muc: null }] } },
        { prompt: 'ăn uống bao nhiêu', context: { giao_dich_gan_day: [42, { danh_muc: 999, loai: 'Chi tiêu', so_tien: 'not-a-number' }] } },
        { prompt: 'tư vấn chi tiêu', context: { danh_sach_vi: ['bad', { name: 456, balance: 'NaN' }], so_ngay_con_lai_trong_thang: 'abc' } },
        { prompt: 'hôm nay tiêu bao nhiêu', context: null },
        { prompt: 'tư vấn chi tiêu', context: 'not-an-object' },
        { prompt: 'kiểm tra ngân sách', context: [] }
      ]

      for (const payload of malformedCases) {
        const res = await request(app)
          .post('/api/ai/chat')
          .set('Authorization', `Bearer ${token}`)
          .send(payload)

        expect(res.status).toBe(503)
        expect(res.body.success).toBe(false)
        expect(res.body.mode).toBe('smart_context_advisor')
        expect(typeof res.body.fallbackReply).toBe('string')
        expect(res.body.fallbackReply.length).toBeGreaterThan(0)
      }
    })

    it('Trả 502 kèm fallbackReply an toàn khi Gemini lỗi và context bị malformed', async () => {
      process.env.GEMINI_API_KEY = 'AQ.Ab8RN6MalformedFallbackKey'
      geminiMock.generateContent.mockRejectedValue(new Error('Upstream error'))

      const token = createFakeJwt()
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prompt: 'kiểm tra ngân sách',
          context: { ngan_sach_thang: [null, { danh_muc: 123, trang_thai: 'exceeded', phan_tram: 120 }] }
        })

      expect(res.status).toBe(502)
      expect(res.body.success).toBe(false)
      expect(res.body.mode).toBe('smart_context_advisor')
      expect(res.body.fallbackReply).toContain('123')
    })
  })

  describe('R3 #5 — POST /api/quick-entry/parse UTC+7 & parity kiểm tra đầu vào', () => {
    it('Xử lý đúng ranh giới UTC+7 (Asia/Ho_Chi_Minh) và số thập phân 35.5k', async () => {
      // 2026-11-26T17:30:00.000Z == 2026-11-27 00:30:00+07:00
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-11-26T17:30:00.000Z'))

      const todayRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'cafe 35.5k hôm nay momo' })
      expect(todayRes.status).toBe(200)
      expect(todayRes.body.data).toMatchObject({
        amount: 35500,
        type: 'expense',
        date: '2026-11-27',
        walletKeyword: 'momo',
        categoryName: 'Ăn uống'
      })

      const yesterdayRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'ăn trưa 45k hôm qua' })
      expect(yesterdayRes.status).toBe(200)
      expect(yesterdayRes.body.data.date).toBe('2026-11-26')

      const twoDaysAgoRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'grab 60k hôm kia' })
      expect(twoDaysAgoRes.status).toBe(200)
      expect(twoDaysAgoRes.body.data.date).toBe('2026-11-25')
    })

    it('Hỗ trợ dd/mm, dd/mm/yy, từ chối 31/02 (422), tránh trùng substring combo/bệnh viện, hỗ trợ transfer & validate 400', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-11-20T05:00:00.000Z'))

      const ddmmRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'mua sách 120k 15/11' })
      expect(ddmmRes.status).toBe(200)
      expect(ddmmRes.body.data.date).toBe('2026-11-15')
      expect(ddmmRes.body.data.amount).toBe(120000)

      const ddmmyyRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'đổ xăng 80k 05/11/26' })
      expect(ddmmyyRes.status).toBe(200)
      expect(ddmmyyRes.body.data.date).toBe('2026-11-05')

      const invalidDateRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'cafe 35k 31/02' })
      expect(invalidDateRes.status).toBe(422)
      expect(invalidDateRes.body.success).toBe(false)

      const comboRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'mua combo 99k' })
      expect(comboRes.status).toBe(200)
      expect(comboRes.body.data.walletKeyword).toBeNull()

      const hospitalRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'khám bệnh viện 500k' })
      expect(hospitalRes.status).toBe(200)
      expect(hospitalRes.body.data.walletKeyword).toBeNull()
      expect(hospitalRes.body.data.categoryName).toBe('Y tế & Sức khỏe')

      const transferRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'chuyển 500k từ Momo sang Vietcombank' })
      expect(transferRes.status).toBe(200)
      expect(transferRes.body.data).toMatchObject({
        amount: 500000,
        type: 'transfer',
        walletKeyword: 'momo',
        toWalletKeyword: 'vietcombank',
        categoryName: null
      })

      const emptyTextRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: '   ' })
      expect(emptyTextRes.status).toBe(400)

      const badCategoriesRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'cafe 35k', categories: 'invalid' })
      expect(badCategoriesRes.status).toBe(400)

      const badWalletsRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'cafe 35k', wallets: {} })
      expect(badWalletsRes.status).toBe(400)
    })

    it('Đồng bộ parity với M2: hậu tố d/vnd, bỏ qua ví is_archived và chặn invalid Date trong localParts', async () => {
      const dRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'cơm trưa 35000d' })
      expect(dRes.status).toBe(200)
      expect(dRes.body.data.amount).toBe(35000)

      const vndRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'trà sữa 45.000 vnd' })
      expect(vndRes.status).toBe(200)
      expect(vndRes.body.data.amount).toBe(45000)

      const wallets = [
        { id: 'w-arch', name: 'Ví Bí Mật', is_archived: true },
        { id: 'w-act', name: 'Ví Công Ty', is_archived: false }
      ]
      const archivedRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'cafe 35k Ví Bí Mật', wallets })
      expect(archivedRes.status).toBe(200)
      expect(archivedRes.body.data.wallet).toBeNull()
      expect(archivedRes.body.data.walletKeyword).toBeNull()

      const activeRes = await request(app)
        .post('/api/quick-entry/parse')
        .send({ text: 'cafe 35k Ví Công Ty', wallets })
      expect(activeRes.status).toBe(200)
      expect(activeRes.body.data.wallet).toBe('Ví Công Ty')
      expect(activeRes.body.data.walletKeyword).toBe('vi cong ty')

      expect(resolveQuickWallet(wallets, 'Ví Bí Mật')).toBeNull()
      expect(resolveQuickWallet(wallets, 'Ví Công Ty')?.id).toBe('w-act')

      const invalidDateParsed = parseQuickEntryServer('cafe 35k', { now: new Date('invalid-date') })
      expect(invalidDateParsed).not.toBeNull()
      expect(invalidDateParsed.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})
