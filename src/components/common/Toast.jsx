import React, { useEffect } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

/**
 * Shared Toast Notification component tuân thủ Double-Bezel & Apple-tier UI
 */
export default function Toast({
  show = false,
  message = '',
  type = 'success',
  onClose,
  duration = 3000
}) {
  useEffect(() => {
    if (!show || !onClose || duration <= 0) return

    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [show, duration, onClose])

  if (!show || !message) return null

  const typeConfig = {
    success: {
      bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-950 dark:text-emerald-200',
      iconBg: 'bg-emerald-500 text-white',
      Icon: CheckCircle2
    },
    error: {
      bg: 'bg-rose-500/10 border-rose-500/20 text-rose-950 dark:text-rose-200',
      iconBg: 'bg-rose-500 text-white',
      Icon: AlertCircle
    },
    warning: {
      bg: 'bg-amber-500/10 border-amber-500/20 text-amber-950 dark:text-amber-200',
      iconBg: 'bg-amber-500 text-white',
      Icon: AlertTriangle
    },
    info: {
      bg: 'bg-blue-500/10 border-blue-500/20 text-blue-950 dark:text-blue-200',
      iconBg: 'bg-blue-500 text-white',
      Icon: Info
    }
  }

  const { bg, iconBg, Icon } = typeConfig[type] || typeConfig.info

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 lg:bottom-6 right-4 sm:right-6 left-4 sm:left-auto z-50 max-w-md animate-slide-up pointer-events-auto"
    >
      <div className={`p-1 rounded-2xl bg-white/85 dark:bg-slate-900/90 backdrop-blur-xl shadow-xl shadow-slate-900/10 border ${bg} transition-all`}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/75 dark:bg-slate-900/95">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug break-words pr-2">
            {message}
          </p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto w-6 h-6 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              title="Đóng"
              aria-label="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export { Toast }
