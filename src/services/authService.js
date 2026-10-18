import { supabase } from '@/lib/supabaseClient'

/**
 * Service xác thực người dùng và quản lý hồ sơ cá nhân
 * Phụ trách: TV1 (Trương Bích Vân) - Nhóm chức năng AUTH (UC01 - UC05)
 */

/**
 * Đăng ký tài khoản mới bằng Email và Mật khẩu (UC01)
 * @param {string} email 
 * @param {string} password 
 * @param {string} fullName 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function signUp(email, password, fullName = '') {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    })
    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Đăng nhập bằng Email và Mật khẩu (UC02)
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Đăng xuất khỏi hệ thống (UC03)
 * @returns {Promise<{ error: any }>}
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    return { error }
  } catch (err) {
    return { error: err }
  }
}

/**
 * Yêu cầu gửi email đặt lại mật khẩu (UC04)
 * @param {string} email 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function resetPasswordForEmail(email) {
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Lấy thông tin hồ sơ người dùng hiện tại (UC05)
 * @param {string} userId 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function getProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Cập nhật thông tin hồ sơ người dùng (UC05)
 * @param {string} userId 
 * @param {{ full_name?: string, avatar_url?: string, default_bank_bin?: string, default_bank_account?: string }} profileData 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function updateProfile(userId, profileData) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()
    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}
