import { supabase } from '@/lib/supabaseClient'

const VALID_GOAL_STATUSES = ['in_progress', 'completed']

/**
 * Service quản lý Mục tiêu tiết kiệm và Nạp tiền vào mục tiêu
 * Phụ trách: TV1 (Trương Bích Vân) - Nhóm chức năng GOAL_REC (UC22 - UC23)
 */

async function getAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data?.user?.id) throw new Error('Người dùng chưa đăng nhập')
  return data.user
}

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
    const user = await getAuthenticatedUser()

    const trimmedName = typeof goalData?.name === 'string' ? goalData.name.trim() : ''
    if (!trimmedName) throw new Error('Tên mục tiêu không được để trống')

    const targetAmount = Number(goalData?.target_amount)
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      throw new Error('Mục tiêu tiền tiết kiệm phải lớn hơn 0')
    }

    const { data, error } = await supabase
      .from('saving_goals')
      .insert({
        user_id: user.id,
        name: trimmedName,
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
    if (!id) throw new Error('Thiếu ID mục tiêu cần cập nhật')
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new Error('Dữ liệu cập nhật mục tiêu không hợp lệ')
    }

    const user = await getAuthenticatedUser()
    const formattedUpdates = {}

    if (Object.prototype.hasOwnProperty.call(updates, 'name') && updates.name !== undefined) {
      const trimmedName = typeof updates.name === 'string' ? updates.name.trim() : ''
      if (!trimmedName) throw new Error('Tên mục tiêu không được để trống')
      formattedUpdates.name = trimmedName
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'target_amount') && updates.target_amount !== undefined) {
      const targetAmount = Number(updates.target_amount)
      if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        throw new Error('Mục tiêu tiền tiết kiệm phải lớn hơn 0')
      }
      formattedUpdates.target_amount = targetAmount
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'deadline') && updates.deadline !== undefined) {
      formattedUpdates.deadline = updates.deadline || null
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'wallet_id') && updates.wallet_id !== undefined) {
      formattedUpdates.wallet_id = updates.wallet_id || null
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'status') && updates.status !== undefined) {
      if (!VALID_GOAL_STATUSES.includes(updates.status)) {
        throw new Error('Trạng thái mục tiêu không hợp lệ')
      }
      formattedUpdates.status = updates.status
    }

    if (Object.keys(formattedUpdates).length === 0) {
      throw new Error('Không có thông tin hợp lệ để cập nhật')
    }

    const { data, error } = await supabase
      .from('saving_goals')
      .update(formattedUpdates)
      .eq('id', id)
      .eq('user_id', user.id)
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
    if (!id) throw new Error('Thiếu ID mục tiêu cần xóa')
    const user = await getAuthenticatedUser()

    const { error } = await supabase
      .from('saving_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

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
