import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { Toast } from '@/components/common/Toast'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { formatCurrency } from '@/utils/formatCurrency'
import {
  getRecurringRules,
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  toggleRuleActive,
  advanceRecurringRule,
  calculateNextDueDate
} from '@/services/recurringService'
import { getWallets } from '@/services/walletService'
import { getCategories } from '@/services/categoryService'
import { Repeat, Plus, Pencil, Trash2, X, Loader2, Clock, CalendarClock } from 'lucide-react'

/** Trang quản lý Giao dịch định kỳ (RecurringRule) - UC24. */
const FREQUENCY_LABELS = {
  daily: 'Hằng ngày',
  weekly: 'Hằng tuần',
  monthly: 'Hằng tháng',
  yearly: 'Hằng năm'
}

// Lấy ngày theo múi giờ trên máy, không dùng toISOString() (dễ bị lệch ngày ở Việt Nam).
function getLocalToday() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || '')) return 'Chưa xác định'
  const [year, month, day] = dateString.split('-')
  return `${day}/${month}/${year}`
}

function makeEmptyForm(wallets, categories) {
  const today = getLocalToday()
  return {
    title: '',
    type: 'expense',
    amount: '',
    frequency: 'monthly',
    day_of_month: Number(today.slice(-2)),
    next_due_date: today,
    wallet_id: wallets[0]?.id ?? '',
    category_id: categories.find((category) => category.type === 'expense')?.id ?? ''
  }
}

function getErrorMessage(error) {
  return error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.'
}

const fieldClass = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 dark:text-slate-100 dark:focus:ring-slate-600 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-slate-300'
const labelClass = 'block text-xs font-semibold text-slate-700 mb-1.5'

export const RecurringPage = () => {
  const [recurringRules, setRecurringRules] = useState([])
  const [wallets, setWallets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [confirmAction, setConfirmAction] = useState(null)
  const [busyRuleId, setBusyRuleId] = useState(null)
  const confirmInFlightRef = useRef(false)
  const [modalMode, setModalMode] = useState(null) // null | 'create' | 'edit'
  const [editingRuleId, setEditingRuleId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState(() => makeEmptyForm([], []))

  const loadRecurringData = useCallback(async () => {
    setLoading(true)
    setPageError('')
    try {
      // Danh mục tải cả thu lẫn chi để lựa chọn đúng khi người dùng đổi loại.
      const [rulesResult, walletsResult, categoriesResult] = await Promise.all([
        getRecurringRules(),
        getWallets(),
        getCategories()
      ])
      if (rulesResult.error) throw rulesResult.error
      if (walletsResult.error) throw walletsResult.error
      if (categoriesResult.error) throw categoriesResult.error

      setRecurringRules(rulesResult.data || [])
      setWallets(walletsResult.data || [])
      setCategories(categoriesResult.data || [])
    } catch (error) {
      setPageError(`Không tải được Giao dịch định kỳ: ${getErrorMessage(error)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRecurringData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadRecurringData])

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === form.type),
    [categories, form.type]
  )

  const today = getLocalToday()
  const dueCount = recurringRules.filter(
    (rule) => rule.is_active && rule.next_due_date <= today
  ).length

  const nextDuePreview = useMemo(() => {
    if (!form.next_due_date) return ''
    try {
      return calculateNextDueDate(form.next_due_date, form.frequency, form.day_of_month)
    } catch {
      return ''
    }
  }, [form.next_due_date, form.frequency, form.day_of_month])

  function openCreateModal() {
    setEditingRuleId(null)
    setForm(makeEmptyForm(wallets, categories))
    setFormError('')
    setModalMode('create')
  }

  function openEditModal(recurringRule) {
    setEditingRuleId(recurringRule.id)
    setForm({
      title: recurringRule.title || '',
      type: recurringRule.type,
      amount: String(recurringRule.amount ?? ''),
      frequency: recurringRule.frequency,
      // Giữ ngày gốc (VD 31) ngay cả khi ngày đến hạn hiện tại đang là 28/02.
      day_of_month: recurringRule.day_of_month ?? Number(recurringRule.next_due_date.slice(-2)),
      next_due_date: recurringRule.next_due_date,
      wallet_id: recurringRule.wallet_id,
      category_id: recurringRule.category_id
    })
    setFormError('')
    setModalMode('edit')
  }

  function closeModal() {
    if (isSubmitting) return
    setModalMode(null)
    setEditingRuleId(null)
    setFormError('')
  }

  function changeField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleTypeChange(type) {
    const nextCategory = categories.find((category) => category.type === type)
    setForm((current) => ({ ...current, type, category_id: nextCategory?.id ?? '' }))
  }

  function handleDueDateChange(date) {
    setForm((current) => ({
      ...current,
      next_due_date: date,
      // Nếu người dùng đổi ngày đến hạn, mặc định lấy luôn ngày này làm ngày gốc.
      day_of_month: date ? Number(date.slice(-2)) : current.day_of_month
    }))
  }

  async function handleSave(event) {
    event.preventDefault()
    setFormError('')
    if (!form.title.trim() || !form.wallet_id || !form.category_id || !form.next_due_date) {
      setFormError('Vui lòng nhập tên, chọn Ví, Danh mục và ngày đến hạn.')
      return
    }
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      setFormError('Số tiền Giao dịch định kỳ phải lớn hơn 0.')
      return
    }
    if (form.frequency === 'monthly' && (!Number.isInteger(Number(form.day_of_month)) || Number(form.day_of_month) < 1 || Number(form.day_of_month) > 31)) {
      setFormError('Ngày trong tháng phải từ 1 đến 31.')
      return
    }

    const payload = {
      ...form,
      title: form.title.trim(),
      amount: Number(form.amount),
      day_of_month: form.frequency === 'monthly'
        ? Number(form.day_of_month)
        : Number(form.next_due_date.slice(-2))
    }

    const isEdit = modalMode === 'edit'
    setIsSubmitting(true)
    try {
      const { error } = isEdit
        ? await updateRecurringRule(editingRuleId, payload)
        : await createRecurringRule(payload)
      if (error) throw error

      setModalMode(null)
      setEditingRuleId(null)
      setToast({
        show: true,
        message: isEdit
          ? 'Đã cập nhật Giao dịch định kỳ.'
          : 'Đã tạo Giao dịch định kỳ.',
        type: 'success'
      })
      await loadRecurringData()
      window.dispatchEvent(new Event('spendwise:finance-updated'))
    } catch (error) {
      setFormError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCloseToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }))
  }, [])

  async function runRuleAction(recurringRule, action, successText) {
    setBusyRuleId(recurringRule.id)
    try {
      const { error } = await action()
      if (error) throw error
      setToast({ show: true, message: successText, type: 'success' })
      await loadRecurringData()
      window.dispatchEvent(new Event('spendwise:finance-updated'))
    } catch (error) {
      setToast({ show: true, message: getErrorMessage(error), type: 'error' })
    } finally {
      setBusyRuleId(null)
    }
  }

  function handleDelete(recurringRule) {
    setConfirmAction({ type: 'delete', rule: recurringRule })
  }

  function handleAdvance(recurringRule) {
    // Không tự động sinh giao dịch hay đánh dấu đã thanh toán; chỉ đổi lịch hẹn.
    setConfirmAction({ type: 'advance', rule: recurringRule })
  }

  async function handleConfirmAction() {
    if (!confirmAction || busyRuleId || confirmInFlightRef.current) return
    confirmInFlightRef.current = true
    const { type, rule } = confirmAction
    const isDelete = type === 'delete'
    try {
      await runRuleAction(
        rule,
        () => (isDelete ? deleteRecurringRule(rule.id) : advanceRecurringRule(rule)),
        isDelete
          ? 'Đã xóa Giao dịch định kỳ.'
          : 'Đã tính và lưu ngày đến hạn kỳ tiếp theo.'
      )
      setConfirmAction(null)
    } finally {
      confirmInFlightRef.current = false
    }
  }

  const isConfirmDelete = confirmAction?.type === 'delete'
  const isConfirmLoading = Boolean(confirmAction && busyRuleId === confirmAction.rule.id)

  return (
    <div className="space-y-6">
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={handleCloseToast}
      />

      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        title={isConfirmDelete ? 'Xóa Giao dịch định kỳ' : 'Chuyển sang kỳ tiếp theo'}
        message={
          isConfirmDelete
            ? `Bạn có chắc chắn muốn xóa Giao dịch định kỳ "${confirmAction?.rule?.title || ''}" không?`
            : 'Chuyển ngày đến hạn sang kỳ kế tiếp? Thao tác này chỉ cập nhật lịch, KHÔNG tự tạo giao dịch thu/chi.'
        }
        confirmText={isConfirmDelete ? 'Xóa' : 'Chuyển kỳ'}
        confirmVariant={isConfirmDelete ? 'danger' : 'primary'}
        isLoading={isConfirmLoading}
        onCancel={() => {
          if (!isConfirmLoading) setConfirmAction(null)
        }}
        onConfirm={handleConfirmAction}
      />

      <PageHeader
        eyebrow="Tự động hóa tài chính"
        title="Giao dịch định kỳ"
        description="Quản lý các khoản thu/chi lặp lại, theo dõi hạn đến và tính ngày đến hạn kế tiếp để hỗ trợ Safe-to-spend."
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-soft-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm Giao dịch định kỳ
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
          Tổng cộng: <strong>{recurringRules.length}</strong>
        </span>
        <span className="rounded-full border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-3 py-1.5">
          Đến hạn / quá hạn: <strong>{dueCount}</strong>
        </span>
      </div>

      {pageError && (
        <div role="alert" className="rounded-2xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/50 p-4 text-sm text-rose-700 dark:text-rose-300">
          {pageError}
          <button type="button" onClick={loadRecurringData} className="ml-3 underline font-semibold">
            Thử lại
          </button>
        </div>
      )}

      <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5 dark:ring-white/10">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 sm:p-6 border border-slate-100">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Đang tải Giao dịch định kỳ...
            </div>
          ) : recurringRules.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <Repeat className="w-9 h-9 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              Chưa có Giao dịch định kỳ. Hãy thêm tiền trọ, tiền mạng, lương hoặc khoản thu/chi khác.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recurringRules.map((recurringRule) => {
                const isExpense = recurringRule.type === 'expense'
                const isDue = recurringRule.is_active && recurringRule.next_due_date <= today
                const isBusy = busyRuleId === recurringRule.id

                return (
                  <div key={recurringRule.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                        !recurringRule.is_active
                          ? 'bg-slate-300 dark:bg-slate-700 dark:text-slate-400'
                          : isExpense
                            ? 'bg-slate-900 dark:bg-slate-800 dark:ring-1 dark:ring-white/10'
                            : 'bg-emerald-600'
                      }`}>
                        <Repeat className="w-5 h-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2 items-center">
                          <h3 className={`font-display font-bold text-sm break-words ${
                            recurringRule.is_active ? 'text-slate-900' : 'text-slate-400 line-through'
                          }`}>{recurringRule.title}</h3>
                          <span className="rounded-full px-2 py-0.5 bg-slate-100 text-[11px] text-slate-600">
                            {FREQUENCY_LABELS[recurringRule.frequency] || recurringRule.frequency}
                          </span>
                          {isDue && (
                            <span className="rounded-full px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                              Đến hạn / quá hạn
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Đến hạn: {formatDate(recurringRule.next_due_date)}
                          </span>
                          <span>•</span><span>Ví: {recurringRule.wallet?.name || 'Không xác định'}</span>
                          <span>•</span><span>Danh mục: {recurringRule.category?.name || 'Không xác định'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <span className={`font-display font-bold text-sm mr-2 ${
                        !recurringRule.is_active ? 'text-slate-400' : isExpense ? 'text-slate-900' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {isExpense ? '-' : '+'}{formatCurrency(recurringRule.amount)}
                      </span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => runRuleAction(
                          recurringRule,
                          () => toggleRuleActive(recurringRule.id, !recurringRule.is_active),
                          recurringRule.is_active ? 'Đã tạm dừng Giao dịch định kỳ.' : 'Đã kích hoạt Giao dịch định kỳ.'
                        )}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border disabled:opacity-50 cursor-pointer transition-colors ${
                          recurringRule.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 border-slate-200 text-slate-500'
                        }`}
                        aria-label={`${recurringRule.is_active ? 'Tạm dừng' : 'Kích hoạt'} ${recurringRule.title}`}
                      >
                        {recurringRule.is_active ? 'Đang bật' : 'Đã tắt'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || !recurringRule.is_active}
                        onClick={() => handleAdvance(recurringRule)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-xs font-semibold disabled:opacity-40 cursor-pointer transition-colors"
                        title="Tính và lưu ngày đến hạn kế tiếp (không tạo giao dịch)"
                      >
                        <CalendarClock className="w-3.5 h-3.5" /> Kỳ tiếp theo
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openEditModal(recurringRule)}
                        className="p-2 rounded-full text-slate-500 hover:text-sky-700 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer transition-colors"
                        aria-label={`Sửa Giao dịch định kỳ ${recurringRule.title}`}
                        title="Sửa Giao dịch định kỳ"
                      ><Pencil className="w-4 h-4" /></button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(recurringRule)}
                        className="p-2 rounded-full text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 disabled:opacity-40 cursor-pointer transition-colors"
                        aria-label={`Xóa Giao dịch định kỳ ${recurringRule.title}`}
                        title="Xóa Giao dịch định kỳ"
                      ><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          onKeyDown={(event) => { if (event.key === 'Escape') closeModal() }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recurring-modal-title"
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 dark:ring-1 dark:ring-white/10"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 id="recurring-modal-title" className="font-display font-bold text-base text-slate-900">
                {modalMode === 'edit' ? 'Sửa Giao dịch định kỳ' : 'Thêm Giao dịch định kỳ'}
              </h2>
              <button type="button" onClick={closeModal} disabled={isSubmitting}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer transition-colors"
                aria-label="Đóng cửa sổ"
              ><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="recurring-title" className={labelClass}>Tên Giao dịch định kỳ</label>
                <input id="recurring-title" type="text" required maxLength={150}
                  value={form.title} onChange={(event) => changeField('title', event.target.value)}
                  placeholder="Ví dụ: Tiền trọ, Internet, Lương..." className={fieldClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="recurring-type" className={labelClass}>Loại khoản</label>
                  <select id="recurring-type" value={form.type}
                    onChange={(event) => handleTypeChange(event.target.value)} className={fieldClass}>
                    <option value="expense">Khoản chi</option>
                    <option value="income">Khoản thu</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="recurring-amount" className={labelClass}>Số tiền (VNĐ)</label>
                  <input id="recurring-amount" type="number" required min="0.01" step="0.01"
                    value={form.amount} onChange={(event) => changeField('amount', event.target.value)}
                    placeholder="Ví dụ: 250000" className={fieldClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="recurring-frequency" className={labelClass}>Tần suất</label>
                  <select id="recurring-frequency" value={form.frequency}
                    onChange={(event) => changeField('frequency', event.target.value)} className={fieldClass}>
                    <option value="daily">Hằng ngày</option>
                    <option value="weekly">Hằng tuần</option>
                    <option value="monthly">Hằng tháng</option>
                    <option value="yearly">Hằng năm</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="recurring-next-date" className={labelClass}>Ngày đến hạn tiếp theo</label>
                  <input id="recurring-next-date" type="date" required
                    value={form.next_due_date} onChange={(event) => handleDueDateChange(event.target.value)}
                    className={fieldClass} />
                </div>
              </div>
              {form.frequency === 'monthly' && (
                <div>
                  <label htmlFor="recurring-day" className={labelClass}>Ngày lặp lại trong tháng (1–31)</label>
                  <input id="recurring-day" type="number" min="1" max="31" step="1" required
                    value={form.day_of_month} onChange={(event) => changeField('day_of_month', event.target.value)}
                    className={fieldClass} />
                  <p className="mt-1 text-xs text-slate-500">
                    Với tháng thiếu ngày đã chọn (VD ngày 31), hệ thống dùng ngày cuối tháng.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="recurring-wallet" className={labelClass}>Ví</label>
                  <select id="recurring-wallet" required value={form.wallet_id}
                    onChange={(event) => changeField('wallet_id', event.target.value)} className={fieldClass}>
                    <option value="">Chọn Ví</option>
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="recurring-category" className={labelClass}>Danh mục {form.type === 'income' ? 'thu' : 'chi'}</label>
                  <select id="recurring-category" required value={form.category_id}
                    onChange={(event) => changeField('category_id', event.target.value)} className={fieldClass}>
                    <option value="">Chọn Danh mục</option>
                    {availableCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {nextDuePreview && (
                <p className="rounded-xl bg-sky-50 dark:bg-sky-950/50 px-3 py-2 text-xs text-sky-800 dark:text-sky-300">
                  Sau kỳ ngày {formatDate(form.next_due_date)}, ngày đến hạn kế tiếp dự kiến là{' '}
                  <strong>{formatDate(nextDuePreview)}</strong>.
                </p>
              )}
              {formError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-400">{formError}</p>}
              {(!wallets.length || !availableCategories.length) && (
                <p className="text-xs text-amber-700 dark:text-amber-400">Cần có Ví và Danh mục phù hợp trước khi tạo Giao dịch định kỳ.</p>
              )}
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={closeModal} disabled={isSubmitting}
                  className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 text-xs font-semibold disabled:opacity-50 cursor-pointer transition-colors">
                  Hủy
                </button>
                <button type="submit" disabled={isSubmitting || !wallets.length || !availableCategories.length}
                  className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-colors">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {modalMode === 'edit' ? 'Lưu thay đổi' : 'Tạo Giao dịch định kỳ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecurringPage
