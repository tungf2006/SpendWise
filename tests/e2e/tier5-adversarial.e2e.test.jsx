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

import {
  TEST_USER_A_ID,
  TEST_USER_B_ID,
  createEnvironmentController,
  createFakeJwt,
  installBrowserStubs,
  installSupabaseHarness,
  runSwInVm,
  todayVietnamDate,
} from './helpers/e2eHarness.js'
import { createApp } from '../../server/app.js'
import { clearAuthCache } from '../../server/middleware/authMiddleware.js'
import { resetRateLimiters } from '../../server/middleware/rateLimiter.js'
import { createWallet, updateWallet, deleteWallet } from '@/services/walletService'
import { createCategory, updateCategory, deleteCategory } from '@/services/categoryService'
import { createTransaction, updateTransaction } from '@/services/transactionService'
import { checkAndGenerateRecurringTransactions } from '@/services/recurringService'
import { checkAndGenerateNotifications } from '@/services/notificationService'

let envCtrl
let harness

beforeEach(() => {
  envCtrl = createEnvironmentController()
  process.env.NODE_ENV = 'test'
  envCtrl.resetRuntime()
  clearAuthCache()
  resetRateLimiters()
  harness = installSupabaseHarness()
  installBrowserStubs()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  clearAuthCache()
  resetRateLimiters()
  envCtrl.restore()
})

describe('Tier 5 — Adversarial Harness RLS, SW Cache, Service Parity & Auth 502', () => {
  it('1. e2eHarness enforces RLS on .insert() and .upsert() (unauthenticated 28000 & cross-tenant 42501)', async () => {
    // Unauthenticated client
    const unauthHarness = installSupabaseHarness({ initialUser: null })

    const unauthInsert = await unauthHarness.client.from('wallets').insert({
      user_id: TEST_USER_A_ID,
      name: 'Ví lậu',
      type: 'cash',
      balance: 100000,
    })
    expect(unauthInsert.error?.code).toBe('28000')
    expect(unauthHarness.db.wallets).toHaveLength(0)

    const unauthUpsert = await unauthHarness.client.from('profiles').upsert({
      id: TEST_USER_A_ID,
      full_name: 'Hacker',
    })
    expect(unauthUpsert.error?.code).toBe('28000')

    // Authenticated as User A attempting cross-tenant writes or forged system category
    harness = installSupabaseHarness()

    const crossWalletInsert = await harness.client.from('wallets').insert({
      user_id: TEST_USER_B_ID,
      name: 'Ví User B',
      type: 'cash',
      balance: 500000,
    })
    expect(crossWalletInsert.error?.code).toBe('42501')
    expect(harness.db.wallets).toHaveLength(0)

    const crossProfileUpsert = await harness.client.from('profiles').upsert({
      id: TEST_USER_B_ID,
      full_name: 'Spoofed B',
    })
    expect(crossProfileUpsert.error?.code).toBe('42501')
    expect(harness.db.profiles.some((p) => p.id === TEST_USER_B_ID)).toBe(false)

    const forgedSysCat = await harness.client.from('categories').insert({
      user_id: null,
      name: 'Fake System Cat',
      type: 'expense',
    })
    expect(forgedSysCat.error?.code).toBe('42501')

    const crossBudgetUpsert = await harness.client.from('budgets').upsert({
      user_id: TEST_USER_B_ID,
      category_id: harness.db.categories[0].id,
      month: 11,
      year: 2026,
      amount_limit: 1000000,
    })
    expect(crossBudgetUpsert.error?.code).toBe('42501')
    expect(harness.db.budgets).toHaveLength(0)

    const notiUpsert = await harness.client.from('notifications').upsert({
      user_id: TEST_USER_A_ID,
      type: 'system',
      title: 'Bypass',
      message: 'Should fail',
    })
    expect(notiUpsert.error?.code).toBe('42501')
    expect(harness.db.notifications).toHaveLength(0)
  })

  it('2. sw.js supports >=3 consecutive offline navigation reads without Body-already-read error', async () => {
    let online = true
    const sw = runSwInVm({
      fetchImpl: async () => {
        if (!online) throw new Error('Network offline')
        return new Response('<html>SpendWise Shell</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      },
    })

    await sw.dispatchLifecycle('install')
    await sw.dispatchLifecycle('activate')

    // Prime cache while online
    const firstOnline = await sw.dispatchFetch({
      url: 'http://localhost:5173/dashboard',
      mode: 'navigate',
      accept: 'text/html',
    })
    expect(firstOnline.intercepted).toBe(true)
    expect(await firstOnline.response.text()).toBe('<html>SpendWise Shell</html>')

    // Go offline and read the cached navigation response 3 consecutive times
    online = false
    for (let i = 0; i < 3; i += 1) {
      const offlineNav = await sw.dispatchFetch({
        url: 'http://localhost:5173/transactions',
        mode: 'navigate',
        accept: 'text/html',
      })
      expect(offlineNav.intercepted).toBe(true)
      expect(offlineNav.response.status).toBe(200)
      const body = await offlineNav.response.text()
      expect(body).toBe('<html>SpendWise Shell</html>')
    }
  })

  it('3. transactionService.updateTransaction fallback clears category_id on type flip and computes exact transfer <-> expense Net Deltas', async () => {
    harness = installSupabaseHarness({ rpcMissing: true })
    const { data: w1 } = await createWallet({ name: 'VCB', type: 'bank', balance: 500000 })
    const { data: w2 } = await createWallet({ name: 'MoMo', type: 'ewallet', balance: 100000 })
    const expCat = harness.db.categories.find((c) => c.name === 'Ăn uống')
    const incCat = harness.db.categories.find((c) => c.name === 'Lương')

    // 3a. Expense -> Income without category_id clears mismatched expense category_id
    const { data: txn1 } = await createTransaction({
      wallet_id: w1.id,
      category_id: expCat.id,
      type: 'expense',
      amount: 50000,
      transaction_date: '2026-11-26',
      note: 'Nhầm loại',
    })
    expect(harness.db.wallets.find((w) => w.id === w1.id).balance).toBe(450000)

    const flipped = await updateTransaction(txn1.id, { type: 'income' })
    expect(flipped.error).toBeNull()
    expect(flipped.data.type).toBe('income')
    expect(flipped.data.category_id).toBeNull()
    expect(harness.db.wallets.find((w) => w.id === w1.id).balance).toBe(550000)

    // 3b. Income -> Expense with explicit expense category preserves explicit category_id
    const flippedWithCat = await updateTransaction(txn1.id, {
      type: 'expense',
      category_id: expCat.id,
    })
    expect(flippedWithCat.error).toBeNull()
    expect(flippedWithCat.data.category_id).toBe(expCat.id)
    expect(harness.db.wallets.find((w) => w.id === w1.id).balance).toBe(450000)

    // 3c. Expense -> Transfer: refunds expense on w1, deducts transfer on w1, adds w2, clears category_id
    const toTransfer = await updateTransaction(txn1.id, {
      type: 'transfer',
      to_wallet_id: w2.id,
      amount: 100000,
    })
    expect(toTransfer.error).toBeNull()
    expect(toTransfer.data.type).toBe('transfer')
    expect(toTransfer.data.category_id).toBeNull()
    expect(toTransfer.data.to_wallet_id).toBe(w2.id)
    expect(harness.db.wallets.find((w) => w.id === w1.id).balance).toBe(400000)
    expect(harness.db.wallets.find((w) => w.id === w2.id).balance).toBe(200000)

    // 3d. Transfer -> Expense: reverses transfer on w1/w2, applies new expense on w1, clears to_wallet_id
    const backToExpense = await updateTransaction(txn1.id, {
      type: 'expense',
      category_id: expCat.id,
      amount: 150000,
    })
    expect(backToExpense.error).toBeNull()
    expect(backToExpense.data.type).toBe('expense')
    expect(backToExpense.data.to_wallet_id).toBeNull()
    expect(backToExpense.data.category_id).toBe(expCat.id)
    expect(harness.db.wallets.find((w) => w.id === w1.id).balance).toBe(350000)
    expect(harness.db.wallets.find((w) => w.id === w2.id).balance).toBe(100000)

    // Sanity check income category exists
    expect(incCat.type).toBe('income')
  })

  it('4. walletService & categoryService enforce auth, ownership scoping, disallowed-only rejection, and valid type', async () => {
    const { data: wA } = await createWallet({ name: 'Ví User A', type: 'cash', balance: 300000 })
    const { data: cA } = await createCategory({ name: 'Mèo cưng', type: 'expense', keywords: 'meo' })

    // Disallowed-only & invalid type rejections
    const badWalletUpd = await updateWallet(wA.id, { user_id: TEST_USER_B_ID, id: 'spoof' })
    expect(badWalletUpd.error).toBeInstanceOf(Error)
    expect(harness.db.wallets.find((w) => w.id === wA.id).user_id).toBe(TEST_USER_A_ID)

    const badCatType = await updateCategory(cA.id, { type: 'bogus_type' })
    expect(badCatType.error).toBeInstanceOf(Error)
    expect(harness.db.categories.find((c) => c.id === cA.id).type).toBe('expense')

    const badCatUpd = await updateCategory(cA.id, { user_id: TEST_USER_B_ID })
    expect(badCatUpd.error).toBeInstanceOf(Error)

    // Cross-tenant attempt by User B against User A records
    harness.setUser({ id: TEST_USER_B_ID, email: 'userb@spendwise.vn' })

    const crossWalletUpdate = await updateWallet(wA.id, { name: 'Bị cướp' })
    expect(crossWalletUpdate.error).toBeTruthy()
    const crossWalletDelete = await deleteWallet(wA.id)
    expect(crossWalletDelete.error).toBeNull() // delete affects 0 owned rows
    expect(harness.db.wallets.find((w) => w.id === wA.id).name).toBe('Ví User A')

    const crossCatUpdate = await updateCategory(cA.id, { name: 'Cướp danh mục' })
    expect(crossCatUpdate.error).toBeTruthy()
    await deleteCategory(cA.id)
    expect(harness.db.categories.find((c) => c.id === cA.id).name).toBe('Mèo cưng')

    // Unauthenticated attempt
    harness.setUser(null)
    expect((await updateWallet(wA.id, { name: 'NoAuth' })).error).toBeInstanceOf(Error)
    expect((await deleteWallet(wA.id)).error).toBeInstanceOf(Error)
    expect((await updateCategory(cA.id, { name: 'NoAuth' })).error).toBeInstanceOf(Error)
    expect((await deleteCategory(cA.id)).error).toBeInstanceOf(Error)
  })

  it('5. authMiddleware returns 502 (not 401) when Supabase Auth upstream returns 5xx', async () => {
    process.env.NODE_ENV = 'production'
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-test-key'

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })
    vi.stubGlobal('fetch', fetchMock)

    const app = createApp()
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${createFakeJwt()}`)
      .send({ prompt: 'Kiểm tra outage' })

    expect(res.status).toBe(502)
    expect(res.body.success).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('6. UTC+7 midnight safety: todayVietnamDate aligns with RPCs at 20:00Z (03:00+07:00)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-26T20:00:00Z')) // 2026-11-27 03:00+07:00

    const vnToday = todayVietnamDate()
    expect(vnToday).toBe('2026-11-27')
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-11-26')

    const { data: cash } = await createWallet({ name: 'Tiền mặt', type: 'cash', balance: 1000000 })
    const cat = harness.db.categories.find((c) => c.name === 'Ăn uống')

    const { error: ruleErr } = await harness.client.from('recurring_rules').insert({
      user_id: TEST_USER_A_ID,
      wallet_id: cash.id,
      category_id: cat.id,
      title: 'Ăn sáng hàng ngày',
      type: 'expense',
      amount: 30000,
      frequency: 'daily',
      next_due_date: vnToday,
      is_active: true,
    })
    expect(ruleErr).toBeNull()

    const notiSync = await checkAndGenerateNotifications({ daysAhead: 0 })
    expect(notiSync.error).toBeNull()
    expect(notiSync.data.recurring_due).toBe(1)

    const genRes = await checkAndGenerateRecurringTransactions()
    expect(genRes.error).toBeNull()
    expect(genRes.data.generatedCount).toBe(1)
  })
})
