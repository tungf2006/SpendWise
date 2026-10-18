import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '@/utils/formatCurrency'
import { parseQuickEntry } from '@/services/quickEntryParser'
import { calculateSafeToSpend } from '@/services/safeToSpendService'
import { getWallets } from '@/services/walletService'
import { getTransactions, createTransaction } from '@/services/transactionService'
import { getCategories } from '@/services/categoryService'
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ChevronRight,
  Plus,
  Send,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Calendar,
  Layers,
  Fuel,
  Coffee,
  ShoppingBag,
  CreditCard,
  Loader2
} from 'lucide-react'

/**
 * Trang Dashboard Tổng quan (DashboardPage)
 * Phụ trách: TV2 (Hồ Nguyên Văn) - Nhóm chức năng DASH (UC16) & Smart UI (UC18 - UC20)
 */
export const DashboardPage = () => {
  const [wallets, setWallets] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [stsData, setStsData] = useState({
    safeToSpendToday: 0,
    remainingBudget: 0,
    upcomingRecurring: 0,
    daysLeft: 1,
    totalBudget: 0,
    totalSpent: 0
  })
  const [loading, setLoading] = useState(true)

  // Quick Entry state
  const [quickInput, setQuickInput] = useState('cafe 35k hôm qua momo')
  const [parsedData, setParsedData] = useState(() => parseQuickEntry('cafe 35k hôm qua momo'))
  const [showFormulaModal, setShowFormulaModal] = useState(false)
  const [isSavingQuick, setIsSavingQuick] = useState(false)
  const [quickSaveSuccess, setQuickSaveSuccess] = useState(false)

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const [walletsRes, txnsRes, catsRes, stsRes] = await Promise.all([
        getWallets(),
        getTransactions({ limit: 5 }),
        getCategories(),
        calculateSafeToSpend()
      ])

      setWallets(walletsRes.data || [])
      setRecentTransactions(txnsRes.data || [])
      setCategories(catsRes.data || [])
      setStsData(stsRes)
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const handleQuickInputChange = (e) => {
    const val = e.target.value
    setQuickInput(val)
    setParsedData(parseQuickEntry(val))
  }

  const handleQuickSave = async () => {
    if (!parsedData || !parsedData.amount) return

    setIsSavingQuick(true)
    try {
      // Tìm wallet_id phù hợp từ tên ví đã parse hoặc lấy ví đầu tiên
      const matchedWallet = wallets.find(w => 
        w.name.toLowerCase().includes(parsedData.walletKeyword || '')
      ) || wallets[0]

      // Tìm category_id phù hợp từ tên category đã parse
      const matchedCategory = categories.find(c => 
        c.name.toLowerCase().includes(parsedData.categoryName?.toLowerCase() || '')
      )

      if (!matchedWallet) {
        alert('Vui lòng tạo ít nhất 1 ví tiền trước khi lưu giao dịch.')
        setIsSavingQuick(false)
        return
      }

      const { error } = await createTransaction({
        wallet_id: matchedWallet.id,
        category_id: matchedCategory?.id || null,
        type: parsedData.type || 'expense',
        amount: parsedData.amount,
        transaction_date: parsedData.date,
        note: parsedData.rawText || quickInput
      })

      if (error) throw error

      setQuickSaveSuccess(true)
      setQuickInput('')
      setParsedData(null)
      await loadDashboardData()

      setTimeout(() => setQuickSaveSuccess(false), 3000)
    } catch (err) {
      alert('Không thể lưu giao dịch: ' + err.message)
    } finally {
      setIsSavingQuick(false)
    }
  }

  const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0)

  return (
    <div className="space-y-6">
      
      {/* 1. Safe-to-spend Hero Card (Double-Bezel Design) */}
      <section className="relative group">
        <div className="rounded-[2.25rem] bg-gradient-to-b from-slate-900 to-slate-950 p-2 shadow-soft-2xl ring-1 ring-slate-900/10">
          <div className="rounded-[calc(2.25rem-0.5rem)] bg-gradient-to-tr from-slate-900 via-slate-900 to-slate-800/90 p-6 sm:p-8 text-white relative overflow-hidden border border-white/10 shadow-inner">
            
            {/* Background glowing orb */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-brand-500/15 blur-3xl pointer-events-none"></div>

            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-brand-300 font-medium mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Safe-to-spend Hôm nay</span>
                  </div>
                  <h2 className="text-xs text-slate-300 uppercase tracking-widest font-semibold">
                    Số tiền an toàn có thể tiêu
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFormulaModal(true)}
                  className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-xs transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Cách tính?</span>
                </button>
              </div>

              {/* Big STS Amount */}
              <div className="flex items-baseline gap-2 my-2">
                <span className="font-display font-black text-4xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-slate-200 tracking-tight">
                  {formatCurrency(stsData.safeToSpendToday)}
                </span>
                <span className="text-xs text-slate-400 font-medium">/ ngày</span>
              </div>

              {/* STS breakdown pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/10 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Ngân sách còn lại</span>
                  <span className="font-semibold text-white font-display text-sm">
                    {formatCurrency(stsData.remainingBudget)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Định kỳ sắp tới</span>
                  <span className="font-semibold text-rose-300 font-display text-sm">
                    -{formatCurrency(stsData.upcomingRecurring)}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block text-[11px]">Số ngày còn lại</span>
                  <span className="font-semibold text-amber-300 font-display text-sm">
                    {stsData.daysLeft} ngày
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* 2. Quick Entry Bar (Chức năng 8 & 9) */}
      <section id="quick-entry" className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5 backdrop-blur-xl">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 sm:p-6 border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
              <h3 className="font-display font-bold text-slate-900 text-sm">
                Nhập nhanh bằng câu tự nhiên (Quick Entry)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">Ví dụ: "cafe 35k hôm qua momo"</span>
          </div>

          <div className="relative flex items-center">
            <input
              type="text"
              value={quickInput}
              onChange={handleQuickInputChange}
              placeholder="Gõ nhanh: bún bò 45k hôm nay tiền mặt..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 rounded-full py-3.5 pl-5 pr-28 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-all outline-none font-medium"
            />
            <button
              type="button"
              onClick={handleQuickSave}
              disabled={isSavingQuick || !parsedData?.amount}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all duration-200 active:scale-95 cursor-pointer"
            >
              {isSavingQuick ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Lưu</span>
            </button>
          </div>

          {quickSaveSuccess && (
            <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs flex items-center gap-2 border border-emerald-200">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Giao dịch đã được lưu thành công vào cơ sở dữ liệu!</span>
            </div>
          )}

          {/* Quick Entry Preview Pills */}
          {parsedData && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Xem trước:</span>
              
              {/* Số tiền */}
              <span className={`px-3 py-1 rounded-full font-display font-semibold ${
                parsedData.amount 
                  ? 'bg-brand-50 text-brand-700 border border-brand-200' 
                  : 'bg-amber-50 text-amber-700 border border-amber-300 animate-pulse'
              }`}>
                Số tiền: {parsedData.amount ? formatCurrency(parsedData.amount) : 'Chưa nhận diện'}
              </span>

              {/* Loại giao dịch */}
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                Loại: {parsedData.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}
              </span>

              {/* Ngày */}
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                Ngày: {parsedData.date}
              </span>

              {/* Danh mục */}
              <span className={`px-3 py-1 rounded-full font-medium ${
                parsedData.categoryName 
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                  : 'bg-amber-50 text-amber-700 border border-amber-300'
              }`}>
                Danh mục: {parsedData.categoryName || 'Mặc định (Chung)'}
              </span>

              {/* Ví */}
              <span className={`px-3 py-1 rounded-full font-medium ${
                parsedData.walletKeyword 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                Ví: {parsedData.walletKeyword || 'Ví mặc định'}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 3. Wallets Overview Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-base">Ví của bạn</h3>
            <span className="text-xs text-slate-500">Tổng tài sản: <strong className="font-display text-slate-900">{formatCurrency(totalBalance)}</strong></span>
          </div>
          <Link
            to="/wallets"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <span>Quản lý ví</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {wallets.length === 0 ? (
            <div className="sm:col-span-3 p-6 text-center bg-white rounded-3xl border border-slate-200/60 text-xs text-slate-500">
              Chưa có ví nào. Hãy chuyển sang trang Ví để tạo ví đầu tiên!
            </div>
          ) : (
            wallets.map((w) => (
              <div
                key={w.id}
                className="rounded-[1.75rem] bg-white p-4 shadow-soft-sm border border-slate-200/60 flex items-center justify-between hover:shadow-soft-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-xs"
                    style={{ backgroundColor: w.color || '#3B82F6' }}
                  >
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-xs text-slate-900">{w.name}</h4>
                    <span className="text-[10px] text-slate-400 capitalize">{w.type}</span>
                  </div>
                </div>
                <span className="font-display font-bold text-sm text-slate-900">
                  {formatCurrency(w.balance)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 4. Recent Transactions Section */}
      <section className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 sm:p-6 border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base">Giao dịch gần nhất</h3>
              <p className="text-xs text-slate-400">5 khoản thu chi mới được cập nhật gần đây</p>
            </div>
            <Link
              to="/transactions"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              <span>Xem tất cả</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentTransactions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Chưa có giao dịch nào được ghi lại trong tháng này.
              </div>
            ) : (
              recentTransactions.map((txn) => {
                const isIncome = txn.type === 'income'
                const isTransfer = txn.type === 'transfer'

                return (
                  <div key={txn.id} className="py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${
                          isIncome ? 'bg-emerald-500' : isTransfer ? 'bg-indigo-500' : 'bg-slate-900'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="w-4 h-4 text-white" />
                        ) : isTransfer ? (
                          <CreditCard className="w-4 h-4 text-white" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-rose-300" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900">
                          {txn.note || txn.category?.name || 'Giao dịch không tên'}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span>{txn.transaction_date}</span>
                          <span>•</span>
                          <span>{txn.wallet?.name}</span>
                          {txn.category?.name && (
                            <>
                              <span>•</span>
                              <span className="text-slate-600 font-medium">{txn.category.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`font-display font-bold text-xs sm:text-sm ${
                        isIncome ? 'text-emerald-600' : isTransfer ? 'text-indigo-600' : 'text-slate-900'
                      }`}
                    >
                      {isIncome ? '+' : isTransfer ? '' : '-'}
                      {formatCurrency(txn.amount)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </section>

      {/* Formula Explanation Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100">
            <h4 className="font-display font-bold text-slate-900 text-base mb-2">
              Công thức Safe-to-spend (Chức năng 9)
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Chỉ số cho biết số tiền an toàn bạn có thể tiêu hôm nay mà không lo bị thâm hụt ngân sách tháng hay thiếu tiền thanh toán các khoản định kỳ sắp tới.
            </p>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 font-mono text-xs text-slate-800 mb-4 leading-relaxed">
              SafeToSpend = max(0, (Ngân sách còn lại - Khoản định kỳ sắp tới) / Số ngày còn lại)
            </div>
            <button
              type="button"
              onClick={() => setShowFormulaModal(false)}
              className="w-full py-2.5 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
export default DashboardPage
