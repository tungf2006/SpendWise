/**
 * CSV export helpers for SpendWise.
 * - UTF-8 BOM lets Excel recognise Vietnamese text.
 * - RFC 4180-style quoting handles commas, quotes and multi-line notes.
 * - Potential spreadsheet formulas from user-entered text are escaped.
 * - Numeric amounts remain numeric when opened in Excel.
 */

const HEADERS = [
  'Ngày giao dịch',
  'Loại giao dịch',
  'Số tiền (VNĐ)',
  'Danh mục',
  'Ví thanh toán',
  'Ví nhận',
  'Ghi chú'
]

const TYPE_LABELS = {
  income: 'Thu nhập',
  expense: 'Chi tiêu',
  transfer: 'Chuyển tiền'
}

// Prevent CSV/formula injection if a user-supplied name or note starts with a
// formula marker, including when preceded by whitespace/control characters.
export function escapeCsvText(value) {
  const raw = String(value ?? '')
  const safe = /^[\s\uFEFF]*[=+\-@]/u.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}

export function transactionsToCsv(transactions = []) {
  if (!Array.isArray(transactions)) {
    throw new TypeError('Danh sách giao dịch không hợp lệ')
  }

  const headerRow = HEADERS.map(escapeCsvText).join(',')
  const dataRows = transactions.map((transaction) => {
    const amount = Number(transaction.amount)
    const safeAmount = Number.isFinite(amount) ? String(Math.abs(amount)) : '0'

    const fields = [
      escapeCsvText(transaction.transaction_date),
      escapeCsvText(TYPE_LABELS[transaction.type] || transaction.type || ''),
      safeAmount,
      escapeCsvText(transaction.category?.name || (transaction.type === 'transfer' ? 'Chuyển nội bộ' : 'Chưa phân loại')),
      escapeCsvText(transaction.wallet?.name),
      escapeCsvText(transaction.to_wallet?.name),
      escapeCsvText(transaction.note)
    ]
    return fields.join(',')
  })

  return '\uFEFF' + [headerRow, ...dataRows].join('\r\n') + '\r\n'
}

export function defaultTransactionCsvFilename(date = new Date()) {
  // Use the user's LOCAL calendar date rather than UTC to avoid off-by-one days.
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `SpendWise_GiaoDich_${year}-${month}-${day}.csv`
}

export function downloadTransactionsCsv(transactions, filename = defaultTransactionCsvFilename()) {
  if (!Array.isArray(transactions) || transactions.length === 0) return false

  const blob = new Blob([transactionsToCsv(transactions)], {
    type: 'text/csv;charset=utf-8'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)

  try {
    link.click()
  } finally {
    link.remove()
    // Delayed cleanup avoids cancelling a download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return true
}
