import { describe, it, expect, vi } from 'vitest'
import {
  THEME_STORAGE_KEY,
  normalizeTheme,
  resolveTheme,
  readStoredTheme,
  writeStoredTheme,
  getInitialTheme,
  applyThemeToDocument,
} from '../themeUtils.js'

describe('themeUtils (R5 #21 Dark/Light Theme)', () => {
  it('chuẩn hóa giá trị theme hợp lệ và loại bỏ giá trị lạ', () => {
    expect(THEME_STORAGE_KEY).toBe('spendwise_theme')
    expect(normalizeTheme('dark')).toBe('dark')
    expect(normalizeTheme('light')).toBe('light')
    expect(normalizeTheme('system')).toBeNull()
    expect(normalizeTheme('')).toBeNull()
    expect(normalizeTheme(null)).toBeNull()
  })

  it('resolveTheme ưu tiên giá trị đã lưu trước prefers-color-scheme', () => {
    expect(resolveTheme({ storedTheme: 'dark', prefersDark: false })).toBe('dark')
    expect(resolveTheme({ storedTheme: 'light', prefersDark: true })).toBe('light')
    expect(resolveTheme({ storedTheme: 'invalid', prefersDark: true })).toBe('dark')
    expect(resolveTheme({ storedTheme: null, prefersDark: true })).toBe('dark')
    expect(resolveTheme({ storedTheme: null, prefersDark: false })).toBe('light')
  })

  it('readStoredTheme và writeStoredTheme thao tác storage an toàn kể cả khi ném lỗi', () => {
    const store = new Map()
    const mockStorage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    }

    expect(readStoredTheme(mockStorage)).toBeNull()
    expect(writeStoredTheme('dark', mockStorage)).toBe(true)
    expect(readStoredTheme(mockStorage)).toBe('dark')
    expect(writeStoredTheme('invalid-theme', mockStorage)).toBe(false)
    expect(readStoredTheme(mockStorage)).toBe('dark')

    const brokenStorage = {
      getItem: () => {
        throw new Error('Quota/SecurityError')
      },
      setItem: () => {
        throw new Error('Quota/SecurityError')
      },
    }
    expect(readStoredTheme(brokenStorage)).toBeNull()
    expect(writeStoredTheme('light', brokenStorage)).toBe(false)
  })

  it('getInitialTheme kết hợp storage và matchMedia chính xác', () => {
    const mockStorage = {
      getItem: () => null,
    }
    const darkMedia = () => ({ matches: true })
    const lightMedia = () => ({ matches: false })

    expect(getInitialTheme({ storage: mockStorage, matchMedia: darkMedia })).toBe('dark')
    expect(getInitialTheme({ storage: mockStorage, matchMedia: lightMedia })).toBe('light')
    expect(
      getInitialTheme({
        storage: { getItem: () => 'light' },
        matchMedia: darkMedia,
      })
    ).toBe('light')
  })

  it('applyThemeToDocument đồng bộ class html.dark, colorScheme và meta theme-color', () => {
    const classes = new Set()
    const setAttribute = vi.fn()
    const mockDoc = {
      documentElement: {
        classList: {
          toggle: (cls, force) => {
            if (force) classes.add(cls)
            else classes.delete(cls)
          },
        },
        style: { colorScheme: '' },
      },
      querySelector: (selector) =>
        selector === 'meta[name="theme-color"]' ? { setAttribute } : null,
    }

    expect(applyThemeToDocument('dark', mockDoc)).toBe('dark')
    expect(classes.has('dark')).toBe(true)
    expect(mockDoc.documentElement.style.colorScheme).toBe('dark')
    expect(setAttribute).toHaveBeenLastCalledWith('content', '#0B0F19')

    expect(applyThemeToDocument('light', mockDoc)).toBe('light')
    expect(classes.has('dark')).toBe(false)
    expect(mockDoc.documentElement.style.colorScheme).toBe('light')
    expect(setAttribute).toHaveBeenLastCalledWith('content', '#F8FAFC')
  })
})
