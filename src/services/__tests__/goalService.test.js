import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpcMock, getUserMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: rpcMock,
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
  },
}))

import {
  createGoal,
  updateGoal,
  deleteGoal,
  depositToGoal,
} from '../goalService'

describe('depositToGoal', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('gọi RPC với đúng mục tiêu, ví và số tiền', async () => {
    const result = {
      walletBalance: 500000,
      currentAmount: 1000000,
      isCompleted: true,
    }

    rpcMock.mockResolvedValue({ data: result, error: null })

    const response = await depositToGoal({
      goalId: 'goal-1',
      walletId: 'wallet-1',
      amount: '500000',
    })

    expect(rpcMock).toHaveBeenCalledWith('deposit_to_goal', {
      p_goal_id: 'goal-1',
      p_wallet_id: 'wallet-1',
      p_amount: 500000,
    })
    expect(response).toEqual({ data: result, error: null })
  })

  it.each([0, -1, 'khong-phai-so', Infinity])(
    'từ chối số tiền không hợp lệ: %s',
    async (amount) => {
      const response = await depositToGoal({
        goalId: 'goal-1',
        walletId: 'wallet-1',
        amount,
      })

      expect(response.data).toBeNull()
      expect(response.error).toBeTruthy()
      expect(rpcMock).not.toHaveBeenCalled()
    }
  )

  it('từ chối khi chưa chọn ví', async () => {
    const response = await depositToGoal({
      goalId: 'goal-1',
      walletId: '',
      amount: 100000,
    })

    expect(response.error).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('trả lỗi khi database từ chối giao dịch', async () => {
    const databaseError = new Error('Số dư ví không đủ')
    rpcMock.mockResolvedValue({ data: null, error: databaseError })

    const response = await depositToGoal({
      goalId: 'goal-1',
      walletId: 'wallet-1',
      amount: 100000,
    })

    expect(response.data).toBeNull()
    expect(response.error).toBe(databaseError)
  })
})

describe('createGoal / updateGoal / deleteGoal (R3 #9 Ownership & Whitelisting)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-001' } },
      error: null,
    })
  })

  describe('createGoal', () => {
    it('từ chối khi chưa đăng nhập, tên rỗng hoặc target_amount không hợp lệ', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })
      const unauth = await createGoal({ name: 'Mua xe', target_amount: 1000000 })
      expect(unauth.data).toBeNull()
      expect(unauth.error.message).toContain('chưa đăng nhập')

      const blankName = await createGoal({ name: '   ', target_amount: 1000000 })
      expect(blankName.error.message).toContain('Tên mục tiêu')

      const nanAmount = await createGoal({ name: 'Mua xe', target_amount: Number.NaN })
      expect(nanAmount.error.message).toContain('lớn hơn 0')
      expect(fromMock).not.toHaveBeenCalled()
    })

    it('trim tên và tạo mục tiêu với user_id của phiên hiện tại', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'g-1', name: 'Mua laptop' }, error: null }),
        }),
      })
      fromMock.mockReturnValue({ insert: insertMock })

      const res = await createGoal({ name: '  Mua laptop  ', target_amount: '20000000' })
      expect(res.error).toBeNull()
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-001',
        name: 'Mua laptop',
        target_amount: 20000000,
        status: 'in_progress',
      }))
    })
  })

  describe('updateGoal', () => {
    it('kiểm tra id, updates object và trạng thái đăng nhập', async () => {
      expect((await updateGoal('', { name: 'A' })).error).toBeTruthy()
      expect((await updateGoal('g-1', null)).error).toBeTruthy()
      expect((await updateGoal('g-1', [])).error).toBeTruthy()

      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })
      const unauth = await updateGoal('g-1', { name: 'A' })
      expect(unauth.error.message).toContain('chưa đăng nhập')
      expect(fromMock).not.toHaveBeenCalled()
    })

    it('chỉ whitelist name, target_amount, deadline, wallet_id, status và ràng buộc user_id', async () => {
      const singleMock = vi.fn().mockResolvedValue({ data: { id: 'g-1', name: 'Quỹ mới' }, error: null })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const eqUserMock = vi.fn().mockReturnValue({ select: selectMock })
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqUserMock })
      const updateMock = vi.fn().mockReturnValue({ eq: eqIdMock })
      fromMock.mockReturnValue({ update: updateMock })

      const res = await updateGoal('g-1', {
        id: 'hacked-id',
        user_id: 'other-user',
        current_amount: 999999999,
        created_at: '2000-01-01',
        name: '  Quỹ mới  ',
        target_amount: '5000000',
        deadline: '2026-12-31',
        wallet_id: 'w-1',
        status: 'completed',
      })

      expect(res.error).toBeNull()
      expect(updateMock).toHaveBeenCalledWith({
        name: 'Quỹ mới',
        target_amount: 5000000,
        deadline: '2026-12-31',
        wallet_id: 'w-1',
        status: 'completed',
      })
      expect(eqIdMock).toHaveBeenCalledWith('id', 'g-1')
      expect(eqUserMock).toHaveBeenCalledWith('user_id', 'user-001')
    })

    it('từ chối tên rỗng, target_amount <= 0, status sai hoặc chỉ có trường không hợp lệ', async () => {
      expect((await updateGoal('g-1', { name: '   ' })).error).toBeTruthy()
      expect((await updateGoal('g-1', { target_amount: 0 })).error).toBeTruthy()
      expect((await updateGoal('g-1', { target_amount: Number.NaN })).error).toBeTruthy()
      expect((await updateGoal('g-1', { status: 'hacked' })).error).toBeTruthy()
      expect((await updateGoal('g-1', { current_amount: 999 })).error).toBeTruthy()
      expect(fromMock).not.toHaveBeenCalled()
    })
  })

  describe('deleteGoal', () => {
    it('yêu cầu id, auth.getUser và ràng buộc .eq(id).eq(user_id)', async () => {
      expect((await deleteGoal('')).error).toBeTruthy()

      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })
      const unauth = await deleteGoal('g-1')
      expect(unauth.error.message).toContain('chưa đăng nhập')

      const eqUserMock = vi.fn().mockResolvedValue({ error: null })
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqUserMock })
      const deleteMock = vi.fn().mockReturnValue({ eq: eqIdMock })
      fromMock.mockReturnValue({ delete: deleteMock })

      const res = await deleteGoal('g-1')
      expect(res.error).toBeNull()
      expect(eqIdMock).toHaveBeenCalledWith('id', 'g-1')
      expect(eqUserMock).toHaveBeenCalledWith('user_id', 'user-001')
    })
  })
})
