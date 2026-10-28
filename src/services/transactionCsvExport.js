import { getTransactions } from './transactionService'
import { downloadTransactionsCsv } from '../utils/transactionCsv'

/**
 * Export ALL transactions matching the current TransactionPage filters.
 * The normal list uses limit: 100, so exporting its current state would omit
 * transactions beyond the first page. Load extra pages through the existing
 * Supabase/RLS-backed service without introducing a new backend endpoint.
 *
 * @param {{walletId?: string|null, categoryId?: string|null, type?: string|null,
 *          startDate?: string|null, endDate?: string|null, searchKeyword?: string}} filters
 * @returns {Promise<number>} Number of transactions exported
 */
export async function exportAllTransactionsCSV(filters = {}) {
  const pageSize = 500
  const transactions = []
  let page = 1
  let total = null

  for (;;) {
    const { data, count, error } = await getTransactions({
      ...filters,
      page,
      limit: pageSize
    })
    if (error) throw error
    if (!Array.isArray(data)) throw new Error('Phản hồi giao dịch không hợp lệ')

    if (total === null) total = count
    transactions.push(...data)

    // The counted total is used to determine if another page is needed.
    if (transactions.length >= total) break

    // A short/empty page before reaching the expected total means missing rows.
    // Fail instead of offering a misleading, incomplete "all transactions" CSV.
    if (data.length < pageSize) {
      throw new Error('Chưa tải đầy đủ giao dịch. Vui lòng thử xuất lại.')
    }
    page += 1
  }

  if (transactions.length > 0) downloadTransactionsCsv(transactions)
  return transactions.length
}
