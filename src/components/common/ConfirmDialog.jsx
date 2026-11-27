import React, { useEffect } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'

/**
 * Shared Confirm Dialog (Modal xác nhận hành động nguy hiểm)
 * Thiết kế Double-Bezel tuân thủ quy chuẩn GEMINI.md
 */
export default function ConfirmDialog({
  isOpen = false,
  title = 'Xác nhận hành động',
  message = 'Bạn có chắc chắn muốn thực hiện hành động này không?',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  isLoading = false
}) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading && onCancel) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isLoading, onCancel])

  if (!isOpen) return null

  const variantStyles = {
    danger: {
      iconBg: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 border-rose-100 dark:border-rose-800/60',
      buttonBg: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
    },
    primary: {
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800/60',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
    },
    warning: {
      iconBg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300 border-amber-100 dark:border-amber-800/60',
      buttonBg: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
    }
  }

  const { iconBg, buttonBg } = variantStyles[confirmVariant] || variantStyles.danger

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      onClick={() => {
        if (!isLoading && onCancel) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-1.5 shadow-2xl border border-slate-100 dark:border-slate-800 animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-[calc(1.5rem-0.375rem)] bg-white dark:bg-[#111827] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${iconBg}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
                title="Đóng"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100 mb-2">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            {message}
          </p>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${buttonBg}`}
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export { ConfirmDialog }
