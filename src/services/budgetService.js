import { supabase } from '@/lib/supabaseClient'

/**
 * SpendWise – Dịch vụ quản lý Ngân sách (Budget), UC14–UC15.
 *
 * Sử dụng các bảng: budgets, categories, transactions.
 * Ưu tiên view v_budget_progress (đã có trong supabase/init_schema.sql).
 * Mọi truy vấn luôn ràng buộc theo user_id của phiên Supabase hiện tại;
 * RLS tại database vẫn là lớp bảo vệ bắt buộc.
 *
 * API tương thích với BudgetPage.jsx hiện hành:
 *   getBudgets(month, year)
 *   setBudget({ category_id, month, year, amount_limit })
 *   deleteBudget(id)
 *   getBudgetProgress(month, year)
 *
 * API bổ sung:
 *   getBudgetById(id), createBudget(data), updateBudget(id, updates),
 *   getBudgetAlerts(month, year), calculateBudgetUsage(...), getBudgetStatus(...)
 */

export const BUDGET_THRESHOLDS = Object.freeze({ warning: 80, exceeded: 100 })

export const BUDGET_STATUSES = Object.freeze({
  safe: Object.freeze({ label: 'An toàn', color: 'emerald' }),
  warning: Object.freeze({ label: 'Sắp vượt', color: 'amber' }),
  exceeded: Object.freeze({ label: 'Đã vượt', color: 'rose' }),
})

const BUDGET_SELECT = '*, category:categories(id, name, color, icon)'
const TRANSACTION_PAGE_SIZE = 500
const MAX_BUDGET_AMOUNT = 9999999999999.99 // Khớp NUMERIC(15, 2)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requireBudgetId(budgetId, field = 'id') {
  if (typeof budgetId !== 'string' || !UUID_PATTERN.test(budgetId)) {
    throw new Error(`${field} của Ngân sách (Budget) phải là UUID hợp lệ`)
  }
  return budgetId
}

function requireBudgetPeriod(month, year) {
  const budgetMonth = Number(month)
  const budgetYear = Number(year)
  if (!Number.isInteger(budgetMonth) || budgetMonth < 1 || budgetMonth > 12) {
    throw new Error('Tháng của Ngân sách (Budget) phải nằm trong khoảng 1–12')
  }
  if (!Number.isInteger(budgetYear) || budgetYear < 2020 || budgetYear > 9999) {
    throw new Error('Năm của Ngân sách (Budget) phải từ 2020 đến 9999')
  }
  return { month: budgetMonth, year: budgetYear }
}

function requireBudgetAmount(amountLimit) {
  // Không để Number('') hoặc Number(null) âm thầm chuyển thành 0.
  if (amountLimit === null || amountLimit === undefined || amountLimit === '' || typeof amountLimit === 'boolean') {
    throw new Error('Hạn mức Ngân sách (Budget) không được để trống')
  }
  const budgetAmount = Number(amountLimit)
  if (!Number.isFinite(budgetAmount) || budgetAmount <= 0 || budgetAmount > MAX_BUDGET_AMOUNT) {
    throw new Error('Hạn mức Ngân sách (Budget) phải lớn hơn 0 và phù hợp NUMERIC(15,2)')
  }
  if (Math.abs(budgetAmount * 100 - Math.round(budgetAmount * 100)) > 0.00001) {
    throw new Error('Hạn mức Ngân sách (Budget) chỉ được có tối đa 2 chữ số thập phân')
  }
  return Math.round(budgetAmount * 100) / 100
}

async function getAuthenticatedBudgetUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data?.user?.id) throw new Error('Vui lòng đăng nhập để quản lý Ngân sách (Budget)')
  return data.user
}

function checkBudgetResponse(response) {
  if (response.error) throw response.error
  return response.data
}

async function validateBudgetCategory(categoryId, userId) {
  requireBudgetId(categoryId, 'category_id')
  const category = checkBudgetResponse(await supabase
    .from('categories')
    .select('id, user_id, type')
    .eq('id', categoryId)
    .maybeSingle())

  if (!category || category.type !== 'expense' || (category.user_id !== null && category.user_id !== userId)) {
    throw new Error('Danh mục (Category) không tồn tại, không thuộc người dùng hoặc không phải danh mục chi tiêu')
  }
}

function normalizeBudgetInput(budgetData) {
  if (!budgetData || typeof budgetData !== 'object' || Array.isArray(budgetData)) {
    throw new Error('Dữ liệu Ngân sách (Budget) không hợp lệ')
  }
  const category_id = requireBudgetId(budgetData.category_id, 'category_id')
  const { month, year } = requireBudgetPeriod(budgetData.month, budgetData.year)
  const amount_limit = requireBudgetAmount(budgetData.amount_limit)
  return { category_id, month, year, amount_limit }
}

/** Lấy trạng thái từ % THỰC TẾ (không làm tròn trước khi phân loại). */
export function getBudgetStatus(percentage) {
  const budgetPercentage = Number(percentage)
  if (!Number.isFinite(budgetPercentage) || budgetPercentage < 0) {
    throw new Error('Tỷ lệ Ngân sách (Budget) phải là số không âm hợp lệ')
  }
  if (budgetPercentage >= BUDGET_THRESHOLDS.exceeded) return 'exceeded'
  if (budgetPercentage >= BUDGET_THRESHOLDS.warning) return 'warning'
  return 'safe'
}

/**
 * Công thức: tỷ lệ đã chi = spent_amount / amount_limit × 100.
 * percentage: độ rộng thanh tiến độ 0–100%, actual_percentage: tỷ lệ thực.
 * Hàm thuần – có thể dùng để preview trên giao diện mà không gọi Supabase.
 */
export function calculateBudgetUsage({ amount_limit, spent_amount = 0, category_name = 'danh mục này' }) {
  const budgetAmount = requireBudgetAmount(amount_limit)
  const spentAmount = Number(spent_amount)
  if (!Number.isFinite(spentAmount) || spentAmount < 0) {
    throw new Error('Số tiền đã chi của Ngân sách (Budget) không hợp lệ')
  }

  const actualPercentage = (spentAmount / budgetAmount) * 100
  const budgetStatus = getBudgetStatus(actualPercentage)
  const budgetStatusInfo = BUDGET_STATUSES[budgetStatus]
  const categoryName = typeof category_name === 'string' && category_name.trim()
    ? category_name.trim()
    : 'danh mục này'

  let alertMessage = null
  if (budgetStatus === 'warning') {
    alertMessage = `Ngân sách (Budget) cho danh mục "${categoryName}" sắp vượt hạn mức: đã sử dụng ${actualPercentage.toFixed(1)}%.`
  } else if (budgetStatus === 'exceeded') {
    alertMessage = `Ngân sách (Budget) cho danh mục "${categoryName}" đã đạt hoặc vượt hạn mức: đã sử dụng ${actualPercentage.toFixed(1)}%.`
  }

  return {
    budget_amount: budgetAmount,
    spent_amount: spentAmount,
    remaining_amount: budgetAmount - spentAmount, // Âm nếu đã vượt hạn mức
    percentage: Math.min(100, actualPercentage),  // Chỉ dùng làm chiều rộng thanh
    actual_percentage: Number(actualPercentage.toFixed(1)),
    status: budgetStatus,                            // safe | warning | exceeded
    status_label: budgetStatusInfo.label,           // An toàn | Sắp vượt | Đã vượt
    progress_color: budgetStatusInfo.color,         // emerald | amber | rose
    is_alert: budgetStatus !== 'safe',
    alert_message: alertMessage,
    exceeded_amount: Math.max(0, spentAmount - budgetAmount),
  }
}

/** READ: Danh sách Ngân sách (Budget) của người dùng theo tháng và năm. */
export async function getBudgets(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
  try {
    const budgetPeriod = requireBudgetPeriod(month, year)
    const budgetUser = await getAuthenticatedBudgetUser()
    const data = checkBudgetResponse(await supabase
      .from('budgets')
      .select(BUDGET_SELECT)
      .eq('user_id', budgetUser.id)
      .eq('month', budgetPeriod.month)
      .eq('year', budgetPeriod.year)
      .order('category_id', { ascending: true }))
    return { data: data ?? [], error: null }
  } catch (error) {
    return { data: [], error }
  }
}

/** READ: Chi tiết một Ngân sách (Budget), chỉ trong phạm vi người dùng hiện tại. */
export async function getBudgetById(budgetId) {
  try {
    requireBudgetId(budgetId)
    const budgetUser = await getAuthenticatedBudgetUser()
    const data = checkBudgetResponse(await supabase
      .from('budgets')
      .select(BUDGET_SELECT)
      .eq('id', budgetId)
      .eq('user_id', budgetUser.id)
      .maybeSingle())
    if (!data) throw new Error('Không tìm thấy Ngân sách (Budget)')
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/** CREATE: Tạo Ngân sách (Budget) mới; nếu trùng danh mục/tháng/năm thì trả lỗi unique. */
export async function createBudget(budgetData) {
  try {
    const budgetInput = normalizeBudgetInput(budgetData)
    const budgetUser = await getAuthenticatedBudgetUser()
    await validateBudgetCategory(budgetInput.category_id, budgetUser.id)
    const data = checkBudgetResponse(await supabase
      .from('budgets')
      .insert({ ...budgetInput, user_id: budgetUser.id })
      .select(BUDGET_SELECT)
      .single())
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * CREATE/UPDATE: Thiết lập Ngân sách (Budget) theo danh mục + tháng + năm.
 * Giữ tương thích với BudgetPage.jsx: có rồi thì cập nhật (upsert), chưa có thì tạo.
 * Yêu cầu DB có UNIQUE(user_id, category_id, month, year).
 */
export async function setBudget(budgetData) {
  try {
    const budgetInput = normalizeBudgetInput(budgetData)
    const budgetUser = await getAuthenticatedBudgetUser()
    await validateBudgetCategory(budgetInput.category_id, budgetUser.id)
    const data = checkBudgetResponse(await supabase
      .from('budgets')
      .upsert({ ...budgetInput, user_id: budgetUser.id }, {
        onConflict: 'user_id,category_id,month,year',
      })
      .select(BUDGET_SELECT)
      .single())
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/** UPDATE: Sửa một hoặc nhiều trường của Ngân sách (Budget) theo id. */
export async function updateBudget(budgetId, updates) {
  try {
    requireBudgetId(budgetId)
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new Error('Dữ liệu cập nhật Ngân sách (Budget) không hợp lệ')
    }

    const allowedBudgetFields = ['category_id', 'month', 'year', 'amount_limit']
    const requestedBudgetFields = Object.keys(updates)
    if (!requestedBudgetFields.length || requestedBudgetFields.some((field) => !allowedBudgetFields.includes(field))) {
      throw new Error('Chỉ được sửa category_id, month, year, amount_limit của Ngân sách (Budget)')
    }

    const budgetUser = await getAuthenticatedBudgetUser()
    // Lấy giá trị cũ để kiểm tra đúng bộ dữ liệu khi cập nhật một phần.
    const currentBudget = checkBudgetResponse(await supabase
      .from('budgets')
      .select('id, category_id, month, year, amount_limit')
      .eq('id', budgetId)
      .eq('user_id', budgetUser.id)
      .maybeSingle())
    if (!currentBudget) throw new Error('Không tìm thấy Ngân sách (Budget) cần cập nhật')

    const nextBudget = normalizeBudgetInput({ ...currentBudget, ...updates })
    if (updates.category_id !== undefined) {
      await validateBudgetCategory(nextBudget.category_id, budgetUser.id)
    }
    const budgetChanges = Object.fromEntries(
      requestedBudgetFields.map((field) => [field, nextBudget[field]])
    )
    const data = checkBudgetResponse(await supabase
      .from('budgets')
      .update(budgetChanges)
      .eq('id', budgetId)
      .eq('user_id', budgetUser.id)
      .select(BUDGET_SELECT)
      .maybeSingle())
    if (!data) throw new Error('Không tìm thấy Ngân sách (Budget) cần cập nhật')
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/** DELETE: Xóa Ngân sách (Budget) của người dùng hiện tại. */
export async function deleteBudget(budgetId) {
  try {
    requireBudgetId(budgetId)
    const budgetUser = await getAuthenticatedBudgetUser()
    const data = checkBudgetResponse(await supabase
      .from('budgets')
      .delete()
      .eq('id', budgetId)
      .eq('user_id', budgetUser.id)
      .select('id')
      .maybeSingle())
    if (!data) throw new Error('Không tìm thấy Ngân sách (Budget) để xóa')
    return { error: null }
  } catch (error) {
    return { error }
  }
}

function buildBudgetProgressRow(budget, spentAmount) {
  return {
    ...budget,
    ...calculateBudgetUsage({
      amount_limit: budget.amount_limit,
      spent_amount: spentAmount,
      category_name: budget.category?.name,
    }),
  }
}

/**
 * Đọc view PostgreSQL của SpendWise để tổng hợp chi tiêu ở phía database.
 * View v_budget_progress có security_invoker=true và phải được bật RLS.
 */
async function readBudgetProgressView(budgetUser, budgetPeriod) {
  const { data, error } = await supabase
    .from('v_budget_progress')
    .select('budget_id, user_id, category_id, category_name, category_color, category_icon, month, year, budget_amount, spent_amount')
    .eq('user_id', budgetUser.id)
    .eq('month', budgetPeriod.month)
    .eq('year', budgetPeriod.year)
    .order('category_name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((budgetRow) => buildBudgetProgressRow({
    id: budgetRow.budget_id,
    user_id: budgetRow.user_id,
    category_id: budgetRow.category_id,
    month: budgetRow.month,
    year: budgetRow.year,
    amount_limit: budgetRow.budget_amount,
    category: {
      id: budgetRow.category_id,
      name: budgetRow.category_name,
      color: budgetRow.category_color,
      icon: budgetRow.category_icon,
    },
  }, Number(budgetRow.spent_amount ?? 0)))
}

/**
 * Phương án dự phòng: tổng hợp transactions bằng phân trang, tránh giới hạn
 * 1.000 giao dịch mặc định của Supabase/PostgREST.
 * Chỉ tính type='expense'; income và transfer không được tính là chi tiêu.
 */
async function readBudgetProgressTransactions(budgetUser, budgetPeriod) {
  const budgets = checkBudgetResponse(await supabase
    .from('budgets')
    .select(BUDGET_SELECT)
    .eq('user_id', budgetUser.id)
    .eq('month', budgetPeriod.month)
    .eq('year', budgetPeriod.year)
    .order('category_id', { ascending: true })) ?? []
  if (!budgets.length) return []

  const startDate = `${budgetPeriod.year}-${String(budgetPeriod.month).padStart(2, '0')}-01`
  const nextMonth = budgetPeriod.month === 12 ? 1 : budgetPeriod.month + 1
  const nextYear = budgetPeriod.month === 12 ? budgetPeriod.year + 1 : budgetPeriod.year
  const nextMonthDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  const spentByCategory = new Map()

  for (let offset = 0; ; offset += TRANSACTION_PAGE_SIZE) {
    const page = checkBudgetResponse(await supabase
      .from('transactions')
      .select('id, category_id, amount')
      .eq('user_id', budgetUser.id)
      .eq('type', 'expense')
      .gte('transaction_date', startDate)
      .lt('transaction_date', nextMonthDate)
      .order('id', { ascending: true })
      .range(offset, offset + TRANSACTION_PAGE_SIZE - 1)) ?? []

    for (const transaction of page) {
      if (!transaction.category_id) continue
      const spent = Number(transaction.amount)
      if (!Number.isFinite(spent) || spent < 0) throw new Error('Giao dịch (Transaction) có số tiền không hợp lệ')
      spentByCategory.set(transaction.category_id, (spentByCategory.get(transaction.category_id) ?? 0) + spent)
    }
    if (page.length < TRANSACTION_PAGE_SIZE) break
  }

  return budgets.map((budget) => buildBudgetProgressRow(
    budget, spentByCategory.get(budget.category_id) ?? 0
  ))
}

/**
 * UC15: % Ngân sách (Budget) đã chi theo từng danh mục và cảnh báo 3 mức.
 * Không ghi notifications mỗi lần đọc (tránh sinh thông báo trùng lặp).
 *
 * Kết quả vẫn gồm data, totalBudget, totalSpent, error để BudgetPage.jsx
 * hiện hành sử dụng mà không cần sửa JSX.
 */
export async function getBudgetProgress(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
  try {
    const budgetPeriod = requireBudgetPeriod(month, year)
    const budgetUser = await getAuthenticatedBudgetUser()
    let budgetProgress
    try {
      budgetProgress = await readBudgetProgressView(budgetUser, budgetPeriod)
    } catch (viewError) {
      // View thiếu / quyền chưa cấu hình? Tiếp tục tính bằng bảng gốc.
      // Lỗi của cả hai nhánh được trả về cho màn hình để tránh số liệu giả.
      budgetProgress = await readBudgetProgressTransactions(budgetUser, budgetPeriod)
    }

    const totalBudget = budgetProgress.reduce((total, budget) => total + budget.budget_amount, 0)
    const totalSpent = budgetProgress.reduce((total, budget) => total + budget.spent_amount, 0)
    const totalRemaining = totalBudget - totalSpent
    const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
    const alerts = budgetProgress.filter((budget) => budget.is_alert).map((budget) => ({
      budget_id: budget.id,
      category_id: budget.category_id,
      category_name: budget.category?.name ?? 'Danh mục',
      status: budget.status,
      status_label: budget.status_label,
      actual_percentage: budget.actual_percentage,
      message: budget.alert_message,
    }))

    return {
      data: budgetProgress,
      totalBudget,
      totalSpent,
      totalRemaining,
      overall_percentage: Number(overallPercentage.toFixed(1)),
      overall_status: getBudgetStatus(overallPercentage),
      alerts,
      alertCount: alerts.length,
      error: null,
    }
  } catch (error) {
    return {
      data: [], totalBudget: 0, totalSpent: 0, totalRemaining: 0,
      overall_percentage: 0, overall_status: 'safe', alerts: [], alertCount: 0, error,
    }
  }
}

/** Danh sách cảnh báo Ngân sách (Budget) để hiển thị trong trang/chuông. */
export async function getBudgetAlerts(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
  const result = await getBudgetProgress(month, year)
  return { data: result.alerts, error: result.error }
}
