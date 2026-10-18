import React from 'react'

/**
 * Reusable PageHeader component tuân thủ chuẩn Typography và Spacing Awwwards-tier
 */
export const PageHeader = ({
  eyebrow = '',
  title = '',
  description = '',
  actions = null
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        {eyebrow && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/5 text-slate-700 text-[10px] font-semibold tracking-wider uppercase mb-1.5 border border-slate-200/60">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {actions}
        </div>
      )}
    </div>
  )
}
