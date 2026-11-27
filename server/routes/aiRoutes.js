import { Router } from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'

const router = Router()

function formatVnd(amount) {
  const num = typeof amount === 'symbol' ? 0 : Number(amount)
  const safeNum = Number.isFinite(num) ? num : 0
  return `${safeNum.toLocaleString('vi-VN')} VNĐ`
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toFiniteNumber(value, fallback = 0) {
  if (typeof value === 'symbol') return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function toSafeString(value, fallback = '') {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

/**
 * Bộ phân tích tài chính thông minh dự phòng (Smart Context-Aware Financial Engine)
 * Trả về trong trường fallbackReply khi GEMINI_API_KEY chưa cấu hình hoặc dịch vụ Google gián đoạn.
 */
export function generateSmartFinancialReply(prompt = '', context = {}) {
  const safeContext = isPlainObject(context) ? context : {}
  const q = toSafeString(prompt, '').toLowerCase()
  const sts = toFiniteNumber(safeContext.safe_to_spend_hom_nay, 0)
  const daysLeft = toFiniteNumber(safeContext.so_ngay_con_lai_trong_thang, 1)
  const totalBalance = toFiniteNumber(safeContext.tong_so_du_vi, 0)
  const recurring = toFiniteNumber(safeContext.khoan_dinh_ky_sap_toi, 0)
  const currentDay = toSafeString(safeContext.ngay_hien_tai, '').trim() || 'Hôm nay'
  const monthLabel = toSafeString(safeContext.thang_nam, '').trim()
  const wallets = Array.isArray(safeContext.danh_sach_vi) ? safeContext.danh_sach_vi.filter(isPlainObject) : []
  const budgets = Array.isArray(safeContext.ngan_sach_thang) ? safeContext.ngan_sach_thang.filter(isPlainObject) : []
  const txns = Array.isArray(safeContext.giao_dich_gan_day) ? safeContext.giao_dich_gan_day.filter(isPlainObject) : []

  if (q.includes('hôm nay') || q.includes('safe') || q.includes('an toàn') || q.includes('tiêu bao nhiêu')) {
    return [
      `📊 **Phân tích Safe-to-spend hôm nay (${currentDay}):**`,
      `- Số tiền an toàn bạn có thể chi tiêu hôm nay là **${formatVnd(sts)}**.`,
      `- Tháng này còn **${daysLeft} ngày** (đã trừ trước **${formatVnd(recurring)}** cho các khoản định kỳ sắp tới).`,
      `- Tổng số dư khả dụng trên các ví hiện tại của bạn là **${formatVnd(totalBalance)}**.`,
      sts > 0
        ? `💡 *Lời khuyên:* Hãy ưu tiên giữ mức chi tiêu trong ngày dưới **${formatVnd(sts)}** để đảm bảo kế hoạch ngân sách cuối tháng luôn an toàn nhé!`
        : `⚠️ *Lưu ý:* Bạn chưa thiết lập ngân sách tháng hoặc ngân sách còn lại đã chạm ngưỡng giới hạn. Hãy kiểm tra mục **Ngân sách** để điều chỉnh kế hoạch chi tiêu.`
    ].join('\n')
  }

  if (q.includes('ăn uống') || q.includes('danh mục') || q.includes('đã chi bao nhiêu')) {
    const foodBudget = budgets.find((b) => toSafeString(b.danh_muc, '').toLowerCase().includes('ăn uống'))
    const foodTxns = txns.filter(
      (t) => toSafeString(t.danh_muc, '').toLowerCase().includes('ăn uống') && t.loai === 'Chi tiêu'
    )
    const foodSpent = foodBudget
      ? toFiniteNumber(foodBudget.da_chi, 0)
      : foodTxns.reduce((s, t) => s + toFiniteNumber(t.so_tien, 0), 0)

    const lines = [
      `🍽️ **Thống kê chi tiêu danh mục Ăn uống (${monthLabel || 'Tháng này'}):**`,
      `- Tổng đã chi cho Ăn uống: **${formatVnd(foodSpent)}** (${foodTxns.length} giao dịch gần đây).`
    ]
    if (foodBudget) {
      lines.push(
        `- Hạn mức ngân sách đặt ra: **${formatVnd(foodBudget.han_muc)}** (Đã dùng **${toSafeString(foodBudget.phan_tram, '0%') || '0%'}**, còn lại **${formatVnd(foodBudget.con_lai)}**).`
      )
    }
    lines.push(
      `💡 *Gợi ý:* Bạn có thể sử dụng thanh **Nhập nhanh (Quick Entry)** trên Dashboard (VD: *"cafe 35k hôm nay momo"*) để theo dõi sát từng bữa ăn hằng ngày.`
    )
    return lines.join('\n')
  }

  if (q.includes('ngân sách') || q.includes('vượt') || q.includes('hạn mức')) {
    if (budgets.length === 0) {
      return `📌 Hiện tại trong tháng **${monthLabel || 'này'}** bạn chưa thiết lập hạn mức ngân sách cho danh mục nào.\n\n💡 Bạn hãy vào trang **Ngân sách** để đặt hạn mức cho các nhóm thiết yếu (Ăn uống, Di chuyển, Hóa đơn) nhằm kích hoạt thanh cảnh báo 3 mức (<80%, 80–99%, >=100%) nhé!`
    }
    const alerts = budgets.filter((b) => b.trang_thai === 'warning' || b.trang_thai === 'exceeded')
    if (alerts.length === 0) {
      return [
        `✅ **Tin tuyệt vời!** Toàn bộ **${budgets.length} danh mục ngân sách** của bạn trong tháng ${monthLabel} đều đang ở ngưỡng **An toàn (<80%)**:`,
        ...budgets.map(
          (b) =>
            `- **${toSafeString(b.danh_muc, 'Khác') || 'Khác'}:** Đã chi ${formatVnd(b.da_chi)} / ${formatVnd(b.han_muc)} (${toSafeString(b.phan_tram, '0%') || '0%'})`
        ),
        `💡 Hãy tiếp tục duy trì thói quen chi tiêu kỷ luật này nhé!`
      ].join('\n')
    }
    return [
      `⚠️ **Cảnh báo các danh mục cần chú ý trong tháng ${monthLabel}:**`,
      ...alerts.map(
        (b) =>
          `- **${toSafeString(b.danh_muc, 'Khác') || 'Khác'}:** Đã dùng **${toSafeString(b.phan_tram, '0%') || '0%'}** (${formatVnd(b.da_chi)} / ${formatVnd(b.han_muc)}) — Trạng thái: **${
            b.trang_thai === 'exceeded' ? 'Đã vượt hạn mức' : 'Sắp vượt (80-99%)'
          }**`
      ),
      `💡 *Khuyến nghị:* Hãy hạn chế phát sinh thêm chi phí ở các danh mục trên trong **${daysLeft} ngày** còn lại của tháng.`
    ].join('\n')
  }

  const walletLines =
    wallets.length > 0
      ? wallets.map((w) => `${toSafeString(w.name, 'Ví') || 'Ví'}: ${formatVnd(w.balance)}`).join(' | ')
      : 'Chưa có ví hoạt động'
  return [
    `✨ **Tổng quan & Tư vấn phân bổ tài chính từ nay đến cuối tháng (${daysLeft} ngày còn lại):**`,
    `- **Tổng số dư các ví:** **${formatVnd(totalBalance)}** (${walletLines}).`,
    `- **Hạn mức chi an toàn mỗi ngày (Safe-to-spend):** **${formatVnd(sts)}/ngày**.`,
    `- **Khoản chi định kỳ sắp đến hạn:** **${formatVnd(recurring)}**.`,
    `💡 **Chiến lược đề xuất (Quy tắc 50/30/20):**`,
    `1. Giữ lại tối thiểu **${formatVnd(recurring)}** trong ví thanh toán để trả các hóa đơn định kỳ đúng hạn.`,
    `2. Giới hạn chi tiêu biến đổi hằng ngày ở mức **${formatVnd(sts)}** và trích ít nhất 10–20% số dư nhàn rỗi vào mục **Tiết kiệm (Saving Goals)**.`
  ].join('\n')
}

/**
 * POST /api/ai/chat
 * Endpoint xử lý yêu cầu hỏi đáp tài chính cá nhân với Google Gemini API (đã bảo vệ bởi requireAuth & rateLimiter)
 * Phụ trách: Leader (Phan Thanh Tùng) - Nhóm chức năng AIBOT (UC21)
 */
router.post('/chat', async (req, res) => {
  const { prompt, context } = req.body || {}

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Nội dung câu hỏi không được để trống.'
    })
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  const modelName = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim()

  if (!apiKey || apiKey.length < 10 || /^(your_|<|changeme|placeholder)/i.test(apiKey)) {
    const fallbackReply = generateSmartFinancialReply(prompt, context)
    return res.status(503).json({
      success: false,
      error: 'Máy chủ chưa cấu hình GEMINI_API_KEY hợp lệ.',
      fallbackReply,
      mode: 'smart_context_advisor',
      timestamp: new Date().toISOString()
    })
  }

  try {
    const systemInstruction = `
Bạn là Trợ lý Tài chính Cá nhân Thông minh của ứng dụng SpendWise (chạy trên Node.js Backend).
Dưới đây là dữ liệu tài chính tổng hợp trong tháng hiện tại của người dùng (dạng JSON):
${context ? JSON.stringify(context, null, 2) : 'Chưa có ngữ cảnh tài chính.'}

NGUYÊN TẮC PHẢN HỒI:
1. Luôn phản hồi bằng TIẾNG VIỆT tự nhiên, thân thiện, súc tích và có tính khích lệ, chuyên môn cao.
2. Dựa HOÀN TOÀN vào số liệu trong JSON trên để trả lời. Không tự bịa đặt số liệu.
3. Nếu người dùng hỏi về "hôm nay tiêu được bao nhiêu", hãy trích dẫn chỉ số safe_to_spend_hom_nay và giải thích ngắn gọn số ngày còn lại trong tháng.
4. Định dạng tiền tệ có dấu chấm phân cách hàng nghìn (VD: 35.000 VNĐ, 2.500.000 VNĐ).
5. Trả lời súc tích khoảng 2-4 đoạn văn ngắn hoặc gạch đầu dòng rõ ràng.
`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelName, systemInstruction })

    const AI_TIMEOUT_MS = 15000
    const abortController = new AbortController()
    let timeoutId
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort()
        const timeoutError = new Error('Yêu cầu Gemini AI quá thời gian chờ.')
        timeoutError.name = 'TimeoutError'
        timeoutError.code = 'ETIMEDOUT'
        reject(timeoutError)
      }, AI_TIMEOUT_MS)
    })

    let result
    try {
      result = await Promise.race([
        model.generateContent(prompt.trim(), {
          timeout: AI_TIMEOUT_MS,
          signal: abortController.signal
        }),
        timeoutPromise
      ])
    } finally {
      clearTimeout(timeoutId)
    }

    const response = await result.response
    const reply = response.text()

    return res.status(200).json({
      success: true,
      reply,
      mode: 'gemini_backend',
      model: modelName,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.warn('[API /api/ai/chat Gemini Error]:', error?.message || error)
    const fallbackReply = generateSmartFinancialReply(prompt, context)
    const isTimeout =
      error?.name === 'TimeoutError' ||
      error?.name === 'AbortError' ||
      error?.code === 'ETIMEDOUT'

    if (isTimeout) {
      return res.status(504).json({
        success: false,
        error: 'Dịch vụ Gemini AI phản hồi quá thời gian chờ.',
        fallbackReply,
        mode: 'smart_context_advisor',
        timestamp: new Date().toISOString()
      })
    }

    return res.status(502).json({
      success: false,
      error: 'Dịch vụ Gemini AI tạm thời gián đoạn.',
      fallbackReply,
      mode: 'smart_context_advisor',
      timestamp: new Date().toISOString()
    })
  }
})

export default router
