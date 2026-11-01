import { supabase } from '@/lib/supabaseClient'

/**
 * Service Giao dịch định kỳ (RecurringRule) - UC24.
 * Chỉ thao tác với recurring_rules, KHÔNG tự tạo giao dịch hay trừ/cộng số dư Ví.
 */

const RECURRING_RULE_SELECT = `
  *,
  wallet:wallets(id, name, color, icon),
  category:categories(id, name, color, icon)
`

// 'yearly' được giữ để đọc/sửa dữ liệu cũ từ schema SpendWise hiện tại.
// 'daily' theo tài liệu Word cần migration CHECK(frequency) trước khi lưu vào DB.
const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly']
const VALID_TYPES = ['income', 'expense']
const EDITABLE_FIELDS = [
  'wallet_id', 'category_id', 'title', 'type', 'amount',
  'frequency', 'day_of_month', 'next_due_date', 'is_active'
]

async function getUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data?.user?.id) throw new Error('Bạn cần đăng nhập để quản lý Giao dịch định kỳ.')
  return data.user.id
}

/** Đọc ngày DATE (YYYY-MM-DD) trong UTC để tránh lệch ngày vì múi giờ. */
function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Ngày đến hạn phải có định dạng YYYY-MM-DD.')
  }

  const [year, month, day] = value.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day))
  if (
    !Number.isFinite(result.getTime()) ||
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() + 1 !== month ||
    result.getUTCDate() !== day
  ) {
    throw new Error('Ngày đến hạn không hợp lệ.')
  }
  return result
}

function dateOnlyToString(date) {
  return [
    date.getUTCFullYear().toString().padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function normalizeDayOfMonth(value) {
  const day = Number(value)
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error('Ngày trong tháng phải là số nguyên từ 1 đến 31.')
  }
  return day
}

/**
 * Chỉ nhận các trường được cho phép; không để giao diện sửa id, user_id hay created_at.
 * Giữ day_of_month là số 1..31 kể cả chu kỳ hàng tuần để tương thích ràng buộc
 * NOT NULL trong tài liệu. Với weekly, giá trị này không tham gia tính lịch.
 */
function normalizeRecurringRule(input, isCreate = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Dữ liệu Giao dịch định kỳ không hợp lệ.')
  }

  const result = {}
  for (const field of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) result[field] = input[field]
  }

  if (isCreate) {
    const required = ['wallet_id', 'category_id', 'title', 'type', 'amount', 'frequency', 'next_due_date']
    if (required.some((field) => result[field] === undefined || result[field] === null || result[field] === '')) {
      throw new Error('Vui lòng điền đầy đủ thông tin Giao dịch định kỳ.')
    }
  }

  for (const field of ['wallet_id', 'category_id']) {
    if (field in result && (typeof result[field] !== 'string' || !result[field].trim())) {
      throw new Error(field === 'wallet_id' ? 'Vui lòng chọn Ví.' : 'Vui lòng chọn Danh mục.')
    }
  }

  if ('title' in result) {
    result.title = String(result.title ?? '').trim()
    if (!result.title) throw new Error('Tên Giao dịch định kỳ không được trống.')
  }

  if ('type' in result && !VALID_TYPES.includes(result.type)) {
    throw new Error('Loại Giao dịch định kỳ phải là khoản thu hoặc khoản chi.')
  }

  if ('amount' in result) {
    result.amount = Number(result.amount)
    if (!Number.isFinite(result.amount) || result.amount <= 0 || result.amount > 9999999999999.99) {
      throw new Error('Số tiền phải lớn hơn 0 và trong giới hạn NUMERIC(15,2).')
    }
    // Bảng NUMERIC(15,2): không chấp nhận quá 2 chữ số thập phân.
    if (Math.abs(result.amount * 100 - Math.round(result.amount * 100)) > 1e-6) {
      throw new Error('Số tiền chỉ được có tối đa 2 chữ số thập phân.')
    }
  }

  if ('frequency' in result && !VALID_FREQUENCIES.includes(result.frequency)) {
    throw new Error('Chu kỳ Giao dịch định kỳ không hợp lệ.')
  }

  if ('next_due_date' in result) {
    parseDateOnly(result.next_due_date)
  }

  if ('day_of_month' in result) {
    result.day_of_month = normalizeDayOfMonth(result.day_of_month)
  } else if (isCreate) {
    // day_of_month NOT NULL theo tài liệu; với weekly/daily lấy ngày từ ngày đến hạn.
    result.day_of_month = Number(result.next_due_date.slice(-2))
  }

  if ('is_active' in result && typeof result.is_active !== 'boolean') {
    throw new Error('Trạng thái kích hoạt phải là true hoặc false.')
  }

  return result
}

/** Lấy danh sách Giao dịch định kỳ của người dùng đăng nhập, sắp theo ngày đến hạn. */
export async function getRecurringRules() {
  try {
    const userId = await getUserId()
    const { data, error } = await supabase
      .from('recurring_rules')
      .select(RECURRING_RULE_SELECT)
      .eq('user_id', userId)
      .order('next_due_date', { ascending: true })
    return { data: data || [], error }
  } catch (error) {
    return { data: [], error }
  }
}

/** Tạo Giao dịch định kỳ; user_id được lấy từ phiên xác thực, không nhận từ client. */
export async function createRecurringRule(recurringRuleData) {
  try {
    const userId = await getUserId()
    const payload = normalizeRecurringRule(recurringRuleData, true)
    const { data, error } = await supabase
      .from('recurring_rules')
      .insert({ ...payload, user_id: userId, is_active: true })
      .select(RECURRING_RULE_SELECT)
      .single()
    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

/** Sửa Giao dịch định kỳ; chỉ được sửa các trường nghiệp vụ của chính người dùng. */
export async function updateRecurringRule(id, updates) {
  try {
    if (!id) throw new Error('Thiếu mã Giao dịch định kỳ cần cập nhật.')
    const userId = await getUserId()
    const payload = normalizeRecurringRule(updates)
    if (!Object.keys(payload).length) throw new Error('Không có dữ liệu để cập nhật.')

    const { data, error } = await supabase
      .from('recurring_rules')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select(RECURRING_RULE_SELECT)
      .single()
    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

/** Bật/tắt Giao dịch định kỳ, không tự động bỏ qua các kỳ chưa xử lý. */
export async function toggleRuleActive(id, isActive) {
  return updateRecurringRule(id, { is_active: isActive })
}

/** Xóa Giao dịch định kỳ của người dùng đang đăng nhập. */
export async function deleteRecurringRule(id) {
  try {
    if (!id) throw new Error('Thiếu mã Giao dịch định kỳ cần xóa.')
    const userId = await getUserId()
    const { error } = await supabase
      .from('recurring_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    return { error }
  } catch (error) {
    return { error }
  }
}

/**
 * Tính ngày đến hạn KẾ TIẾP (không thay đổi CSDL).
 * daily: +1 ngày, weekly: +7 ngày, monthly: sang tháng sau theo ngày gốc.
 * Ví dụ: ngày 31/01 -> 28/02 -> 31/03 (vẫn giữ day_of_month = 31).
 * yearly: hỗ trợ các quy tắc cũ hiện có trong schema GitHub.
 * @param {string} currentDueDate YYYY-MM-DD
 * @param {'daily' | 'weekly' | 'monthly' | 'yearly'} frequency
 * @param {number|null} dayOfMonth Ngày gốc 1..31, ưu tiên khi monthly
 * @returns {string} YYYY-MM-DD
 */
export function calculateNextDueDate(currentDueDate, frequency, dayOfMonth = null) {
  const date = parseDateOnly(currentDueDate)
  if (!VALID_FREQUENCIES.includes(frequency)) {
    throw new Error('Chu kỳ Giao dịch định kỳ không hợp lệ.')
  }

  if (frequency === 'daily' || frequency === 'weekly') {
    date.setUTCDate(date.getUTCDate() + (frequency === 'daily' ? 1 : 7))
    return dateOnlyToString(date)
  }

  if (frequency === 'monthly') {
    const originalDay = dayOfMonth == null ? date.getUTCDate() : normalizeDayOfMonth(dayOfMonth)
    // Tạo mùng 1 tháng kế, rồi giới hạn ngày theo số ngày của tháng mới.
    const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
    const maxDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate()
    nextMonth.setUTCDate(Math.min(originalDay, maxDay))
    return dateOnlyToString(nextMonth)
  }

  // Hỗ trợ quy tắc yearly cũ, kể cả 29/02 của năm nhuận.
  const year = date.getUTCFullYear() + 1
  const month = date.getUTCMonth()
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return dateOnlyToString(new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), maxDay))))
}

/**
 * Khi người dùng xác nhận đã xử lý một kỳ, chuyển hạn sang đúng MỘT kỳ tiếp theo.
 * Không tự sinh giao dịch, nên tránh ghi nhận thu/chi trùng hoặc nhảy mất kỳ quá hạn.
 */
export async function advanceRecurringRule(recurringRule) {
  try {
    if (!recurringRule?.id) throw new Error('Thiếu Giao dịch định kỳ cần chuyển kỳ.')
    const nextDueDate = calculateNextDueDate(
      recurringRule.next_due_date,
      recurringRule.frequency,
      recurringRule.day_of_month
    )
    return updateRecurringRule(recurringRule.id, { next_due_date: nextDueDate })
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Kiểm tra và tự động sinh giao dịch định kỳ đến hạn.
 *
 * Điều kiện:
 * - is_active = true
 * - next_due_date <= today
 *
 * Chức năng:
 * - Tạo giao dịch trong bảng transactions.
 * - Cập nhật số dư ví.
 * - Cập nhật next_due_date.
 * - Xử lý các kỳ bị bỏ lỡ.
 * - Không tạo trùng cùng một kỳ.
 *
 * @returns {Promise<{
 *   data: { generatedCount: number } | null,
 *   error: any
 * }>}
 */
export async function checkAndGenerateRecurringTransactions() {
  try {
    // 1. Kiểm tra đăng nhập
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError) throw authError

    if (!user) {
      throw new Error('Người dùng chưa đăng nhập')
    }

    // 2. Gọi PostgreSQL RPC để xử lý atomically
    const { data, error } = await supabase.rpc(
      'generate_due_recurring_transactions'
    )

    if (error) throw error

    const generatedCount = Number(data ?? 0)

    console.log(
      `[SpendWise] Đã sinh ${generatedCount} giao dịch định kỳ.`
    )

    return {
      data: { generatedCount },
      error: null
    }
  } catch (err) {
    console.error(
      '[SpendWise] Lỗi sinh giao dịch định kỳ:',
      err
    )

    return {
      data: null,
      error: err
    }
  }
}
