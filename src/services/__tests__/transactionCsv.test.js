import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  escapeCsvText,
  transactionsToCsv,
  defaultTransactionCsvFilename,
  downloadTransactionsCsv
} from '@/utils/transactionCsv'

describe('transactionCsv (R4 CSV Security & Anti-Formula Injection)', () => {
  describe('escapeCsvText - Chống CSV Formula Injection', () => {
    it('tiền tố formula markers (=, +, -, @) được escape an toàn bằng dấu nháy đơn', () => {
      expect(escapeCsvText('=1+1')).toBe(`"'=1+1"`)
      expect(escapeCsvText('+cmd|/c calc')).toBe(`"'+cmd|/c calc"`)
      expect(escapeCsvText('-5+2')).toBe(`"'-5+2"`)
      expect(escapeCsvText('@SUM(A1:A10)')).toBe(`"'@SUM(A1:A10)"`)
    })

    it('bắt được formula markers có khoảng trắng hoặc ký tự điều khiển ở đầu', () => {
      expect(escapeCsvText('   =cmd')).toBe(`"'   =cmd"`)
      expect(escapeCsvText('\uFEFF=cmd')).toBe(`"'\uFEFF=cmd"`)
      expect(escapeCsvText('\t+200k')).toBe(`"'\t+200k"`)
    })

    it('escape dấu ngoặc kép theo chuẩn RFC 4180', () => {
      expect(escapeCsvText('Ghi chú "đặc biệt"')).toBe(`"Ghi chú ""đặc biệt"""`)
      expect(escapeCsvText('Cà phê muối')).toBe(`"Cà phê muối"`)
      expect(escapeCsvText('')).toBe(`""`)
      expect(escapeCsvText(null)).toBe(`""`)
      expect(escapeCsvText(undefined)).toBe(`""`)
    })
  })

  describe('transactionsToCsv - Cấu trúc dữ liệu & UTF-8 BOM', () => {
    it('bắt đầu bằng UTF-8 BOM (\\uFEFF) để Excel hiển thị đúng tiếng Việt có dấu', () => {
      const csv = transactionsToCsv([])
      expect(csv.startsWith('\uFEFF')).toBe(true)
    })

    it('chứa đầy đủ các cột tiêu đề bao gồm cả "Ví thanh toán" và "Ví nhận"', () => {
      const csv = transactionsToCsv([])
      expect(csv).toContain('Ví thanh toán')
      expect(csv).toContain('Ví nhận')
      expect(csv).toContain('Loại giao dịch')
      expect(csv).toContain('Số tiền (VNĐ)')
    })

    it('xuất thông tin giao dịch chuyển tiền đầy đủ cả 2 ví', () => {
      const sampleTxns = [
        {
          id: 't1',
          transaction_date: '2026-11-15',
          type: 'transfer',
          amount: 500000,
          wallet: { name: 'Ví Tiền mặt' },
          to_wallet: { name: 'Tài khoản VCB' },
          note: '=chuyển tiền'
        }
      ]

      const csv = transactionsToCsv(sampleTxns)
      expect(csv).toContain('Ví Tiền mặt')
      expect(csv).toContain('Tài khoản VCB')
      expect(csv).toContain('Chuyển tiền')
      expect(csv).toContain('500000')
      expect(csv).toContain(`"'=chuyển tiền"`)
    })

    it('ném lỗi TypeError khi truyền vào tham số không phải mảng', () => {
      expect(() => transactionsToCsv(null)).toThrow(TypeError)
      expect(() => transactionsToCsv('invalid')).toThrow(TypeError)
    })
  })

  describe('defaultTransactionCsvFilename', () => {
    it('sinh tên file theo ngày địa phương SpendWise_GiaoDich_YYYY-MM-DD.csv', () => {
      const date = new Date(2026, 10, 15) // Tháng 11 (0-indexed: 10)
      const filename = defaultTransactionCsvFilename(date)
      expect(filename).toBe('SpendWise_GiaoDich_2026-11-15.csv')
    })
  })

  describe('downloadTransactionsCsv - Tải file và thu hồi URL', () => {
    let mockClick
    let mockRemove
    let prevWindow
    let prevDocument
    let prevUrl

    beforeEach(() => {
      vi.useFakeTimers()
      prevWindow = globalThis.window
      prevDocument = globalThis.document
      prevUrl = globalThis.URL

      mockClick = vi.fn()
      mockRemove = vi.fn()

      const mockUrl = {
        createObjectURL: vi.fn().mockReturnValue('blob:http://localhost/dummy-uuid'),
        revokeObjectURL: vi.fn()
      }

      const mockDoc = {
        createElement: vi.fn().mockReturnValue({
          style: {},
          click: mockClick,
          remove: mockRemove
        }),
        body: {
          appendChild: vi.fn()
        }
      }

      globalThis.window = {
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout
      }
      globalThis.document = mockDoc
      globalThis.URL = mockUrl
    })

    afterEach(() => {
      globalThis.window = prevWindow
      globalThis.document = prevDocument
      globalThis.URL = prevUrl
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('tạo blob url, trigger click và thu hồi Object URL an toàn', () => {
      const sampleTxns = [{ id: '1', amount: 50000, transaction_date: '2026-11-15', type: 'expense' }]
      const success = downloadTransactionsCsv(sampleTxns, 'test.csv')

      expect(success).toBe(true)
      expect(globalThis.URL.createObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
      expect(mockRemove).toHaveBeenCalled()

      // Thu hồi URL sau 1000ms
      vi.advanceTimersByTime(1000)
      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/dummy-uuid')
    })

    it('trả về false khi danh sách rỗng', () => {
      expect(downloadTransactionsCsv([])).toBe(false)
      expect(downloadTransactionsCsv(null)).toBe(false)
    })
  })
})
