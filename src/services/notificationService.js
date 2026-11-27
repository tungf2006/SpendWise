import { supabase } from '@/lib/supabaseClient'
import { isMissingRpc, vietnamToday } from './recurringFallback'

/** UC25: thông báo bền vững qua RPC, hoặc cảnh báo ảo chỉ-đọc khi RPC chưa cài.
 * Không INSERT notifications từ trình duyệt: schema chặn quyền INSERT theo RLS.
 */
export const NOTIFICATION_TYPES = Object.freeze({
  BUDGET_WARNING: 'budget_warning',
  BUDGET_EXCEEDED: 'budget_exceeded',
  RECURRING_DUE: 'recurring_due',
  SYSTEM: 'system'
})
const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100
const DEFAULT_DAYS = 3
let missingSyncRpc = typeof import.meta.env === 'object' && import.meta.env.VITE_SPENDWISE_RPC_MODE === 'fallback'
const memoryStates = new Map()
const VIRTUAL_PREFIX = 'virtual:'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function currentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data?.user ?? null
}
function validateDays(days) {
  if (!Number.isInteger(days) || days < 0 || days > 30) throw new Error('Số ngày nhắc trước phải từ 0 đến 30.')
}
function storageKey(userId) { return `spendwise:notification-fallback:${userId}` }
function getState(userId) {
  let value = memoryStates.get(userId)
  if (!value && typeof localStorage !== 'undefined') {
    try { value = JSON.parse(localStorage.getItem(storageKey(userId)) || 'null') } catch { /* storage disabled */ }
  }
  if (!value || !Array.isArray(value.read) || !Array.isArray(value.dismissed)) value = { read: [], dismissed: [] }
  memoryStates.set(userId, value)
  return value
}
function saveState(userId, state) {
  memoryStates.set(userId, state)
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(storageKey(userId), JSON.stringify(state)) } catch { /* blocked storage */ }
  }
}
function publishUpdate() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('spendwise:notifications-updated'))
}
function dayPlus(date, days) {
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1, d + days))
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(target.getUTCDate()).padStart(2, '0')}`
}
function toHuman(date) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}
function makeVirtual(eventKey, userId, type, title, message) {
  const state = getState(userId)
  if (state.dismissed.includes(eventKey)) return null
  return {
    id: `${VIRTUAL_PREFIX}${eventKey}`, user_id: userId, event_key: eventKey,
    title, message, type, is_read: state.read.includes(eventKey),
    created_at: new Date().toISOString(), is_virtual: true
  }
}

// Read-only warning computation for offline RPC. Use the same event_key scheme as
// the database to avoid displaying both persisted and synthetic notifications.
async function deriveVirtualNotifications(userId, daysAhead = DEFAULT_DAYS) {
  validateDays(daysAhead)
  const today = vietnamToday()
  const endDate = dayPlus(today, daysAhead)
  const [year, month] = today.split('-').map(Number)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = dayPlus(`${year}-${String(month).padStart(2, '0')}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`, 1)
  const [rulesRes, budgetsRes] = await Promise.all([
    supabase.from('recurring_rules')
      .select('id, title, type, amount, next_due_date')
      .eq('user_id', userId).eq('is_active', true).lte('next_due_date', endDate).limit(1000),
    supabase.from('budgets')
      .select('id, category_id, amount_limit, category:categories(name)')
      .eq('user_id', userId).eq('month', month).eq('year', year).limit(1000)
  ])
  if (rulesRes.error) throw rulesRes.error
  if (budgetsRes.error) throw budgetsRes.error
  const events = []
  for (const rule of rulesRes.data ?? []) {
    const eventKey = `recurring:${rule.id}:${rule.next_due_date}`
    const message = `${rule.title} (${Number(rule.amount).toLocaleString('vi-VN')} VND, ${rule.type === 'expense' ? 'Khoản chi' : 'Khoản thu'}) đến hạn ngày ${toHuman(rule.next_due_date)}.`
    const item = makeVirtual(eventKey, userId, 'recurring_due', 'Sắp đến hạn giao dịch định kỳ', message)
    if (item) events.push(item)
  }
  const budgets = budgetsRes.data ?? []
  if (budgets.length) {
    // Paginate: PostgREST has a default 1000-row response limit.
    const totals = new Map()
    for (let from = 0; from < 10000; from += 500) {
      const { data: transactions, error } = await supabase.from('transactions')
        .select('category_id, amount').eq('user_id', userId).eq('type', 'expense')
        .gte('transaction_date', startDate).lt('transaction_date', nextMonth)
        .range(from, from + 499)
      if (error) throw error
      for (const tx of transactions ?? []) {
        totals.set(tx.category_id, (totals.get(tx.category_id) ?? 0) + Number(tx.amount))
      }
      if ((transactions ?? []).length < 500) break
      if (from === 9500) throw new Error('Quá nhiều giao dịch để tổng hợp cảnh báo dự phòng an toàn.')
    }
    for (const budget of budgets) {
      const limit = Number(budget.amount_limit)
      if (!Number.isFinite(limit) || limit <= 0) continue
      const spent = totals.get(budget.category_id) ?? 0
      const percent = spent / limit * 100
      if (percent < 80) continue
      const threshold = percent >= 100 ? 100 : 80
      const eventKey = `budget:${budget.id}:${startDate.slice(0, 7)}:${threshold}`
      const item = makeVirtual(
        eventKey, userId, threshold === 100 ? 'budget_exceeded' : 'budget_warning',
        threshold === 100 ? 'Ngân sách đã đạt hoặc vượt hạn mức' : 'Ngân sách sắp vượt hạn mức',
        `Danh mục ${budget.category?.name || 'không xác định'} đã chi ${spent.toLocaleString('vi-VN')} / ${limit.toLocaleString('vi-VN')} VND (${percent.toFixed(1)}%).`
      )
      if (item) events.push(item)
    }
  }
  return events
}

async function persistentNotifications(userId, limit) {
  const { data, error } = await supabase.from('notifications')
    .select('id, user_id, title, message, type, event_key, is_read, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data ?? []
}
export async function getNotifications(limit = DEFAULT_LIMIT) {
  try {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error(`Giới hạn phải từ 1 đến ${MAX_LIMIT}.`)
    const user = await currentUser()
    if (!user) return { data: [], error: null }
    const saved = await persistentNotifications(user.id, limit)
    if (!missingSyncRpc) return { data: saved, error: null }
    const virtual = await deriveVirtualNotifications(user.id)
    const keys = new Set(saved.map(item => item.event_key).filter(Boolean))
    const merged = [...virtual.filter(item => !keys.has(item.event_key)), ...saved]
    merged.sort((a, b) => (a.is_virtual === b.is_virtual ? new Date(b.created_at) - new Date(a.created_at) : Number(b.is_virtual) - Number(a.is_virtual)))
    return { data: merged.slice(0, limit), error: null }
  } catch (error) { return { data: [], error } }
}
export async function getUnreadCount() {
  try {
    const user = await currentUser()
    if (!user) return { count: 0, error: null }
    const { count, error } = await supabase.from('notifications')
      .select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false)
    if (error) throw error
    if (!missingSyncRpc) return { count: count ?? 0, error: null }
    const [{ data: stored, error: storedError }, derived] = await Promise.all([
      supabase.from('notifications').select('event_key').eq('user_id', user.id).not('event_key', 'is', null).limit(1000),
      deriveVirtualNotifications(user.id)
    ])
    if (storedError) throw storedError
    const keys = new Set((stored ?? []).map(n => n.event_key))
    return { count: (count ?? 0) + derived.filter(n => !n.is_read && !keys.has(n.event_key)).length, error: null }
  } catch (error) { return { count: 0, error } }
}
function checkId(id) {
  if (typeof id !== 'string' || (!UUID_RE.test(id) && !/^virtual:(budget|recurring):[\w:.-]{1,256}$/.test(id))) {
    throw new Error('ID thông báo không hợp lệ.')
  }
}
export async function markAsRead(id) {
  try {
    checkId(id)
    const user = await currentUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')
    if (id.startsWith(VIRTUAL_PREFIX)) {
      const key = id.slice(VIRTUAL_PREFIX.length)
      const state = getState(user.id)
      if (!state.read.includes(key)) state.read.push(key)
      saveState(user.id, state)
    } else {
      const { error } = await supabase.from('notifications').update({ is_read: true })
        .eq('id', id).eq('user_id', user.id)
      if (error) throw error
    }
    publishUpdate()
    return { error: null }
  } catch (error) { return { error } }
}
export async function markAllAsRead() {
  try {
    const user = await currentUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')
    const { error } = await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('is_read', false)
    if (error) throw error
    if (missingSyncRpc) {
      const derived = await deriveVirtualNotifications(user.id)
      const state = getState(user.id)
      state.read = [...new Set([...state.read, ...derived.map(n => n.event_key)])]
      saveState(user.id, state)
    }
    publishUpdate()
    return { error: null }
  } catch (error) { return { error } }
}
export async function deleteNotification(id) {
  try {
    checkId(id)
    const user = await currentUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')
    if (id.startsWith(VIRTUAL_PREFIX)) {
      const key = id.slice(VIRTUAL_PREFIX.length)
      const state = getState(user.id)
      if (!state.dismissed.includes(key)) state.dismissed.push(key)
      saveState(user.id, state)
    } else {
      const { error } = await supabase.from('notifications').delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error
    }
    publishUpdate()
    return { error: null }
  } catch (error) { return { error } }
}
/** Xóa tất cả thông báo đã đọc; userId phải đúng người dùng đang đăng nhập. */
export async function clearReadNotifications(userId) {
  try {
    const user = await currentUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')
    if (userId != null && userId !== user.id) throw new Error('Không thể xóa thông báo của người dùng khác.')
    let clearedEvents = []
    if (missingSyncRpc) {
      const { data, error: lookupError } = await supabase.from('notifications')
        .select('event_key').eq('user_id', user.id).eq('is_read', true).limit(1000)
      if (lookupError) throw lookupError
      clearedEvents = (data ?? []).map(item => item.event_key).filter(Boolean)
    }
    const { error } = await supabase.from('notifications').delete()
      .eq('user_id', user.id).eq('is_read', true)
    if (error) throw error
    if (missingSyncRpc) {
      const state = getState(user.id)
      state.dismissed = [...new Set([...state.dismissed, ...state.read, ...clearedEvents])]
      state.read = []
      saveState(user.id, state)
    }
    publishUpdate()
    return { error: null }
  } catch (error) { return { error } }
}
export async function checkAndGenerateNotifications({ daysAhead = DEFAULT_DAYS } = {}) {
  const empty = { budget_warning: 0, budget_exceeded: 0, recurring_due: 0 }
  try {
    validateDays(daysAhead)
    const user = await currentUser()
    if (!user) return { data: empty, error: null }
    if (!missingSyncRpc) {
      try {
        const { data, error } = await supabase.rpc('sync_finance_notifications', { p_days_ahead: daysAhead })
        if (error) throw error
        return {
          data: {
            budget_warning: Number(data?.budget_warning ?? 0),
            budget_exceeded: Number(data?.budget_exceeded ?? 0),
            recurring_due: Number(data?.recurring_due ?? 0)
          }, error: null
        }
      } catch (error) {
        if (!isMissingRpc(error, 'sync_finance_notifications')) throw error
        missingSyncRpc = true
      }
    }
    const virtual = await deriveVirtualNotifications(user.id, daysAhead)
    return { data: {
      budget_warning: virtual.filter(n => n.type === 'budget_warning').length,
      budget_exceeded: virtual.filter(n => n.type === 'budget_exceeded').length,
      recurring_due: virtual.filter(n => n.type === 'recurring_due').length,
      degraded: true
    }, error: null }
  } catch (error) { return { data: empty, error } }
}
export const syncNotifications = checkAndGenerateNotifications
// Old API kept for compatibility; INSERT blocked by the database for the frontend.
export async function createNotification() {
  return { data: null, error: new Error('Chỉ backend/RPC có quyền tạo thông báo thực trong notifications.') }
}
export function startNotificationAutoSync({ intervalMs = 300000, daysAhead = DEFAULT_DAYS } = {}) {
  if (!Number.isInteger(intervalMs) || intervalMs < 1000) throw new Error('intervalMs phải >= 1000.')
  validateDays(daysAhead)
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  let active = true
  let running = false
  async function sync() {
    if (!active || running || document.visibilityState === 'hidden') return
    running = true
    try {
      const { error } = await checkAndGenerateNotifications({ daysAhead })
      if (error && active) console.warn('[SpendWise] Không đồng bộ được thông báo:', error)
      if (!error && active) publishUpdate()
    } catch (error) {
      if (active) console.warn('[SpendWise] Không đồng bộ được thông báo:', error)
    } finally { running = false }
  }
  const onVisibility = () => { if (document.visibilityState !== 'hidden') void sync() }
  const onFinance = () => { void sync() }
  void sync()
  const timer = window.setInterval(() => { void sync() }, intervalMs)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('spendwise:finance-updated', onFinance)
  return () => {
    active = false
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('spendwise:finance-updated', onFinance)
  }
}
