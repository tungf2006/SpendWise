import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './useTheme'
import {
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  getInitialTheme,
  normalizeTheme,
  readStoredTheme,
  writeStoredTheme,
} from './themeUtils'

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => getInitialTheme())

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleStorage = (event) => {
      if (event.key !== THEME_STORAGE_KEY) return
      const next = normalizeTheme(event.newValue)
      if (next) {
        setThemeState(next)
      }
    }

    window.addEventListener('storage', handleStorage)

    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null

    const handleMediaChange = (event) => {
      if (readStoredTheme() !== null) return
      setThemeState(event.matches ? 'dark' : 'light')
    }

    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleMediaChange)
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleMediaChange)
      }
    }

    return () => {
      window.removeEventListener('storage', handleStorage)
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === 'function') {
          mediaQuery.removeEventListener('change', handleMediaChange)
        } else if (typeof mediaQuery.removeListener === 'function') {
          mediaQuery.removeListener(handleMediaChange)
        }
      }
    }
  }, [])

  const setTheme = useCallback((nextOrUpdater) => {
    setThemeState((prev) => {
      const candidate =
        typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater
      const normalized = normalizeTheme(candidate)
      if (!normalized) return prev
      writeStoredTheme(normalized)
      applyThemeToDocument(normalized)
      return normalized
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [setTheme])

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      toggleTheme,
      setTheme,
    }),
    [theme, toggleTheme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
