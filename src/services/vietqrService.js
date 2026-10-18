/**
 * Service Chia hóa đơn (Bill Split) và Tạo mã VietQR chuẩn ngân hàng
 * Phụ trách: TV1 (Trương Bích Vân) - Nhóm chức năng NOTI_QR (UC26)
 */

export const POPULAR_BANKS = [
  { bin: '970436', shortName: 'Vietcombank', name: 'Ngân hàng Ngoại thương Việt Nam' },
  { bin: '970422', shortName: 'MBBank', name: 'Ngân hàng Quân Đội' },
  { bin: '970407', shortName: 'Techcombank', name: 'Ngân hàng Kỹ Thương Việt Nam' },
  { bin: '970415', shortName: 'VietinBank', name: 'Ngân hàng Công Thương Việt Nam' },
  { bin: '970418', shortName: 'BIDV', name: 'Ngân hàng Đầu tư và Phát triển Việt Nam' },
  { bin: '970416', shortName: 'ACB', name: 'Ngân hàng Á Châu' },
  { bin: '970432', shortName: 'VPBank', name: 'Ngân hàng Việt Nam Thịnh Vượng' },
  { bin: '970423', shortName: 'TPBank', name: 'Ngân hàng Tiên Phong' }
]

/**
 * Sinh đường dẫn ảnh mã VietQR qua dịch vụ img.vietqr.io (UC26)
 * @param {object} params 
 * @param {string} params.bankBin Mã BIN ngân hàng (VD: '970436')
 * @param {string} params.bankAccount Số tài khoản ngân hàng thụ hưởng
 * @param {number} [params.amount] Số tiền chuyển khoản
 * @param {string} [params.memo] Nội dung chuyển khoản
 * @param {string} [params.accountName] Tên chủ tài khoản
 * @param {'compact' | 'compact2' | 'qr_only' | 'print'} [params.template='compact'] Mẫu hiển thị QR
 * @returns {string} URL ảnh QR
 */
export function generateVietQrUrl({
  bankBin,
  bankAccount,
  amount = 0,
  memo = '',
  accountName = '',
  template = 'compact'
}) {
  if (!bankBin || !bankAccount) return ''

  const baseUrl = `https://img.vietqr.io/image/${bankBin}-${bankAccount}-${template}.png`
  const queryParams = new URLSearchParams()

  if (amount && Number(amount) > 0) {
    queryParams.append('amount', Math.round(Number(amount)).toString())
  }
  if (memo && memo.trim()) {
    queryParams.append('addInfo', memo.trim())
  }
  if (accountName && accountName.trim()) {
    queryParams.append('accountName', accountName.trim().toUpperCase())
  }

  const queryString = queryParams.toString()
  return queryString ? `${baseUrl}?${queryString}` : baseUrl
}

/**
 * Thuật toán tính toán chia hóa đơn (UC26)
 * @param {object} params 
 * @param {number} params.totalAmount Tổng số tiền hóa đơn
 * @param {number} params.numberOfPeople Số người chia đều
 * @param {number} [params.tipPercent=0] % tiền tip hoặc phí dịch vụ
 * @returns {{
 *   totalAmountWithTip: number,
 *   amountPerPerson: number,
 *   tipAmount: number,
 *   numberOfPeople: number
 * }}
 */
export function splitBill({ totalAmount, numberOfPeople = 1, tipPercent = 0 }) {
  const baseAmount = Math.max(0, Number(totalAmount) || 0)
  const people = Math.max(1, Number(numberOfPeople) || 1)
  const tip = Math.max(0, Number(tipPercent) || 0)

  const tipAmount = Math.round((baseAmount * tip) / 100)
  const totalAmountWithTip = baseAmount + tipAmount
  const amountPerPerson = Math.ceil(totalAmountWithTip / people)

  return {
    totalAmountWithTip,
    amountPerPerson,
    tipAmount,
    numberOfPeople: people
  }
}
