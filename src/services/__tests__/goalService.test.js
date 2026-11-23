import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: rpcMock,
  },
}))

import { depositToGoal } from '../goalService'

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
