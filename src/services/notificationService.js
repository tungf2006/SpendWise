import { supabase } from '@/lib/supabaseClient'

/**
 * Service quản lý Thông báo hệ thống và cảnh báo ngân sách
 * Phụ trách: TV4 (Lê Hoài Quốc) - Nhóm chức năng NOTI_QR (UC25)
 */

/**
 * Lấy danh sách tất cả thông báo của người dùng (UC25)
 * @param {number} limit Số lượng thông báo tối đa lấy về
 * @returns {Promise<{ data: any[], error: any }>}
 */
export async function getNotifications(limit = 30) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    return { data: data || [], error }
  } catch (err) {
    return { data: [], error: err }
  }
}

/**
 * Đếm số lượng thông báo chưa đọc (UC25)
 * @returns {Promise<{ count: number, error: any }>}
 */
export async function getUnreadCount() {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)

    return { count: count || 0, error }
  } catch (err) {
    return { count: 0, error: err }
  }
}

/**
 * Đánh dấu một thông báo là đã đọc (UC25)
 * @param {string} id ID thông báo
 * @returns {Promise<{ error: any }>}
 */
export async function markAsRead(id) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    return { error }
  } catch (err) {
    return { error: err }
  }
}

/**
 * Đánh dấu tất cả thông báo của người dùng là đã đọc (UC25)
 * @returns {Promise<{ error: any }>}
 */
export async function markAllAsRead() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    return { error }
  } catch (err) {
    return { error: err }
  }
}

/**
 * Tạo một thông báo mới cho người dùng
 * @param {{ title: string, message: string, type: 'budget_warning' | 'budget_exceeded' | 'recurring_due' | 'system' }} notiData 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function createNotification(notiData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        title: notiData.title,
        message: notiData.message,
        type: notiData.type,
        is_read: false
      })
      .select()
      .single()

    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}
