/**
 * SPENDWISE – BỘ PHÂN TÍCH CÂU TỰ NHIÊN (QUICK ENTRY PARSER)
 * Hiện thực thuật toán bóc tách Rule-based: Số tiền, Ngày, Ví, Loại, Danh mục.
 */
import { removeVietnameseTones } from '@/utils/unaccent'

export function parseQuickEntry(input) {
  if (!input || typeof input !== 'string') return null

  const rawText = input.trim()
  const cleanText = removeVietnameseTones(rawText)

  const result = {
    originalText: rawText,
    amount: null,
    date: new Date().toISOString().split('T')[0], // Mặc định hôm nay
    dateLabel: 'Hôm nay',
    type: 'expense', // Mặc định chi tiêu
    wallet: null,
    category: null,
    note: rawText,
    confidence: {
      amount: false,
      date: false,
      wallet: false,
      category: false,
    }
  }

  // 1. BÓC TÁCH LOẠI (INCOME vs EXPENSE)
  const incomeKeywords = ['luong', 'thuong', 'nhan tien', 'thu nhap', 'duoc cho', 'ban duoc', 'tien ve']
  for (const kw of incomeKeywords) {
    if (cleanText.includes(kw)) {
      result.type = 'income'
      break
    }
  }

  // 2. BÓC TÁCH NGÀY (TRANSACTION_DATE)
  const today = new Date()
  if (cleanText.includes('hom kia')) {
    const d = new Date(today)
    d.setDate(today.getDate() - 2)
    result.date = d.toISOString().split('T')[0]
    result.dateLabel = 'Hôm kia'
    result.confidence.date = true
  } else if (cleanText.includes('hom qua')) {
    const d = new Date(today)
    d.setDate(today.getDate() - 1)
    result.date = d.toISOString().split('T')[0]
    result.dateLabel = 'Hôm qua'
    result.confidence.date = true
  } else if (cleanText.includes('hom nay')) {
    result.date = today.toISOString().split('T')[0]
    result.dateLabel = 'Hôm nay'
    result.confidence.date = true
  } else {
    // Thử bắt định dạng dd/mm
    const dateMatch = rawText.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/)
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10)
      const month = parseInt(dateMatch[2], 10) - 1
      const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : today.getFullYear()
      const d = new Date(year, month, day)
      if (!isNaN(d.getTime())) {
        result.date = d.toISOString().split('T')[0]
        result.dateLabel = `${dateMatch[1]}/${dateMatch[2]}`
        result.confidence.date = true
      }
    }
  }

  // 3. BÓC TÁCH VÍ (WALLET)
  const walletRules = [
    { key: 'momo', label: 'Ví MoMo' },
    { key: 'zalopay', label: 'ZaloPay' },
    { key: 'vcb', label: 'Vietcombank' },
    { key: 'vietcombank', label: 'Vietcombank' },
    { key: 'techcombank', label: 'Techcombank' },
    { key: 'tcb', label: 'Techcombank' },
    { key: 'mb', label: 'MB Bank' },
    { key: 'tien mat', label: 'Tiền mặt' },
    { key: 'cash', label: 'Tiền mặt' },
  ]
  for (const w of walletRules) {
    if (cleanText.includes(w.key)) {
      result.wallet = w.label
      result.confidence.wallet = true
      break
    }
  }

  // 4. BÓC TÁCH DANH MỤC (CATEGORY)
  const categoryRules = [
    { name: 'Ăn uống', keywords: ['cafe', 'ca phe', 'coffee', 'tra sua', 'pho', 'bun', 'com', 'an trua', 'an sang', 'an toi', 'lau', 'nuong', 'pizza', 'banh mi'] },
    { name: 'Di chuyển', keywords: ['xang', 'do xang', 'grab', 'be', 'gojek', 'xe buyt', 'gui xe', 'taxi'] },
    { name: 'Mua sắm', keywords: ['mua sach', 'shopee', 'lazada', 'tiki', 'quan ao', 'giay', 'sieu thi', 'tap hoa'] },
    { name: 'Nhà cửa', keywords: ['tien phong', 'tien nha', 'dien', 'nuoc', 'internet', 'wifi', 'rac'] },
    { name: 'Giải trí', keywords: ['xem phim', 'cinema', 'game', 'netflix', 'spotify', 'du lich'] },
    { name: 'Lương & Thưởng', keywords: ['luong', 'thuong', 'bonus', 'part time'] },
  ]
  for (const cat of categoryRules) {
    const match = cat.keywords.some(kw => cleanText.includes(kw))
    if (match) {
      result.category = cat.name
      result.confidence.category = true
      break
    }
  }

  // 5. BÓC TÁCH SỐ TIỀN (AMOUNT)
  // Quy tắc 1tr2, 1.5tr, 1.5 triệu, 35k, 500 nghìn, 200000
  let amountFound = null

  // Bắt "1tr2", "2tr5", "1m2"
  const trMatch = cleanText.match(/(\d+)\s*(?:tr|trieu|m)\s*(\d+)/i)
  if (trMatch) {
    const major = parseInt(trMatch[1], 10) * 1000000
    const minorStr = trMatch[2]
    const minor = parseInt(minorStr, 10) * (minorStr.length === 1 ? 100000 : minorStr.length === 2 ? 10000 : 1000)
    amountFound = major + minor
  }

  // Bắt "1.5tr", "1.5 triệu", "2.2tr"
  if (!amountFound) {
    const floatTrMatch = cleanText.match(/(\d+(?:[.,]\d+)?)\s*(?:tr|trieu|m)\b/i)
    if (floatTrMatch) {
      const val = parseFloat(floatTrMatch[1].replace(',', '.'))
      amountFound = Math.round(val * 1000000)
    }
  }

  // Bắt "35k", "150k"
  if (!amountFound) {
    const kMatch = cleanText.match(/(\d+)\s*(?:k|nghin|ngan)\b/i)
    if (kMatch) {
      amountFound = parseInt(kMatch[1], 10) * 1000
    }
  }

  // Bắt số nguyên thuần túy (VD: "200000", "50.000")
  if (!amountFound) {
    const numMatch = cleanText.match(/\b(\d{1,3}(?:[.,]\d{3})+|\d{4,9})\b/)
    if (numMatch) {
      const cleanNum = numMatch[1].replace(/[.,]/g, '')
      amountFound = parseInt(cleanNum, 10)
    }
  }

  if (amountFound && amountFound > 0) {
    result.amount = amountFound
    result.confidence.amount = true
  }

  return result
}
