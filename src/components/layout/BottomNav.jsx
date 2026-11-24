import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BarChart3,
  LayoutDashboard,
  Menu,
  PieChart,
  QrCode,
  ReceiptText,
  Repeat,
  Sparkles,
  Tags,
  Target,
  User,
  WalletCards,
  X
} from 'lucide-react'

const MORE_ROUTES = [
  { path: '/categories', label: 'Danh mục', icon: Tags },
  { path: '/reports', label: 'Báo cáo', icon: BarChart3 },
  { path: '/goals', label: 'Tiết kiệm', icon: Target },
  { path: '/recurring', label: 'Định kỳ', icon: Repeat },
  { path: '/bill-split', label: 'Chia tiền QR', icon: QrCode },
  { path: '/profile', label: 'Hồ sơ cá nhân', icon: User },
]

export const BottomNav = ({ onOpenQuickEntry = () => {} }) => {
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  const tabs = [
    { path: '/', label: 'Tổng quan', icon: LayoutDashboard },
    { path: '/transactions', label: 'Giao dịch', icon: ReceiptText },
    { id: 'quick', label: 'Nhập nhanh', icon: Sparkles, isPrimary: true },
    { path: '/budgets', label: 'Ngân sách', icon: PieChart },
    { path: '/wallets', label: 'Ví tiền', icon: WalletCards },
  ]

  const isMoreActive = MORE_ROUTES.some((item) => location.pathname.startsWith(item.path))

  return (
    <>
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-end justify-center p-3 pb-24"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu mở rộng"
            className="w-full max-w-md rounded-[2rem] bg-white/95 p-1.5 shadow-2xl ring-1 ring-slate-900/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-0.375rem)] bg-white p-4 border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="font-display font-bold text-sm text-slate-900">
                  Tất cả chức năng
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Đóng menu"
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MORE_ROUTES.map((item) => {
                  const Icon = item.icon
                  const active = location.pathname.startsWith(item.path)
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border text-center transition-all ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200/70 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[11px] font-semibold leading-tight">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <nav aria-label="Điều hướng di động" className="lg:hidden fixed bottom-3 left-3 right-3 z-40">
        <div className="bg-slate-900/95 text-white backdrop-blur-2xl border border-white/10 rounded-full px-2 py-2 shadow-soft-xl flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon

            if (tab.isPrimary) {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false)
                    onOpenQuickEntry()
                  }}
                  className="flex flex-col items-center -my-3 group active:scale-95 transition-transform cursor-pointer"
                  title={tab.label}
                  aria-label={tab.label}
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center shadow-glow-brand ring-4 ring-slate-900">
                    <Icon className="w-5 h-5 text-amber-200" strokeWidth={1.75} />
                  </div>
                </button>
              )
            }

            const isActive = tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path)

            return (
              <Link
                key={tab.path}
                to={tab.path}
                onClick={() => setDrawerOpen(false)}
                className={`flex flex-col items-center py-1 px-2 rounded-full transition-all duration-300 ${
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

          <button
            type="button"
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-expanded={drawerOpen}
            className={`flex flex-col items-center py-1 px-2 rounded-full transition-all duration-300 cursor-pointer ${
              drawerOpen || isMoreActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Menu className="w-4 h-4 mb-0.5" strokeWidth={drawerOpen || isMoreActive ? 2 : 1.5} />
            <span className={`text-[10px] tracking-tight ${drawerOpen || isMoreActive ? 'font-semibold text-brand-300' : 'font-normal'}`}>
              Thêm
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
