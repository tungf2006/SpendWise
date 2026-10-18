import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { formatCurrency } from '@/utils/formatCurrency'
import { getBudgetProgress, setBudget, deleteBudget } from '@/services/budgetService'
import { getCategories } from '@/services/categoryService'
import { 
  PieChart, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  X, 
  Loader2,
  Calendar
} from 'lucide-react'

/**
 * Trang Quản lý Ngân sách tháng (BudgetPage)
 * Phụ trách: TV2 (Hồ Nguyên Văn) - Nhóm chức năng BUDGET (UC14 - UC15)
 */
export const BudgetPage = () => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [budgets, setBudgets] = useState([])
  const [totalBudget, setTotalBudget] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [amountLimit, setAmountLimit] = useState('')

  const fetchBudgetData = async () => {
    try {
      setLoading(true)
      const res = await getBudgetProgress(currentMonth, currentYear)
      setBudgets(res.data || [])
      setTotalBudget(res.totalBudget || 0)
      setTotalSpent(res.totalSpent || 0)
    } catch (err) {
      console.error('Lỗi khi tải ngân sách:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function loadCategories() {
      const { data } = await getCategories('expense')
      setCategories(data || [])
      if (data && data.length > 0) {
        setSelectedCategoryId(data[0].id)
      }
    }
    loadCategories()
  }, [])

  useEffect(() => {
    fetchBudgetData()
  }, [currentMonth, currentYear])

  const handleSetBudget = async (e) => {
    e.preventDefault()
    if (!selectedCategoryId || !amountLimit || Number(amountLimit) <= 0) {
      alert('Vui lòng chọn danh mục và nhập hạn mức hợp lệ')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await setBudget({
        category_id: selectedCategoryId,
        month: Number(currentMonth),
        year: Number(currentYear),
        amount_limit: Number(amountLimit)
      })

      if (error) throw error

      setShowModal(false)
      setAmountLimit('')
      await fetchBudgetData()
    } catch (err) {
      alert('Lỗi lưu ngân sách: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteBudget = async (budgetId) => {
    if (!window.confirm('Bạn có muốn xóa hạn mức ngân sách của danh mục này?')) return

    try {
      const { error } = await deleteBudget(budgetId)
      if (error) throw error
      await fetchBudgetData()
    } catch (err) {
      alert('Lỗi xóa ngân sách: ' + err.message)
    }
  }

  const overallPercentage = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Kiểm soát hạn mức"
        title="Ngân sách Chi tiêu Tháng"
        description="Đặt hạn mức chi tiêu cho từng danh mục và theo dõi tiến độ qua 3 mức: An toàn (<80%), Sắp vượt (80-99%) và Đã vượt (>=100%)."
        actions={
          <div className="flex items-center gap-2">
            {/* Month picker */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200/80 shadow-2xs text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(Number(e.target.value))}
                className="bg-transparent font-semibold text-slate-700 outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-soft-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Đặt ngân sách</span>
            </button>
          </div>
        }
      />

      {/* Overview Progress Card */}
      <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 border border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                Tổng hạn mức tháng {currentMonth}/{currentYear}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900">
                  {formatCurrency(totalSpent)}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  / {formatCurrency(totalBudget)}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                overallPercentage >= 100 
                  ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                  : overallPercentage >= 80 
                  ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {overallPercentage >= 100 ? (
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                ) : overallPercentage >= 80 ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>Đã dùng {overallPercentage}%</span>
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overallPercentage >= 100 ? 'bg-rose-500' : overallPercentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Category Budgets Grid */}
      <div className="space-y-4">
        <h3 className="font-display font-bold text-slate-900 text-sm uppercase tracking-wider pl-1">
          Tiến độ theo từng Danh mục
        </h3>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto mb-2" />
            <span>Đang tính toán tiến độ ngân sách...</span>
          </div>
        ) : budgets.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
            Chưa có danh mục nào được đặt ngân sách cho Tháng {currentMonth}/{currentYear}. Nhấn "Đặt ngân sách" để thiết lập!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.map((b) => (
              <div
                key={b.id}
                className="rounded-[2rem] bg-white/70 p-2 shadow-soft-sm ring-1 ring-slate-900/5 hover:shadow-soft-md transition-shadow"
              >
                <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 border border-slate-100 flex flex-col justify-between h-full">
                  
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: b.category?.color || '#3B82F6' }}
                      />
                      <h4 className="font-display font-bold text-sm text-slate-900">
                        {b.category?.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        b.status === 'exceeded'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : b.status === 'warning'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {b.status === 'exceeded' ? 'Đã vượt' : b.status === 'warning' ? 'Sắp vượt' : 'An toàn'} ({b.actual_percentage}%)
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeleteBudget(b.id)}
                        className="text-slate-300 hover:text-rose-600 transition-colors"
                        title="Xóa ngân sách"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Đã chi: <strong>{formatCurrency(b.spent_amount)}</strong></span>
                      <span className="text-slate-500">Hạn mức: <strong>{formatCurrency(b.budget_amount)}</strong></span>
                    </div>

                    {/* Category bar */}
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          b.status === 'exceeded' ? 'bg-rose-500' : b.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${b.percentage}%` }}
                      />
                    </div>

                    <div className="text-[11px] text-right font-medium text-slate-400">
                      {b.remaining_amount >= 0 ? (
                        <span>Còn lại: <strong className="text-emerald-600">{formatCurrency(b.remaining_amount)}</strong></span>
                      ) : (
                        <span>Vượt mức: <strong className="text-rose-600">{formatCurrency(Math.abs(b.remaining_amount))}</strong></span>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Set Budget Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">
                Đặt Ngân Sách Tháng {currentMonth}/{currentYear}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSetBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Danh mục chi tiêu
                </label>
                <select
                  required
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Hạn mức tối đa trong tháng (VNĐ)
                </label>
                <input
                  type="number"
                  required
                  min="10000"
                  step="50000"
                  value={amountLimit}
                  onChange={(e) => setAmountLimit(e.target.value)}
                  placeholder="VD: 3000000"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm font-display font-bold text-slate-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  <span>Lưu hạn mức</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
export default BudgetPage
