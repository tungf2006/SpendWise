import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { getCategories, createCategory, deleteCategory } from '@/services/categoryService'
import { Tag, Plus, Trash2, X, Loader2, Sparkles, AlertCircle } from 'lucide-react'

/**
 * Trang Quản lý Danh mục (CategoryPage)
 * Phụ trách: TV3 (Nguyễn Vũ Tấn Huy) - Nhóm chức năng CAT (UC10 - UC11)
 */
export const CategoryPage = () => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Add category state
  const [name, setName] = useState('')
  const [type, setType] = useState('expense')
  const [keywords, setKeywords] = useState('')
  const [color, setColor] = useState('#EF4444')

  const fetchCategoriesList = async () => {
    try {
      setLoading(true)
      const { data } = await getCategories()
      setCategories(data || [])
    } catch (err) {
      console.error('Lỗi khi tải danh mục:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategoriesList()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      const { error } = await createCategory({
        name,
        type,
        keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        color
      })

      if (error) throw error

      setShowAddModal(false)
      setName('')
      setKeywords('')
      await fetchCategoriesList()
    } catch (err) {
      alert('Lỗi tạo danh mục: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa danh mục tùy chỉnh này?')) return

    try {
      const { error } = await deleteCategory(id)
      if (error) throw error
      await fetchCategoriesList()
    } catch (err) {
      alert('Lỗi khi xóa danh mục: ' + err.message)
    }
  }

  const systemCategories = categories.filter(c => !c.user_id)
  const customCategories = categories.filter(c => !!c.user_id)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phân loại thu chi"
        title="Quản lý Danh mục"
        description="Xem danh mục chuẩn hệ thống và tự tạo thêm danh mục tùy chỉnh kèm từ khóa phục vụ tính năng Nhập nhanh bằng câu tự nhiên."
        actions={
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-soft-sm transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm danh mục riêng</span>
          </button>
        }
      />

      {/* System Default Categories */}
      <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-brand-600" />
            <h3 className="font-display font-bold text-sm text-slate-900 uppercase tracking-wider">
              Danh mục Hệ thống (Mặc định)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {systemCategories.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display font-bold text-xs text-slate-900">{c.name}</span>
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                </div>
                <div className="text-[10px] text-slate-400">
                  <span>Loại: {c.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}</span>
                </div>
                {c.keywords && c.keywords.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200/50 flex flex-wrap gap-1">
                    {c.keywords.slice(0, 4).map((kw, i) => (
                      <span key={i} className="text-[9px] bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/70">
                        {kw}
                      </span>
                    ))}
                    {c.keywords.length > 4 && (
                      <span className="text-[9px] text-slate-400">+{c.keywords.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Custom Categories */}
      <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="font-display font-bold text-sm text-slate-900 uppercase tracking-wider">
              Danh mục Bạn tự tạo
            </h3>
          </div>

          {customCategories.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Bạn chưa tạo danh mục tùy chỉnh nào. Nhấn "Thêm danh mục riêng" để tạo danh mục mới theo nhu cầu của bạn!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {customCategories.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display font-bold text-xs text-slate-900">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                      title="Xóa danh mục"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    <span>Loại: {c.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Custom Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Thêm Danh Mục Tùy Chỉnh</h3>
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
                  Tên danh mục
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Nuôi thú cưng, Đầu tư chứng khoán..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Loại danh mục
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
                  Từ khóa gợi ý (Cách nhau bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="VD: meo, cho, hat meo, pate, thu y..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900"
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
                  <span>Tạo danh mục</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
export default CategoryPage
