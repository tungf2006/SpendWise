import React from 'react'
import { LayoutDashboard, ReceiptText, Sparkles, PieChart, WalletCards } from 'lucide-react'

export const BottomNav = ({ activeTab = 'dash', onTabChange = () => {} }) => {
  const tabs = [
    { id: 'dash', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'txns', label: 'Giao dịch', icon: ReceiptText },
    { id: 'quick', label: 'Nhập nhanh', icon: Sparkles, isPrimary: true },
    { id: 'budget', label: 'Ngân sách', icon: PieChart },
    { id: 'wallets', label: 'Ví tiền', icon: WalletCards },
  ]

  return (
    <nav className="sm:hidden fixed bottom-3 left-3 right-3 z-40">
      <div className="bg-slate-900/90 text-white backdrop-blur-2xl border border-white/10 rounded-full px-3 py-2 shadow-soft-xl flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          if (tab.isPrimary) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="flex flex-col items-center -my-3 group active:scale-95 transition-transform"
                title={tab.label}
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center shadow-glow-brand ring-4 ring-slate-900">
                  <Icon className="w-5 h-5 text-amber-200" strokeWidth={1.75} />
                </div>
              </button>
            )
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center py-1 px-3 rounded-full transition-all duration-300 ${
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" strokeWidth={isActive ? 2 : 1.5} />
              <span className={`text-[10px] tracking-tight ${isActive ? 'font-semibold text-brand-300' : 'font-normal'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
