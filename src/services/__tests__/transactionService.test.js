import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuthGetUser = vi.fn()
const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: (...args) => mockAuthGetUser(...args),
    },
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
  },
}))

vi.mock('@/utils/transactionCsv', () => ({
  downloadTransactionsCsv: vi.fn().mockReturnValue(true),
}))

import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  exportTransactionsCSV,
} from '../transactionService.js'
import { downloadTransactionsCsv } from '@/utils/transactionCsv'

const RPC_MISSING_ERROR = {
  code: 'PGRST202',
  message: 'Could not find the function in the schema cache',
}

function createWalletMock(walletById, onUpdate) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockImplementation((_, id) => ({
        eq: vi.fn().mockImplementation((col, userId) => ({
          single: vi.fn().mockResolvedValue({
            data: col === 'user_id' && userId === 'user-001' ? (walletById[id] || null) : null,
            error: null,
          }),
        })),
      })),
    }),
    update: vi.fn().mockImplementation((data) => ({
      eq: vi.fn().mockImplementation((_, id) => ({
        eq: vi.fn().mockImplementation((col, userId) => {
          onUpdate?.(data, id, col, userId)
          return Promise.resolve({ error: null })
        }),
      })),
    })),
  }
}

describe('transactionService - UC12, UC13 (Atomic RPCs, Ownership & CSV)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-001', email: 'test@spendwise.vn' } },
      error: null,
    })
    mockRpc.mockResolvedValue({ data: null, error: RPC_MISSING_ERROR })
  })

  describe('getTransactions (UC13)', () => {
    it('áp dụng ràng buộc user_id, phân trang (page=2, limit=20 -> range 20..39) và bộ lọc', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockResolvedValue({
          data: [{ id: 'txn1', amount: 50000 }],
          count: 45,
          error: null,
        }),
      }
      mockFrom.mockReturnValue(mockQuery)

      const result = await getTransactions({
        page: 2,
        limit: 20,
        startDate: '2026-11-01',
        endDate: '2026-11-15',
        walletId: 'w1',
        categoryId: 'c1',
        type: 'expense',
        searchKeyword: 'cà phê',
      })

      expect(mockFrom).toHaveBeenCalledWith('transactions')
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-001')
      expect(mockQuery.range).toHaveBeenCalledWith(20, 39)
      expect(mockQuery.gte).toHaveBeenCalledWith('transaction_date', '2026-11-01')
      expect(mockQuery.lte).toHaveBeenCalledWith('transaction_date', '2026-11-15')
      expect(mockQuery.or).toHaveBeenCalledWith('wallet_id.eq.w1,to_wallet_id.eq.w1')
      expect(mockQuery.eq).toHaveBeenCalledWith('category_id', 'c1')
      expect(mockQuery.eq).toHaveBeenCalledWith('type', 'expense')
      expect(mockQuery.ilike).toHaveBeenCalledWith('note_unaccent', '%ca phe%')
      expect(result.count).toBe(45)
      expect(result.data).toHaveLength(1)
    })

    it('từ chối getTransactions khi chưa đăng nhập', async () => {
      mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
      const res = await getTransactions()
      expect(res.data).toEqual([])
      expect(res.error.message).toContain('chưa đăng nhập')
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })

  describe('Atomic RPC primary paths (R3 #9)', () => {
    it('createTransaction (expense) gọi RPC create_transaction_atomic và không chạm fallback', async () => {
      const created = { id: 'txn-rpc-1', type: 'expense', amount: 45000, wallet_id: 'w1' }
      mockRpc.mockResolvedValueOnce({ data: created, error: null })

      const res = await createTransaction({
        wallet_id: 'w1',
        category_id: 'c1',
        type: 'expense',
        amount: 45000,
        transaction_date: '2026-11-26',
        note: 'Bún bò',
      })

      expect(res.error).toBeNull()
      expect(res.data).toEqual(created)
      expect(mockRpc).toHaveBeenCalledWith('create_transaction_atomic', {
        p_wallet_id: 'w1',
        p_category_id: 'c1',
        p_type: 'expense',
        p_amount: 45000,
        p_note: 'Bún bò',
        p_transaction_date: '2026-11-26',
      })
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('createTransaction (transfer) gọi RPC transfer_funds', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          transactionId: 'txn-tr-1',
          amount: 200000,
          transactionDate: '2026-11-26',
          note: 'Chuyển tiền',
        },
        error: null,
      })

      const res = await createTransaction({
        wallet_id: 'w1',
        to_wallet_id: 'w2',
        type: 'transfer',
        amount: 200000,
        transaction_date: '2026-11-26',
        note: 'Chuyển tiền',
      })

      expect(res.error).toBeNull()
      expect(res.data).toMatchObject({
        id: 'txn-tr-1',
        wallet_id: 'w1',
        to_wallet_id: 'w2',
        type: 'transfer',
        amount: 200000,
      })
      expect(mockRpc).toHaveBeenCalledWith('transfer_funds', {
        p_from_wallet_id: 'w1',
        p_to_wallet_id: 'w2',
        p_amount: 200000,
        p_note: 'Chuyển tiền',
        p_date: '2026-11-26',
      })
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('updateTransaction (non-transfer) gọi RPC update_transaction_atomic sau khi xác minh oldTxn theo user_id', async () => {
      const oldTxn = {
        id: 't-rpc-upd',
        wallet_id: 'w1',
        to_wallet_id: null,
        category_id: 'c1',
        type: 'expense',
        amount: 50000,
        note: 'Cũ',
        transaction_date: '2026-11-20',
      }
      const updatedTxn = { ...oldTxn, amount: 75000, type: 'income' }
      const eqUserMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: oldTxn, error: null }),
      })
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqUserMock })

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: eqIdMock }),
      })
      mockRpc.mockResolvedValueOnce({ data: updatedTxn, error: null })

      const res = await updateTransaction('t-rpc-upd', { amount: 75000, type: 'income' })
      expect(res.error).toBeNull()
      expect(res.data).toEqual(updatedTxn)
      expect(eqIdMock).toHaveBeenCalledWith('id', 't-rpc-upd')
      expect(eqUserMock).toHaveBeenCalledWith('user_id', 'user-001')
      expect(mockRpc).toHaveBeenCalledWith('update_transaction_atomic', {
        p_transaction_id: 't-rpc-upd',
        p_wallet_id: 'w1',
        p_category_id: null,
        p_type: 'income',
        p_amount: 75000,
        p_note: 'Cũ',
        p_transaction_date: '2026-11-20',
      })
    })

    it('deleteTransaction gọi RPC delete_transaction_atomic và không chạy fallback nếu thành công', async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null })

      const res = await deleteTransaction('t-rpc-del')
      expect(res).toEqual({ error: null })
      expect(mockRpc).toHaveBeenCalledWith('delete_transaction_atomic', {
        p_transaction_id: 't-rpc-del',
      })
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('KHÔNG fallback khi RPC trả lỗi nghiệp vụ/bảo mật (non-missing error)', async () => {
      const businessErr = { code: 'P0001', message: 'Số dư ví không đủ' }

      mockRpc.mockResolvedValueOnce({ data: null, error: businessErr })
      const createRes = await createTransaction({ wallet_id: 'w1', type: 'expense', amount: 10000 })
      expect(createRes.error).toEqual(businessErr)
      expect(mockFrom).not.toHaveBeenCalled()

      mockRpc.mockResolvedValueOnce({ data: null, error: businessErr })
      const deleteRes = await deleteTransaction('t-1')
      expect(deleteRes.error).toEqual(businessErr)
      expect(mockFrom).not.toHaveBeenCalled()

      const oldTxn = {
        id: 't-1',
        wallet_id: 'w1',
        to_wallet_id: null,
        category_id: 'c1',
        type: 'expense',
        amount: 50000,
        note: '',
        transaction_date: '2026-11-20',
      }
      const updateTxnSpy = vi.fn()
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: oldTxn, error: null }),
            }),
          }),
        }),
        update: updateTxnSpy,
      })
      mockRpc.mockResolvedValueOnce({ data: null, error: businessErr })
      const updRes = await updateTransaction('t-1', { amount: 60000 })
      expect(updRes.error).toEqual(businessErr)
      expect(updateTxnSpy).not.toHaveBeenCalled()
    })
  })

  describe('createTransaction fallback (khi RPC chưa tồn tại PGRST202/42883)', () => {
    it('Tạo khoản Thu (+income): cộng số dư ví và kiểm tra user_id', async () => {
      const createdTxn = { id: 't1', type: 'income', amount: 1000000, wallet_id: 'w1' }
      const walletUpdates = []

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: createdTxn, error: null }),
          }
        }
        if (table === 'wallets') {
          return createWalletMock(
            { w1: { id: 'w1', balance: 500000 } },
            (data, id, col, userId) => walletUpdates.push({ data, id, col, userId })
          )
        }
      })

      const res = await createTransaction({
        wallet_id: 'w1',
        type: 'income',
        amount: 1000000,
        note: 'Tiền thưởng',
      })

      expect(res.error).toBeNull()
      expect(walletUpdates).toEqual([
        { data: { balance: 1500000 }, id: 'w1', col: 'user_id', userId: 'user-001' },
      ])
    })

    it('Tạo khoản Chi (-expense): trừ số dư ví với mã lỗi 42883', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'function public.create_transaction_atomic does not exist' },
      })
      const createdTxn = { id: 't2', type: 'expense', amount: 50000, wallet_id: 'w1' }
      const walletUpdates = []

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: createdTxn, error: null }),
          }
        }
        if (table === 'wallets') {
          return createWalletMock(
            { w1: { id: 'w1', balance: 500000 } },
            (data, id, col, userId) => walletUpdates.push({ data, id, col, userId })
          )
        }
      })

      const res = await createTransaction({
        wallet_id: 'w1',
        type: 'expense',
        amount: 50000,
        note: 'Ăn trưa',
      })

      expect(res.error).toBeNull()
      expect(walletUpdates).toEqual([
        { data: { balance: 450000 }, id: 'w1', col: 'user_id', userId: 'user-001' },
      ])
    })

    it('Tạo chuyển tiền (transfer): trừ ví nguồn và cộng ví đích khi transfer_funds fallback', async () => {
      const createdTxn = { id: 't3', type: 'transfer', amount: 200000, wallet_id: 'w1', to_wallet_id: 'w2' }
      const updatedWallets = {}

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: createdTxn, error: null }),
          }
        }
        if (table === 'wallets') {
          return createWalletMock(
            {
              w1: { id: 'w1', balance: 500000 },
              w2: { id: 'w2', balance: 100000 },
            },
            (data, id, col, userId) => {
              expect(col).toBe('user_id')
              expect(userId).toBe('user-001')
              updatedWallets[id] = data.balance
            }
          )
        }
      })

      const res = await createTransaction({
        wallet_id: 'w1',
        to_wallet_id: 'w2',
        type: 'transfer',
        amount: 200000,
        note: 'Chuyển khoản',
      })

      expect(res.error).toBeNull()
      expect(updatedWallets.w1).toBe(300000)
      expect(updatedWallets.w2).toBe(300000)
    })

    it('từ chối khi chưa đăng nhập', async () => {
      mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
      const res = await createTransaction({ wallet_id: 'w1', type: 'expense', amount: 10000 })
      expect(res.error.message).toContain('chưa đăng nhập')
      expect(mockRpc).not.toHaveBeenCalled()
    })
  })

  describe('updateTransaction fallback - Tính toán Net Delta & Ownership (UC13)', () => {
    it('Sửa tăng số tiền khoản Chi từ 50k thành 70k: trừ thêm 20k vào ví với .eq(user_id)', async () => {
      const oldTxn = { id: 't-edit', wallet_id: 'w1', to_wallet_id: null, category_id: 'c1', type: 'expense', amount: 50000 }
      let updatedBalance = null
      const updateEqUserSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { ...oldTxn, amount: 70000 }, error: null }),
        }),
      })

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: oldTxn, error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: updateEqUserSpy,
              }),
            }),
          }
        }
        if (table === 'wallets') {
          return createWalletMock(
            { w1: { id: 'w1', balance: 500000 } },
            (data, _id, col, userId) => {
              expect(col).toBe('user_id')
              expect(userId).toBe('user-001')
              updatedBalance = data.balance
            }
          )
        }
      })

      const res = await updateTransaction('t-edit', { amount: 70000 })
      expect(res.error).toBeNull()
      expect(updatedBalance).toBe(480000)
      expect(updateEqUserSpy).toHaveBeenCalledWith('user_id', 'user-001')
    })

    it('Đổi loại giao dịch từ Chi (50k) sang Thu (50k): số dư ví tăng 100k và tự xóa category_id cũ', async () => {
      const oldTxn = { id: 't-edit2', wallet_id: 'w1', to_wallet_id: null, category_id: 'c1', type: 'expense', amount: 50000 }
      let updatedBalance = null
      const updateSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { ...oldTxn, type: 'income', category_id: null }, error: null }),
            }),
          }),
        }),
      })

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: oldTxn, error: null }),
                }),
              }),
            }),
            update: updateSpy,
          }
        }
        if (table === 'wallets') {
          return createWalletMock(
            { w1: { id: 'w1', balance: 500000 } },
            (data) => {
              updatedBalance = data.balance
            }
          )
        }
      })

      const res = await updateTransaction('t-edit2', { type: 'income' })
      expect(res.error).toBeNull()
      expect(updatedBalance).toBe(600000)
      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'income',
        category_id: null,
      }))
    })

    it('Đổi giao dịch sang ví khác: hoàn tiền ví cũ và trừ tiền ví mới', async () => {
      const oldTxn = { id: 't-edit3', wallet_id: 'w1', to_wallet_id: null, category_id: 'c1', type: 'expense', amount: 50000 }
      const updatedWallets = {}

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: oldTxn, error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { ...oldTxn, wallet_id: 'w2' }, error: null }),
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'wallets') {
          return createWalletMock(
            {
              w1: { id: 'w1', balance: 500000 },
              w2: { id: 'w2', balance: 300000 },
            },
            (data, id) => {
              updatedWallets[id] = data.balance
            }
          )
        }
      })

      const res = await updateTransaction('t-edit3', { wallet_id: 'w2' })
      expect(res.error).toBeNull()
      expect(updatedWallets.w1).toBe(550000)
      expect(updatedWallets.w2).toBe(250000)
    })

    it('từ chối updateTransaction khi chưa đăng nhập hoặc chỉ truyền field không hợp lệ', async () => {
      mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
      const unauth = await updateTransaction('t-1', { amount: 10000 })
      expect(unauth.error.message).toContain('chưa đăng nhập')

      const oldTxn = { id: 't-1', wallet_id: 'w1', to_wallet_id: null, type: 'expense', amount: 50000 }
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: oldTxn, error: null }),
            }),
          }),
        }),
      })
      const emptyFields = await updateTransaction('t-1', { user_id: 'hacker' })
      expect(emptyFields.error.message).toContain('Không có thông tin hợp lệ')
    })
  })

  describe('deleteTransaction fallback & rollback (UC13)', () => {
    it('Xóa giao dịch Chi tiêu: hoàn lại tiền vào ví và ràng buộc user_id', async () => {
      const oldTxn = { id: 't-del1', wallet_id: 'w1', to_wallet_id: null, type: 'expense', amount: 80000 }
      let updatedBalance = null
      const deleteEqUserSpy = vi.fn().mockResolvedValue({ error: null })

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: oldTxn, error: null }),
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: deleteEqUserSpy,
              }),
            }),
          }
        }
        if (table === 'wallets') {
          return createWalletMock(
            { w1: { id: 'w1', balance: 400000 } },
            (data, _id, col, userId) => {
              expect(col).toBe('user_id')
              expect(userId).toBe('user-001')
              updatedBalance = data.balance
            }
          )
        }
      })

      const res = await deleteTransaction('t-del1')
      expect(res.error).toBeNull()
      expect(updatedBalance).toBe(480000)
      expect(deleteEqUserSpy).toHaveBeenCalledWith('user_id', 'user-001')
    })

    it('Xóa giao dịch Chuyển tiền (transfer): hoàn trả ví nguồn và thu hồi ví đích', async () => {
      const oldTxn = { id: 't-del-transfer', wallet_id: 'w1', to_wallet_id: 'w2', type: 'transfer', amount: 150000 }
      const updatedWallets = {}

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: oldTxn, error: null }),
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          }
        }
        if (table === 'wallets') {
          return createWalletMock(
            {
              w1: { id: 'w1', balance: 350000 },
              w2: { id: 'w2', balance: 250000 },
            },
            (data, id) => {
              updatedWallets[id] = data.balance
            }
          )
        }
      })

      const res = await deleteTransaction('t-del-transfer')
      expect(res.error).toBeNull()
      expect(updatedWallets.w1).toBe(500000)
      expect(updatedWallets.w2).toBe(100000)
    })

    it('Hoàn tác lại số dư ví nếu lệnh xóa giao dịch trong bảng transactions thất bại', async () => {
      const oldTxn = { id: 't-del-fail', wallet_id: 'w1', to_wallet_id: null, type: 'expense', amount: 80000 }
      const walletUpdates = []

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: oldTxn, error: null }),
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: new Error('Lỗi RLS khi xóa') }),
              }),
            }),
          }
        }
        if (table === 'wallets') {
          return createWalletMock(
            { w1: { id: 'w1', balance: 400000 } },
            (data, id, col, userId) => {
              expect(col).toBe('user_id')
              expect(userId).toBe('user-001')
              walletUpdates.push({ id, balance: data.balance })
            }
          )
        }
      })

      const res = await deleteTransaction('t-del-fail')
      expect(res.error.message).toContain('Lỗi RLS khi xóa')
      expect(walletUpdates).toEqual([
        { id: 'w1', balance: 480000 },
        { id: 'w1', balance: 400000 },
      ])
    })

    it('Hoàn tác xóa bản ghi giao dịch (kèm user_id) nếu bước cập nhật số dư ví thất bại', async () => {
      const createdTxn = { id: 't-rollback-create', type: 'expense', amount: 50000, wallet_id: 'w1' }
      const deleteEqUserSpy = vi.fn().mockResolvedValue({ error: null })
      const deleteTxnMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: deleteEqUserSpy,
        }),
      })

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: createdTxn, error: null }),
            delete: deleteTxnMock,
          }
        }
        if (table === 'wallets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'w1', balance: 500000 }, error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: new Error('Lỗi cập nhật ví') }),
              }),
            }),
          }
        }
      })

      const res = await createTransaction({
        wallet_id: 'w1',
        type: 'expense',
        amount: 50000,
        note: 'Test rollback',
      })

      expect(res.data).toBeNull()
      expect(res.error.message).toContain('Lỗi cập nhật ví')
      expect(deleteTxnMock).toHaveBeenCalled()
      expect(deleteEqUserSpy).toHaveBeenCalledWith('user_id', 'user-001')
    })

    it('từ chối deleteTransaction khi chưa đăng nhập', async () => {
      mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
      const res = await deleteTransaction('t-1')
      expect(res.error.message).toContain('chưa đăng nhập')
      expect(mockRpc).not.toHaveBeenCalled()
    })
  })

  describe('exportTransactionsCSV (R4)', () => {
    it('ủy thác gọi downloadTransactionsCsv từ module transactionCsv', () => {
      const sampleTxns = [{ id: '1', amount: 10000 }]
      exportTransactionsCSV(sampleTxns, 'test.csv')
      expect(downloadTransactionsCsv).toHaveBeenCalledWith(sampleTxns, 'test.csv')
    })
  })
})
