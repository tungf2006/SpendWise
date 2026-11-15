import crypto from 'node:crypto'

const verifiedTokenCache = new Map()
const CACHE_TTL_MS = 60 * 1000

function getTokenCacheKey(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null
  }

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const json = Buffer.from(padded, 'base64').toString('utf8')
    const payload = JSON.parse(json)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

function isPayloadExpired(payload) {
  if (typeof payload.exp !== 'number') return false
  return payload.exp * 1000 <= Date.now()
}

async function verifyWithSupabaseAuth(token, payload) {
  if (process.env.NODE_ENV === 'test' || process.env.SKIP_SUPABASE_REMOTE_AUTH === 'true') {
    return {
      user: {
        id: payload.sub,
        email: payload.email || null,
        role: payload.role || 'authenticated'
      },
      error: null
    }
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      user: {
        id: payload.sub,
        email: payload.email || null,
        role: payload.role || 'authenticated'
      },
      error: null
    }
  }

  const cacheKey = getTokenCacheKey(token)
  const cached = verifiedTokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { user: cached.user, error: null }
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`
      }
    })

    if (!response.ok) {
      verifiedTokenCache.delete(cacheKey)
      return { user: null, status: 401, error: 'Phiên đăng nhập không hợp lệ hoặc đã bị thu hồi.' }
    }

    const userData = await response.json()
    if (!userData?.id) {
      return { user: null, status: 401, error: 'Không xác định được danh tính người dùng.' }
    }

    const user = {
      id: userData.id,
      email: userData.email || payload.email || null,
      role: userData.role || payload.role || 'authenticated'
    }

    if (verifiedTokenCache.size > 500) {
      verifiedTokenCache.clear()
    }
    verifiedTokenCache.set(cacheKey, {
      user,
      expiresAt: Date.now() + CACHE_TTL_MS
    })

    return { user, error: null }
  } catch (err) {
    return {
      user: null,
      status: 503,
      error: `Không thể kết nối dịch vụ xác thực Supabase: ${err.message}`
    }
  }
}

async function authenticateBearerHeader(authHeader) {
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return { user: null, status: 401, error: 'Thiếu header Authorization Bearer token.' }
  }

  const token = authHeader.slice(7).trim()
  if (!token) {
    return { user: null, status: 401, error: 'Token xác thực không được để trống.' }
  }

  const payload = decodeJwtPayload(token)
  if (!payload || !payload.sub) {
    return { user: null, status: 401, error: 'Token JWT không đúng định dạng.' }
  }

  if (isPayloadExpired(payload)) {
    return { user: null, status: 401, error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' }
  }

  return verifyWithSupabaseAuth(token, payload)
}

/**
 * Middleware bắt buộc đăng nhập (HTTP 401 nếu thiếu hoặc token không hợp lệ).
 */
export async function requireAuth(req, res, next) {
  const authResult = await authenticateBearerHeader(req.headers.authorization)
  if (authResult.error || !authResult.user) {
    return res.status(authResult.status || 401).json({
      success: false,
      message: authResult.error || 'Chưa xác thực: Vui lòng đăng nhập để tiếp tục.'
    })
  }

  req.user = authResult.user
  return next()
}

/**
 * Middleware xác thực tùy chọn:
 * - Nếu không gửi Authorization header (và không bật STRICT_API_AUTH=true): cho đi tiếp với req.user = null.
 * - Nếu có gửi Authorization header: bắt buộc kiểm tra hợp lệ, từ chối 401 nếu token sai/hết hạn.
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    if (process.env.STRICT_API_AUTH === 'true') {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực: Vui lòng đăng nhập để sử dụng API.'
      })
    }
    req.user = null
    return next()
  }

  const authResult = await authenticateBearerHeader(authHeader)
  if (authResult.error || !authResult.user) {
    return res.status(authResult.status || 401).json({
      success: false,
      message: authResult.error || 'Token xác thực không hợp lệ.'
    })
  }

  req.user = authResult.user
  return next()
}

export function clearAuthCache() {
  verifiedTokenCache.clear()
}
