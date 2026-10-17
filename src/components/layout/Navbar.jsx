import React from 'react'
import { Sparkles, Bell, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react'

export const Navbar = ({ dbStatus = { checking: false, connected: true } }) => {
  return (
    <header className="sticky top-4 z-40 px-4 mb-4">
      <div className="max-w-5xl mx-auto rounded-full bg-white/75 backdrop-blur-xl border border-white/80 shadow-soft-md ring-1 ring-slate-900/5 px-4 sm:px-6 py-2.5 flex items-center justify-between transition-all duration-300">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white shadow-sm ring-1 ring-white/20">
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
        </div>

        {/* Database Status Indicator & Action Pills */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Supabase status badge */}
          <div className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${
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
            className="group hidden sm:flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-all duration-300 active:scale-[0.98] shadow-sm"
          >
            <span className="text-xs font-medium tracking-tight">Gemini AI</span>
            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" strokeWidth={1.5} />
            </span>
          </button>

          {/* Notification Button */}
          <button 
            type="button" 
            aria-label="Thông báo"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 flex items-center justify-center transition-colors relative"
          >
            <Bell className="w-4 h-4" strokeWidth={1.5} />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
          </button>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-slate-100/80 border border-slate-200/60">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              PT
            </div>
            <span className="hidden lg:inline text-xs font-semibold text-slate-800">
              Phan Thanh Tùng
            </span>
          </div>
        </div>

      </div>
    </header>
  )
}
