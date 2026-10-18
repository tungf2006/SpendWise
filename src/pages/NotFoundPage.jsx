import React from 'react'
import { Link } from 'react-router-dom'
import { Home, AlertCircle } from 'lucide-react'

export const NotFoundPage = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 font-sans">
      <div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg ring-4 ring-slate-100 mb-4">
        <AlertCircle className="w-8 h-8 text-amber-300" />
      </div>
      <h1 className="font-display font-black text-4xl sm:text-5xl text-slate-900 tracking-tight mb-2">
        404
      </h1>
      <p className="font-display font-bold text-lg text-slate-800 mb-1">
        Trang không tồn tại
      </p>
      <p className="text-xs sm:text-sm text-slate-500 max-w-sm mb-6">
        Đường dẫn bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.
      </p>
      <Link
        to="/"
        className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 shadow-soft-sm transition-transform active:scale-95"
      >
        <Home className="w-4 h-4" />
        <span>Về trang chủ</span>
      </Link>
    </div>
  )
}
export default NotFoundPage
