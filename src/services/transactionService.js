import { supabase } from '@/lib/supabaseClient'
import { removeVietnameseTones } from '@/utils/unaccent'
import { downloadTransactionsCsv } from '@/utils/transactionCsv'
import { getLocalDateString } from '@/utils/date'

const VALID_TRANSACTION_TYPES = ['income', 'expense', 'transfer']

/**
 * Áp dụng thay đổi số dư cho các ví liên quan kèm cơ chế hoàn tác (compensating rollback)
 * nếu bất kỳ bước cập nhật nào thất bại giữa chừng.
 * @param {Map<string, number>} deltas Map<walletId, deltaAmount>
 * @returns {Promise<Array<{ id: string, previousBalance: number }>>} Danh sách snapshot đã áp dụng để rollback nếu bước sau lỗi
 */
async function applyWalletDeltas(deltas) {
  const applied = []

  try {
    for (const [walletId, delta] of deltas.entries()) {
      if (!walletId || delta === 0) continue

      const { data: wallet, error: fetchErr } = await supabase
        .from('wallets')
        .select('balance')
        .eq('id', walletId)
        .single()
      if (fetchErr) throw fetchErr
      if (!wallet) throw new Error('Không tìm thấy ví liên quan để cập nhật số dư')

      const previousBalance = Number(wallet.balance)
      const nextBalance = previousBalance + delta

      const { error: updateErr } = await supabase
        .from('wallets')
        .update({ balance: nextBalance })
        .eq('id', walletId)
      if (updateErr) throw updateErr

      applied.push({ id: walletId, previousBalance })
    }

    return applied
  } catch (err) {
    await rollbackWalletBalances(applied)
    throw err
  }
}

/**
 * Hoàn tác số dư các ví đã cập nhật trước đó (best-effort rollback)
 * @param {Array<{ id: string, previousBalance: number }>} applied
 */
async function rollbackWalletBalances(applied) {
  for (let i = applied.length - 1; i >= 0; i -= 1) {
    const item = applied[i]
    try {
      await supabase
        .from('wallets')
        .update({ balance: item.previousBalance })
        .eq('id', item.id)
    } catch {
      // Bỏ qua lỗi phụ khi rollback để giữ nguyên lỗi gốc
    }
  }
}

/**
 * Service quản lý Giao dịch thu/chi, tìm kiếm không dấu và xuất CSV
 * Phụ trách: Nhóm phát triển SpendWise (Leader Tùng & TV3 Quốc) - Nhóm chức năng TXN (UC12 - UC13)
 */

/**
 * Lấy danh sách giao dịch có lọc, tìm kiếm và phân trang (UC13)
 * @param {object} options 
 * @param {number} [options.page=1] Trang hiện tại (1-indexed)
 * @param {number} [options.limit=20] Số bản ghi mỗi trang
 * @param {string} [options.startDate] Ngày bắt đầu (YYYY-MM-DD)
 * @param {string} [options.endDate] Ngày kết thúc (YYYY-MM-DD)
 * @param {string} [options.walletId] Lọc theo ví
 * @param {string} [options.categoryId] Lọc theo danh mục
 * @param {'income' | 'expense' | 'transfer'} [options.type] Lọc theo loại
 * @param {string} [options.searchKeyword] Từ khóa tìm kiếm không dấu
 * @returns {Promise<{ data: any[], count: number, error: any }>}
 */
export async function getTransactions({
  page = 1,
  limit = 20,
  startDate = null,
  endDate = null,
  walletId = null,
  categoryId = null,
  type = null,
  searchKeyword = ''
} = {}) {
  try {
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('transactions')
      .select(`
        *,
        wallet:wallets!transactions_wallet_id_fkey(id, name, color, icon),
        to_wallet:wallets!transactions_to_wallet_id_fkey(id, name, color, icon),
        category:categories(id, name, color, icon)
      `, { count: 'exact' })
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (startDate) {
      query = query.gte('transaction_date', startDate)
    }
    if (endDate) {
      query = query.lte('transaction_date', endDate)
    }
    if (walletId) {
      // Lọc cả giao dịch mà ví là ví nguồn (wallet_id) lẫn ví nhận chuyển khoản (to_wallet_id)
      query = query.or(`wallet_id.eq.${walletId},to_wallet_id.eq.${walletId}`)
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }
    if (type) {
      query = query.eq('type', type)
    }
    if (searchKeyword && searchKeyword.trim()) {
      const normalizedKeyword = removeVietnameseTones(searchKeyword)
      query = query.ilike('note_unaccent', `%${normalizedKeyword}%`)
    }

    const { data, count, error } = await query
    return { data: data || [], count: count || 0, error }
  } catch (err) {
    return { data: [], count: 0, error: err }
  }
}

/**
 * Thêm mới một giao dịch thu/chi hoặc chuyển tiền (UC12)
 * Tự động cập nhật số dư của ví tương ứng (kể cả ví nhận nếu là transfer)
 * @param {{ wallet_id: string, to_wallet_id?: string, category_id?: string, type: 'income' | 'expense' | 'transfer', amount: number, transaction_date?: string, note?: string }} txnData 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function createTransaction(txnData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const amount = Number(txnData.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Số tiền giao dịch phải lớn hơn 0')
    }

    if (!VALID_TRANSACTION_TYPES.includes(txnData.type)) {
      throw new Error('Loại giao dịch không hợp lệ')
    }

    if (!txnData.wallet_id) {
      throw new Error('Thiếu ví thanh toán')
    }

    if (txnData.type === 'transfer') {
      if (!txnData.to_wallet_id) {
        throw new Error('Thiếu ví đích cho giao dịch chuyển tiền')
      }
      if (txnData.wallet_id === txnData.to_wallet_id) {
        throw new Error('Ví nguồn và ví đích không được trùng nhau')
      }
    }

    const txnDate = txnData.transaction_date || getLocalDateString()
    const note = txnData.note || ''
    const noteUnaccent = removeVietnameseTones(note)
    const toWalletId = txnData.type === 'transfer' ? txnData.to_wallet_id : null
    const categoryId = txnData.type === 'transfer' ? null : (txnData.category_id || null)

    // 1. Tính trước deltas cho các ví liên quan
    const deltas = new Map()
    if (txnData.type === 'income') {
      deltas.set(txnData.wallet_id, amount)
    } else if (txnData.type === 'expense') {
      deltas.set(txnData.wallet_id, -amount)
    } else if (txnData.type === 'transfer') {
      deltas.set(txnData.wallet_id, -amount)
      deltas.set(txnData.to_wallet_id, amount)
    }

    // 2. Thêm bản ghi giao dịch
    const { data: transaction, error: insertErr } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        wallet_id: txnData.wallet_id,
        to_wallet_id: toWalletId,
        category_id: categoryId,
        type: txnData.type,
        amount,
        transaction_date: txnDate,
        note,
        note_unaccent: noteUnaccent
      })
      .select(`
        *,
        wallet:wallets!transactions_wallet_id_fkey(id, name, color, icon),
        to_wallet:wallets!transactions_to_wallet_id_fkey(id, name, color, icon),
        category:categories(id, name, color, icon)
      `)
      .single()

    if (insertErr) throw insertErr

    // 3. Cập nhật số dư ví (nếu lỗi, tự động hoàn tác ví và xóa bản ghi vừa chèn)
    try {
      await applyWalletDeltas(deltas)
    } catch (walletErr) {
      if (transaction?.id) {
        try {
          await supabase.from('transactions').delete().eq('id', transaction.id)
        } catch {
          // Bỏ qua lỗi phụ khi rollback
        }
      }
      throw walletErr
    }

    return { data: transaction, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Cập nhật một giao dịch hiện có (UC13)
 * Tính toán hiệu số số dư (Net Delta) và cập nhật số dư các ví liên quan chính xác
 * @param {string} id 
 * @param {object} updates 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function updateTransaction(id, updates) {
  try {
    if (!id) throw new Error('Thiếu ID giao dịch cần cập nhật')

    // 1. Lấy thông tin giao dịch cũ
    const { data: oldTxn, error: fetchErr } = await supabase
      .from('transactions')
      .select('id, wallet_id, to_wallet_id, type, amount')
      .eq('id', id)
      .single()

    if (fetchErr) throw fetchErr
    if (!oldTxn) throw new Error('Không tìm thấy giao dịch cần cập nhật')

    // 2. Xác định các giá trị mới
    const newType = updates.type !== undefined ? updates.type : oldTxn.type
    const newAmount = updates.amount !== undefined ? Number(updates.amount) : Number(oldTxn.amount)
    const newWalletId = updates.wallet_id !== undefined ? updates.wallet_id : oldTxn.wallet_id
    const newToWalletId = updates.to_wallet_id !== undefined ? updates.to_wallet_id : oldTxn.to_wallet_id

    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      throw new Error('Số tiền giao dịch phải lớn hơn 0')
    }

    if (!VALID_TRANSACTION_TYPES.includes(newType)) {
      throw new Error('Loại giao dịch không hợp lệ')
    }

    if (newType === 'transfer') {
      if (!newToWalletId) {
        throw new Error('Thiếu ví đích cho giao dịch chuyển tiền')
      }
      if (newWalletId === newToWalletId) {
        throw new Error('Ví nguồn và ví đích không được trùng nhau')
      }
    }

    // 3. Tính toán Net Balance Deltas cho các ví
    const deltas = new Map()
    const addDelta = (wId, change) => {
      if (!wId || change === 0) return
      deltas.set(wId, (deltas.get(wId) || 0) + change)
    }

    // Hoàn tác tác động của giao dịch cũ
    const oldAmount = Number(oldTxn.amount)
    if (oldTxn.type === 'income') {
      addDelta(oldTxn.wallet_id, -oldAmount)
    } else if (oldTxn.type === 'expense') {
      addDelta(oldTxn.wallet_id, +oldAmount)
    } else if (oldTxn.type === 'transfer') {
      addDelta(oldTxn.wallet_id, +oldAmount)
      addDelta(oldTxn.to_wallet_id, -oldAmount)
    }

    // Áp dụng tác động của giao dịch mới
    if (newType === 'income') {
      addDelta(newWalletId, +newAmount)
    } else if (newType === 'expense') {
      addDelta(newWalletId, -newAmount)
    } else if (newType === 'transfer') {
      addDelta(newWalletId, -newAmount)
      addDelta(newToWalletId, +newAmount)
    }

    // 4. Chuẩn hóa payload whitelist cho bảng transactions
    const formattedUpdates = {}
    if (updates.wallet_id !== undefined) formattedUpdates.wallet_id = newWalletId
    if (updates.type !== undefined) formattedUpdates.type = newType
    if (updates.amount !== undefined) formattedUpdates.amount = newAmount
    if (updates.transaction_date !== undefined) formattedUpdates.transaction_date = updates.transaction_date
    if (updates.category_id !== undefined) formattedUpdates.category_id = updates.category_id || null
    if (updates.note !== undefined) {
      formattedUpdates.note = updates.note || ''
      formattedUpdates.note_unaccent = removeVietnameseTones(updates.note || '')
    }
    if (newType !== 'transfer') {
      formattedUpdates.to_wallet_id = null
    } else if (updates.to_wallet_id !== undefined) {
      formattedUpdates.to_wallet_id = newToWalletId
    }
    if (newType === 'transfer') {
      formattedUpdates.category_id = null
    }

    // 5. Áp dụng deltas vào các ví liên quan (có tự động rollback nếu lỗi giữa chừng)
    const appliedWallets = await applyWalletDeltas(deltas)

    // 6. Cập nhật bản ghi giao dịch (nếu lỗi, hoàn tác lại số dư các ví vừa sửa)
    const { data: updatedTxn, error: updateErr } = await supabase
      .from('transactions')
      .update(formattedUpdates)
      .eq('id', id)
      .select(`
        *,
        wallet:wallets!transactions_wallet_id_fkey(id, name, color, icon),
        to_wallet:wallets!transactions_to_wallet_id_fkey(id, name, color, icon),
        category:categories(id, name, color, icon)
      `)
      .single()

    if (updateErr) {
      await rollbackWalletBalances(appliedWallets)
      throw updateErr
    }

    return { data: updatedTxn, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Xóa một giao dịch (UC13)
 * Tự động hoàn tác số dư ví tương ứng (bao gồm cả ví nhận nếu là transfer)
 * @param {string} id 
 * @returns {Promise<{ error: any }>}
 */
export async function deleteTransaction(id) {
  try {
    if (!id) throw new Error('Thiếu ID giao dịch cần xóa')

    // 1. Lấy thông tin giao dịch trước khi xóa để hoàn số dư ví
    const { data: txn, error: fetchErr } = await supabase
      .from('transactions')
      .select('wallet_id, to_wallet_id, type, amount')
      .eq('id', id)
      .single()

    if (fetchErr) throw fetchErr
    if (!txn) throw new Error('Không tìm thấy giao dịch cần xóa')

    const amount = Number(txn.amount)
    const deltas = new Map()

    if (txn.type === 'income') {
      deltas.set(txn.wallet_id, -amount)
    } else if (txn.type === 'expense') {
      deltas.set(txn.wallet_id, +amount)
    } else if (txn.type === 'transfer') {
      deltas.set(txn.wallet_id, +amount)
      if (txn.to_wallet_id) {
        deltas.set(txn.to_wallet_id, -amount)
      }
    }

    // 2. Hoàn lại số dư ví (có rollback nếu ví thứ 2 lỗi)
    const appliedWallets = await applyWalletDeltas(deltas)

    // 3. Xóa giao dịch khỏi bảng transactions (nếu lỗi, khôi phục lại số dư ví)
    const { error: deleteErr } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (deleteErr) {
      await rollbackWalletBalances(appliedWallets)
      throw deleteErr
    }

    return { error: null }
  } catch (err) {
    return { error: err }
  }
}

/**
 * Xuất danh sách giao dịch ra file CSV có hỗ trợ UTF-8 BOM tiếng Việt và chống Formula Injection (UC13, R4)
 * Ủy thác cho downloadTransactionsCsv trong @/utils/transactionCsv
 * @param {any[]} transactions Mảng các giao dịch đã query
 * @param {string} [filename] Tên file CSV tải về
 */
export function exportTransactionsCSV(transactions = [], filename) {
  return downloadTransactionsCsv(transactions, filename)
}
