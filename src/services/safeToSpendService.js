import { supabase } from '@/lib/supabaseClient'
import { getBudgetProgress } from './budgetService'

/**
 * Service tính toán chỉ số Safe-to-spend (Số tiền an toàn có thể chi tiêu trong ngày hôm nay)
 * Phụ trách: TV4 (Lê Hoài Quốc) - Nhóm chức năng STS (UC20)
 * 
 * Công thức chuẩn:
 * SafeToSpend = max(0, (RemainingBudget - UpcomingRecurringExpenses) / DaysLeftInMonth)
 */

/**
 * Tính toán số tiền an toàn có thể tiêu hôm nay
 * @returns {Promise<{
 *   safeToSpendToday: number,
 *   remainingBudget: number,
 *   upcomingRecurring: number,
 *   daysLeft: number,
 *   totalBudget: number,
 *   totalSpent: number,
 *   hasBudgetSet: boolean,
 *   error: any
 * }>}
 */
export async function calculateSafeToSpend() {
  try {
    const today = new Date()
    const currentMonth = today.getMonth() + 1
    const currentYear = today.getFullYear()
    const currentDay = today.getDate()

    // 1. Tính số ngày còn lại trong tháng (bao gồm cả hôm nay, luôn >= 1)
    const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate()
    const daysLeft = Math.max(1, totalDaysInMonth - currentDay + 1)

    // 2. Lấy thông tin ngân sách tháng từ budgetService
    const { totalBudget, totalSpent, data: budgets, error: budgetErr } = await getBudgetProgress(currentMonth, currentYear)
    if (budgetErr) throw budgetErr

    const hasBudgetSet = budgets.length > 0
    let remainingBudget = 0

    if (hasBudgetSet) {
      remainingBudget = Math.max(0, totalBudget - totalSpent)
    } else {
      // Nếu chưa đặt ngân sách danh mục, lấy tổng số dư thực tế trong các ví
      const { data: wallets } = await supabase
        .from('wallets')
        .select('balance')
        .eq('is_archived', false)

      const totalBalance = (wallets || []).reduce((sum, w) => sum + Number(w.balance || 0), 0)
      remainingBudget = Math.max(0, totalBalance)
    }

    // 3. Lấy các khoản định kỳ sắp đến trong tháng (từ hôm nay đến cuối tháng)
    const todayStr = today.toISOString().split('T')[0]
    const endOfMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`

    const { data: recurringRules, error: recErr } = await supabase
      .from('recurring_rules')
      .select('amount, next_due_date')
      .eq('is_active', true)
      .eq('type', 'expense')
      .gte('next_due_date', todayStr)
      .lte('next_due_date', endOfMonthStr)

    if (recErr) throw recErr

    const upcomingRecurring = (recurringRules || []).reduce((sum, rule) => sum + Number(rule.amount || 0), 0)

    // 4. Áp dụng công thức Safe-to-spend
    const availablePool = Math.max(0, remainingBudget - upcomingRecurring)
    const safeToSpendToday = Math.round(availablePool / daysLeft)

    return {
      safeToSpendToday,
      remainingBudget,
      upcomingRecurring,
      daysLeft,
      totalBudget,
      totalSpent,
      hasBudgetSet,
      error: null
    }
  } catch (err) {
    return {
      safeToSpendToday: 0,
      remainingBudget: 0,
      upcomingRecurring: 0,
      daysLeft: 1,
      totalBudget: 0,
      totalSpent: 0,
      hasBudgetSet: false,
      error: err
    }
  }
}
