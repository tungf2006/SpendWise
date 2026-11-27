import fs from 'node:fs'
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'

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

vi.mock('@google/genai', () => ({
  GoogleGenAI: class MockGoogleGenAI {
    constructor({ apiKey } = {}) {
      this.apiKey = apiKey
      this.models = {
        generateContent: async ({ model, contents, config } = {}) => {
          const hook = globalThis.__SPENDWISE_E2E_GEMINI__
          if (!hook) return { text: 'Mock Gemini Reply' }
          const adapter = hook(this.apiKey, { model, systemInstruction: config?.systemInstruction })
          const res = await adapter.generateContent(contents, { signal: config?.abortSignal })
          if (res && typeof res.text === 'string') return res
          return { text: res?.response?.text ? res.response.text() : '' }
        },
      }
    }
  },
}))

import {
  TEST_USER_A_ID,
  createEnvironmentController,
  getRepoPath,
  installBrowserStubs,
  installFetchBridge,
  installSupabaseHarness,
  renderWithRouter,
  runIndexPrePaintThemeScript,
  runSwInVm,
  todayVietnamDate,
} from './helpers/e2eHarness.js'

import { updateProfile } from '@/services/authService'
import { createWallet, getWallets, transferFunds } from '@/services/walletService'
import { createCategory, getCategories } from '@/services/categoryService'
import { createTransaction, updateTransaction, deleteTransaction } from '@/services/transactionService'
import { setBudget, getBudgetProgress } from '@/services/budgetService'
import { getFinancialSummary, getCategoryExpenseBreakdown } from '@/services/reportService'
import { parseQuickEntry, resolveQuickWallet } from '@/services/quickEntryParser'
import { calculateSafeToSpend, getRemainingDaysInMonth } from '@/services/safeToSpendService'
import { askGeminiAssistant, buildFinancialContext } from '@/services/aiAssistantService'
import { createGoal, depositToGoal, getGoals } from '@/services/goalService'
import { createRecurringRule, checkAndGenerateRecurringTransactions } from '@/services/recurringService'
import { checkAndGenerateNotifications, getNotifications, getUnreadCount } from '@/services/notificationService'
import { generateVietQrUrl, splitBill } from '@/services/vietqrService'
import { Navbar } from '@/components/layout/Navbar'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import { parseQuickEntryServer } from '../../server/routes/quickEntryRoutes.js'
import { createApp } from '../../server/app.js'

let envCtrl
let harness
let fetchBridge

beforeEach(() => {
  envCtrl = createEnvironmentController()
  process.env.NODE_ENV = 'test'
  envCtrl.resetRuntime()
  harness = installSupabaseHarness()
  installBrowserStubs()
  fetchBridge = installFetchBridge({ app: createApp() })
  envCtrl.onCleanup(() => fetchBridge.restore())
})

afterEach(() => {
  vi.restoreAllMocks()
  envCtrl.restore()
})

describe('Tier 3 — Cross-Feature Pairwise Integration (20 Flows)', () => {
  it('1. Quick Entry -> Transaction -> Wallet balance -> Budget progress -> SafeToSpend -> Notification sync (warning vs exceeded)', async () => {
    const today = new Date()
    const month = today.getMonth() + 1
    const year = today.getFullYear()
    const daysLeft = getRemainingDaysInMonth(today)

    const { data: momo } = await createWallet({ name: 'Ví MoMo', type: 'ewallet', balance: 2000000 })
    const { data: cats } = await getCategories()
    const foodCat = cats.find((c) => c.name === 'Ăn uống')
    const moveCat = cats.find((c) => c.name === 'Di chuyển')

    await setBudget({ category_id: foodCat.id, month, year, amount_limit: 500000 })
    await setBudget({ category_id: moveCat.id, month, year, amount_limit: 500000 })

    // 1) Quick Entry expense pushing Ăn uống to 85% (warning)
    const parsed1 = parseQuickEntry('cafe 425k hôm nay momo', { categories: cats, wallets: [momo], now: today })
    const matchedW1 = resolveQuickWallet([momo], parsed1.walletKeyword)
    const matchedC1 = cats.find((c) => c.type === parsed1.type && c.name === parsed1.categoryName)
    await createTransaction({
      wallet_id: matchedW1.id,
      category_id: matchedC1.id,
      type: parsed1.type,
      amount: parsed1.amount,
      transaction_date: parsed1.date,
      note: parsed1.rawText,
    })

    // 2) Quick Entry expense pushing Di chuyển to 120% (exceeded)
    const parsed2 = parseQuickEntry('đổ xăng 600k hôm nay momo', { categories: cats, wallets: [momo], now: today })
    const matchedC2 = cats.find((c) => c.type === parsed2.type && c.name === parsed2.categoryName)
    await createTransaction({
      wallet_id: matchedW1.id,
      category_id: matchedC2.id,
      type: parsed2.type,
      amount: parsed2.amount,
      transaction_date: parsed2.date,
      note: parsed2.rawText,
    })

    const walletsAfter = await getWallets()
    expect(walletsAfter.data[0].balance).toBe(975000)

    const progress = await getBudgetProgress(month, year)
    expect(progress.totalBudget).toBe(1000000)
    expect(progress.totalSpent).toBe(1025000)
    expect(progress.overall_status).toBe('exceeded')

    const sts = await calculateSafeToSpend(today)
    expect(sts.safeToSpendToday).toBe(0)
    expect(sts.remainingBudget).toBe(-25000)
    expect(sts.daysLeft).toBe(daysLeft)

    const notiSync = await checkAndGenerateNotifications({ daysAhead: 3 })
    expect(notiSync.error).toBeNull()
    expect(notiSync.data.budget_warning).toBe(1)
    expect(notiSync.data.budget_exceeded).toBe(1)
  })

  it('2. Quick Entry transfer ("chuyển 500k từ vcb sang momo") -> transferFunds -> Report income/expense exclusion', async () => {
    const today = new Date()
    const { data: vcb } = await createWallet({ name: 'Vietcombank', type: 'bank', balance: 3000000 })
    const { data: momo } = await createWallet({ name: 'Ví MoMo', type: 'ewallet', balance: 200000 })
    const wallets = [vcb, momo]

    const parsed = parseQuickEntry('chuyển 500k từ vcb sang momo', { wallets, now: today })
    expect(parsed.type).toBe('transfer')
    const fromW = resolveQuickWallet(wallets, parsed.walletKeyword)
    const toW = resolveQuickWallet(wallets, parsed.toWalletKeyword)

    const xfer = await transferFunds({
      fromWalletId: fromW.id,
      toWalletId: toW.id,
      amount: parsed.amount,
      date: parsed.date,
      note: parsed.rawText,
    })
    expect(xfer.error).toBeNull()
    expect(xfer.data.fromWalletBalance).toBe(2500000)
    expect(xfer.data.toWalletBalance).toBe(700000)

    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-31`
    const summary = await getFinancialSummary(monthStart, monthEnd)
    expect(summary.totalIncome).toBe(0)
    expect(summary.totalExpense).toBe(0)
  })

  it('3. DashboardPage <-> QuickEntryParser contract parity & UC19 editable Preview modal (no silent wallets[0])', () => {
    const dashSrc = fs.readFileSync(getRepoPath('src/pages/DashboardPage.jsx'), 'utf8')
    expect(dashSrc).toContain('parsedData.walletKeyword')
    expect(dashSrc).toContain('parsedData.categoryName')
    expect(dashSrc).toContain('parsedData.rawText')
    expect(dashSrc).toContain('resolveQuickWallet')
    expect(dashSrc).not.toMatch(/\?\s*resolveQuickWallet\(wallets,\s*parsedData\.walletKeyword\)\s*:\s*wallets\[0\]/)
    expect(dashSrc).toMatch(/border-amber-|ring-amber-|bg-amber-/)
  })

  it('4. Custom category keywords -> parseQuickEntry -> createTransaction -> getCategoryExpenseBreakdown', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 1500000 })
    const { data: petCat } = await createCategory({
      name: 'Chăm sóc thú cưng',
      type: 'expense',
      keywords: 'pate mèo, cát vệ sinh',
      color: '#10B981',
    })
    const { data: cats } = await getCategories()

    const parsed = parseQuickEntry('mua pate mèo 180k hôm nay tiền mặt', {
      categories: cats,
      wallets: [cash],
      now: new Date('2026-11-26T05:00:00Z'),
    })
    expect(parsed.categoryName).toBe('Chăm sóc thú cưng')
    expect(parsed.amount).toBe(180000)

    await createTransaction({
      wallet_id: cash.id,
      category_id: petCat.id,
      type: 'expense',
      amount: parsed.amount,
      transaction_date: parsed.date,
      note: parsed.rawText,
    })

    const breakdown = await getCategoryExpenseBreakdown(11, 2026)
    expect(breakdown.labels).toContain('Chăm sóc thú cưng')
    expect(breakdown.rawData.find((d) => d.id === petCat.id).total).toBe(180000)
  })

  it('5. Recurring rule -> checkAndGenerateRecurringTransactions -> Transaction -> Budget -> SafeToSpend', async () => {
    const today = new Date()
    const month = today.getMonth() + 1
    const year = today.getFullYear()
    const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const daysLeft = getRemainingDaysInMonth(today)

    const { data: bank } = await createWallet({ name: 'Vietcombank', type: 'bank', balance: 10000000 })
    const billCat = harness.db.categories.find((c) => c.name === 'Hóa đơn & Tiện ích')
    await setBudget({ category_id: billCat.id, month, year, amount_limit: 4000000 })

    await createRecurringRule({
      wallet_id: bank.id,
      category_id: billCat.id,
      title: 'Tiền phòng trọ',
      type: 'expense',
      amount: 2500000,
      frequency: 'monthly',
      next_due_date: todayStr,
    })

    const gen = await checkAndGenerateRecurringTransactions()
    expect(gen.data.generatedCount).toBe(1)

    const wallets = await getWallets()
    expect(wallets.data[0].balance).toBe(7500000)

    const sts = await calculateSafeToSpend(today)
    expect(sts.totalSpent).toBe(2500000)
    expect(sts.remainingBudget).toBe(1500000)
    expect(sts.upcomingRecurring).toBe(0)
    expect(sts.safeToSpendToday).toBe(Math.round(1500000 / daysLeft))
  })

  it('6. Saving Goal create -> partial deposit -> final deposit -> Wallet deduction & completed status', async () => {
    const { data: bank } = await createWallet({ name: 'Vietcombank', type: 'bank', balance: 8000000 })
    const { data: goal } = await createGoal({ name: 'Quỹ du lịch Đà Lạt', target_amount: 3000000, wallet_id: bank.id })

    const d1 = await depositToGoal({ goalId: goal.id, walletId: bank.id, amount: 1200000 })
    expect(d1.error).toBeNull()
    expect(d1.data.status).toBe('in_progress')
    expect(d1.data.current_amount).toBe(1200000)

    const d2 = await depositToGoal({ goalId: goal.id, walletId: bank.id, amount: 1800000 })
    expect(d2.error).toBeNull()
    expect(d2.data.status).toBe('completed')

    const wallets = await getWallets()
    expect(wallets.data[0].balance).toBe(5000000)
    const goals = await getGoals()
    expect(goals.data[0].current_amount).toBe(3000000)
  })

  it('7. SafeToSpend service falls back locally (not 0 ₫) when Express :5000 is unreachable (R3 #7)', async () => {
    fetchBridge.restore()
    const offlineBridge = installFetchBridge({ failApiConnection: true })
    envCtrl.onCleanup(() => offlineBridge.restore())

    const today = new Date()
    const month = today.getMonth() + 1
    const year = today.getFullYear()
    const daysLeft = getRemainingDaysInMonth(today)
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    await setBudget({ category_id: foodCat.id, month, year, amount_limit: 3000000 })

    const sts = await calculateSafeToSpend(today)
    expect(sts.error).toBeNull()
    expect(sts.calculationSource).toBe('local_fallback')
    expect(sts.safeToSpendToday).toBe(Math.round(3000000 / daysLeft))
  })

  it('8. AI Assistant: buildFinancialContext -> authenticated /api/ai/chat -> systemInstruction + client fallback when offline', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 4000000 })
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    const today = new Date()
    await setBudget({ category_id: foodCat.id, month: today.getMonth() + 1, year: today.getFullYear(), amount_limit: 2000000 })
    await createTransaction({ wallet_id: cash.id, category_id: foodCat.id, type: 'expense', amount: 500000, note: 'Tiệc' })

    const ctx = await buildFinancialContext()
    expect(ctx.tong_so_du_vi).toBe(3500000)
    expect(ctx.ngan_sach_thang[0].da_chi).toBe(500000)

    process.env.GEMINI_API_KEY = 'AQ.ValidNonAizaKeyForE2E'
    let capturedSystemInstruction = ''
    globalThis.__SPENDWISE_E2E_GEMINI__ = (_key, opts) => {
      capturedSystemInstruction = opts.systemInstruction
      return {
        generateContent: async () => ({
          response: { text: () => 'Bạn đã chi 500.000 VNĐ cho Ăn uống.' },
        }),
      }
    }

    const aiRes = await askGeminiAssistant('Tháng này tôi đã chi bao nhiêu cho Ăn uống?')
    expect(aiRes.source).toBe('gemini_backend')
    expect(capturedSystemInstruction).toContain('500000')

    // Now simulate server down -> client_fallback
    fetchBridge.restore()
    const offlineBridge = installFetchBridge({ failApiConnection: true })
    envCtrl.onCleanup(() => offlineBridge.restore())

    const fallbackRes = await askGeminiAssistant('Tháng này tôi đã chi bao nhiêu cho Ăn uống?')
    expect(fallbackRes.source).toBe('client_fallback')
    expect(fallbackRes.reply).toContain('500.000 VNĐ')
  })

  it('9. BillSplitVietQR -> splitBill tipPercent cap (50%) + copied auto-reset & memo edit reset -> generateVietQrUrl', () => {
    const split = splitBill({ totalAmount: 600000, numberOfPeople: 4, tipPercent: 80 })
    expect(split.tipAmount).toBe(300000) // capped at 50%
    expect(split.amountPerPerson).toBe(225000)

    const url = generateVietQrUrl({
      bankBin: '970436',
      bankAccount: '0123456789',
      amount: split.amountPerPerson,
      memo: 'Chia tien team',
    })
    expect(url).toContain('amount=225000')
    expect(url).toContain('addInfo=Chia+tien+team')

    const src = fs.readFileSync(getRepoPath('src/pages/BillSplitVietQR.jsx'), 'utf8')
    expect(src).toMatch(/Math\.min\(\s*50/)
    expect(src).toMatch(/setCopied\(false\)/)
  })

  it('10. ResetPasswordPage pre-mount PKCE/recovery session handling (getSession + INITIAL_SESSION + exchangeCodeForSession)', () => {
    const src = fs.readFileSync(getRepoPath('src/pages/ResetPasswordPage.jsx'), 'utf8')
    expect(src).toContain("event === 'PASSWORD_RECOVERY'")
    expect(src).toContain("event === 'INITIAL_SESSION'")
    expect(src).toContain('supabase.auth.getSession()')
    expect(src).toContain('supabase.auth.exchangeCodeForSession(code)')
  })

  it('11. ThemeContext + index.html pre-paint script + Auth pages & Navbar theme integration (R5 #21)', async () => {
    const darkPrePaint = runIndexPrePaintThemeScript({ savedTheme: 'dark', prefersDark: false })
    expect(darkPrePaint.hasScript).toBe(true)
    expect(darkPrePaint.isDark).toBe(true)

    const lightOverridePrePaint = runIndexPrePaintThemeScript({ savedTheme: 'light', prefersDark: true })
    expect(lightOverridePrePaint.isDark).toBe(false)

    const systemDarkPrePaint = runIndexPrePaintThemeScript({ savedTheme: null, prefersDark: true })
    expect(systemDarkPrePaint.isDark).toBe(true)

    const { ThemeProvider } = await import('@/context/ThemeContext')
    const { useTheme } = await import('@/context/useTheme')
    function ThemeProbe() {
      const { theme, isDark } = useTheme()
      return React.createElement('div', null, `${theme}:${String(isDark)}`)
    }
    const html = renderWithRouter(
      React.createElement(ThemeProvider, null, React.createElement(ThemeProbe))
    )
    expect(html).toMatch(/light:false|dark:true/)

    // Navbar renders Theme toggle control inside ThemeProvider
    const navHtml = renderWithRouter(
      React.createElement(ThemeProvider, null, React.createElement(Navbar)),
      { route: '/' }
    )
    expect(navHtml).toMatch(/Chuyển sang giao diện (tối|sáng)/)

    // PublicLayout in App.jsx wraps all 4 auth pages with useTheme() toggle + auth pages render Double-Bezel dark-ready UI
    const appSrc = fs.readFileSync(getRepoPath('src/App.jsx'), 'utf8')
    expect(appSrc).toContain('function PublicLayout()')
    expect(appSrc).toContain('useTheme()')
    for (const authRoute of ['/login', '/register', '/forgot-password', '/reset-password']) {
      expect(appSrc).toContain(authRoute)
    }

    for (const AuthComp of [LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage]) {
      const authHtml = renderWithRouter(
        React.createElement(ThemeProvider, null, React.createElement(AuthComp))
      )
      expect(authHtml).toContain('rounded-[2rem]')
      expect(authHtml).toContain('dark:')
    }
  })

  it('12. transactionService atomic RPCs vs PGRST202 fallback with rollback & user_id scoping (R3 #9)', async () => {
    // RPC path first
    const { data: w } = await createWallet({ name: 'Ví Chính', type: 'bank', balance: 1000000 })
    const rpcCreate = await createTransaction({ wallet_id: w.id, type: 'expense', amount: 100000, note: 'RPC path' })
    expect(rpcCreate.error).toBeNull()
    expect(harness.state.rpcCalls.map((c) => c.name)).toContain('create_transaction_atomic')

    await updateTransaction(rpcCreate.data.id, { amount: 200000 })
    expect(harness.state.rpcCalls.map((c) => c.name)).toContain('update_transaction_atomic')

    await deleteTransaction(rpcCreate.data.id)
    expect(harness.state.rpcCalls.map((c) => c.name)).toContain('delete_transaction_atomic')

    // Now PGRST202 fallback + rollback if wallet update fails
    harness.state.rpcMissing = true
    harness.state.injectedErrors.set('wallets:update', new Error('Simulated DB write failure'))
    const failedFallback = await createTransaction({ wallet_id: w.id, type: 'expense', amount: 50000, note: 'Should rollback' })
    expect(failedFallback.error).toBeTruthy()
    expect(harness.db.transactions).toHaveLength(0)
    expect(harness.db.wallets.find((item) => item.id === w.id).balance).toBe(1000000)
  })

  it('13. walletService.transferFunds PGRST202 fallback executes compensating rollback when second leg fails', async () => {
    harness.state.rpcMissing = true
    const { data: w1 } = await createWallet({ name: 'VCB', type: 'bank', balance: 1000000 })
    const { data: w2 } = await createWallet({ name: 'MoMo', type: 'ewallet', balance: 200000 })

    let walletUpdateCalls = 0
    harness.state.injectedErrors.set('wallets:update', () => {
      walletUpdateCalls += 1
      if (walletUpdateCalls === 2) return new Error('Leg 2 failure')
      return null
    })

    const res = await transferFunds({ fromWalletId: w1.id, toWalletId: w2.id, amount: 300000 })
    expect(res.error).toBeTruthy()
    expect(harness.db.wallets.find((w) => w.id === w1.id).balance).toBe(1000000)
    expect(harness.db.wallets.find((w) => w.id === w2.id).balance).toBe(200000)
  })

  it('14. Client parseQuickEntry and Server parseQuickEntryServer maintain 100% UTC+7 parity across corpus', async () => {
    const corpus = [
      'cafe 35k hôm qua momo',
      'nhận lương 15tr vcb',
      'trà sữa 35.5k 15/11/26',
      'chuyển 500k từ vcb sang momo',
      'bệnh viện 200k',
      'combo 50k',
      'cafe 35k 31/02',
    ]
    const now = new Date('2026-11-26T17:30:00Z') // 2026-11-27 00:30+07:00
    for (const input of corpus) {
      const clientParsed = parseQuickEntry(input, { now })
      const serverParsed = parseQuickEntryServer(input, { now })
      expect(clientParsed).toEqual(serverParsed)
    }

    const apiRes = await request(createApp())
      .post('/api/quick-entry/parse')
      .send({ text: 'cafe 35.5k hôm qua momo' })
      .expect(200)
    expect(apiRes.body.data.amount).toBe(35500)
  })

  it('15. Recurring & Notification services degrade safely to read-only inspection on PGRST202', async () => {
    vi.resetModules()
    harness.state.rpcMissing = true
    const { data: w } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 1000000 })
    const cat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    const today = todayVietnamDate()

    const recMod = await import('@/services/recurringService')
    const notiMod = await import('@/services/notificationService')

    await recMod.createRecurringRule({
      wallet_id: w.id,
      category_id: cat.id,
      title: 'Cơm trưa',
      type: 'expense',
      amount: 50000,
      frequency: 'daily',
      next_due_date: today,
    })

    const recFallback = await recMod.checkAndGenerateRecurringTransactions()
    expect(recFallback.error).toBeNull()
    expect(recFallback.data.degraded).toBe(true)
    expect(recFallback.data.pendingCount).toBe(1)
    expect(recFallback.data.generatedCount).toBe(0)

    const notiFallback = await notiMod.checkAndGenerateNotifications({ daysAhead: 3 })
    expect(notiFallback.error).toBeNull()
    expect(notiFallback.data.degraded).toBe(true)
    expect(notiFallback.data.recurring_due).toBe(1)

    const mergedList = await notiMod.getNotifications()
    expect(mergedList.data.some((n) => n.is_virtual === true)).toBe(true)
    vi.resetModules()
  })

  it('16. Mobile BottomNav & AppLayout use SPA navigation (no window.location.href reload) & expose /categories drawer', () => {
    const appLayoutSrc = fs.readFileSync(getRepoPath('src/components/layout/AppLayout.jsx'), 'utf8')
    expect(appLayoutSrc).not.toContain('window.location.href')
    expect(appLayoutSrc).toContain("navigate('/#quick-entry')")

    const bottomNavSrc = fs.readFileSync(getRepoPath('src/components/layout/BottomNav.jsx'), 'utf8')
    for (const path of ['/categories', '/reports', '/goals', '/recurring', '/bill-split', '/profile']) {
      expect(bottomNavSrc).toContain(path)
    }
  })

  it('17. sw.js serves Network-First HTML offline fallback & bypasses /api/ + external APIs', async () => {
    let online = true
    const sw = runSwInVm({
      fetchImpl: async () => {
        if (!online) throw new Error('Network offline')
        return new Response('<html>fresh</html>', { status: 200, headers: { 'content-type': 'text/html' } })
      },
    })
    await sw.dispatchLifecycle('install')
    await sw.dispatchLifecycle('activate')

    const onlineRes = await sw.dispatchFetch({ url: 'http://localhost:5173/budgets', mode: 'navigate', accept: 'text/html' })
    expect(onlineRes.intercepted).toBe(true)
    expect(await onlineRes.response.text()).toBe('<html>fresh</html>')

    online = false
    const offlineRes = await sw.dispatchFetch({ url: 'http://localhost:5173/budgets', mode: 'navigate', accept: 'text/html' })
    expect(offlineRes.intercepted).toBe(true)
    expect(await offlineRes.response.text()).toBe('<html>fresh</html>')

    const apiBypass = await sw.dispatchFetch({ url: 'http://localhost:5173/api/finance/health', method: 'GET' })
    expect(apiBypass.intercepted).toBe(false)
  })

  it('18. Budget > 100% progress + Notification sync + NotificationBell SSR badge consistency', async () => {
    const today = new Date()
    const month = today.getMonth() + 1
    const year = today.getFullYear()
    const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 5000000 })
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')

    await setBudget({ category_id: foodCat.id, month, year, amount_limit: 500000 })
    await createTransaction({ wallet_id: cash.id, category_id: foodCat.id, type: 'expense', amount: 750000, transaction_date: todayStr, note: 'Over' })

    const syncRes = await checkAndGenerateNotifications({ daysAhead: 3 })
    expect(syncRes.data.budget_exceeded).toBe(1)
    expect(syncRes.data.budget_warning).toBe(0)

    const notis = await getNotifications()
    expect(notis.data[0].type).toBe('budget_exceeded')
    const unread = await getUnreadCount()
    expect(unread.count).toBe(1)

    const bellHtml = renderWithRouter(React.createElement(NotificationBell))
    expect(bellHtml).toContain('aria-label="Thông báo"')
    expect(bellHtml).toContain('aria-haspopup="dialog"')
  })

  it('19. ErrorBoundary + App.jsx Suspense + 15 React.lazy routes wrap protected and public views', async () => {
    const appSrc = fs.readFileSync(getRepoPath('src/App.jsx'), 'utf8')
    expect(appSrc).toContain('ErrorBoundary')
    expect(appSrc).toContain('Suspense')
    const lazyMatches = appSrc.match(/lazy\(\(\)\s*=>\s*import\(/g) || []
    expect(lazyMatches.length).toBeGreaterThanOrEqual(15)

    const { ErrorBoundary } = await import('@/components/common/ErrorBoundary')
    function OkChild() {
      return React.createElement('p', null, 'App Route Rendered')
    }
    const html = renderWithRouter(
      React.createElement(ErrorBoundary, null, React.createElement(OkChild))
    )
    expect(html).toContain('App Route Rendered')
  })

  it('20. Profile default_bank_bin & default_bank_account integrate cleanly into BillSplitVietQR URL generation', async () => {
    const { data: prof } = await updateProfile(TEST_USER_A_ID, {
      full_name: 'Trương Bích Vân',
      default_bank_bin: '970422',
      default_bank_account: '0987654321',
    })
    const split = splitBill({ totalAmount: 450000, numberOfPeople: 3, tipPercent: 10 })
    const url = generateVietQrUrl({
      bankBin: prof.default_bank_bin,
      bankAccount: prof.default_bank_account,
      amount: split.amountPerPerson,
      memo: 'Thanh toan bua toi',
      accountName: prof.full_name,
    })
    expect(url).toContain('970422-0987654321-compact.png')
    expect(url).toContain('amount=165000')
  })
})
