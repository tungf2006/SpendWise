import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Moon, Sparkles, Sun } from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useAuth } from '@/context/useAuth'

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

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem('spendwise_theme')
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
}

export const Navbar = ({
  dbStatus = { checking: false, connected: true },
  onOpenAiChat = () => {}
}) => {
  const { user, profile } = useAuth()
  const location = useLocation()
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    window.localStorage.setItem('spendwise_theme', theme)
  }, [theme])

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Người dùng'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || 'SW'

  return (
    <header className="sticky top-4 z-40 px-4 mb-4">
      <div className="max-w-6xl mx-auto rounded-full bg-white/80 backdrop-blur-xl border border-white/80 shadow-soft-md ring-1 ring-slate-900/5 px-4 sm:px-6 py-2.5 flex items-center justify-between transition-all duration-300">
        
        {/* Brand Logo & Name */}
        <Link to="/" className="flex items-center gap-3 group shrink-0">
          <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white shadow-sm ring-1 ring-white/20 transition-transform group-hover:scale-105">
            <span className="font-display font-black text-sm tracking-tighter text-transparent bg-clip-text bg-gradient-to-tr from-brand-200 to-emerald-300">
              SW
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-base tracking-tight text-slate-900">
                Spend<span className="text-brand-600 font-extrabold">Wise</span>
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                v1.0 Pro
              </span>
            </div>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav aria-label="Điều hướng chính" className="hidden lg:flex items-center gap-0.5 bg-slate-100/70 p-1 rounded-full border border-slate-200/50">
          {NAV_LINKS.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)

            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Database Status Indicator & Action Pills */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Supabase status badge */}
          <div className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
            dbStatus.checking
              ? 'bg-slate-100 border-slate-200 text-slate-600'
              : dbStatus.connected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              dbStatus.checking ? 'bg-slate-400 animate-pulse' : dbStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}></span>
            <span>{dbStatus.connected ? 'Connected' : 'Disconnected'}</span>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200/60 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Quick AI Assistant Pill */}
          <button 
            type="button"
            onClick={onOpenAiChat}
            className="group flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer"
          >
            <span className="text-xs font-medium tracking-tight">Gemini AI</span>
            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" strokeWidth={1.5} />
            </span>
          </button>

          <NotificationBell />

          {/* User Profile Pill */}
          <Link
            to="/profile"
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/60 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              {initials}
            </div>
            <span className="hidden 2xl:inline text-xs font-semibold text-slate-800 max-w-[110px] truncate">
              {displayName}
            </span>
          </Link>
        </div>

      </div>
    </header>
  )
}
