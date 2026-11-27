export const THEME_STORAGE_KEY = 'spendwise_theme'

/**
 * Chuẩn hóa giá trị theme về 'light' | 'dark' hoặc null nếu không hợp lệ.
 */
export function normalizeTheme(value) {
  if (value === 'dark' || value === 'light') return value
  return null
}

/**
 * Quyết định theme hiện tại dựa trên giá trị đã lưu và prefers-color-scheme.
 */
export function resolveTheme({ storedTheme = null, prefersDark = false } = {}) {
  const normalized = normalizeTheme(storedTheme)
  if (normalized) return normalized
  return prefersDark ? 'dark' : 'light'
}

export function readStoredTheme(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  if (!storage || typeof storage.getItem !== 'function') return null
  try {
    return normalizeTheme(storage.getItem(THEME_STORAGE_KEY))
  } catch {
    return null
  }
}

export function writeStoredTheme(theme, storage = typeof window !== 'undefined' ? window.localStorage : null) {
  const normalized = normalizeTheme(theme)
  if (!normalized || !storage || typeof storage.setItem !== 'function') return false
  try {
    storage.setItem(THEME_STORAGE_KEY, normalized)
    return true
  } catch {
    return false
  }
}

export function getSystemPrefersDark(
  matchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia.bind(window)
    : null
) {
  if (!matchMedia) return false
  try {
    return Boolean(matchMedia('(prefers-color-scheme: dark)')?.matches)
  } catch {
    return false
  }
}

export function getInitialTheme({ storage, matchMedia } = {}) {
  const storedTheme = readStoredTheme(storage)
  const prefersDark = getSystemPrefersDark(matchMedia)
  return resolveTheme({ storedTheme, prefersDark })
}

export function applyThemeToDocument(theme, doc = typeof document !== 'undefined' ? document : null) {
  const normalized = normalizeTheme(theme) || 'light'
  if (!doc || !doc.documentElement) return normalized

  const isDark = normalized === 'dark'
  doc.documentElement.classList?.toggle?.('dark', isDark)
  if (doc.documentElement.style) {
    doc.documentElement.style.colorScheme = normalized
  }

  const themeMeta = doc.querySelector?.('meta[name="theme-color"]')
  if (themeMeta && typeof themeMeta.setAttribute === 'function') {
    themeMeta.setAttribute('content', isDark ? '#0B0F19' : '#F8FAFC')
  }

  return normalized
}
