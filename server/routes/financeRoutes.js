import { Router } from 'express'

const router = Router()

const SAFE_TO_SPEND_FORMULA = 'max(0, (remainingBudget - upcomingRecurring) / daysLeft)'

function validateSafeToSpendBody(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['Body phải là JSON object.']
  }

  const errors = []
  const { remainingBudget, upcomingRecurring, daysLeft } = input

  if (typeof remainingBudget !== 'number' || !Number.isFinite(remainingBudget)) {
    errors.push('remainingBudget phải là một số hợp lệ.')
  }

  if (typeof upcomingRecurring !== 'number' || !Number.isFinite(upcomingRecurring) || upcomingRecurring < 0) {
    errors.push('upcomingRecurring phải là một số không âm.')
  }

  if (!Number.isInteger(daysLeft) || daysLeft < 1 || daysLeft > 31) {
    errors.push('daysLeft phải là số nguyên từ 1 đến 31 (bao gồm hôm nay).')
  }

  return errors
}

/**
 * POST /api/finance/safe-to-spend
 * Tính toán chỉ số Safe-to-spend trên Server (UC20)
 */
router.post('/safe-to-spend', (req, res) => {
  try {
    const errors = validateSafeToSpendBody(req.body)
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
        message: errors.join(' ')
      })
    }

    const { remainingBudget, upcomingRecurring, daysLeft } = req.body
    const availablePool = Math.max(0, remainingBudget - upcomingRecurring)
    const safeToSpendToday = Math.round(availablePool / daysLeft)

    return res.status(200).json({
      success: true,
      data: {
        safeToSpendToday,
        remainingBudget,
        upcomingRecurring,
        daysLeft,
        formula: SAFE_TO_SPEND_FORMULA
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
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'SpendWise Backend REST API',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

export default router
