import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { formatCurrency } from '@/utils/formatCurrency'
import { getFinancialSummary, getCategoryExpenseBreakdown, getPeriodComparison } from '@/services/reportService'
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
import { TrendingUp, TrendingDown, DollarSign, Calendar, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react'

// Đăng ký các module cốt lõi của Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

/**
 * Trang Báo cáo Tài chính & Biểu đồ Chart.js (ReportPage)
 * Phụ trách: TV2 (Hồ Nguyên Văn) - Nhóm chức năng REPORT (UC17)
 */
export const ReportPage = () => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [loading, setLoading] = useState(true)

  const [donutData, setDonutData] = useState({ labels: [], datasets: [], rawData: [] })
  const [comparison, setComparison] = useState({
    current: { income: 0, expense: 0, net: 0 },
    previous: { income: 0, expense: 0, net: 0 },
    diffExpensePercent: 0,
    diffIncomePercent: 0
  })

  useEffect(() => {
    async function loadReports() {
      try {
        setLoading(true)
        const [donutRes, compRes] = await Promise.all([
          getCategoryExpenseBreakdown(currentMonth, currentYear),
          getPeriodComparison(currentMonth, currentYear)
        ])

        setDonutData(donutRes)
        setComparison(compRes)
      } catch (err) {
        console.error('Lỗi khi tải báo cáo:', err)
      } finally {
        setLoading(false)
      }
    }

    loadReports()
  }, [currentMonth, currentYear])

  // Dữ liệu cho Bar Chart so sánh kỳ
  const barChartData = {
    labels: [`Tháng ${currentMonth - 1 || 12}`, `Tháng ${currentMonth}`],
    datasets: [
      {
        label: 'Thu nhập',
        data: [comparison.previous.income, comparison.current.income],
        backgroundColor: '#10B981',
        borderRadius: 8
      },
      {
        label: 'Chi tiêu',
        data: [comparison.previous.expense, comparison.current.expense],
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
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200/80 shadow-2xs text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(Number(e.target.value))}
              className="bg-transparent font-semibold text-slate-700 outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Thu nhập */}
        <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-sm ring-1 ring-slate-900/5">
          <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tổng thu tháng</span>
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
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tổng chi tháng</span>
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
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Dòng tiền ròng</span>
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
              Cơ cấu Chi tiêu theo Danh mục
            </h3>

            {loading ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              </div>
            ) : donutData.labels.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                Chưa có dữ liệu chi tiêu trong tháng này để vẽ biểu đồ tròn.
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
              So sánh Thu/Chi 2 kỳ Liền kề
            </h3>

            {loading ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              </div>
            ) : (
              <div className="h-64 relative">
                <Bar
                  data={barChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: { font: { size: 10 } }
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
