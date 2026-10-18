import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { formatCurrency } from '@/utils/formatCurrency'
import { 
  getRecurringRules, 
  createRecurringRule, 
  deleteRecurringRule, 
  toggleRuleActive 
} from '@/services/recurringService'
import { getWallets } from '@/services/walletService'
import { getCategories } from '@/services/categoryService'
import { 
  Repeat, 
  Plus, 
  Calendar, 
  Trash2, 
  Check, 
  X, 
  Loader2, 
  Clock, 
  Tag, 
  Wallet 
} from 'lucide-react'

/**
 * Trang Quản lý Giao dịch Định kỳ (RecurringPage)
 * Phụ trách: TV4 (Lê Hoài Quốc) - Nhóm chức năng GOAL_REC (UC24)
 */
export const RecurringPage = () => {
  const [rules, setRules] = useState([])
  const [wallets, setWallets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [nextDueDate, setNextDueDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')

  const fetchRulesList = async () => {
    try {
      setLoading(true)
      const [rRes, wRes, cRes] = await Promise.all([
        getRecurringRules(),
        getWallets(),
        getCategories('expense')
      ])

      setRules(rRes.data || [])
      setWallets(wRes.data || [])
      setCategories(cRes.data || [])

      if (wRes.data && wRes.data.length > 0) setSelectedWalletId(wRes.data[0].id)
      if (cRes.data && cRes.data.length > 0) setSelectedCategoryId(cRes.data[0].id)
    } catch (err) {
      console.error('Lỗi khi tải giao dịch định kỳ:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRulesList()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!title.trim() || !amount || Number(amount) <= 0 || !selectedWalletId || !selectedCategoryId) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await createRecurringRule({
        title,
        type,
        amount: Number(amount),
        frequency,
        day_of_month: frequency === 'monthly' ? Number(dayOfMonth) : null,
        next_due_date: nextDueDate,
        wallet_id: selectedWalletId,
        category_id: selectedCategoryId
      })

      if (error) throw error

      setShowAddModal(false)
      setTitle('')
      setAmount('')
      await fetchRulesList()
    } catch (err) {
      alert('Lỗi tạo quy tắc định kỳ: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggle = async (rule) => {
    try {
      const { error } = await toggleRuleActive(rule.id, !rule.is_active)
      if (error) throw error
      await fetchRulesList()
    } catch (err) {
      alert('Lỗi bật/tắt quy tắc: ' + err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có muốn xóa quy tắc định kỳ này?')) return

    try {
      const { error } = await deleteRecurringRule(id)
      if (error) throw error
      await fetchRulesList()
    } catch (err) {
      alert('Lỗi khi xóa: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tự động hóa tài chính"
        title="Giao dịch Định kỳ"
        description="Thiết lập các khoản thu/chi cố định lặp lại (tiền nhà, internet, netflix, gym) phục vụ tính toán chính xác số tiền Safe-to-spend."
        actions={
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-soft-sm transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm khoản định kỳ</span>
          </button>
        }
      />

      {/* Recurring Rules List */}
      <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 sm:p-6 border border-slate-100">
          
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto mb-2" />
              <span>Đang tải danh sách khoản định kỳ...</span>
            </div>
          ) : rules.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Chưa có khoản định kỳ nào được thiết lập. Hãy thêm các khoản cố định hàng tháng để công thức Safe-to-spend dự báo dòng tiền chính xác hơn!
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rules.map((rule) => {
                const isExpense = rule.type === 'expense'

                return (
                  <div key={rule.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                          rule.is_active ? (isExpense ? 'bg-slate-900' : 'bg-emerald-600') : 'bg-slate-300'
                        }`}
                      >
                        <Repeat className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`font-display font-bold text-sm ${rule.is_active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                            {rule.title}
                          </h4>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                            {rule.frequency === 'monthly' ? 'Hàng tháng' : rule.frequency === 'weekly' ? 'Hàng tuần' : 'Hàng năm'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Đến hạn: <strong>{rule.next_due_date}</strong></span>
                          </span>
                          <span>•</span>
                          <span>{rule.wallet?.name}</span>
                          <span>•</span>
                          <span className="text-slate-600 font-medium">{rule.category?.name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <span className={`font-display font-bold text-sm ${
                        !rule.is_active ? 'text-slate-400' : isExpense ? 'text-slate-900' : 'text-emerald-600'
                      }`}>
                        {isExpense ? '-' : '+'}{formatCurrency(rule.amount)}
                      </span>

                      {/* Active toggle button */}
                      <button
                        type="button"
                        onClick={() => handleToggle(rule)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                          rule.is_active
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {rule.is_active ? 'Đang bật' : 'Đã tắt'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(rule.id)}
                        className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                        title="Xóa quy tắc"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>

      {/* Add Recurring Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Thêm Khoản Định Kỳ Mới</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tên khoản định kỳ
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Tiền nhà, Tiền internet FPT, Netflix..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Loại khoản
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="expense">Khoản Chi (Expense)</option>
                    <option value="income">Khoản Thu (Income)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Số tiền (VNĐ)
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="10000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="VD: 250000"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm font-display font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Chu kỳ lặp lại
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="monthly">Hàng tháng</option>
                    <option value="weekly">Hàng tuần</option>
                    <option value="yearly">Hàng năm</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ngày đến hạn tới
                  </label>
                  <input
                    type="date"
                    required
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ví thanh toán
                  </label>
                  <select
                    value={selectedWalletId}
                    onChange={(e) => setSelectedWalletId(e.target.value)}
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
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
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
                  <span>Tạo quy tắc</span>
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
