import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Loader2 } from 'lucide-react'

/**
 * Component bảo vệ các tuyến đường (Route) yêu cầu đăng nhập
 * Nếu chưa đăng nhập -> Chuyển hướng sang /login
 */
export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900">
        <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg ring-4 ring-slate-100 mb-4 animate-bounce">
          <span className="font-display font-black text-sm text-transparent bg-clip-text bg-gradient-to-tr from-brand-200 to-emerald-300">
            SW
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
          <span>Đang xác thực phiên đăng nhập...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    // Lưu lại vị trí trang hiện tại để sau khi đăng nhập xong redirect trở lại
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
