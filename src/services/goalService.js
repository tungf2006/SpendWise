import { supabase } from '@/lib/supabaseClient'

/**
 * Service quản lý Mục tiêu tiết kiệm và Nạp tiền vào mục tiêu
 * Phụ trách: TV1 (Trương Bích Vân) - Nhóm chức năng GOAL_REC (UC22 - UC23)
 */

/**
 * Lấy danh sách tất cả mục tiêu tiết kiệm của người dùng (UC22)
 * @returns {Promise<{ data: any[], error: any }>}
 */
export async function getGoals() {
  try {
    const { data, error } = await supabase
      .from('saving_goals')
      .select(`
        *,
        wallet:wallets(id, name, color, icon)
      `)
      .order('created_at', { ascending: false })

    return { data: data || [], error }
  } catch (err) {
    return { data: [], error: err }
  }
}

/**
 * Tạo một mục tiêu tiết kiệm mới (UC22)
 * @param {{ name: string, target_amount: number, deadline?: string, wallet_id?: string }} goalData 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function createGoal(goalData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const targetAmount = Number(goalData.target_amount)
    if (targetAmount <= 0) throw new Error('Mục tiêu tiền tiết kiệm phải lớn hơn 0')

    const { data, error } = await supabase
      .from('saving_goals')
      .insert({
        user_id: user.id,
        name: goalData.name,
        target_amount: targetAmount,
        current_amount: 0,
        deadline: goalData.deadline || null,
        wallet_id: goalData.wallet_id || null,
        status: 'in_progress'
      })
      .select(`
        *,
        wallet:wallets(id, name, color, icon)
      `)
      .single()

    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Cập nhật thông tin mục tiêu tiết kiệm (UC22)
 * @param {string} id 
 * @param {object} updates 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function updateGoal(id, updates) {
  try {
    const { data, error } = await supabase
      .from('saving_goals')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        wallet:wallets(id, name, color, icon)
      `)
      .single()

    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Xóa mục tiêu tiết kiệm (UC22)
 * @param {string} id 
 * @returns {Promise<{ error: any }>}
 */
export async function deleteGoal(id) {
  try {
    const { error } = await supabase
      .from('saving_goals')
      .delete()
      .eq('id', id)

    return { error }
  } catch (err) {
    return { error: err }
  }
}

/**
 * Nạp tiền vào mục tiêu tiết kiệm (UC23)
 * Trừ tiền từ ví được chọn và cộng dồn vào current_amount của mục tiêu
 * @param {{ goalId: string, amount: number, walletId: string }} depositData 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function depositToGoal({ goalId, amount, walletId }) {
  try {
    const depositAmount = Number(amount)

    if (!goalId || !walletId) {
      throw new Error('Vui lòng chọn mục tiêu và ví nguồn')
    }

    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      throw new Error('Số tiền nạp phải là số hợp lệ và lớn hơn 0')
    }

    const { data, error } = await supabase.rpc('deposit_to_goal', {
      p_goal_id: goalId,
      p_wallet_id: walletId,
      p_amount: depositAmount,
    })

    if (error) throw error

    return { data, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}
