import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUp } from '@/services/authService'
import { Mail, Lock, User, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Trang Đăng ký (RegisterPage)
 * Phụ trách: TV1 (Trương Bích Vân) - Nhóm chức năng AUTH (UC01)
 */
export const RegisterPage = () => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password || !fullName) {
      setErrorMsg('Vui lòng điền đầy đủ họ tên, email và mật khẩu')
      return
    }

    if (password.length < 6) {
      setErrorMsg('Mật khẩu phải chứa ít nhất 6 ký tự')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const { data, error } = await signUp(email, password, fullName)
      if (error) throw error

      if (data?.session) {
        setSuccessMsg('Đăng ký tài khoản thành công! Đang chuyển hướng vào hệ thống...')
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 1200)
      } else {
        setSuccessMsg('Đăng ký tài khoản thành công! Supabase đã gửi email xác nhận. Vui lòng kiểm tra hộp thư kích hoạt (hoặc tắt "Confirm email" trong Supabase để đăng nhập ngay).')
        setTimeout(() => {
          navigate('/login', { replace: true })
        }, 3000)
      }
    } catch (err) {
      setErrorMsg(err.message || 'Đăng ký không thành công. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg ring-4 ring-slate-100 mb-3">
          <span className="font-display font-black text-sm tracking-tighter text-transparent bg-clip-text bg-gradient-to-tr from-brand-200 to-emerald-300">
            SW
          </span>
        </div>
        <h2 className="font-display font-black text-2xl sm:text-3xl tracking-tight text-slate-900">
          Tạo tài khoản Spend<span className="text-brand-600">Wise</span>
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Bắt đầu hành trình tự do tài chính cùng trợ lý AI cá nhân
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Card thiết kế Double-Bezel */}
        <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-xl ring-1 ring-slate-900/5 backdrop-blur-xl">
          <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 sm:p-8 border border-slate-100 shadow-2xs">
            
            {errorMsg && (
              <div className="mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-2.5 text-emerald-700 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Họ và tên
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Địa chỉ Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full group py-3 px-5 rounded-full bg-slate-900 text-white font-medium text-xs sm:text-sm flex items-center justify-between shadow-soft-md hover:bg-slate-800 active:scale-[0.98] transition-all duration-300 disabled:opacity-60 cursor-pointer"
                >
                  <span className="font-semibold">
                    {loading ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản'}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                </button>
              </div>
            </form>

            <div className="mt-6 text-center text-xs text-slate-500">
              Đã có tài khoản SpendWise?{' '}
              <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700 hover:underline">
                Đăng nhập tại đây
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
export default RegisterPage
