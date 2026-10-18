import { supabase } from '@/lib/supabaseClient'

/**
 * Service quản lý Quy tắc giao dịch định kỳ (Recurring Transactions)
 * Phụ trách: TV4 (Lê Hoài Quốc) - Nhóm chức năng GOAL_REC (UC24)
 */

/**
 * Lấy danh sách quy tắc giao dịch định kỳ của người dùng (UC24)
 * @returns {Promise<{ data: any[], error: any }>}
 */
export async function getRecurringRules() {
  try {
    const { data, error } = await supabase
      .from('recurring_rules')
      .select(`
        *,
        wallet:wallets(id, name, color, icon),
        category:categories(id, name, color, icon)
      `)
      .order('next_due_date', { ascending: true })

    return { data: data || [], error }
  } catch (err) {
    return { data: [], error: err }
  }
}

/**
 * Tạo một quy tắc giao dịch định kỳ mới (UC24)
 * @param {{
 *   wallet_id: string,
 *   category_id: string,
 *   title: string,
 *   type: 'income' | 'expense',
 *   amount: number,
 *   frequency: 'weekly' | 'monthly' | 'yearly',
 *   day_of_month?: number,
 *   next_due_date: string
 * }} ruleData 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function createRecurringRule(ruleData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const amount = Number(ruleData.amount)
    if (amount <= 0) throw new Error('Số tiền định kỳ phải lớn hơn 0')

    const { data, error } = await supabase
      .from('recurring_rules')
      .insert({
        user_id: user.id,
        wallet_id: ruleData.wallet_id,
        category_id: ruleData.category_id,
        title: ruleData.title,
        type: ruleData.type,
        amount,
        frequency: ruleData.frequency,
        day_of_month: ruleData.day_of_month || null,
        next_due_date: ruleData.next_due_date,
        is_active: true
      })
      .select(`
        *,
        wallet:wallets(id, name, color, icon),
        category:categories(id, name, color, icon)
      `)
      .single()

    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Cập nhật quy tắc giao dịch định kỳ (UC24)
 * @param {string} id 
 * @param {object} updates 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function updateRecurringRule(id, updates) {
  try {
    const { data, error } = await supabase
      .from('recurring_rules')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        wallet:wallets(id, name, color, icon),
        category:categories(id, name, color, icon)
      `)
      .single()

    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Bật hoặc tắt trạng thái kích hoạt của quy tắc định kỳ (UC24)
 * @param {string} id 
 * @param {boolean} isActive 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function toggleRuleActive(id, isActive) {
  return updateRecurringRule(id, { is_active: isActive })
}

/**
 * Xóa quy tắc giao dịch định kỳ (UC24)
 * @param {string} id 
 * @returns {Promise<{ error: any }>}
 */
export async function deleteRecurringRule(id) {
  try {
    const { error } = await supabase
      .from('recurring_rules')
      .delete()
      .eq('id', id)

    return { error }
  } catch (err) {
    return { error: err }
  }
}

/**
 * Tính toán ngày đến hạn tiếp theo dựa vào chu kỳ (UC24)
 * @param {string} currentDueDate Ngày đến hạn hiện tại (YYYY-MM-DD)
 * @param {'weekly' | 'monthly' | 'yearly'} frequency Chu kỳ
 * @param {number} [dayOfMonth] Ngày trong tháng (chỉ dùng cho monthly)
 * @returns {string} Ngày đến hạn tiếp theo dạng YYYY-MM-DD
 */
export function calculateNextDueDate(currentDueDate, frequency, dayOfMonth = null) {
  const date = new Date(currentDueDate)

  if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7)
  } else if (frequency === 'monthly') {
    date.setMonth(date.getMonth() + 1)
    if (dayOfMonth) {
      date.setDate(Math.min(dayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()))
    }
  } else if (frequency === 'yearly') {
    date.setFullYear(date.getFullYear() + 1)
  }

  return date.toISOString().split('T')[0]
}
