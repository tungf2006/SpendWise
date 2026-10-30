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
const REPORT_PAGE_SIZE = 500

async function fetchReportTransactions({ startDate, endDate, select = 'type, amount, transaction_date' }) {
  const rows = []
  for (let offset = 0; ; offset += REPORT_PAGE_SIZE) {
    let query = supabase
      .from('transactions')
      .select(select)
      .in('type', ['income', 'expense'])
      .order('transaction_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + REPORT_PAGE_SIZE - 1)

    if (startDate) query = query.gte('transaction_date', startDate)
    if (endDate) query = query.lte('transaction_date', endDate)

    const { data, error } = await query
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < REPORT_PAGE_SIZE) break
  }
  return rows
}

/**
 * Lấy tổng thu nhập, tổng chi tiêu và số dư ròng trong một khoảng thời gian (UC17).
 * Dữ liệu được phân trang để không bị giới hạn mặc định 1.000 dòng của PostgREST.
 */
export async function getFinancialSummary(startDate, endDate) {
  try {
    const rows = await fetchReportTransactions({ startDate, endDate })
    const totalIncome = rows.reduce((sum, row) => sum + (row.type === 'income' ? Number(row.amount || 0) : 0), 0)
    const totalExpense = rows.reduce((sum, row) => sum + (row.type === 'expense' ? Number(row.amount || 0) : 0), 0)
    return { totalIncome, totalExpense, netSavings: totalIncome - totalExpense, error: null }
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
    const selectedMonth = Number(month)
    const selectedYear = Number(year)
    if (!Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
      throw new Error('Tháng báo cáo phải nằm trong khoảng 1–12')
    }
    if (!Number.isInteger(selectedYear) || selectedYear < 2020 || selectedYear > 9999) {
      throw new Error('Năm báo cáo không hợp lệ')
    }
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
    const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const rows = await fetchReportTransactions({
      startDate,
      endDate,
      select: 'type, amount, transaction_date, id, category:categories(id, name, color)'
    })
    const expenses = rows.filter((row) => row.type === 'expense')
    const categoryMap = new Map()

    expenses.forEach((transaction) => {
      const name = transaction.category?.name || 'Khác'
      const color = transaction.category?.color || '#94A3B8'
      const amount = Number(transaction.amount || 0)
      const current = categoryMap.get(name) || { name, color, total: 0 }
      current.total += amount
      categoryMap.set(name, current)
    })

    const rawData = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total)
    return {
      labels: rawData.map((category) => category.name),
      datasets: [{
        data: rawData.map((category) => category.total),
        backgroundColor: rawData.map((category) => category.color),
        borderWidth: 2,
        borderColor: '#ffffff'
      }],
      rawData,
      error: null
    }
  } catch (err) {
    return { labels: [], datasets: [], rawData: [], error: err }
  }
}


/**
 * Tổng hợp dữ liệu thu/chi theo tuần, tháng hoặc năm để vẽ biểu đồ cột (UC17).
 * Tuần: 7 ngày gần nhất tính đến referenceDate; tháng: từng ngày trong tháng;
 * năm: tổng hợp theo 12 tháng của năm chứa referenceDate.
 */
export async function getIncomeExpenseTrend(period = 'month', referenceDate = new Date()) {
  try {
    if (!['week', 'month', 'year'].includes(period)) {
      throw new Error('Kỳ báo cáo không hợp lệ')
    }
    const reference = new Date(referenceDate)
    if (Number.isNaN(reference.getTime())) throw new Error('Ngày tham chiếu báo cáo không hợp lệ')

    const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const addDays = (date, amount) => {
      const next = new Date(date)
      next.setDate(next.getDate() + amount)
      return next
    }

    let startDate
    let endDate
    let buckets = []

    if (period === 'week') {
      const end = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
      const start = addDays(end, -6)
      startDate = toDateKey(start)
      endDate = toDateKey(end)
      buckets = Array.from({ length: 7 }, (_, index) => {
        const date = addDays(start, index)
        return { key: toDateKey(date), label: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}` }
      })
    } else if (period === 'month') {
      const year = reference.getFullYear()
      const month = reference.getMonth() + 1
      const days = new Date(year, month, 0).getDate()
      startDate = `${year}-${String(month).padStart(2, '0')}-01`
      endDate = `${year}-${String(month).padStart(2, '0')}-${String(days).padStart(2, '0')}`
      buckets = Array.from({ length: days }, (_, index) => ({
        key: `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
        label: String(index + 1)
      }))
    } else {
      const year = reference.getFullYear()
      startDate = `${year}-01-01`
      endDate = `${year}-12-31`
      buckets = Array.from({ length: 12 }, (_, index) => ({
        key: `${year}-${String(index + 1).padStart(2, '0')}`,
        label: `T${index + 1}`
      }))
    }

    const rows = await fetchReportTransactions({ startDate, endDate })
    const incomeByBucket = new Map(buckets.map((bucket) => [bucket.key, 0]))
    const expenseByBucket = new Map(buckets.map((bucket) => [bucket.key, 0]))

    rows.forEach((row) => {
      const dateKey = row.transaction_date
      const bucketKey = period === 'year' ? dateKey.slice(0, 7) : dateKey
      if (row.type === 'income' && incomeByBucket.has(bucketKey)) {
        incomeByBucket.set(bucketKey, incomeByBucket.get(bucketKey) + Number(row.amount || 0))
      } else if (row.type === 'expense' && expenseByBucket.has(bucketKey)) {
        expenseByBucket.set(bucketKey, expenseByBucket.get(bucketKey) + Number(row.amount || 0))
      }
    })

    return {
      labels: buckets.map((bucket) => bucket.label),
      income: buckets.map((bucket) => incomeByBucket.get(bucket.key)),
      expense: buckets.map((bucket) => expenseByBucket.get(bucket.key)),
      startDate,
      endDate,
      error: null
    }
  } catch (err) {
    return { labels: [], income: [], expense: [], startDate: null, endDate: null, error: err }
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
    if (curSummary.error) throw curSummary.error
    if (prevSummary.error) throw prevSummary.error

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
