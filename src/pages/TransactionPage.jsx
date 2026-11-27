import React, { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { Toast } from '@/components/common/Toast'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { formatCurrency } from '@/utils/formatCurrency'
import { getLocalDateString } from '@/utils/date'
import { getTransactions, createTransaction, updateTransaction, deleteTransaction } from '@/services/transactionService'
import { exportAllTransactionsCSV } from '@/services/transactionCsvExport'
import { getWallets } from '@/services/walletService'
import { getCategories } from '@/services/categoryService'
import { 
  Plus, 
  Search, 
  Download, 
  Trash2, 
  Pencil,
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard,
  X, 
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw
} from 'lucide-react'

const getTodayLocal = () => getLocalDateString()

/**
 * Trang Quản lý Giao dịch (TransactionPage)
 * Phụ trách: Nhóm phát triển SpendWise (Leader Tùng & TV3 Quốc) - Nhóm chức năng TXN (UC12 - UC13)
 */
export const TransactionPage = () => {
  const [isExporting, setIsExporting] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [wallets, setWallets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Filters state
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedWallet, setSelectedWallet] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Toast state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  // Delete dialog state
  const [deleteTargetId, setDeleteTargetId] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Add Transaction Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formWalletId, setFormWalletId] = useState('')
  const [formToWalletId, setFormToWalletId] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formType, setFormType] = useState('expense')
  const [formAmount, setFormAmount] = useState('')
  const [formDate, setFormDate] = useState(getTodayLocal)
  const [formNote, setFormNote] = useState('')

  // Edit Transaction Modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTxn, setEditingTxn] = useState(null)
  const [editWalletId, setEditWalletId] = useState('')
  const [editToWalletId, setEditToWalletId] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editType, setEditType] = useState('expense')
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')

  const isDateRangeInvalid = Boolean(startDate && endDate && startDate > endDate)

  const refreshWalletsMeta = useCallback(async () => {
    const wRes = await getWallets()
    if (!wRes.error && wRes.data) {
      setWallets(wRes.data)
    }
  }, [])

  const notifyFinanceUpdated = () => {
    window.dispatchEvent(new CustomEvent('spendwise:finance-updated'))
  }

  const fetchTransactionsList = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, count, error: fetchErr } = await getTransactions({
        page: currentPage,
        limit: pageSize,
        walletId: selectedWallet || null,
        categoryId: selectedCategory || null,
        type: selectedType || null,
        startDate: startDate || null,
        endDate: endDate || null,
        searchKeyword
      })
      if (fetchErr) throw fetchErr
      setTransactions(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Lỗi khi tải giao dịch:', err)
      const message = err?.message || 'Không thể tải danh sách giao dịch'
      setError(message)
      setToast({ show: true, message: 'Lỗi khi tải danh sách giao dịch: ' + message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [currentPage, selectedWallet, selectedCategory, selectedType, startDate, endDate, searchKeyword])

  useEffect(() => {
    let cancelled = false
    async function loadMeta() {
      try {
        const [wRes, cRes] = await Promise.all([getWallets(), getCategories()])
        if (cancelled) return
        if (wRes.error) {
          console.error('Lỗi tải ví:', wRes.error)
        }
        if (cRes.error) {
          console.error('Lỗi tải danh mục:', cRes.error)
        }
        const walletList = wRes.data || []
        setWallets(walletList)
        setCategories(cRes.data || [])
        if (walletList.length > 0) {
          setFormWalletId(walletList[0].id)
          if (walletList.length > 1) {
            setFormToWalletId(walletList[1].id)
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Lỗi tải dữ liệu bộ lọc:', err)
        }
      }
    }
    loadMeta()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!showAddModal && !showEditModal) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        setShowAddModal(false)
        setShowEditModal(false)
        setEditingTxn(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAddModal, showEditModal, isSubmitting])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactionsList()
    }, 250)
    return () => clearTimeout(timer)
  }, [fetchTransactionsList])

  // Reset page to 1 when any filter changes
  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value)
    setCurrentPage(1)
  }

  // Type change handlers with auto category reset
  const handleFormTypeChange = (newType) => {
    setFormType(newType)
    setFormCategoryId('')
  }

  const handleEditTypeChange = (newType) => {
    setEditType(newType)
    setEditCategoryId('')
  }

  const handleCreateTransaction = async (e) => {
    e.preventDefault()
    const numAmount = Number(formAmount)
    if (isNaN(numAmount) || numAmount <= 0 || !formWalletId) {
      setToast({ show: true, message: 'Vui lòng nhập số tiền hợp lệ và chọn ví thanh toán', type: 'warning' })
      return
    }

    if (formType === 'transfer') {
      if (!formToWalletId) {
        setToast({ show: true, message: 'Vui lòng chọn ví đích nhận tiền', type: 'warning' })
        return
      }
      if (formWalletId === formToWalletId) {
        setToast({ show: true, message: 'Ví nguồn và ví đích không được trùng nhau', type: 'warning' })
        return
      }
    }

    setIsSubmitting(true)
    try {
      const { error: createErr } = await createTransaction({
        wallet_id: formWalletId,
        to_wallet_id: formType === 'transfer' ? formToWalletId : null,
        category_id: formType === 'transfer' ? null : (formCategoryId || null),
        type: formType,
        amount: numAmount,
        transaction_date: formDate,
        note: formNote
      })

      if (createErr) throw createErr

      setShowAddModal(false)
      setFormAmount('')
      setFormNote('')
      setFormCategoryId('')
      await Promise.all([fetchTransactionsList(), refreshWalletsMeta()])
      notifyFinanceUpdated()
      setToast({ show: true, message: 'Thêm giao dịch thành công!', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'Lỗi khi thêm giao dịch: ' + err.message, type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEdit = (txn) => {
    setEditingTxn(txn)
    setEditType(txn.type || 'expense')
    setEditAmount(txn.amount !== undefined ? String(txn.amount) : '')
    setEditWalletId(txn.wallet_id || '')
    setEditToWalletId(txn.to_wallet_id || '')
    setEditCategoryId(txn.category_id || '')
    setEditDate(txn.transaction_date || getTodayLocal())
    setEditNote(txn.note || '')
    setShowEditModal(true)
  }

  const handleUpdateTransaction = async (e) => {
    e.preventDefault()
    if (!editingTxn) return

    const numAmount = Number(editAmount)
    if (isNaN(numAmount) || numAmount <= 0 || !editWalletId) {
      setToast({ show: true, message: 'Vui lòng nhập số tiền hợp lệ và chọn ví thanh toán', type: 'warning' })
      return
    }

    if (editType === 'transfer') {
      if (!editToWalletId) {
        setToast({ show: true, message: 'Vui lòng chọn ví đích nhận tiền', type: 'warning' })
        return
      }
      if (editWalletId === editToWalletId) {
        setToast({ show: true, message: 'Ví nguồn và ví đích không được trùng nhau', type: 'warning' })
        return
      }
    }

    setIsSubmitting(true)
    try {
      const { error: updateErr } = await updateTransaction(editingTxn.id, {
        wallet_id: editWalletId,
        to_wallet_id: editType === 'transfer' ? editToWalletId : null,
        category_id: editType === 'transfer' ? null : (editCategoryId || null),
        type: editType,
        amount: numAmount,
        transaction_date: editDate,
        note: editNote
      })

      if (updateErr) throw updateErr

      setShowEditModal(false)
      setEditingTxn(null)
      await Promise.all([fetchTransactionsList(), refreshWalletsMeta()])
      notifyFinanceUpdated()
      setToast({ show: true, message: 'Cập nhật giao dịch thành công!', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'Lỗi khi cập nhật giao dịch: ' + err.message, type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return
    setIsDeleting(true)
    try {
      const { error: delErr } = await deleteTransaction(deleteTargetId)
      if (delErr) throw delErr
      if (transactions.length === 1 && currentPage > 1) {
        setCurrentPage((p) => Math.max(1, p - 1))
        await refreshWalletsMeta()
      } else {
        await Promise.all([fetchTransactionsList(), refreshWalletsMeta()])
      }
      notifyFinanceUpdated()
      setToast({ show: true, message: 'Xóa giao dịch thành công! Số dư ví đã được hoàn tác.', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'Lỗi khi xóa: ' + err.message, type: 'error' })
    } finally {
      setIsDeleting(false)
      setDeleteTargetId(null)
    }
  }

  const handleExportCSV = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const exportedCount = await exportAllTransactionsCSV({
        walletId: selectedWallet || null,
        categoryId: selectedCategory || null,
        type: selectedType || null,
        startDate: startDate || null,
        endDate: endDate || null,
        searchKeyword: searchKeyword
      })
      if (exportedCount === 0) {
        setToast({ show: true, message: 'Không có giao dịch phù hợp để xuất CSV.', type: 'warning' })
      } else {
        setToast({ show: true, message: `Đã xuất thành công ${exportedCount} giao dịch ra file CSV!`, type: 'success' })
      }
    } catch (err) {
      console.error('Lỗi xuất CSV:', err)
      setToast({ show: true, message: 'Không thể xuất CSV: ' + (err?.message || 'Lỗi không xác định'), type: 'error' })
    } finally {
      setIsExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const fromRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const toRecord = Math.min(currentPage * pageSize, totalCount)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quản lý chi tiêu"
        title="Lịch sử Giao dịch"
        description="Xem, tìm kiếm không dấu, lọc theo ví và danh mục, phân trang hoặc xuất báo cáo ra file CSV an toàn."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isExporting || (transactions.length === 0)}
              className="px-3.5 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-200/80 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>{isExporting ? 'Đang xuất CSV...' : 'Export CSV'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-soft-sm transition-transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Thêm giao dịch</span>
            </button>
          </div>
        }
      />

      {/* Filter & Search Bar */}
      <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-sm ring-1 ring-slate-900/5">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-4 border border-slate-100 flex flex-col gap-3">
          
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search box with unaccent */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchKeyword}
                onChange={handleFilterChange(setSearchKeyword)}
                placeholder="Tìm kiếm không dấu (VD: pho bo, xang, grab, cafe...)"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            {/* Type filter */}
            <select
              value={selectedType}
              onChange={handleFilterChange(setSelectedType)}
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
              onChange={handleFilterChange(setSelectedWallet)}
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
              onChange={handleFilterChange(setSelectedCategory)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-700 focus:outline-none"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date range filters */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <span className="font-semibold flex items-center gap-1 text-slate-500 shrink-0">
              <Calendar className="w-3.5 h-3.5" /> Khoảng ngày:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Từ</span>
              <input
                type="date"
                value={startDate}
                onChange={handleFilterChange(setStartDate)}
                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-700 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Đến</span>
              <input
                type="date"
                value={endDate}
                onChange={handleFilterChange(setEndDate)}
                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-700 focus:outline-none"
              />
            </div>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                  setCurrentPage(1)
                }}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 ml-auto cursor-pointer"
              >
                Xóa lọc ngày
              </button>
            )}
          </div>
          {isDateRangeInvalid && (
            <p className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Ngày bắt đầu đang lớn hơn ngày kết thúc. Vui lòng điều chỉnh lại khoảng ngày lọc.</span>
            </p>
          )}

        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200/80 p-4 flex items-center justify-between gap-3 text-rose-800">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchTransactionsList}
            className="px-3 py-1 rounded-full bg-white text-xs font-semibold text-rose-700 border border-rose-200 hover:bg-rose-100 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

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
                  <div key={txn.id} className="py-3.5 flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 ${
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
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                          {txn.note || txn.category?.name || (isTransfer ? 'Chuyển tiền nội bộ' : 'Giao dịch không tên')}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="shrink-0">{txn.transaction_date}</span>
                          <span>•</span>
                          <span className="font-medium text-slate-600 truncate max-w-[140px]">
                            {isTransfer
                              ? `${txn.wallet?.name || 'Ví nguồn'} ➔ ${txn.to_wallet?.name || 'Ví đích'}`
                              : txn.wallet?.name || 'Ví'}
                          </span>
                          {txn.category?.name && (
                            <>
                              <span>•</span>
                              <span 
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shrink-0"
                                style={{ backgroundColor: txn.category.color || '#64748B' }}
                              >
                                {txn.category.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <span
                        className={`font-display font-bold text-xs sm:text-sm ${
                          isIncome ? 'text-emerald-600' : isTransfer ? 'text-indigo-600' : 'text-slate-900'
                        }`}
                      >
                        {isIncome ? '+' : isTransfer ? '' : '-'}
                        {formatCurrency(txn.amount)}
                      </span>

                      {/* Action buttons: visible on Mobile, revealed on hover on Desktop */}
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(txn)}
                          className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-brand-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="Sửa giao dịch"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(txn.id)}
                          className="w-7 h-7 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="Xóa giao dịch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination Navigation */}
          {totalCount > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div>
                Hiển thị <span className="font-semibold text-slate-800">{fromRecord} - {toRecord}</span> trên tổng số <span className="font-semibold text-slate-800">{totalCount}</span> giao dịch
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || loading}
                  className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold text-slate-700 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Trước</span>
                </button>
                <span className="px-2 font-medium">
                  Trang {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || loading}
                  className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold text-slate-700 cursor-pointer"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            if (!isSubmitting) setShowAddModal(false)
          }}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white/80 p-1.5 shadow-2xl ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-0.375rem)] bg-white p-6 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Thêm Giao dịch Mới</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-full">
                <button
                  type="button"
                  onClick={() => handleFormTypeChange('expense')}
                  className={`py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    formType === 'expense' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Khoản Chi (-)
                </button>
                <button
                  type="button"
                  onClick={() => handleFormTypeChange('income')}
                  className={`py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    formType === 'income' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Khoản Thu (+)
                </button>
                <button
                  type="button"
                  onClick={() => handleFormTypeChange('transfer')}
                  className={`py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    formType === 'transfer' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Chuyển tiền
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

              {/* Wallets & Category */}
              {formType === 'transfer' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Ví nguồn
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
                      Ví nhận
                    </label>
                    <select
                      required
                      value={formToWalletId}
                      onChange={(e) => setFormToWalletId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                    >
                      <option value="">-- Chọn ví nhận --</option>
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
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
                        .filter((c) => c.type === formType)
                        .map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

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
                  className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-soft-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lưu giao dịch</span>
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal (UC13) */}
      {showEditModal && editingTxn && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            if (!isSubmitting) {
              setShowEditModal(false)
              setEditingTxn(null)
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white/80 p-1.5 shadow-2xl ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-0.375rem)] bg-white p-6 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Sửa Giao Dịch</h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false)
                  setEditingTxn(null)
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTransaction} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-full">
                <button
                  type="button"
                  onClick={() => handleEditTypeChange('expense')}
                  className={`py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    editType === 'expense' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Khoản Chi (-)
                </button>
                <button
                  type="button"
                  onClick={() => handleEditTypeChange('income')}
                  className={`py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    editType === 'income' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Khoản Thu (+)
                </button>
                <button
                  type="button"
                  onClick={() => handleEditTypeChange('transfer')}
                  className={`py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    editType === 'transfer' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Chuyển tiền
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
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm font-display font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {/* Wallets & Category */}
              {editType === 'transfer' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Ví nguồn
                    </label>
                    <select
                      required
                      value={editWalletId}
                      onChange={(e) => setEditWalletId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Ví nhận
                    </label>
                    <select
                      required
                      value={editToWalletId}
                      onChange={(e) => setEditToWalletId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                    >
                      <option value="">-- Chọn ví nhận --</option>
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Ví thanh toán
                    </label>
                    <select
                      required
                      value={editWalletId}
                      onChange={(e) => setEditWalletId(e.target.value)}
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
                      value={editCategoryId}
                      onChange={(e) => setEditCategoryId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {categories
                        .filter((c) => c.type === editType)
                        .map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Date & Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ngày giao dịch
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ghi chú
                  </label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="VD: Mua sách, cafe..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingTxn(null)
                  }}
                  className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-soft-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTargetId)}
        title="Xóa giao dịch"
        message="Bạn có chắc chắn muốn xóa giao dịch này? Số dư các ví liên quan sẽ được tự động hoàn lại tương ứng."
        confirmText="Xóa giao dịch"
        cancelText="Giữ lại"
        confirmVariant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />

      {/* Toast Notification */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </div>
  )
}
export default TransactionPage
