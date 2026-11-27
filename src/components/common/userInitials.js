/**
 * Tạo chữ viết tắt 2 ký tự hiển thị trên avatar từ họ tên hoặc email.
 * Loại bỏ các thẻ chú thích trong ngoặc như "(Demo)" hoặc "[Test]" và ký tự đặc biệt.
 */
function extractWords(rawText) {
  if (typeof rawText !== 'string') return []
  const cleaned = rawText
    .normalize('NFC')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\s]+/gu, ' ')
    .trim()

  if (!cleaned) return []
  return cleaned.split(/\s+/).filter(Boolean)
}

export function getUserInitials(name, emailFallback = '', defaultFallback = 'SW') {
  const words = extractWords(name)

  if (words.length >= 2) {
    const secondLast = Array.from(words[words.length - 2])[0] || ''
    const last = Array.from(words[words.length - 1])[0] || ''
    const result = `${secondLast}${last}`.toLocaleUpperCase('vi-VN')
    if (result) return result
  }

  if (words.length === 1) {
    const chars = Array.from(words[0]).slice(0, 2).join('').toLocaleUpperCase('vi-VN')
    if (chars) return chars
  }

  const emailLocalPart =
    typeof emailFallback === 'string' ? emailFallback.split('@')[0] : ''
  if (emailLocalPart) {
    const emailWords = extractWords(emailLocalPart)
    if (emailWords.length >= 2) {
      const secondLast = Array.from(emailWords[emailWords.length - 2])[0] || ''
      const last = Array.from(emailWords[emailWords.length - 1])[0] || ''
      const result = `${secondLast}${last}`.toLocaleUpperCase('vi-VN')
      if (result) return result
    }
    if (emailWords.length === 1) {
      const chars = Array.from(emailWords[0]).slice(0, 2).join('').toLocaleUpperCase('vi-VN')
      if (chars) return chars
    }
  }

  return defaultFallback
}
