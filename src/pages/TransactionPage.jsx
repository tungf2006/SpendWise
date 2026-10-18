import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { formatCurrency } from '@/utils/formatCurrency'
import { 
  getTransactions, 
  createTransaction, 
  deleteTransaction, 
  exportTransactionsCSV 
} from '@/services/transactionService'
import { getWallets } from '@/services/walletService'
import { getCategories } from '@/services/categoryService'
import { 
  Plus, 
  Search, 
  Download, 
  Filter, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard,
  X,
  Loader2,
  Calendar,
  Wallet
} from 'lucide-react'

/**
 * Trang Quản lý Giao dịch (TransactionPage)
 * Phụ trách: TV3 (Nguyễn Vũ Tấn Huy) - Nhóm chức năng TXN (UC12 - UC13)
 */
export const TransactionPage = () => {
  const [transactions, setTransactions] = useState([])
  const [wallets, setWallets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters state
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedWallet, setSelectedWallet] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Add Transaction Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formWalletId, setFormWalletId] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formType, setFormType] = useState('expense')
  const [formAmount, setFormAmount] = useState('')
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0])
  const [formNote, setFormNote] = useState('')

  const fetchTransactionsList = async () => {
    try {
      setLoading(true)
      const { data } = await getTransactions({
        limit: 100,
        walletId: selectedWallet || null,
        categoryId: selectedCategory || null,
        type: selectedType || null,
        startDate: startDate || null,
        endDate: endDate || null,
        searchKeyword
      })
      setTransactions(data || [])
    } catch (err) {
      console.error('Lỗi khi tải giao dịch:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function loadMeta() {
      const [wRes, cRes] = await Promise.all([getWallets(), getCategories()])
      setWallets(wRes.data || [])
      setCategories(cRes.data || [])
      if (wRes.data && wRes.data.length > 0) {
        setFormWalletId(wRes.data[0].id)
      }
    }
    loadMeta()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactionsList()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchKeyword, selectedWallet, selectedCategory, selectedType, startDate, endDate])

  const handleCreateTransaction = async (e) => {
    e.preventDefault()
    if (!formAmount || Number(formAmount) <= 0 || !formWalletId) {
      alert('Vui lòng nhập số tiền hợp lệ và chọn ví thanh toán')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await createTransaction({
        wallet_id: formWalletId,
        category_id: formCategoryId || null,
        type: formType,
        amount: Number(formAmount),
        transaction_date: formDate,
        note: formNote
      })

      if (error) throw error

      setShowAddModal(false)
      setFormAmount('')
      setFormNote('')
      await fetchTransactionsList()
    } catch (err) {
      alert('Lỗi khi thêm giao dịch: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa giao dịch này? Số dư ví sẽ được tự động hoàn lại.')) return

    try {
      const { error } = await deleteTransaction(id)
      if (error) throw error
      await fetchTransactionsList()
    } catch (err) {
      alert('Lỗi khi xóa: ' + err.message)
    }
  }

  const handleExportCSV = () => {
    exportTransactionsCSV(transactions, `SpendWise_GiaoDich_${new Date().toISOString().split('T')[0]}.csv`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quản lý chi tiêu"
        title="Lịch sử Giao dịch"
        description="Xem, tìm kiếm không dấu, lọc theo ví và danh mục, hoặc xuất báo cáo ra file Excel CSV."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={transactions.length === 0}
              className="px-3.5 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-200/80 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-soft-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm giao dịch</span>
            </button>
          </div>
        }
      />

      {/* Filter & Search Bar */}
      <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-sm ring-1 ring-slate-900/5">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-4 border border-slate-100 flex flex-col md:flex-row gap-3">
          
          {/* Search box with unaccent */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm kiếm không dấu (VD: pho bo, xang, grab, cafe...)"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Type filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-700 focus:outline-none"
          >
            <option value="">Tất cả loại</option>
            <option value="expense">Chi tiêu</option>
            <option value="income">Thu nhập</option>
            <option value="transfer">Chuyển tiền</option>
          </select>

          {/* Wallet filter */}
          <select
            value={selectedWallet}
            onChange={(e) => setSelectedWallet(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-700 focus:outline-none"
          >
            <option value="">Tất cả ví</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-700 focus:outline-none"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

        </div>
      </div>

      {/* Transactions Table / List */}
      <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 border border-slate-100 overflow-hidden">
          
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600 mb-2" />
              <span>Đang tải danh sách giao dịch...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Không tìm thấy giao dịch nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map((txn) => {
                const isIncome = txn.type === 'income'
                const isTransfer = txn.type === 'transfer'

                return (
                  <div key={txn.id} className="py-3.5 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${
                          isIncome ? 'bg-emerald-500' : isTransfer ? 'bg-indigo-500' : 'bg-slate-900'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="w-4 h-4 text-white" />
                        ) : isTransfer ? (
                          <CreditCard className="w-4 h-4 text-white" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-rose-300" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900">
                          {txn.note || txn.category?.name || 'Giao dịch không tên'}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span>{txn.transaction_date}</span>
                          <span>•</span>
                          <span className="font-medium text-slate-600">{txn.wallet?.name}</span>
                          {txn.category?.name && (
                            <>
                              <span>•</span>
                              <span 
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                                style={{ backgroundColor: txn.category.color || '#64748B' }}
                              >
                                {txn.category.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`font-display font-bold text-xs sm:text-sm ${
                          isIncome ? 'text-emerald-600' : isTransfer ? 'text-indigo-600' : 'text-slate-900'
                        }`}
                      >
                        {isIncome ? '+' : isTransfer ? '' : '-'}
                        {formatCurrency(txn.amount)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDelete(txn.id)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
                        title="Xóa giao dịch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Thêm Giao dịch Mới</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-full">
                <button
                  type="button"
                  onClick={() => setFormType('expense')}
                  className={`py-1.5 rounded-full text-xs font-semibold transition-all ${
                    formType === 'expense' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Khoản Chi (-)
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('income')}
                  className={`py-1.5 rounded-full text-xs font-semibold transition-all ${
                    formType === 'income' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Khoản Thu (+)
                </button>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Số tiền (VNĐ)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="VD: 50000"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm font-display font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {/* Wallet & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ví thanh toán
                  </label>
                  <select
                    required
                    value={formWalletId}
                    onChange={(e) => setFormWalletId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Danh mục
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories
                      .filter(c => c.type === formType)
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Date & Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ngày giao dịch
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ghi chú
                  </label>
                  <input
                    type="text"
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="VD: Mua sách, cafe..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-soft-sm flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lưu giao dịch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
export default TransactionPage
