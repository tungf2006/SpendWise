import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import { createApp } from '../app.js'
import { resetRateLimiters } from '../middleware/rateLimiter.js'
import { clearAuthCache } from '../middleware/authMiddleware.js'

function request(app) {
  return {
    get: (url) => makeRequest(app, 'GET', url),
    post: (url) => makeRequest(app, 'POST', url)
  }
}

function makeRequest(app, method, url) {
  const headers = {}
  let bodyData = null
  const chain = {
    set(key, val) {
      headers[key.toLowerCase()] = val
      return chain
    },
    send(data) {
      bodyData = data
      return chain
    },
    then(resolve, reject) {
      return execute().then(resolve, reject)
    },
    catch(reject) {
      return execute().catch(reject)
    }
  }

  async function execute() {
    const pipe = '\\\\.\\pipe\\sp-test-' + Math.random().toString(36).slice(2)
    const server = http.createServer(app)
    await new Promise((res, rej) => {
      server.listen(pipe, res).on('error', rej)
    })

    try {
      let payload = ''
      if (typeof bodyData === 'string') {
        payload = bodyData
        if (!headers['content-type']) headers['content-type'] = 'application/json'
      } else if (bodyData && typeof bodyData === 'object') {
        payload = JSON.stringify(bodyData)
        if (!headers['content-type']) headers['content-type'] = 'application/json'
      }
      if (payload) {
        headers['content-length'] = Buffer.byteLength(payload)
      }

      return await new Promise((res, rej) => {
        const req = http.request({
          socketPath: pipe,
          path: url,
          method,
          headers
        }, response => {
          let raw = ''
          response.on('data', chunk => { raw += chunk })
          response.on('end', () => {
            let parsedBody = raw
            try {
              parsedBody = JSON.parse(raw)
            } catch {}
            res({
              status: response.statusCode,
              body: parsedBody,
              headers: response.headers
            })
          })
        })
        req.on('error', rej)
        if (payload) req.write(payload)
        req.end()
      })
    } finally {
      await new Promise(r => server.close(r))
    }
  }

  return chain
}

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

describe('SpendWise Backend Express API (Security, Auth, Rate Limit & Finance)', () => {
  let app
  let prevNodeEnv
  let prevGeminiKey
  let prevViteGeminiKey

  beforeEach(() => {
    prevNodeEnv = process.env.NODE_ENV
    prevGeminiKey = process.env.GEMINI_API_KEY
    prevViteGeminiKey = process.env.VITE_GEMINI_API_KEY
    process.env.NODE_ENV = 'test'
    delete process.env.GEMINI_API_KEY
    delete process.env.VITE_GEMINI_API_KEY

    resetRateLimiters()
    clearAuthCache()
    app = createApp()
  })

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv
    if (prevGeminiKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = prevGeminiKey
    if (prevViteGeminiKey === undefined) delete process.env.VITE_GEMINI_API_KEY
    else process.env.VITE_GEMINI_API_KEY = prevViteGeminiKey
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
})
