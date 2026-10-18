import { supabase } from '@/lib/supabaseClient'

/**
 * Service tổng hợp Báo cáo tài chính và dữ liệu Biểu đồ (Chart.js)
 * Phụ trách: TV2 (Hồ Nguyên Văn) - Nhóm chức năng REPORT (UC17)
 */

/**
 * Lấy tổng thu nhập, tổng chi tiêu và số dư ròng trong một khoảng thời gian (UC17)
 * @param {string} startDate 
 * @param {string} endDate 
 * @returns {Promise<{ totalIncome: number, totalExpense: number, netSavings: number, error: any }>}
 */
export async function getFinancialSummary(startDate, endDate) {
  try {
    let query = supabase
      .from('transactions')
      .select('type, amount')
      .in('type', ['income', 'expense'])

    if (startDate) query = query.gte('transaction_date', startDate)
    if (endDate) query = query.lte('transaction_date', endDate)

    const { data, error } = await query
    if (error) throw error

    let totalIncome = 0
    let totalExpense = 0

    (data || []).forEach(t => {
      const amt = Number(t.amount || 0)
      if (t.type === 'income') totalIncome += amt
      if (t.type === 'expense') totalExpense += amt
    })

    return {
      totalIncome,
      totalExpense,
      netSavings: totalIncome - totalExpense,
      error: null
    }
  } catch (err) {
    return { totalIncome: 0, totalExpense: 0, netSavings: 0, error: err }
  }
}

/**
 * Lấy dữ liệu phân bổ chi tiêu theo danh mục cho biểu đồ Donut / Pie (UC17)
 * @param {number} month 
 * @param {number} year 
 * @returns {Promise<{ labels: string[], datasets: any[], rawData: any[], error: any }>}
 */
export async function getCategoryExpenseBreakdown(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        amount,
        category:categories(id, name, color)
      `)
      .eq('type', 'expense')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)

    if (error) throw error

    const categoryMap = {}
    ;(data || []).forEach(t => {
      const name = t.category?.name || 'Khác'
      const color = t.category?.color || '#94A3B8'
      const amt = Number(t.amount || 0)

      if (!categoryMap[name]) {
        categoryMap[name] = { name, color, total: 0 }
      }
      categoryMap[name].total += amt
    })

    const rawData = Object.values(categoryMap).sort((a, b) => b.total - a.total)
    const labels = rawData.map(c => c.name)
    const amounts = rawData.map(c => c.total)
    const backgroundColors = rawData.map(c => c.color)

    return {
      labels,
      datasets: [
        {
          data: amounts,
          backgroundColor: backgroundColors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ],
      rawData,
      error: null
    }
  } catch (err) {
    return { labels: [], datasets: [], rawData: [], error: err }
  }
}

/**
 * So sánh tình hình thu/chi giữa tháng hiện tại và tháng liền kề trước đó (UC17)
 * @param {number} currentMonth 
 * @param {number} currentYear 
 * @returns {Promise<{
 *   current: { income: number, expense: number, net: number },
 *   previous: { income: number, expense: number, net: number },
 *   diffExpensePercent: number,
 *   diffIncomePercent: number,
 *   error: any
 * }>}
 */
export async function getPeriodComparison(
  currentMonth = new Date().getMonth() + 1,
  currentYear = new Date().getFullYear()
) {
  try {
    // Tháng hiện tại
    const curStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    const curLastDay = new Date(currentYear, currentMonth, 0).getDate()
    const curEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(curLastDay).padStart(2, '0')}`

    // Tháng trước
    const prevDate = new Date(currentYear, currentMonth - 2, 1)
    const prevMonth = prevDate.getMonth() + 1
    const prevYear = prevDate.getFullYear()
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
    const prevLastDay = new Date(prevYear, prevMonth, 0).getDate()
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`

    const [curSummary, prevSummary] = await Promise.all([
      getFinancialSummary(curStart, curEnd),
      getFinancialSummary(prevStart, prevEnd)
    ])

    const calculateDiff = (cur, prev) => {
      if (prev === 0) return cur > 0 ? 100 : 0
      return Number((((cur - prev) / prev) * 100).toFixed(1))
    }

    return {
      current: {
        income: curSummary.totalIncome,
        expense: curSummary.totalExpense,
        net: curSummary.netSavings
      },
      previous: {
        income: prevSummary.totalIncome,
        expense: prevSummary.totalExpense,
        net: prevSummary.netSavings
      },
      diffExpensePercent: calculateDiff(curSummary.totalExpense, prevSummary.totalExpense),
      diffIncomePercent: calculateDiff(curSummary.totalIncome, prevSummary.totalIncome),
      error: null
    }
  } catch (err) {
    return {
      current: { income: 0, expense: 0, net: 0 },
      previous: { income: 0, expense: 0, net: 0 },
      diffExpensePercent: 0,
      diffIncomePercent: 0,
      error: err
    }
  }
}
