/**
 * Định dạng số tiền sang định dạng tiền Việt Nam (VNĐ)
 * @param {number|string} amount Số tiền cần định dạng
 * @returns {string} Chuỗi tiền tệ đã định dạng (VD: 150.000 ₫)
 */
export const formatCurrency = (amount) => {
  const num = Number(amount) || 0
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(num)
}
