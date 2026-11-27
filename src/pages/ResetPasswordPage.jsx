import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Link } from 'react-router-dom'
import { updatePassword } from '@/services/authService'
import {
  Lock,
  KeyRound,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

const EXPIRED_LINK_MESSAGE =
  'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [recoveryReady, setRecoveryReady] = useState(false)

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.localStorage.getItem('spendwise_theme') === 'dark'
    ) {
      document.documentElement.classList.add('dark')
    }
  }, [])

  useEffect(() => {
    // Capture URL recovery params synchronously before GoTrueClient finishes clearing them
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, '')
    )
    const searchParams = new URLSearchParams(window.location.search)
    const rawUrlError =
      hashParams.get('error_description') ||
      searchParams.get('error_description') ||
      hashParams.get('error') ||
      searchParams.get('error')
    const code = searchParams.get('code')
    const hasRecoveryCredential =
      Boolean(hashParams.get('access_token')) || Boolean(code)
    const hasUrlErrorOnly = Boolean(rawUrlError) && !hasRecoveryCredential
    const isRecoveryUrl =
      hashParams.get('type') === 'recovery' ||
      searchParams.get('type') === 'recovery' ||
      hasRecoveryCredential

    let mounted = true
    let hasRecovered = false

    const markRecoveryReady = () => {
      hasRecovered = true
      setRecoveryReady(true)
      setErrorMessage('')
      setVerifying(false)
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (
        event === 'PASSWORD_RECOVERY' ||
        (!hasUrlErrorOnly &&
          session &&
          (event === 'INITIAL_SESSION' ||
            event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED'))
      ) {
        markRecoveryReady()
      } else if (event === 'SIGNED_OUT') {
        hasRecovered = false
        setRecoveryReady(false)
      }
    })

    const resolveRecoverySession = async () => {
      try {
        if (hasUrlErrorOnly) {
          hasRecovered = false
          setRecoveryReady(false)
          setErrorMessage(EXPIRED_LINK_MESSAGE)
          return
        }

        const { data, error: sessionError } = await supabase.auth.getSession()
        if (!mounted) return

        if (data?.session) {
          markRecoveryReady()
          return
        }

        if (code) {
          const { data: exchangeData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code)
          if (!mounted) return

          if (!exchangeError && exchangeData?.session) {
            const cleanSearch = new URLSearchParams(window.location.search)
            cleanSearch.delete('code')
            const searchString = cleanSearch.toString()
            const cleanUrl = `${window.location.pathname}${
              searchString ? `?${searchString}` : ''
            }${window.location.hash}`
            window.history.replaceState(window.history.state, '', cleanUrl)
            markRecoveryReady()
            return
          }

          if (!hasRecovered) {
            setErrorMessage(EXPIRED_LINK_MESSAGE)
          }
        } else if ((rawUrlError || sessionError || isRecoveryUrl) && !hasRecovered) {
          setErrorMessage(EXPIRED_LINK_MESSAGE)
        }
      } catch {
        if (mounted && !hasRecovered) {
          setErrorMessage(EXPIRED_LINK_MESSAGE)
        }
      } finally {
        if (mounted) {
          setVerifying(false)
        }
      }
    }

    void resolveRecoverySession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    if (!recoveryReady) {
      setErrorMessage(
        'Vui lòng mở liên kết đặt lại mật khẩu mới nhất từ email.'
      )
      return
    }

    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.')
      return
    }

    setLoading(true)

    try {
      const { error } = await updatePassword(password)

      if (error) throw error

      setPassword('')
      setConfirmPassword('')
      setSuccess(true)
    } catch (error) {
      setErrorMessage(
        error.message ||
          'Không thể đổi mật khẩu. Liên kết có thể đã hết hạn hoặc không hợp lệ.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shadow-lg ring-4 ring-slate-100 dark:ring-slate-800/80 mb-3">
          <span className="font-display font-black text-sm tracking-tighter text-transparent bg-clip-text bg-gradient-to-tr from-brand-200 to-emerald-300">
            SW
          </span>
        </div>
        <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight text-slate-900">
          Đặt lại mật khẩu Spend<span className="text-brand-600 dark:text-blue-400">Wise</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Thiết lập mật khẩu mới để bảo vệ tài khoản của bạn
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Card thiết kế Double-Bezel */}
        <div className="rounded-[2rem] bg-white/70 p-1.5 shadow-soft-xl ring-1 ring-slate-900/5 dark:ring-white/10 backdrop-blur-xl">
          <div className="rounded-[calc(2rem-0.375rem)] bg-white p-6 sm:p-8 border border-slate-100 shadow-sm">
            {verifying ? (
              <div className="py-8 text-center space-y-3" role="status">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600 dark:text-blue-400 mx-auto" />
                <p className="text-xs sm:text-sm font-medium text-slate-600">
                  Đang xác thực liên kết đặt lại mật khẩu...
                </p>
              </div>
            ) : success ? (
              <div className="space-y-5">
                <div
                  role="status"
                  className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 flex items-start gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Mật khẩu đã được cập nhật thành công.</span>
                </div>

                <Link
                  to="/login"
                  className="w-full group py-3 px-5 rounded-full bg-slate-900 dark:bg-brand-600 dark:hover:bg-brand-500 text-white font-medium text-xs sm:text-sm flex items-center justify-between shadow-soft-md hover:bg-slate-800 active:scale-[0.98] transition-all duration-300"
                >
                  <span className="font-semibold">Đến trang đăng nhập</span>
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="w-3.5 h-3.5 text-white" />
                  </div>
                </Link>
              </div>
            ) : !recoveryReady ? (
              <div className="space-y-5">
                <div
                  role="alert"
                  className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/60 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs sm:text-sm"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage || EXPIRED_LINK_MESSAGE}</span>
                </div>

                <Link
                  to="/forgot-password"
                  className="w-full group py-3 px-5 rounded-full bg-slate-900 dark:bg-brand-600 dark:hover:bg-brand-500 text-white font-medium text-xs sm:text-sm flex items-center justify-between shadow-soft-md hover:bg-slate-800 active:scale-[0.98] transition-all duration-300"
                >
                  <span className="font-semibold">Yêu cầu liên kết mới</span>
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="w-3.5 h-3.5 text-white" />
                  </div>
                </Link>

                <div className="text-center text-xs text-slate-500">
                  Nhớ lại mật khẩu?{' '}
                  <Link
                    to="/login"
                    className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    Quay lại đăng nhập
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {errorMessage && (
                  <div
                    role="alert"
                    className="mb-5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/60 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="new-password"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      Mật khẩu mới
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="new-password"
                        type="password"
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Tối thiểu 6 ký tự"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      Xác nhận mật khẩu mới
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        id="confirm-password"
                        type="password"
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        placeholder="Nhập lại mật khẩu mới"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full group py-3 px-5 rounded-full bg-slate-900 dark:bg-brand-600 dark:hover:bg-brand-500 text-white font-medium text-xs sm:text-sm flex items-center justify-between shadow-soft-md hover:bg-slate-800 active:scale-[0.98] transition-all duration-300 disabled:opacity-60 cursor-pointer"
                    >
                      <span className="font-semibold">
                        {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
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

                <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
                  <Link
                    to="/forgot-password"
                    className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    Yêu cầu liên kết mới
                  </Link>
                  <Link
                    to="/login"
                    className="font-semibold text-brand-600 dark:text-blue-400 hover:underline"
                  >
                    Quay lại đăng nhập
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
