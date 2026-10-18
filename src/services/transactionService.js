import { supabase } from '@/lib/supabaseClient'
import { removeVietnameseTones } from '@/utils/unaccent'

/**
 * Service quản lý Giao dịch thu/chi, tìm kiếm không dấu và xuất CSV
 * Phụ trách: TV3 (Nguyễn Vũ Tấn Huy) - Nhóm chức năng TXN (UC12 - UC13)
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
      query = query.eq('wallet_id', walletId)
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
 * Thêm mới một giao dịch thu/chi (UC12)
 * Tự động cập nhật số dư của ví tương ứng
 * @param {{ wallet_id: string, category_id?: string, type: 'income' | 'expense', amount: number, transaction_date?: string, note?: string }} txnData 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function createTransaction(txnData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const amount = Number(txnData.amount)
    if (amount <= 0) throw new Error('Số tiền giao dịch phải lớn hơn 0')

    const txnDate = txnData.transaction_date || new Date().toISOString().split('T')[0]
    const note = txnData.note || ''
    const noteUnaccent = removeVietnameseTones(note)

    // 1. Thêm bản ghi giao dịch
    const { data: transaction, error: insertErr } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        wallet_id: txnData.wallet_id,
        category_id: txnData.category_id || null,
        type: txnData.type,
        amount,
        transaction_date: txnDate,
        note,
        note_unaccent: noteUnaccent
      })
      .select(`
        *,
        wallet:wallets!transactions_wallet_id_fkey(id, name, color, icon),
        category:categories(id, name, color, icon)
      `)
      .single()

    if (insertErr) throw insertErr

    // 2. Cập nhật số dư ví
    const { data: wallet, error: walletFetchErr } = await supabase
      .from('wallets')
      .select('balance')
      .eq('id', txnData.wallet_id)
      .single()

    if (!walletFetchErr && wallet) {
      const currentBalance = Number(wallet.balance)
      const balanceChange = txnData.type === 'income' ? amount : -amount
      await supabase
        .from('wallets')
        .update({ balance: currentBalance + balanceChange })
        .eq('id', txnData.wallet_id)
    }

    return { data: transaction, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Cập nhật một giao dịch hiện có (UC13)
 * @param {string} id 
 * @param {object} updates 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function updateTransaction(id, updates) {
  try {
    const formattedUpdates = { ...updates }
    if (updates.note !== undefined) {
      formattedUpdates.note_unaccent = removeVietnameseTones(updates.note)
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(formattedUpdates)
      .eq('id', id)
      .select(`
        *,
        wallet:wallets!transactions_wallet_id_fkey(id, name, color, icon),
        category:categories(id, name, color, icon)
      `)
      .single()

    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Xóa một giao dịch (UC13)
 * Tự động hoàn tác số dư ví tương ứng
 * @param {string} id 
 * @returns {Promise<{ error: any }>}
 */
export async function deleteTransaction(id) {
  try {
    // 1. Lấy thông tin giao dịch trước khi xóa để hoàn số dư ví
    const { data: txn, error: fetchErr } = await supabase
      .from('transactions')
      .select('wallet_id, type, amount')
      .eq('id', id)
      .single()

    if (fetchErr) throw fetchErr

    // 2. Xóa giao dịch
    const { error: deleteErr } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (deleteErr) throw deleteErr

    // 3. Hoàn lại số dư ví nếu tìm thấy
    if (txn && txn.type !== 'transfer') {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('id', txn.wallet_id)
        .single()

      if (wallet) {
        const revertChange = txn.type === 'income' ? -Number(txn.amount) : Number(txn.amount)
        await supabase
          .from('wallets')
          .update({ balance: Number(wallet.balance) + revertChange })
          .eq('id', txn.wallet_id)
      }
    }

    return { error: null }
  } catch (err) {
    return { error: err }
  }
}

/**
 * Xuất danh sách giao dịch ra file CSV có hỗ trợ UTF-8 BOM tiếng Việt (UC13)
 * @param {any[]} transactions Mảng các giao dịch đã query
 * @param {string} filename Tên file CSV tải về
 */
export function exportTransactionsCSV(transactions = [], filename = 'spendwise_giao_dich.csv') {
  if (!transactions || transactions.length === 0) return

  const headers = ['Ngày giao dịch', 'Loại', 'Số tiền (VNĐ)', 'Danh mục', 'Ví thanh toán', 'Ghi chú']
  const rows = transactions.map(t => {
    const typeLabel = t.type === 'income' ? 'Thu nhập' : t.type === 'expense' ? 'Chi tiêu' : 'Chuyển tiền'
    const categoryName = t.category?.name || 'Chuyển nội bộ'
    const walletName = t.wallet?.name || ''
    const amountStr = t.amount ? Number(t.amount).toLocaleString('vi-VN') : '0'
    const cleanNote = (t.note || '').replace(/"/g, '""')

    return [
      t.transaction_date,
      typeLabel,
      `"${amountStr}"`,
      `"${categoryName}"`,
      `"${walletName}"`,
      `"${cleanNote}"`
    ].join(',')
  })

  // Thêm UTF-8 BOM (\uFEFF) để Excel hiển thị đúng tiếng Việt có dấu
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
