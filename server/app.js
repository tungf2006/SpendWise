import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

import aiRoutes from './routes/aiRoutes.js'
import quickEntryRoutes from './routes/quickEntryRoutes.js'
import financeRoutes from './routes/financeRoutes.js'
import { requireAuth, optionalAuth } from './middleware/authMiddleware.js'
import { apiRateLimiter, aiChatRateLimiter } from './middleware/rateLimiter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let envLoaded = false

function loadServerEnv() {
  if (envLoaded || process.env.NODE_ENV === 'test') return
  dotenv.config({ path: path.resolve(__dirname, '.env') })
  dotenv.config({ path: path.resolve(process.cwd(), '.env') })
  envLoaded = true
}

function getAllowedOrigins() {
  const configured = process.env.CORS_ORIGIN
  if (configured && configured.trim()) {
    return configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  }
  return ['http://localhost:5173', 'http://127.0.0.1:5173']
}

/**
 * Khởi tạo Express App độc lập (tách khỏi app.listen để hỗ trợ kiểm thử Supertest/Vitest).
 */
export function createApp() {
  loadServerEnv()

  const app = express()
  app.disable('x-powered-by')

  // Security headers cơ bản
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
  })

  const allowedOrigins = getAllowedOrigins()
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true
    })
  )

  app.use(express.json({ limit: '100kb' }))
  app.use(express.urlencoded({ extended: true, limit: '100kb' }))

  // Giới hạn tần suất chung cho toàn bộ API
  app.use('/api', apiRateLimiter)

  // Định tuyến API với phân quyền JWT & Rate Limiter riêng cho AI
  app.use('/api/ai', requireAuth, aiChatRateLimiter, aiRoutes)
  app.use('/api/quick-entry', optionalAuth, quickEntryRoutes)
  app.use('/api/finance', optionalAuth, financeRoutes)

  // Root API Endpoint
  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'SpendWise Backend REST API',
      version: '1.0.0',
      description: 'Máy chủ Backend cung cấp dịch vụ phân tích tài chính và Trợ lý AI Gemini cho SpendWise',
      author: 'Phan Thanh Tùng (Leader)',
      endpoints: {
        health: 'GET /api/finance/health',
        aiChat: 'POST /api/ai/chat',
        quickEntryParse: 'POST /api/quick-entry/parse',
        safeToSpend: 'POST /api/finance/safe-to-spend'
      },
      status: 'Running'
    })
  })

  // Xử lý Route 404
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Không tìm thấy endpoint: ${req.method} ${req.originalUrl}`
    })
  })

  // Global Error Handler (Express 5 yêu cầu đủ 4 tham số)
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({
        success: false,
        message: 'Dữ liệu gửi lên vượt quá giới hạn cho phép (100KB).'
      })
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu JSON không hợp lệ.'
      })
    }
    console.error('[Server Internal Error]:', err)
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    })
  })

  return app
}
