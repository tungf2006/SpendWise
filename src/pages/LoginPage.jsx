import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { signIn, signUp } from '@/services/authService'
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, Sparkles, Zap } from 'lucide-react'

/**
 * Danh sách tài khoản mẫu theo 5 thành viên chính thức của nhóm SpendWise
 */
const DEMO_ACCOUNTS = [
  { label: '👑 Leader (Tùng)', email: 'tung123@gmail.com', pass: '123456', name: 'Phan Thanh Tùng' },
  { label: '👩‍💻 TV1 (Bích Vân)', email: 'van@spendwise.vn', pass: '123456', name: 'Trương Bích Vân' },
  { label: '👨‍💻 TV2 (Nguyên Văn)', email: 'nguyenvan@spendwise.vn', pass: '123456', name: 'Hồ Nguyên Văn' },
  { label: '👨‍💻 TV3 (Tấn Huy)', email: 'huy@spendwise.vn', pass: '123456', name: 'Nguyễn Vũ Tấn Huy' },
  { label: '👨‍💻 TV4 (Hoài Quốc)', email: 'quoc@spendwise.vn', pass: '123456', name: 'Lê Hoài Quốc' },
]

/**
 * Trang Đăng nhập (LoginPage)
 * Phụ trách: TV1 (Trương Bích Vân) - Nhóm chức năng AUTH (UC02)
 */
export const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const navigate = useNavigate()
  const location = useLocation()
  const redirectPath = location.state?.from?.pathname || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setErrorMsg('Vui lòng điền đầy đủ email và mật khẩu')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const { data, error } = await signIn(email, password)
      if (error) throw error

      if (data?.user) {
        navigate(redirectPath, { replace: true })
      }
    } catch (err) {
      if (err.message?.includes('Email not confirmed')) {
        setErrorMsg('Email này chưa được xác thực. Vui lòng kiểm tra hộp thư hoặc tắt "Confirm email" trong Supabase.')
      } else if (err.message?.includes('Invalid login credentials')) {
        setErrorMsg('Email hoặc mật khẩu không chính xác.')
      } else {
        setErrorMsg(err.message || 'Email hoặc mật khẩu không chính xác.')
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Đăng nhập 1-Click với tài khoản Demo hoặc thành viên nhóm
   * Tự động tạo tài khoản nếu tài khoản demo chưa có trong Supabase
   */
  const handleDemoLogin = async (demoEmail = 'demo@spendwise.vn', demoPass = '123456', demoName = 'Người dùng Demo (SpendWise)') => {
    setEmail(demoEmail)
    setPassword(demoPass)
    setLoading(true)
    setErrorMsg('')

    try {
      // 1. Thử đăng nhập tài khoản trước
      let { data, error } = await signIn(demoEmail, demoPass)

      // 2. Nếu tài khoản chưa từng tồn tại trong Auth, tự động đăng ký luôn
      if (error && (error.message?.includes('Invalid login credentials') || error.status === 400)) {
        const { error: signUpError } = await signUp(demoEmail, demoPass, demoName)
        if (signUpError) {
          throw signUpError
        }
        // Thử đăng nhập lại sau khi vừa tạo
        const retry = await signIn(demoEmail, demoPass)
        if (retry.error) throw retry.error
        data = retry.data
      } else if (error) {
        throw error
      }

      if (data?.user) {
        navigate(redirectPath, { replace: true })
      }
    } catch (err) {
      if (err.message?.includes('Email not confirmed')) {
        setErrorMsg(`Tài khoản "${demoEmail}" chưa xác thực email. Vui lòng vào Supabase Dashboard > Authentication > Providers > Email để TẮT "Confirm email", hoặc vào Authentication > Users bấm Confirm email.`)
      } else if (err.message?.includes('Invalid login credentials')) {
        setErrorMsg('Mật khẩu không chính xác hoặc tài khoản chưa được kích hoạt.')
      } else {
        setErrorMsg(err.message || 'Không thể đăng nhập tài khoản demo.')
      }
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
          Đăng nhập vào Spend<span className="text-brand-600">Wise</span>
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Hệ thống quản lý chi tiêu cá nhân thông minh chuẩn Apple
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

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="••••••••"
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
                    {loading ? 'Đang xác thực...' : 'Đăng nhập ngay'}
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

            {/* Phân cách Hoặc Đăng nhập nhanh */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200/80" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                <span className="bg-white px-3 text-slate-400 font-semibold">
                  Hoặc đăng nhập nhanh
                </span>
              </div>
            </div>

            {/* Nút 1-Click Demo & Chọn theo thành viên */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleDemoLogin('demo@spendwise.vn', '123456', 'Người dùng Demo (SpendWise)')}
                disabled={loading}
                className="w-full group py-2.5 px-4 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4 text-emerald-200 animate-pulse" />
                <span>⚡ Đăng nhập 1-Click tài khoản Demo</span>
              </button>

              <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Tài khoản theo từng thành viên:
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Pass: 123456</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => handleDemoLogin(acc.email, acc.pass, acc.name)}
                      disabled={loading}
                      title={`Đăng nhập nhanh với email: ${acc.email}`}
                      className="px-2.5 py-1.5 text-[11px] font-medium rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900 transition-all text-left truncate cursor-pointer shadow-2xs active:scale-[0.97]"
                    >
                      {acc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-slate-500">
              Chưa có tài khoản SpendWise?{' '}
              <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700 hover:underline">
                Đăng ký tài khoản mới
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
export default LoginPage
