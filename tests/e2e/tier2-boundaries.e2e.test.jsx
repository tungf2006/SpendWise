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
  TEST_USER_A_ID,
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

import { signUp, signIn, updateProfile } from '@/services/authService'
import {
  createWallet,
  updateWallet,
  deleteWallet,
  transferFunds,
} from '@/services/walletService'
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/categoryService'
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '@/services/transactionService'
import { transactionsToCsv, escapeCsvText } from '@/utils/transactionCsv'
import {
  getBudgetStatus,
  calculateBudgetUsage,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetProgress,
} from '@/services/budgetService'
import {
  getCategoryExpenseBreakdown,
  getIncomeExpenseTrend,
  getPeriodComparison,
} from '@/services/reportService'
import { parseQuickEntry, resolveQuickWallet } from '@/services/quickEntryParser'
import {
  countRecurringOccurrences,
  validateSafeToSpendInput,
  calculateSafeToSpendAmount,
} from '@/services/safeToSpendService'
import { askGeminiAssistant } from '@/services/aiAssistantService'
import {
  createGoal,
  updateGoal,
  deleteGoal,
  depositToGoal,
} from '@/services/goalService'
import {
  createRecurringRule,
  updateRecurringRule,
  calculateNextDueDate,
} from '@/services/recurringService'
import {
  createNotification,
  clearReadNotifications,
  checkAndGenerateNotifications,
} from '@/services/notificationService'
import { generateVietQrUrl, splitBill } from '@/services/vietqrService'

import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { Toast } from '@/components/common/Toast'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { getUserInitials } from '@/components/common/userInitials'
import { Navbar } from '@/components/layout/Navbar'
import { DashboardPage } from '@/pages/DashboardPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { createApp } from '../../server/app.js'

let envCtrl
let harness
let fetchBridge

function listSourceFiles(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue
      results.push(...listSourceFiles(full))
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      results.push(full)
    }
  }
  return results
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

// ============================================================================
// 1. AUTH BOUNDARIES — 5 tests
// ============================================================================
describe('Tier 2 — Boundaries 1: AUTH', () => {
  it('signUp rejects short password (<6 chars) and signIn rejects invalid credentials', async () => {
    const shortRes = await signUp('bad@spendwise.vn', '12345', 'Test')
    expect(shortRes.error).toBeTruthy()

    const badLogin = await signIn('demo@spendwise.vn', 'WrongPassword')
    expect(badLogin.error).toBeTruthy()
  })

  it('updateProfile strips non-whitelisted fields (id, role, created_at)', async () => {
    const { data, error } = await updateProfile(TEST_USER_A_ID, {
      full_name: 'Tên Hợp Lệ',
      role: 'superuser',
      id: TEST_USER_B_ID,
    })
    expect(error).toBeNull()
    expect(data.id).toBe(TEST_USER_A_ID)
    expect(data.role).toBeUndefined()
  })

  it('ProtectedRoute blocks unauthenticated render and shows loading state while checking auth', () => {
    const unauthHtml = renderWithRouter(
      React.createElement(ProtectedRoute, null, React.createElement('div', null, 'SECRET_DASHBOARD')),
      { auth: { user: null, profile: null, loading: false } }
    )
    expect(unauthHtml).not.toContain('SECRET_DASHBOARD')

    const loadingHtml = renderWithRouter(
      React.createElement(ProtectedRoute, null, React.createElement('div', null, 'SECRET_DASHBOARD')),
      { auth: { user: null, profile: null, loading: true } }
    )
    expect(loadingHtml).toContain('Đang xác thực phiên đăng nhập')
    expect(loadingHtml).not.toContain('SECRET_DASHBOARD')
  })

  it('ResetPasswordPage blocks submission when recoveryReady is false (missing/expired token)', () => {
    const src = fs.readFileSync(getRepoPath('src/pages/ResetPasswordPage.jsx'), 'utf8')
    expect(src).toContain('if (!recoveryReady)')
    expect(src).toContain('getSession()')
    expect(src).toContain('exchangeCodeForSession')
  })

  it('ForgotPasswordPage & ResetPasswordPage adopt Double-Bezel rounded-[2rem] & pill inputs (R4 #14)', () => {
    for (const file of ['src/pages/ForgotPasswordPage.jsx', 'src/pages/ResetPasswordPage.jsx']) {
      const src = fs.readFileSync(getRepoPath(file), 'utf8')
      expect(src).toContain('rounded-[2rem]')
      expect(src).toContain('rounded-full')
      expect(src).toContain('SW')
    }
  })
})

// ============================================================================
// 2. WALLET BOUNDARIES — 5 tests
// ============================================================================
describe('Tier 2 — Boundaries 2: WALLET', () => {
  it('createWallet & updateWallet reject blank names, NaN balance, and invalid wallet types', async () => {
    const blank = await createWallet({ name: '   ', type: 'cash', balance: 0 })
    expect(blank.error).toBeTruthy()

    const badBal = await createWallet({ name: 'Ví lỗi', type: 'cash', balance: 'abc' })
    expect(badBal.error).toBeTruthy()

    const { data: w } = await createWallet({ name: 'Ví thật', type: 'cash', balance: 1000 })
    const badType = await updateWallet(w.id, { type: 'crypto' })
    expect(badType.error).toBeTruthy()
  })

  it('updateWallet strips user_id/id injection attempts and preserves ownership', async () => {
    const { data: w } = await createWallet({ name: 'Ví gốc', type: 'cash', balance: 1000 })
    const { data: upd, error } = await updateWallet(w.id, {
      name: 'Ví đổi tên',
      user_id: TEST_USER_B_ID,
      id: '99999999-9999-4999-8999-999999999999',
    })
    expect(error).toBeNull()
    expect(upd.id).toBe(w.id)
    expect(upd.user_id).toBe(TEST_USER_A_ID)
  })

  it('transferFunds rejects same wallet, zero/negative amount, and insufficient source balance', async () => {
    const { data: w1 } = await createWallet({ name: 'VCB', type: 'bank', balance: 100000 })
    const { data: w2 } = await createWallet({ name: 'MoMo', type: 'ewallet', balance: 50000 })

    expect((await transferFunds({ fromWalletId: w1.id, toWalletId: w1.id, amount: 1000 })).error).toBeTruthy()
    expect((await transferFunds({ fromWalletId: w1.id, toWalletId: w2.id, amount: 0 })).error).toBeTruthy()
    expect((await transferFunds({ fromWalletId: w1.id, toWalletId: w2.id, amount: -500 })).error).toBeTruthy()
    expect((await transferFunds({ fromWalletId: w1.id, toWalletId: w2.id, amount: 500000 })).error).toBeTruthy()
  })

  it('deleteWallet fails cleanly with FK error 23503 when wallet has existing transactions', async () => {
    const { data: w } = await createWallet({ name: 'Ví có GD', type: 'cash', balance: 100000 })
    await createTransaction({ wallet_id: w.id, type: 'expense', amount: 10000, note: 'Test FK' })

    const { error } = await deleteWallet(w.id)
    expect(error).toBeTruthy()
    expect(error.code).toBe('23503')
  })

  it('WALLET IDOR: User B cannot update or delete User A wallet', async () => {
    const { data: wA } = await createWallet({ name: 'Ví User A', type: 'cash', balance: 500000 })
    harness.setUser({ id: TEST_USER_B_ID, email: 'userb@spendwise.vn' })

    const upd = await updateWallet(wA.id, { name: 'Hacked' })
    expect(upd.error).toBeTruthy()

    const del = await deleteWallet(wA.id)
    expect(del.data ?? null).toBeNull()
    expect(harness.db.wallets.find((w) => w.id === wA.id).name).toBe('Ví User A')
  })
})

// ============================================================================
// 3. CAT BOUNDARIES — 5 tests
// ============================================================================
describe('Tier 2 — Boundaries 3: CAT', () => {
  it('createCategory & updateCategory reject blank names', async () => {
    expect((await createCategory({ name: '   ', type: 'expense' })).error).toBeTruthy()

    const { data: cat } = await createCategory({ name: 'Hợp lệ', type: 'expense' })
    expect((await updateCategory(cat.id, { name: '' })).error).toBeTruthy()
  })

  it('deleteCategory & updateCategory reject missing ID and system category modification', async () => {
    expect((await deleteCategory('')).error).toBeTruthy()
    expect((await updateCategory('', { name: 'X' })).error).toBeTruthy()

    const sysCat = harness.db.categories.find((c) => c.user_id === null)
    const updSys = await updateCategory(sysCat.id, { name: 'Đổi hệ thống' })
    expect(updSys.error).toBeTruthy()
  })

  it('deleteCategory fails with 23503 when referenced by a transaction', async () => {
    const { data: cat } = await createCategory({ name: 'Cat Có GD', type: 'expense', keywords: ['catgd'] })
    const { data: w } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 100000 })
    await createTransaction({ wallet_id: w.id, category_id: cat.id, type: 'expense', amount: 10000, note: 'Test' })

    const del = await deleteCategory(cat.id)
    expect(del.error).toBeTruthy()
    expect(del.error.code).toBe('23503')
  })

  it('CAT IDOR: User B cannot update or delete User A custom category', async () => {
    const { data: catA } = await createCategory({ name: 'Riêng A', type: 'expense', keywords: ['rienga'] })
    harness.setUser({ id: TEST_USER_B_ID, email: 'b@spendwise.vn' })

    const upd = await updateCategory(catA.id, { name: 'B Hack' })
    expect(upd.error).toBeTruthy()
    expect(harness.db.categories.find((c) => c.id === catA.id).name).toBe('Riêng A')
  })

  it('createCategory defaults unknown type safely to expense and ignores empty keyword tokens', async () => {
    const { data } = await createCategory({ name: 'Test Cat', type: 'invalid', keywords: ' , A , , B , ' })
    expect(data.type).toBe('expense')
    expect(data.keywords).toEqual(['a', 'b'])
  })
})

// ============================================================================
// 4. TXN BOUNDARIES — 5 tests
// ============================================================================
describe('Tier 2 — Boundaries 4: TXN', () => {
  it('createTransaction rejects non-positive amount, invalid type, missing wallet, and self-transfer', async () => {
    const { data: w } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 500000 })
    expect((await createTransaction({ wallet_id: w.id, type: 'expense', amount: 0 })).error).toBeTruthy()
    expect((await createTransaction({ wallet_id: w.id, type: 'expense', amount: -100 })).error).toBeTruthy()
    expect((await createTransaction({ wallet_id: w.id, type: 'crypto', amount: 100 })).error).toBeTruthy()
    expect((await createTransaction({ type: 'expense', amount: 100 })).error).toBeTruthy()
    expect((await createTransaction({ wallet_id: w.id, to_wallet_id: w.id, type: 'transfer', amount: 100 })).error).toBeTruthy()
  })

  it('CSV Formula Injection: escapeCsvText & transactionsToCsv neutralize =, +, -, @ and leading whitespace + =', () => {
    expect(escapeCsvText('=CMD("calc")')).toBe('"\'=CMD(""calc"")"')
    expect(escapeCsvText('+SUM(A1:A2)')).toBe('"\'+SUM(A1:A2)"')
    expect(escapeCsvText('-1+1')).toBe('"\'-1+1"')
    expect(escapeCsvText('@SUM(1,1)')).toBe('"\'@SUM(1,1)"')
    expect(escapeCsvText('  =1+1')).toBe('"\'  =1+1"')

    const csv = transactionsToCsv([
      {
        transaction_date: '2026-11-26',
        type: 'expense',
        amount: 50000,
        category: { name: '=1+1' },
        wallet: { name: 'Tiền mặt' },
        note: '@evil',
      },
    ])
    expect(csv).toContain('"\'=1+1"')
    expect(csv).toContain('"\'@evil"')
  })

  it('TXN IDOR: User B cannot update or delete User A transaction', async () => {
    const { data: wA } = await createWallet({ name: 'Ví A', type: 'cash', balance: 1000000 })
    const { data: txnA } = await createTransaction({ wallet_id: wA.id, type: 'expense', amount: 100000, note: 'A' })

    harness.setUser({ id: TEST_USER_B_ID, email: 'b@spendwise.vn' })
    const upd = await updateTransaction(txnA.id, { amount: 999999 })
    expect(upd.error).toBeTruthy()

    const del = await deleteTransaction(txnA.id)
    expect(del.error).toBeTruthy()
    expect(harness.db.wallets.find((w) => w.id === wA.id).balance).toBe(900000)
  })

  it('TXN: transactionService fallback enforces explicit user_id scoping on writes/deletes (R3 #9)', async () => {
    harness.state.rpcMissing = true
    const { data: w } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 500000 })
    const { data: txn, error: createErr } = await createTransaction({
      wallet_id: w.id,
      type: 'expense',
      amount: 50000,
      transaction_date: '2026-11-26',
      note: 'Fallback test',
    })
    expect(createErr).toBeNull()

    harness.state.queryLog.length = 0
    await updateTransaction(txn.id, { amount: 80000 })
    const walletUpdates = harness.state.queryLog.filter((q) => q.table === 'wallets' && q.op === 'update')
    const txnUpdates = harness.state.queryLog.filter((q) => q.table === 'transactions' && q.op === 'update')
    expect(walletUpdates.some((q) => q.eqFilters.user_id === TEST_USER_A_ID)).toBe(true)
    expect(txnUpdates.some((q) => q.eqFilters.user_id === TEST_USER_A_ID)).toBe(true)

    harness.state.queryLog.length = 0
    await deleteTransaction(txn.id)
    const txnDeletes = harness.state.queryLog.filter((q) => q.table === 'transactions' && q.op === 'delete')
    expect(txnDeletes.some((q) => q.eqFilters.user_id === TEST_USER_A_ID)).toBe(true)
  })

  it('TXN: createTransaction prefers create_transaction_atomic RPC when available (R3 #9)', async () => {
    const { data: w } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 500000 })
    const res = await createTransaction({
      wallet_id: w.id,
      type: 'expense',
      amount: 50000,
      transaction_date: '2026-11-26',
      note: 'Atomic RPC',
    })
    expect(res.error).toBeNull()
    expect(harness.state.rpcCalls.some((c) => c.name === 'create_transaction_atomic')).toBe(true)
  })
})

// ============================================================================
// 5. BUDGET BOUNDARIES — 5 tests
// ============================================================================
describe('Tier 2 — Boundaries 5: BUDGET', () => {
  it('getBudgetStatus & calculateBudgetUsage handle boundary thresholds (79.99, 80, 99.99, 100, >100%)', () => {
    expect(getBudgetStatus(79.99)).toBe('safe')
    expect(getBudgetStatus(80)).toBe('warning')
    expect(getBudgetStatus(99.99)).toBe('warning')
    expect(getBudgetStatus(100)).toBe('exceeded')

    const over = calculateBudgetUsage({ amount_limit: 500000, spent_amount: 900000, category_name: 'Mua sắm' })
    expect(over.actual_percentage).toBe(180)
    expect(over.percentage).toBe(100)
    expect(over.remaining_amount).toBe(-400000)
    expect(over.exceeded_amount).toBe(400000)
  })

  it('createBudget rejects amount_limit <= 0, >2 decimals, invalid period, income category, and duplicates', async () => {
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    const salaryCat = harness.db.categories.find((c) => c.name === 'Lương')

    expect((await createBudget({ category_id: foodCat.id, month: 11, year: 2026, amount_limit: 0 })).error).toBeTruthy()
    expect((await createBudget({ category_id: foodCat.id, month: 11, year: 2026, amount_limit: 100.123 })).error).toBeTruthy()
    expect((await createBudget({ category_id: foodCat.id, month: 13, year: 2026, amount_limit: 100000 })).error).toBeTruthy()
    expect((await createBudget({ category_id: salaryCat.id, month: 11, year: 2026, amount_limit: 100000 })).error).toBeTruthy()

    const first = await createBudget({ category_id: foodCat.id, month: 11, year: 2026, amount_limit: 1000000 })
    expect(first.error).toBeNull()
    const dup = await createBudget({ category_id: foodCat.id, month: 11, year: 2026, amount_limit: 2000000 })
    expect(dup.error.code).toBe('23505')
  })

  it('updateBudget rejects non-whitelisted fields and cross-user budget IDs', async () => {
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    const { data: bud } = await createBudget({ category_id: foodCat.id, month: 11, year: 2026, amount_limit: 1000000 })

    const badField = await updateBudget(bud.id, { user_id: TEST_USER_B_ID })
    expect(badField.error).toBeTruthy()

    harness.setUser({ id: TEST_USER_B_ID, email: 'b@spendwise.vn' })
    const idorUpd = await updateBudget(bud.id, { amount_limit: 5000000 })
    expect(idorUpd.error).toBeTruthy()
    const idorDel = await deleteBudget(bud.id)
    expect(idorDel.error).toBeTruthy()
  })

  it('getBudgetProgress falls back seamlessly to paginated transactions when v_budget_progress is unavailable', async () => {
    harness.state.missingView = true
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 2000000 })
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    await createBudget({ category_id: foodCat.id, month: 11, year: 2026, amount_limit: 1000000 })
    await createTransaction({ wallet_id: cash.id, category_id: foodCat.id, type: 'expense', amount: 1100000, transaction_date: '2026-11-20', note: 'Quá hạn' })

    const prog = await getBudgetProgress(11, 2026)
    expect(prog.error).toBeNull()
    expect(prog.overall_status).toBe('exceeded')
    expect(prog.overall_percentage).toBe(110)
  })

  it('BudgetPage displays uncapped overallPercentage (>100%) text while clamping progress bar width at 100% (R4 #15)', () => {
    const src = fs.readFileSync(getRepoPath('src/pages/BudgetPage.jsx'), 'utf8')
    expect(src).toContain('Đã dùng {overallPercentage}%')
    expect(src).toContain('Math.min(100, Math.max(0, overallPercentage))')
  })
})

// ============================================================================
// 6. DASH BOUNDARIES — 5 tests
// ============================================================================
describe('Tier 2 — Boundaries 6: DASH', () => {
  it('DashboardPage renders error banner & "Thử lại" recovery handler in source (R4 #14)', () => {
    const src = fs.readFileSync(getRepoPath('src/pages/DashboardPage.jsx'), 'utf8')
    expect(src).toContain('role="alert"')
    expect(src).toContain('Thử lại')
    expect(src).toContain('loadError')
  })

  it('DashboardPage displays explicit Vietnamese empty states when no budgets or transactions exist', () => {
    const html = renderWithRouter(React.createElement(DashboardPage), { route: '/' })
    expect(html).toContain('Safe-to-spend Hôm nay')
    expect(html).toContain('Giao dịch gần nhất')
  })

  it('DashboardPage does NOT silently default Quick Entry to wallets[0] when walletKeyword is unrecognized (R2 #1)', () => {
    const src = fs.readFileSync(getRepoPath('src/pages/DashboardPage.jsx'), 'utf8')
    expect(src).not.toMatch(/\?\s*resolveQuickWallet\(wallets,\s*parsedData\.walletKeyword\)\s*:\s*wallets\[0\]/)
  })

  it('DashboardPage contains editable UC19 Preview modal with amber highlight for missing fields (R2 #1)', () => {
    const src = fs.readFileSync(getRepoPath('src/pages/DashboardPage.jsx'), 'utf8')
    expect(src).toMatch(/border-amber-|ring-amber-|bg-amber-/)
    expect(src).toMatch(/preview|showQuickPreview|quickPreview/i)
  })

  it('DashboardPage supports dark mode Chart.js legend observation on html.dark (R5 #21)', () => {
    const src = fs.readFileSync(getRepoPath('src/pages/DashboardPage.jsx'), 'utf8')
    expect(src).toContain('MutationObserver')
  })
})

// ============================================================================
// 7. REPORT BOUNDARIES — 5 tests
// ============================================================================
describe('Tier 2 — Boundaries 7: REPORT', () => {
  it('getCategoryExpenseBreakdown rejects invalid month (0, 13) and year (<2020)', async () => {
    expect((await getCategoryExpenseBreakdown(0, 2026)).error).toBeTruthy()
    expect((await getCategoryExpenseBreakdown(13, 2026)).error).toBeTruthy()
    expect((await getCategoryExpenseBreakdown(11, 1999)).error).toBeTruthy()
  })

  it('getIncomeExpenseTrend rejects invalid period and invalid referenceDate', async () => {
    expect((await getIncomeExpenseTrend('decade', new Date())).error).toBeTruthy()
    expect((await getIncomeExpenseTrend('month', 'not-a-date')).error).toBeTruthy()
  })

  it('getPeriodComparison handles January rollover (previous = December of year-1) and zero baseline', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 5000000 })
    await createTransaction({ wallet_id: cash.id, type: 'expense', amount: 400000, transaction_date: '2025-12-20', note: 'T12' })
    await createTransaction({ wallet_id: cash.id, type: 'expense', amount: 800000, transaction_date: '2026-01-10', note: 'T1' })

    const comp = await getPeriodComparison(1, 2026)
    expect(comp.error).toBeNull()
    expect(comp.previous.expense).toBe(400000)
    expect(comp.current.expense).toBe(800000)
    expect(comp.diffExpensePercent).toBe(100)
  })

  it('getCategoryExpenseBreakdown groups uncategorized expenses as "Khác"', async () => {
    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 2000000 })
    await createTransaction({ wallet_id: cash.id, category_id: null, type: 'expense', amount: 99000, transaction_date: '2026-11-18', note: 'Lặt vặt' })

    const res = await getCategoryExpenseBreakdown(11, 2026)
    expect(res.labels).toContain('Khác')
    expect(res.rawData.find((d) => d.name === 'Khác').total).toBe(99000)
  })

  it('ReportPage implements error banner + "Thử lại" button (R4 #14)', () => {
    const src = fs.readFileSync(getRepoPath('src/pages/ReportPage.jsx'), 'utf8')
    expect(src).toContain('loadError')
    expect(src).toContain('Thử lại')
    expect(src).toContain('role="alert"')
  })
})

// ============================================================================
// 8. QUICK ENTRY BOUNDARIES — 6 tests
// ============================================================================
describe('Tier 2 — Boundaries 8: QUICK', () => {
  it('R3 #6: parses decimal "35.5k" and "35,5k" as 35500', () => {
    expect(parseQuickEntry('cafe 35.5k')?.amount).toBe(35500)
    expect(parseQuickEntry('trà sữa 35,5k')?.amount).toBe(35500)
  })

  it('R3 #6: word-boundary rules prevent substring collisions ("combo"!="mb", "bệnh viện"!="be", "bán"!="an")', () => {
    const combo = parseQuickEntry('combo 50k')
    expect(combo.wallet).toBeNull()
    expect(combo.walletKeyword).toBeNull()

    const hospital = parseQuickEntry('bệnh viện 200k')
    expect(hospital.categoryName).toBe('Y tế & Sức khỏe')

    const sell = parseQuickEntry('bán đồ 120k')
    expect(sell.type).toBe('income')
    expect(sell.categoryName).not.toBe('Ăn uống')
  })

  it('R3 #5 & T2: rejects invalid calendar dates like "31/02" (null client, 422 server)', async () => {
    expect(parseQuickEntry('cafe 35k 31/02')).toBeNull()
    expect(parseQuickEntry('   ')).toBeNull()

    const res = await request(createApp())
      .post('/api/quick-entry/parse')
      .send({ text: 'cafe 35k 31/02' })
      .expect(422)
    expect(res.body.success).toBe(false)
  })

  it('R3 #5: handles UTC+7 Asia/Ho_Chi_Minh midnight rollover, dd/mm and 2-digit dd/mm/yy', () => {
    // 2026-11-26T17:30:00Z == 2026-11-27 00:30 in Asia/Ho_Chi_Minh (UTC+7)
    const vnMidnight = new Date('2026-11-26T17:30:00Z')
    expect(parseQuickEntry('cafe 30k hôm nay', { now: vnMidnight }).date).toBe('2026-11-27')
    expect(parseQuickEntry('cafe 30k hôm qua', { now: vnMidnight }).date).toBe('2026-11-26')
    expect(parseQuickEntry('cafe 30k 15/11', { now: vnMidnight }).date).toBe('2026-11-15')
    expect(parseQuickEntry('cafe 30k 15/11/26', { now: vnMidnight }).date).toBe('2026-11-15')
  })

  it('R3 #5: POST /api/quick-entry/parse rejects non-string text or non-array categories/wallets with 400', async () => {
    await request(createApp()).post('/api/quick-entry/parse').send({ text: '' }).expect(400)
    await request(createApp()).post('/api/quick-entry/parse').send({ text: 'cafe 35k', categories: 'bad' }).expect(400)
    await request(createApp()).post('/api/quick-entry/parse').send({ text: 'cafe 35k', wallets: {} }).expect(400)
  })

  it('resolveQuickWallet returns null on unrecognized keyword or non-array wallets', () => {
    expect(resolveQuickWallet(null, 'momo')).toBeNull()
    expect(resolveQuickWallet([{ id: '1', name: 'Tiền mặt' }], 'tpbank')).toBeNull()
  })
})

// ============================================================================
// 9. STS BOUNDARIES — 5 tests
// ============================================================================
describe('Tier 2 — Boundaries 9: STS', () => {
  it('calculateSafeToSpendAmount clamps negative remaining or excessive recurring to 0', () => {
    expect(calculateSafeToSpendAmount(-500000, 0, 10)).toBe(0)
    expect(calculateSafeToSpendAmount(200000, 500000, 5)).toBe(0)
  })

  it('validateSafeToSpendInput rejects non-object, NaN, negative recurring, and out-of-range daysLeft (0, 32, 1.5)', () => {
    expect(validateSafeToSpendInput(null).length).toBeGreaterThan(0)
    expect(validateSafeToSpendInput({ remainingBudget: NaN, upcomingRecurring: 0, daysLeft: 5 }).length).toBeGreaterThan(0)
    expect(validateSafeToSpendInput({ remainingBudget: 100, upcomingRecurring: -1, daysLeft: 5 }).length).toBeGreaterThan(0)
    expect(validateSafeToSpendInput({ remainingBudget: 100, upcomingRecurring: 0, daysLeft: 0 }).length).toBeGreaterThan(0)
    expect(validateSafeToSpendInput({ remainingBudget: 100, upcomingRecurring: 0, daysLeft: 32 }).length).toBeGreaterThan(0)
    expect(validateSafeToSpendInput({ remainingBudget: 100, upcomingRecurring: 0, daysLeft: 2.5 }).length).toBeGreaterThan(0)
  })

  it('POST /api/finance/safe-to-spend returns HTTP 400 on invalid inputs', async () => {
    const res = await request(createApp())
      .post('/api/finance/safe-to-spend')
      .send({ remainingBudget: 1000000, upcomingRecurring: -50, daysLeft: 0 })
      .expect(400)
    expect(res.body.success).toBe(false)
    expect(res.body.errors.length).toBeGreaterThanOrEqual(2)
  })

  it('countRecurringOccurrences catches missed daily/weekly occurrences and skips invalid dates', () => {
    expect(countRecurringOccurrences('daily', '2026-11-24', '2026-11-26', '2026-11-30')).toBe(5)
    expect(countRecurringOccurrences('weekly', '2026-11-12', '2026-11-26', '2026-11-30')).toBe(1)
    expect(() => countRecurringOccurrences('monthly', '2026-02-30', '2026-11-26', '2026-11-30')).toThrow()
  })

  it('POST /api/finance/safe-to-spend enforces STRICT_API_AUTH=true -> 401 when header omitted', async () => {
    process.env.STRICT_API_AUTH = 'true'
    await request(createApp())
      .post('/api/finance/safe-to-spend')
      .send({ remainingBudget: 1000000, upcomingRecurring: 0, daysLeft: 5 })
      .expect(401)
  })
})

// ============================================================================
// 10. AIBOT BOUNDARIES — 5 tests
// ============================================================================
describe('Tier 2 — Boundaries 10: AIBOT', () => {
  it('R2 #2: authMiddleware fails closed (503) when Supabase env missing outside NODE_ENV==="test"', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.SUPABASE_URL
    delete process.env.VITE_SUPABASE_URL
    delete process.env.SUPABASE_ANON_KEY
    delete process.env.VITE_SUPABASE_ANON_KEY

    const forgedJwt = createFakeJwt()
    const res = await request(createApp())
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${forgedJwt}`)
      .send({ prompt: 'Hack attempt' })
      .expect(503)
    expect(res.body.success).toBe(false)
  })

  it('R2 #4: aiRoutes accepts non-AIza GEMINI_API_KEY and ignores VITE_GEMINI_API_KEY', async () => {
    const jwt = createFakeJwt()

    // Only VITE_GEMINI_API_KEY present -> must be ignored -> 503 + smart_context_advisor
    delete process.env.GEMINI_API_KEY
    process.env.VITE_GEMINI_API_KEY = 'AIzaClientLeakShouldBeIgnored1234'
    const resIgnored = await request(createApp())
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ prompt: 'Hôm nay tiêu bao nhiêu?', context: { safe_to_spend_hom_nay: 150000 } })
      .expect(503)
    expect(resIgnored.body.mode).toBe('smart_context_advisor')

    // Non-AIza GEMINI_API_KEY accepted
    delete process.env.VITE_GEMINI_API_KEY
    process.env.GEMINI_API_KEY = 'AQ.Ab8RN6ServerKeyAccepted123456'
    let capturedOpts = null
    globalThis.__SPENDWISE_E2E_GEMINI__ = (_key, opts) => {
      capturedOpts = opts
      return {
        generateContent: async () => ({ response: { text: () => 'OK non-AIza' } }),
      }
    }
    const resValid = await request(createApp())
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ prompt: 'Xin chào', context: {} })
      .expect(200)
    expect(resValid.body.reply).toBe('OK non-AIza')
    expect(capturedOpts.systemInstruction).toContain('SpendWise')
  })

  it('requireAuth rejects missing, malformed, and expired JWT with 401; blank prompt returns 400', async () => {
    const app = createApp()
    await request(app).post('/api/ai/chat').send({ prompt: 'Hi' }).expect(401)
    await request(app).post('/api/ai/chat').set('Authorization', 'Bearer bad.jwt').send({ prompt: 'Hi' }).expect(401)

    const expiredJwt = createFakeJwt({ exp: Math.floor(Date.now() / 1000) - 60 })
    await request(app).post('/api/ai/chat').set('Authorization', `Bearer ${expiredJwt}`).send({ prompt: 'Hi' }).expect(401)

    const validJwt = createFakeJwt()
    await request(app).post('/api/ai/chat').set('Authorization', `Bearer ${validJwt}`).send({ prompt: '   ' }).expect(400)
  })

  it('Express enforces 100KB JSON body limit (413) and AI rate limiter (429 after 20 reqs)', async () => {
    const app = createApp()
    const jwt = createFakeJwt()

    const bigText = 'a'.repeat(110 * 1024)
    await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ prompt: bigText })
      .expect(413)

    process.env.GEMINI_API_KEY = 'AIzaRateLimitTestKey12345'
    globalThis.__SPENDWISE_E2E_GEMINI__ = () => ({
      generateContent: async () => ({ response: { text: () => 'ok' } }),
    })
    for (let i = 0; i < 20; i += 1) {
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ prompt: `Q${i}` })
        .expect(200)
    }
    const limited = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ prompt: 'Q21' })
      .expect(429)
    expect(limited.headers['retry-after']).toBeTruthy()
  })

  it('askGeminiAssistant rejects empty prompt locally without calling backend', async () => {
    const res = await askGeminiAssistant('   ')
    expect(res.source).toBe('validation_error')
    expect(res.error).toBeTruthy()
  })

  it('R2 #2 & #4: authMiddleware returns 504 on Supabase timeout & 401 on invalid token; aiRoutes returns 504 fallback on Gemini timeout', async () => {
    // 1. authMiddleware upstream timeout -> 504 in non-test mode
    process.env.NODE_ENV = 'production'
    process.env.SUPABASE_URL = 'https://mock-supabase.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'mock-anon-key'

    fetchBridge.restore()
    const timeoutBridge = installFetchBridge({
      onExternalFetch: async () => {
        const err = new Error('The operation timed out')
        err.name = 'TimeoutError'
        throw err
      },
    })
    envCtrl.onCleanup(() => timeoutBridge.restore())

    const app = createApp()
    const jwt1 = createFakeJwt({ sub: 'user-timeout-1' })
    const res504 = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${jwt1}`)
      .send({ prompt: 'Test timeout' })
      .expect(504)
    expect(res504.body.success).toBe(false)

    // 2. authMiddleware upstream 401 rejection -> 401
    timeoutBridge.restore()
    const rejectBridge = installFetchBridge({
      onExternalFetch: async () => new Response(JSON.stringify({ message: 'Invalid JWT' }), { status: 401 }),
    })
    envCtrl.onCleanup(() => rejectBridge.restore())

    const jwt2 = createFakeJwt({ sub: 'user-invalid-2' })
    await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${jwt2}`)
      .send({ prompt: 'Test invalid' })
      .expect(401)

    // 3. aiRoutes Gemini TimeoutError -> 504 with smart_context_advisor fallbackReply
    process.env.NODE_ENV = 'test'
    process.env.GEMINI_API_KEY = 'AQ.TimeoutTestKey12345'
    globalThis.__SPENDWISE_E2E_GEMINI__ = () => ({
      generateContent: async () => {
        const err = new Error('Gemini timeout')
        err.name = 'TimeoutError'
        throw err
      },
    })
    const aiTimeoutRes = await request(createApp())
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${createFakeJwt()}`)
      .send({ prompt: 'Hôm nay tiêu bao nhiêu?', context: { safe_to_spend_hom_nay: 200000 } })
      .expect(504)
    expect(aiTimeoutRes.body.mode).toBe('smart_context_advisor')
    expect(aiTimeoutRes.body.fallbackReply).toContain('200.000 VNĐ')
  })
})

// ============================================================================
// 11. GOAL_REC BOUNDARIES — 5 tests
// ============================================================================
describe('Tier 2 — Boundaries 11: GOAL_REC', () => {
  it('R3 #9: updateGoal rejects disallowed fields (current_amount, user_id, id) and enforces user_id scoping', async () => {
    const { data: goal } = await createGoal({ name: 'Quỹ khẩn cấp', target_amount: 10000000 })

    // Disallowed fields stripped on mixed payload, never modifying current_amount or user_id
    const updRes = await updateGoal(goal.id, {
      name: 'Quỹ mới',
      current_amount: 9999999,
      user_id: TEST_USER_B_ID,
      id: '99999999-9999-4999-8999-999999999999',
    })
    expect(updRes.error).toBeNull()
    const stored = harness.db.saving_goals.find((g) => g.id === goal.id)
    expect(stored.name).toBe('Quỹ mới')
    expect(stored.current_amount).toBe(0)
    expect(stored.user_id).toBe(TEST_USER_A_ID)

    // Disallowed-only payload must fail and perform zero DB mutation
    const disallowedRes = await updateGoal(goal.id, {
      current_amount: 9999999,
      user_id: TEST_USER_B_ID,
    })
    expect(disallowedRes.error).toBeInstanceOf(Error)
    const afterDisallowed = harness.db.saving_goals.find((g) => g.id === goal.id)
    expect(afterDisallowed.name).toBe('Quỹ mới')
    expect(afterDisallowed.current_amount).toBe(0)
    expect(afterDisallowed.user_id).toBe(TEST_USER_A_ID)

    // Verify explicit user_id scoping on updateGoal & deleteGoal
    harness.state.queryLog.length = 0
    await updateGoal(goal.id, { target_amount: 12000000 })
    const updLog = harness.state.queryLog.find((q) => q.table === 'saving_goals' && q.op === 'update')
    expect(updLog?.eqFilters.user_id).toBe(TEST_USER_A_ID)

    harness.state.queryLog.length = 0
    await deleteGoal(goal.id)
    const delLog = harness.state.queryLog.find((q) => q.table === 'saving_goals' && q.op === 'delete')
    expect(delLog?.eqFilters.user_id).toBe(TEST_USER_A_ID)
  })

  it('depositToGoal rejects <=0 amount, missing wallet/goal, over-target deposit, and insufficient balance', async () => {
    const { data: w } = await createWallet({ name: 'VCB', type: 'bank', balance: 500000 })
    const { data: g } = await createGoal({ name: 'Du lịch', target_amount: 1000000 })

    expect((await depositToGoal({ goalId: g.id, walletId: w.id, amount: 0 })).error).toBeTruthy()
    expect((await depositToGoal({ goalId: '', walletId: w.id, amount: 100 })).error).toBeTruthy()
    expect((await depositToGoal({ goalId: g.id, walletId: w.id, amount: 600000 })).error).toBeTruthy()

    await updateWallet(w.id, { balance: 2000000 })
    expect((await depositToGoal({ goalId: g.id, walletId: w.id, amount: 1200000 })).error).toBeTruthy()
  })

  it('createRecurringRule & updateRecurringRule reject invalid frequency, >2 decimal amount, and bad date', async () => {
    const { data: w } = await createWallet({ name: 'VCB', type: 'bank', balance: 1000000 })
    const cat = harness.db.categories.find((c) => c.name === 'Hóa đơn & Tiện ích')

    expect((await createRecurringRule({ wallet_id: w.id, category_id: cat.id, title: 'X', type: 'expense', amount: 100, frequency: 'hourly', next_due_date: '2026-12-01' })).error).toBeTruthy()
    expect((await createRecurringRule({ wallet_id: w.id, category_id: cat.id, title: 'X', type: 'expense', amount: 100.555, frequency: 'monthly', next_due_date: '2026-12-01' })).error).toBeTruthy()
    expect((await createRecurringRule({ wallet_id: w.id, category_id: cat.id, title: 'X', type: 'expense', amount: 100, frequency: 'monthly', next_due_date: '2026-02-30' })).error).toBeTruthy()

    const { data: rule } = await createRecurringRule({ wallet_id: w.id, category_id: cat.id, title: 'Y', type: 'expense', amount: 100, frequency: 'monthly', next_due_date: '2026-12-01' })
    expect((await updateRecurringRule(rule.id, { user_id: TEST_USER_B_ID })).error).toBeTruthy()
  })

  it('calculateNextDueDate throws on invalid date or unknown frequency', () => {
    expect(() => calculateNextDueDate('2026-02-29', 'monthly')).toThrow()
    expect(() => calculateNextDueDate('2026-11-26', 'quarterly')).toThrow()
  })

  it('RecurringPage uses ConfirmDialog/Toast (no window.confirm) and contains zero leaked dev notes (R4 #14, #15)', () => {
    const src = fs.readFileSync(getRepoPath('src/pages/RecurringPage.jsx'), 'utf8')
    expect(src).not.toMatch(/window\.confirm|alert\(/)
    expect(src).not.toMatch(/cần cập nhật schema|dữ liệu cũ|tài liệu Word/i)
  })
})

// ============================================================================
// 12. NOTI_QR BOUNDARIES — 5 tests
// ============================================================================
describe('Tier 2 — Boundaries 12: NOTI_QR', () => {
  it('R5 #22: splitBill clamps tipPercent at 50 and handles negative values and 0 people cleanly', () => {
    const capped = splitBill({ totalAmount: 1000000, numberOfPeople: 2, tipPercent: 200 })
    expect(capped.tipAmount).toBe(500000)
    expect(capped.totalAmountWithTip).toBe(1500000)
    expect(capped.amountPerPerson).toBe(750000)

    const minTip = splitBill({ totalAmount: 100000, numberOfPeople: 0, tipPercent: -10 })
    expect(minTip.tipAmount).toBe(0)
    expect(minTip.numberOfPeople).toBe(1)
  })

  it('R5 #22: BillSplitVietQR enforces tipPercent <= 50 cap and auto-resets copied state in source', () => {
    const src = fs.readFileSync(getRepoPath('src/pages/BillSplitVietQR.jsx'), 'utf8')
    expect(src).toMatch(/Math\.min\(\s*50/)
    expect(src).toMatch(/setCopied\(false\)/)
  })

  it('generateVietQrUrl returns empty string for invalid BIN, non-numeric account, or invalid template', () => {
    expect(generateVietQrUrl({ bankBin: '123', bankAccount: '0123456' })).toBe('')
    expect(generateVietQrUrl({ bankBin: '970436', bankAccount: 'abc' })).toBe('')
    expect(generateVietQrUrl({ bankBin: '970436', bankAccount: '012345', template: 'invalid' })).toBe('')
  })

  it('UC25 RLS: createNotification is blocked and direct client INSERT into notifications fails with 42501', async () => {
    const svcRes = await createNotification()
    expect(svcRes.error).toBeTruthy()

    const rlsRes = await harness.client.from('notifications').insert({
      user_id: TEST_USER_A_ID,
      title: 'Spoof',
      message: 'Fake',
      type: 'system',
    })
    expect(rlsRes.error.code).toBe('42501')

    const crossClear = await clearReadNotifications(TEST_USER_B_ID)
    expect(crossClear.error).toBeTruthy()
  })

  it('R3 #10: checkAndGenerateNotifications & SQL RPC count budget_exceeded (>=100%) strictly separate from budget_warning', async () => {
    const today = new Date()
    const month = today.getMonth() + 1
    const year = today.getFullYear()
    const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 5000000 })
    const foodCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    await createBudget({ category_id: foodCat.id, month, year, amount_limit: 500000 })
    await createTransaction({ wallet_id: cash.id, category_id: foodCat.id, type: 'expense', amount: 750000, transaction_date: todayStr, note: 'Over 150%' })

    const res = await checkAndGenerateNotifications({ daysAhead: 3 })
    expect(res.error).toBeNull()
    expect(res.data.budget_exceeded).toBe(1)
    expect(res.data.budget_warning).toBe(0)
  })
})

// ============================================================================
// 13. CROSS-CUTTING BOUNDARIES (Nav, Theme, ErrorBoundary, PWA, Tailwind) — 6 tests
// ============================================================================
describe('Tier 2 — Boundaries 13: Cross-Cutting', () => {
  it('R4 #12: Navbar strips "(Demo)" & punctuation from avatar initials ("Người dùng Thử nghiệm (Demo)" -> "TN", never "N(")', () => {
    const html = renderWithRouter(React.createElement(Navbar), {
      route: '/',
      auth: {
        user: { id: TEST_USER_A_ID, email: 'demo@spendwise.vn' },
        profile: { id: TEST_USER_A_ID, full_name: 'Người dùng Thử nghiệm (Demo)' },
        loading: false,
      },
    })
    expect(html).not.toContain('>N(<')
    expect(html).toContain('>TN<')

    const navSrc = fs.readFileSync(getRepoPath('src/components/layout/Navbar.jsx'), 'utf8')
    expect(navSrc).not.toContain('Phan Thanh Tùng')
  })

  it('R5 #17: ErrorBoundary catches thrown child render error and renders Vietnamese Double-Bezel fallback UI', async () => {
    const { ErrorBoundary } = await import('@/components/common/ErrorBoundary')
    const nextState = ErrorBoundary.getDerivedStateFromError(new Error('Boom render crash'))
    expect(nextState.hasError).toBe(true)

    const instance = new ErrorBoundary({ children: React.createElement('div', null, 'ok') })
    instance.state = nextState
    const html = renderToStaticMarkup(instance.render())
    expect(html).toMatch(/sự cố|Thử lại|Tải lại/i)
    expect(html).toContain('Boom render crash')
    expect(html).toContain('rounded-[2rem]')
  })

  it('R5 #21: Theme pre-paint script handles corrupted localStorage without throwing and applies .dark when saved="dark"', () => {
    const darkRun = runIndexPrePaintThemeScript({ savedTheme: 'dark', prefersDark: false })
    expect(darkRun.hasScript).toBe(true)
    expect(darkRun.isDark).toBe(true)

    const corruptRun = runIndexPrePaintThemeScript({ savedTheme: 'corrupted-value', prefersDark: false })
    expect(corruptRun.isDark).toBe(false)
  })

  it('R5 #19: sw.js skips non-GET, /api/*, supabase.co, generativelanguage.googleapis.com, and cross-origin requests', async () => {
    const sw = runSwInVm()
    const bypassed = await Promise.all([
      sw.dispatchFetch({ url: 'http://localhost:5173/api/ai/chat', method: 'GET' }),
      sw.dispatchFetch({ url: 'http://localhost:5173/transactions', method: 'POST' }),
      sw.dispatchFetch({ url: 'https://xyz.supabase.co/rest/v1/wallets', method: 'GET' }),
      sw.dispatchFetch({ url: 'https://generativelanguage.googleapis.com/v1beta/models', method: 'GET' }),
      sw.dispatchFetch({ url: 'https://img.vietqr.io/image/970436-123-compact.png', method: 'GET' }),
    ])
    expect(bypassed.every((r) => r.intercepted === false)).toBe(true)
  })

  it('R4 #16: zero banned invalid Tailwind v3 classes exist anywhere under src/', () => {
    const bannedPattern =
      /(?<![a-z0-9-])(animate-in|fade-in|zoom-in-95|slide-in-from-[a-z0-9-]+|backdrop-blur-xs|shadow-xs|shadow-2xs|no-scrollbar|shadow-soft-lg|shadow-soft-2xl)(?![a-z0-9-])/
    const files = listSourceFiles(getRepoPath('src'))
    const offenders = []
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8')
      const match = bannedPattern.exec(content)
      if (match) {
        offenders.push(`${path.relative(getRepoPath(), file)}: ${match[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('NotFoundPage renders 404 fallback without throwing on arbitrary bad route', () => {
    const html = renderWithRouter(React.createElement(NotFoundPage), { route: '/does-not-exist-123' })
    expect(html).toContain('404')
    expect(html).toContain('Trang không tồn tại')
  })

  it('R4 #11 & #12: getUserInitials handles Vietnamese annotations/emails & Navbar enforces single-line nowrap + mobile pill padding', () => {
    expect(getUserInitials('Người dùng Thử nghiệm (Demo)')).toBe('TN')
    expect(getUserInitials('Trần An [Admin]')).toBe('TA')
    expect(getUserInitials('Minh')).toBe('MI')
    expect(getUserInitials('', 'tung.dev@spendwise.vn')).toBe('TD')
    expect(getUserInitials('', '')).toBe('SW')

    const navHtml = renderWithRouter(React.createElement(Navbar), { route: '/' })
    expect(navHtml).toContain('whitespace-nowrap')
    expect(navHtml).toContain('p-1 2xl:pl-1 2xl:pr-2.5')
  })

  it('R4 #14 & R5 #17: Toast/ConfirmDialog render Double-Bezel Vietnamese UI, BudgetPage avoids alert/confirm, & ErrorBoundary resets on resetKey change', async () => {
    expect(renderToStaticMarkup(React.createElement(Toast, { show: false, message: 'Hidden' }))).toBe('')
    const toastHtml = renderToStaticMarkup(React.createElement(Toast, { show: true, message: 'Đã lưu ví!', type: 'success' }))
    expect(toastHtml).toContain('role="status"')
    expect(toastHtml).toContain('Đã lưu ví!')

    expect(renderToStaticMarkup(React.createElement(ConfirmDialog, { isOpen: false }))).toBe('')
    const dialogHtml = renderToStaticMarkup(
      React.createElement(ConfirmDialog, {
        isOpen: true,
        title: 'Xóa ngân sách?',
        message: 'Hành động này không thể hoàn tác.',
        onConfirm: () => {},
        onCancel: () => {},
      })
    )
    expect(dialogHtml).toContain('role="dialog"')
    expect(dialogHtml).toContain('Xóa ngân sách?')

    const budgetSrc = fs.readFileSync(getRepoPath('src/pages/BudgetPage.jsx'), 'utf8')
    expect(budgetSrc).not.toMatch(/window\.confirm|alert\(/)

    const { ErrorBoundary } = await import('@/components/common/ErrorBoundary')
    const resetState = ErrorBoundary.getDerivedStateFromProps(
      { resetKey: '/wallets' },
      { hasError: true, error: new Error('Boom'), prevResetKey: '/' }
    )
    expect(resetState).toEqual({ hasError: false, error: null, prevResetKey: '/wallets' })
  })
})
