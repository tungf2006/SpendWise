import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Moon, Sparkles, Sun } from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useAuth } from '@/context/useAuth'
import { useTheme } from '@/context/useTheme'
import { getUserInitials } from '@/components/common/userInitials'

const NAV_LINKS = [
  { path: '/', label: 'Tổng quan' },
  { path: '/transactions', label: 'Giao dịch' },
  { path: '/wallets', label: 'Ví tiền' },
  { path: '/categories', label: 'Danh mục' },
  { path: '/budgets', label: 'Ngân sách' },
  { path: '/reports', label: 'Báo cáo' },
  { path: '/goals', label: 'Tiết kiệm' },
  { path: '/recurring', label: 'Định kỳ' },
  { path: '/bill-split', label: 'VietQR' },
]

export const Navbar = ({
  dbStatus = { checking: false, connected: true },
  onOpenAiChat = () => {}
}) => {
  const { user, profile } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()

  const rawName = profile?.full_name || user?.user_metadata?.full_name || ''
  const displayName = rawName.trim() || user?.email?.split('@')[0] || 'Người dùng'
  const initials = getUserInitials(rawName, user?.email, 'SW')

  return (
    <header className="sticky top-4 z-40 px-4 mb-4">
      <div className="max-w-7xl mx-auto rounded-full bg-white/80 dark:bg-slate-900/85 backdrop-blur-xl border border-white/80 dark:border-slate-700/70 shadow-soft-md ring-1 ring-slate-900/5 dark:ring-white/10 px-3 lg:px-4 xl:px-5 py-2 flex items-center justify-between gap-1.5 xl:gap-2 transition-all duration-300">
        
        {/* Brand Logo & Name */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-brand-600 flex items-center justify-center text-white shadow-sm ring-1 ring-white/20 transition-transform group-hover:scale-105">
            <span className="font-display font-black text-sm tracking-tighter text-transparent bg-clip-text bg-gradient-to-tr from-brand-200 to-emerald-300">
              SW
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-slate-100">
                Spend<span className="text-brand-600 dark:text-brand-500 font-extrabold">Wise</span>
              </span>
              <span className="hidden xl:inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                v1.0 Pro
              </span>
            </div>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav aria-label="Điều hướng chính" className="hidden lg:flex items-center gap-0.5 bg-slate-100/70 dark:bg-slate-800/80 p-1 rounded-full border border-slate-200/50 dark:border-slate-700/70 min-w-0 overflow-x-auto scrollbar-none">
          {NAV_LINKS.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)

            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`px-1.5 xl:px-2 2xl:px-2.5 py-1 rounded-full text-[11px] xl:text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-slate-900 dark:bg-brand-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/90 dark:hover:bg-slate-700/80'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Database Status Indicator & Action Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Supabase status badge */}
          <div className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap ${
            dbStatus.checking
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              : dbStatus.connected
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              dbStatus.checking ? 'bg-slate-400 animate-pulse' : dbStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}></span>
            <span>{dbStatus.connected ? 'Connected' : 'Disconnected'}</span>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            title={isDark ? 'Giao diện sáng' : 'Giao diện tối'}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Quick AI Assistant Pill */}
          <button 
            type="button"
            onClick={onOpenAiChat}
            className="group flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-slate-900 dark:bg-brand-600 text-white hover:bg-slate-800 dark:hover:bg-brand-500 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer whitespace-nowrap"
          >
            <span className="text-[11px] xl:text-xs font-medium tracking-tight">Gemini AI</span>
            <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" strokeWidth={1.5} />
            </span>
          </button>

          <NotificationBell />

          {/* User Profile Pill */}
          <Link
            to="/profile"
            aria-label={`Hồ sơ cá nhân (${displayName})`}
            className="flex items-center gap-2 p-1 2xl:pl-1 2xl:pr-2.5 rounded-full bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
              {initials}
            </div>
            <span className="hidden 2xl:inline text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[110px] truncate">
              {displayName}
            </span>
          </Link>
        </div>

      </div>
    </header>
  )
}
