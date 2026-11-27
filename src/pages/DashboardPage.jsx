import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { Link, useLocation } from 'react-router-dom'
import { Toast } from '@/components/common/Toast'
import { formatCurrency } from '@/utils/formatCurrency'
import { getLocalDateString } from '@/utils/date'
import { parseQuickEntry, resolveQuickWallet, normalizeQuickText } from '@/services/quickEntryParser'
import { calculateSafeToSpend } from '@/services/safeToSpendService'
import { getWallets, transferFunds } from '@/services/walletService'
import { getTransactions, createTransaction } from '@/services/transactionService'
import { getCategories } from '@/services/categoryService'
import { getFinancialSummary, getCategoryExpenseBreakdown } from '@/services/reportService'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  ChevronRight,
  CreditCard,
  HelpCircle,
  Loader2,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  X
} from 'lucide-react'

ChartJS.register(ArcElement, Tooltip, Legend)

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
  const [loadError, setLoadError] = useState('')
  const [monthlySummary, setMonthlySummary] = useState({ totalIncome: 0, totalExpense: 0, netSavings: 0 })
  const [categoryExpense, setCategoryExpense] = useState({ labels: [], datasets: [], rawData: [] })

  // Quick Entry & Preview Modal (UC18 / UC19) state
  const location = useLocation()
  const [quickInput, setQuickInput] = useState('cafe 35k hôm qua momo')
  const [showFormulaModal, setShowFormulaModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewForm, setPreviewForm] = useState({
    type: 'expense',
    amount: '',
    transaction_date: getLocalDateString(),
    wallet_id: '',
    to_wallet_id: '',
    category_id: '',
    note: ''
  })
  const [previewError, setPreviewError] = useState('')
  const [dateWasInvalid, setDateWasInvalid] = useState(false)
  const [isSavingQuick, setIsSavingQuick] = useState(false)
  const [quickSaveSuccess, setQuickSaveSuccess] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )
  const requestIdRef = useRef(0)
  const quickEntrySectionRef = useRef(null)
  const quickEntryInputRef = useRef(null)
  const pendingQuickEntryRef = useRef(false)

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return undefined
    const root = document.documentElement
    const syncTheme = () => setIsDark(root.classList.contains('dark'))
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const activeWallets = useMemo(
    () => wallets.filter((w) => w && !w.is_archived),
    [wallets]
  )

  const parsedData = useMemo(
    () => parseQuickEntry(quickInput, { categories, wallets: activeWallets }),
    [quickInput, categories, activeWallets]
  )

  const quickResolution = useMemo(() => {
    const matchedWallet = parsedData?.walletKeyword
      ? resolveQuickWallet(activeWallets, parsedData.walletKeyword)
      : null
    const matchedToWallet =
      parsedData?.type === 'transfer' && parsedData?.toWalletKeyword
        ? resolveQuickWallet(activeWallets, parsedData.toWalletKeyword)
        : null
    const matchedCategory =
      parsedData?.type !== 'transfer' && parsedData?.categoryName
        ? categories.find(
            (c) =>
              c.type === parsedData.type &&
              normalizeQuickText(c.name) === normalizeQuickText(parsedData.categoryName)
          ) || null
        : null

    const isAmountValid = Number.isFinite(Number(parsedData?.amount)) && Number(parsedData.amount) > 0
    const isWalletValid = Boolean(matchedWallet)
    const isToWalletValid =
      parsedData?.type !== 'transfer' ||
      (Boolean(matchedToWallet) && matchedToWallet.id !== matchedWallet?.id)
    const isCategoryValid = parsedData?.type === 'transfer' || Boolean(matchedCategory)
    const isDateValid = Boolean(parsedData?.date)
    const hasUnrecognizedFields =
      !parsedData ||
      !isAmountValid ||
      !isWalletValid ||
      !isToWalletValid ||
      !isCategoryValid

    return {
      matchedWallet,
      matchedToWallet,
      matchedCategory,
      isAmountValid,
      isWalletValid,
      isToWalletValid,
      isCategoryValid,
      isDateValid,
      hasUnrecognizedFields
    }
  }, [parsedData, activeWallets, categories])

  const doughnutData = useMemo(() => {
    if (!categoryExpense?.datasets?.length) return categoryExpense
    return {
      ...categoryExpense,
      datasets: categoryExpense.datasets.map((dataset) => ({
        ...dataset,
        borderColor: isDark ? '#0F172A' : '#ffffff'
      }))
    }
  }, [categoryExpense, isDark])

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 9,
            boxHeight: 9,
            font: { size: 9 },
            color: isDark ? '#CBD5E1' : '#475569'
          }
        },
        tooltip: {
          backgroundColor: '#0F172A',
          titleColor: '#F8FAFC',
          bodyColor: '#E2E8F0',
          borderColor: isDark ? '#334155' : 'transparent',
          borderWidth: isDark ? 1 : 0
        }
      },
      cutout: '65%'
    }),
    [isDark]
  )

  const fetchAllDashboardData = useCallback(async () => {
    const reqId = ++requestIdRef.current
    try {
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`

      const [walletsRes, txnsRes, catsRes, stsRes, summaryRes, categoryRes] = await Promise.all([
        getWallets(),
        getTransactions({ limit: 5 }),
        getCategories(),
        calculateSafeToSpend(),
        getFinancialSummary(startDate, endDate),
        getCategoryExpenseBreakdown(month, year)
      ])

      if (reqId !== requestIdRef.current) return

      const firstError =
        walletsRes?.error ||
        txnsRes?.error ||
        catsRes?.error ||
        stsRes?.error ||
        summaryRes?.error ||
        categoryRes?.error

      if (firstError) {
        setLoadError(firstError.message || 'Một số dữ liệu Dashboard chưa tải được đầy đủ.')
      } else {
        setLoadError('')
      }

      setWallets(walletsRes?.data || [])
      setRecentTransactions(txnsRes?.data || [])
      setCategories(catsRes?.data || [])
      if (stsRes) setStsData(stsRes)
      if (summaryRes && !summaryRes.error) setMonthlySummary(summaryRes)
      if (categoryRes && !categoryRes.error) setCategoryExpense(categoryRes)
    } catch (err) {
      if (reqId !== requestIdRef.current) return
      console.error('Lỗi khi tải dữ liệu Dashboard:', err)
      setLoadError(err?.message || 'Không thể tải dữ liệu Dashboard. Vui lòng thử lại.')
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  const handleRetryDashboard = () => {
    setLoading(true)
    void fetchAllDashboardData()
  }

  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      void fetchAllDashboardData()
    }, 0)
    // SPENDWISE_UC24_UC25_P0_FIX:dashboard – cập nhật Safe-to-spend khi finance thay đổi.
    const onFinanceUpdated = () => { void fetchAllDashboardData() }
    window.addEventListener('spendwise:finance-updated', onFinanceUpdated)
    return () => {
      window.clearTimeout(initTimer)
      window.removeEventListener('spendwise:finance-updated', onFinanceUpdated)
    }
  }, [fetchAllDashboardData])

  useEffect(() => {
    if (!quickSaveSuccess) return undefined
    const timer = setTimeout(() => setQuickSaveSuccess(false), 3000)
    return () => clearTimeout(timer)
  }, [quickSaveSuccess])

  useEffect(() => {
    if (!showFormulaModal && !showPreviewModal) return undefined
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (showPreviewModal && !isSavingQuick) {
        setShowPreviewModal(false)
        return
      }
      if (showFormulaModal) {
        setShowFormulaModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showFormulaModal, showPreviewModal, isSavingQuick])

  useEffect(() => {
    if (location.hash !== '#quick-entry') return undefined
    pendingQuickEntryRef.current = true
    let innerFrame = 0
    const outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        const target = quickEntryInputRef.current || quickEntrySectionRef.current
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        quickEntryInputRef.current?.focus({ preventScroll: true })
      })
    })
    return () => {
      window.cancelAnimationFrame(outerFrame)
      window.cancelAnimationFrame(innerFrame)
    }
  }, [location.hash, location.key])

  useEffect(() => {
    if (!pendingQuickEntryRef.current || loading || location.hash !== '#quick-entry') return undefined
    const frame = window.requestAnimationFrame(() => {
      const target = quickEntryInputRef.current || quickEntrySectionRef.current
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      quickEntryInputRef.current?.focus({ preventScroll: true })
      pendingQuickEntryRef.current = false
    })
    return () => window.cancelAnimationFrame(frame)
  }, [loading, location.hash])

  const handleQuickInputChange = (e) => {
    setQuickInput(e.target.value)
  }

  const openQuickPreviewModal = () => {
    if (isSavingQuick) return
    const trimmed = quickInput.trim()
    const invalidDateInput = Boolean(trimmed && !parsedData)
    setDateWasInvalid(invalidDateInput)
    setPreviewError('')
    setPreviewForm({
      type: parsedData?.type || 'expense',
      amount: parsedData?.amount ? String(parsedData.amount) : '',
      transaction_date: parsedData?.date || getLocalDateString(),
      wallet_id: quickResolution.matchedWallet?.id || '',
      to_wallet_id: quickResolution.matchedToWallet?.id || '',
      category_id: quickResolution.matchedCategory?.id || '',
      note: parsedData?.rawText || trimmed
    })
    setShowPreviewModal(true)
  }

  const persistQuickTransaction = async ({
    type,
    amount,
    transaction_date,
    wallet_id,
    to_wallet_id,
    category_id,
    note
  }) => {
    setIsSavingQuick(true)
    try {
      let response
      if (type === 'transfer') {
        response = await transferFunds({
          fromWalletId: wallet_id,
          toWalletId: to_wallet_id,
          amount,
          date: transaction_date,
          note
        })
      } else {
        response = await createTransaction({
          wallet_id,
          category_id: category_id || null,
          type,
          amount,
          transaction_date,
          note
        })
      }
      if (response.error) throw response.error
      setShowPreviewModal(false)
      setPreviewError('')
      setQuickSaveSuccess(true)
      setQuickInput('')
      setToast({ show: true, message: 'Đã lưu nhanh giao dịch thành công!', type: 'success' })
      window.dispatchEvent(new Event('spendwise:finance-updated'))
      await fetchAllDashboardData()
    } catch (err) {
      const message = 'Không thể lưu giao dịch: ' + (err?.message || 'Lỗi không xác định')
      setPreviewError(message)
      setToast({ show: true, message, type: 'error' })
    } finally {
      setIsSavingQuick(false)
    }
  }

  const handleQuickSave = async () => {
    if (isSavingQuick || !quickInput.trim()) return
    if (loading || quickResolution.hasUnrecognizedFields) {
      openQuickPreviewModal()
      return
    }

    await persistQuickTransaction({
      type: parsedData.type,
      amount: parsedData.amount,
      transaction_date: parsedData.date,
      wallet_id: quickResolution.matchedWallet.id,
      to_wallet_id: quickResolution.matchedToWallet?.id || '',
      category_id: quickResolution.matchedCategory?.id || '',
      note: parsedData.rawText
    })
  }

  const handlePreviewSubmit = async (e) => {
    e.preventDefault()
    if (isSavingQuick) return

    const numericAmount = Number(previewForm.amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setPreviewError('Vui lòng nhập số tiền hợp lệ lớn hơn 0.')
      return
    }
    if (!previewForm.transaction_date) {
      setPreviewError('Vui lòng chọn ngày giao dịch.')
      return
    }
    if (!previewForm.wallet_id) {
      setPreviewError('Vui lòng chọn ví giao dịch.')
      return
    }
    if (previewForm.type === 'transfer') {
      if (!previewForm.to_wallet_id) {
        setPreviewError('Vui lòng chọn ví đích cho giao dịch chuyển tiền.')
        return
      }
      if (previewForm.to_wallet_id === previewForm.wallet_id) {
        setPreviewError('Ví nguồn và ví đích không được trùng nhau.')
        return
      }
    }

    setPreviewError('')
    await persistQuickTransaction({
      type: previewForm.type,
      amount: numericAmount,
      transaction_date: previewForm.transaction_date,
      wallet_id: previewForm.wallet_id,
      to_wallet_id: previewForm.type === 'transfer' ? previewForm.to_wallet_id : '',
      category_id: previewForm.type === 'transfer' ? '' : previewForm.category_id,
      note: previewForm.note.trim()
    })
  }

  const previewCategories = useMemo(
    () => categories.filter((c) => c.type === previewForm.type),
    [categories, previewForm.type]
  )

  const totalBalance = activeWallets.reduce((sum, w) => sum + Number(w.balance || 0), 0)

  return (
    <div className="space-y-6">
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {loadError && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 px-4 py-3 text-xs text-rose-700 dark:text-rose-200 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={handleRetryDashboard}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-700/70 text-rose-700 dark:text-rose-200 font-semibold hover:bg-rose-100 dark:hover:bg-rose-950/80 transition-colors shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* 1. Safe-to-spend Hero Card (Double-Bezel Design) */}
      <section className="relative group">
        <div className="rounded-[2.25rem] bg-gradient-to-b from-slate-900 to-slate-950 p-2 shadow-2xl ring-1 ring-slate-900/10 dark:ring-white/10">
          <div className="rounded-[calc(2.25rem-0.5rem)] bg-gradient-to-tr from-slate-900 via-slate-900 to-slate-800/90 p-6 sm:p-8 text-white relative overflow-hidden border border-white/10 shadow-inner">
            
            {/* Background glowing orb */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-brand-500/15 blur-3xl pointer-events-none"></div>

            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-brand-200 font-medium mb-2">
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

      {/* 2. Monthly financial overview (UC16) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-soft-sm">
          <span className="text-xs text-slate-500 font-medium">Tổng thu tháng này</span>
          <div className="mt-2 font-display font-extrabold text-xl text-emerald-600 dark:text-emerald-400">
            {loading ? '...' : formatCurrency(monthlySummary.totalIncome)}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-soft-sm">
          <span className="text-xs text-slate-500 font-medium">Tổng chi tháng này</span>
          <div className="mt-2 font-display font-extrabold text-xl text-rose-600 dark:text-rose-400">
            {loading ? '...' : formatCurrency(monthlySummary.totalExpense)}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-soft-sm">
          <span className="text-xs text-slate-500 font-medium">Chênh lệch thu - chi</span>
          <div className={`mt-2 font-display font-extrabold text-xl ${monthlySummary.netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {loading ? '...' : formatCurrency(monthlySummary.netSavings)}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-soft-sm">
          <h3 className="text-xs font-bold text-slate-800 mb-3">Chi tiêu theo danh mục</h3>
          {loading ? (
            <div className="h-28 flex items-center justify-center text-xs text-slate-400">Đang tải biểu đồ...</div>
          ) : categoryExpense.labels.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-xs text-slate-400 text-center">Chưa có dữ liệu chi tiêu tháng này</div>
          ) : (
            <div className="h-32">
              <Doughnut
                data={doughnutData}
                options={doughnutOptions}
              />
            </div>
          )}
        </div>
      </section>

      {/* 3. Quick Entry Bar (Chức năng 8 & 9) */}
      <section id="quick-entry" ref={quickEntrySectionRef} className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5 dark:ring-white/10 backdrop-blur-xl">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 sm:p-6 border border-slate-100">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
              <h3 className="font-display font-bold text-slate-900 text-sm">
                Nhập nhanh bằng câu tự nhiên (Quick Entry)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">Nhấn Enter để lưu • VD: &quot;cafe 35k hôm qua momo&quot;</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <input
              id="quick-entry-input"
              ref={quickEntryInputRef}
              type="text"
              value={quickInput}
              onChange={handleQuickInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleQuickSave()
                }
              }}
              placeholder="Gõ nhanh: bún bò 45k hôm nay tiền mặt..."
              className="flex-1 min-w-0 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 rounded-full py-3.5 px-5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-all outline-none font-medium"
            />
            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={openQuickPreviewModal}
                disabled={isSavingQuick}
                className="px-4 py-3 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium text-xs flex items-center gap-1.5 transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Xem trước &amp; Sửa</span>
              </button>
              <button
                type="button"
                onClick={handleQuickSave}
                disabled={isSavingQuick || !quickInput.trim()}
                className="px-5 py-3 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all duration-200 active:scale-95 cursor-pointer whitespace-nowrap"
              >
                {isSavingQuick ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Lưu</span>
              </button>
            </div>
          </div>

          {quickSaveSuccess && (
            <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800/60">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Giao dịch đã được lưu thành công vào cơ sở dữ liệu!</span>
            </div>
          )}

          {/* Quick Entry Preview Pills */}
          {quickInput.trim() && !parsedData && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Xem trước:</span>
              <span className="px-3 py-1 rounded-full font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/70">
                Ngày không hợp lệ hoặc chưa nhận diện được — nhấn Enter hoặc &quot;Xem trước &amp; Sửa&quot; để chỉnh
              </span>
            </div>
          )}

          {parsedData && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Xem trước:</span>
              
              {/* Số tiền */}
              <span className={`px-3 py-1 rounded-full font-display font-semibold border ${
                quickResolution.isAmountValid
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-200 border-brand-200 dark:border-brand-700/60'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/70 animate-pulse'
              }`}>
                Số tiền: {quickResolution.isAmountValid ? formatCurrency(parsedData.amount) : 'Chưa nhận diện'}
              </span>

              {/* Loại giao dịch */}
              <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium">
                Loại: {parsedData.type === 'transfer' ? 'Chuyển tiền' : parsedData.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}
              </span>

              {/* Ngày */}
              <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium">
                Ngày: {parsedData.date}
              </span>

              {/* Danh mục */}
              <span className={`px-3 py-1 rounded-full font-medium border ${
                parsedData.type === 'transfer'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  : quickResolution.isCategoryValid
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700/60'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/70'
              }`}>
                Danh mục: {parsedData.type === 'transfer'
                  ? 'Không áp dụng'
                  : (quickResolution.matchedCategory?.name || 'Chưa nhận diện')}
              </span>

              {/* Ví */}
              <span className={`px-3 py-1 rounded-full font-medium border ${
                quickResolution.isWalletValid && quickResolution.isToWalletValid
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/70'
              }`}>
                Ví: {parsedData.type === 'transfer'
                  ? `${quickResolution.matchedWallet?.name || 'Chưa nhận diện'} → ${quickResolution.matchedToWallet?.name || 'Chưa nhận diện'}`
                  : (quickResolution.matchedWallet?.name || 'Chưa nhận diện')}
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
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-200 dark:hover:text-white flex items-center gap-1"
          >
            <span>Quản lý ví</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="rounded-[1.75rem] bg-white p-4 border border-slate-200/60 animate-pulse flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="space-y-2">
                    <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-2.5 w-12 bg-slate-100 dark:bg-slate-800/60 rounded" />
                  </div>
                </div>
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))
          ) : activeWallets.length === 0 ? (
            <div className="sm:col-span-3 p-6 text-center bg-white rounded-3xl border border-slate-200/60 text-xs text-slate-500">
              Chưa có ví nào. Hãy chuyển sang trang Ví để tạo ví đầu tiên!
            </div>
          ) : (
            activeWallets.map((w) => (
              <div
                key={w.id}
                className="rounded-[1.75rem] bg-white p-4 shadow-soft-sm border border-slate-200/60 flex items-center justify-between hover:shadow-soft-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm"
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
      <section className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5 dark:ring-white/10">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 sm:p-6 border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base">Giao dịch gần nhất</h3>
              <p className="text-xs text-slate-400">5 khoản thu chi mới được cập nhật gần đây</p>
            </div>
            <Link
              to="/transactions"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-200 dark:hover:text-white flex items-center gap-1"
            >
              <span>Xem tất cả</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                <span>Đang tải giao dịch gần nhất...</span>
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Chưa có giao dịch nào được ghi lại.
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
                          isIncome ? 'bg-emerald-500' : isTransfer ? 'bg-indigo-500' : 'bg-slate-900 dark:bg-slate-800'
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
                        isIncome ? 'text-emerald-600 dark:text-emerald-400' : isTransfer ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'
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

      {/* UC19 Editable Quick Entry Preview Modal (Double-Bezel) */}
      {showPreviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={() => {
            if (!isSavingQuick) setShowPreviewModal(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-preview-title"
            className="w-full max-w-lg rounded-[2rem] bg-white/85 dark:bg-slate-900/90 p-1.5 shadow-2xl ring-1 ring-slate-900/10 dark:ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-0.375rem)] bg-white dark:bg-slate-900 p-6 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <h4 id="quick-preview-title" className="font-display font-bold text-slate-900 dark:text-white text-base">
                    Xem trước &amp; Xác nhận giao dịch (UC19)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Các trường tô viền vàng chưa được nhận diện rõ — vui lòng kiểm tra trước khi lưu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isSavingQuick) setShowPreviewModal(false)
                  }}
                  aria-label="Đóng hộp thoại xem trước"
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {previewError && (
                <div
                  role="alert"
                  className="mt-3 mb-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{previewError}</span>
                </div>
              )}

              <form onSubmit={handlePreviewSubmit} className="space-y-4 mt-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Loại giao dịch
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'expense', label: 'Chi tiêu' },
                      { value: 'income', label: 'Thu nhập' },
                      { value: 'transfer', label: 'Chuyển tiền' }
                    ].map((opt) => {
                      const active = previewForm.type === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setPreviewForm((prev) => ({
                              ...prev,
                              type: opt.value,
                              category_id: '',
                              to_wallet_id: opt.value === 'transfer' ? prev.to_wallet_id : ''
                            }))
                          }
                          className={`py-2 px-3 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900 dark:bg-brand-600 dark:border-brand-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="preview-amount" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Số tiền (VNĐ)
                    </label>
                    <input
                      id="preview-amount"
                      type="number"
                      min="1"
                      step="1"
                      value={previewForm.amount}
                      onChange={(e) => setPreviewForm((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="Nhập số tiền..."
                      className={`w-full rounded-full px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 border outline-none transition-colors ${
                        !(Number(previewForm.amount) > 0)
                          ? 'border-amber-400 bg-amber-50/60 dark:border-amber-500/80 dark:bg-amber-950/40'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80'
                      }`}
                    />
                  </div>

                  <div>
                    <label htmlFor="preview-date" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Ngày giao dịch
                    </label>
                    <input
                      id="preview-date"
                      type="date"
                      value={previewForm.transaction_date}
                      onChange={(e) => {
                        setDateWasInvalid(false)
                        setPreviewForm((prev) => ({ ...prev, transaction_date: e.target.value }))
                      }}
                      className={`w-full rounded-full px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 border outline-none transition-colors ${
                        !previewForm.transaction_date || dateWasInvalid
                          ? 'border-amber-400 bg-amber-50/60 dark:border-amber-500/80 dark:bg-amber-950/40'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="preview-wallet" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      {previewForm.type === 'transfer' ? 'Ví nguồn' : 'Ví thanh toán'}
                    </label>
                    <select
                      id="preview-wallet"
                      value={previewForm.wallet_id}
                      onChange={(e) => setPreviewForm((prev) => ({ ...prev, wallet_id: e.target.value }))}
                      className={`w-full rounded-full px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 border outline-none transition-colors ${
                        !previewForm.wallet_id
                          ? 'border-amber-400 bg-amber-50/60 dark:border-amber-500/80 dark:bg-amber-950/40'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80'
                      }`}
                    >
                      <option value="">-- Chọn ví --</option>
                      {activeWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {previewForm.type === 'transfer' ? (
                    <div>
                      <label htmlFor="preview-to-wallet" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                        Ví đích
                      </label>
                      <select
                        id="preview-to-wallet"
                        value={previewForm.to_wallet_id}
                        onChange={(e) => setPreviewForm((prev) => ({ ...prev, to_wallet_id: e.target.value }))}
                        className={`w-full rounded-full px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 border outline-none transition-colors ${
                          !previewForm.to_wallet_id || previewForm.to_wallet_id === previewForm.wallet_id
                            ? 'border-amber-400 bg-amber-50/60 dark:border-amber-500/80 dark:bg-amber-950/40'
                            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80'
                        }`}
                      >
                        <option value="">-- Chọn ví đích --</option>
                        {activeWallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="preview-category" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                        Danh mục
                      </label>
                      <select
                        id="preview-category"
                        value={previewForm.category_id}
                        onChange={(e) => setPreviewForm((prev) => ({ ...prev, category_id: e.target.value }))}
                        className={`w-full rounded-full px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 border outline-none transition-colors ${
                          !previewForm.category_id
                            ? 'border-amber-400 bg-amber-50/60 dark:border-amber-500/80 dark:bg-amber-950/40'
                            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80'
                        }`}
                      >
                        <option value="">-- Chọn danh mục --</option>
                        {previewCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="preview-note" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Ghi chú
                  </label>
                  <input
                    id="preview-note"
                    type="text"
                    value={previewForm.note}
                    onChange={(e) => setPreviewForm((prev) => ({ ...prev, note: e.target.value }))}
                    placeholder="Ghi chú giao dịch..."
                    className="w-full rounded-full px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isSavingQuick}
                    onClick={() => setShowPreviewModal(false)}
                    className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingQuick}
                    className="px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isSavingQuick && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Xác nhận lưu</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Formula Explanation Modal (Double-Bezel) */}
      {showFormulaModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={() => setShowFormulaModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sts-formula-title"
            className="w-full max-w-md rounded-[2rem] bg-white/80 dark:bg-slate-900/90 p-1.5 shadow-2xl ring-1 ring-slate-900/10 dark:ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-0.375rem)] bg-white dark:bg-slate-900 p-6 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <h4 id="sts-formula-title" className="font-display font-bold text-slate-900 dark:text-white text-base">
                  Công thức Safe-to-spend (Chức năng 9)
                </h4>
                <button
                  type="button"
                  onClick={() => setShowFormulaModal(false)}
                  aria-label="Đóng hộp thoại"
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                Chỉ số cho biết số tiền an toàn bạn có thể tiêu hôm nay mà không lo bị thâm hụt ngân sách tháng hay thiếu tiền thanh toán các khoản định kỳ sắp tới.
              </p>
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 mb-4 leading-relaxed">
                SafeToSpend = max(0, (Ngân sách còn lại - Khoản định kỳ sắp tới) / Số ngày còn lại)
              </div>
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                className="w-full py-2.5 rounded-full bg-slate-900 dark:bg-brand-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-brand-500 transition-colors cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
export default DashboardPage
