import { supabase } from '@/lib/supabaseClient'

/**
 * Service quản lý Ngân sách tháng và theo dõi tiến độ chi tiêu
 * Phụ trách: TV2 (Hồ Nguyên Văn) - Nhóm chức năng BUDGET (UC14 - UC15)
 */

/**
 * Lấy danh sách ngân sách của tháng và năm chỉ định (UC14)
 * @param {number} month Tháng (1 - 12)
 * @param {number} year Năm (>= 2020)
 * @returns {Promise<{ data: any[], error: any }>}
 */
export async function getBudgets(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
  try {
    const { data, error } = await supabase
      .from('budgets')
      .select(`
        *,
        category:categories(id, name, color, icon)
      `)
      .eq('month', month)
      .eq('year', year)

    return { data: data || [], error }
  } catch (err) {
    return { data: [], error: err }
  }
}

/**
 * Thiết lập hoặc cập nhật hạn mức ngân sách cho danh mục (UC14)
 * @param {{ category_id: string, month: number, year: number, amount_limit: number }} budgetData 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function setBudget({ category_id, month, year, amount_limit }) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const { data, error } = await supabase
      .from('budgets')
      .upsert({
        user_id: user.id,
        category_id,
        month,
        year,
        amount_limit: Number(amount_limit)
      }, {
        onConflict: 'user_id, category_id, month, year'
      })
      .select(`
        *,
        category:categories(id, name, color, icon)
      `)
      .single()

    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Xóa ngân sách của một danh mục (UC14)
 * @param {string} id ID bản ghi budget
 * @returns {Promise<{ error: any }>}
 */
export async function deleteBudget(id) {
  try {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)

    return { error }
  } catch (err) {
    return { error: err }
  }
}

/**
 * Lấy tiến độ chi tiêu so với ngân sách theo 3 mức (An toàn / Sắp vượt / Đã vượt) (UC15)
 * @param {number} month Tháng
 * @param {number} year Năm
 * @returns {Promise<{ data: any[], totalBudget: number, totalSpent: number, error: any }>}
 */
export async function getBudgetProgress(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
  try {
    // 1. Lấy danh sách ngân sách trong tháng
    const { data: budgets, error: budgetErr } = await getBudgets(month, year)
    if (budgetErr) throw budgetErr

    // 2. Tính khoảng ngày của tháng được chọn
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // 3. Lấy tổng chi tiêu của từng danh mục trong tháng đó
    const { data: expenses, error: expErr } = await supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('type', 'expense')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)

    if (expErr) throw expErr

    // Gom nhóm chi tiêu theo category_id
    const spentMap = {}
    expenses.forEach(exp => {
      if (exp.category_id) {
        spentMap[exp.category_id] = (spentMap[exp.category_id] || 0) + Number(exp.amount)
      }
    })

    let totalBudget = 0
    let totalSpent = 0

    // 4. Ghép nối và tính toán tỷ lệ % cùng trạng thái 3 mức
    const progressList = budgets.map(b => {
      const budgetLimit = Number(b.amount_limit)
      const spent = spentMap[b.category_id] || 0
      const remaining = budgetLimit - spent
      const percentage = budgetLimit > 0 ? (spent / budgetLimit) * 100 : 0

      totalBudget += budgetLimit
      totalSpent += spent

      // 3 mức: Safe < 80%, Warning 80-99%, Exceeded >= 100%
      let status = 'safe'
      if (percentage >= 100) {
        status = 'exceeded'
      } else if (percentage >= 80) {
        status = 'warning'
      }

      return {
        ...b,
        budget_amount: budgetLimit,
        spent_amount: spent,
        remaining_amount: remaining,
        percentage: Math.min(percentage, 100), // Cho thanh bar hiển thị max 100%
        actual_percentage: Number(percentage.toFixed(1)),
        status
      }
    })

    return {
      data: progressList,
      totalBudget,
      totalSpent,
      error: null
    }
  } catch (err) {
    return { data: [], totalBudget: 0, totalSpent: 0, error: err }
  }
}
