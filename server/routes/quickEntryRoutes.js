import { Router } from 'express'

const router = Router()

/**
 * Hàm loại bỏ dấu tiếng Việt
 */
function removeVietnameseTones(str) {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

/**
 * Bộ bóc tách câu tự nhiên chạy phía Server (Server-Side Quick Entry Parser)
 * Phụ trách: TV4 (Lê Hoài Quốc) - Nhóm chức năng QUICK (UC18)
 */
function parseQuickEntryServer(text) {
  if (!text || typeof text !== 'string') {
    return {
      rawText: '',
      amount: null,
      date: new Date().toISOString().split('T')[0],
      walletKeyword: null,
      type: 'expense',
      categoryName: null
    }
  }

  const cleanText = text.trim()
  const lowerText = cleanText.toLowerCase()
  const unaccented = removeVietnameseTones(lowerText)

  // 1. Tách số tiền (amount)
  let amount = null
  const regexMillionK = /(\d+(?:\.\d+)?)\s*(?:tr|trieu|triệu)\s*(\d+)?\s*(?:k|nghin|nghìn)?/i
  const regexMillion = /(\d+(?:\.\d+)?)\s*(?:tr|trieu|triệu)/i
  const regexThousand = /(\d+(?:\.\d+)?)\s*(?:k|nghin|nghìn)/i
  const regexPlainNumber = /(?:^|\s)(\d{1,3}(?:\.\d{3})+|\d{4,10})(?:\s|$|d|đ|vnd|dong)/i

  if (regexMillionK.test(cleanText)) {
    const match = cleanText.match(regexMillionK)
    const millions = parseFloat(match[1]) * 1000000
    const thousands = match[2] ? parseInt(match[2], 10) * (match[2].length <= 2 ? 100000 : 1000) : 0
    amount = Math.round(millions + thousands)
  } else if (regexMillion.test(cleanText)) {
    const match = cleanText.match(regexMillion)
    amount = Math.round(parseFloat(match[1]) * 1000000)
  } else if (regexThousand.test(cleanText)) {
    const match = cleanText.match(regexThousand)
    amount = Math.round(parseFloat(match[1]) * 1000)
  } else if (regexPlainNumber.test(cleanText)) {
    const match = cleanText.match(regexPlainNumber)
    const cleanNum = match[1].replace(/\./g, '')
    amount = parseInt(cleanNum, 10)
  }

  // 2. Tách ngày (date)
  const today = new Date()
  let date = today.toISOString().split('T')[0]

  if (unaccented.includes('hom kia')) {
    const d = new Date()
    d.setDate(d.getDate() - 2)
    date = d.toISOString().split('T')[0]
  } else if (unaccented.includes('hom qua')) {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    date = d.toISOString().split('T')[0]
  } else if (unaccented.includes('hom nay')) {
    date = today.toISOString().split('T')[0]
  }

  // 3. Tách loại giao dịch (type)
  const incomeKeywords = ['luong', 'thuong', 'nhan', 'thu', 'ban do', 'lai tiet kiem', 'li xi']
  const isIncome = incomeKeywords.some(kw => unaccented.includes(kw))
  const type = isIncome ? 'income' : 'expense'

  // 4. Tách ví (wallet)
  let walletKeyword = null
  if (unaccented.includes('momo')) walletKeyword = 'momo'
  else if (unaccented.includes('vcb') || unaccented.includes('vietcombank')) walletKeyword = 'vietcombank'
  else if (unaccented.includes('tien mat')) walletKeyword = 'tien mat'
  else if (unaccented.includes('zalopay')) walletKeyword = 'zalopay'
  else if (unaccented.includes('bank') || unaccented.includes('ngan hang')) walletKeyword = 'bank'

  // 5. Tách danh mục (category)
  let categoryName = null
  if (unaccented.includes('cafe') || unaccented.includes('ca phe') || unaccented.includes('com') || unaccented.includes('pho') || unaccented.includes('an')) {
    categoryName = 'Ăn uống'
  } else if (unaccented.includes('xang') || unaccented.includes('grab') || unaccented.includes('be') || unaccented.includes('taxi')) {
    categoryName = 'Di chuyển'
  } else if (unaccented.includes('tien nha') || unaccented.includes('dien') || unaccented.includes('nuoc') || unaccented.includes('wifi') || unaccented.includes('internet')) {
    categoryName = 'Hóa đơn & Tiện ích'
  } else if (unaccented.includes('shopee') || unaccented.includes('quan ao') || unaccented.includes('mua sam')) {
    categoryName = 'Mua sắm'
  } else if (unaccented.includes('luong')) {
    categoryName = 'Lương'
  }

  return {
    rawText: cleanText,
    amount,
    date,
    walletKeyword,
    type,
    categoryName
  }
}

/**
 * POST /api/quick-entry/parse
 */
router.post('/parse', (req, res) => {
  try {
    const { text } = req.body
    if (!text) {
      return res.status(400).json({ success: false, error: 'Thiếu chuỗi câu tự nhiên đầu vào' })
    }

    const parsed = parseQuickEntryServer(text)
    return res.status(200).json({
      success: true,
      data: parsed
    })
  } catch (error) {
    console.error('[API /api/quick-entry/parse Error]:', error)
    return res.status(500).json({ success: false, error: error.message })
  }
})

export default router
