import { supabase } from '@/lib/supabaseClient'

/**
 * SpendWise – notificationService.js (bản gộp chỉ 1 file).
 *
 * CÀI ĐẶT:
 * 1. Chép file này vào src/services/notificationService.js.
 * 2. BẮT BUỘC thiết lập database một lần: lấy nội dung chuỗi
 *    NOTIFICATION_SETUP_SQL ở cuối file, bỏ cặp dấu backtick (`),
 *    rồi dán nội dung SQL vào Supabase Dashboard > SQL Editor > Run.
 *    Không thể tự tạo PostgreSQL function/RLS từ JS chạy trên trình duyệt.
 * 3. Trong src/components/layout/AppLayout.jsx, thêm:
 *      import { startNotificationAutoSync } from '@/services/notificationService'
 *    Và TRONG component AppLayout (nếu đã có useEffect thì dùng thêm useEffect):
 *      useEffect(() => startNotificationAutoSync({ intervalMs: 300000, daysAhead: 3 }), [])
 *    Nhớ import useEffect từ 'react' nếu file chưa import.
 * 4. (Tùy chọn) Sau khi cập nhật giao dịch, Ngân sách hoặc định kỳ thành công:
 *      window.dispatchEvent(new Event('spendwise:finance-updated'))
 *
 * Chức năng: cảnh báo Ngân sách ở mức 80% / 100%; nhắc định kỳ
 * trong 3 ngày tới; xem, đếm, đánh dấu đã đọc và xóa thông báo.
 * Khi đóng ứng dụng, kiểm tra tự động ngừng hoạt động; để chạy 24/7
 * cần lịch Cron/Edge Function hoặc backend.
 *
 * TUYỆT ĐỐI không đặt service_role key ở frontend.
 */

const NOTIFICATION_TYPES = Object.freeze({
  BUDGET_WARNING: 'budget_warning',
  RECURRING_DUE: 'recurring_due',
  SYSTEM: 'system',
})

const DEFAULT_NOTIFICATION_LIMIT = 30
const MAX_NOTIFICATION_LIMIT = 100
const DEFAULT_REMINDER_DAYS = 3

function assertUuid(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('ID thông báo không hợp lệ')
  }
}

function assertReminderDays(daysAhead) {
  if (!Number.isInteger(daysAhead) || daysAhead < 0 || daysAhead > 30) {
    throw new Error('Số ngày nhắc trước phải là số nguyên từ 0 đến 30')
  }
}

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data?.user ?? null
}

/** Đọc tối đa 100 thông báo của người đăng nhập, mới nhất trước. */
export async function getNotifications(limit = DEFAULT_NOTIFICATION_LIMIT) {
  try {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_NOTIFICATION_LIMIT) {
      throw new Error(`Giới hạn thông báo phải từ 1 đến ${MAX_NOTIFICATION_LIMIT}`)
    }

    const user = await getCurrentUser()
    if (!user) return { data: [], error: null }

    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, title, message, type, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    return { data: data ?? [], error }
  } catch (error) {
    return { data: [], error }
  }
}

/** Đếm số thông báo chưa đọc để hiển thị trên chuông. */
export async function getUnreadCount() {
  try {
    const user = await getCurrentUser()
    if (!user) return { count: 0, error: null }

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    return { count: count ?? 0, error }
  } catch (error) {
    return { count: 0, error }
  }
}

/** Đánh dấu duy nhất một thông báo của chính mình là đã đọc. */
export async function markAsRead(id) {
  try {
    assertUuid(id)
    const user = await getCurrentUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id)

    return { error }
  } catch (error) {
    return { error }
  }
}

/** Đánh dấu tất cả thông báo chưa đọc của chính mình. */
export async function markAllAsRead() {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    return { error }
  } catch (error) {
    return { error }
  }
}

/** Xóa thông báo của chính mình (theo RLS). */
export async function deleteNotification(id) {
  try {
    assertUuid(id)
    const user = await getCurrentUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    return { error }
  } catch (error) {
    return { error }
  }
}

/**
 * Tự động kiểm tra Ngân sách và định kỳ rồi tạo notifications.
 *
 * PostgreSQL tính % theo transactions (chỉ type='expense', đúng tháng/năm)
 * và INSERT theo event_key duy nhất. Gọi nhiều lần, mở nhiều tab vẫn không
 * phát lặp cảnh báo cho cùng Ngân sách/mốc 80–100% hoặc kỳ đến hạn.
 *
 * @param {{ daysAhead?: number }} options Số ngày cần nhắc trước (0..30).
 * @returns {Promise<{ data: { budget_warning: number, recurring_due: number }, error: any }>}
 */
export async function checkAndGenerateNotifications({ daysAhead = DEFAULT_REMINDER_DAYS } = {}) {
  const empty = { budget_warning: 0, recurring_due: 0 }
  try {
    assertReminderDays(daysAhead)
    const user = await getCurrentUser()
    // Không chạy đồng bộ dữ liệu tài chính khi chưa đăng nhập.
    if (!user) return { data: empty, error: null }

    const { data, error } = await supabase.rpc('sync_finance_notifications', {
      p_days_ahead: daysAhead,
    })

    if (error) return { data: empty, error }
    return {
      data: {
        budget_warning: Number(data?.budget_warning ?? 0),
        recurring_due: Number(data?.recurring_due ?? 0),
      },
      error: null,
    }
  } catch (error) {
    return { data: empty, error }
  }
}

/** Tên hàm dễ gọi từ các trang hoặc AppLayout. */
export const syncNotifications = checkAndGenerateNotifications

/**
 * Hàm cũ được giữ lại để tránh lỗi import, nhưng không cho trình duyệt tự
 * tạo notification với nội dung bất kỳ (trái RLS hệ thống/server trong đặc tả).
 * Nếu cần loại 'system', tạo từ backend đáng tin cậy (service_role ở server).
 */
export async function createNotification(_notiData) {
  return {
    data: null,
    error: new Error('Chỉ hệ thống/server được phép tạo thông báo. Hãy dùng checkAndGenerateNotifications() hoặc backend.'),
  }
}

export { NOTIFICATION_TYPES }

/**
 * Chức năng đã gộp từ useNotificationAutoSync.js.
 *
 * Dùng trong React:
 *   useEffect(() => startNotificationAutoSync(), [])
 *
 * @returns {() => void} Hàm cleanup dùng làm return của useEffect.
 */
export function startNotificationAutoSync({
  intervalMs = 5 * 60 * 1000,
  daysAhead = DEFAULT_REMINDER_DAYS,
} = {}) {
  if (!Number.isInteger(intervalMs) || intervalMs < 1000) {
    throw new Error('Khoảng thời gian đồng bộ phải là số nguyên >= 1000 ms')
  }
  assertReminderDays(daysAhead)
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Trong môi trường SSR không có trình duyệt nên không lập lịch.
    return () => {}
  }

  let active = true
  let running = false
  async function sync() {
    if (!active || running || document.visibilityState === 'hidden') return
    running = true
    try {
      const { error } = await checkAndGenerateNotifications({ daysAhead })
      if (error && active) {
        console.warn('[SpendWise] Đồng bộ thông báo thất bại:', error)
      }
    } catch (error) {
      if (active) console.warn('[SpendWise] Lỗi đồng bộ thông báo:', error)
    } finally {
      running = false
    }
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') void sync()
  }
  const onFinanceUpdated = () => { void sync() }

  void sync()
  const timer = window.setInterval(() => { void sync() }, intervalMs)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('spendwise:finance-updated', onFinanceUpdated)

  return () => {
    active = false
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('spendwise:finance-updated', onFinanceUpdated)
  }
}

/**
 * SQL thiết lập database (gộp từ file migration.sql).
 * Sao chép CHỈ nội dung giữa 2 dấu backtick vào Supabase SQL Editor và chạy
 * MỘT LẦN trước khi dùng checkAndGenerateNotifications().
 *
 * Cần quyền quản trị database để cài RPC/RLS. Không thực thi chuỗi SQL này
 * qua Supabase JS client ở trình duyệt; việc đó không an toàn/không có quyền.
 */
