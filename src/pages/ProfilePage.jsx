import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { updateProfile, updatePassword } from '@/services/authService'
import { POPULAR_BANKS } from '@/services/vietqrService'
import { PageHeader } from '@/components/common/PageHeader'
import { User, Mail, CreditCard, LogOut, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

/**
 * Trang Hồ sơ cá nhân (ProfilePage)
 * Phụ trách: TV1 (Trương Bích Vân) - Nhóm chức năng AUTH (UC05)
 */
export const ProfilePage = () => {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [bankBin, setBankBin] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState({
    type: '',
    text: '',
  })

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setBankBin(profile.default_bank_bin || '')
      setBankAccount(profile.default_bank_account || '')
    } else if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name)
    }
  }, [profile, user])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!user) return
        if (!fullName.trim()) {
      setStatusMsg({
        type: 'error',
        text: 'Vui lòng nhập họ tên hiển thị.',
      })
      return
    }

    if (bankAccount.trim() && !/^\d+$/.test(bankAccount.trim())) {
      setStatusMsg({
        type: 'error',
        text: 'Số tài khoản ngân hàng chỉ được chứa chữ số.',
      })
      return
    }

    setLoading(true)
    setStatusMsg({ type: '', text: '' })

    try {
      const { error } = await updateProfile(user.id, {
        full_name: fullName.trim(),
        default_bank_bin: bankBin,
        default_bank_account: bankAccount.trim()
      })

      if (error) throw error

      await refreshProfile()
      setStatusMsg({ type: 'success', text: 'Cập nhật hồ sơ cá nhân thành công!' })
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Lỗi khi cập nhật hồ sơ' })
    } finally {
      setLoading(false)
    }
  }
    const handleChangePassword = async (event) => {
    event.preventDefault()
    setPasswordMessage({ type: '', text: '' })

    if (newPassword.length < 6) {
      setPasswordMessage({
        type: 'error',
        text: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
      })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: 'error',
        text: 'Mật khẩu xác nhận không khớp.',
      })
      return
    }

    setPasswordLoading(true)

    try {
      const { error } = await updatePassword(newPassword)

      if (error) throw error

      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage({
        type: 'success',
        text: 'Đổi mật khẩu thành công.',
      })
    } catch (error) {
      setPasswordMessage({
        type: 'error',
        text: error.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.',
      })
    } finally {
      setPasswordLoading(false)
    }
  }
    const handleSignOut = async () => {
    setLoading(true)
    setStatusMsg({ type: '', text: '' })

    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      setStatusMsg({
        type: 'error',
        text: error.message || 'Không thể đăng xuất. Vui lòng thử lại.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tài khoản cá nhân"
        title="Hồ sơ & Cài đặt VietQR"
        description="Quản lý thông tin tài khoản và số tài khoản ngân hàng mặc định phục vụ tính năng chia tiền VietQR."
        actions={
          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-2 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-2 border border-rose-200/60 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* User Card */}
        <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
          <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 border border-slate-100 text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-soft-lg ring-4 ring-slate-100 mb-3">
              {(fullName || user?.email || 'SW').slice(0, 2).toUpperCase()}
            </div>
            <h3 className="font-display font-bold text-base text-slate-900">{fullName || 'Người dùng SpendWise'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>

            <div className="w-full mt-6 pt-4 border-t border-slate-100 space-y-2 text-left text-xs">
              <div className="flex justify-between py-1 text-slate-500">
                <span>Trạng thái:</span>
                <span className="font-semibold text-emerald-600">Đang hoạt động</span>
              </div>
              <div className="flex justify-between py-1 text-slate-500">
                <span>Tham gia:</span>
                <span className="font-medium text-slate-700">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : 'Mới tham gia'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Profile Form */}
        <div className="md:col-span-2 rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
          <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 sm:p-8 border border-slate-100">
            <h3 className="font-display font-bold text-base text-slate-900 mb-4">
              Thông tin nhận chuyển khoản mặc định
            </h3>

            {statusMsg.text && (
              <div
                className={`mb-5 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {statusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{statusMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Họ và tên hiển thị
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
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email tài khoản (Không thể đổi)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-full text-xs sm:text-sm text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ngân hàng mặc định (VietQR)
                  </label>
                  <select
                    value={bankBin}
                    onChange={(e) => setBankBin(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    <option value="">-- Chọn ngân hàng --</option>
                    {POPULAR_BANKS.map((bank) => (
                      <option key={bank.bin} value={bank.bin}>
                        {bank.shortName} ({bank.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Số tài khoản ngân hàng
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="VD: 0123456789"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm shadow-soft-sm transition-all duration-200 active:scale-95 disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  <span>{loading ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                </button>
              </div>
            </form>
            <div className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="font-display font-bold text-base text-slate-900">
                Đổi mật khẩu
              </h3>

              {passwordMessage.text && (
                <p
                  role={passwordMessage.type === 'error' ? 'alert' : 'status'}
                  className={`mt-4 rounded-2xl p-3 text-sm ${
                    passwordMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {passwordMessage.text}
                </p>
              )}

              <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="profile-new-password"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Mật khẩu mới
                  </label>

                  <input
                    id="profile-new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="mt-2 w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-confirm-password"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Xác nhận mật khẩu mới
                  </label>

                  <input
                    id="profile-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    className="mt-2 w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {passwordLoading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                </button>
              </form>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
export default ProfilePage
