import React, { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import Toast from '@/components/common/Toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { formatCurrency } from '@/utils/formatCurrency'
import {
  getGoals,
  createGoal,
  updateGoal,
  depositToGoal,
  deleteGoal,
} from '@/services/goalService'
import { getWallets } from '@/services/walletService'
import confetti from 'canvas-confetti'
import { Target, Plus, Pencil, Trash2, X, Loader2, Calendar } from 'lucide-react'

const emptyForm = {
  name: '',
  targetAmount: '',
  deadline: '',
}

function formatMoneyInput(value) {
  return value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function formatDeadline(value) {
  if (!value) return ''
  const parts = value.split('-')
  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : value
}

function GoalModal({ title, onClose, children, busy }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [busy, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-[2rem] bg-white/80 p-2 shadow-2xl ring-1 ring-slate-900/5"
      >
        <div className="rounded-[calc(2rem-0.5rem)] border border-slate-100 bg-white p-6">
          <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-display text-base font-bold text-slate-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Đóng"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export const GoalPage = () => {
  const [goals, setGoals] = useState([])
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const [depositGoal, setDepositGoal] = useState(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositWalletId, setDepositWalletId] = useState('')

  const [deleteGoalId, setDeleteGoalId] = useState(null)
  const [toast, setToast] = useState({ message: '', type: 'success' })

  const notify = (message, type = 'success') => setToast({ message, type })

  const fetchGoalsList = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      const [goalsResult, walletsResult] = await Promise.all([
        getGoals(),
        getWallets(),
      ])

      if (goalsResult.error) throw goalsResult.error
      if (walletsResult.error) throw walletsResult.error

      setGoals(goalsResult.data || [])
      setWallets((walletsResult.data || []).filter((wallet) => !wallet.is_archived))
    } catch (error) {
      setLoadError(error.message || 'Không thể tải dữ liệu mục tiêu.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchGoalsList()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchGoalsList])

  const openCreate = () => {
    setEditingGoal(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (goal) => {
    setEditingGoal(goal)
    setForm({
      name: goal.name || '',
      targetAmount: String(goal.target_amount ?? ''),
      deadline: goal.deadline || '',
    })
    setFormOpen(true)
  }

  const handleSaveGoal = async (event) => {
    event.preventDefault()

    const name = form.name.trim()
    const targetAmount = Number(form.targetAmount)

    if (!name || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      notify('Vui lòng nhập tên và số tiền mục tiêu hợp lệ.', 'error')
      return
    }

    if (
      editingGoal &&
      targetAmount < Number(editingGoal.current_amount || 0)
    ) {
      notify('Số tiền mục tiêu không được nhỏ hơn số tiền đã tích lũy.', 'error')
      return
    }

    setBusy(true)

    try {
      let result

      if (editingGoal) {
        const currentAmount = Number(editingGoal.current_amount || 0)

        result = await updateGoal(editingGoal.id, {
          name,
          target_amount: targetAmount,
          deadline: form.deadline || null,
          status: currentAmount >= targetAmount ? 'completed' : 'in_progress',
        })
      } else {
        result = await createGoal({
          name,
          target_amount: targetAmount,
          deadline: form.deadline || null,
        })
      }

      if (result.error) throw result.error

      setFormOpen(false)
      notify(editingGoal ? 'Đã cập nhật mục tiêu.' : 'Đã tạo mục tiêu.')
      await fetchGoalsList()
    } catch (error) {
      notify(error.message || 'Không thể lưu mục tiêu.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const openDeposit = (goal) => {
    if (wallets.length === 0) {
      notify('Bạn chưa có ví đang hoạt động. Hãy tạo ví trước khi nạp.', 'warning')
      return
    }

    setDepositGoal(goal)
    setDepositAmount('')
    setDepositWalletId(wallets[0].id)
  }

  const handleDeposit = async (event) => {
    event.preventDefault()

    const amount = Number(depositAmount)
    const remaining =
      Number(depositGoal.target_amount) - Number(depositGoal.current_amount || 0)

    if (!Number.isFinite(amount) || amount <= 0 || !depositWalletId) {
      notify('Vui lòng nhập số tiền và chọn ví hợp lệ.', 'error')
      return
    }

    if (amount > remaining) {
      notify('Số tiền nạp vượt quá số tiền còn thiếu của mục tiêu.', 'error')
      return
    }

    setBusy(true)

    try {
      const { data, error } = await depositToGoal({
        goalId: depositGoal.id,
        walletId: depositWalletId,
        amount,
      })

      if (error) throw error

      setDepositGoal(null)
      setDepositAmount('')

      if (data?.isCompleted) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
        notify('Chúc mừng! Bạn đã hoàn thành mục tiêu tiết kiệm.')
      } else {
        notify('Nạp tiền vào mục tiêu thành công.')
      }

      window.dispatchEvent(new Event('spendwise:finance-updated'))
      await fetchGoalsList()
    } catch (error) {
      notify(error.message || 'Không thể nạp tiền vào mục tiêu.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteGoalId) return

    setBusy(true)

    try {
      const { error } = await deleteGoal(deleteGoalId)
      if (error) throw error

      setDeleteGoalId(null)
      notify('Đã xóa mục tiêu.')
      await fetchGoalsList()
    } catch (error) {
      notify(error.message || 'Không thể xóa mục tiêu.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

  const labelClass =
    'mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700'

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tích lũy tương lai"
        title="Mục tiêu Tiết kiệm"
        description="Đặt mục tiêu tài chính, nạp tiền tích lũy và theo dõi tiến độ."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Tạo mục tiêu
          </button>
        }
      />

      {loading ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-12 text-center text-sm text-slate-500">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
          Đang tải danh sách mục tiêu...
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={fetchGoalsList}
            className="mt-3 font-semibold underline"
          >
            Thử tải lại
          </button>
        </div>
      ) : goals.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-12 text-center text-sm text-slate-500">
          Bạn chưa có mục tiêu tiết kiệm nào. Hãy tạo mục tiêu đầu tiên.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const current = Number(goal.current_amount || 0)
            const target = Number(goal.target_amount || 0)
            const percent = target > 0
              ? Math.min(100, Math.round((current / target) * 100))
              : 0
            const completed = goal.status === 'completed'

            return (
              <div
                key={goal.id}
                className="rounded-[2rem] bg-white/70 p-2 shadow-soft-sm ring-1 ring-slate-900/5"
              >
                <div className="h-full rounded-[calc(2rem-0.5rem)] border border-slate-100 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-slate-900 p-2.5 text-white">
                        <Target className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-slate-900">
                          {goal.name}
                        </h3>
                        {goal.deadline && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                            <Calendar className="h-3 w-3" />
                            Hạn chót: {formatDeadline(goal.deadline)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(goal)}
                        aria-label={`Sửa mục tiêu ${goal.name}`}
                        className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteGoalId(goal.id)}
                        aria-label={`Xóa mục tiêu ${goal.name}`}
                        className="rounded-full p-2 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="my-5 space-y-2">
                    <div className="flex justify-between gap-3 text-xs text-slate-600">
                      <span>Hiện có: <strong>{formatCurrency(current)}</strong></span>
                      <span>Mục tiêu: <strong>{formatCurrency(target)}</strong></span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {completed ? 'Đã hoàn thành' : `Tiến độ: ${percent}%`}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-500">
                      {completed
                        ? 'Đã đạt mục tiêu'
                        : `Còn thiếu: ${formatCurrency(Math.max(0, target - current))}`}
                    </span>
                    {!completed && (
                      <button
                        type="button"
                        onClick={() => openDeposit(goal)}
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                      >
                        Nạp tiền
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {formOpen && (
        <GoalModal
          title={editingGoal ? 'Sửa mục tiêu tiết kiệm' : 'Tạo mục tiêu tiết kiệm'}
          busy={busy}
          onClose={() => setFormOpen(false)}
        >
          <form onSubmit={handleSaveGoal} className="space-y-4">
            <div>
              <label htmlFor="goal-name" className={labelClass}>Tên mục tiêu</label>
              <input
                id="goal-name"
                className={inputClass}
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Ví dụ: Quỹ du lịch"
              />
            </div>

            <div>
              <label htmlFor="goal-target" className={labelClass}>Số tiền mục tiêu (VNĐ)</label>
              <input
                id="goal-target"
                type="text"
                inputMode="numeric"
                required
                className={inputClass}
                value={formatMoneyInput(form.targetAmount)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    targetAmount: event.target.value.replace(/\D/g, ''),
                  })
                }
              />
            </div>

            <div>
              <label htmlFor="goal-deadline" className={labelClass}>Hạn chót</label>
              <input
                id="goal-deadline"
                type="date"
                className={inputClass}
                value={form.deadline}
                onChange={(event) => setForm({ ...form, deadline: event.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setFormOpen(false)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Đang lưu...' : 'Lưu mục tiêu'}
              </button>
            </div>
          </form>
        </GoalModal>
      )}

      {depositGoal && (
        <GoalModal
          title={`Nạp tiền: ${depositGoal.name}`}
          busy={busy}
          onClose={() => setDepositGoal(null)}
        >
          <form onSubmit={handleDeposit} className="space-y-4">
            <div>
              <label htmlFor="deposit-wallet" className={labelClass}>Ví nguồn</label>
              <select
                id="deposit-wallet"
                required
                className={inputClass}
                value={depositWalletId}
                onChange={(event) => setDepositWalletId(event.target.value)}
              >
                <option value="">Chọn ví</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name} ({formatCurrency(wallet.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="deposit-amount" className={labelClass}>Số tiền nạp (VNĐ)</label>
              <input
                id="deposit-amount"
                type="text"
                inputMode="numeric"
                required
                className={inputClass}
                value={formatMoneyInput(depositAmount)}
                onChange={(event) =>
                  setDepositAmount(event.target.value.replace(/\D/g, ''))
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDepositGoal(null)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Đang nạp...' : 'Xác nhận nạp'}
              </button>
            </div>
          </form>
        </GoalModal>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteGoalId)}
        title="Xóa mục tiêu tiết kiệm"
        message="Bạn có chắc chắn muốn xóa mục tiêu này không?"
        confirmText="Xóa mục tiêu"
        onConfirm={handleDelete}
        onCancel={() => setDeleteGoalId(null)}
        isLoading={busy}
      />

      <Toast
        show={Boolean(toast.message)}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'success' })}
      />
    </div>
  )
}

export default GoalPage
