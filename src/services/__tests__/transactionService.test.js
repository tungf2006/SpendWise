import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuthGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: (...args) => mockAuthGetUser(...args)
    },
    from: (...args) => mockFrom(...args)
  }
}))

vi.mock('@/utils/transactionCsv', () => ({
  downloadTransactionsCsv: vi.fn().mockReturnValue(true)
}))

import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  exportTransactionsCSV
} from '../transactionService.js'
import { downloadTransactionsCsv } from '@/utils/transactionCsv'

describe('transactionService - UC12, UC13 (R3, R4 Balance Integrity & CSV)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-001', email: 'test@spendwise.vn' } },
      error: null
    })
  })

  describe('getTransactions (UC13)', () => {
    it('áp dụng đúng khoảng phân trang (page=2, limit=20 -> range 20..39) và bộ lọc', async () => {
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
          error: null
        })
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
        searchKeyword: 'cà phê'
      })

      expect(mockFrom).toHaveBeenCalledWith('transactions')
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
  })

  describe('createTransaction - Cập nhật số dư 3 loại giao dịch (UC12)', () => {
    it('Tạo khoản Thu (+income): cộng số dư ví tương ứng', async () => {
      const createdTxn = { id: 't1', type: 'income', amount: 1000000, wallet_id: 'w1' }
      const mockWallet = { id: 'w1', balance: 500000 }
      const updateWalletMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: createdTxn, error: null })
          }
        }
        if (table === 'wallets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockWallet, error: null })
              })
            }),
            update: updateWalletMock
          }
        }
      })

      const res = await createTransaction({
        wallet_id: 'w1',
        type: 'income',
        amount: 1000000,
        note: 'Tiền thưởng'
      })

      expect(res.error).toBeNull()
      expect(updateWalletMock).toHaveBeenCalledWith({ balance: 1500000 })
    })

    it('Tạo khoản Chi (-expense): trừ số dư ví tương ứng', async () => {
      const createdTxn = { id: 't2', type: 'expense', amount: 50000, wallet_id: 'w1' }
      const mockWallet = { id: 'w1', balance: 500000 }
      const updateWalletMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: createdTxn, error: null })
          }
        }
        if (table === 'wallets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockWallet, error: null })
              })
            }),
            update: updateWalletMock
          }
        }
      })

      const res = await createTransaction({
        wallet_id: 'w1',
        type: 'expense',
        amount: 50000,
        note: 'Ăn trưa'
      })

      expect(res.error).toBeNull()
      expect(updateWalletMock).toHaveBeenCalledWith({ balance: 450000 })
    })

    it('Tạo chuyển tiền (transfer): trừ ví nguồn và cộng ví đích', async () => {
      const createdTxn = { id: 't3', type: 'transfer', amount: 200000, wallet_id: 'w1', to_wallet_id: 'w2' }
      const walletA = { id: 'w1', balance: 500000 }
      const walletB = { id: 'w2', balance: 100000 }
      const updatedWallets = {}

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: createdTxn, error: null })
          }
        }
        if (table === 'wallets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_, id) => ({
                single: vi.fn().mockResolvedValue({
                  data: id === 'w1' ? walletA : walletB,
                  error: null
                })
              }))
            }),
            update: vi.fn().mockImplementation((data) => ({
              eq: vi.fn().mockImplementation((_, id) => {
                updatedWallets[id] = data.balance
                return Promise.resolve({ error: null })
              })
            }))
          }
        }
      })

      const res = await createTransaction({
        wallet_id: 'w1',
        to_wallet_id: 'w2',
        type: 'transfer',
        amount: 200000,
        note: 'Chuyển khoản'
      })

      expect(res.error).toBeNull()
      expect(updatedWallets['w1']).toBe(300000)
      expect(updatedWallets['w2']).toBe(300000)
    })
  })

  describe('updateTransaction - Tính toán hiệu số số dư Net Delta (UC13)', () => {
    it('Sửa tăng số tiền khoản Chi từ 50k thành 70k: trừ thêm 20k vào ví', async () => {
      const oldTxn = { id: 't-edit', wallet_id: 'w1', to_wallet_id: null, type: 'expense', amount: 50000 }
      const wallet = { id: 'w1', balance: 500000 }
      let updatedBalance = null

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: oldTxn, error: null })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { ...oldTxn, amount: 70000 }, error: null })
                })
              })
            })
          }
        }
        if (table === 'wallets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: wallet, error: null })
              })
            }),
            update: vi.fn().mockImplementation((data) => ({
              eq: vi.fn().mockImplementation(() => {
                updatedBalance = data.balance
                return Promise.resolve({ error: null })
              })
            }))
          }
        }
      })

      const res = await updateTransaction('t-edit', { amount: 70000 })
      expect(res.error).toBeNull()
      // Cũ: -50k, Mới: -70k -> Delta: -20k -> 500k - 20k = 480k
      expect(updatedBalance).toBe(480000)
    })

    it('Đổi loại giao dịch từ Chi (50k) sang Thu (50k): số dư ví tăng 100k', async () => {
      const oldTxn = { id: 't-edit2', wallet_id: 'w1', to_wallet_id: null, type: 'expense', amount: 50000 }
      const wallet = { id: 'w1', balance: 500000 }
      let updatedBalance = null

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: oldTxn, error: null })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { ...oldTxn, type: 'income' }, error: null })
                })
              })
            })
          }
        }
        if (table === 'wallets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: wallet, error: null })
              })
            }),
            update: vi.fn().mockImplementation((data) => ({
              eq: vi.fn().mockImplementation(() => {
                updatedBalance = data.balance
                return Promise.resolve({ error: null })
              })
            }))
          }
        }
      })

      const res = await updateTransaction('t-edit2', { type: 'income' })
      expect(res.error).toBeNull()
      // Cũ: hoàn lại +50k, Mới: cộng thêm +50k -> Delta: +100k -> 500k + 100k = 600k
      expect(updatedBalance).toBe(600000)
    })

    it('Đổi giao dịch sang ví khác: hoàn tiền ví cũ và trừ tiền ví mới', async () => {
      const oldTxn = { id: 't-edit3', wallet_id: 'w1', to_wallet_id: null, type: 'expense', amount: 50000 }
      const walletA = { id: 'w1', balance: 500000 }
      const walletB = { id: 'w2', balance: 300000 }
      const updatedWallets = {}

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: oldTxn, error: null })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { ...oldTxn, wallet_id: 'w2' }, error: null })
                })
              })
            })
          }
        }
        if (table === 'wallets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_, id) => ({
                single: vi.fn().mockResolvedValue({
                  data: id === 'w1' ? walletA : walletB,
                  error: null
                })
              }))
            }),
            update: vi.fn().mockImplementation((data) => ({
              eq: vi.fn().mockImplementation((_, id) => {
                updatedWallets[id] = data.balance
                return Promise.resolve({ error: null })
              })
            }))
          }
        }
      })

      const res = await updateTransaction('t-edit3', { wallet_id: 'w2' })
      expect(res.error).toBeNull()
      // w1 được hoàn lại +50k -> 550k; w2 bị trừ -50k -> 250k
      expect(updatedWallets['w1']).toBe(550000)
      expect(updatedWallets['w2']).toBe(250000)
    })
  })

  describe('deleteTransaction - Hoàn trả số dư ví đầy đủ (UC13)', () => {
    it('Xóa giao dịch Chi tiêu: hoàn lại tiền vào ví', async () => {
      const oldTxn = { id: 't-del1', wallet_id: 'w1', to_wallet_id: null, type: 'expense', amount: 80000 }
      const wallet = { id: 'w1', balance: 400000 }
      let updatedBalance = null

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: oldTxn, error: null })
              })
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          }
        }
        if (table === 'wallets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: wallet, error: null })
              })
            }),
            update: vi.fn().mockImplementation((data) => ({
              eq: vi.fn().mockImplementation(() => {
                updatedBalance = data.balance
                return Promise.resolve({ error: null })
              })
            }))
          }
        }
      })

      const res = await deleteTransaction('t-del1')
      expect(res.error).toBeNull()
      expect(updatedBalance).toBe(480000)
    })

    it('Xóa giao dịch Chuyển tiền (transfer): hoàn trả ví nguồn và thu hồi ví đích', async () => {
      const oldTxn = { id: 't-del-transfer', wallet_id: 'w1', to_wallet_id: 'w2', type: 'transfer', amount: 150000 }
      const walletSrc = { id: 'w1', balance: 350000 }
      const walletDst = { id: 'w2', balance: 250000 }
      const updatedWallets = {}

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: oldTxn, error: null })
              })
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          }
        }
        if (table === 'wallets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_, id) => ({
                single: vi.fn().mockResolvedValue({
                  data: id === 'w1' ? walletSrc : walletDst,
                  error: null
                })
              }))
            }),
            update: vi.fn().mockImplementation((data) => ({
              eq: vi.fn().mockImplementation((_, id) => {
                updatedWallets[id] = data.balance
                return Promise.resolve({ error: null })
              })
            }))
          }
        }
      })

      const res = await deleteTransaction('t-del-transfer')
      expect(res.error).toBeNull()
      // Ví nguồn được cộng lại 150k -> 500k; Ví đích bị trừ thu hồi 150k -> 100k
      expect(updatedWallets['w1']).toBe(500000)
      expect(updatedWallets['w2']).toBe(100000)
    })

    it('Hoàn tác lại số dư ví nếu lệnh xóa giao dịch trong bảng transactions thất bại', async () => {
      const oldTxn = { id: 't-del-fail', wallet_id: 'w1', to_wallet_id: null, type: 'expense', amount: 80000 }
      const wallet = { id: 'w1', balance: 400000 }
      const walletUpdates = []

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: oldTxn, error: null })
              })
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: new Error('Lỗi RLS khi xóa') })
            })
          }
        }
        if (table === 'wallets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: wallet, error: null })
              })
            }),
            update: vi.fn().mockImplementation((data) => ({
              eq: vi.fn().mockImplementation((_, id) => {
                walletUpdates.push({ id, balance: data.balance })
                return Promise.resolve({ error: null })
              })
            }))
          }
        }
      })

      const res = await deleteTransaction('t-del-fail')
      expect(res.error.message).toContain('Lỗi RLS khi xóa')
      expect(walletUpdates).toEqual([
        { id: 'w1', balance: 480000 },
        { id: 'w1', balance: 400000 }
      ])
    })

    it('Hoàn tác xóa bản ghi giao dịch vừa tạo nếu bước cập nhật số dư ví thất bại', async () => {
      const createdTxn = { id: 't-rollback-create', type: 'expense', amount: 50000, wallet_id: 'w1' }
      const deleteTxnMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

      mockFrom.mockImplementation((table) => {
        if (table === 'transactions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: createdTxn, error: null }),
            delete: deleteTxnMock
          }
        }
        if (table === 'wallets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'w1', balance: 500000 }, error: null })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: new Error('Lỗi cập nhật ví') })
            })
          }
        }
      })

      const res = await createTransaction({
        wallet_id: 'w1',
        type: 'expense',
        amount: 50000,
        note: 'Test rollback'
      })

      expect(res.data).toBeNull()
      expect(res.error.message).toContain('Lỗi cập nhật ví')
      expect(deleteTxnMock).toHaveBeenCalled()
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
