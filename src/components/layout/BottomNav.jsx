import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, ReceiptText, Sparkles, PieChart, WalletCards } from 'lucide-react'

export const BottomNav = ({ onOpenQuickEntry = () => {} }) => {
  const location = useLocation()

  const tabs = [
    { path: '/', label: 'Tổng quan', icon: LayoutDashboard },
    { path: '/transactions', label: 'Giao dịch', icon: ReceiptText },
    { id: 'quick', label: 'Nhập nhanh', icon: Sparkles, isPrimary: true },
    { path: '/budgets', label: 'Ngân sách', icon: PieChart },
    { path: '/wallets', label: 'Ví tiền', icon: WalletCards },
  ]

  return (
    <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40">
      <div className="bg-slate-900/90 text-white backdrop-blur-2xl border border-white/10 rounded-full px-3 py-2 shadow-soft-xl flex items-center justify-around">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon

          if (tab.isPrimary) {
            return (
              <button
                key={idx}
                type="button"
                onClick={onOpenQuickEntry}
                className="flex flex-col items-center -my-3 group active:scale-95 transition-transform cursor-pointer"
                title={tab.label}
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center shadow-glow-brand ring-4 ring-slate-900">
                  <Icon className="w-5 h-5 text-amber-200" strokeWidth={1.75} />
                </div>
              </button>
            )
          }

          const isActive = location.pathname === tab.path

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center py-1 px-3 rounded-full transition-all duration-300 ${
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" strokeWidth={isActive ? 2 : 1.5} />
              <span className={`text-[10px] tracking-tight ${isActive ? 'font-semibold text-brand-300' : 'font-normal'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
