import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { useTheme } from '@/context/useTheme'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { Loader2, Moon, Sun } from 'lucide-react'

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

function PublicLayout() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 transition-colors">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
        title={isDark ? 'Giao diện sáng' : 'Giao diện tối'}
        className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/85 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 backdrop-blur-md border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-soft-md flex items-center justify-center transition-all active:scale-95 cursor-pointer"
      >
        {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
      </button>
      <Outlet />
    </div>
  )
}

const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const TransactionPage = lazy(() => import('@/pages/TransactionPage'))
const WalletPage = lazy(() => import('@/pages/WalletPage'))
const CategoryPage = lazy(() => import('@/pages/CategoryPage'))
const BudgetPage = lazy(() => import('@/pages/BudgetPage'))
const ReportPage = lazy(() => import('@/pages/ReportPage'))
const GoalPage = lazy(() => import('@/pages/GoalPage'))
const RecurringPage = lazy(() => import('@/pages/RecurringPage'))
const BillSplitVietQR = lazy(() => import('@/pages/BillSplitVietQR'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center bg-transparent text-slate-500 dark:text-slate-400 text-xs gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-brand-600 dark:text-brand-500" />
      <span>Đang tải giao diện...</span>
    </div>
  )
}

export function App() {
  return (
    <ErrorBoundary fullScreen>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Routes (Có nút chuyển đổi Dark/Light nổi) */}
                <Route element={<PublicLayout />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                </Route>

                {/* Protected Routes (Bắt buộc đăng nhập, nằm trong AppLayout) */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="transactions" element={<TransactionPage />} />
                  <Route path="wallets" element={<WalletPage />} />
                  <Route path="categories" element={<CategoryPage />} />
                  <Route path="budgets" element={<BudgetPage />} />
                  <Route path="reports" element={<ReportPage />} />
                  <Route path="goals" element={<GoalPage />} />
                  <Route path="recurring" element={<RecurringPage />} />
                  <Route path="bill-split" element={<BillSplitVietQR />} />
                  <Route path="profile" element={<ProfilePage />} />
                </Route>

                {/* 404 Catch-all (Có nút chuyển đổi Dark/Light nổi) */}
                <Route element={<PublicLayout />}>
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
