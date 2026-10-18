import { Router } from 'express'

const router = Router()

/**
 * POST /api/finance/safe-to-spend
 * Tính toán chỉ số Safe-to-spend trên Server
 * Phụ trách: TV4 (Lê Hoài Quốc) - Nhóm chức năng STS (UC20)
 */
router.post('/safe-to-spend', (req, res) => {
  try {
    const { remainingBudget = 0, upcomingRecurring = 0, daysLeft = 1 } = req.body

    const budget = Math.max(0, Number(remainingBudget) || 0)
    const recurring = Math.max(0, Number(upcomingRecurring) || 0)
    const days = Math.max(1, Number(daysLeft) || 1)

    const availablePool = Math.max(0, budget - recurring)
    const safeToSpendToday = Math.round(availablePool / days)

    return res.status(200).json({
      success: true,
      data: {
        safeToSpendToday,
        remainingBudget: budget,
        upcomingRecurring: recurring,
        daysLeft: days,
        formula: 'max(0, (remainingBudget - upcomingRecurring) / daysLeft)'
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/finance/health
 * Kiểm tra trạng thái hoạt động của Backend
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'SpendWise Backend REST API',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

export default router
