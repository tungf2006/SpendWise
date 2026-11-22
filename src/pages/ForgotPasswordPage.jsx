import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { resetPasswordForEmail } from '@/services/authService'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setErrorMessage('Vui lòng nhập địa chỉ email.')
      return
    }

    setLoading(true)
    setMessage('')
    setErrorMessage('')

    try {
      const { error } = await resetPasswordForEmail(trimmedEmail)

      if (error) throw error

      setMessage(
        'Nếu email này đã được đăng ký, hãy kiểm tra hộp thư để nhận liên kết đặt lại mật khẩu.'
      )
    } catch (error) {
      setErrorMessage(
        error.message || 'Không thể gửi yêu cầu. Vui lòng thử lại.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900">
          Quên mật khẩu
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.
        </p>

        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
          >
            {message}
          </p>
        )}

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
              htmlFor="recovery-email"
              className="block text-sm font-semibold text-slate-700"
            >
              Địa chỉ email
            </label>

            <input
              id="recovery-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ban@example.com"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại mật khẩu'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link to="/login" className="font-semibold text-emerald-700">
            Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </div>
  )
}