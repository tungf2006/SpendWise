import React from 'react'
import { LayoutDashboard, ReceiptText, PlusCircle, PieChart, WalletCards } from 'lucide-react'

export const BottomNav = ({ activeTab = 'dash', onTabChange = () => {} }) => {
  const tabs = [
    { id: 'dash', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'txns', label: 'Giao dịch', icon: ReceiptText },
    { id: 'quick', label: 'Nhập nhanh', icon: PlusCircle, isPrimary: true },
    { id: 'budget', label: 'Ngân sách', icon: PieChart },
    { id: 'wallets', label: 'Ví tiền', icon: WalletCards },
  ]

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-slate-200 px-2 py-1.5 flex items-center justify-around">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        if (tab.isPrimary) {
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center -mt-5"
            >
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-transform">
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-semibold text-blue-600 mt-1">{tab.label}</span>
            </button>
          )
        }

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center py-1 px-3 rounded-lg transition-colors ${
              isActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
