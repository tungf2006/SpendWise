import React, { useState, useEffect } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { BottomNav } from '@/components/layout/BottomNav'
import { formatCurrency } from '@/utils/formatCurrency'
import { supabase } from '@/lib/supabaseClient'
import { 
  ShieldCheck, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Zap,
  Users
} from 'lucide-react'

export function App() {
  const [activeTab, setActiveTab] = useState('dash')
  const [dbStatus, setDbStatus] = useState({ checking: true, connected: false, message: '' })

  useEffect(() => {
    // Kiểm tra kết nối Supabase
    async function testConnection() {
      try {
        const { data, error } = await supabase.from('categories').select('count', { count: 'exact', head: true })
        if (error) throw error
        setDbStatus({
          checking: false,
          connected: true,
          message: 'Kết nối Supabase (SpendWise-db) thành công 100%! RLS đã sẵn sàng.'
        })
      } catch (err) {
        setDbStatus({
          checking: false,
          connected: false,
          message: `Lỗi kết nối: ${err.message || 'Không thể truy vấn Supabase'}`
        })
      }
    }
    testConnection()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 pb-20 sm:pb-8 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Banner Chào mừng Leader & Team */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl p-5 sm:p-6 text-white shadow-xl shadow-blue-500/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-blue-100 text-xs font-medium mb-2 backdrop-blur-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Khởi tạo dự án thành công • Leader Phan Thanh Tùng</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Chào mừng bạn đến với SpendWise</h2>
              <p className="text-sm text-blue-100/90 mt-1 max-w-2xl">
                Nền tảng quản lý chi tiêu cá nhân thông minh với Safe-to-spend, Nhập câu tự nhiên và Trợ lý AI.
              </p>
            </div>
            
            {/* Trạng thái DB */}
            <div className={`px-4 py-3 rounded-xl border text-xs flex items-center gap-2.5 backdrop-blur-md ${
              dbStatus.checking 
                ? 'bg-white/10 border-white/20 text-white' 
                : dbStatus.connected 
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100'
                  : 'bg-rose-500/20 border-rose-400/40 text-rose-100'
            }`}>
              {dbStatus.checking ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : dbStatus.connected ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
              )}
              <span className="font-medium">
                {dbStatus.checking ? 'Đang kiểm tra kết nối CSDL...' : dbStatus.message}
              </span>
            </div>
          </div>
        </div>

        {/* Thẻ chỉ số Safe-to-spend (Tính năng cốt lõi) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/15 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-semibold text-emerald-100 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Chỉ số Safe-to-spend hôm nay
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-medium text-white">
                    An toàn
                  </span>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">
                  {formatCurrency(245000)}
                </div>
                <p className="text-xs text-emerald-100/90 mt-1">
                  Số tiền tối đa bạn có thể tiêu hôm nay mà vẫn hoàn thành mục tiêu ngân sách tháng.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs text-emerald-100">
                <span>Ngân sách còn: <strong>{formatCurrency(3680000)}</strong></span>
                <span>Còn lại: <strong>15 ngày</strong></span>
              </div>
            </div>
          </div>

          {/* Tổng số dư ví */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Tổng số dư các ví</span>
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                {formatCurrency(12500000)}
              </div>
              <p className="text-xs text-slate-500 mt-1">Gồm 3 ví (Tiền mặt, Vietcombank, MoMo)</p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 mt-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Thu trong tháng</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> {formatCurrency(15000000)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Chi trong tháng</span>
                <span className="font-semibold text-rose-600 flex items-center gap-0.5">
                  <TrendingDown className="w-3 h-3" /> {formatCurrency(2500000)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Khối Hướng dẫn Phân công Công việc cho 4 thành viên */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-base">Phân công việc theo vai trò (Sprint 1)</h3>
            </div>
            <span className="text-xs text-slate-500">Mã nguồn & Supabase đã sẵn sàng</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold text-[10px]">FS1 (Full-stack 1)</span>
              <p className="font-medium text-slate-800">Trang Đăng ký/Đăng nhập & Quản lý Danh mục</p>
              <p className="text-slate-500">Task: AUTH-02, AUTH-03, CAT-01, TXN-01</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-semibold text-[10px]">FS2 (Full-stack 2)</span>
              <p className="font-medium text-slate-800">Quản lý Ví, Ngân sách & Safe-to-spend</p>
              <p className="text-slate-500">Task: WALLET-01, BUDGET-01, STS-01</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold text-[10px]">FE (Frontend)</span>
              <p className="font-medium text-slate-800">Giao diện Dashboard, Danh sách Ví & Form</p>
              <p className="text-slate-500">Task: DASH-01, WALLET-02, TXN-02</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold text-[10px]">BA / QA</span>
              <p className="font-medium text-slate-800">Kiểm thử RLS & Soạn tài liệu Use Cases</p>
              <p className="text-slate-500">Task: QA-01, QA-02, DOC-01</p>
            </div>
          </div>
        </div>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App
