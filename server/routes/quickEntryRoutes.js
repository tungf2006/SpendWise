import { Router } from 'express'

/** UC18/UC19 - backend parser, self-contained. Mirrors src/services/quickEntryParser.js. */
/**
 * SpendWise Quick Entry parser (UC18/UC19).
 * Inlined in the entrypoint so no shared/ or server/services/ directory is required.
 * The fallback names and keywords mirror supabase/init_schema.sql on develop (2026-11-20).
 */

const TIME_ZONE = 'Asia/Ho_Chi_Minh'

// DB categories (including user-created ones) override these fallback keyword rules.
const FALLBACK_CATEGORIES = [
  { name: 'Ăn uống', type: 'expense', keywords: ['an', 'uong', 'com', 'pho', 'bun', 'cafe', 'ca phe', 'coffee', 'tra sua', 'nhau', 'bua sang', 'bua trua', 'bua toi', 'highlands', 'kfc', 'banh mi', 'lau', 'pizza'] },
  { name: 'Di chuyển', type: 'expense', keywords: ['xang', 'do xang', 'grab', 'be', 'gojek', 'taxi', 'xe buyt', 'gui xe', 've xe', 'sua xe', 'di lai'] },
  { name: 'Hóa đơn & Tiện ích', type: 'expense', keywords: ['tien nha', 'tien tro', 'thue nha', 'thue phong', 'tien phong', 'dien', 'nuoc', 'internet', 'wifi', '4g', '5g', 'rac', 'hoa don'] },
  { name: 'Mua sắm', type: 'expense', keywords: ['shopee', 'lazada', 'tiktok', 'tiki', 'quan ao', 'giay dep', 'my pham', 'sieu thi', 'bach hoa xanh', 'winmart', 'tap hoa', 'mua sam', 'mua', 'ban phim'] },
  { name: 'Giải trí & Học tập', type: 'expense', keywords: ['xem phim', 'cgv', 'cinema', 'netflix', 'spotify', 'sach', 'khoa hoc', 'hoc phi', 'game', 'du lich'] },
  { name: 'Y tế & Sức khỏe', type: 'expense', keywords: ['thuoc', 'kham benh', 'benh vien', 'nha khoa', 'gym', 'the thao'] },
  { name: 'Lương', type: 'income', keywords: ['luong', 'ung luong', 'salary'] },
  { name: 'Thưởng & Thu nhập phụ', type: 'income', keywords: ['thuong', 'bonus', 'thu nhap phu', 'freelance', 'part time', 'ban do', 'lai tiet kiem', 'li xi', 'hoc bong'] },
]

const WALLET_ALIASES = [
  { keyword: 'momo', label: 'Ví MoMo', aliases: ['momo', 'vi momo'] },
  { keyword: 'zalopay', label: 'ZaloPay', aliases: ['zalopay', 'zalo pay'] },
  { keyword: 'vietcombank', label: 'Vietcombank', aliases: ['vietcombank', 'vcb'] },
  { keyword: 'techcombank', label: 'Techcombank', aliases: ['techcombank', 'tcb'] },
  { keyword: 'mb', label: 'MB Bank', aliases: ['mb bank', 'mbbank', 'mb'] },
  { keyword: 'tien mat', label: 'Tiền mặt', aliases: ['tien mat', 'cash'] },
  { keyword: 'ngan hang', label: 'Ngân hàng', aliases: ['ngan hang', 'bank'] },
]

const INCOME_KEYWORDS = [
  'luong', 'ung luong', 'salary', 'thuong', 'bonus', 'thu nhap', 'thu nhap phu',
  'nhan tien', 'nhan duoc tien', 'duoc cho', 'ban do', 'ban duoc',
  'lai tiet kiem', 'li xi', 'hoc bong', 'freelance',
]

export function normalizeQuickText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Entire normalized word/phrase, not substring (e.g. `an` cannot match `ban`). */
function phraseRegex(phrase) {
  const words = normalizeQuickText(phrase).split(' ').filter(Boolean)
  if (!words.length) return null
  return new RegExp(`(?<![a-z0-9])${words.map(escapeRegExp).join('\\s+')}(?![a-z0-9])`, 'u')
}

function hasPhrase(haystack, phrase) {
  const regex = phraseRegex(phrase)
  return Boolean(regex && regex.test(haystack))
}

function localParts(now) {
  const safeNow = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(safeNow)
  const get = (type) => Number(parts.find((part) => part.type === type).value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function dateString(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function addCalendarDays({ year, month, day }, offset) {
  // Arithmetic on UTC *calendar components*, never conversion of local midnight to ISO.
  const d = new Date(Date.UTC(year, month - 1, day + offset))
  return dateString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

function parseDate(raw, normalized, now) {
  const today = localParts(now)
  // Explicit dates take precedence over relative dates.
  const match = raw.match(/(?<![\d/-])([0-9]{1,2})[/-]([0-9]{1,2})(?:[/-]([0-9]{2}|[0-9]{4}))?(?![\d/-])/u)
  if (match) {
    const day = Number(match[1]); const month = Number(match[2])
    const year = match[3] ? (match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])) : today.year
    const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    if (!Number.isInteger(year) || year < 1 || month < 1 || month > 12 || day < 1 || day > maxDay) return null
    return dateString(year, month, day)
  }
  if (hasPhrase(normalized, 'hom kia')) return addCalendarDays(today, -2)
  if (hasPhrase(normalized, 'hom qua')) return addCalendarDays(today, -1)
  return dateString(today.year, today.month, today.day)
}

function asAmount(n) {
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

function parseAmount(normalized) {
  // 1tr5=1,500,000; 1tr25=1,250,000; 1tr250=1,250,000.
  // Explicit `k` means thousands: 1tr25k=1,025,000. Do not consume date digits.
  const million = normalized.match(/(?<![a-z0-9])([0-9]+(?:[.,][0-9]+)?)\s*(?:trieu|tr|m)(?:([0-9]{1,6})(k)?|[ \t]+([0-9]{1,3})k)?(?![a-z0-9])/u)
  if (million) {
    const major = Math.round(Number(million[1].replace(',', '.')) * 1_000_000)
    let extra = 0
    if (million[2]) {
      extra = million[3] ? Number(million[2]) * 1_000 : Number(million[2]) * 10 ** (6 - million[2].length)
    } else if (million[4]) {
      extra = Number(million[4]) * 1_000
    }
    return asAmount(major + extra)
  }
  const thousand = normalized.match(/(?<![a-z0-9])([0-9]+(?:[.,][0-9]+)?)\s*(?:k|nghin|ngan)(?![a-z0-9])/u)
  if (thousand) return asAmount(Math.round(Number(thousand[1].replace(',', '.')) * 1_000))

  // Guard against 2026 in `15/11/2026` being interpreted as an amount.
  const plain = normalized.match(/(?<![a-z0-9/.,-])([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,12})(?:\s*(?:d|vnd))?(?![a-z0-9/.,-])/u)
  if (plain) return asAmount(Number(plain[1].replace(/[.,]/g, '')))
  return null
}

function walletCandidates(wallets) {
  const fromDB = Array.isArray(wallets)
    ? wallets
        .filter((w) => w && !w.is_archived && typeof w.name === 'string' && w.name.trim())
        .map((w) => ({
          keyword: normalizeQuickText(w.name), label: w.name, aliases: [w.name],
        }))
    : []
  return [...WALLET_ALIASES, ...fromDB]
}

function findWalletInText(normalized, wallets) {
  const hits = []
  for (const wallet of walletCandidates(wallets)) {
    for (const phrase of wallet.aliases) {
      const regex = phraseRegex(phrase)
      const match = regex?.exec(normalized)
      if (match) hits.push({ wallet, index: match.index, length: match[0].length })
    }
  }
  // Earliest match wins; for ties, the longer/specific phrase wins.
  hits.sort((a, b) => a.index - b.index || b.length - a.length)
  return hits[0]?.wallet ?? null
}

/** Find a loaded Supabase wallet record by its canonical keyword or label. */
export function resolveQuickWallet(wallets, keywordOrLabel) {
  if (!Array.isArray(wallets) || !keywordOrLabel) return null
  const search = normalizeQuickText(keywordOrLabel)
  const canonical = WALLET_ALIASES.find((w) => w.keyword === search ||
    normalizeQuickText(w.label) === search || w.aliases.some((alias) => normalizeQuickText(alias) === search))
  const list = wallets.filter((w) => w && !w.is_archived && typeof w.name === 'string' && w.name.trim())
  const exact = list.find((w) => normalizeQuickText(w.name) === search)
  if (exact) return exact
  if (canonical) {
    return list.find((w) => canonical.aliases.some((alias) => hasPhrase(normalizeQuickText(w.name), alias))) ?? null
  }
  return null
}

function matchCategory(normalized, type, categories) {
  if (type === 'transfer') return null
  const db = Array.isArray(categories) ? categories.filter((cat) => cat && cat.type === type && typeof cat.name === 'string') : []
  const withKeywords = (cats) => {
    const matches = []
    for (const cat of cats) {
      for (const keyword of (Array.isArray(cat.keywords) ? cat.keywords : [])) {
        if (typeof keyword === 'string' && hasPhrase(normalized, keyword)) {
          matches.push({ name: cat.name, length: normalizeQuickText(keyword).length })
        }
      }
    }
    matches.sort((a, b) => b.length - a.length)
    return matches[0]?.name ?? null
  }
  // Dynamic DB keywords first, then schema-derived fallback synonyms.
  const dbMatch = withKeywords(db)
  if (dbMatch) return dbMatch
  const fallbackName = withKeywords(FALLBACK_CATEGORIES.filter((cat) => cat.type === type))
  if (!fallbackName) return null
  if (!Array.isArray(categories)) return fallbackName
  // Never emit a category name that is absent from the provided DB list.
  const nameAliases = {
    'Hóa đơn & Tiện ích': ['Hóa đơn & Nhà cửa'],
    'Giải trí & Học tập': ['Giải trí & Du lịch'],
  }
  const possibleNames = [fallbackName, ...(nameAliases[fallbackName] ?? [])]
  return db.find((cat) => possibleNames.some((name) => normalizeQuickText(cat.name) === normalizeQuickText(name)))?.name ?? null
}

/**
 * @param {string} input Vietnamese natural language text
 * @param {{categories?: object[], wallets?: object[], now?: Date}} options
 * @returns {object|null} Null for blank text or invalid explicit calendar date.
 */
export function parseQuickEntryServer(input, { categories, wallets, now = new Date() } = {}) {
  if (typeof input !== 'string' || !input.trim()) return null
  const originalText = input.trim()
  const normalized = normalizeQuickText(originalText)
  const date = parseDate(originalText, normalized, now)
  if (!date) return null // Reject e.g. 31/02 rather than silently moving to March.

  const isTransfer = hasPhrase(normalized, 'chuyen') && hasPhrase(normalized, 'tu') && hasPhrase(normalized, 'sang')
  const hasIncomeHint = INCOME_KEYWORDS.some((kw) => hasPhrase(normalized, kw))
  // Fallback to DB income keywords only when a specific income category matches.
  const dbIncome = matchCategory(normalized, 'income', categories)
  const type = isTransfer ? 'transfer' : (hasIncomeHint || dbIncome ? 'income' : 'expense')

  let source = null
  let target = null
  if (type === 'transfer') {
    // A source must appear after "từ", a destination after "sang".
    const transferParts = /(?<![a-z0-9])tu\s+(.+?)\s+sang\s+(.+?)(?=$|[,.!?])/u.exec(normalized)
    if (transferParts) {
      source = findWalletInText(transferParts[1], wallets)
      target = findWalletInText(transferParts[2], wallets)
    }
  } else {
    source = findWalletInText(normalized, wallets)
  }
  const categoryName = matchCategory(normalized, type, categories)

  return {
    amount: parseAmount(normalized),
    type,
    date,
    wallet: source?.label ?? null,
    walletKeyword: source?.keyword ?? null,
    category: categoryName,
    categoryName,
    note: originalText,
    originalText,
    rawText: originalText,
    // The two extra fields are required to persist transfer.to_wallet_id safely.
    toWallet: target?.label ?? null,
    toWalletKeyword: target?.keyword ?? null,
  }
}

const router = Router()

/**
 * POST /api/quick-entry/parse
 * Body: { text: string, categories?: [{name,type,keywords}], wallets?: [{name}] }
 * Categories should be from the authenticated user's getCategories() result.
 * When not supplied, fallback rules mirror supabase/init_schema.sql.
 */
router.post('/parse', (req, res) => {
  try {
    const { text, categories, wallets } = req.body ?? {}
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Thiếu chuỗi câu tự nhiên đầu vào' })
    }
    if (categories !== undefined && !Array.isArray(categories)) {
      return res.status(400).json({ success: false, error: 'categories phải là mảng' })
    }
    if (wallets !== undefined && !Array.isArray(wallets)) {
      return res.status(400).json({ success: false, error: 'wallets phải là mảng' })
    }
    const parsed = parseQuickEntryServer(text, { categories, wallets })
    if (!parsed) {
      return res.status(422).json({ success: false, error: 'Ngày không hợp lệ hoặc câu nhập không thể phân tích' })
    }
    return res.status(200).json({ success: true, data: parsed })
  } catch (error) {
    console.error('[API /api/quick-entry/parse Error]:', error)
    return res.status(500).json({ success: false, error: 'Không thể phân tích câu nhập nhanh' })
  }
})

export default router
