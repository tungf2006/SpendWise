import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseQuickEntry } from '../quickEntryParser.js'

describe('quickEntryParser - UC18 & UC19 (QA-01)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-27T09:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('trả về null khi input rỗng hoặc không phải chuỗi', () => {
    expect(parseQuickEntry('')).toBeNull()
    expect(parseQuickEntry(null)).toBeNull()
    expect(parseQuickEntry(undefined)).toBeNull()
    expect(parseQuickEntry(12345)).toBeNull()
  })

  it('bóc tách đầy đủ câu chi tiêu cơ bản: "cafe 35k hôm qua momo"', () => {
    const res = parseQuickEntry('cafe 35k hôm qua momo')
    expect(res.amount).toBe(35000)
    expect(res.type).toBe('expense')
    expect(res.date).toBe('2026-11-26')
    expect(res.dateLabel).toBe('Hôm qua')
    expect(res.wallet).toBe('Ví MoMo')
    expect(res.category).toBe('Ăn uống')
    expect(res.confidence).toEqual({
      amount: true,
      date: true,
      wallet: true,
      category: true
    })
  })

  it('bóc tách định dạng tiền "1tr2" và ngày "hôm kia"', () => {
    const res = parseQuickEntry('tiền phòng 1tr2 hôm kia vcb')
    expect(res.amount).toBe(1200000)
    expect(res.date).toBe('2026-11-25')
    expect(res.dateLabel).toBe('Hôm kia')
    expect(res.wallet).toBe('Vietcombank')
    expect(res.category).toBe('Nhà cửa')
  })

  it('bóc tách định dạng tiền thập phân "1.5 triệu" và ví Tiền mặt', () => {
    const res = parseQuickEntry('mua sách 1.5 triệu hôm nay tiền mặt')
    expect(res.amount).toBe(1500000)
    expect(res.date).toBe('2026-11-27')
    expect(res.dateLabel).toBe('Hôm nay')
    expect(res.wallet).toBe('Tiền mặt')
    expect(res.category).toBe('Mua sắm')
  })

  it('bóc tách định dạng tiền số nguyên có dấu chấm "250.000"', () => {
    const res = parseQuickEntry('đổ xăng 250.000 mb')
    expect(res.amount).toBe(250000)
    expect(res.wallet).toBe('MB Bank')
    expect(res.category).toBe('Di chuyển')
  })

  it('bóc tách định dạng tiền số nguyên thuần "200000"', () => {
    const res = parseQuickEntry('xem phim 200000 zalopay')
    expect(res.amount).toBe(200000)
    expect(res.wallet).toBe('ZaloPay')
    expect(res.category).toBe('Giải trí')
  })

  it('bóc tách câu thu nhập: "nhận lương 15tr techcombank"', () => {
    const res = parseQuickEntry('nhận lương 15tr techcombank')
    expect(res.type).toBe('income')
    expect(res.amount).toBe(15000000)
    expect(res.wallet).toBe('Techcombank')
    expect(res.category).toBe('Lương & Thưởng')
  })

  it('bóc tách ngày theo định dạng dd/mm', () => {
    const res = parseQuickEntry('ăn trưa 55k 15/11 cash')
    expect(res.amount).toBe(55000)
    expect(res.dateLabel).toBe('15/11')
    expect(res.confidence.date).toBe(true)
    expect(res.wallet).toBe('Tiền mặt')
    expect(res.category).toBe('Ăn uống')
  })

  it('bóc tách từ khóa không dấu: "tra sua 45 nghin hom nay"', () => {
    const res = parseQuickEntry('tra sua 45 nghin hom nay')
    expect(res.amount).toBe(45000)
    expect(res.category).toBe('Ăn uống')
    expect(res.confidence.date).toBe(true)
  })

  it('đánh dấu confidence = false khi thiếu số tiền, ví và danh mục (không tự đoán)', () => {
    const res = parseQuickEntry('chi linh tinh cho bạn')
    expect(res.amount).toBeNull()
    expect(res.wallet).toBeNull()
    expect(res.category).toBeNull()
    expect(res.confidence.amount).toBe(false)
    expect(res.confidence.wallet).toBe(false)
    expect(res.confidence.category).toBe(false)
    expect(res.confidence.date).toBe(false)
  })

  it('bóc tách tiền có 2 chữ số sau "tr": "2tr25"', () => {
    const res = parseQuickEntry('shopee 2tr25 tcb')
    expect(res.amount).toBe(2250000)
    expect(res.wallet).toBe('Techcombank')
    expect(res.category).toBe('Mua sắm')
  })

  it('nhận diện khoản thưởng là thu nhập', () => {
    const res = parseQuickEntry('thưởng dự án 3.5tr vietcombank')
    expect(res.type).toBe('income')
    expect(res.amount).toBe(3500000)
    expect(res.wallet).toBe('Vietcombank')
    expect(res.category).toBe('Lương & Thưởng')
  })
})
