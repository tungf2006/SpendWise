import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Link } from 'react-router-dom'
import { updatePassword } from '@/services/authService'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [recoveryReady, setRecoveryReady] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryReady(true)
        }
      }
    )

    return () => subscription.unsubscribe()
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900">
          Đặt lại mật khẩu
        </h1>

        {success ? (
          <div className="mt-6 space-y-4">
            <p
              role="status"
              className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
            >
              Mật khẩu đã được cập nhật thành công.
            </p>

            <Link
              to="/login"
              className="inline-block text-sm font-semibold text-emerald-700"
            >
              Đến trang đăng nhập
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-500">
              Nhập mật khẩu mới sau khi mở liên kết trong email.
            </p>

            {errorMessage && (
              <p
                role="alert"
                className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
              >
                {errorMessage}
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Mật khẩu mới
                </label>

                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Xác nhận mật khẩu mới
                </label>

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
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
              </button>
            </form>

            <Link
              to="/forgot-password"
              className="mt-5 inline-block text-sm font-semibold text-emerald-700"
            >
              Yêu cầu liên kết mới
            </Link>
          </>
        )}
      </div>
    </div>
  )
}