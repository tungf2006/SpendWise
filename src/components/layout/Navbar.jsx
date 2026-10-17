import React from 'react'
import { Wallet, Bell, Sparkles, User } from 'lucide-react'

export const Navbar = () => {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-slate-900">
              Spend<span className="text-blue-600">Wise</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">Quản lý chi tiêu thông minh</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            title="Trợ lý AI"
            className="p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Trợ lý AI</span>
          </button>
          <button 
            title="Thông báo"
            className="p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-xs font-semibold">
            PT
          </div>
        </div>
      </div>
    </header>
  )
}
