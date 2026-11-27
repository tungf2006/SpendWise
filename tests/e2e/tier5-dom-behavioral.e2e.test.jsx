// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: new Proxy(
      {},
      {
        get: (_target, prop) => globalThis.__SPENDWISE_E2E_CLIENT__?.auth?.[prop],
      }
    ),
    from: (...args) => globalThis.__SPENDWISE_E2E_CLIENT__.from(...args),
    rpc: (...args) => globalThis.__SPENDWISE_E2E_CLIENT__.rpc(...args),
  },
}))

vi.mock('react-chartjs-2', () => ({
  Doughnut: ({ data }) =>
    React.createElement('div', {
      'data-testid': 'mock-doughnut',
      'data-labels': JSON.stringify(data?.labels || []),
    }),
}))

import {
  TEST_USER_A_ID,
  createFakeJwt,
  installFetchBridge,
  installSupabaseHarness,
  makeUuid,
} from './helpers/e2eHarness.js'
import { AuthContext } from '@/context/useAuth'
import { ThemeProvider } from '@/context/ThemeContext'
import { useTheme } from '@/context/useTheme'
import { THEME_STORAGE_KEY } from '@/context/themeUtils'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import DashboardPage from '@/pages/DashboardPage'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { createWallet } from '@/services/walletService'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container
let root
let harness
let fetchBridge

function setControlValue(el, value) {
  const proto =
    el instanceof window.HTMLSelectElement
      ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  descriptor.set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

async function flushAsync(ms = 35) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

function mountJsx(element) {
  act(() => {
    root.render(element)
  })
}

function installMatchMediaStub(initialMatches = false) {
  let currentMatches = initialMatches
  const listeners = new Set()

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query) => ({
      get matches() {
        return currentMatches
      },
      media: query,
      onchange: null,
      addEventListener: (_type, fn) => listeners.add(fn),
      removeEventListener: (_type, fn) => listeners.delete(fn),
      addListener: (fn) => listeners.add(fn),
      removeListener: (fn) => listeners.delete(fn),
      dispatchEvent: () => true,
    })),
  })

  return {
    setMatches(next) {
      currentMatches = next
      for (const fn of listeners) {
        fn({ matches: next, media: '(prefers-color-scheme: dark)' })
      }
    },
  }
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  document.documentElement.className = ''
  window.localStorage.clear()
  window.history.replaceState({}, '', '/')
  Element.prototype.scrollIntoView = vi.fn()
  installMatchMediaStub(false)
  harness = installSupabaseHarness()
  fetchBridge = installFetchBridge({ failApiConnection: true })
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  fetchBridge.restore()
  vi.restoreAllMocks()
})

describe('Tier 5 — Behavioral DOM Tests (React 19 createRoot + jsdom)', () => {
  describe('1. ResetPasswordPage Recovery Behavioral Flows (UC04, R3 #8)', () => {
    it('PASSWORD_RECOVERY event after mount enables form and submits updatePassword', async () => {
      harness = installSupabaseHarness({ initialUser: null })
      const updateSpy = vi.spyOn(harness.client.auth, 'updateUser')

      mountJsx(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/reset-password'] },
          React.createElement(ResetPasswordPage)
        )
      )
      await flushAsync()

      // Before recovery event, form is blocked with expired link message
      expect(container.querySelector('#new-password')).toBeNull()

      const recoveryUser = { id: TEST_USER_A_ID, email: 'demo@spendwise.vn' }
      harness.setUser(recoveryUser)
      await act(async () => {
        harness.emitAuth('PASSWORD_RECOVERY', {
          access_token: createFakeJwt({ sub: TEST_USER_A_ID }),
          user: recoveryUser,
        })
      })

      const newPassInput = container.querySelector('#new-password')
      const confirmInput = container.querySelector('#confirm-password')
      expect(newPassInput).not.toBeNull()
      expect(confirmInput).not.toBeNull()

      // Validation: < 6 chars
      await act(async () => {
        setControlValue(newPassInput, '123')
        setControlValue(confirmInput, '123')
      })
      await act(async () => {
        container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      })
      expect(container.textContent).toContain('Mật khẩu phải có ít nhất 6 ký tự.')
      expect(updateSpy).not.toHaveBeenCalled()

      // Validation: mismatch
      await act(async () => {
        setControlValue(newPassInput, 'NewPass123!')
        setControlValue(confirmInput, 'Mismatch123!')
      })
      await act(async () => {
        container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      })
      expect(container.textContent).toContain('Mật khẩu xác nhận không khớp.')
      expect(updateSpy).not.toHaveBeenCalled()

      // Valid submission
      await act(async () => {
        setControlValue(newPassInput, 'NewPass123!')
        setControlValue(confirmInput, 'NewPass123!')
      })
      await act(async () => {
        container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      })
      await flushAsync()

      expect(updateSpy).toHaveBeenCalledWith({ password: 'NewPass123!' })
      expect(container.textContent).toContain('Mật khẩu đã được cập nhật thành công.')
    })

    it('Pre-mount recovery session (getSession) skips stuck spinner and enables form', async () => {
      // Initialized with active session before mount
      mountJsx(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/reset-password'] },
          React.createElement(ResetPasswordPage)
        )
      )
      await flushAsync()

      expect(container.textContent).not.toContain('Đang xác thực liên kết đặt lại mật khẩu...')
      expect(container.querySelector('#new-password')).not.toBeNull()
    })

    it('?code=pkce_123 triggers exchangeCodeForSession, cleans URL via replaceState, and allows submit', async () => {
      harness = installSupabaseHarness({ initialUser: null })
      const exchangedUser = { id: TEST_USER_A_ID, email: 'demo@spendwise.vn' }
      harness.state.onAuthCodeExchange = vi.fn(async (code) => {
        expect(code).toBe('pkce_123')
        harness.setUser(exchangedUser)
        return {
          data: {
            session: {
              access_token: createFakeJwt({ sub: TEST_USER_A_ID }),
              user: exchangedUser,
            },
          },
          error: null,
        }
      })

      window.history.replaceState({}, '', '/reset-password?code=pkce_123&next=login')
      const replaceSpy = vi.spyOn(window.history, 'replaceState')

      mountJsx(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/reset-password?code=pkce_123&next=login'] },
          React.createElement(ResetPasswordPage)
        )
      )
      await flushAsync()

      expect(harness.state.onAuthCodeExchange).toHaveBeenCalledWith('pkce_123')
      expect(replaceSpy).toHaveBeenCalled()
      expect(window.location.search).toBe('?next=login')
      expect(container.querySelector('#new-password')).not.toBeNull()
    })

    it('#error=access_denied without token shows EXPIRED_LINK_MESSAGE and blocks submit', async () => {
      harness = installSupabaseHarness({ initialUser: null })
      window.history.replaceState({}, '', '/reset-password#error=access_denied&error_description=Expired')

      mountJsx(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/reset-password'] },
          React.createElement(ResetPasswordPage)
        )
      )
      await flushAsync()

      expect(container.querySelector('#new-password')).toBeNull()
      expect(container.textContent).toContain('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn')
    })
  })

  describe('2. DashboardPage Quick Entry & UC19 Preview Behavioral DOM Flows (R2 #1, R3 #5, #6)', () => {
    function renderDashboard() {
      const authVal = {
        user: { id: TEST_USER_A_ID, email: 'demo@spendwise.vn', user_metadata: { full_name: 'Nguyễn Văn Demo' } },
        profile: { id: TEST_USER_A_ID, full_name: 'Nguyễn Văn Demo' },
        loading: false,
      }
      mountJsx(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/'] },
          React.createElement(
            AuthContext.Provider,
            { value: authVal },
            React.createElement(DashboardPage)
          )
        )
      )
    }

    it('Unrecognized wallet opens UC19 Preview with border-amber-400 + empty wallet_id (never wallets[0]); editing & submitting creates transaction', async () => {
      const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 1000000 })
      const { data: momo } = await createWallet({ name: 'MoMo', type: 'ewallet', balance: 500000 })

      renderDashboard()
      await flushAsync(60)

      const quickInput = container.querySelector('#quick-entry-input')
      expect(quickInput).not.toBeNull()

      await act(async () => {
        setControlValue(quickInput, 'ăn phở 45k')
      })

      const saveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent.trim() === 'Lưu'
      )
      await act(async () => {
        saveBtn.click()
      })
      await flushAsync()

      // UC19 Preview Modal must open with empty wallet_id and amber border
      const dialog = container.querySelector('[role="dialog"]')
      expect(dialog).not.toBeNull()
      expect(dialog.textContent).toContain('Xem trước & Xác nhận giao dịch (UC19)')

      const walletSelect = dialog.querySelector('#preview-wallet')
      expect(walletSelect.value).toBe('')
      expect(walletSelect.className).toContain('border-amber-400')
      expect(harness.db.transactions).toHaveLength(0)

      // Select MoMo wallet and submit
      await act(async () => {
        setControlValue(walletSelect, momo.id)
      })
      expect(walletSelect.className).not.toContain('border-amber-400')

      await act(async () => {
        dialog.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      })
      await flushAsync(60)

      expect(container.querySelector('[role="dialog"]')).toBeNull()
      expect(harness.db.transactions).toHaveLength(1)
      expect(harness.db.transactions[0].wallet_id).toBe(momo.id)
      expect(harness.db.transactions[0].wallet_id).not.toBe(cash.id)
      expect(harness.db.transactions[0].amount).toBe(45000)
      expect(harness.db.wallets.find((w) => w.id === momo.id).balance).toBe(455000)
      expect(harness.db.wallets.find((w) => w.id === cash.id).balance).toBe(1000000)
    })

    it('Recognized full text saves directly on exact matched wallet (momo, not wallets[0]) without opening Preview', async () => {
      const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 1000000 })
      const { data: momo } = await createWallet({ name: 'MoMo', type: 'ewallet', balance: 500000 })

      renderDashboard()
      await flushAsync(60)

      const quickInput = container.querySelector('#quick-entry-input')
      await act(async () => {
        setControlValue(quickInput, 'cafe 35k hôm qua momo')
      })

      const saveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent.trim() === 'Lưu'
      )
      await act(async () => {
        saveBtn.click()
      })
      await flushAsync(60)

      expect(container.querySelector('[role="dialog"]')).toBeNull()
      expect(harness.db.transactions).toHaveLength(1)
      expect(harness.db.transactions[0].wallet_id).toBe(momo.id)
      expect(harness.db.transactions[0].wallet_id).not.toBe(cash.id)
      expect(harness.db.transactions[0].amount).toBe(35000)
      expect(harness.db.wallets.find((w) => w.id === momo.id).balance).toBe(465000)
    })

    it('Invalid date input ("cafe 35k 31/02") opens Preview with amber date highlight', async () => {
      await createWallet({ name: 'MoMo', type: 'ewallet', balance: 500000 })

      renderDashboard()
      await flushAsync(60)

      const quickInput = container.querySelector('#quick-entry-input')
      await act(async () => {
        setControlValue(quickInput, 'cafe 35k 31/02')
      })

      const saveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent.trim() === 'Lưu'
      )
      await act(async () => {
        saveBtn.click()
      })
      await flushAsync()

      const dialog = container.querySelector('[role="dialog"]')
      expect(dialog).not.toBeNull()
      const dateInput = dialog.querySelector('#preview-date')
      expect(dateInput.className).toContain('border-amber-400')
    })
  })

  describe('3. NotificationBell Behavioral DOM Interactions (UC25, R2 #3)', () => {
    it('Opens popover, executes onMarkOne / onMarkAll / onClearRead, and closes on Escape', async () => {
      const n1 = {
        id: makeUuid(),
        user_id: TEST_USER_A_ID,
        type: 'budget_warning',
        title: 'Cảnh báo ngân sách Ăn uống',
        message: 'Đã đạt 85% ngân sách.',
        is_read: false,
        created_at: '2026-11-26T08:00:00Z',
      }
      const n2 = {
        id: makeUuid(),
        user_id: TEST_USER_A_ID,
        type: 'recurring_due',
        title: 'Đến hạn tiền nhà',
        message: 'Cần thanh toán 5.000.000 đ.',
        is_read: false,
        created_at: '2026-11-26T09:00:00Z',
      }
      harness.db.notifications.push(n1, n2)

      const authVal = {
        user: { id: TEST_USER_A_ID, email: 'demo@spendwise.vn' },
        profile: { id: TEST_USER_A_ID, full_name: 'Nguyễn Văn Demo' },
        loading: false,
      }
      mountJsx(
        React.createElement(
          AuthContext.Provider,
          { value: authVal },
          React.createElement(NotificationBell)
        )
      )
      await flushAsync(50)

      const bellBtn = container.querySelector('button[aria-haspopup="dialog"]')
      expect(bellBtn).not.toBeNull()
      expect(bellBtn.textContent).toContain('2')

      // Open popover
      await act(async () => {
        bellBtn.click()
      })
      await flushAsync(40)

      let dialog = container.querySelector('[role="dialog"]')
      expect(dialog).not.toBeNull()
      expect(dialog.textContent).toContain('2 chưa đọc')

      // Mark one as read
      const markOneBtns = Array.from(dialog.querySelectorAll('button')).filter((b) =>
        b.textContent.includes('Đánh dấu đã đọc')
      )
      expect(markOneBtns).toHaveLength(2)
      await act(async () => {
        markOneBtns[0].click()
      })
      await flushAsync(40)

      expect(harness.db.notifications.filter((n) => !n.is_read)).toHaveLength(1)
      expect(container.querySelector('[role="dialog"]').textContent).toContain('1 chưa đọc')

      // Mark all as read
      const markAllBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Đánh dấu tất cả đã đọc')
      )
      await act(async () => {
        markAllBtn.click()
      })
      await flushAsync(40)

      expect(harness.db.notifications.filter((n) => !n.is_read)).toHaveLength(0)
      expect(container.querySelector('[role="dialog"]').textContent).toContain('0 chưa đọc')

      // Clear read notifications
      const clearReadBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Xóa đã đọc')
      )
      await act(async () => {
        clearReadBtn.click()
      })
      await flushAsync(40)

      expect(harness.db.notifications).toHaveLength(0)
      expect(container.querySelector('[role="dialog"]').textContent).toContain('Chưa có thông báo nào.')

      // Escape closes dialog
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })
      expect(container.querySelector('[role="dialog"]')).toBeNull()
    })
  })

  describe('4. ThemeContext Behavioral DOM Flows (R5 #21)', () => {
    function ThemeProbe() {
      const { theme, isDark, toggleTheme } = useTheme()
      return React.createElement(
        'div',
        null,
        React.createElement('span', { 'data-testid': 'theme-value' }, `${theme}:${isDark}`),
        React.createElement('button', { type: 'button', onClick: toggleTheme }, 'Toggle Theme')
      )
    }

    it('toggleTheme updates html.dark + localStorage; storage event syncs cross-tab; matchMedia reacts when unset', async () => {
      const mm = installMatchMediaStub(false)

      mountJsx(React.createElement(ThemeProvider, null, React.createElement(ThemeProbe)))
      await flushAsync(20)

      expect(container.querySelector('[data-testid="theme-value"]').textContent).toBe('light:false')
      expect(document.documentElement.classList.contains('dark')).toBe(false)

      // matchMedia change updates theme while stored theme is null
      await act(async () => {
        mm.setMatches(true)
      })
      expect(container.querySelector('[data-testid="theme-value"]').textContent).toBe('dark:true')
      expect(document.documentElement.classList.contains('dark')).toBe(true)

      // toggleTheme switches back to light & persists to localStorage
      await act(async () => {
        container.querySelector('button').click()
      })
      expect(container.querySelector('[data-testid="theme-value"]').textContent).toBe('light:false')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

      // matchMedia should be ignored once user explicitly stored a theme
      await act(async () => {
        mm.setMatches(true)
      })
      expect(container.querySelector('[data-testid="theme-value"]').textContent).toBe('light:false')

      // Cross-tab storage event syncs to dark
      await act(async () => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: THEME_STORAGE_KEY,
            newValue: 'dark',
          })
        )
      })
      expect(container.querySelector('[data-testid="theme-value"]').textContent).toBe('dark:true')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })
})
