import { Router } from 'express'
import { GoogleGenAI } from '@google/genai'

const router = Router()

function formatVnd(amount) {
  const num = Number(amount) || 0
  return `${num.toLocaleString('vi-VN')} VNĐ`
}

/**
 * Bộ phân tích tài chính thông minh dự phòng (Smart Context-Aware Financial Engine)
 * Trả về trong trường fallbackReply khi GEMINI_API_KEY chưa cấu hình hoặc dịch vụ Google gián đoạn.
 */
export function generateSmartFinancialReply(prompt = '', context = {}) {
  const q = String(prompt || '').toLowerCase()
  const sts = Number(context?.safe_to_spend_hom_nay || 0)
  const daysLeft = Number(context?.so_ngay_con_lai_trong_thang || 1)
  const totalBalance = Number(context?.tong_so_du_vi || 0)
  const recurring = Number(context?.khoan_dinh_ky_sap_toi || 0)
  const wallets = Array.isArray(context?.danh_sach_vi) ? context.danh_sach_vi : []
  const budgets = Array.isArray(context?.ngan_sach_thang) ? context.ngan_sach_thang : []
  const txns = Array.isArray(context?.giao_dich_gan_day) ? context.giao_dich_gan_day : []

  if (q.includes('hôm nay') || q.includes('safe') || q.includes('an toàn') || q.includes('tiêu bao nhiêu')) {
    return [
      `📊 **Phân tích Safe-to-spend hôm nay (${context?.ngay_hien_tai || 'Hôm nay'}):**`,
      `- Số tiền an toàn bạn có thể chi tiêu hôm nay là **${formatVnd(sts)}**.`,
      `- Tháng này còn **${daysLeft} ngày** (đã trừ trước **${formatVnd(recurring)}** cho các khoản định kỳ sắp tới).`,
      `- Tổng số dư khả dụng trên các ví hiện tại của bạn là **${formatVnd(totalBalance)}**.`,
      sts > 0
        ? `💡 *Lời khuyên:* Hãy ưu tiên giữ mức chi tiêu trong ngày dưới **${formatVnd(sts)}** để đảm bảo kế hoạch ngân sách cuối tháng luôn an toàn nhé!`
        : `⚠️ *Lưu ý:* Bạn chưa thiết lập ngân sách tháng hoặc ngân sách còn lại đã chạm ngưỡng giới hạn. Hãy kiểm tra mục **Ngân sách** để điều chỉnh kế hoạch chi tiêu.`
    ].join('\n')
  }

  if (q.includes('ăn uống') || q.includes('danh mục') || q.includes('đã chi bao nhiêu')) {
    const foodBudget = budgets.find((b) => (b.danh_muc || '').toLowerCase().includes('ăn uống'))
    const foodTxns = txns.filter((t) => (t.danh_muc || '').toLowerCase().includes('ăn uống') && t.loai === 'Chi tiêu')
    const foodSpent = foodBudget
      ? Number(foodBudget.da_chi || 0)
      : foodTxns.reduce((s, t) => s + Number(t.so_tien || 0), 0)

    const lines = [
      `🍽️ **Thống kê chi tiêu danh mục Ăn uống (${context?.thang_nam || 'Tháng này'}):**`,
      `- Tổng đã chi cho Ăn uống: **${formatVnd(foodSpent)}** (${foodTxns.length} giao dịch gần đây).`
    ]
    if (foodBudget) {
      lines.push(
        `- Hạn mức ngân sách đặt ra: **${formatVnd(foodBudget.han_muc)}** (Đã dùng **${foodBudget.phan_tram}**, còn lại **${formatVnd(foodBudget.con_lai)}**).`
      )
    }
    lines.push(
      `💡 *Gợi ý:* Bạn có thể sử dụng thanh **Nhập nhanh (Quick Entry)** trên Dashboard (VD: *"cafe 35k hôm nay momo"*) để theo dõi sát từng bữa ăn hằng ngày.`
    )
    return lines.join('\n')
  }

  if (q.includes('ngân sách') || q.includes('vượt') || q.includes('hạn mức')) {
    if (budgets.length === 0) {
      return `📌 Hiện tại trong tháng **${context?.thang_nam || 'này'}** bạn chưa thiết lập hạn mức ngân sách cho danh mục nào.\n\n💡 Bạn hãy vào trang **Ngân sách** để đặt hạn mức cho các nhóm thiết yếu (Ăn uống, Di chuyển, Hóa đơn) nhằm kích hoạt thanh cảnh báo 3 mức (<80%, 80–99%, >=100%) nhé!`
    }
    const alerts = budgets.filter((b) => b.trang_thai === 'warning' || b.trang_thai === 'exceeded')
    if (alerts.length === 0) {
      return [
        `✅ **Tin tuyệt vời!** Toàn bộ **${budgets.length} danh mục ngân sách** của bạn trong tháng ${context?.thang_nam || ''} đều đang ở ngưỡng **An toàn (<80%)**:`,
        ...budgets.map((b) => `- **${b.danh_muc}:** Đã chi ${formatVnd(b.da_chi)} / ${formatVnd(b.han_muc)} (${b.phan_tram})`),
        `💡 Hãy tiếp tục duy trì thói quen chi tiêu kỷ luật này nhé!`
      ].join('\n')
    }
    return [
      `⚠️ **Cảnh báo các danh mục cần chú ý trong tháng ${context?.thang_nam || ''}:**`,
      ...alerts.map(
        (b) =>
          `- **${b.danh_muc}:** Đã dùng **${b.phan_tram}** (${formatVnd(b.da_chi)} / ${formatVnd(b.han_muc)}) — Trạng thái: **${
            b.trang_thai === 'exceeded' ? 'Đã vượt hạn mức' : 'Sắp vượt (80-99%)'
          }**`
      ),
      `💡 *Khuyến nghị:* Hãy hạn chế phát sinh thêm chi phí ở các danh mục trên trong **${daysLeft} ngày** còn lại của tháng.`
    ].join('\n')
  }

  const walletLines =
    wallets.length > 0 ? wallets.map((w) => `${w.name}: ${formatVnd(w.balance)}`).join(' | ') : 'Chưa có ví hoạt động'
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

  if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
    console.warn('[Security Warning] Đang dùng biến VITE_GEMINI_API_KEY cũ trên Server. Hãy đổi sang GEMINI_API_KEY trong server/.env.')
  }

  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim()
  const primaryModel = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim()
  const fallbackModel = (process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.8-flash').trim()
  const timeoutMs = Math.max(2000, Number(process.env.GEMINI_TIMEOUT_MS) || 6000)

  const isValidKeyFormat = Boolean(
    apiKey &&
    apiKey.length >= 20 &&
    !/^your_/i.test(apiKey) &&
    (apiKey.startsWith('AIza') || apiKey.startsWith('AQ.'))
  )

  if (!isValidKeyFormat) {
    const fallbackReply = generateSmartFinancialReply(prompt, context)
    return res.status(503).json({
      success: false,
      error: 'Máy chủ chưa cấu hình GEMINI_API_KEY hợp lệ.',
      fallbackReply,
      mode: 'smart_context_advisor',
      timestamp: new Date().toISOString()
    })
  }

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

  const candidateModels = [...new Set([primaryModel, fallbackModel].filter(Boolean))]
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1beta' } })
  let lastError = null

  for (const modelName of candidateModels) {
    let timerId = null
    try {
      const config = { systemInstruction }
      if (modelName.startsWith('gemini-2.5-flash')) {
        config.thinkingConfig = { thinkingBudget: 0 }
      }

      const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(() => {
          reject(new Error(`Model ${modelName} phản hồi quá ${timeoutMs}ms (timeout).`))
        }, timeoutMs)
      })

      const response = await Promise.race([
        ai.models.generateContent({
          model: modelName,
          contents: `Người dùng hỏi: "${prompt.trim()}"`,
          config
        }),
        timeoutPromise
      ])

      const reply = typeof response?.text === 'string' ? response.text.trim() : ''
      if (!reply) {
        throw new Error(`Model ${modelName} trả về phản hồi rỗng.`)
      }

      return res.status(200).json({
        success: true,
        reply,
        mode: modelName === primaryModel ? 'gemini_backend' : 'gemini_fallback_model',
        model: modelName,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      lastError = error
      console.warn(`[API /api/ai/chat Gemini Error - ${modelName}]:`, error?.message || error)
    } finally {
      if (timerId) clearTimeout(timerId)
    }
  }

  console.warn('[API /api/ai/chat All Models Failed]:', lastError?.message || lastError)
  const fallbackReply = generateSmartFinancialReply(prompt, context)
  return res.status(502).json({
    success: false,
    error: 'Dịch vụ Gemini AI tạm thời gián đoạn.',
    fallbackReply,
    mode: 'smart_context_advisor',
    timestamp: new Date().toISOString()
  })
})

export default router
