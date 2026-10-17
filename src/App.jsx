import React, { useState, useEffect } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { BottomNav } from '@/components/layout/BottomNav'
import { formatCurrency } from '@/utils/formatCurrency'
import { parseQuickEntry } from '@/services/quickEntryParser'
import { supabase } from '@/lib/supabaseClient'
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowRightLeft,
  ChevronRight,
  Coffee,
  Fuel,
  ShoppingBag,
  Zap,
  Bot,
  Calendar,
  Layers,
  HelpCircle,
  Plus,
  Send,
  AlertTriangle,
  CheckCircle,
  CreditCard
} from 'lucide-react'

export function App() {
  const [activeTab, setActiveTab] = useState('dash')
  const [dbStatus, setDbStatus] = useState({ checking: true, connected: false, message: '' })

  // Quick Entry state
  const [quickInput, setQuickInput] = useState('cafe 35k hôm qua momo')
  const [parsedData, setParsedData] = useState(() => parseQuickEntry('cafe 35k hôm qua momo'))
  const [showFormulaModal, setShowFormulaModal] = useState(false)

  // AI Chat prompt state
  const [aiMessage, setAiMessage] = useState('')
  const [aiResponse, setAiResponse] = useState(null)

  useEffect(() => {
    async function testConnection() {
      try {
        const { error } = await supabase.from('categories').select('count', { count: 'exact', head: true })
        if (error) throw error
        setDbStatus({
          checking: false,
          connected: true,
          message: 'Supabase Connected'
        })
      } catch (err) {
        setDbStatus({
          checking: false,
          connected: false,
          message: err.message || 'Supabase Connection Error'
        })
      }
    }
    testConnection()
  }, [])

  const handleQuickInputChange = (e) => {
    const val = e.target.value
    setQuickInput(val)
    if (val.trim()) {
      setParsedData(parseQuickEntry(val))
    } else {
      setParsedData(null)
    }
  }

  const handleChipClick = (text) => {
    setQuickInput(text)
    setParsedData(parseQuickEntry(text))
  }

  const handleAiChipClick = (prompt) => {
    setAiMessage(prompt)
    if (prompt.includes('tiêu được bao nhiêu')) {
      setAiResponse('Hôm nay bạn có thể an toàn chi tiêu tối đa 245.000 ₫. Đến cuối tháng bạn còn 14 ngày và ngân sách khả dụng còn 3.430.000 ₫ (đã trừ khoản tiền phòng trọ 1.200.000 ₫ sắp tới).')
    } else if (prompt.includes('Ăn uống')) {
      setAiResponse('Trong tháng này, bạn đã chi 1.950.000 ₫ cho Ăn uống trên tổng hạn mức 3.000.000 ₫ (đạt 65% tiến độ). Bạn đang kiểm soát rất tốt!')
    } else {
      setAiResponse('Dựa trên thói quen chi tiêu, bạn có thể cắt giảm 15% khoản Mua sắm vặt và chuyển 500.000 ₫ vào Mục tiêu tiết kiệm để hoàn thành quỹ dự phòng sớm hơn 10 ngày.')
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 sm:pb-12 text-slate-800">
      {/* 1. Floating Island Navbar */}
      <Navbar dbStatus={dbStatus} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6 pt-2">
        
        {/* 2. Editorial Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/[0.04] border border-slate-900/[0.06] text-slate-600 text-[11px] font-semibold tracking-wide uppercase mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Bảng điều khiển tài chính • Sprint 1
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-950 tracking-tight">
              Tổng quan chi tiêu hôm nay
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
              Hệ thống đã tự động tính toán hạn mức an toàn và đồng bộ hóa với ví của bạn.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFormulaModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 shadow-soft-sm text-xs font-semibold text-slate-700 transition-all active:scale-[0.98]"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />
              <span>Công thức STS</span>
            </button>
            <button 
              onClick={() => handleChipClick('cafe 35k hôm qua momo')}
              className="group inline-flex items-center gap-2 pl-4 pr-2 py-2 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-glow-brand text-xs font-semibold transition-all active:scale-[0.98]"
            >
              <span>Ghi chép nhanh</span>
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                <Plus className="w-3 h-3 text-white" strokeWidth={2} />
              </span>
            </button>
          </div>
        </div>

        {/* 3. ASYMMETRICAL BENTO GRID - ROW 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Bento 1: Thẻ Safe-to-spend độc bản (Double-Bezel Architecture) */}
          <div className="lg:col-span-7 bezel-outer bg-gradient-to-br from-emerald-100/60 via-teal-50/40 to-slate-200/40">
            <div className="bezel-inner bg-gradient-to-br from-[#064E3B] via-[#065F46] to-[#047857] text-white p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between min-h-[300px]">
              
              {/* Background ambient orbs */}
              <div className="absolute -top-16 -right-16 w-60 h-60 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-teal-300/15 rounded-full blur-2xl pointer-events-none"></div>

              {/* Card Header */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" strokeWidth={1.5} />
                  <span className="text-[11px] font-semibold text-emerald-100 uppercase tracking-wider">
                    Safe-to-spend hôm nay
                  </span>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-[11px] font-bold text-emerald-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  An toàn
                </div>
              </div>

              {/* Massive Amount Typography */}
              <div className="relative z-10 my-4">
                <div className="text-4xl sm:text-5xl font-display font-extrabold tracking-tight text-white flex items-baseline gap-1">
                  {formatCurrency(245000)}
                  <span className="text-xs font-normal text-emerald-200/80">/ ngày</span>
                </div>
                <p className="text-xs text-emerald-100/80 mt-1.5 leading-relaxed max-w-md">
                  Bạn có thể thoải mái chi tiêu số tiền này trong hôm nay mà không lo bị thâm hụt ngân sách tháng.
                </p>
              </div>

              {/* Progress and Calculation Breakdown */}
              <div className="relative z-10 pt-4 border-t border-white/15 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-emerald-200/70 block text-[10px] uppercase font-semibold">Ngân sách còn lại</span>
                  <span className="font-display font-bold text-sm text-white">{formatCurrency(3680000)}</span>
                </div>
                <div>
                  <span className="text-emerald-200/70 block text-[10px] uppercase font-semibold">Khoản sắp đến</span>
                  <span className="font-display font-bold text-sm text-amber-200">- {formatCurrency(1200000)}</span>
                </div>
                <div>
                  <span className="text-emerald-200/70 block text-[10px] uppercase font-semibold">Ngày còn lại</span>
                  <span className="font-display font-bold text-sm text-white">14 ngày</span>
                </div>
              </div>

            </div>
          </div>

          {/* Bento 2: Tổng số dư & Thẻ ví thông minh */}
          <div className="lg:col-span-5 bezel-outer">
            <div className="bezel-inner p-6 flex flex-col justify-between min-h-[300px]">
              
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Tổng tài sản các ví
                  </span>
                  <button className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-0.5">
                    <span>Quản lý</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-3xl font-display font-extrabold text-slate-900 mt-2">
                  {formatCurrency(12500000)}
                </div>

                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <TrendingUp className="w-3.5 h-3.5" /> +15.000.000 ₫
                  </div>
                  <div className="text-slate-300">•</div>
                  <div className="flex items-center gap-1 text-rose-500 font-semibold">
                    <TrendingDown className="w-3.5 h-3.5" /> -2.500.000 ₫
                  </div>
                </div>
              </div>

              {/* Danh sách 3 ví nhanh */}
              <div className="space-y-2 my-4">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-[10px]">
                      TM
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 block">Tiền mặt</span>
                      <span className="text-[10px] text-slate-400">Chi tiêu hằng ngày</span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900">{formatCurrency(1500000)}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                      VCB
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 block">Vietcombank</span>
                      <span className="text-[10px] text-slate-400">Tài khoản chính</span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900">{formatCurrency(9800000)}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-600 flex items-center justify-center font-bold text-[10px]">
                      MM
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 block">Ví MoMo</span>
                      <span className="text-[10px] text-slate-400">Thanh toán online</span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900">{formatCurrency(1200000)}</span>
                </div>
              </div>

              {/* Nút chuyển tiền nội bộ */}
              <button 
                type="button"
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.5} />
                <span>Chuyển tiền giữa các ví</span>
              </button>

            </div>
          </div>

        </div>

        {/* 4. ASYMMETRICAL BENTO GRID - ROW 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Bento 3: Bộ Nhập Nhanh Câu Tự Nhiên (Interactive Quick Entry) - Điểm khác biệt 1 */}
          <div className="lg:col-span-7 bezel-outer">
            <div className="bezel-inner p-6 flex flex-col justify-between h-full space-y-4">
              
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Zap className="w-4 h-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-slate-900">
                        Nhập nhanh câu tự nhiên
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Bóc tách tự động số tiền, ngày, ví và danh mục (Rule-based)
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600 uppercase">
                    Tính năng lõi
                  </span>
                </div>

                {/* Input Field */}
                <div className="relative">
                  <input
                    type="text"
                    value={quickInput}
                    onChange={handleQuickInputChange}
                    placeholder="Ví dụ: cafe 35k hôm qua momo, đổ xăng 70k..."
                    className="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 text-xs sm:text-sm font-medium text-slate-900 transition-all outline-hidden"
                  />
                  <div className="absolute right-3 top-3 text-slate-400">
                    <Sparkles className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
                  </div>
                </div>

                {/* Example Quick Reply Chips */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Thử mẫu:</span>
                  {[
                    'cafe 35k hôm qua momo',
                    'đổ xăng 70k hôm nay vcb',
                    'lương part-time 3tr5',
                    'mua sách 150k tiền mặt'
                  ].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => handleChipClick(sample)}
                      className={`px-2.5 py-1 rounded-full text-[11px] transition-all ${
                        quickInput === sample 
                          ? 'bg-slate-900 text-white font-semibold shadow-xs' 
                          : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Card (Theo đúng nguyên tắc an toàn UI của PROJECT_SPEC) */}
              {parsedData && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Kết quả bóc tách (Xem trước để xác nhận)</span>
                    <span className="text-[10px] font-medium text-slate-400">
                      {parsedData.confidence.amount ? '✓ Đã nhận diện' : '⚠ Cần kiểm tra'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    
                    {/* Amount */}
                    <div className={`p-2.5 rounded-xl border ${
                      parsedData.confidence.amount 
                        ? 'bg-white border-emerald-200 text-emerald-800' 
                        : 'bg-amber-50 border-amber-300 text-amber-800'
                    }`}>
                      <span className="block text-[10px] text-slate-400 font-semibold uppercase">Số tiền</span>
                      <span className="font-display font-bold text-sm">
                        {parsedData.amount ? formatCurrency(parsedData.amount) : 'Chưa nhận diện'}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-800">
                      <span className="block text-[10px] text-slate-400 font-semibold uppercase">Ngày</span>
                      <span className="font-semibold text-xs flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {parsedData.dateLabel}
                      </span>
                    </div>

                    {/* Wallet */}
                    <div className={`p-2.5 rounded-xl border ${
                      parsedData.confidence.wallet 
                        ? 'bg-white border-blue-200 text-blue-900' 
                        : 'bg-amber-50 border-amber-300 text-amber-800'
                    }`}>
                      <span className="block text-[10px] text-slate-400 font-semibold uppercase">Ví</span>
                      <span className="font-semibold text-xs">
                        {parsedData.wallet || 'Chưa nhận diện'}
                      </span>
                    </div>

                    {/* Category */}
                    <div className={`p-2.5 rounded-xl border ${
                      parsedData.confidence.category 
                        ? 'bg-white border-purple-200 text-purple-900' 
                        : 'bg-amber-50 border-amber-300 text-amber-800'
                    }`}>
                      <span className="block text-[10px] text-slate-400 font-semibold uppercase">Danh mục</span>
                      <span className="font-semibold text-xs">
                        {parsedData.category || 'Chưa nhận diện'}
                      </span>
                    </div>

                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button 
                      type="button"
                      className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-soft-sm transition-all active:scale-[0.98]"
                    >
                      Lưu giao dịch này
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Bento 4: Tiến độ Ngân sách tháng (3 Mức trạng thái) */}
          <div className="lg:col-span-5 bezel-outer">
            <div className="bezel-inner p-6 flex flex-col justify-between h-full space-y-4">
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Ngân sách tháng 10
                  </h3>
                  <span className="text-xs font-semibold text-brand-600">Xem tất cả</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Theo dõi tiến độ chi tiêu theo 3 mức cảnh báo quy chuẩn
                </p>
              </div>

              <div className="space-y-4 my-2">
                
                {/* 1. An toàn (< 80%) */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Coffee className="w-3.5 h-3.5 text-emerald-600" /> Ăn uống
                    </span>
                    <span className="text-slate-500">
                      <strong>{formatCurrency(1950000)}</strong> / {formatCurrency(3000000)} (65%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: '65%' }}></div>
                  </div>
                </div>

                {/* 2. Sắp vượt (80% - 99%) */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Fuel className="w-3.5 h-3.5 text-amber-500" /> Di chuyển & Xăng xe
                    </span>
                    <span className="text-amber-700 font-medium">
                      <strong>{formatCurrency(720000)}</strong> / {formatCurrency(800000)} (90%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: '90%' }}></div>
                  </div>
                  <span className="text-[10px] text-amber-600 font-medium mt-0.5 block">
                    ⚠ Sắp chạm trần ngân sách danh mục này
                  </span>
                </div>

                {/* 3. Đã vượt (>= 100%) */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-rose-500" /> Mua sắm cá nhân
                    </span>
                    <span className="text-rose-600 font-bold">
                      <strong>{formatCurrency(1560000)}</strong> / {formatCurrency(1500000)} (104%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: '100%' }}></div>
                  </div>
                  <span className="text-[10px] text-rose-500 font-bold mt-0.5 block">
                    ✕ Đã vượt hạn mức 60.000 ₫
                  </span>
                </div>

              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Tổng hạn mức các mục:</span>
                <span className="font-bold text-slate-800">{formatCurrency(5300000)}</span>
              </div>

            </div>
          </div>

        </div>

        {/* 5. ASYMMETRICAL BENTO GRID - ROW 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Bento 5: Trợ lý AI Gemini Preview - Điểm khác biệt 3 */}
          <div className="lg:col-span-6 bezel-outer">
            <div className="bezel-inner p-6 flex flex-col justify-between h-full space-y-4">
              
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-brand-600 text-white flex items-center justify-center">
                      <Bot className="w-4 h-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-slate-900">
                        Trợ lý AI Gemini
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Tư vấn & tra cứu chi tiêu theo ngữ cảnh tài chính
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-brand-50 text-[10px] font-bold text-brand-600 uppercase">
                    Gemini 1.5 Flash
                  </span>
                </div>

                {/* 4 Quick Reply Chips */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    'Hôm nay tiêu được bao nhiêu?',
                    'Tháng này chi Ăn uống thế nào?',
                    'Khoản định kỳ nào sắp tới?',
                    'Tư vấn tiết kiệm 500k'
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleAiChipClick(chip)}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 text-left text-[11px] font-medium text-slate-700 transition-colors"
                    >
                      💬 {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Bubble Response */}
              {aiResponse ? (
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-900">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Gemini phản hồi:</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    {aiResponse}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 text-xs italic text-center">
                  Bấm vào 1 trong 4 câu hỏi trên để trải nghiệm phản hồi thông minh của AI.
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  placeholder="Hỏi AI bất kỳ điều gì về tài chính của bạn..."
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 outline-hidden focus:bg-white focus:border-brand-500"
                />
                <button 
                  type="button"
                  aria-label="Gửi tin nhắn cho AI"
                  className="absolute right-2 top-2 p-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>

            </div>
          </div>

          {/* Bento 6: Giao dịch gần đây */}
          <div className="lg:col-span-6 bezel-outer">
            <div className="bezel-inner p-6 flex flex-col justify-between h-full space-y-4">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Giao dịch gần đây
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Các khoản thu chi phát sinh trong tuần này
                  </p>
                </div>
                <button className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                  Xem tất cả
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  { name: 'Phở bò tái nạm', category: 'Ăn uống', amount: -45000, date: 'Hôm nay, 12:30', wallet: 'Ví MoMo', icon: Coffee },
                  { name: 'Nhận chuyển khoản freelance', category: 'Thu nhập', amount: 3500000, date: 'Hôm qua, 18:00', wallet: 'Vietcombank', icon: TrendingUp },
                  { name: 'Đổ xăng xe máy', category: 'Di chuyển', amount: -70000, date: 'Hôm qua, 08:15', wallet: 'Tiền mặt', icon: Fuel },
                  { name: 'Mua giáo trình tài chính', category: 'Mua sắm', amount: -150000, date: '15/10/2026', wallet: 'Vietcombank', icon: ShoppingBag },
                ].map((item, idx) => {
                  const Icon = item.icon
                  const isIncome = item.amount > 0

                  return (
                    <div 
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/60 transition-colors flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/70 text-slate-700'
                        }`}>
                          <Icon className="w-4 h-4" strokeWidth={1.5} />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 block">{item.name}</span>
                          <span className="text-[10px] text-slate-400">{item.date} • {item.wallet}</span>
                        </div>
                      </div>

                      <span className={`font-display font-bold ${
                        isIncome ? 'text-emerald-600' : 'text-slate-900'
                      }`}>
                        {isIncome ? '+' : ''}{formatCurrency(item.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="text-center pt-2">
                <span className="text-[11px] text-slate-400">
                  Dữ liệu được bảo mật bằng Supabase Row Level Security (RLS)
                </span>
              </div>

            </div>
          </div>

        </div>

      </main>

      {/* MODAL GIẢI THÍCH CÔNG THỨC SAFE-TO-SPEND */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-soft-xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                Công thức Safe-to-spend
              </h4>
              <button 
                onClick={() => setShowFormulaModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-emerald-900 font-mono text-[13px]">
                SafeToSpend = max(0, (RemainingBudget - UpcomingRecurring) / DaysLeft)
              </p>
              <ul className="space-y-1 text-[11px] list-disc list-inside text-slate-600">
                <li><strong>RemainingBudget (3.680.000 ₫):</strong> Tổng hạn mức ngân sách tháng trừ chi tiêu lũy kế.</li>
                <li><strong>UpcomingRecurring (1.200.000 ₫):</strong> Khoản định kỳ bắt buộc sắp tới (tiền phòng).</li>
                <li><strong>DaysLeft (14 ngày):</strong> Số ngày còn lại của tháng (tính cả hôm nay).</li>
              </ul>
              <div className="pt-2 border-t border-emerald-200/60 font-semibold text-emerald-800 text-[12px]">
                $\rightarrow$ Kết quả: (3.680.000 - 1.200.000) / 14 = <strong>177.142 ₫ / ngày</strong> (Hệ thống làm tròn mượt mà).
              </div>
            </div>

            <button
              onClick={() => setShowFormulaModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* 6. Floating Dock Bottom Nav */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App
