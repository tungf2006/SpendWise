import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, Bell, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export const Navbar = ({
  dbStatus = { checking: false, connected: true },
  onOpenAiChat = () => {}
}) => {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Phan Thanh Tùng'
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
        <Link to="/" className="flex items-center gap-3 group">
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
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/70 p-1 rounded-full border border-slate-200/50">
          <Link
            to="/"
            className="px-3.5 py-1 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-all"
          >
            Tổng quan
          </Link>
          <Link
            to="/transactions"
            className="px-3.5 py-1 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-all"
          >
            Giao dịch
          </Link>
          <Link
            to="/wallets"
            className="px-3.5 py-1 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-all"
          >
            Ví tiền
          </Link>
          <Link
            to="/budgets"
            className="px-3.5 py-1 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-all"
          >
            Ngân sách
          </Link>
          <Link
            to="/reports"
            className="px-3.5 py-1 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-all"
          >
            Báo cáo
          </Link>
          <Link
            to="/goals"
            className="px-3.5 py-1 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-all"
          >
            Tiết kiệm
          </Link>
          <Link
            to="/recurring"
            className="px-3.5 py-1 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-all"
          >
            Định kỳ
          </Link>
          <Link
            to="/bill-split"
            className="px-3.5 py-1 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-all"
          >
            VietQR
          </Link>
        </nav>

        {/* Database Status Indicator & Action Pills */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Supabase status badge */}
          <div className={`hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${
            dbStatus.checking
              ? 'bg-slate-100 border-slate-200 text-slate-600'
              : dbStatus.connected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              dbStatus.checking ? 'bg-slate-400 animate-pulse' : dbStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}></span>
            <span>{dbStatus.connected ? 'Supabase Connected' : 'DB Disconnected'}</span>
          </div>

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

          {/* User Profile Pill */}
          <Link
            to="/profile"
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/60 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              {initials}
            </div>
            <span className="hidden lg:inline text-xs font-semibold text-slate-800 max-w-[120px] truncate">
              {displayName}
            </span>
          </Link>
        </div>

      </div>
    </header>
  )
}
