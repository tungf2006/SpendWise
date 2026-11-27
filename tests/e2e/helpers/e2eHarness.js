import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import request from 'supertest'
import { AuthContext } from '@/context/useAuth'
import { removeVietnameseTones } from '@/utils/unaccent'
import { createApp } from '../../../server/app.js'
import { clearAuthCache } from '../../../server/middleware/authMiddleware.js'
import { resetRateLimiters } from '../../../server/middleware/rateLimiter.js'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')

export const TEST_USER_A_ID = '11111111-1111-4111-8111-111111111111'
export const TEST_USER_B_ID = '22222222-2222-4222-8222-222222222222'

export function makeUuid() {
  return crypto.randomUUID()
}

export function createFakeJwt(overrides = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const nowSec = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(
    JSON.stringify({
      sub: TEST_USER_A_ID,
      email: 'demo@spendwise.vn',
      role: 'authenticated',
      iat: nowSec,
      exp: nowSec + 3600,
      ...overrides,
    })
  ).toString('base64url')
  return `${header}.${payload}.fake-signature`
}

export function todayVietnamDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function advanceDateUtc(dateStr, frequency, dayOfMonth = null) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (frequency === 'daily') {
    const next = new Date(Date.UTC(y, m - 1, d + 1))
    return next.toISOString().slice(0, 10)
  }
  if (frequency === 'weekly') {
    const next = new Date(Date.UTC(y, m - 1, d + 7))
    return next.toISOString().slice(0, 10)
  }
  if (frequency === 'monthly') {
    const origDay = dayOfMonth ?? d
    const nextMonth = new Date(Date.UTC(y, m, 1))
    const maxDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate()
    nextMonth.setUTCDate(Math.min(origDay, maxDay))
    return nextMonth.toISOString().slice(0, 10)
  }
  const nextYear = y + 1
  const maxDay = new Date(Date.UTC(nextYear, m, 0)).getUTCDate()
  return new Date(Date.UTC(nextYear, m - 1, Math.min(d, maxDay))).toISOString().slice(0, 10)
}

function cloneRow(row) {
  return row == null ? row : structuredClone(row)
}

function matchesOrCondition(row, expr) {
  const parts = String(expr).split(',').map((s) => s.trim()).filter(Boolean)
  return parts.some((part) => {
    const eqMatch = /^([a-zA-Z0-9_]+)\.eq\.(.+)$/.exec(part)
    if (eqMatch) {
      return String(row[eqMatch[1]] ?? '') === eqMatch[2]
    }
    return false
  })
}

export function createSupabaseHarness({
  initialUser = {
    id: TEST_USER_A_ID,
    email: 'demo@spendwise.vn',
    user_metadata: { full_name: 'Nguyễn Văn Demo' },
  },
  rpcMissing = false,
  seedSystemCategories = true,
} = {}) {
  const db = {
    profiles: [],
    wallets: [],
    categories: [],
    transactions: [],
    budgets: [],
    saving_goals: [],
    recurring_rules: [],
    notifications: [],
  }

  if (seedSystemCategories) {
    db.categories.push(
      { id: 'aaaa0001-0000-4000-8000-000000000001', user_id: null, name: 'Ăn uống', type: 'expense', keywords: ['an', 'uong', 'com', 'pho', 'cafe', 'tra sua'], icon: 'utensils', color: '#F97316' },
      { id: 'aaaa0002-0000-4000-8000-000000000002', user_id: null, name: 'Di chuyển', type: 'expense', keywords: ['xang', 'grab', 'be', 'taxi', 'xe buyt'], icon: 'car', color: '#3B82F6' },
      { id: 'aaaa0003-0000-4000-8000-000000000003', user_id: null, name: 'Hóa đơn & Tiện ích', type: 'expense', keywords: ['tien nha', 'dien', 'nuoc', 'internet', 'wifi'], icon: 'receipt', color: '#8B5CF6' },
      { id: 'aaaa0004-0000-4000-8000-000000000004', user_id: null, name: 'Mua sắm', type: 'expense', keywords: ['shopee', 'lazada', 'sieu thi', 'mua sam'], icon: 'shopping-bag', color: '#EC4899' },
      { id: 'aaaa0005-0000-4000-8000-000000000005', user_id: null, name: 'Y tế & Sức khỏe', type: 'expense', keywords: ['thuoc', 'benh vien', 'kham benh', 'gym'], icon: 'heart', color: '#EF4444' },
      { id: 'aaaa0006-0000-4000-8000-000000000006', user_id: null, name: 'Lương', type: 'income', keywords: ['luong', 'salary'], icon: 'banknote', color: '#10B981' },
      { id: 'aaaa0007-0000-4000-8000-000000000007', user_id: null, name: 'Thưởng & Thu nhập phụ', type: 'income', keywords: ['thuong', 'bonus', 'freelance'], icon: 'gift', color: '#14B8A6' }
    )
  }

  let currentUser = initialUser ? cloneRow(initialUser) : null
  let currentSession = currentUser
    ? {
        access_token: createFakeJwt({ sub: currentUser.id, email: currentUser.email }),
        user: cloneRow(currentUser),
      }
    : null
  const authListeners = new Set()
  const usersByEmail = new Map()
  if (currentUser) {
    usersByEmail.set(currentUser.email, { user: cloneRow(currentUser), password: 'Password123!' })
    db.profiles.push({
      id: currentUser.id,
      full_name: currentUser.user_metadata?.full_name || 'Nguyễn Văn Demo',
      avatar_url: null,
      default_bank_bin: '970436',
      default_bank_account: '0123456789',
      updated_at: new Date().toISOString(),
    })
  }

  const state = {
    rpcMissing,
    missingView: false,
    injectedErrors: new Map(), // key: `${table}:${op}` -> Error | { message, code }
    rpcCalls: [],
    queryLog: [],
    authEvents: [],
    onAuthCodeExchange: null,
  }

  function isRpcMissing(name) {
    if (state.rpcMissing === true) return true
    if (state.rpcMissing instanceof Set) return state.rpcMissing.has(name)
    if (Array.isArray(state.rpcMissing)) return state.rpcMissing.includes(name)
    return false
  }

  function emitAuth(event, session) {
    for (const cb of authListeners) {
      cb(event, session)
    }
  }

  function hydrateRow(table, row) {
    const out = cloneRow(row)
    if (table === 'transactions') {
      const w = db.wallets.find((item) => item.id === out.wallet_id)
      const tw = out.to_wallet_id ? db.wallets.find((item) => item.id === out.to_wallet_id) : null
      const c = out.category_id ? db.categories.find((item) => item.id === out.category_id) : null
      out.wallet = w ? { id: w.id, name: w.name, color: w.color, icon: w.icon } : null
      out.to_wallet = tw ? { id: tw.id, name: tw.name, color: tw.color, icon: tw.icon } : null
      out.category = c ? { id: c.id, name: c.name, color: c.color, icon: c.icon } : null
    } else if (table === 'budgets') {
      const c = db.categories.find((item) => item.id === out.category_id)
      out.category = c ? { id: c.id, name: c.name, color: c.color, icon: c.icon } : null
    } else if (table === 'saving_goals') {
      const w = out.wallet_id ? db.wallets.find((item) => item.id === out.wallet_id) : null
      out.wallet = w ? { id: w.id, name: w.name, color: w.color, icon: w.icon } : null
    } else if (table === 'recurring_rules') {
      const w = db.wallets.find((item) => item.id === out.wallet_id)
      const c = db.categories.find((item) => item.id === out.category_id)
      out.wallet = w ? { id: w.id, name: w.name, color: w.color, icon: w.icon } : null
      out.category = c ? { id: c.id, name: c.name, color: c.color, icon: c.icon } : null
    }
    return out
  }

  function getRowsForViewOrTable(table) {
    if (table === 'v_budget_progress') {
      return db.budgets.map((b) => {
        const cat = db.categories.find((c) => c.id === b.category_id)
        const monthPrefix = `${b.year}-${String(b.month).padStart(2, '0')}-`
        const spent = db.transactions
          .filter(
            (t) =>
              t.user_id === b.user_id &&
              t.type === 'expense' &&
              t.category_id === b.category_id &&
              String(t.transaction_date).startsWith(monthPrefix)
          )
          .reduce((sum, t) => sum + Number(t.amount || 0), 0)
        return {
          budget_id: b.id,
          user_id: b.user_id,
          category_id: b.category_id,
          category_name: cat?.name || 'Khác',
          category_color: cat?.color || '#94A3B8',
          category_icon: cat?.icon || 'tag',
          month: b.month,
          year: b.year,
          budget_amount: Number(b.amount_limit),
          spent_amount: spent,
        }
      })
    }
    return db[table] || []
  }

  function applyRlsReadFilter(table, rows) {
    if (!currentUser) return []
    if (table === 'profiles') return rows.filter((r) => r.id === currentUser.id)
    if (table === 'categories') return rows.filter((r) => r.user_id === null || r.user_id === currentUser.id)
    return rows.filter((r) => r.user_id === currentUser.id)
  }

  function buildQuery(table) {
    const ctx = {
      op: 'select',
      selectMeta: null,
      payload: null,
      upsertOpts: null,
      filters: [],
      eqFilters: {},
      orders: [],
      rangeArgs: null,
      limitCount: null,
      expectSingle: false,
      expectMaybeSingle: false,
    }

    const execute = async () => {
      state.queryLog.push({
        table,
        op: ctx.op,
        eqFilters: { ...ctx.eqFilters },
        payload: cloneRow(ctx.payload),
      })
      const injectedKey = `${table}:${ctx.op}`
      if (state.injectedErrors.has(injectedKey)) {
        const err = state.injectedErrors.get(injectedKey)
        if (typeof err === 'function') {
          const maybeErr = err(ctx)
          if (maybeErr) return { data: null, count: 0, error: maybeErr }
        } else {
          return { data: null, count: 0, error: err }
        }
      }

      if (table === 'v_budget_progress' && state.missingView) {
        return { data: null, count: 0, error: { code: '42P01', message: 'relation "public.v_budget_progress" does not exist' } }
      }

      if (ctx.op === 'insert') {
        if (!currentUser) {
          return { data: null, error: { code: '28000', message: 'Unauthorized' } }
        }
        if (table === 'notifications') {
          return {
            data: null,
            error: {
              code: '42501',
              message: 'new row violates row-level security policy for table "notifications"',
            },
          }
        }
        const items = Array.isArray(ctx.payload) ? ctx.payload : [ctx.payload]
        for (const item of items) {
          const violatesRls =
            table === 'profiles'
              ? item?.id !== currentUser.id
              : item?.user_id !== currentUser.id
          if (violatesRls) {
            return {
              data: null,
              error: {
                code: '42501',
                message: `new row violates row-level security policy for table "${table}"`,
              },
            }
          }
        }
        const inserted = []
        for (const item of items) {
          const row = cloneRow(item)
          if (!row.id) row.id = makeUuid()
          if (!row.created_at) row.created_at = new Date().toISOString()
          if (table === 'transactions' && !row.note_unaccent) {
            row.note_unaccent = removeVietnameseTones(row.note || '')
          }
          if (table === 'budgets') {
            const duplicate = db.budgets.some(
              (b) =>
                b.user_id === row.user_id &&
                b.category_id === row.category_id &&
                b.month === row.month &&
                b.year === row.year
            )
            if (duplicate) {
              return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
            }
          }
          db[table].push(row)
          inserted.push(hydrateRow(table, row))
        }
        const out = ctx.expectSingle ? inserted[0] ?? null : inserted
        return { data: out, error: null }
      }

      if (ctx.op === 'upsert') {
        if (!currentUser) {
          return { data: null, error: { code: '28000', message: 'Unauthorized' } }
        }
        if (table === 'notifications') {
          return {
            data: null,
            error: {
              code: '42501',
              message: 'new row violates row-level security policy for table "notifications"',
            },
          }
        }
        const items = Array.isArray(ctx.payload) ? ctx.payload : [ctx.payload]
        for (const item of items) {
          const violatesRls =
            table === 'profiles'
              ? item?.id !== currentUser.id
              : item?.user_id !== currentUser.id
          if (violatesRls) {
            return {
              data: null,
              error: {
                code: '42501',
                message: `new row violates row-level security policy for table "${table}"`,
              },
            }
          }
        }
        const results = []
        for (const item of items) {
          const row = cloneRow(item)
          let existingIdx = -1
          if (table === 'profiles') {
            existingIdx = db.profiles.findIndex((p) => p.id === row.id)
          } else if (table === 'budgets') {
            existingIdx = db.budgets.findIndex(
              (b) =>
                b.user_id === row.user_id &&
                b.category_id === row.category_id &&
                b.month === row.month &&
                b.year === row.year
            )
          }
          if (existingIdx >= 0) {
            const existing = db[table][existingIdx]
            const existingOwned =
              table === 'profiles'
                ? existing.id === currentUser.id
                : existing.user_id === currentUser.id
            if (!existingOwned) {
              return {
                data: null,
                error: {
                  code: '42501',
                  message: `new row violates row-level security policy for table "${table}"`,
                },
              }
            }
            if (!ctx.upsertOpts?.ignoreDuplicates) {
              db[table][existingIdx] = { ...existing, ...row }
            }
            results.push(hydrateRow(table, db[table][existingIdx]))
          } else {
            if (!row.id) row.id = makeUuid()
            if (!row.created_at) row.created_at = new Date().toISOString()
            db[table].push(row)
            results.push(hydrateRow(table, row))
          }
        }
        const out = ctx.expectSingle ? results[0] ?? null : results
        return { data: out, error: null }
      }

      if (ctx.op === 'update') {
        if (!currentUser) {
          return { data: null, error: { code: '28000', message: 'Unauthorized' } }
        }
        const rows = db[table] || []
        const updated = []
        for (let i = 0; i < rows.length; i += 1) {
          const r = rows[i]
          const owned =
            table === 'profiles'
              ? r.id === currentUser.id
              : r.user_id === currentUser.id
          if (!owned) continue
          if (!ctx.filters.every((fn) => fn(r))) continue
          const patch = cloneRow(ctx.payload)
          if (table === 'transactions' && 'note' in patch && !('note_unaccent' in patch)) {
            patch.note_unaccent = removeVietnameseTones(patch.note || '')
          }
          rows[i] = { ...r, ...patch }
          updated.push(hydrateRow(table, rows[i]))
        }
        if (ctx.expectSingle) {
          if (updated.length === 0) {
            return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
          }
          return { data: updated[0], error: null }
        }
        if (ctx.expectMaybeSingle) {
          return { data: updated[0] ?? null, error: null }
        }
        return { data: updated, error: null }
      }

      if (ctx.op === 'delete') {
        if (!currentUser) {
          return { data: null, error: { code: '28000', message: 'Unauthorized' } }
        }
        const rows = db[table] || []
        const deleted = []
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          const r = rows[i]
          const owned =
            table === 'profiles'
              ? r.id === currentUser.id
              : r.user_id === currentUser.id
          if (!owned) continue
          if (!ctx.filters.every((fn) => fn(r))) continue

          if (table === 'categories') {
            const hasRef =
              db.transactions.some((t) => t.category_id === r.id) ||
              db.budgets.some((b) => b.category_id === r.id) ||
              db.recurring_rules.some((rule) => rule.category_id === r.id)
            if (hasRef) {
              return { data: null, error: { code: '23503', message: 'update or delete on table "categories" violates foreign key constraint' } }
            }
          }
          if (table === 'wallets') {
            const hasRef = db.transactions.some((t) => t.wallet_id === r.id || t.to_wallet_id === r.id)
            if (hasRef) {
              return { data: null, error: { code: '23503', message: 'update or delete on table "wallets" violates foreign key constraint' } }
            }
          }

          deleted.unshift(hydrateRow(table, r))
          rows.splice(i, 1)
        }
        if (ctx.expectMaybeSingle) {
          return { data: deleted[0] ?? null, error: null }
        }
        if (ctx.expectSingle) {
          if (!deleted.length) {
            return { data: null, error: { code: 'PGRST116', message: 'No rows deleted' } }
          }
          return { data: deleted[0], error: null }
        }
        return { data: deleted, error: null }
      }

      // SELECT
      const baseRows = applyRlsReadFilter(table, getRowsForViewOrTable(table))
      let matched = baseRows.filter((r) => ctx.filters.every((fn) => fn(r)))

      if (ctx.orders.length > 0) {
        matched = [...matched].sort((a, b) => {
          for (const ord of ctx.orders) {
            const av = a[ord.column] ?? ''
            const bv = b[ord.column] ?? ''
            if (av < bv) return ord.ascending ? -1 : 1
            if (av > bv) return ord.ascending ? 1 : -1
          }
          return 0
        })
      }

      const totalCount = matched.length
      if (ctx.rangeArgs) {
        matched = matched.slice(ctx.rangeArgs[0], ctx.rangeArgs[1] + 1)
      } else if (typeof ctx.limitCount === 'number') {
        matched = matched.slice(0, ctx.limitCount)
      }

      if (ctx.selectMeta?.head) {
        return { data: null, count: totalCount, error: null }
      }

      const hydrated = matched.map((r) => hydrateRow(table, r))
      if (ctx.expectSingle) {
        if (hydrated.length !== 1) {
          return { data: null, count: totalCount, error: { code: 'PGRST116', message: 'Single row expected' } }
        }
        return { data: hydrated[0], count: totalCount, error: null }
      }
      if (ctx.expectMaybeSingle) {
        return { data: hydrated[0] ?? null, count: totalCount, error: null }
      }
      return { data: hydrated, count: totalCount, error: null }
    }

    const builder = {
      select(_columns, opts) {
        ctx.selectMeta = opts || null
        return builder
      },
      insert(payload) {
        ctx.op = 'insert'
        ctx.payload = payload
        return builder
      },
      upsert(payload, opts) {
        ctx.op = 'upsert'
        ctx.payload = payload
        ctx.upsertOpts = opts || null
        return builder
      },
      update(payload) {
        ctx.op = 'update'
        ctx.payload = payload
        return builder
      },
      delete() {
        ctx.op = 'delete'
        return builder
      },
      eq(col, val) {
        ctx.eqFilters[col] = val
        ctx.filters.push((row) => row[col] === val)
        return builder
      },
      gte(col, val) {
        ctx.filters.push((row) => String(row[col] ?? '') >= String(val))
        return builder
      },
      lt(col, val) {
        ctx.filters.push((row) => String(row[col] ?? '') < String(val))
        return builder
      },
      lte(col, val) {
        ctx.filters.push((row) => String(row[col] ?? '') <= String(val))
        return builder
      },
      in(col, values) {
        const set = new Set(values || [])
        ctx.filters.push((row) => set.has(row[col]))
        return builder
      },
      or(expr) {
        ctx.filters.push((row) => matchesOrCondition(row, expr))
        return builder
      },
      ilike(col, pattern) {
        const needle = String(pattern || '').replace(/%/g, '').toLowerCase()
        ctx.filters.push((row) => String(row[col] ?? '').toLowerCase().includes(needle))
        return builder
      },
      not(col, op, val) {
        if (op === 'is' && val === null) {
          ctx.filters.push((row) => row[col] !== null && row[col] !== undefined)
        }
        return builder
      },
      order(column, { ascending = true } = {}) {
        ctx.orders.push({ column, ascending })
        return builder
      },
      range(from, to) {
        ctx.rangeArgs = [from, to]
        return builder
      },
      limit(count) {
        ctx.limitCount = count
        return builder
      },
      single() {
        ctx.expectSingle = true
        return execute()
      },
      maybeSingle() {
        ctx.expectMaybeSingle = true
        return execute()
      },
      then(resolve, reject) {
        return execute().then(resolve, reject)
      },
    }

    return builder
  }

  async function handleRpc(fnName, params = {}) {
    state.rpcCalls.push({ name: fnName, params: cloneRow(params) })
    if (isRpcMissing(fnName)) {
      return {
        data: null,
        error: {
          code: 'PGRST202',
          message: `Could not find the function public.${fnName} in the schema cache`,
        },
      }
    }

    if (!currentUser) {
      return { data: null, error: { code: '28000', message: 'Người dùng chưa đăng nhập' } }
    }

    if (fnName === 'transfer_funds') {
      const fromW = db.wallets.find((w) => w.id === params.p_from_wallet_id && w.user_id === currentUser.id)
      const toW = db.wallets.find((w) => w.id === params.p_to_wallet_id && w.user_id === currentUser.id)
      const amount = Number(params.p_amount)
      if (!fromW || !toW) return { data: null, error: new Error('Không tìm thấy ví nguồn hoặc ví đích') }
      if (fromW.id === toW.id) return { data: null, error: new Error('Ví nguồn và ví đích không được trùng nhau') }
      if (!Number.isFinite(amount) || amount <= 0) return { data: null, error: new Error('Số tiền chuyển phải lớn hơn 0') }
      if (Number(fromW.balance) < amount) return { data: null, error: new Error('Số dư ví nguồn không đủ để thực hiện chuyển tiền') }

      fromW.balance = Number(fromW.balance) - amount
      toW.balance = Number(toW.balance) + amount
      const txnDate = params.p_date || todayVietnamDate()
      const note = params.p_note || `Chuyển từ ${fromW.name} sang ${toW.name}`
      const txn = {
        id: makeUuid(),
        user_id: currentUser.id,
        wallet_id: fromW.id,
        to_wallet_id: toW.id,
        category_id: null,
        type: 'transfer',
        amount,
        transaction_date: txnDate,
        note,
        note_unaccent: removeVietnameseTones(note),
        created_at: new Date().toISOString(),
      }
      db.transactions.push(txn)
      return {
        data: {
          transactionId: txn.id,
          fromWalletBalance: fromW.balance,
          toWalletBalance: toW.balance,
          amount,
          transactionDate: txnDate,
          note,
        },
        error: null,
      }
    }

    if (fnName === 'deposit_to_goal') {
      const goal = db.saving_goals.find((g) => g.id === params.p_goal_id && g.user_id === currentUser.id)
      const wallet = db.wallets.find((w) => w.id === params.p_wallet_id && w.user_id === currentUser.id)
      const amount = Number(params.p_amount)
      if (!goal) return { data: null, error: new Error('Không tìm thấy mục tiêu tiết kiệm') }
      if (!wallet) return { data: null, error: new Error('Không tìm thấy ví nguồn') }
      if (wallet.is_archived) return { data: null, error: new Error('Ví nguồn đã được lưu trữ') }
      if (!Number.isFinite(amount) || amount <= 0) return { data: null, error: new Error('Số tiền nạp phải lớn hơn 0') }
      if (Number(wallet.balance) < amount) return { data: null, error: new Error('Số dư ví nguồn không đủ') }
      const nextGoalAmount = Number(goal.current_amount || 0) + amount
      if (nextGoalAmount > Number(goal.target_amount)) {
        return { data: null, error: new Error('Số tiền nạp vượt quá mục tiêu còn lại') }
      }
      wallet.balance = Number(wallet.balance) - amount
      goal.current_amount = nextGoalAmount
      if (goal.current_amount >= Number(goal.target_amount)) {
        goal.status = 'completed'
      }
      return { data: hydrateRow('saving_goals', goal), error: null }
    }

    if (fnName === 'create_transaction_atomic') {
      const amount = Number(params.p_amount)
      const type = params.p_type
      if (type === 'transfer') {
        return { data: null, error: new Error('Giao dịch chuyển tiền phải sử dụng transfer_funds') }
      }
      if (!['income', 'expense'].includes(type) || !Number.isFinite(amount) || amount <= 0) {
        return { data: null, error: new Error('Dữ liệu giao dịch không hợp lệ') }
      }
      const wallet = db.wallets.find((w) => w.id === params.p_wallet_id && w.user_id === currentUser.id)
      if (!wallet || wallet.is_archived) {
        return { data: null, error: new Error('Không tìm thấy ví thanh toán hợp lệ') }
      }
      const txn = {
        id: makeUuid(),
        user_id: currentUser.id,
        wallet_id: wallet.id,
        to_wallet_id: null,
        category_id: params.p_category_id || null,
        type,
        amount,
        transaction_date: params.p_transaction_date || todayVietnamDate(),
        note: params.p_note || '',
        note_unaccent: removeVietnameseTones(params.p_note || ''),
        created_at: new Date().toISOString(),
      }
      db.transactions.push(txn)
      wallet.balance = Number(wallet.balance) + (type === 'income' ? amount : -amount)
      return { data: hydrateRow('transactions', txn), error: null }
    }

    if (fnName === 'update_transaction_atomic') {
      const txn = db.transactions.find((t) => t.id === params.p_transaction_id && t.user_id === currentUser.id)
      if (!txn) return { data: null, error: new Error('Không tìm thấy giao dịch cần cập nhật') }
      if (txn.type === 'transfer') {
        return { data: null, error: new Error('Không thể sửa trực tiếp giao dịch chuyển tiền bằng RPC này') }
      }
      const oldWallet = db.wallets.find((w) => w.id === txn.wallet_id && w.user_id === currentUser.id)
      const newWalletId = params.p_wallet_id ?? txn.wallet_id
      const newWallet = db.wallets.find((w) => w.id === newWalletId && w.user_id === currentUser.id)
      if (!oldWallet || !newWallet) return { data: null, error: new Error('Không tìm thấy ví') }

      const newType = params.p_type ?? txn.type
      const newAmount = params.p_amount !== undefined ? Number(params.p_amount) : Number(txn.amount)
      if (!['income', 'expense'].includes(newType) || !Number.isFinite(newAmount) || newAmount <= 0) {
        return { data: null, error: new Error('Dữ liệu cập nhật không hợp lệ') }
      }

      oldWallet.balance = Number(oldWallet.balance) + (txn.type === 'income' ? -Number(txn.amount) : Number(txn.amount))
      newWallet.balance = Number(newWallet.balance) + (newType === 'income' ? newAmount : -newAmount)

      txn.wallet_id = newWalletId
      txn.category_id = params.p_category_id !== undefined ? params.p_category_id : txn.category_id
      txn.type = newType
      txn.amount = newAmount
      if (params.p_note !== undefined) {
        txn.note = params.p_note || ''
        txn.note_unaccent = removeVietnameseTones(txn.note)
      }
      if (params.p_transaction_date !== undefined) {
        txn.transaction_date = params.p_transaction_date
      }
      return { data: hydrateRow('transactions', txn), error: null }
    }

    if (fnName === 'delete_transaction_atomic') {
      const idx = db.transactions.findIndex((t) => t.id === params.p_transaction_id && t.user_id === currentUser.id)
      if (idx < 0) return { data: null, error: new Error('Không tìm thấy giao dịch cần xóa') }
      const txn = db.transactions[idx]
      const w = db.wallets.find((item) => item.id === txn.wallet_id && item.user_id === currentUser.id)
      if (w) {
        if (txn.type === 'income') w.balance = Number(w.balance) - Number(txn.amount)
        else if (txn.type === 'expense') w.balance = Number(w.balance) + Number(txn.amount)
        else if (txn.type === 'transfer') {
          w.balance = Number(w.balance) + Number(txn.amount)
          const tw = db.wallets.find((item) => item.id === txn.to_wallet_id && item.user_id === currentUser.id)
          if (tw) tw.balance = Number(tw.balance) - Number(txn.amount)
        }
      }
      db.transactions.splice(idx, 1)
      return { data: true, error: null }
    }

    if (fnName === 'generate_due_recurring_transactions') {
      const today = todayVietnamDate()
      let generatedCount = 0
      for (const rule of db.recurring_rules) {
        if (rule.user_id !== currentUser.id || !rule.is_active) continue
        while (String(rule.next_due_date) <= today) {
          const wallet = db.wallets.find((w) => w.id === rule.wallet_id && w.user_id === currentUser.id)
          if (!wallet || wallet.is_archived) break
          const amount = Number(rule.amount)
          wallet.balance = Number(wallet.balance) + (rule.type === 'income' ? amount : -amount)
          db.transactions.push({
            id: makeUuid(),
            user_id: currentUser.id,
            wallet_id: rule.wallet_id,
            to_wallet_id: null,
            category_id: rule.category_id,
            type: rule.type,
            amount,
            transaction_date: rule.next_due_date,
            note: `[Định kỳ] ${rule.title}`,
            note_unaccent: removeVietnameseTones(`[Định kỳ] ${rule.title}`),
            created_at: new Date().toISOString(),
          })
          rule.next_due_date = advanceDateUtc(rule.next_due_date, rule.frequency, rule.day_of_month)
          generatedCount += 1
        }
      }
      return { data: generatedCount, error: null }
    }

    if (fnName === 'sync_finance_notifications') {
      const daysAhead = Number(params.p_days_ahead ?? 3)
      if (!Number.isInteger(daysAhead) || daysAhead < 0 || daysAhead > 30) {
        return { data: null, error: new Error('p_days_ahead phải trong khoảng 0..30') }
      }
      const today = todayVietnamDate()
      const [year, month] = today.split('-').map(Number)
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`
      let budgetWarning = 0
      let budgetExceeded = 0
      let recurringDue = 0

      for (const b of db.budgets) {
        if (b.user_id !== currentUser.id || b.month !== month || b.year !== year) continue
        const limit = Number(b.amount_limit)
        if (limit <= 0) continue
        const spent = db.transactions
          .filter(
            (t) =>
              t.user_id === currentUser.id &&
              t.type === 'expense' &&
              t.category_id === b.category_id &&
              String(t.transaction_date).startsWith(monthPrefix)
          )
          .reduce((s, t) => s + Number(t.amount), 0)
        const pct = (spent * 100) / limit
        if (pct < 80) continue
        const threshold = pct >= 100 ? 100 : 80
        const type = threshold === 100 ? 'budget_exceeded' : 'budget_warning'
        const eventKey = `budget:${b.id}:${monthPrefix.slice(0, 7)}:${threshold}`
        const exists = db.notifications.some((n) => n.user_id === currentUser.id && n.event_key === eventKey)
        if (!exists) {
          const cat = db.categories.find((c) => c.id === b.category_id)
          db.notifications.push({
            id: makeUuid(),
            user_id: currentUser.id,
            title: type === 'budget_exceeded' ? 'Ngân sách đã đạt hoặc vượt hạn mức' : 'Ngân sách sắp vượt hạn mức',
            message: `Danh mục ${cat?.name || 'Khác'} đã chi ${spent}/${limit} VND (${pct.toFixed(1)}%).`,
            type,
            event_key: eventKey,
            is_read: false,
            created_at: new Date().toISOString(),
          })
          if (type === 'budget_exceeded') budgetExceeded += 1
          else budgetWarning += 1
        }
      }

      const [ty, tm, td] = today.split('-').map(Number)
      const endDate = new Date(Date.UTC(ty, tm - 1, td + daysAhead)).toISOString().slice(0, 10)
      for (const r of db.recurring_rules) {
        if (r.user_id !== currentUser.id || !r.is_active) continue
        if (r.next_due_date >= today && r.next_due_date <= endDate) {
          const eventKey = `recurring:${r.id}:${r.next_due_date}`
          const exists = db.notifications.some((n) => n.user_id === currentUser.id && n.event_key === eventKey)
          if (!exists) {
            db.notifications.push({
              id: makeUuid(),
              user_id: currentUser.id,
              title: 'Sắp đến hạn giao dịch định kỳ',
              message: `${r.title} (${r.amount} VND) đến hạn ngày ${r.next_due_date}.`,
              type: 'recurring_due',
              event_key: eventKey,
              is_read: false,
              created_at: new Date().toISOString(),
            })
            recurringDue += 1
          }
        }
      }

      return {
        data: {
          budget_warning: budgetWarning,
          budget_exceeded: budgetExceeded,
          recurring_due: recurringDue,
        },
        error: null,
      }
    }

    return { data: null, error: new Error(`Unknown RPC ${fnName}`) }
  }

  const client = {
    auth: {
      async getUser() {
        return { data: { user: currentUser ? cloneRow(currentUser) : null }, error: null }
      },
      async getSession() {
        return { data: { session: currentSession ? cloneRow(currentSession) : null }, error: null }
      },
      async signUp({ email, password, options }) {
        if (!email || !password || password.length < 6) {
          return { data: { user: null, session: null }, error: new Error('Email hoặc mật khẩu không hợp lệ') }
        }
        const userId = makeUuid()
        const user = {
          id: userId,
          email,
          user_metadata: { full_name: options?.data?.full_name || '' },
        }
        const session = {
          access_token: createFakeJwt({ sub: userId, email }),
          user,
        }
        usersByEmail.set(email, { user, password })
        currentUser = cloneRow(user)
        currentSession = cloneRow(session)
        // Simulate handle_new_user trigger
        db.profiles.push({
          id: userId,
          full_name: options?.data?.full_name || email.split('@')[0],
          avatar_url: null,
          default_bank_bin: null,
          default_bank_account: null,
          updated_at: new Date().toISOString(),
        })
        db.wallets.push({
          id: makeUuid(),
          user_id: userId,
          name: 'Tiền mặt',
          type: 'cash',
          balance: 0,
          icon: 'wallet',
          color: '#10B981',
          is_archived: false,
          created_at: new Date().toISOString(),
        })
        emitAuth('SIGNED_IN', currentSession)
        return { data: { user: cloneRow(user), session: cloneRow(session) }, error: null }
      },
      async signInWithPassword({ email, password }) {
        const record = usersByEmail.get(email)
        if (!record || record.password !== password) {
          return { data: { user: null, session: null }, error: new Error('Invalid login credentials') }
        }
        currentUser = cloneRow(record.user)
        currentSession = {
          access_token: createFakeJwt({ sub: currentUser.id, email: currentUser.email }),
          user: cloneRow(currentUser),
        }
        emitAuth('SIGNED_IN', currentSession)
        return { data: { user: cloneRow(currentUser), session: cloneRow(currentSession) }, error: null }
      },
      async signOut() {
        currentUser = null
        currentSession = null
        emitAuth('SIGNED_OUT', null)
        return { error: null }
      },
      async resetPasswordForEmail(email) {
        state.authEvents.push({ type: 'resetPasswordForEmail', email })
        return { data: {}, error: null }
      },
      async updateUser({ password }) {
        if (!currentUser) return { data: { user: null }, error: new Error('Auth session missing') }
        const rec = usersByEmail.get(currentUser.email)
        if (rec && password) rec.password = password
        return { data: { user: cloneRow(currentUser) }, error: null }
      },
      async exchangeCodeForSession(code) {
        if (state.onAuthCodeExchange) {
          return state.onAuthCodeExchange(code)
        }
        return { data: { session: null }, error: new Error('Invalid code') }
      },
      onAuthStateChange(callback) {
        authListeners.add(callback)
        return {
          data: {
            subscription: {
              unsubscribe: () => authListeners.delete(callback),
            },
          },
        }
      },
    },
    from(table) {
      return buildQuery(table)
    },
    rpc(fnName, params) {
      return handleRpc(fnName, params)
    },
  }

  return {
    db,
    state,
    client,
    setUser(user) {
      currentUser = user ? cloneRow(user) : null
      currentSession = currentUser
        ? {
            access_token: createFakeJwt({ sub: currentUser.id, email: currentUser.email }),
            user: cloneRow(currentUser),
          }
        : null
      if (currentUser && !usersByEmail.has(currentUser.email)) {
        usersByEmail.set(currentUser.email, { user: cloneRow(currentUser), password: 'Password123!' })
      }
    },
    emitAuth,
  }
}

export function installSupabaseHarness(options = {}) {
  const harness = createSupabaseHarness(options)
  globalThis.__SPENDWISE_E2E_CLIENT__ = harness.client
  return harness
}

export function installFetchBridge({
  apiBaseUrl = 'http://localhost:5000',
  app = createApp(),
  onExternalFetch = null,
  failApiConnection = false,
} = {}) {
  const originalFetch = globalThis.fetch
  const normalizedBase = apiBaseUrl.replace(/\/+$/, '')

  globalThis.fetch = async (input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url || ''
    if (rawUrl.startsWith(normalizedBase)) {
      if (failApiConnection) {
        const err = new Error('connect ECONNREFUSED 127.0.0.1:5000')
        err.code = 'ECONNREFUSED'
        throw err
      }
      const parsedUrl = new URL(rawUrl)
      const method = (init.method || 'GET').toUpperCase()
      const agent = request(app)
      let req = agent[method.toLowerCase()](`${parsedUrl.pathname}${parsedUrl.search}`)
      const headers = init.headers || {}
      for (const [key, value] of Object.entries(headers)) {
        req = req.set(key, value)
      }
      if (init.body !== undefined) {
        req = req.send(typeof init.body === 'string' ? JSON.parse(init.body) : init.body)
      }
      const res = await req
      const bodyText = typeof res.text === 'string' && res.text.length > 0 ? res.text : JSON.stringify(res.body)
      return new Response(bodyText, {
        status: res.status,
        headers: { 'content-type': res.headers['content-type'] || 'application/json' },
      })
    }

    if (onExternalFetch) {
      return onExternalFetch(rawUrl, init)
    }

    if (originalFetch) {
      return originalFetch(input, init)
    }
    throw new Error(`Unhandled fetch to ${rawUrl}`)
  }

  return {
    app,
    restore() {
      globalThis.fetch = originalFetch
    },
  }
}

export function createEnvironmentController() {
  const savedEnv = { ...process.env }
  const savedGlobals = {
    fetch: globalThis.fetch,
    window: globalThis.window,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    URL: globalThis.URL,
    Blob: globalThis.Blob,
  }
  const cleanups = []

  return {
    onCleanup(fn) {
      cleanups.push(fn)
    },
    resetRuntime() {
      resetRateLimiters()
      clearAuthCache()
    },
    restore() {
      while (cleanups.length > 0) {
        const fn = cleanups.pop()
        fn()
      }
      for (const key of Object.keys(process.env)) {
        if (!(key in savedEnv)) delete process.env[key]
      }
      Object.assign(process.env, savedEnv)
      globalThis.fetch = savedGlobals.fetch
      if (savedGlobals.window === undefined) delete globalThis.window
      else globalThis.window = savedGlobals.window
      if (savedGlobals.document === undefined) delete globalThis.document
      else globalThis.document = savedGlobals.document
      if (savedGlobals.localStorage === undefined) delete globalThis.localStorage
      else globalThis.localStorage = savedGlobals.localStorage
      globalThis.URL = savedGlobals.URL
      globalThis.Blob = savedGlobals.Blob
      delete globalThis.__SPENDWISE_E2E_CLIENT__
      delete globalThis.__SPENDWISE_E2E_GEMINI__
      resetRateLimiters()
      clearAuthCache()
    },
  }
}

export function installBrowserStubs({ initialStorage = {}, origin = 'http://localhost:5173' } = {}) {
  const store = new Map(Object.entries(initialStorage))
  const classSet = new Set()
  const dispatchedEvents = []
  const listeners = new Map()

  const localStorageStub = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  }

  const documentStub = {
    visibilityState: 'visible',
    documentElement: {
      classList: {
        add: (...cls) => cls.forEach((c) => classSet.add(c)),
        remove: (...cls) => cls.forEach((c) => classSet.delete(c)),
        toggle: (c, force) => {
          if (force === undefined) {
            if (classSet.has(c)) classSet.delete(c)
            else classSet.add(c)
          } else if (force) {
            classSet.add(c)
          } else {
            classSet.delete(c)
          }
        },
        contains: (c) => classSet.has(c),
      },
    },
    body: {
      appendChild: () => {},
    },
    createElement: () => ({
      href: '',
      download: '',
      style: {},
      click: () => {},
      remove: () => {},
    }),
    addEventListener: (name, fn) => {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(fn)
    },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
  }

  const windowStub = {
    location: { origin, pathname: '/', search: '', hash: '' },
    history: { state: null, replaceState: () => {} },
    localStorage: localStorageStub,
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    dispatchEvent: (ev) => {
      dispatchedEvents.push(ev?.type || String(ev))
      return true
    },
    addEventListener: (name, fn) => {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(fn)
    },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  }

  globalThis.localStorage = localStorageStub
  globalThis.document = documentStub
  globalThis.window = windowStub

  return { store, classSet, dispatchedEvents, windowStub, documentStub, localStorageStub }
}

export function renderWithRouter(
  element,
  {
    route = '/',
    auth = {
      user: { id: TEST_USER_A_ID, email: 'demo@spendwise.vn', user_metadata: { full_name: 'Nguyễn Văn Demo' } },
      profile: { id: TEST_USER_A_ID, full_name: 'Nguyễn Văn Demo' },
      loading: false,
      signOut: async () => {},
      refreshProfile: async () => null,
    },
  } = {}
) {
  return renderToStaticMarkup(
    React.createElement(
      AuthContext.Provider,
      { value: auth },
      React.createElement(MemoryRouter, { initialEntries: [route] }, element)
    )
  )
}

export function runSwInVm({
  origin = 'http://localhost:5173',
  initialCaches = {},
  fetchImpl = async () => new Response('<html>ok</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
} = {}) {
  const swPath = path.join(REPO_ROOT, 'public/sw.js')
  const swCode = fs.readFileSync(swPath, 'utf8')

  const cacheBuckets = new Map()
  for (const [name, entries] of Object.entries(initialCaches)) {
    const bucket = new Map()
    for (const [k, v] of Object.entries(entries)) {
      bucket.set(k, v)
    }
    cacheBuckets.set(name, bucket)
  }

  const eventHandlers = new Map()
  const cachesMock = {
    open: async (name) => {
      if (!cacheBuckets.has(name)) cacheBuckets.set(name, new Map())
      const bucket = cacheBuckets.get(name)
      return {
        addAll: async (urls) => {
          for (const u of urls) bucket.set(u, new Response(`cached:${u}`, { status: 200 }))
        },
        put: async (req, res) => {
          const key = typeof req === 'string' ? req : new URL(req.url).pathname
          bucket.set(key, res)
        },
      }
    },
    keys: async () => Array.from(cacheBuckets.keys()),
    delete: async (name) => cacheBuckets.delete(name),
    match: async (req) => {
      const key = typeof req === 'string' ? req : new URL(req.url).pathname
      for (const bucket of cacheBuckets.values()) {
        if (bucket.has(key)) {
          const hit = bucket.get(key)
          return typeof hit?.clone === 'function' ? hit.clone() : hit
        }
      }
      return undefined
    },
  }

  const selfObj = {
    location: { origin },
    addEventListener: (type, fn) => eventHandlers.set(type, fn),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  }

  const sandbox = {
    self: selfObj,
    caches: cachesMock,
    fetch: fetchImpl,
    URL,
    Response,
    Promise,
  }
  sandbox.globalThis = sandbox

  vm.runInNewContext(swCode, sandbox, { filename: 'public/sw.js' })

  return {
    cacheBuckets,
    async dispatchLifecycle(type) {
      const handler = eventHandlers.get(type)
      if (!handler) return
      const promises = []
      handler({ waitUntil: (p) => promises.push(p) })
      await Promise.all(promises)
    },
    async dispatchFetch({ url, method = 'GET', mode = 'cors', accept = '*/*' }) {
      const handler = eventHandlers.get('fetch')
      let intercepted = null
      const event = {
        request: {
          url,
          method,
          mode,
          headers: {
            get: (name) => (name.toLowerCase() === 'accept' ? accept : null),
          },
        },
        respondWith: (promise) => {
          intercepted = promise
        },
      }
      handler(event)
      if (!intercepted) return { intercepted: false, response: null }
      const response = await intercepted
      return { intercepted: true, response }
    },
  }
}

export function runIndexPrePaintThemeScript({
  savedTheme = null,
  prefersDark = false,
} = {}) {
  const htmlPath = path.join(REPO_ROOT, 'index.html')
  const html = fs.readFileSync(htmlPath, 'utf8')
  const scriptMatches = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))
  const combinedScript = scriptMatches.map((m) => m[1]).join('\n')

  const classSet = new Set()
  const sandbox = {
    localStorage: {
      getItem: (k) => (k === 'spendwise_theme' ? savedTheme : null),
    },
    window: {
      localStorage: {
        getItem: (k) => (k === 'spendwise_theme' ? savedTheme : null),
      },
      matchMedia: () => ({ matches: prefersDark }),
    },
    document: {
      documentElement: {
        classList: {
          add: (...cls) => cls.forEach((c) => classSet.add(c)),
          remove: (...cls) => cls.forEach((c) => classSet.delete(c)),
          toggle: (c, force) => {
            if (force === undefined) {
              if (classSet.has(c)) classSet.delete(c)
              else classSet.add(c)
            } else if (force) {
              classSet.add(c)
            } else {
              classSet.delete(c)
            }
          },
          contains: (c) => classSet.has(c),
        },
      },
    },
  }

  if (combinedScript.trim()) {
    vm.runInNewContext(combinedScript, sandbox, { filename: 'index.html#prepaint' })
  }

  return {
    hasScript: scriptMatches.length > 0,
    isDark: classSet.has('dark'),
    scriptContent: combinedScript,
  }
}

export function getRepoPath(...segments) {
  return path.join(REPO_ROOT, ...segments)
}
