import { supabase } from '@/lib/supabaseClient'
import { getLocalDateString } from '@/utils/date'

const VALID_WALLET_TYPES = ['cash', 'bank', 'ewallet']

/**
 * Service quản lý Ví và Chuyển tiền nội bộ
 * Phụ trách: Nhóm phát triển SpendWise (Leader Tùng & TV3 Quốc) - Nhóm chức năng WALLET (UC06 - UC09)
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

    const trimmedName = (walletData?.name || '').trim()
    if (!trimmedName) {
      throw new Error('Tên ví không được để trống')
    }

    const walletType = VALID_WALLET_TYPES.includes(walletData?.type) ? walletData.type : 'cash'
    const parsedBalance = walletData?.balance === '' || walletData?.balance === undefined || walletData?.balance === null
      ? 0
      : Number(walletData.balance)
    if (!Number.isFinite(parsedBalance)) {
      throw new Error('Số dư ban đầu không hợp lệ')
    }

    const { data, error } = await supabase
      .from('wallets')
      .insert({
        user_id: user.id,
        name: trimmedName,
        type: walletType,
        balance: parsedBalance,
        icon: walletData?.icon || 'wallet',
        color: walletData?.color || '#3B82F6',
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
 * Whitelist các trường được phép cập nhật để tránh ghi đè ngoài ý muốn (user_id, id,...)
 * @param {string} walletId 
 * @param {{ name?: string, type?: 'cash' | 'bank' | 'ewallet', balance?: number, icon?: string, color?: string, is_archived?: boolean }} updates 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function updateWallet(walletId, updates) {
  try {
    if (!walletId) {
      throw new Error('Thiếu ID ví cần cập nhật')
    }

    const safeUpdates = updates && typeof updates === 'object' ? updates : {}
    const formattedUpdates = {}

    if ('name' in safeUpdates) {
      const trimmedName = (safeUpdates.name || '').trim()
      if (!trimmedName) {
        throw new Error('Tên ví không được để trống')
      }
      formattedUpdates.name = trimmedName
    }

    if ('type' in safeUpdates && safeUpdates.type !== undefined) {
      if (!VALID_WALLET_TYPES.includes(safeUpdates.type)) {
        throw new Error('Loại ví không hợp lệ')
      }
      formattedUpdates.type = safeUpdates.type
    }

    if ('balance' in safeUpdates && safeUpdates.balance !== undefined && safeUpdates.balance !== null && safeUpdates.balance !== '') {
      const parsedBalance = Number(safeUpdates.balance)
      if (!Number.isFinite(parsedBalance)) {
        throw new Error('Số dư ví không hợp lệ')
      }
      formattedUpdates.balance = parsedBalance
    }

    if ('icon' in safeUpdates && safeUpdates.icon !== undefined) {
      formattedUpdates.icon = safeUpdates.icon || 'wallet'
    }

    if ('color' in safeUpdates && safeUpdates.color !== undefined) {
      formattedUpdates.color = safeUpdates.color || '#3B82F6'
    }

    if ('is_archived' in safeUpdates && safeUpdates.is_archived !== undefined) {
      formattedUpdates.is_archived = Boolean(safeUpdates.is_archived)
    }

    const { data, error } = await supabase
      .from('wallets')
      .update(formattedUpdates)
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
 * Sử dụng RPC atomic transfer_funds trên PostgreSQL để chống race condition TOCTOU
 * @param {{ fromWalletId: string, toWalletId: string, amount: number, note?: string, date?: string }} transferData 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function transferFunds({ fromWalletId, toWalletId, amount, note = '', date = null }) {
  try {
    const numAmount = Number(amount)
    if (!fromWalletId || !toWalletId) {
      throw new Error('Thiếu ví nguồn hoặc ví đích')
    }
    if (fromWalletId === toWalletId) {
      throw new Error('Ví nguồn và ví đích không được trùng nhau')
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      throw new Error('Số tiền chuyển phải lớn hơn 0')
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    // 1. Thử gọi RPC atomic transfer_funds
    const { data: rpcData, error: rpcError } = await supabase.rpc('transfer_funds', {
      p_from_wallet_id: fromWalletId,
      p_to_wallet_id: toWalletId,
      p_amount: numAmount,
      p_note: note || '',
      p_date: date || null
    })

    if (!rpcError && rpcData) {
      return {
        data: {
          transactionId: rpcData.transactionId || rpcData.transaction_id,
          fromWalletBalance: rpcData.fromWalletBalance !== undefined ? rpcData.fromWalletBalance : rpcData.from_wallet_balance,
          toWalletBalance: rpcData.toWalletBalance !== undefined ? rpcData.toWalletBalance : rpcData.to_wallet_balance,
          amount: rpcData.amount || numAmount,
          transactionDate: rpcData.transactionDate || rpcData.transaction_date,
          note: rpcData.note || note
        },
        error: null
      }
    }

    // Nếu RPC không tồn tại (PGRST202 hoặc 42883), thực hiện fallback an toàn ở Client
    const isRpcMissing = rpcError && (rpcError.code === 'PGRST202' || rpcError.code === '42883')
    if (!isRpcMissing && rpcError) {
      throw rpcError
    }

    // --- CLIENT FALLBACK LOGIC ---
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

    if (Number(fromWallet.balance) < numAmount) {
      throw new Error('Số dư ví nguồn không đủ để thực hiện chuyển tiền')
    }

    const prevFromBalance = Number(fromWallet.balance)
    const prevToBalance = Number(toWallet.balance)
    const newFromBalance = prevFromBalance - numAmount
    const { error: updateFromErr } = await supabase
      .from('wallets')
      .update({ balance: newFromBalance })
      .eq('id', fromWalletId)
    if (updateFromErr) throw updateFromErr

    const newToBalance = prevToBalance + numAmount
    const { error: updateToErr } = await supabase
      .from('wallets')
      .update({ balance: newToBalance })
      .eq('id', toWalletId)
    if (updateToErr) {
      try {
        await supabase.from('wallets').update({ balance: prevFromBalance }).eq('id', fromWalletId)
      } catch {
        // Giữ nguyên lỗi gốc
      }
      throw updateToErr
    }

    const txnDate = date || getLocalDateString()
    const transferNote = note || `Chuyển từ ${fromWallet.name} sang ${toWallet.name}`

    const { data: transaction, error: txnErr } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        wallet_id: fromWalletId,
        to_wallet_id: toWalletId,
        category_id: null,
        type: 'transfer',
        amount: numAmount,
        transaction_date: txnDate,
        note: transferNote
      })
      .select()
      .single()

    if (txnErr) {
      try {
        await supabase.from('wallets').update({ balance: prevToBalance }).eq('id', toWalletId)
        await supabase.from('wallets').update({ balance: prevFromBalance }).eq('id', fromWalletId)
      } catch {
        // Giữ nguyên lỗi gốc
      }
      throw txnErr
    }

    return {
      data: {
        transactionId: transaction?.id,
        fromWalletBalance: newFromBalance,
        toWalletBalance: newToBalance,
        amount: numAmount,
        transactionDate: txnDate,
        note: transferNote
      },
      error: null
    }
  } catch (err) {
    return { data: null, error: err }
  }
}
