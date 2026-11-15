const stores = new Set()

function getClientKey(req, keyPrefix) {
  const identity = req.user?.id || req.ip || req.socket?.remoteAddress || 'anonymous'
  return `${keyPrefix}:${identity}`
}

/**
 * Tạo middleware giới hạn tần suất yêu cầu (Fixed Window Rate Limiter) trên Express.
 * Thiết lập đầy đủ các header X-RateLimit-* và Retry-After khi vượt ngưỡng.
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 100,
  keyPrefix = 'api',
  message = 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.'
} = {}) {
  const hits = new Map()
  stores.add(hits)

  return function rateLimiterMiddleware(req, res, next) {
    const now = Date.now()
    const key = getClientKey(req, keyPrefix)

    // Dọn dẹp các bucket đã hết hạn khi kích thước map tăng cao
    if (hits.size > 1000) {
      for (const [entryKey, entry] of hits.entries()) {
        if (entry.resetAt <= now) {
          hits.delete(entryKey)
        }
      }
    }

    let record = hits.get(key)
    if (!record || record.resetAt <= now) {
      record = { count: 0, resetAt: now + windowMs }
      hits.set(key, record)
    }

    record.count += 1
    const remaining = Math.max(0, max - record.count)
    const resetEpochSeconds = Math.ceil(record.resetAt / 1000)

    res.setHeader('X-RateLimit-Limit', String(max))
    res.setHeader('X-RateLimit-Remaining', String(remaining))
    res.setHeader('X-RateLimit-Reset', String(resetEpochSeconds))

    if (record.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(retryAfterSeconds))
      return res.status(429).json({
        success: false,
        message,
        retryAfterSeconds
      })
    }

    return next()
  }
}

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 100),
  keyPrefix: 'global',
  message: 'Hệ thống nhận quá nhiều yêu cầu từ thiết bị của bạn. Vui lòng thử lại sau ít phút.'
})

export const aiChatRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX || 20),
  keyPrefix: 'ai-chat',
  message: 'Bạn đã hỏi Trợ lý AI quá nhanh. Vui lòng đợi 1 phút rồi thử lại.'
})

/** Xóa bộ đếm Rate Limit (chủ yếu phục vụ kiểm thử đơn vị / tích hợp). */
export function resetRateLimiters() {
  for (const store of stores) {
    store.clear()
  }
}
