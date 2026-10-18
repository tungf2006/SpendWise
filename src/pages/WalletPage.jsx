import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { formatCurrency } from '@/utils/formatCurrency'
import { getWallets, createWallet, transferFunds, archiveWallet } from '@/services/walletService'
import { 
  Wallet, 
  Plus, 
  ArrowRightLeft, 
  Smartphone, 
  CreditCard, 
  Archive, 
  X, 
  Loader2,
  CheckCircle2,
  TrendingUp
} from 'lucide-react'

/**
 * Trang Quản lý Ví & Chuyển tiền nội bộ (WalletPage)
 * Phụ trách: TV3 (Nguyễn Vũ Tấn Huy) - Nhóm chức năng WALLET (UC06 - UC09)
 */
export const WalletPage = () => {
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Add form
  const [name, setName] = useState('')
  const [type, setType] = useState('cash')
  const [balance, setBalance] = useState('')
  const [color, setColor] = useState('#10B981')

  // Transfer form
  const [fromWalletId, setFromWalletId] = useState('')
  const [toWalletId, setToWalletId] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferNote, setTransferNote] = useState('')

  const fetchWalletsList = async () => {
    try {
      setLoading(true)
      const { data } = await getWallets()
      setWallets(data || [])
      if (data && data.length >= 2) {
        setFromWalletId(data[0].id)
        setToWalletId(data[1].id)
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách ví:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWalletsList()
  }, [])

  const handleCreateWallet = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      const { error } = await createWallet({
        name,
        type,
        balance: Number(balance) || 0,
        color
      })

      if (error) throw error

      setShowAddModal(false)
      setName('')
      setBalance('')
      await fetchWalletsList()
    } catch (err) {
      alert('Lỗi tạo ví: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTransfer = async (e) => {
    e.preventDefault()
    if (!fromWalletId || !toWalletId || !transferAmount || Number(transferAmount) <= 0) {
      alert('Vui lòng chọn ví và nhập số tiền hợp lệ')
      return
    }

    if (fromWalletId === toWalletId) {
      alert('Ví nguồn và ví đích không được trùng nhau')
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
      alert('Chuyển tiền nội bộ thành công!')
    } catch (err) {
      alert('Lỗi chuyển tiền: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleArchive = async (walletId) => {
    if (!window.confirm('Bạn có muốn ẩn ví này khỏi danh sách sử dụng?')) return

    try {
      const { error } = await archiveWallet(walletId)
      if (error) throw error
      await fetchWalletsList()
    } catch (err) {
      alert('Lỗi khi ẩn ví: ' + err.message)
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
              onClick={() => setShowTransferModal(true)}
              disabled={wallets.length < 2}
              className="px-3.5 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-200/80 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Chuyển tiền nội bộ</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-soft-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm ví mới</span>
            </button>
          </div>
        }
      />

      {/* Total Balance Card */}
      <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
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
              className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5 hover:shadow-soft-lg transition-all"
            >
              <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 border border-slate-100 flex flex-col justify-between h-full">
                
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-xs"
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

                  <button
                    type="button"
                    onClick={() => handleArchive(w.id)}
                    className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
                    title="Ẩn ví"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Thêm Ví Mới</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Loại ví
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
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
                  type="number"
                  min="0"
                  step="1000"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 font-display font-bold"
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
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        color === c ? 'scale-110 border-slate-900' : 'border-transparent'
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
                  <span>Tạo ví</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Funds Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Chuyển Tiền Nội Bộ</h3>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm font-display font-bold text-slate-900"
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
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
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
                  <span>Xác nhận chuyển</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
export default WalletPage
