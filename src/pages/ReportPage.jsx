import React, { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { formatCurrency } from '@/utils/formatCurrency'
import { getCategoryExpenseBreakdown, getPeriodComparison, getIncomeExpenseTrend } from '@/services/reportService'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { AlertCircle, Calendar, DollarSign, Loader2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'

// Đăng ký các module cốt lõi của Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const BASE_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => BASE_YEAR - 3 + i)

function formatCompactVnd(value) {
  const num = Number(value || 0)
  if (Math.abs(num) >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}tr`
  }
  if (Math.abs(num) >= 1_000) {
    return `${Math.round(num / 1_000)}k`
  }
  return `${num}đ`
}

/**
 * Trang Báo cáo Tài chính & Biểu đồ Chart.js (ReportPage)
 * Phụ trách: TV2 (Hồ Nguyên Văn) - Nhóm chức năng REPORT (UC17)
 */
export const ReportPage = () => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(BASE_YEAR)
  const [period, setPeriod] = useState('month')
  const [trend, setTrend] = useState({ labels: [], income: [], expense: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [donutData, setDonutData] = useState({ labels: [], datasets: [], rawData: [] })
  const [comparison, setComparison] = useState({
    current: { income: 0, expense: 0, net: 0 },
    previous: { income: 0, expense: 0, net: 0 },
    diffExpensePercent: 0,
    diffIncomePercent: 0
  })
  const requestIdRef = useRef(0)

  const loadReportsData = useCallback(async (month, year, activePeriod) => {
    const reqId = ++requestIdRef.current
    try {
      const referenceDate = new Date(year, month - 1, Math.min(new Date().getDate(), new Date(year, month, 0).getDate()))
      const [donutRes, compRes, trendRes] = await Promise.all([
        getCategoryExpenseBreakdown(month, year),
        getPeriodComparison(month, year),
        getIncomeExpenseTrend(activePeriod, referenceDate)
      ])

      if (reqId !== requestIdRef.current) return
      if (donutRes.error) throw donutRes.error
      if (compRes.error) throw compRes.error
      if (trendRes.error) throw trendRes.error

      setDonutData(donutRes)
      setComparison(compRes)
      setTrend(trendRes)
      setLoadError('')
    } catch (err) {
      if (reqId !== requestIdRef.current) return
      console.error('Lỗi khi tải báo cáo:', err)
      setLoadError(err?.message || 'Không thể tải dữ liệu báo cáo tài chính.')
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReportsData(currentMonth, currentYear, period)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [currentMonth, currentYear, period, loadReportsData])

  const hasBarData =
    trend.income.some((val) => Number(val) > 0) ||
    trend.expense.some((val) => Number(val) > 0)

  // Dữ liệu cho Bar Chart so sánh kỳ
  const barChartData = {
    labels: trend.labels,
    datasets: [
      {
        label: 'Thu nhập',
        data: trend.income,
        backgroundColor: '#10B981',
        borderRadius: 8
      },
      {
        label: 'Chi tiêu',
        data: trend.expense,
        backgroundColor: '#EF4444',
        borderRadius: 8
      }
    ]
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phân tích & Thống kê"
        title="Báo cáo Tài chính"
        description="Biểu đồ phân bổ chi tiêu theo danh mục, so sánh biến động dòng tiền giữa 2 kỳ liền kề."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-full bg-slate-100">
              {[
                { value: 'week', label: 'Tuần' },
                { value: 'month', label: 'Tháng' },
                { value: 'year', label: 'Năm' }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setLoading(true)
                    setPeriod(option.value)
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${period === option.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200/80 shadow-2xs text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Chọn tháng báo cáo"
                value={currentMonth}
                onChange={(e) => {
                  setLoading(true)
                  setCurrentMonth(Number(e.target.value))
                }}
                className="bg-transparent font-semibold text-slate-700 outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
              <select
                aria-label="Chọn năm báo cáo"
                value={currentYear}
                onChange={(e) => {
                  setLoading(true)
                  setCurrentYear(Number(e.target.value))
                }}
                className="bg-transparent font-semibold text-slate-700 outline-none"
              >
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        }
      />

      {loadError && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-700 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              void loadReportsData(currentMonth, currentYear, period)
            }}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-rose-200 text-rose-700 font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Summary KPI Cards (Theo tháng đang chọn) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Thu nhập */}
        <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-sm ring-1 ring-slate-900/5">
          <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tổng thu tháng {currentMonth}/{currentYear}</span>
              <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="font-display font-extrabold text-xl text-slate-900">
              {formatCurrency(comparison.current.income)}
            </div>
            <div className="mt-2 text-[11px] flex items-center gap-1 text-slate-500">
              <span>So với tháng trước:</span>
              <strong className={comparison.diffIncomePercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {comparison.diffIncomePercent >= 0 ? '+' : ''}{comparison.diffIncomePercent}%
              </strong>
            </div>
          </div>
        </div>

        {/* Chi tiêu */}
        <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-sm ring-1 ring-slate-900/5">
          <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tổng chi tháng {currentMonth}/{currentYear}</span>
              <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="font-display font-extrabold text-xl text-slate-900">
              {formatCurrency(comparison.current.expense)}
            </div>
            <div className="mt-2 text-[11px] flex items-center gap-1 text-slate-500">
              <span>So với tháng trước:</span>
              <strong className={comparison.diffExpensePercent <= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {comparison.diffExpensePercent >= 0 ? '+' : ''}{comparison.diffExpensePercent}%
              </strong>
            </div>
          </div>
        </div>

        {/* Tiết kiệm ròng */}
        <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-sm ring-1 ring-slate-900/5">
          <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Dòng tiền ròng {currentMonth}/{currentYear}</span>
              <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className={`font-display font-extrabold text-xl ${comparison.current.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(comparison.current.net)}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {comparison.current.net >= 0 ? 'Thặng dư tích lũy tốt' : 'Cần thắt chặt chi tiêu'}
            </div>
          </div>
        </div>

      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Category Expense Donut Chart */}
        <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
          <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 border border-slate-100 flex flex-col justify-between h-full">
            <h3 className="font-display font-bold text-slate-900 text-sm mb-4">
              Cơ cấu Chi tiêu theo Danh mục (Tháng {currentMonth}/{currentYear})
            </h3>

            {loading ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              </div>
            ) : donutData.labels.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400 text-center">
                Chưa có dữ liệu chi tiêu trong tháng {currentMonth}/{currentYear} để vẽ biểu đồ tròn.
              </div>
            ) : (
              <div className="h-64 relative flex items-center justify-center">
                <Doughnut
                  data={donutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 10 } }
                      },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed || 0)}`
                        }
                      }
                    },
                    cutout: '68%'
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Comparison Bar Chart */}
        <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
          <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 border border-slate-100 flex flex-col justify-between h-full">
            <h3 className="font-display font-bold text-slate-900 text-sm mb-4">
              Biến động Thu/Chi theo {period === 'week' ? 'Tuần' : period === 'year' ? 'Năm' : 'Tháng'}
            </h3>

            {loading ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              </div>
            ) : !hasBarData ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400 text-center">
                Chưa có giao dịch thu/chi trong kỳ này để vẽ biểu đồ cột.
              </div>
            ) : (
              <div className="h-64 relative">
                <Bar
                  data={barChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed?.y || 0)}`
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          font: { size: 10 },
                          callback: (value) => formatCompactVnd(value)
                        }
                      },
                      x: {
                        ticks: { font: { size: 10 } }
                      }
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
export default ReportPage
