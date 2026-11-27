import React from 'react'
import { AlertTriangle, Home, RefreshCw, RotateCcw } from 'lucide-react'

/**
 * ErrorBoundary bắt lỗi runtime trong cây React và hiển thị màn hình khôi phục Double-Bezel.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      prevResetKey: props.resetKey,
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error: error instanceof Error ? error : new Error(String(error || 'Lỗi không xác định')),
    }
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.resetKey !== prevState.prevResetKey) {
      return {
        hasError: false,
        error: null,
        prevResetKey: nextProps.resetKey,
      }
    }
    return null
  }

  componentDidCatch(error, errorInfo) {
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo)
    } else {
      console.error('ErrorBoundary đã bắt được lỗi giao diện:', error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (typeof this.props.onReset === 'function') {
      this.props.onReset()
    }
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.assign('/')
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { fullScreen = false } = this.props
    const errorMessage =
      this.state.error?.message || 'Đã xảy ra sự cố ngoài ý muốn khi hiển thị giao diện.'

    return (
      <div
        role="alert"
        className={`${
          fullScreen ? 'min-h-screen' : 'min-h-[55vh]'
        } flex items-center justify-center p-4 bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 font-sans`}
      >
        <div className="w-full max-w-lg rounded-[2rem] bg-slate-200/60 dark:bg-slate-800/75 p-1.5 shadow-soft-xl ring-1 ring-slate-900/5 dark:ring-white/10">
          <div className="rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111827] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/60 text-rose-600 dark:text-rose-300 flex items-center justify-center shadow-sm">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-slate-100 tracking-tight">
              Giao diện gặp sự cố tạm thời
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Ứng dụng vừa ghi nhận một lỗi không mong muốn. Dữ liệu tài chính của bạn vẫn an toàn.
            </p>

            <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 px-4 py-3 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                Chi tiết lỗi
              </p>
              <p className="text-xs font-mono text-rose-700 dark:text-rose-300 break-words">
                {errorMessage}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-full bg-slate-900 dark:bg-brand-600 hover:bg-slate-800 dark:hover:bg-brand-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tải lại trang</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-4 py-2.5 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Về trang chủ</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
