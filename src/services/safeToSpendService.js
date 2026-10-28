import { supabase } from '@/lib/supabaseClient'
import { getBudgetProgress } from './budgetService'

/**
 * UC20 - Safe-to-spend hôm nay (SafeToSpend).
 * Số tiền an toàn có thể tiêu hôm nay mà không phá vỡ kế hoạch ngân sách tháng.
 *
 * Công thức: max(0, (remainingBudget - upcomingRecurring) / daysLeft)
 * Phép tính chính được thực hiện bởi POST /api/finance/safe-to-spend.
 */

const SAFE_TO_SPEND_FORMULA =
  'max(0, (remainingBudget - upcomingRecurring) / daysLeft)'

/** Định dạng YYYY-MM-DD theo giờ địa phương, không chuyển sang UTC. */
export function toLocalDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Số ngày còn lại trong tháng, tính cả hôm nay, tối thiểu là 1. */
export function getRemainingDaysInMonth(today = new Date()) {
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const lastDay = new Date(year, month, 0).getDate()
  return Math.max(1, lastDay - today.getDate() + 1)
}

/** Lấy ngày đầu vào và cuối tháng theo lịch địa phương. */
export function getCurrentMonthDates(today = new Date()) {
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const lastDay = new Date(year, month, 0)

  return {
    month,
    year,
    todayDate: toLocalDateString(today),
    endOfMonthDate: toLocalDateString(lastDay),
  }
}

/**
 * Lấy RemainingBudget = tổng hạn mức ngân sách - chi tiêu tháng.
 * Chỉ tính danh mục có ngân sách, theo getBudgetProgress của SpendWise.
 * KHÔNG dùng tổng số dư ví thay thế: số dư ví không phải ngân sách tháng.
 */
async function getRemainingBudget(month, year) {
  const { data, totalBudget, totalSpent, error } = await getBudgetProgress(month, year)
  if (error) throw error

  const hasBudgetSet = Array.isArray(data) && data.length > 0
  const budget = Number(totalBudget || 0)
  const spent = Number(totalSpent || 0)

  if (!Number.isFinite(budget) || !Number.isFinite(spent)) {
    throw new Error('Dữ liệu ngân sách không hợp lệ.')
  }

  return {
    remainingBudget: hasBudgetSet ? budget - spent : 0,
    totalBudget: budget,
    totalSpent: spent,
    hasBudgetSet,
  }
}

/**
 * Cộng các recurring_rules đang active, loại expense, với next_due_date
 * từ hôm nay đến cuối tháng (bao gồm cả hai đầu mốc).
 * Theo đặc tả UC20: chỉ đếm next_due_date hiện tại của mỗi rule một lần.
 */
async function getUpcomingRecurring(userId, todayDate, endOfMonthDate) {
  const { data, error } = await supabase
    .from('recurring_rules')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('is_active', true)
    .gte('next_due_date', todayDate)
    .lte('next_due_date', endOfMonthDate)

  if (error) throw error

  return (data || []).reduce((sum, rule) => {
    const amount = Number(rule.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Khoản chi định kỳ có số tiền không hợp lệ.')
    }
    return sum + amount
  }, 0)
}

/** Gửi dữ liệu ngân sách lên REST API để tính Safe-to-spend. */
async function requestSafeToSpend({ remainingBudget, upcomingRecurring, daysLeft }) {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
    .replace(/\/+$/, '')

  const response = await fetch(`${baseUrl}/api/finance/safe-to-spend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ remainingBudget, upcomingRecurring, daysLeft }),
  })

  let result
  try {
    result = await response.json()
  } catch {
    throw new Error('Phản hồi của API Safe-to-spend không phải JSON hợp lệ.')
  }

  if (!response.ok || result?.success !== true || !result?.data) {
    throw new Error(result?.errors?.join(' ') || result?.message || 'Lỗi khi gọi API Safe-to-spend.')
  }

  return result.data
}

/**
 * Tự tính Safe-to-spend hôm nay từ dữ liệu người dùng Supabase.
 * Giữ nguyên tên hàm và kiểu kết quả để tương thích với các trang trong SpendWise.
 *
 * @param {Date} [today=new Date()] Cho phép truyền ngày khi kiểm thử.
 * @returns {Promise<{
 *   safeToSpendToday: number, remainingBudget: number, upcomingRecurring: number,
 *   daysLeft: number, totalBudget: number, totalSpent: number,
 *   hasBudgetSet: boolean, formula: string, error: Error|null
 * }>}
 */
export async function calculateSafeToSpend(today = new Date()) {
  const { month, year, todayDate, endOfMonthDate } = getCurrentMonthDates(today)
  const daysLeft = getRemainingDaysInMonth(today)

  const emptyResult = {
    safeToSpendToday: 0,
    remainingBudget: 0,
    upcomingRecurring: 0,
    daysLeft,
    totalBudget: 0,
    totalSpent: 0,
    hasBudgetSet: false,
    formula: SAFE_TO_SPEND_FORMULA,
    error: null,
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!authData?.user) throw new Error('Vui lòng đăng nhập để xem Safe-to-spend.')

    const [budgetInfo, upcomingRecurring] = await Promise.all([
      getRemainingBudget(month, year),
      getUpcomingRecurring(authData.user.id, todayDate, endOfMonthDate),
    ])

    // Nếu chưa đặt ngân sách, không dùng số dư ví để tự tạo hạn mức chi.
    // Trả về 0 để giao diện có thể gợi ý người dùng lập ngân sách tháng.
    if (!budgetInfo.hasBudgetSet) {
      return {
        ...emptyResult,
        ...budgetInfo,
        upcomingRecurring,
      }
    }

    const safeToSpend = await requestSafeToSpend({
      remainingBudget: budgetInfo.remainingBudget,
      upcomingRecurring,
      daysLeft,
    })

    return {
      ...safeToSpend,
      ...budgetInfo,
      error: null,
    }
  } catch (error) {
    console.error('[SafeToSpend Service]', error)
    return { ...emptyResult, error }
  }
}

/**
 * Kiểm tra dữ liệu đầu vào của API.
 * remainingBudget có thể âm khi đã chi vượt tổng ngân sách tháng.
 * upcomingRecurring không âm; daysLeft là số ngày thực tế còn lại trong tháng.
 *
 * @param {unknown} input
 * @returns {string[]} Danh sách thông báo lỗi (rỗng nếu hợp lệ).
 */
export function validateSafeToSpendInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['Body phải là JSON object.']
  }

  const errors = []
  const { remainingBudget, upcomingRecurring, daysLeft } = input

  if (typeof remainingBudget !== 'number' || !Number.isFinite(remainingBudget)) {
    errors.push('remainingBudget phải là một số hợp lệ.')
  }

  if (typeof upcomingRecurring !== 'number' || !Number.isFinite(upcomingRecurring) || upcomingRecurring < 0) {
    errors.push('upcomingRecurring phải là một số không âm.')
  }

  if (!Number.isInteger(daysLeft) || daysLeft < 1 || daysLeft > 31) {
    errors.push('daysLeft phải là số nguyên từ 1 đến 31 (bao gồm hôm nay).')
  }

  return errors
}

/**
 * Tính số tiền an toàn có thể tiêu hôm nay.
 * Theo quy ước làm tròn VNĐ của repo SpendWise (Math.round).
 * Không cho kết quả âm khi ngân sách đã hết hoặc khoản định kỳ quá lớn.
 */
export function calculateSafeToSpendAmount(remainingBudget, upcomingRecurring, daysLeft) {
  const availableBudget = Math.max(0, remainingBudget - upcomingRecurring)
  return Math.round(availableBudget / daysLeft)
}

/** Tạo dữ liệu phản hồi theo mẫu API UC20 trong tài liệu. */
export function buildSafeToSpendData(input) {
  const errors = validateSafeToSpendInput(input)
  if (errors.length > 0) {
    const error = new Error(errors.join(' '))
    error.statusCode = 400
    error.details = errors
    throw error
  }

  const { remainingBudget, upcomingRecurring, daysLeft } = input

  return {
    safeToSpendToday: calculateSafeToSpendAmount(remainingBudget, upcomingRecurring, daysLeft),
    remainingBudget,
    upcomingRecurring,
    daysLeft,
    formula: SAFE_TO_SPEND_FORMULA,
  }
}