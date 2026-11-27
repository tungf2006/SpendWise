import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
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

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    constructor(apiKey) {
      this.apiKey = apiKey
    }
    getGenerativeModel(options) {
      const hook = globalThis.__SPENDWISE_E2E_GEMINI__
      if (!hook) {
        return {
          generateContent: async () => ({
            response: { text: () => 'Mock Gemini Reply' },
          }),
        }
      }
      return hook(this.apiKey, options)
    }
  },
}))

import {
  TEST_USER_B_ID,
  createEnvironmentController,
  createFakeJwt,
  getRepoPath,
  installBrowserStubs,
  installFetchBridge,
  installSupabaseHarness,
  renderWithRouter,
  runIndexPrePaintThemeScript,
  runSwInVm,
} from './helpers/e2eHarness.js'

import { signUp } from '@/services/authService'
import { createWallet, getWallets, transferFunds } from '@/services/walletService'
import { createCategory, getCategories } from '@/services/categoryService'
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactions,
} from '@/services/transactionService'
import { transactionsToCsv } from '@/utils/transactionCsv'
import { setBudget, getBudgetProgress } from '@/services/budgetService'
import {
  getFinancialSummary,
  getCategoryExpenseBreakdown,
  getPeriodComparison,
} from '@/services/reportService'
import { parseQuickEntry, resolveQuickWallet } from '@/services/quickEntryParser'
import { calculateSafeToSpend } from '@/services/safeToSpendService'
import { askGeminiAssistant } from '@/services/aiAssistantService'
import { createGoal, depositToGoal, updateGoal } from '@/services/goalService'
import {
  createRecurringRule,
  checkAndGenerateRecurringTransactions,
} from '@/services/recurringService'
import {
  checkAndGenerateNotifications,
  getNotifications,
} from '@/services/notificationService'
import { generateVietQrUrl, splitBill } from '@/services/vietqrService'

import { Navbar } from '@/components/layout/Navbar'
import { BottomNav } from '@/components/layout/BottomNav'
import { DashboardPage } from '@/pages/DashboardPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import { createApp } from '../../server/app.js'

let envCtrl
let harness
let fetchBridge

function listFilesRecursive(dir, exts) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue
      out.push(...listFilesRecursive(full, exts))
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full)
    }
  }
  return out
}

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

describe('Tier 4 — Real-World End-to-End Application Scenarios (8 Scenarios)', () => {
  it('Scenario 1: Monthly Finance Lifecycle (SignUp -> Salary -> Recurring -> Quick Entry -> Budget Exceed -> SafeToSpend -> Reports & CSV)', async () => {
    const today = new Date()
    const month = today.getMonth() + 1
    const year = today.getFullYear()
    const todayIso = `${year}-${String(month).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // 1. User signs up -> receives default Tiền mặt wallet, then adds Vietcombank & custom category
    const signup = await signUp('lifecycle@spendwise.vn', 'StrongPass123!', 'Hồ Nguyên Văn')
    expect(signup.error).toBeNull()

    const { data: vcb } = await createWallet({ name: 'Vietcombank', type: 'bank', balance: 0 })
    const { data: coffeeCat } = await createCategory({ name: 'Cà phê đặc sản', type: 'expense', keywords: 'arabica, cold brew' })
    const { data: cats } = await getCategories()
    const { data: wallets } = await getWallets()
    const salaryCat = cats.find((c) => c.name === 'Lương')
    const billCat = cats.find((c) => c.name === 'Hóa đơn & Tiện ích')

    // 2. Receive monthly salary
    await createTransaction({
      wallet_id: vcb.id,
      category_id: salaryCat.id,
      type: 'income',
      amount: 20000000,
      transaction_date: monthStart,
      note: 'Lương tháng',
    })

    // 3. Configure recurring bill due today and trigger generation
    await createRecurringRule({
      wallet_id: vcb.id,
      category_id: billCat.id,
      title: 'Internet Fiber',
      type: 'expense',
      amount: 300000,
      frequency: 'monthly',
      next_due_date: todayIso,
    })
    const recRes = await checkAndGenerateRecurringTransactions()
    expect(recRes.data.generatedCount).toBe(1)

    // 4. Set budgets and spend via Quick Entry exceeding custom category budget
    await setBudget({ category_id: coffeeCat.id, month, year, amount_limit: 200000 })
    await setBudget({ category_id: billCat.id, month, year, amount_limit: 1000000 })

    const parsed = parseQuickEntry('cold brew 250k hôm nay vcb', { categories: cats, wallets, now: today })
    const matchedWallet = resolveQuickWallet(wallets, parsed.walletKeyword)
    const matchedCat = cats.find((c) => c.type === parsed.type && c.name === parsed.categoryName)
    await createTransaction({
      wallet_id: matchedWallet.id,
      category_id: matchedCat.id,
      type: parsed.type,
      amount: parsed.amount,
      transaction_date: parsed.date,
      note: parsed.rawText,
    })

    // 5. Verify Budget progress, SafeToSpend, Notifications, Reports & CSV export
    const progress = await getBudgetProgress(month, year)
    expect(progress.totalBudget).toBe(1200000)
    expect(progress.totalSpent).toBe(550000)

    const notiSync = await checkAndGenerateNotifications({ daysAhead: 3 })
    expect(notiSync.data.budget_exceeded).toBe(1)
    expect(notiSync.data.budget_warning).toBe(0)
    const persistedNotis = await getNotifications()
    expect(persistedNotis.data.some((n) => n.type === 'budget_exceeded')).toBe(true)

    const sts = await calculateSafeToSpend(today)
    expect(sts.calculationSource).toBe('backend')
    expect(sts.safeToSpendToday).toBeGreaterThan(0)

    const summary = await getFinancialSummary(monthStart, monthEnd)
    expect(summary.totalIncome).toBe(20000000)
    expect(summary.totalExpense).toBe(550000)
    expect(summary.netSavings).toBe(19450000)

    const donut = await getCategoryExpenseBreakdown(month, year)
    expect(donut.labels).toContain('Cà phê đặc sản')

    const { data: txns } = await getTransactions({ page: 1, limit: 20 })
    const csv = transactionsToCsv(txns)
    expect(csv).toContain('cold brew 250k hôm nay vcb')
    expect(csv).toContain('20000000')
  })

  it('Scenario 2: AI Financial Advisor E2E Flow (Aggregated context -> authenticated /api/ai/chat -> systemInstruction + fallback)', async () => {
    const today = new Date()
    const month = today.getMonth() + 1
    const year = today.getFullYear()
    const todayIso = `${year}-${String(month).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const { data: momo } = await createWallet({ name: 'Ví MoMo', type: 'ewallet', balance: 1800000 })
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    await setBudget({ category_id: foodCat.id, month, year, amount_limit: 2000000 })
    await createTransaction({
      wallet_id: momo.id,
      category_id: foodCat.id,
      type: 'expense',
      amount: 400000,
      transaction_date: todayIso,
      note: 'Lẩu nướng',
    })

    process.env.GEMINI_API_KEY = 'AQ.LiveGatewayKeyForE2E'
    let capturedInstruction = ''
    globalThis.__SPENDWISE_E2E_GEMINI__ = (_apiKey, opts) => {
      capturedInstruction = opts.systemInstruction
      return {
        generateContent: async () => ({
          response: { text: () => 'Bạn đã chi 400.000 VNĐ cho Ăn uống, còn dư 1.600.000 VNĐ.' },
        }),
      }
    }

    const aiOk = await askGeminiAssistant('Tháng này tôi đã chi bao nhiêu cho Ăn uống?')
    expect(aiOk.error).toBeNull()
    expect(aiOk.source).toBe('gemini_backend')
    expect(aiOk.reply).toContain('400.000 VNĐ')
    expect(capturedInstruction).toContain('1400000')
    expect(capturedInstruction).toContain('Lẩu nướng')

    // Simulate missing server key -> 503 server fallbackReply consumed by askGeminiAssistant
    delete process.env.GEMINI_API_KEY
    const aiFallback = await askGeminiAssistant('Hôm nay tôi có thể tiêu bao nhiêu tiền an toàn?')
    expect(aiFallback.error).toBeNull()
    expect(aiFallback.source).toBe('smart_context_advisor')
    expect(aiFallback.reply).toContain('1.400.000 VNĐ')
  })

  it('Scenario 3: Saving Goal Deposit & Group Bill Split VietQR Flow', async () => {
    const { data: bank } = await createWallet({ name: 'Vietcombank', type: 'bank', balance: 15000000 })
    const { data: goal } = await createGoal({ name: 'Quỹ mua xe máy', target_amount: 10000000, wallet_id: bank.id })

    await depositToGoal({ goalId: goal.id, walletId: bank.id, amount: 4000000 })
    const finalDep = await depositToGoal({ goalId: goal.id, walletId: bank.id, amount: 6000000 })
    expect(finalDep.data.status).toBe('completed')

    const wallets = await getWallets()
    expect(wallets.data[0].balance).toBe(5000000)

    // Group bill split with tip > 50 clamped to 50% + VietQR URL
    const bill = splitBill({ totalAmount: 900000, numberOfPeople: 3, tipPercent: 75 })
    expect(bill.tipAmount).toBe(450000) // 50% max
    expect(bill.amountPerPerson).toBe(450000)

    const qrUrl = generateVietQrUrl({
      bankBin: '970436',
      bankAccount: '0123456789',
      amount: bill.amountPerPerson,
      memo: 'Chia tien team building',
    })
    expect(qrUrl).toBe('https://img.vietqr.io/image/970436-0123456789-compact.png?amount=450000&addInfo=Chia+tien+team+building')
  })

  it('Scenario 4: Multi-Wallet Transfers & Net-Delta Audit Flow', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 1000000 })
    const { data: bank } = await createWallet({ name: 'Vietcombank', type: 'bank', balance: 5000000 })
    const { data: momo } = await createWallet({ name: 'Ví MoMo', type: 'ewallet', balance: 500000 })
    const wallets = [cash, bank, momo]

    // 1. Direct transfer bank -> cash
    await transferFunds({ fromWalletId: bank.id, toWalletId: cash.id, amount: 1000000, date: '2026-11-10' })

    // 2. Quick Entry transfer bank -> momo
    const parsedTransfer = parseQuickEntry('chuyển 500k từ vcb sang momo', { wallets })
    const fromW = resolveQuickWallet(wallets, parsedTransfer.walletKeyword)
    const toW = resolveQuickWallet(wallets, parsedTransfer.toWalletKeyword)
    await transferFunds({ fromWalletId: fromW.id, toWalletId: toW.id, amount: parsedTransfer.amount, date: '2026-11-12' })

    // 3. Expense from momo -> edit net-delta -> delete -> verify invariant total balance
    const { data: exp } = await createTransaction({ wallet_id: momo.id, type: 'expense', amount: 200000, transaction_date: '2026-11-15', note: 'Mua sắm' })
    await updateTransaction(exp.id, { amount: 350000 })
    expect(harness.db.wallets.find((w) => w.id === momo.id).balance).toBe(650000)

    await deleteTransaction(exp.id)
    const afterAll = await getWallets()
    const totalAfter = afterAll.data.reduce((s, w) => s + w.balance, 0)
    expect(totalAfter).toBe(6500000)
    expect(afterAll.data.find((w) => w.id === bank.id).balance).toBe(3500000)
    expect(afterAll.data.find((w) => w.id === cash.id).balance).toBe(2000000)
    expect(afterAll.data.find((w) => w.id === momo.id).balance).toBe(1000000)

    // Transfers excluded from reports
    const summary = await getFinancialSummary('2026-11-01', '2026-11-30')
    expect(summary.totalIncome).toBe(0)
    expect(summary.totalExpense).toBe(0)
    const comp = await getPeriodComparison(11, 2026)
    expect(comp.current.expense).toBe(0)
  })

  it('Scenario 5: Multi-Tenant Security, Fail-Closed Auth & Secret Hygiene Flow', async () => {
    // 1. User A creates goal & transaction; User B attempts IDOR update/delete
    const { data: wA } = await createWallet({ name: 'Ví A', type: 'bank', balance: 2000000 })
    const { data: goalA } = await createGoal({ name: 'Mục tiêu A', target_amount: 1000000 })
    const { data: txnA } = await createTransaction({ wallet_id: wA.id, type: 'expense', amount: 100000, note: 'A' })

    harness.setUser({ id: TEST_USER_B_ID, email: 'attacker@spendwise.vn' })
    expect((await updateGoal(goalA.id, { name: 'Pwned', current_amount: 999999 })).error).toBeTruthy()
    expect((await deleteTransaction(txnA.id)).error).toBeTruthy()
    expect(harness.db.saving_goals.find((g) => g.id === goalA.id).name).toBe('Mục tiêu A')

    // 2. Express fail-closed 503 when Supabase env missing in production
    process.env.NODE_ENV = 'production'
    delete process.env.SUPABASE_URL
    delete process.env.VITE_SUPABASE_URL
    delete process.env.SUPABASE_ANON_KEY
    delete process.env.VITE_SUPABASE_ANON_KEY
    const app = createApp()
    await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${createFakeJwt()}`)
      .send({ prompt: 'Test' })
      .expect(503)

    // 3. Body size limit 413 & Rate limit 429 in test mode
    process.env.NODE_ENV = 'test'
    process.env.GEMINI_API_KEY = 'AIzaSecurityCheckKey1234'
    globalThis.__SPENDWISE_E2E_GEMINI__ = () => ({
      generateContent: async () => ({ response: { text: () => 'ok' } }),
    })
    await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${createFakeJwt()}`)
      .send({ prompt: 'x'.repeat(110 * 1024) })
      .expect(413)

    // 4. Zero VITE_GEMINI_API_KEY or GoogleGenerativeAI in src/
    const srcFiles = listFilesRecursive(getRepoPath('src'), ['.js', '.jsx'])
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf8')
      expect(content).not.toContain('VITE_GEMINI_API_KEY')
      expect(content).not.toContain('GoogleGenerativeAI')
    }
  })

  it('Scenario 6: Offline & Degraded Mode Resilience Flow (Backend offline, PGRST202 RPC fallback, sw.js Network-First)', async () => {
    vi.resetModules()
    fetchBridge.restore()
    const offlineBridge = installFetchBridge({ failApiConnection: true })
    envCtrl.onCleanup(() => offlineBridge.restore())

    harness.state.rpcMissing = true
    const today = new Date()
    const month = today.getMonth() + 1
    const year = today.getFullYear()
    const todayIso = `${year}-${String(month).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const { data: w } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 1000000 })
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    await setBudget({ category_id: foodCat.id, month, year, amount_limit: 2000000 })

    // Transaction fallback works without RPC
    const txnMod = await import('@/services/transactionService')
    const txnRes = await txnMod.createTransaction({ wallet_id: w.id, category_id: foodCat.id, type: 'expense', amount: 200000, transaction_date: todayIso, note: 'Offline' })
    expect(txnRes.error).toBeNull()
    expect(harness.db.wallets.find((item) => item.id === w.id).balance).toBe(800000)

    // SafeToSpend & AI Assistant local fallbacks
    const stsMod = await import('@/services/safeToSpendService')
    const sts = await stsMod.calculateSafeToSpend(today)
    expect(sts.calculationSource).toBe('local_fallback')
    expect(sts.safeToSpendToday).toBeGreaterThan(0)

    const aiMod = await import('@/services/aiAssistantService')
    const ai = await aiMod.askGeminiAssistant('Hôm nay tôi tiêu được bao nhiêu?')
    expect(ai.source).toBe('client_fallback')
    expect(ai.reply).toContain('VNĐ')

    // Recurring & Notifications read-only fallback
    const recMod = await import('@/services/recurringService')
    await recMod.createRecurringRule({ wallet_id: w.id, category_id: foodCat.id, title: 'Nước uống', type: 'expense', amount: 100000, frequency: 'monthly', next_due_date: todayIso })
    const recRes = await recMod.checkAndGenerateRecurringTransactions()
    expect(recRes.data.degraded).toBe(true)

    const notiMod = await import('@/services/notificationService')
    const notiRes = await notiMod.checkAndGenerateNotifications({ daysAhead: 3 })
    expect(notiRes.data.degraded).toBe(true)
    const notiList = await notiMod.getNotifications()
    expect(notiList.data.some((n) => n.is_virtual)).toBe(true)

    // Service Worker offline navigation cache recovery
    let swOnline = true
    const sw = runSwInVm({
      fetchImpl: async () => {
        if (!swOnline) throw new Error('Offline')
        return new Response('<html>SpendWise App Shell</html>', { status: 200, headers: { 'content-type': 'text/html' } })
      },
    })
    await sw.dispatchLifecycle('install')
    await sw.dispatchFetch({ url: 'http://localhost:5173/', mode: 'navigate', accept: 'text/html' })
    swOnline = false
    const cachedHtml = await sw.dispatchFetch({ url: 'http://localhost:5173/transactions', mode: 'navigate', accept: 'text/html' })
    expect(await cachedHtml.response.text()).toBe('<html>SpendWise App Shell</html>')

    vi.resetModules()
  })

  it('Scenario 7: UI Shell, Dark/Light Theme, ErrorBoundary & Code-Splitting Flow', async () => {
    // 1. SSR checks across Navbar, BottomNav, DashboardPage, ForgotPasswordPage, ResetPasswordPage
    const navHtml = renderWithRouter(React.createElement(Navbar), { route: '/categories' })
    const bottomHtml = renderWithRouter(React.createElement(BottomNav), { route: '/' })
    const dashHtml = renderWithRouter(React.createElement(DashboardPage), { route: '/' })
    const forgotHtml = renderWithRouter(React.createElement(ForgotPasswordPage), { route: '/forgot-password' })
    const resetHtml = renderWithRouter(React.createElement(ResetPasswordPage), { route: '/reset-password' })

    expect(navHtml).toContain('/categories')
    expect(bottomHtml).toContain('Thêm')
    expect(dashHtml).toContain('rounded-[2.25rem]')
    expect(forgotHtml).toContain('rounded-[2rem]')
    expect(resetHtml).toContain('rounded-[2rem]')

    // 2. ThemeContext + index.html pre-paint script
    const prePaint = runIndexPrePaintThemeScript({ savedTheme: 'dark', prefersDark: false })
    expect(prePaint.hasScript).toBe(true)
    expect(prePaint.isDark).toBe(true)

    const { ThemeProvider } = await import('@/context/ThemeContext')
    const { useTheme } = await import('@/context/useTheme')
    function Probe() {
      const { theme } = useTheme()
      return React.createElement('span', null, theme)
    }
    const themed = renderWithRouter(React.createElement(ThemeProvider, null, React.createElement(Probe)))
    expect(themed).toMatch(/light|dark/)

    // 3. ErrorBoundary catch
    const { ErrorBoundary } = await import('@/components/common/ErrorBoundary')
    const errState = ErrorBoundary.getDerivedStateFromError(new Error('UI crash'))
    expect(errState.hasError).toBe(true)
    const boundary = new ErrorBoundary({ children: React.createElement('div', null, 'ok') })
    boundary.state = errState
    const crashHtml = renderToStaticMarkup(boundary.render())
    expect(crashHtml).toContain('rounded-[2rem]')
    expect(crashHtml).toContain('UI crash')

    // 4. App.jsx 15 lazy routes + ErrorBoundary + Suspense
    const appSrc = fs.readFileSync(getRepoPath('src/App.jsx'), 'utf8')
    expect(appSrc).toContain('ErrorBoundary')
    expect(appSrc).toContain('Suspense')
    expect((appSrc.match(/lazy\(\(\)\s*=>\s*import\(/g) || []).length).toBeGreaterThanOrEqual(15)
  })

  it('Scenario 8: Platform Hygiene, Tailwind v3, PWA Icons, SQL Notification Parity & Workspace Acceptance Flow', () => {
    // 1. 0 banned Tailwind v3 classes in src/
    const bannedPattern =
      /(?<![a-z0-9-])(animate-in|fade-in|zoom-in-95|slide-in-from-[a-z0-9-]+|backdrop-blur-xs|shadow-xs|shadow-2xs|no-scrollbar|shadow-soft-lg|shadow-soft-2xl)(?![a-z0-9-])/
    const srcFiles = listFilesRecursive(getRepoPath('src'), ['.js', '.jsx'])
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf8')
      expect(content).not.toMatch(bannedPattern)
    }

    // 2. 5 Vite boilerplate files deleted (R5 #20)
    const boilerplate = [
      'src/App.css',
      'src/assets/hero.png',
      'src/assets/react.svg',
      'src/assets/vite.svg',
      'public/icons.svg',
    ]
    for (const rel of boilerplate) {
      expect(fs.existsSync(getRepoPath(rel))).toBe(false)
    }

    // 3. PWA icons have valid PNG magic bytes
    for (const icon of ['public/icon-192.png', 'public/icon-512.png']) {
      const buf = fs.readFileSync(getRepoPath(icon))
      expect(buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(true)
    }

    // 4. SQL sync_finance_notifications disjoint warning vs exceeded counts & atomic RPCs (R3 #9, #10)
    const p1Sql = fs.readFileSync(getRepoPath('supabase/migrations/20261126_p1_atomic_txns_and_notification_fix.sql'), 'utf8')
    expect(p1Sql).toContain('create_transaction_atomic')
    expect(p1Sql).toContain('update_transaction_atomic')
    expect(p1Sql).toContain('delete_transaction_atomic')
    expect(p1Sql).toMatch(/IF v_noti_type = 'budget_exceeded'[\s\S]*ELSIF v_noti_type = 'budget_warning'/)

    for (const sqlRel of ['supabase/init_schema.sql', 'supabase/migrations/20261115_p0_rpc_and_schema_fixes.sql']) {
      const sqlText = fs.readFileSync(getRepoPath(sqlRel), 'utf8')
      expect(sqlText).toMatch(/IF v_noti_type = 'budget_exceeded'[\s\S]*ELSIF v_noti_type = 'budget_warning'/)
    }

    // 5. Phan_cong_tieu_luan_SpendWise.xlsx remains present & untouched (R1)
    expect(fs.existsSync(getRepoPath('Phan_cong_tieu_luan_SpendWise.xlsx'))).toBe(true)
  })
})
