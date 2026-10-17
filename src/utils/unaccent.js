/**
 * Loại bỏ dấu tiếng Việt để tìm kiếm không dấu
 * @param {string} str Chuỗi tiếng Việt có dấu
 * @returns {string} Chuỗi không dấu ở dạng chữ thường
 */
export const removeVietnameseTones = (str) => {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}
