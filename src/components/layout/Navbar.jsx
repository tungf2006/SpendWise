import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Sparkles,
  Menu,
  X,
  LayoutDashboard,
  ReceiptText,
  WalletCards,
  Tags,
  PieChart,
  BarChart3,
  Target,
  Repeat,
  QrCode
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const NAV_ITEMS = [
  { path: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { path: '/transactions', label: 'Giao dịch', icon: ReceiptText },
  { path: '/wallets', label: 'Ví tiền', icon: WalletCards },
  { path: '/categories', label: 'Danh mục', icon: Tags },
  { path: '/budgets', label: 'Ngân sách', icon: PieChart },
  { path: '/reports', label: 'Báo cáo', icon: BarChart3 },
  { path: '/goals', label: 'Tiết kiệm', icon: Target },
  { path: '/recurring', label: 'Định kỳ', icon: Repeat },
  { path: '/bill-split', label: 'VietQR', icon: QrCode },
]

export const Navbar = ({
  dbStatus = { checking: false, connected: true },
  onOpenAiChat = () => {}
}) => {
  const { user, profile } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Phan Thanh Tùng'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'SW'

  // Đóng menu drawer khi nhấn phím Escape
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const isActivePath = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <header className="sticky top-3 sm:top-4 z-40 px-3 sm:px-4 mb-4">
      <div className="max-w-7xl mx-auto rounded-full bg-white/85 backdrop-blur-xl border border-white/80 shadow-soft-md ring-1 ring-slate-900/5 px-3 sm:px-5 py-2 flex items-center justify-between gap-2 transition-all duration-300">

        {/* Brand Logo & Name */}
        <Link
          to="/"
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-2.5 group shrink-0"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-900 flex items-center justify-center text-white shadow-sm ring-1 ring-white/20 transition-transform group-hover:scale-105 shrink-0">
            <span className="font-display font-black text-xs sm:text-sm tracking-tighter text-transparent bg-clip-text bg-gradient-to-tr from-brand-200 to-emerald-300">
              SW
            </span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-display font-bold text-sm sm:text-base tracking-tight text-slate-900">
              Spend<span className="text-brand-600 font-extrabold">Wise</span>
            </span>
            <span className="hidden 2xl:inline-block px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              v1.0 Pro
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links (>= 1280px / xl) */}
        <nav
          aria-label="Điều hướng chính"
          className="hidden xl:flex items-center gap-0.5 bg-slate-100/75 p-1 rounded-full border border-slate-200/60 shrink-0"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Action Pills & Responsive Menu Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Supabase status badge (only on very wide screens >= 1536px) */}
          <div
            className={`hidden 2xl:flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap ${
              dbStatus.checking
                ? 'bg-slate-100 border-slate-200 text-slate-600'
                : dbStatus.connected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                dbStatus.checking
                  ? 'bg-slate-400 animate-pulse'
                  : dbStatus.connected
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-rose-500'
              }`}
            />
            <span>{dbStatus.connected ? 'Supabase Connected' : 'DB Disconnected'}</span>
          </div>

          {/* Quick AI Assistant Pill */}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              onOpenAiChat()
            }}
            className="group flex items-center gap-1.5 sm:gap-2 pl-2.5 sm:pl-3 pr-1 sm:pr-1.5 py-1 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <span className="text-[11px] sm:text-xs font-medium tracking-tight">Gemini AI</span>
            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" strokeWidth={1.5} />
            </span>
          </button>

          {/* User Profile Pill */}
          <Link
            to="/profile"
            onClick={() => setMenuOpen(false)}
            title={displayName}
            className="flex items-center gap-2 p-1 2xl:pl-1 2xl:pr-2.5 rounded-full bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/60 transition-colors shrink-0"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
              {initials}
            </div>
            <span className="hidden 2xl:inline text-xs font-semibold text-slate-800 max-w-[110px] truncate">
              {displayName}
            </span>
          </Link>

          {/* Mobile / Tablet / Small Laptop Menu Button (< 1280px) */}
          <button
            type="button"
            aria-label={menuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="xl:hidden w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center border border-slate-200/70 transition-colors cursor-pointer shrink-0"
          >
            {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Responsive Navigation Drawer Panel (< 1280px) */}
      {menuOpen && (
        <>
          <div
            className="xl:hidden fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] -z-10"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="xl:hidden max-w-7xl mx-auto mt-2 rounded-[1.75rem] bg-white/95 backdrop-blur-2xl p-1.5 shadow-soft-xl ring-1 ring-slate-900/10">
            <div className="rounded-[calc(1.75rem-0.375rem)] bg-white border border-slate-100 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Điều hướng toàn ứng dụng (9 mục)
                </span>
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap ${
                    dbStatus.checking
                      ? 'bg-slate-100 border-slate-200 text-slate-600'
                      : dbStatus.connected
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      dbStatus.checking
                        ? 'bg-slate-400 animate-pulse'
                        : dbStatus.connected
                          ? 'bg-emerald-500'
                          : 'bg-rose-500'
                    }`}
                  />
                  <span>{dbStatus.connected ? 'Supabase Online' : 'DB Offline'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon
                  const active = isActivePath(item.path)
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all whitespace-nowrap ${
                        active
                          ? 'bg-slate-900 text-white shadow-soft-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${active ? 'text-brand-300' : 'text-slate-500'}`}
                        strokeWidth={1.75}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  )
}
