import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { Loader2 } from 'lucide-react'

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
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
    <div className="min-h-[50vh] flex items-center justify-center text-slate-400 text-xs gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
      <span>Đang tải giao diện...</span>
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes (Không yêu cầu đăng nhập) */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

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

            {/* 404 Catch-all */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
