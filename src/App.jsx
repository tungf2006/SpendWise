import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'

// Pages
import DashboardPage from '@/pages/DashboardPage'
import TransactionPage from '@/pages/TransactionPage'
import WalletPage from '@/pages/WalletPage'
import CategoryPage from '@/pages/CategoryPage'
import BudgetPage from '@/pages/BudgetPage'
import ReportPage from '@/pages/ReportPage'
import GoalPage from '@/pages/GoalPage'
import RecurringPage from '@/pages/RecurringPage'
import BillSplitVietQR from '@/pages/BillSplitVietQR'
import ProfilePage from '@/pages/ProfilePage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import NotFoundPage from '@/pages/NotFoundPage'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes (Không yêu cầu đăng nhập) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

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
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
