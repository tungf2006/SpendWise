import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Tải biến môi trường từ file .env (ở server hoặc thư mục gốc)
dotenv.config()
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import aiRoutes from './routes/aiRoutes.js'
import quickEntryRoutes from './routes/quickEntryRoutes.js'
import financeRoutes from './routes/financeRoutes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

// Cấu hình Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Định tuyến API (API Routes)
app.use('/api/ai', aiRoutes)
app.use('/api/quick-entry', quickEntryRoutes)
app.use('/api/finance', financeRoutes)

// Root API Endpoint
app.get('/', (req, res) => {
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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Internal Error]:', err)
  res.status(500).json({
    success: false,
    message: 'Lỗi máy chủ nội bộ',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

// Khởi chạy Server
app.listen(PORT, () => {
  console.log(`====================================================`)
  console.log(`🚀 SpendWise Backend REST API is running on port: ${PORT}`)
  console.log(`🌐 Base URL: http://localhost:${PORT}`)
  console.log(`📡 Healthcheck: http://localhost:${PORT}/api/finance/health`)
  console.log(`====================================================`)
})

export default app
