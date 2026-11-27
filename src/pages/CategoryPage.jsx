import React, { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { Toast } from '@/components/common/Toast'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/services/categoryService'
import { Tag, Plus, Trash2, Pencil, X, Loader2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react'

const COLOR_PALETTE = [
  '#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#6366F1',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#64748B'
]

/**
 * Trang Quản lý Danh mục (CategoryPage)
 * Phụ trách: Nhóm phát triển SpendWise (Leader Tùng & TV3 Quốc) - Nhóm chức năng CAT (UC10 - UC11)
 */
export const CategoryPage = () => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete dialog state
  const [deleteTargetCategory, setDeleteTargetCategory] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Toast state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  // Add category state
  const [name, setName] = useState('')
  const [type, setType] = useState('expense')
  const [keywords, setKeywords] = useState('')
  const [color, setColor] = useState('#10B981')

  // Edit category state
  const [editingCategory, setEditingCategory] = useState(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('expense')
  const [editKeywords, setEditKeywords] = useState('')
  const [editColor, setEditColor] = useState('#10B981')

  const fetchCategoriesList = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: fetchErr } = await getCategories()
      if (fetchErr) throw fetchErr
      setCategories(data || [])
    } catch (err) {
      console.error('Lỗi khi tải danh mục:', err)
      setError(err?.message || 'Không thể tải danh sách danh mục')
      setToast({ show: true, message: 'Lỗi khi tải danh mục: ' + (err?.message || 'Lỗi không xác định'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadInitial() {
      try {
        const { data, error: fetchErr } = await getCategories()
        if (cancelled) return
        if (fetchErr) throw fetchErr
        setCategories(data || [])
      } catch (err) {
        if (cancelled) return
        console.error('Lỗi khi tải danh mục:', err)
        setError(err?.message || 'Không thể tải danh sách danh mục')
        setToast({ show: true, message: 'Lỗi khi tải danh mục: ' + (err?.message || 'Lỗi không xác định'), type: 'error' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadInitial()
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
        setEditingCategory(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAddModal, showEditModal, isSubmitting])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setToast({ show: true, message: 'Tên danh mục không được để trống', type: 'warning' })
      return
    }

    setIsSubmitting(true)
    try {
      const { error: createErr } = await createCategory({
        name: name.trim(),
        type,
        keywords,
        color
      })

      if (createErr) throw createErr

      setShowAddModal(false)
      setName('')
      setKeywords('')
      setColor('#10B981')
      await fetchCategoriesList()
      setToast({ show: true, message: 'Tạo danh mục mới thành công!', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'Lỗi tạo danh mục: ' + err.message, type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEdit = (category) => {
    setEditingCategory(category)
    setEditName(category.name || '')
    setEditType(category.type || 'expense')
    setEditKeywords(Array.isArray(category.keywords) ? category.keywords.join(', ') : '')
    setEditColor(category.color || '#10B981')
    setShowEditModal(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!editName.trim()) {
      setToast({ show: true, message: 'Tên danh mục không được để trống', type: 'warning' })
      return
    }
    if (!editingCategory) return

    setIsSubmitting(true)
    try {
      const { error: updateErr } = await updateCategory(editingCategory.id, {
        name: editName.trim(),
        type: editType,
        keywords: editKeywords,
        color: editColor
      })

      if (updateErr) throw updateErr

      setShowEditModal(false)
      setEditingCategory(null)
      await fetchCategoriesList()
      setToast({ show: true, message: 'Cập nhật danh mục thành công!', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'Lỗi cập nhật danh mục: ' + err.message, type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTargetCategory) return
    setIsDeleting(true)
    try {
      const { error: delErr } = await deleteCategory(deleteTargetCategory.id)
      if (delErr) {
        if (delErr.code === '23503' || String(delErr.message).includes('recurring_rules')) {
          throw new Error('Không thể xóa danh mục đang được sử dụng trong giao dịch định kỳ. Vui lòng cập nhật quy tắc định kỳ trước.')
        }
        throw delErr
      }

      await fetchCategoriesList()
      setToast({ show: true, message: 'Xóa danh mục thành công!', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: err.message || 'Lỗi khi xóa danh mục', type: 'error' })
    } finally {
      setIsDeleting(false)
      setDeleteTargetCategory(null)
    }
  }

  const systemCategories = categories.filter((c) => !c.user_id)
  const customCategories = categories.filter((c) => Boolean(c.user_id))

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
            className="px-4 py-2 rounded-full bg-slate-900 dark:bg-brand-600 hover:bg-slate-800 dark:hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-soft-sm transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm danh mục riêng</span>
          </button>
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
            onClick={fetchCategoriesList}
            className="px-3 py-1 rounded-full bg-white dark:bg-rose-900/50 text-xs font-semibold text-rose-700 dark:text-rose-200 border border-rose-200 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/80 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-6">
          <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5 dark:ring-white/10">
            <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 border border-slate-100">
              <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 animate-pulse space-y-2.5">
                    <div className="flex justify-between items-center">
                      <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700" />
                    </div>
                    <div className="h-2.5 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* System Default Categories */}
          <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5 dark:ring-white/10">
            <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 border border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-4 h-4 text-brand-600 dark:text-brand-500" />
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
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: c.color || '#10B981' }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400">
                      <span>Loại: {c.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}</span>
                    </div>
                    {c.keywords && c.keywords.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/60 flex flex-wrap gap-1">
                        {c.keywords.slice(0, 4).map((kw, i) => (
                          <span key={`${c.id}-${kw}-${i}`} className="text-[9px] bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200/70 dark:border-slate-700">
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
          <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5 dark:ring-white/10">
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
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: c.color || '#10B981' }}
                          />
                          <span className="font-display font-bold text-xs text-slate-900">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            className="w-6 h-6 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center justify-center transition-colors cursor-pointer"
                            title="Sửa danh mục"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetCategory(c)}
                            className="w-6 h-6 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                            title="Xóa danh mục"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        <span>Loại: {c.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}</span>
                      </div>
                      {c.keywords && c.keywords.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/60 flex flex-wrap gap-1">
                          {c.keywords.slice(0, 4).map((kw, i) => (
                            <span key={`${c.id}-${kw}-${i}`} className="text-[9px] bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200/70 dark:border-slate-700">
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
              )}
            </div>
          </div>
        </>
      )}

      {/* Add Custom Category Modal */}
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
              <h3 className="font-display font-bold text-base text-slate-900">Thêm Danh Mục Tùy Chỉnh</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer"
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
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Loại danh mục
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value="expense">Khoản Chi (Expense)</option>
                  <option value="income">Khoản Thu (Income)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Màu đại diện
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        color === c ? 'scale-110 border-slate-900 dark:border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
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
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100"
                />
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
                  <span>Tạo danh mục</span>
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Custom Category Modal (UC11) */}
      {showEditModal && editingCategory && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            if (!isSubmitting) {
              setShowEditModal(false)
              setEditingCategory(null)
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white/80 dark:bg-slate-900/95 p-1.5 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 animate-modal-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111827] p-6 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Sửa Danh Mục Tùy Chỉnh</h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false)
                  setEditingCategory(null)
                }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tên danh mục
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="VD: Nuôi thú cưng..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Loại danh mục
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value="expense">Khoản Chi (Expense)</option>
                  <option value="income">Khoản Thu (Income)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Màu đại diện
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        editColor === c ? 'scale-110 border-slate-900 dark:border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Từ khóa gợi ý (Cách nhau bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  value={editKeywords}
                  onChange={(e) => setEditKeywords(e.target.value)}
                  placeholder="VD: meo, cho, hat meo, pate..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingCategory(null)
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

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTargetCategory)}
        title="Xóa danh mục tùy chỉnh"
        message={
          deleteTargetCategory
            ? `Bạn có chắc chắn muốn xóa danh mục "${deleteTargetCategory.name}"? Các giao dịch thuộc danh mục này sẽ được chuyển thành Không phân loại.`
            : 'Bạn có chắc chắn muốn xóa danh mục này?'
        }
        confirmText="Xóa danh mục"
        cancelText="Giữ lại"
        confirmVariant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetCategory(null)}
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
export default CategoryPage
