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
  TEST_USER_A_ID,
  createEnvironmentController,
  createFakeJwt,
  getRepoPath,
  installBrowserStubs,
  installFetchBridge,
  installSupabaseHarness,
  renderWithRouter,
  runSwInVm,
  todayVietnamDate,
} from './helpers/e2eHarness.js'

import {
  signUp,
  signIn,
  signOut,
  resetPasswordForEmail,
  getProfile,
  updateProfile,
  updatePassword,
} from '@/services/authService'
import {
  getWallets,
  createWallet,
  updateWallet,
  archiveWallet,
  deleteWallet,
  transferFunds,
} from '@/services/walletService'
import {
  normalizeKeywords,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/categoryService'
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  exportTransactionsCSV,
} from '@/services/transactionService'
import { transactionsToCsv } from '@/utils/transactionCsv'
import {
  BUDGET_THRESHOLDS,
  BUDGET_STATUSES,
  getBudgetStatus,
  calculateBudgetUsage,
  setBudget,
  getBudgets,
  updateBudget,
  deleteBudget,
  getBudgetProgress,
  getBudgetAlerts,
} from '@/services/budgetService'
import {
  getFinancialSummary,
  getCategoryExpenseBreakdown,
  getIncomeExpenseTrend,
  getPeriodComparison,
} from '@/services/reportService'
import {
  normalizeQuickText,
  resolveQuickWallet,
  parseQuickEntry,
} from '@/services/quickEntryParser'
import {
  getRemainingDaysInMonth,
  calculateSafeToSpendAmount,
  calculateSafeToSpend,
} from '@/services/safeToSpendService'
import {
  QUICK_REPLY_CHIPS,
  buildFinancialContext,
  askGeminiAssistant,
} from '@/services/aiAssistantService'
import {
  createGoal,
  getGoals,
  updateGoal,
  depositToGoal,
  deleteGoal,
} from '@/services/goalService'
import {
  createRecurringRule,
  getRecurringRules,
  toggleRuleActive,
  calculateNextDueDate,
  advanceRecurringRule,
  checkAndGenerateRecurringTransactions,
  deleteRecurringRule,
} from '@/services/recurringService'
import {
  NOTIFICATION_TYPES,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  clearReadNotifications,
  checkAndGenerateNotifications,
} from '@/services/notificationService'
import {
  POPULAR_BANKS,
  generateVietQrUrl,
  splitBill,
} from '@/services/vietqrService'

import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import { WalletPage } from '@/pages/WalletPage'
import { CategoryPage } from '@/pages/CategoryPage'
import { TransactionPage } from '@/pages/TransactionPage'
import { BudgetPage } from '@/pages/BudgetPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ReportPage } from '@/pages/ReportPage'
import { GoalPage } from '@/pages/GoalPage'
import RecurringPage from '@/pages/RecurringPage'
import { BillSplitVietQR } from '@/pages/BillSplitVietQR'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { Navbar } from '@/components/layout/Navbar'
import { BottomNav } from '@/components/layout/BottomNav'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { AiChatWidget } from '@/components/ai/AiChatWidget'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
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

// ============================================================================
// 1. AUTH (UC01–UC05) — 5 tests
// ============================================================================
describe('Tier 1 — Feature 1: AUTH (UC01–UC05)', () => {
  it('UC01: signUp registers new user and provisions default profile + Tiền mặt wallet', async () => {
    const { data, error } = await signUp('newuser@spendwise.vn', 'Secret123!', 'Trần Minh Anh')
    expect(error).toBeNull()
    expect(data.user.email).toBe('newuser@spendwise.vn')
    expect(data.session.access_token).toBeTruthy()

    const prof = await getProfile(data.user.id)
    expect(prof.data.full_name).toBe('Trần Minh Anh')

    const wallets = await getWallets()
    expect(wallets.data.some((w) => w.name === 'Tiền mặt')).toBe(true)
  })

  it('UC02 & UC03: signIn authenticates registered user and signOut clears session', async () => {
    await signUp('logincheck@spendwise.vn', 'Pass1234!', 'Lê Thanh')
    await signOut()
    const signedOutRes = await signIn('logincheck@spendwise.vn', 'Pass1234!')
    expect(signedOutRes.error).toBeNull()
    expect(signedOutRes.data.user.email).toBe('logincheck@spendwise.vn')

    const out = await signOut()
    expect(out.error).toBeNull()
    const { data: userCheck } = await harness.client.auth.getUser()
    expect(userCheck.user).toBeNull()
  })

  it('UC04: resetPasswordForEmail sends redirectTo origin and updatePassword updates credentials', async () => {
    const resReset = await resetPasswordForEmail('demo@spendwise.vn')
    expect(resReset.error).toBeNull()
    expect(harness.state.authEvents).toContainEqual({
      type: 'resetPasswordForEmail',
      email: 'demo@spendwise.vn',
    })

    const resUpd = await updatePassword('NewSecurePass99')
    expect(resUpd.error).toBeNull()
    expect(resUpd.data.user.id).toBe(TEST_USER_A_ID)
  })

  it('UC05: getProfile & updateProfile persist whitelisted bank & profile metadata', async () => {
    const { data, error } = await updateProfile(TEST_USER_A_ID, {
      full_name: 'Trương Bích Vân',
      default_bank_bin: '970422',
      default_bank_account: '0987654321',
    })
    expect(error).toBeNull()
    expect(data.full_name).toBe('Trương Bích Vân')
    expect(data.default_bank_bin).toBe('970422')
    expect(data.default_bank_account).toBe('0987654321')

    const fetched = await getProfile(TEST_USER_A_ID)
    expect(fetched.data.full_name).toBe('Trương Bích Vân')
  })

  it('AUTH UI: LoginPage, RegisterPage, ForgotPasswordPage & ResetPasswordPage render Vietnamese auth forms', () => {
    const loginHtml = renderWithRouter(React.createElement(LoginPage), { route: '/login' })
    const regHtml = renderWithRouter(React.createElement(RegisterPage), { route: '/register' })
    const forgotHtml = renderWithRouter(React.createElement(ForgotPasswordPage), { route: '/forgot-password' })
    const resetHtml = renderWithRouter(React.createElement(ResetPasswordPage), { route: '/reset-password' })

    expect(loginHtml).toContain('Đăng nhập')
    expect(regHtml).toContain('Tạo tài khoản')
    expect(forgotHtml).toContain('Quên mật khẩu')
    expect(resetHtml).toContain('Đặt lại mật khẩu')
  })
})

// ============================================================================
// 2. WALLET (UC06–UC09) — 5 tests
// ============================================================================
describe('Tier 1 — Feature 2: WALLET (UC06–UC09)', () => {
  it('UC06: createWallet & getWallets create active wallets and exclude archived by default', async () => {
    const w1 = await createWallet({ name: 'Ví MoMo', type: 'ewallet', balance: 500000 })
    const w2 = await createWallet({ name: 'Vietcombank', type: 'bank', balance: 5000000 })
    expect(w1.error).toBeNull()
    expect(w2.error).toBeNull()

    const list = await getWallets()
    expect(list.data).toHaveLength(2)
    expect(list.data.map((w) => w.name)).toEqual(['Ví MoMo', 'Vietcombank'])
  })

  it('UC07: updateWallet edits name, type, color and balance', async () => {
    const { data: created } = await createWallet({ name: 'Ví phụ', type: 'cash', balance: 100000 })
    const { data: updated, error } = await updateWallet(created.id, {
      name: 'Ví chính',
      type: 'bank',
      balance: 250000,
    })
    expect(error).toBeNull()
    expect(updated.name).toBe('Ví chính')
    expect(updated.type).toBe('bank')
    expect(updated.balance).toBe(250000)
  })

  it('UC08: archiveWallet hides wallet from active list and deleteWallet removes unused wallet', async () => {
    const { data: wA } = await createWallet({ name: 'Ví lưu trữ', type: 'cash', balance: 0 })
    const { data: wB } = await createWallet({ name: 'Ví xóa', type: 'cash', balance: 0 })

    const archived = await archiveWallet(wA.id)
    expect(archived.error).toBeNull()
    expect(archived.data.is_archived).toBe(true)

    const active = await getWallets(false)
    expect(active.data.some((w) => w.id === wA.id)).toBe(false)

    const all = await getWallets(true)
    expect(all.data.some((w) => w.id === wA.id)).toBe(true)

    const del = await deleteWallet(wB.id)
    expect(del.error).toBeNull()
    const afterDel = await getWallets(true)
    expect(afterDel.data.some((w) => w.id === wB.id)).toBe(false)
  })

  it('UC09: transferFunds atomically debits source wallet, credits destination wallet, and records transfer', async () => {
    const { data: bank } = await createWallet({ name: 'Vietcombank', type: 'bank', balance: 2000000 })
    const { data: momo } = await createWallet({ name: 'Ví MoMo', type: 'ewallet', balance: 300000 })

    const { data, error } = await transferFunds({
      fromWalletId: bank.id,
      toWalletId: momo.id,
      amount: 500000,
      note: 'Nạp MoMo',
      date: '2026-11-26',
    })
    expect(error).toBeNull()
    expect(data.fromWalletBalance).toBe(1500000)
    expect(data.toWalletBalance).toBe(800000)
    expect(data.transactionId).toBeTruthy()
  })

  it('WALLET UI: WalletPage renders Double-Bezel wallet management heading in Vietnamese', () => {
    const html = renderWithRouter(React.createElement(WalletPage), { route: '/wallets' })
    expect(html).toContain('Quản lý Ví')
  })
})

// ============================================================================
// 3. CAT (UC10–UC11) — 5 tests
// ============================================================================
describe('Tier 1 — Feature 3: CAT (UC10–UC11)', () => {
  it('normalizeKeywords splits comma strings, trims, lowercases, and filters empties', () => {
    expect(normalizeKeywords('  Cafe , Trà Sữa , , PHỞ  ')).toEqual(['cafe', 'trà sữa', 'phở'])
    expect(normalizeKeywords([' Bún ', ''])).toEqual(['bún'])
    expect(normalizeKeywords('')).toEqual([])
  })

  it('UC10: getCategories lists seeded system categories and filters by type', async () => {
    const all = await getCategories()
    expect(all.error).toBeNull()
    expect(all.data.length).toBeGreaterThanOrEqual(7)

    const incomeCats = await getCategories('income')
    expect(incomeCats.data.every((c) => c.type === 'income')).toBe(true)
  })

  it('UC10: createCategory creates custom user category with normalized keywords', async () => {
    const { data, error } = await createCategory({
      name: 'Thú cưng',
      type: 'expense',
      keywords: 'Cún, Mèo, Pate',
      color: '#10B981',
    })
    expect(error).toBeNull()
    expect(data.user_id).toBe(TEST_USER_A_ID)
    expect(data.keywords).toEqual(['cún', 'mèo', 'pate'])
  })

  it('UC11: updateCategory & deleteCategory modify and delete user custom category', async () => {
    const { data: created } = await createCategory({ name: 'Đồ chơi', type: 'expense', keywords: 'lego' })
    const updated = await updateCategory(created.id, { name: 'Giải trí riêng', keywords: ['lego', 'boardgame'] })
    expect(updated.error).toBeNull()
    expect(updated.data.name).toBe('Giải trí riêng')
    expect(updated.data.keywords).toEqual(['lego', 'boardgame'])

    const deleted = await deleteCategory(created.id)
    expect(deleted.error).toBeNull()
  })

  it('CAT UI: CategoryPage renders category management screen cleanly', () => {
    const html = renderWithRouter(React.createElement(CategoryPage), { route: '/categories' })
    expect(html).toContain('Quản lý Danh mục')
  })
})

// ============================================================================
// 4. TXN (UC12–UC13) — 5 tests
// ============================================================================
describe('Tier 1 — Feature 4: TXN (UC12–UC13)', () => {
  it('UC12: createTransaction creates income and expense transactions and updates wallet balance', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 1000000 })
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    const salaryCat = harness.db.categories.find((c) => c.name === 'Lương')

    const inc = await createTransaction({
      wallet_id: cash.id,
      category_id: salaryCat.id,
      type: 'income',
      amount: 5000000,
      transaction_date: '2026-11-05',
      note: 'Thưởng dự án',
    })
    expect(inc.error).toBeNull()

    const exp = await createTransaction({
      wallet_id: cash.id,
      category_id: foodCat.id,
      type: 'expense',
      amount: 120000,
      transaction_date: '2026-11-06',
      note: 'Ăn trưa bún bò',
    })
    expect(exp.error).toBeNull()

    const { data: wallets } = await getWallets()
    expect(wallets.find((w) => w.id === cash.id).balance).toBe(5880000)
  })

  it('UC13: updateTransaction adjusts wallet balance by net delta', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 1000000 })
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')

    const { data: txn } = await createTransaction({
      wallet_id: cash.id,
      category_id: foodCat.id,
      type: 'expense',
      amount: 100000,
      transaction_date: '2026-11-10',
      note: 'Cà phê',
    })

    const updated = await updateTransaction(txn.id, { amount: 250000, note: 'Cà phê và bánh' })
    expect(updated.error).toBeNull()
    expect(updated.data.amount).toBe(250000)

    const { data: wallets } = await getWallets()
    expect(wallets.find((w) => w.id === cash.id).balance).toBe(750000)
  })

  it('UC13: deleteTransaction restores wallet balance accurately', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 1000000 })
    const { data: txn } = await createTransaction({
      wallet_id: cash.id,
      type: 'expense',
      amount: 300000,
      transaction_date: '2026-11-11',
      note: 'Mua sách',
    })

    const del = await deleteTransaction(txn.id)
    expect(del.error).toBeNull()

    const { data: wallets } = await getWallets()
    expect(wallets.find((w) => w.id === cash.id).balance).toBe(1000000)
  })

  it('UC13: getTransactions supports pagination, wallet filter, and Vietnamese unaccented search', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 2000000 })
    await createTransaction({ wallet_id: cash.id, type: 'expense', amount: 45000, transaction_date: '2026-11-10', note: 'Phở bò tái' })
    await createTransaction({ wallet_id: cash.id, type: 'expense', amount: 35000, transaction_date: '2026-11-11', note: 'Cà phê sữa' })

    const searchRes = await getTransactions({ searchKeyword: 'pho bo', page: 1, limit: 10 })
    expect(searchRes.error).toBeNull()
    expect(searchRes.count).toBe(1)
    expect(searchRes.data[0].note).toBe('Phở bò tái')
  })

  it('UC13: transactionsToCsv & exportTransactionsCSV emit UTF-8 BOM Vietnamese CSV and render TransactionPage', () => {
    const csv = transactionsToCsv([
      {
        transaction_date: '2026-11-26',
        type: 'expense',
        amount: 35000,
        category: { name: 'Ăn uống' },
        wallet: { name: 'Ví MoMo' },
        note: 'Cafe sáng',
      },
    ])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('Ngày giao dịch')
    expect(csv).toContain('Chi tiêu')
    expect(csv).toContain('35000')

    globalThis.Blob = class MockBlob {
      constructor(parts) {
        this.parts = parts
      }
    }
    globalThis.URL = {
      createObjectURL: () => 'blob:mock-csv',
      revokeObjectURL: () => {},
    }
    expect(exportTransactionsCSV([{ transaction_date: '2026-11-26', type: 'expense', amount: 1000 }], 'test.csv')).toBe(true)

    const html = renderWithRouter(React.createElement(TransactionPage), { route: '/transactions' })
    expect(html).toContain('Lịch sử Giao dịch')
  })
})

// ============================================================================
// 5. BUDGET (UC14–UC15) — 5 tests
// ============================================================================
describe('Tier 1 — Feature 5: BUDGET (UC14–UC15)', () => {
  it('BUDGET pure contracts classify 3 status tiers (<80% safe, 80-99% warning, >=100% exceeded)', () => {
    expect(BUDGET_THRESHOLDS).toEqual({ warning: 80, exceeded: 100 })
    expect(BUDGET_STATUSES.safe.label).toBe('An toàn')
    expect(getBudgetStatus(79.9)).toBe('safe')
    expect(getBudgetStatus(80)).toBe('warning')
    expect(getBudgetStatus(99.9)).toBe('warning')
    expect(getBudgetStatus(100)).toBe('exceeded')

    const usage = calculateBudgetUsage({ amount_limit: 1000000, spent_amount: 1200000, category_name: 'Ăn uống' })
    expect(usage.percentage).toBe(100)
    expect(usage.actual_percentage).toBe(120)
    expect(usage.status).toBe('exceeded')
    expect(usage.exceeded_amount).toBe(200000)
  })

  it('UC14: setBudget & getBudgets create and retrieve monthly category budget', async () => {
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    const { data, error } = await setBudget({
      category_id: foodCat.id,
      month: 11,
      year: 2026,
      amount_limit: 3000000,
    })
    expect(error).toBeNull()
    expect(data.amount_limit).toBe(3000000)

    const list = await getBudgets(11, 2026)
    expect(list.data).toHaveLength(1)
  })

  it('UC14: updateBudget & deleteBudget modify and remove existing budget', async () => {
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    const { data: created } = await setBudget({ category_id: foodCat.id, month: 11, year: 2026, amount_limit: 2000000 })

    const updated = await updateBudget(created.id, { amount_limit: 2500000 })
    expect(updated.error).toBeNull()
    expect(updated.data.amount_limit).toBe(2500000)

    const deleted = await deleteBudget(created.id)
    expect(deleted.error).toBeNull()
    const list = await getBudgets(11, 2026)
    expect(list.data).toHaveLength(0)
  })

  it('UC15: getBudgetProgress & getBudgetAlerts compute usage and warning/exceeded alerts', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 5000000 })
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    await setBudget({ category_id: foodCat.id, month: 11, year: 2026, amount_limit: 1000000 })
    await createTransaction({
      wallet_id: cash.id,
      category_id: foodCat.id,
      type: 'expense',
      amount: 850000,
      transaction_date: '2026-11-15',
      note: 'Liên hoan',
    })

    const progress = await getBudgetProgress(11, 2026)
    expect(progress.error).toBeNull()
    expect(progress.totalBudget).toBe(1000000)
    expect(progress.totalSpent).toBe(850000)
    expect(progress.overall_status).toBe('warning')

    const alerts = await getBudgetAlerts(11, 2026)
    expect(alerts.data).toHaveLength(1)
    expect(alerts.data[0].status).toBe('warning')
  })

  it('BUDGET UI: BudgetPage renders Double-Bezel overview card and Vietnamese copy', () => {
    const html = renderWithRouter(React.createElement(BudgetPage), { route: '/budgets' })
    expect(html).toContain('Ngân sách Chi tiêu Tháng')
    expect(html).toContain('rounded-[2rem]')
  })
})

// ============================================================================
// 6. DASH (UC16) — 5 tests
// ============================================================================
describe('Tier 1 — Feature 6: DASH (UC16)', () => {
  it('DASH UI: DashboardPage renders Safe-to-spend hero card and Vietnamese greeting', () => {
    const html = renderWithRouter(React.createElement(DashboardPage), { route: '/' })
    expect(html).toContain('Safe-to-spend Hôm nay')
    expect(html).toContain('Tổng tài sản')
  })

  it('DASH UI: DashboardPage renders Quick Entry input (#quick-entry-input) and example prompt', () => {
    const html = renderWithRouter(React.createElement(DashboardPage), { route: '/' })
    expect(html).toContain('id="quick-entry-input"')
    expect(html).toContain('Nhập nhanh')
  })

  it('DASH UI: DashboardPage renders category breakdown chart section and recent transactions section', () => {
    const html = renderWithRouter(React.createElement(DashboardPage), { route: '/' })
    expect(html).toContain('Chi tiêu theo danh mục')
    expect(html).toContain('Giao dịch gần nhất')
  })

  it('DASH UI: DashboardPage renders formula button for Safe-to-spend breakdown modal', () => {
    const html = renderWithRouter(React.createElement(DashboardPage), { route: '/' })
    expect(html).toContain('Cách tính?')
  })

  it('DASH UI: DashboardPage contains Double-Bezel card geometry without native alert() or confirm()', () => {
    const src = fs.readFileSync(getRepoPath('src/pages/DashboardPage.jsx'), 'utf8')
    expect(src).toContain('rounded-[2.25rem]')
    expect(src).not.toMatch(/\bwindow\.confirm\s*\(|\balert\s*\(/)
  })
})

// ============================================================================
// 7. REPORT (UC17) — 5 tests
// ============================================================================
describe('Tier 1 — Feature 7: REPORT (UC17)', () => {
  it('UC17: getFinancialSummary computes income, expense and netSavings while excluding transfers', async () => {
    const { data: bank } = await createWallet({ name: 'Vietcombank', type: 'bank', balance: 10000000 })
    const { data: momo } = await createWallet({ name: 'Ví MoMo', type: 'ewallet', balance: 0 })
    await createTransaction({ wallet_id: bank.id, type: 'income', amount: 15000000, transaction_date: '2026-11-01', note: 'Lương' })
    await createTransaction({ wallet_id: bank.id, type: 'expense', amount: 4000000, transaction_date: '2026-11-05', note: 'Tiền nhà' })
    await transferFunds({ fromWalletId: bank.id, toWalletId: momo.id, amount: 2000000, date: '2026-11-06' })

    const summary = await getFinancialSummary('2026-11-01', '2026-11-30')
    expect(summary.error).toBeNull()
    expect(summary.totalIncome).toBe(15000000)
    expect(summary.totalExpense).toBe(4000000)
    expect(summary.netSavings).toBe(11000000)
  })

  it('UC17: getCategoryExpenseBreakdown aggregates monthly expenses sorted descending', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 5000000 })
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    const moveCat = harness.db.categories.find((c) => c.name === 'Di chuyển')
    await createTransaction({ wallet_id: cash.id, category_id: foodCat.id, type: 'expense', amount: 800000, transaction_date: '2026-11-12', note: 'Ăn' })
    await createTransaction({ wallet_id: cash.id, category_id: moveCat.id, type: 'expense', amount: 200000, transaction_date: '2026-11-12', note: 'Xăng' })

    const donut = await getCategoryExpenseBreakdown(11, 2026)
    expect(donut.error).toBeNull()
    expect(donut.labels).toEqual(['Ăn uống', 'Di chuyển'])
    expect(donut.datasets[0].data).toEqual([800000, 200000])
  })

  it('UC17: getIncomeExpenseTrend generates buckets for week, month, and year', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 5000000 })
    await createTransaction({ wallet_id: cash.id, type: 'income', amount: 1000000, transaction_date: '2026-11-26', note: 'Freelance' })

    const week = await getIncomeExpenseTrend('week', new Date(2026, 10, 26))
    const month = await getIncomeExpenseTrend('month', new Date(2026, 10, 26))
    const year = await getIncomeExpenseTrend('year', new Date(2026, 10, 26))

    expect(week.labels).toHaveLength(7)
    expect(month.labels).toHaveLength(30)
    expect(year.labels).toHaveLength(12)
    expect(year.income[10]).toBe(1000000)
  })

  it('UC17: getPeriodComparison compares current month against previous month', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 5000000 })
    await createTransaction({ wallet_id: cash.id, type: 'expense', amount: 1000000, transaction_date: '2026-10-15', note: 'T10' })
    await createTransaction({ wallet_id: cash.id, type: 'expense', amount: 1500000, transaction_date: '2026-11-15', note: 'T11' })

    const comp = await getPeriodComparison(11, 2026)
    expect(comp.error).toBeNull()
    expect(comp.previous.expense).toBe(1000000)
    expect(comp.current.expense).toBe(1500000)
    expect(comp.diffExpensePercent).toBe(50)
  })

  it('REPORT UI: ReportPage renders report header and Chart.js sections', () => {
    const html = renderWithRouter(React.createElement(ReportPage), { route: '/reports' })
    expect(html).toContain('Báo cáo Tài chính')
  })
})

// ============================================================================
// 8. QUICK (UC18–UC19) — 5 tests
// ============================================================================
describe('Tier 1 — Feature 8: QUICK (UC18–UC19)', () => {
  it('UC18: parseQuickEntry extracts amount, date, wallet, category & type for "cafe 35k hôm qua momo"', () => {
    const now = new Date('2026-11-26T05:00:00Z')
    const parsed = parseQuickEntry('cafe 35k hôm qua momo', { now })
    expect(parsed).toMatchObject({
      amount: 35000,
      type: 'expense',
      date: '2026-11-25',
      wallet: 'Ví MoMo',
      walletKeyword: 'momo',
      category: 'Ăn uống',
      categoryName: 'Ăn uống',
      rawText: 'cafe 35k hôm qua momo',
      originalText: 'cafe 35k hôm qua momo',
    })
  })

  it('UC18: parseQuickEntry parses shorthand million formats ("1tr5", "1tr250", "2.5tr") and income hints', () => {
    const now = new Date('2026-11-26T05:00:00Z')
    expect(parseQuickEntry('nhận lương 15tr vcb', { now })).toMatchObject({
      amount: 15000000,
      type: 'income',
      walletKeyword: 'vietcombank',
      categoryName: 'Lương',
    })
    expect(parseQuickEntry('mua bàn phím 1tr5', { now }).amount).toBe(1500000)
    expect(parseQuickEntry('vé máy bay 2.5tr', { now }).amount).toBe(2500000)
  })

  it('UC18: parseQuickEntry parses internal transfer ("chuyển 500k từ vcb sang momo")', () => {
    const parsed = parseQuickEntry('chuyển 500k từ vcb sang momo')
    expect(parsed).toMatchObject({
      amount: 500000,
      type: 'transfer',
      walletKeyword: 'vietcombank',
      toWalletKeyword: 'momo',
      categoryName: null,
    })
  })

  it('UC18: resolveQuickWallet maps canonical keywords and normalizeQuickText strips Vietnamese diacritics', () => {
    const wallets = [
      { id: 'w1', name: 'Ví MoMo' },
      { id: 'w2', name: 'Vietcombank' },
    ]
    expect(normalizeQuickText('Đổ xăng 50k')).toBe('do xang 50k')
    expect(resolveQuickWallet(wallets, 'momo')?.id).toBe('w1')
    expect(resolveQuickWallet(wallets, 'vietcombank')?.id).toBe('w2')
  })

  it('UC18 Server API: POST /api/quick-entry/parse parses text and returns unified contract', async () => {
    const res = await request(createApp())
      .post('/api/quick-entry/parse')
      .send({ text: 'cafe 35k momo' })
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.data).toMatchObject({
      amount: 35000,
      type: 'expense',
      walletKeyword: 'momo',
      categoryName: 'Ăn uống',
    })
  })
})

// ============================================================================
// 9. STS (UC20) — 5 tests
// ============================================================================
describe('Tier 1 — Feature 9: STS (UC20)', () => {
  it('calculateSafeToSpendAmount computes max(0, (remainingBudget - upcomingRecurring) / daysLeft)', () => {
    expect(calculateSafeToSpendAmount(3000000, 500000, 5)).toBe(500000)
    expect(calculateSafeToSpendAmount(1000000, 1500000, 5)).toBe(0)
  })

  it('getRemainingDaysInMonth returns inclusive remaining days >= 1', () => {
    expect(getRemainingDaysInMonth(new Date(2026, 10, 26))).toBe(5)
    expect(getRemainingDaysInMonth(new Date(2026, 10, 30))).toBe(1)
  })

  it('POST /api/finance/safe-to-spend validates and returns Safe-to-spend formula result', async () => {
    const res = await request(createApp())
      .post('/api/finance/safe-to-spend')
      .send({ remainingBudget: 4000000, upcomingRecurring: 1000000, daysLeft: 10 })
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.data.safeToSpendToday).toBe(300000)
    expect(res.body.data.formula).toBe('max(0, (remainingBudget - upcomingRecurring) / daysLeft)')
  })

  it('UC20: calculateSafeToSpend integrates Supabase budgets + recurring_rules + Express backend', async () => {
    const today = new Date()
    const month = today.getMonth() + 1
    const year = today.getFullYear()
    const lastDay = new Date(year, month, 0).getDate()
    const dueStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const daysLeft = getRemainingDaysInMonth(today)

    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 5000000 })
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    await setBudget({ category_id: foodCat.id, month, year, amount_limit: 5000000 })
    await createRecurringRule({
      wallet_id: cash.id,
      category_id: foodCat.id,
      title: 'Internet',
      type: 'expense',
      amount: 500000,
      frequency: 'monthly',
      next_due_date: dueStr,
    })

    const res = await calculateSafeToSpend(today)
    expect(res.error).toBeNull()
    expect(res.calculationSource).toBe('backend')
    expect(res.safeToSpendToday).toBe(Math.round((5000000 - 500000) / daysLeft))
  })

  it('UC20: calculateSafeToSpend returns calculationSource="no_budget" when no monthly budgets exist', async () => {
    const res = await calculateSafeToSpend(new Date())
    expect(res.error).toBeNull()
    expect(res.hasBudgetSet).toBe(false)
    expect(res.calculationSource).toBe('no_budget')
    expect(res.safeToSpendToday).toBe(0)
  })
})

// ============================================================================
// 10. AIBOT (UC21) — 5 tests
// ============================================================================
describe('Tier 1 — Feature 10: AIBOT (UC21)', () => {
  it('QUICK_REPLY_CHIPS exposes exactly 4 Vietnamese starter prompts', () => {
    expect(QUICK_REPLY_CHIPS).toHaveLength(4)
    expect(QUICK_REPLY_CHIPS.every((c) => typeof c === 'string' && c.length > 10)).toBe(true)
  })

  it('buildFinancialContext aggregates wallets, SafeToSpend, budgets, and month transactions', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 2500000 })
    const today = new Date()
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    await createTransaction({ wallet_id: cash.id, type: 'expense', amount: 50000, transaction_date: todayIso, note: 'Bữa sáng' })

    const ctx = await buildFinancialContext()
    expect(ctx.error).toBeUndefined()
    expect(ctx.tong_so_du_vi).toBe(2450000)
    expect(ctx.tong_chi_thang).toBe(50000)
    expect(Array.isArray(ctx.giao_dich_gan_day)).toBe(true)
  })

  it('POST /api/ai/chat returns authenticated Gemini reply when GEMINI_API_KEY is configured', async () => {
    process.env.GEMINI_API_KEY = 'AQ.ValidServerGeminiKey12345'
    globalThis.__SPENDWISE_E2E_GEMINI__ = () => ({
      generateContent: async () => ({
        response: { text: () => 'Hôm nay bạn có thể tiêu an toàn 300.000 VNĐ.' },
      }),
    })

    const jwt = createFakeJwt()
    const res = await request(createApp())
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ prompt: 'Hôm nay tôi tiêu được bao nhiêu?', context: { safe_to_spend_hom_nay: 300000 } })
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.mode).toBe('gemini_backend')
    expect(res.body.reply).toContain('300.000 VNĐ')
  })

  it('askGeminiAssistant sends JWT and context to Express /api/ai/chat and returns backend reply', async () => {
    process.env.GEMINI_API_KEY = 'AIzaTestBackendKey123456'
    globalThis.__SPENDWISE_E2E_GEMINI__ = () => ({
      generateContent: async () => ({
        response: { text: () => 'Chi tiêu Ăn uống đang trong ngưỡng an toàn.' },
      }),
    })

    const res = await askGeminiAssistant('Tình hình ăn uống tháng này?')
    expect(res.error).toBeNull()
    expect(res.source).toBe('gemini_backend')
    expect(res.reply).toContain('an toàn')
  })

  it('AIBOT UI: AiChatWidget renders Double-Bezel dialog and all 4 QUICK_REPLY_CHIPS when open', () => {
    const html = renderWithRouter(React.createElement(AiChatWidget, { isOpen: true, onClose: () => {} }))
    expect(html).toContain('role="dialog"')
    expect(html).toContain('Trợ lý AI Gemini')
    for (const chip of QUICK_REPLY_CHIPS) {
      expect(html).toContain(chip)
    }
  })
})

// ============================================================================
// 11. GOAL_REC (UC22–UC24) — 5 tests
// ============================================================================
describe('Tier 1 — Feature 11: GOAL_REC (UC22–UC24)', () => {
  it('UC22 & UC23: createGoal, getGoals, updateGoal & depositToGoal reach completed status', async () => {
    const { data: bank } = await createWallet({ name: 'Vietcombank', type: 'bank', balance: 10000000 })
    const created = await createGoal({ name: 'Mua Laptop', target_amount: 5000000, wallet_id: bank.id })
    expect(created.error).toBeNull()

    const updated = await updateGoal(created.data.id, { name: 'Mua MacBook' })
    expect(updated.error).toBeNull()
    expect(updated.data.name).toBe('Mua MacBook')

    const dep = await depositToGoal({ goalId: created.data.id, walletId: bank.id, amount: 5000000 })
    expect(dep.error).toBeNull()
    expect(dep.data.current_amount).toBe(5000000)
    expect(dep.data.status).toBe('completed')

    const list = await getGoals()
    expect(list.data[0].status).toBe('completed')

    const del = await deleteGoal(created.data.id)
    expect(del.error).toBeNull()
  })

  it('UC24: createRecurringRule, getRecurringRules, toggleRuleActive & deleteRecurringRule manage rules', async () => {
    const { data: bank } = await createWallet({ name: 'Vietcombank', type: 'bank', balance: 5000000 })
    const billCat = harness.db.categories.find((c) => c.name === 'Hóa đơn & Tiện ích')
    const { data: rule, error } = await createRecurringRule({
      wallet_id: bank.id,
      category_id: billCat.id,
      title: 'Tiền nhà',
      type: 'expense',
      amount: 3500000,
      frequency: 'monthly',
      next_due_date: '2026-12-01',
    })
    expect(error).toBeNull()
    expect(rule.is_active).toBe(true)

    const toggled = await toggleRuleActive(rule.id, false)
    expect(toggled.data.is_active).toBe(false)

    const list = await getRecurringRules()
    expect(list.data).toHaveLength(1)

    const del = await deleteRecurringRule(rule.id)
    expect(del.error).toBeNull()
  })

  it('UC24: calculateNextDueDate & advanceRecurringRule preserve day_of_month (31->28/29->31)', async () => {
    expect(calculateNextDueDate('2026-01-31', 'monthly', 31)).toBe('2026-02-28')
    expect(calculateNextDueDate('2026-02-28', 'monthly', 31)).toBe('2026-03-31')
    expect(calculateNextDueDate('2026-11-26', 'daily')).toBe('2026-11-27')
    expect(calculateNextDueDate('2026-11-26', 'weekly')).toBe('2026-12-03')
    expect(calculateNextDueDate('2024-02-29', 'yearly')).toBe('2025-02-28')

    const { data: bank } = await createWallet({ name: 'Vietcombank', type: 'bank', balance: 1000000 })
    const billCat = harness.db.categories.find((c) => c.name === 'Hóa đơn & Tiện ích')
    const { data: rule } = await createRecurringRule({
      wallet_id: bank.id,
      category_id: billCat.id,
      title: 'Thuê cloud',
      type: 'expense',
      amount: 100000,
      frequency: 'monthly',
      day_of_month: 31,
      next_due_date: '2026-01-31',
    })
    const adv = await advanceRecurringRule(rule)
    expect(adv.error).toBeNull()
    expect(adv.data.next_due_date).toBe('2026-02-28')
  })

  it('UC24: checkAndGenerateRecurringTransactions creates due transactions via atomic RPC', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 2000000 })
    const billCat = harness.db.categories.find((c) => c.name === 'Hóa đơn & Tiện ích')
    const today = todayVietnamDate()
    await createRecurringRule({
      wallet_id: cash.id,
      category_id: billCat.id,
      title: 'Gửi xe tháng',
      type: 'expense',
      amount: 150000,
      frequency: 'monthly',
      next_due_date: today,
    })

    const res = await checkAndGenerateRecurringTransactions()
    expect(res.error).toBeNull()
    expect(res.data.generatedCount).toBe(1)
    expect(res.data.degraded).toBe(false)
  })

  it('GOAL_REC UI: GoalPage & RecurringPage render Vietnamese page titles', () => {
    const goalHtml = renderWithRouter(React.createElement(GoalPage), { route: '/goals' })
    const recHtml = renderWithRouter(React.createElement(RecurringPage), { route: '/recurring' })
    expect(goalHtml).toContain('Mục tiêu Tiết kiệm')
    expect(recHtml).toContain('Giao dịch định kỳ')
  })
})

// ============================================================================
// 12. NOTI_QR (UC25–UC26) — 5 tests
// ============================================================================
describe('Tier 1 — Feature 12: NOTI_QR (UC25–UC26)', () => {
  it('UC25: checkAndGenerateNotifications & getNotifications & getUnreadCount sync budget/recurring alerts', async () => {
    expect(NOTIFICATION_TYPES.BUDGET_WARNING).toBe('budget_warning')
    const today = new Date()
    const month = today.getMonth() + 1
    const year = today.getFullYear()
    const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 5000000 })
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    await setBudget({ category_id: foodCat.id, month, year, amount_limit: 1000000 })
    await createTransaction({
      wallet_id: cash.id,
      category_id: foodCat.id,
      type: 'expense',
      amount: 850000,
      transaction_date: todayStr,
      note: 'Ăn uống',
    })

    const syncRes = await checkAndGenerateNotifications({ daysAhead: 3 })
    expect(syncRes.error).toBeNull()
    expect(syncRes.data.budget_warning).toBe(1)

    const list = await getNotifications()
    expect(list.data).toHaveLength(1)
    const unread = await getUnreadCount()
    expect(unread.count).toBe(1)
  })

  it('UC25: markAsRead, markAllAsRead & clearReadNotifications update and prune read items', async () => {
    harness.db.notifications.push(
      { id: '99990001-0000-4000-8000-000000000001', user_id: TEST_USER_A_ID, title: 'A', message: 'M1', type: 'system', is_read: false, created_at: new Date().toISOString() },
      { id: '99990002-0000-4000-8000-000000000002', user_id: TEST_USER_A_ID, title: 'B', message: 'M2', type: 'system', is_read: false, created_at: new Date().toISOString() }
    )

    await markAsRead('99990001-0000-4000-8000-000000000001')
    expect((await getUnreadCount()).count).toBe(1)

    await markAllAsRead()
    expect((await getUnreadCount()).count).toBe(0)

    await clearReadNotifications(TEST_USER_A_ID)
    expect((await getNotifications()).data).toHaveLength(0)
  })

  it('UC26: splitBill computes tip and ceiling per-person share and generateVietQrUrl builds img.vietqr.io URL', () => {
    expect(POPULAR_BANKS.length).toBeGreaterThanOrEqual(8)
    const split = splitBill({ totalAmount: 500000, numberOfPeople: 3, tipPercent: 10 })
    expect(split).toEqual({
      tipAmount: 50000,
      totalAmountWithTip: 550000,
      amountPerPerson: 183334,
      numberOfPeople: 3,
    })

    const url = generateVietQrUrl({
      bankBin: '970436',
      bankAccount: '0123456789',
      amount: split.amountPerPerson,
      memo: 'Chia tien lau',
      accountName: 'Nguyen Van Demo',
    })
    expect(url).toContain('https://img.vietqr.io/image/970436-0123456789-compact.png')
    expect(url).toContain('amount=183334')
    expect(url).toContain('addInfo=Chia+tien+lau')
  })

  it('UC25 & UC26 UI: NotificationBell & BillSplitVietQR render expected controls', () => {
    const bellHtml = renderWithRouter(React.createElement(NotificationBell))
    const qrHtml = renderWithRouter(React.createElement(BillSplitVietQR), { route: '/bill-split' })
    expect(bellHtml).toContain('aria-label="Thông báo"')
    expect(qrHtml).toContain('Chia Hóa Đơn')
    expect(qrHtml).toContain('VietQR')
  })

  it('UC25: NotificationBell renders inside Navbar header (R2 #3)', () => {
    const navHtml = renderWithRouter(React.createElement(Navbar), { route: '/' })
    expect(navHtml).toContain('aria-label="Thông báo"')
    expect(navHtml).toContain('/categories')
  })
})

// ============================================================================
// 13. CROSS-CUTTING (Nav, Theme, ErrorBoundary, PWA) — 5 tests
// ============================================================================
describe('Tier 1 — Feature 13: Cross-Cutting (Nav, Theme, ErrorBoundary, PWA)', () => {
  it('NAV: Navbar exposes all 9 primary links + /profile and marks active route with aria-current="page"', () => {
    const html = renderWithRouter(React.createElement(Navbar), { route: '/categories' })
    for (const p of ['/', '/transactions', '/wallets', '/categories', '/budgets', '/reports', '/goals', '/recurring', '/bill-split', '/profile']) {
      expect(html).toContain(`href="${p}"`)
    }
    expect(html).toContain('aria-current="page"')
  })

  it('NAV: BottomNav renders mobile navigation tabs and Quick Entry primary button', () => {
    const html = renderWithRouter(React.createElement(BottomNav), { route: '/' })
    expect(html).toContain('aria-label="Điều hướng di động"')
    expect(html).toContain('aria-label="Nhập nhanh"')
    expect(html).toContain('Thêm')
  })

  it('NAV & AUTH: ProtectedRoute renders children when authenticated and NotFoundPage renders 404 recovery link', () => {
    const protectedHtml = renderWithRouter(
      React.createElement(ProtectedRoute, null, React.createElement('div', null, 'Protected Content'))
    )
    expect(protectedHtml).toContain('Protected Content')

    const notFoundHtml = renderWithRouter(React.createElement(NotFoundPage), { route: '/unknown' })
    expect(notFoundHtml).toContain('404')
    expect(notFoundHtml).toContain('Về trang chủ')
  })

  it('THEME & ERR: ThemeContext & ErrorBoundary load dynamically and render children cleanly', async () => {
    const { ThemeProvider } = await import('@/context/ThemeContext')
    const { useTheme } = await import('@/context/useTheme')
    const { ErrorBoundary } = await import('@/components/common/ErrorBoundary')

    function Probe() {
      const { theme } = useTheme()
      return React.createElement('span', null, `theme:${theme}`)
    }

    const html = renderWithRouter(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(ErrorBoundary, null, React.createElement(Probe))
      )
    )
    expect(html).toContain('theme:')
  })

  it('PWA: manifest.json defines standalone metadata and sw.js executes install & activate lifecycle in vm', async () => {
    const manifest = JSON.parse(fs.readFileSync(getRepoPath('public/manifest.json'), 'utf8'))
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.some((i) => i.sizes === '192x192' && i.type === 'image/png')).toBe(true)

    const sw = runSwInVm({
      initialCaches: { 'spendwise-v1': { '/': new Response('old') } },
    })
    await sw.dispatchLifecycle('install')
    await sw.dispatchLifecycle('activate')
    expect(sw.cacheBuckets.has('spendwise-v1')).toBe(false)
    expect(sw.cacheBuckets.size).toBe(1)
  })
})
