import { supabase } from '@/lib/supabaseClient'

/**
 * Service quản lý Ví và Chuyển tiền nội bộ
 * Phụ trách: TV3 (Nguyễn Vũ Tấn Huy) - Nhóm chức năng WALLET (UC06 - UC09)
 */

/**
 * Lấy danh sách các ví của người dùng hiện tại (UC06)
 * @param {boolean} includeArchived Có lấy cả ví đã ẩn/lưu trữ hay không
 * @returns {Promise<{ data: any[], error: any }>}
 */
export async function getWallets(includeArchived = false) {
  try {
    let query = supabase
      .from('wallets')
      .select('*')
      .order('created_at', { ascending: true })

    if (!includeArchived) {
      query = query.eq('is_archived', false)
    }

    const { data, error } = await query
    return { data: data || [], error }
  } catch (err) {
    return { data: [], error: err }
  }
}

/**
 * Tạo một ví mới (UC06)
 * @param {{ name: string, type: 'cash' | 'bank' | 'ewallet', balance?: number, icon?: string, color?: string }} walletData 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function createWallet(walletData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const { data, error } = await supabase
      .from('wallets')
      .insert({
        user_id: user.id,
        name: walletData.name,
        type: walletData.type,
        balance: walletData.balance || 0,
        icon: walletData.icon || 'wallet',
        color: walletData.color || '#3B82F6',
        is_archived: false
      })
      .select()
      .single()

    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Cập nhật thông tin ví (UC07)
 * @param {string} walletId 
 * @param {{ name?: string, type?: 'cash' | 'bank' | 'ewallet', balance?: number, icon?: string, color?: string, is_archived?: boolean }} updates 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function updateWallet(walletId, updates) {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .update(updates)
      .eq('id', walletId)
      .select()
      .single()

    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Ẩn / Lưu trữ ví thay vì xóa cứng (UC08)
 * @param {string} walletId 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function archiveWallet(walletId) {
  return updateWallet(walletId, { is_archived: true })
}

/**
 * Xóa vĩnh viễn ví (chỉ khi ví không có ràng buộc giao dịch) (UC08)
 * @param {string} walletId 
 * @returns {Promise<{ error: any }>}
 */
export async function deleteWallet(walletId) {
  try {
    const { error } = await supabase
      .from('wallets')
      .delete()
      .eq('id', walletId)

    return { error }
  } catch (err) {
    return { error: err }
  }
}

/**
 * Chuyển tiền nội bộ giữa 2 ví (UC09)
 * Trừ tiền ví nguồn, cộng tiền ví đích và ghi 1 bản ghi giao dịch 'transfer'
 * @param {{ fromWalletId: string, toWalletId: string, amount: number, note?: string, date?: string }} transferData 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function transferFunds({ fromWalletId, toWalletId, amount, note = '', date = null }) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    if (fromWalletId === toWalletId) {
      throw new Error('Ví nguồn và ví đích không được trùng nhau')
    }
    if (amount <= 0) {
      throw new Error('Số tiền chuyển phải lớn hơn 0')
    }

    // 1. Lấy thông tin 2 ví để kiểm tra số dư
    const { data: fromWallet, error: fromErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', fromWalletId)
      .single()
    if (fromErr) throw fromErr

    const { data: toWallet, error: toErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', toWalletId)
      .single()
    if (toErr) throw toErr

    if (Number(fromWallet.balance) < Number(amount)) {
      throw new Error('Số dư ví nguồn không đủ để thực hiện chuyển tiền')
    }

    // 2. Cập nhật số dư ví nguồn
    const newFromBalance = Number(fromWallet.balance) - Number(amount)
    const { error: updateFromErr } = await supabase
      .from('wallets')
      .update({ balance: newFromBalance })
      .eq('id', fromWalletId)
    if (updateFromErr) throw updateFromErr

    // 3. Cập nhật số dư ví đích
    const newToBalance = Number(toWallet.balance) + Number(amount)
    const { error: updateToErr } = await supabase
      .from('wallets')
      .update({ balance: newToBalance })
      .eq('id', toWalletId)
    if (updateToErr) throw updateToErr

    // 4. Tạo bản ghi giao dịch chuyển khoản nội bộ
    const txnDate = date || new Date().toISOString().split('T')[0]
    const transferNote = note || `Chuyển từ ${fromWallet.name} sang ${toWallet.name}`

    const { data: transaction, error: txnErr } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        wallet_id: fromWalletId,
        to_wallet_id: toWalletId,
        category_id: null,
        type: 'transfer',
        amount: Number(amount),
        transaction_date: txnDate,
        note: transferNote
      })
      .select()
      .single()

    if (txnErr) throw txnErr

    return {
      data: {
        transaction,
        fromWalletBalance: newFromBalance,
        toWalletBalance: newToBalance
      },
      error: null
    }
  } catch (err) {
    return { data: null, error: err }
  }
}
