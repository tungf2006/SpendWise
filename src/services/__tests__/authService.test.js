import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSignUp = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignOut = vi.fn()
const mockResetPasswordForEmail = vi.fn()
const mockUpdateUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: (...args) => mockSignUp(...args),
      signInWithPassword: (...args) => mockSignInWithPassword(...args),
      signOut: (...args) => mockSignOut(...args),
      resetPasswordForEmail: (...args) => mockResetPasswordForEmail(...args),
      updateUser: (...args) => mockUpdateUser(...args)
    },
    from: (...args) => mockFrom(...args)
  }
}))

import {
  signUp,
  signIn,
  signOut,
  resetPasswordForEmail,
  getProfile,
  updateProfile,
  updatePassword
} from '../authService.js'

describe('authService - UC01 to UC05', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signUp (UC01): truyền đúng email, password và metadata full_name', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u1', email: 'van@uth.edu.vn' } },
      error: null
    })

    const res = await signUp('van@uth.edu.vn', 'Secret123!', 'Trương Bích Vân')
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'van@uth.edu.vn',
      password: 'Secret123!',
      options: { data: { full_name: 'Trương Bích Vân' } }
    })
    expect(res.data.user.id).toBe('u1')
    expect(res.error).toBeNull()
  })

  it('signIn (UC02): đăng nhập thành công và trả lỗi khi sai mật khẩu', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { session: { access_token: 'tok-123' } },
      error: null
    })
    const ok = await signIn('van@uth.edu.vn', 'Secret123!')
    expect(ok.error).toBeNull()
    expect(ok.data.session.access_token).toBe('tok-123')

    mockSignInWithPassword.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid login credentials' }
    })
    const fail = await signIn('van@uth.edu.vn', 'wrong')
    expect(fail.error.message).toBe('Invalid login credentials')
  })

  it('signOut (UC03): gọi supabase.auth.signOut và trả về error nếu có', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    const res = await signOut()
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(res.error).toBeNull()
  })

  it('resetPasswordForEmail & updatePassword (UC04): gửi link /reset-password và đổi mật khẩu', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    const resetRes = await resetPasswordForEmail('van@uth.edu.vn')
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('van@uth.edu.vn', {
      redirectTo: 'http://localhost:5173/reset-password'
    })
    expect(resetRes.error).toBeNull()

    mockUpdateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const updRes = await updatePassword('NewPass456!')
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewPass456!' })
    expect(updRes.error).toBeNull()
    vi.unstubAllGlobals()
  })

  it('getProfile (UC05): sử dụng maybeSingle() để tránh lỗi PGRST116 khi chưa có dòng profile', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    }
    mockFrom.mockReturnValue(mockQuery)

    const res = await getProfile('u1')
    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'u1')
    expect(mockQuery.maybeSingle).toHaveBeenCalledTimes(1)
    expect(res.data).toBeNull()
    expect(res.error).toBeNull()
  })

  it('updateProfile (UC05): chỉ whitelist các trường hợp lệ và dùng upsert()', async () => {
    const mockQuery = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'u1', full_name: 'Nguyễn A', default_bank_bin: '970436' },
        error: null
      })
    }
    mockFrom.mockReturnValue(mockQuery)

    const res = await updateProfile('u1', {
      full_name: 'Nguyễn A',
      default_bank_bin: '970436',
      role: 'admin',
      is_superadmin: true
    })

    const upsertArg = mockQuery.upsert.mock.calls[0][0]
    expect(upsertArg.id).toBe('u1')
    expect(upsertArg.full_name).toBe('Nguyễn A')
    expect(upsertArg.default_bank_bin).toBe('970436')
    expect(upsertArg.role).toBeUndefined()
    expect(upsertArg.is_superadmin).toBeUndefined()
    expect(res.error).toBeNull()
  })
})
