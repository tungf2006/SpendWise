import { describe, it, expect } from 'vitest'
import {
  parseQuickEntry,
  resolveQuickWallet,
  normalizeQuickText,
} from '../quickEntryParser.js'

const SAMPLE_CATEGORIES = [
  { id: 'cat-food', name: 'Ăn uống', type: 'expense', keywords: ['an', 'uong', 'com', 'pho', 'cafe'] },
  { id: 'cat-move', name: 'Di chuyển', type: 'expense', keywords: ['xang', 'grab', 'taxi'] },
  { id: 'cat-shop', name: 'Mua sắm', type: 'expense', keywords: ['shopee', 'ban phim', 'mua'] },
  { id: 'cat-bill', name: 'Hóa đơn & Nhà cửa', type: 'expense', keywords: ['dien', 'nuoc'] },
  { id: 'cat-salary', name: 'Lương', type: 'income', keywords: ['luong', 'salary'] },
]

const SAMPLE_WALLETS = [
  { id: 'w-cash', name: 'Tiền mặt', type: 'cash', is_archived: false },
  { id: 'w-momo', name: 'Ví MoMo', type: 'ewallet', is_archived: false },
  { id: 'w-vcb', name: 'Vietcombank Tài Khoản', type: 'bank', is_archived: false },
  { id: 'w-mb', name: 'MB Bank', type: 'bank', is_archived: false },
]

describe('quickEntryParser (UC18 / R2 #1 / R3 #5, #6)', () => {
  it('xử lý ranh giới nửa đêm UTC+7 (Asia/Ho_Chi_Minh) chính xác', () => {
    // 2026-11-15T18:00:00Z == 2026-11-16 01:00:00 GMT+7
    const utcMidnightBoundary = new Date('2026-11-15T18:00:00Z')

    const today = parseQuickEntry('cafe 35k momo', {
      categories: SAMPLE_CATEGORIES,
      wallets: SAMPLE_WALLETS,
      now: utcMidnightBoundary,
    })
    const yesterday = parseQuickEntry('cafe 35k hôm qua momo', {
      categories: SAMPLE_CATEGORIES,
      wallets: SAMPLE_WALLETS,
      now: utcMidnightBoundary,
    })
    const twoDaysAgo = parseQuickEntry('cafe 35k hôm kia momo', {
      categories: SAMPLE_CATEGORIES,
      wallets: SAMPLE_WALLETS,
      now: utcMidnightBoundary,
    })

    expect(today.date).toBe('2026-11-16')
    expect(yesterday.date).toBe('2026-11-15')
    expect(twoDaysAgo.date).toBe('2026-11-14')
  })

  it('xử lý an toàn khi now là Date không hợp lệ và trả null cho input rỗng', () => {
    expect(parseQuickEntry('   ')).toBeNull()
    expect(parseQuickEntry(null)).toBeNull()

    const res = parseQuickEntry('cafe 35k', {
      categories: SAMPLE_CATEGORIES,
      wallets: SAMPLE_WALLETS,
      now: new Date('invalid-date'),
    })
    expect(res).not.toBeNull()
    expect(res.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('parse đúng dd/mm, dd/mm/yy, dd/mm/yyyy, năm nhuận và từ chối ngày không tồn tại', () => {
    const fixedNow = new Date('2026-11-20T05:00:00Z')

    const d1 = parseQuickEntry('cafe 35k 15/11/2026', { now: fixedNow })
    const d2 = parseQuickEntry('cafe 35k 5/3/26', { now: fixedNow })
    const leapValid = parseQuickEntry('cafe 35k 29/02/2024', { now: fixedNow })
    const invalidFeb31 = parseQuickEntry('cafe 35k 31/02', { now: fixedNow })
    const invalidNonLeap = parseQuickEntry('cafe 35k 29/02/2025', { now: fixedNow })

    expect(d1.date).toBe('2026-11-15')
    expect(d2.date).toBe('2026-03-05')
    expect(leapValid.date).toBe('2024-02-29')
    expect(invalidFeb31).toBeNull()
    expect(invalidNonLeap).toBeNull()
  })

  it('không nhận nhầm năm 2026 trong ngày 15/11/2026 thành số tiền', () => {
    const onlyDate = parseQuickEntry('cafe 15/11/2026', {
      categories: SAMPLE_CATEGORIES,
      wallets: SAMPLE_WALLETS,
    })
    expect(onlyDate.date).toBe('2026-11-15')
    expect(onlyDate.amount).toBeNull()

    const dateAndPlainAmount = parseQuickEntry('15/11/2026 phở 50000đ', {
      categories: SAMPLE_CATEGORIES,
      wallets: SAMPLE_WALLETS,
    })
    expect(dateAndPlainAmount.date).toBe('2026-11-15')
    expect(dateAndPlainAmount.amount).toBe(50000)
  })

  it('tuân thủ ranh giới từ: mb không khớp combo, an không khớp ban', () => {
    const combo = parseQuickEntry('combo ga ran 99k', {
      categories: SAMPLE_CATEGORIES,
      wallets: SAMPLE_WALLETS,
    })
    expect(combo.walletKeyword).toBeNull()
    expect(combo.wallet).toBeNull()

    const keyboard = parseQuickEntry('ban phim co 500k', {
      categories: SAMPLE_CATEGORIES,
      wallets: SAMPLE_WALLETS,
    })
    expect(keyboard.categoryName).toBe('Mua sắm')
    expect(keyboard.category).toBe('Mua sắm')
  })

  it('hỗ trợ số tiền thập phân (35.5k, 35,5k), tiền triệu (1tr5, 1tr25k) và hậu tố đ/vnd', () => {
    expect(parseQuickEntry('cafe 35.5k')?.amount).toBe(35500)
    expect(parseQuickEntry('cafe 35,5k')?.amount).toBe(35500)
    expect(parseQuickEntry('mua bàn 1tr5')?.amount).toBe(1500000)
    expect(parseQuickEntry('sửa xe 1tr25k')?.amount).toBe(1025000)
    expect(parseQuickEntry('phở 50000đ')?.amount).toBe(50000)
    expect(parseQuickEntry('siêu thị 100.000đ')?.amount).toBe(100000)
    expect(parseQuickEntry('gửi xe 50000vnd')?.amount).toBe(50000)
  })

  it('ưu tiên keywords động từ DB categories và nhận diện danh mục thu nhập tùy chỉnh', () => {
    const customCategories = [
      ...SAMPLE_CATEGORIES,
      { id: 'cat-pet', name: 'Thú cưng', type: 'expense', keywords: ['pate meo', 'cat tia'] },
      { id: 'cat-div', name: 'Cổ tức', type: 'income', keywords: ['co tuc'] },
    ]

    const petExpense = parseQuickEntry('mua pate mèo 120k momo', {
      categories: customCategories,
      wallets: SAMPLE_WALLETS,
    })
    expect(petExpense.type).toBe('expense')
    expect(petExpense.categoryName).toBe('Thú cưng')

    const dividendIncome = parseQuickEntry('cổ tức VNM 2tr vcb', {
      categories: customCategories,
      wallets: SAMPLE_WALLETS,
    })
    expect(dividendIncome.type).toBe('income')
    expect(dividendIncome.categoryName).toBe('Cổ tức')
  })

  it('bỏ qua ví đã lưu trữ (is_archived) và trả null khi không nhận diện được ví/danh mục', () => {
    const walletsWithArchived = [
      { id: 'w-momo-old', name: 'Ví MoMo', type: 'ewallet', is_archived: true },
      { id: 'w-custom-old', name: 'Ví Bí Mật', type: 'cash', is_archived: true },
      { id: 'w-vcb', name: 'Vietcombank Tài Khoản', type: 'bank', is_archived: false },
    ]

    expect(resolveQuickWallet(walletsWithArchived, 'momo')).toBeNull()
    expect(resolveQuickWallet(walletsWithArchived, 'vcb')?.id).toBe('w-vcb')

    const archivedCustom = parseQuickEntry('cafe 35k Ví Bí Mật', {
      categories: SAMPLE_CATEGORIES,
      wallets: walletsWithArchived,
    })
    expect(archivedCustom.walletKeyword).toBeNull()

    const unrecognized = parseQuickEntry('giao dịch lạ xyz 80k', {
      categories: SAMPLE_CATEGORIES,
      wallets: SAMPLE_WALLETS,
    })
    expect(unrecognized.wallet).toBeNull()
    expect(unrecognized.walletKeyword).toBeNull()
    expect(unrecognized.category).toBeNull()
    expect(unrecognized.categoryName).toBeNull()
  })

  it('bóc tách chuyển tiền nội bộ (transfer) và giữ đủ trường trả về', () => {
    const transfer = parseQuickEntry('chuyển 500k từ vcb sang momo', {
      categories: SAMPLE_CATEGORIES,
      wallets: SAMPLE_WALLETS,
      now: new Date('2026-11-20T05:00:00Z'),
    })

    expect(transfer).toEqual({
      amount: 500000,
      type: 'transfer',
      date: '2026-11-20',
      wallet: 'Vietcombank',
      walletKeyword: 'vietcombank',
      category: null,
      categoryName: null,
      note: 'chuyển 500k từ vcb sang momo',
      originalText: 'chuyển 500k từ vcb sang momo',
      rawText: 'chuyển 500k từ vcb sang momo',
      toWallet: 'Ví MoMo',
      toWalletKeyword: 'momo',
    })
    expect(normalizeQuickText('  Cà Phê Đá  ')).toBe('ca phe da')
  })
})
