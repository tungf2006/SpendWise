import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuthGetUser = vi.fn()
const mockRpc = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: (...args) => mockAuthGetUser(...args)
    },
    rpc: (...args) => mockRpc(...args),
    from: (...args) => mockFrom(...args)
  }
}))

import {
  getWallets,
  createWallet,
  updateWallet,
  archiveWallet,
  deleteWallet,
  transferFunds
} from '../walletService.js'

describe('walletService - UC06 to UC09', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-001', email: 'test@spendwise.vn' } },
      error: null
    })
  })

  describe('getWallets (UC06)', () => {
    it('lấy danh sách ví chưa ẩn theo mặc định', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ id: 'w1', name: 'Tiền mặt', is_archived: false }],
          error: null
        })
      }
      mockFrom.mockReturnValue(mockQuery)

      const result = await getWallets()
      expect(mockFrom).toHaveBeenCalledWith('wallets')
      expect(mockQuery.eq).toHaveBeenCalledWith('is_archived', false)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Tiền mặt')
    })

    it('cho phép lấy cả ví đã ẩn khi includeArchived = true', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: 'w1', name: 'Tiền mặt', is_archived: false },
            { id: 'w2', name: 'Ví cũ', is_archived: true }
          ],
          error: null
        })
      }
      mockFrom.mockReturnValue(mockQuery)

      const result = await getWallets(true)
      expect(result.data).toHaveLength(2)
    })
  })

  describe('createWallet (UC06)', () => {
    it('tạo ví mới thành công với dữ liệu hợp lệ', async () => {
      const insertedWallet = {
        id: 'w-new',
        name: 'Techcombank',
        type: 'bank',
        balance: 5000000,
        color: '#3B82F6',
        icon: 'credit-card',
        is_archived: false
      }

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: insertedWallet, error: null })
      }
      mockFrom.mockReturnValue(mockQuery)

      const result = await createWallet({
        name: '  Techcombank  ',
        type: 'bank',
        balance: '5000000',
        color: '#3B82F6',
        icon: 'credit-card'
      })

      expect(mockQuery.insert).toHaveBeenCalledWith({
        user_id: 'user-001',
        name: 'Techcombank',
        type: 'bank',
        balance: 5000000,
        color: '#3B82F6',
        icon: 'credit-card',
        is_archived: false
      })
      expect(result.data.id).toBe('w-new')
      expect(result.error).toBeNull()
    })

    it('từ chối khi tên ví rỗng', async () => {
      const result = await createWallet({ name: '   ', type: 'cash' })
      expect(result.data).toBeNull()
      expect(result.error.message).toContain('Tên ví không được để trống')
    })

    it('từ chối khi người dùng chưa đăng nhập', async () => {
      mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
      const result = await createWallet({ name: 'Ví tiền mặt', type: 'cash' })
      expect(result.data).toBeNull()
      expect(result.error.message).toContain('chưa đăng nhập')
    })
  })

  describe('updateWallet & archiveWallet (UC07, UC08)', () => {
    it('cập nhật thông tin ví thành công', async () => {
      const updated = { id: 'w1', name: 'Tiền mặt cập nhật', balance: 200000 }
      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updated, error: null })
      }
      mockFrom.mockReturnValue(mockQuery)

      const result = await updateWallet('w1', {
        name: '  Tiền mặt cập nhật  ',
        balance: '200000'
      })

      expect(mockQuery.update).toHaveBeenCalledWith({
        name: 'Tiền mặt cập nhật',
        balance: 200000
      })
      expect(result.data.name).toBe('Tiền mặt cập nhật')
    })

    it('từ chối cập nhật khi tên rỗng hoặc thiếu ID', async () => {
      const resNoId = await updateWallet('', { name: 'Ví mới' })
      expect(resNoId.error.message).toContain('Thiếu ID ví')

      const resEmptyName = await updateWallet('w1', { name: '  ' })
      expect(resEmptyName.error.message).toContain('Tên ví không được để trống')
    })

    it('archiveWallet đánh dấu is_archived = true', async () => {
      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'w1', is_archived: true }, error: null })
      }
      mockFrom.mockReturnValue(mockQuery)

      const result = await archiveWallet('w1')
      expect(mockQuery.update).toHaveBeenCalledWith({ is_archived: true })
      expect(result.data.is_archived).toBe(true)
    })

    it('deleteWallet xóa ví theo id', async () => {
      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      }
      mockFrom.mockReturnValue(mockQuery)

      const result = await deleteWallet('w1')
      expect(mockQuery.delete).toHaveBeenCalled()
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'w1')
      expect(result.error).toBeNull()
    })
  })

  describe('transferFunds (UC09, R1 Atomic RPC & TOCTOU Protection)', () => {
    it('chặn các tham số không hợp lệ (thiếu ví, trùng ví, số tiền <= 0)', async () => {
      const resMissing = await transferFunds({ fromWalletId: '', toWalletId: 'w2', amount: 100000 })
      expect(resMissing.error.message).toContain('Thiếu ví nguồn hoặc ví đích')

      const resSame = await transferFunds({ fromWalletId: 'w1', toWalletId: 'w1', amount: 100000 })
      expect(resSame.error.message).toContain('không được trùng nhau')

      const resZero = await transferFunds({ fromWalletId: 'w1', toWalletId: 'w2', amount: 0 })
      expect(resZero.error.message).toContain('phải lớn hơn 0')
    })

    it('gọi atomic RPC transfer_funds thành công và trả về số dư mới', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          transactionId: 'txn-atomic-1',
          fromWalletBalance: 800000,
          toWalletBalance: 1200000,
          amount: 200000,
          transactionDate: '2026-11-15',
          note: 'Chuyển tiền ví phụ'
        },
        error: null
      })

      const result = await transferFunds({
        fromWalletId: 'w1',
        toWalletId: 'w2',
        amount: 200000,
        note: 'Chuyển tiền ví phụ',
        date: '2026-11-15'
      })

      expect(mockRpc).toHaveBeenCalledWith('transfer_funds', {
        p_from_wallet_id: 'w1',
        p_to_wallet_id: 'w2',
        p_amount: 200000,
        p_note: 'Chuyển tiền ví phụ',
        p_date: '2026-11-15'
      })
      expect(result.data.transactionId).toBe('txn-atomic-1')
      expect(result.data.fromWalletBalance).toBe(800000)
      expect(result.data.toWalletBalance).toBe(1200000)
      expect(result.error).toBeNull()
    })

    it('thực hiện fallback an toàn ở Client khi RPC trả mã lỗi PGRST202 (Function not found)', async () => {
      // 1. RPC throws PGRST202
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find function transfer_funds' }
      })

      // 2. Client fallback queries
      const fromWallet = { id: 'w1', name: 'Ví A', balance: 500000 }
      const toWallet = { id: 'w2', name: 'Ví B', balance: 200000 }
      const createdTxn = { id: 'txn-fallback-1', type: 'transfer', amount: 150000 }

      mockFrom.mockImplementation((table) => {
        if (table === 'wallets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((col, val) => ({
              single: vi.fn().mockResolvedValue({
                data: val === 'w1' ? fromWallet : toWallet,
                error: null
              })
            })),
            update: vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockResolvedValue({ error: null })
            }))
          }
        }
        if (table === 'transactions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: createdTxn, error: null })
          }
        }
      })

      const result = await transferFunds({
        fromWalletId: 'w1',
        toWalletId: 'w2',
        amount: 150000,
        note: 'Fallback transfer'
      })

      expect(result.error).toBeNull()
      expect(result.data.fromWalletBalance).toBe(350000)
      expect(result.data.toWalletBalance).toBe(350000)
      expect(result.data.transactionId).toBe('txn-fallback-1')
    })
  })
})
