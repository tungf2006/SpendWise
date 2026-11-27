import React, { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { Toast } from '@/components/common/Toast'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { formatCurrency } from '@/utils/formatCurrency'
import { getWallets, createWallet, updateWallet, transferFunds, archiveWallet } from '@/services/walletService'
import { 
  Wallet, 
  Plus, 
  ArrowRightLeft, 
  Smartphone, 
  CreditCard, 
  Archive, 
  Pencil,
  X, 
  Loader2,
  TrendingUp,
  AlertCircle,
  RefreshCw
} from 'lucide-react'

/**
 * Trang Quản lý Ví & Chuyển tiền nội bộ (WalletPage)
 * Phụ trách: Nhóm phát triển SpendWise (Leader Tùng & TV3 Quốc) - Nhóm chức năng WALLET (UC06 - UC09)
 */
export const WalletPage = () => {
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Archive dialog state
  const [archiveTargetId, setArchiveTargetId] = useState(null)
  const [isArchiving, setIsArchiving] = useState(false)

  // Toast state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  // Add form
  const [name, setName] = useState('')
  const [type, setType] = useState('cash')
  const [balance, setBalance] = useState('')
  const [color, setColor] = useState('#10B981')

  // Edit form
  const [editingWallet, setEditingWallet] = useState(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('cash')
  const [editBalance, setEditBalance] = useState('')
  const [editColor, setEditColor] = useState('#10B981')

  // Transfer form
  const [fromWalletId, setFromWalletId] = useState('')
  const [toWalletId, setToWalletId] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferNote, setTransferNote] = useState('')

  const syncTransferDefaults = useCallback((list) => {
    if (list.length >= 2) {
      setFromWalletId((prev) => (list.some((w) => w.id === prev) ? prev : list[0].id))
      setToWalletId((prev) => (list.some((w) => w.id === prev) ? prev : list[1].id))
    } else if (list.length === 1) {
      setFromWalletId(list[0].id)
      setToWalletId('')
    } else {
      setFromWalletId('')
      setToWalletId('')
    }
  }, [])

  const fetchWalletsList = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: fetchErr } = await getWallets()
      if (fetchErr) throw fetchErr
      const list = data || []
      setWallets(list)
      syncTransferDefaults(list)
    } catch (err) {
      console.error('Lỗi khi tải danh sách ví:', err)
      const message = err?.message || 'Không thể tải danh sách ví'
      setError(message)
      setToast({ show: true, message: 'Lỗi khi tải danh sách ví: ' + message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [syncTransferDefaults])

  useEffect(() => {
    let cancelled = false
    async function loadInitial() {
      try {
        const { data, error: fetchErr } = await getWallets()
        if (cancelled) return
        if (fetchErr) throw fetchErr
        const list = data || []
        setWallets(list)
        syncTransferDefaults(list)
      } catch (err) {
        if (cancelled) return
        console.error('Lỗi khi tải danh sách ví:', err)
        const message = err?.message || 'Không thể tải danh sách ví'
        setError(message)
        setToast({ show: true, message: 'Lỗi khi tải danh sách ví: ' + message, type: 'error' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadInitial()
    return () => {
      cancelled = true
    }
  }, [syncTransferDefaults])

  useEffect(() => {
    if (!showAddModal && !showEditModal && !showTransferModal) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        setShowAddModal(false)
        setShowEditModal(false)
        setEditingWallet(null)
        setShowTransferModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAddModal, showEditModal, showTransferModal, isSubmitting])

  const notifyFinanceUpdated = () => {
    window.dispatchEvent(new CustomEvent('spendwise:finance-updated'))
  }

  const handleOpenTransferModal = () => {
    syncTransferDefaults(wallets)
    setShowTransferModal(true)
  }

  const handleCreateWallet = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setToast({ show: true, message: 'Tên ví không được để trống', type: 'warning' })
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await createWallet({
        name: name.trim(),
        type,
        balance: Number(balance) || 0,
        color
      })

      if (error) throw error

      setShowAddModal(false)
      setName('')
      setBalance('')
      await fetchWalletsList()
      notifyFinanceUpdated()
      setToast({ show: true, message: 'Tạo ví mới thành công!', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'Lỗi tạo ví: ' + err.message, type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEditModal = (wallet) => {
    setEditingWallet(wallet)
    setEditName(wallet.name || '')
    setEditType(wallet.type || 'cash')
    setEditBalance(wallet.balance !== undefined ? String(wallet.balance) : '0')
    setEditColor(wallet.color || '#3B82F6')
    setShowEditModal(true)
  }

  const handleUpdateWallet = async (e) => {
    e.preventDefault()
    if (!editName.trim()) {
      setToast({ show: true, message: 'Tên ví không được để trống', type: 'warning' })
      return
    }
    if (!editingWallet) return

    setIsSubmitting(true)
    try {
      const { error } = await updateWallet(editingWallet.id, {
        name: editName.trim(),
        type: editType,
        balance: Number(editBalance) || 0,
        color: editColor
      })

      if (error) throw error

      setShowEditModal(false)
      setEditingWallet(null)
      await fetchWalletsList()
      notifyFinanceUpdated()
      setToast({ show: true, message: 'Cập nhật ví thành công!', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'Lỗi cập nhật ví: ' + err.message, type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTransfer = async (e) => {
    e.preventDefault()
    if (!fromWalletId || !toWalletId || !transferAmount || Number(transferAmount) <= 0) {
      setToast({ show: true, message: 'Vui lòng chọn ví và nhập số tiền hợp lệ', type: 'warning' })
      return
    }

    if (fromWalletId === toWalletId) {
      setToast({ show: true, message: 'Ví nguồn và ví đích không được trùng nhau', type: 'warning' })
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await transferFunds({
        fromWalletId,
        toWalletId,
        amount: Number(transferAmount),
        note: transferNote
      })

      if (error) throw error

      setShowTransferModal(false)
      setTransferAmount('')
      setTransferNote('')
      await fetchWalletsList()
      notifyFinanceUpdated()
      setToast({ show: true, message: 'Chuyển tiền nội bộ thành công!', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'Lỗi chuyển tiền: ' + err.message, type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmArchive = async () => {
    if (!archiveTargetId) return
    setIsArchiving(true)
    try {
      const { error } = await archiveWallet(archiveTargetId)
      if (error) throw error
      await fetchWalletsList()
      notifyFinanceUpdated()
      setToast({ show: true, message: 'Đã ẩn ví thành công khỏi danh sách!', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'Lỗi khi ẩn ví: ' + err.message, type: 'error' })
    } finally {
      setIsArchiving(false)
      setArchiveTargetId(null)
    }
  }

  const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tài sản & Nguồn tiền"
        title="Quản lý Ví tiền"
        description="Quản lý các nguồn tiền mặt, tài khoản ngân hàng và ví điện tử; thực hiện chuyển tiền nội bộ giữa các ví."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenTransferModal}
              disabled={wallets.length < 2}
              className="px-3.5 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-200/80 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Chuyển tiền nội bộ</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-full bg-slate-900 dark:bg-brand-600 hover:bg-slate-800 dark:hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-soft-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm ví mới</span>
            </button>
          </div>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/60 p-4 flex items-center justify-between gap-3 text-rose-800 dark:text-rose-300">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchWalletsList}
            className="px-3 py-1 rounded-full bg-white dark:bg-rose-900/50 text-xs font-semibold text-rose-700 dark:text-rose-200 border border-rose-200 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/80 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Total Balance Card */}
      <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5 dark:ring-white/10">
        <div className="rounded-[calc(2rem-0.5rem)] bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold block mb-1">
              Tổng số dư tất cả các ví
            </span>
            <span className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
              {formatCurrency(totalBalance)}
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-emerald-300 text-xs font-semibold border border-white/10 self-start sm:self-auto">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{wallets.length} nguồn tiền hoạt động</span>
          </div>
        </div>
      </div>

      {/* Wallets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-xs text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto mb-2" />
            <span>Đang tải danh sách ví...</span>
          </div>
        ) : wallets.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
            Bạn chưa có ví nào. Hãy nhấn "Thêm ví mới" ở trên để bắt đầu!
          </div>
        ) : (
          wallets.map((w) => (
            <div
              key={w.id}
              className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5 dark:ring-white/10 hover:shadow-soft-xl transition-all"
            >
              <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 border border-slate-100 flex flex-col justify-between h-full">
                
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm"
                      style={{ backgroundColor: w.color || '#3B82F6' }}
                    >
                      {w.type === 'bank' ? (
                        <CreditCard className="w-5 h-5" />
                      ) : w.type === 'ewallet' ? (
                        <Smartphone className="w-5 h-5" />
                      ) : (
                        <Wallet className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-sm text-slate-900">{w.name}</h4>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {w.type === 'cash' ? 'Tiền mặt' : w.type === 'bank' ? 'Ngân hàng' : 'Ví điện tử'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(w)}
                      className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center justify-center transition-colors cursor-pointer"
                      title="Sửa ví"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setArchiveTargetId(w.id)}
                      className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                      title="Ẩn ví"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">Số dư hiện tại</span>
                  <span className="font-display font-black text-lg text-slate-900 tracking-tight">
                    {formatCurrency(w.balance)}
                  </span>
                </div>

              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Wallet Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            if (!isSubmitting) setShowAddModal(false)
          }}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white/80 dark:bg-slate-900/95 p-1.5 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 animate-modal-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111827] p-6 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Thêm Ví Mới</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWallet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tên ví / Tài khoản
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Vietcombank, Ví ShopeePay, Tiền tiêu vặt..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Loại ví
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value="cash">Tiền mặt (Cash)</option>
                  <option value="bank">Tài khoản Ngân hàng (Bank)</option>
                  <option value="ewallet">Ví điện tử (MoMo, ZaloPay...)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Số dư ban đầu (VNĐ)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(balance).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  onChange={(e) => setBalance(e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100 font-display font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Màu đại diện
                </label>
                <div className="flex items-center gap-2">
                  {['#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        color === c ? 'scale-110 border-slate-900 dark:border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-full bg-slate-900 dark:bg-brand-600 hover:bg-slate-800 dark:hover:bg-brand-500 text-white text-xs font-semibold shadow-soft-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Tạo ví</span>
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Wallet Modal (UC07) */}
      {showEditModal && editingWallet && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            if (!isSubmitting) {
              setShowEditModal(false)
              setEditingWallet(null)
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white/80 dark:bg-slate-900/95 p-1.5 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 animate-modal-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111827] p-6 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Chỉnh Sửa Ví</h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false)
                  setEditingWallet(null)
                }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateWallet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tên ví / Tài khoản
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="VD: Vietcombank, Ví MoMo..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Loại ví
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value="cash">Tiền mặt (Cash)</option>
                  <option value="bank">Tài khoản Ngân hàng (Bank)</option>
                  <option value="ewallet">Ví điện tử (MoMo, ZaloPay...)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Số dư hiện tại (VNĐ)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(editBalance).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  onChange={(e) => {
                    const raw = e.target.value
                    const digits = raw.replace(/\D/g, '')
                    setEditBalance(raw.startsWith('-') ? `-${digits}` : digits)
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100 font-display font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Màu đại diện
                </label>
                <div className="flex items-center gap-2">
                  {['#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        editColor === c ? 'scale-110 border-slate-900 dark:border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingWallet(null)
                  }}
                  className="px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-full bg-slate-900 dark:bg-brand-600 hover:bg-slate-800 dark:hover:bg-brand-500 text-white text-xs font-semibold shadow-soft-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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

      {/* Transfer Funds Modal */}
      {showTransferModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            if (!isSubmitting) setShowTransferModal(false)
          }}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white/80 dark:bg-slate-900/95 p-1.5 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 animate-modal-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111827] p-6 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Chuyển Tiền Nội Bộ</h3>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Từ ví nguồn
                  </label>
                  <select
                    value={fromWalletId}
                    onChange={(e) => setFromWalletId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({formatCurrency(w.balance)})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Đến ví đích
                  </label>
                  <select
                    value={toWalletId}
                    onChange={(e) => setToWalletId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Số tiền chuyển (VNĐ)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1000"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="VD: 500000"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-sm font-display font-bold text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ghi chú chuyển khoản
                </label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="VD: Rút tiền ATM, Nạp ví MoMo..."
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-full bg-slate-900 dark:bg-brand-600 hover:bg-slate-800 dark:hover:bg-brand-500 text-white text-xs font-semibold shadow-soft-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Xác nhận chuyển</span>
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Archive Dialog */}
      <ConfirmDialog
        isOpen={Boolean(archiveTargetId)}
        title="Ẩn ví khỏi danh sách sử dụng"
        message="Ví bị ẩn sẽ không xuất hiện trong các bộ chọn khi tạo giao dịch mới, nhưng các giao dịch lịch sử trước đây vẫn được giữ nguyên. Bạn có chắc chắn muốn ẩn ví này?"
        confirmText="Ẩn ví"
        cancelText="Giữ lại"
        confirmVariant="warning"
        isLoading={isArchiving}
        onConfirm={handleConfirmArchive}
        onCancel={() => setArchiveTargetId(null)}
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
export default WalletPage
