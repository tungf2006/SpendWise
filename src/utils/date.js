/**
 * Tiện ích định dạng ngày tháng theo múi giờ địa phương (Local Timezone)
 * Tránh lỗi lệch -1 ngày do dùng .toISOString() ở khung giờ 00:00–06:59 UTC+7 (Việt Nam).
 */

/**
 * Trả về chuỗi ngày YYYY-MM-DD theo múi giờ máy người dùng
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getLocalDateString(date = new Date()) {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  const year = safeDate.getFullYear()
  const month = String(safeDate.getMonth() + 1).padStart(2, '0')
  const day = String(safeDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
