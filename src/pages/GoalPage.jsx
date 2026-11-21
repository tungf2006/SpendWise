import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { formatCurrency } from '@/utils/formatCurrency'
import { getGoals, createGoal, depositToGoal, deleteGoal } from '@/services/goalService'
import { getWallets } from '@/services/walletService'
import confetti from 'canvas-confetti'
import { 
  Target, 
  Plus, 
  ArrowUpRight, 
  CheckCircle2, 
  Trash2, 
  X, 
  Loader2, 
  Calendar,
  Sparkles
} from 'lucide-react'

/**
 * Trang Quản lý Mục tiêu Tiết kiệm (GoalPage)
 * Phụ trách: TV1 (Trương Bích Vân) - Nhóm chức năng GOAL_REC (UC22 - UC23)
 */
export const GoalPage = () => {
  const [goals, setGoals] = useState([])
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Create form
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [selectedWalletId, setSelectedWalletId] = useState('')

  // Deposit form
  const [depositAmount, setDepositAmount] = useState('')
  const [depositWalletId, setDepositWalletId] = useState('')

  const fetchGoalsList = async () => {
    try {
      setLoading(true)
      const [gRes, wRes] = await Promise.all([getGoals(), getWallets()])
      setGoals(gRes.data || [])
      setWallets(wRes.data || [])
      if (wRes.data && wRes.data.length > 0) {
        setSelectedWalletId(wRes.data[0].id)
        setDepositWalletId(wRes.data[0].id)
      }
    } catch (err) {
      console.error('Lỗi khi tải mục tiêu:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGoalsList()
  }, [])

  const handleCreateGoal = async (e) => {
    e.preventDefault()
    if (!name.trim() || !targetAmount || Number(targetAmount) <= 0) {
      alert('Vui lòng điền tên mục tiêu và số tiền hợp lệ')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await createGoal({
        name,
        target_amount: Number(targetAmount),
        deadline: deadline || null,
        wallet_id: selectedWalletId || null
      })

      if (error) throw error

      setShowAddModal(false)
      setName('')
      setTargetAmount('')
      setDeadline('')
      await fetchGoalsList()
    } catch (err) {
      alert('Lỗi tạo mục tiêu: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeposit = async (e) => {
    e.preventDefault()
    if (!selectedGoal || !depositAmount || Number(depositAmount) <= 0 || !depositWalletId) {
      alert('Vui lòng nhập số tiền và chọn ví hợp lệ')
      return
    }

    setIsSubmitting(true)
    try {
      const { data, error } = await depositToGoal({
        goalId: selectedGoal.id,
        amount: Number(depositAmount),
        walletId: depositWalletId
      })

      if (error) throw error

      if (data?.isCompleted) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        })
        alert(`Chúc mừng! Bạn đã hoàn thành xuất sắc mục tiêu "${selectedGoal.name}"! 🎉`)
      }

      setShowDepositModal(false)
      setDepositAmount('')
      await fetchGoalsList()
    } catch (err) {
      alert('Lỗi khi nạp tiền: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mục tiêu này?')) return

    try {
      const { error } = await deleteGoal(id)
      if (error) throw error
      await fetchGoalsList()
    } catch (err) {
      alert('Lỗi khi xóa: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tích lũy tương lai"
        title="Mục tiêu Tiết kiệm"
        description="Đặt ra mục tiêu tài chính rõ ràng, nạp tiền tích lũy và theo dõi chặng đường cán mốc ước mơ."
        actions={
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-soft-sm transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo mục tiêu</span>
          </button>
        }
      />

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 py-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto mb-2" />
            <span>Đang tải danh sách mục tiêu...</span>
          </div>
        ) : goals.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
            Bạn chưa có mục tiêu tiết kiệm nào. Hãy tạo mục tiêu đầu tiên (mua xe, mua laptop, đi du lịch...) ngay hôm nay!
          </div>
        ) : (
          goals.map((goal) => {
            const current = Number(goal.current_amount || 0)
            const target = Number(goal.target_amount || 1)
            const percent = Math.min(100, Math.round((current / target) * 100))
            const isCompleted = goal.status === 'completed' || percent >= 100

            return (
              <div
                key={goal.id}
                className="rounded-[2rem] bg-white/70 p-2 shadow-soft-sm ring-1 ring-slate-900/5 hover:shadow-soft-md transition-shadow"
              >
                <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 border border-slate-100 flex flex-col justify-between h-full">
                  
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white ${
                          isCompleted ? 'bg-emerald-500' : 'bg-slate-900'
                        }`}>
                          {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-sm text-slate-900">{goal.name}</h4>
                          {goal.deadline && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              <span>Hạn chót: {goal.deadline}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {isCompleted ? 'Hoàn thành' : `${percent}%`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(goal.id)}
                          className="text-slate-300 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="my-4 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 font-medium">Hiện có: <strong className="font-display text-slate-900">{formatCurrency(current)}</strong></span>
                        <span className="text-slate-400 font-medium">Mục tiêu: <strong className="font-display text-slate-700">{formatCurrency(target)}</strong></span>
                      </div>

                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCompleted ? 'bg-emerald-500' : 'bg-brand-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {isCompleted ? '🎉 Đã đạt mục tiêu' : `Còn thiếu: ${formatCurrency(target - current)}`}
                    </span>

                    {!isCompleted && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGoal(goal)
                          setShowDepositModal(true)
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nạp tiền</span>
                      </button>
                    )}
                  </div>

                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add Goal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Tạo Mục Tiêu Tiết Kiệm Mới</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tên mục tiêu
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Mua xe máy mới, Quỹ du lịch Phú Quốc..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Số tiền mục tiêu cần đạt (VNĐ)
                </label>
                <input
                  type="number"
                  required
                  min="100000"
                  step="100000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="VD: 20000000"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm font-display font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ngày dự kiến hoàn thành (Hạn chót)
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                />
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
                  <span>Tạo mục tiêu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit to Goal Modal */}
      {showDepositModal && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">Nạp Tiền Tiết Kiệm</h3>
                <p className="text-xs text-slate-500">Mục tiêu: {selectedGoal.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDepositModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nguồn tiền trích nạp (Ví)
                </label>
                <select
                  value={depositWalletId}
                  onChange={(e) => setDepositWalletId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({formatCurrency(w.balance)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Số tiền nạp (VNĐ)
                </label>
                <input
                  type="number"
                  required
                  min="10000"
                  step="50000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="VD: 500000"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm font-display font-bold text-slate-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
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
                  <span>Xác nhận nạp</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
export default GoalPage
