import { Router } from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'

const router = Router()

function formatVnd(amount) {
  const num = Number(amount) || 0
  return `${num.toLocaleString('vi-VN')} VNĐ`
}

/**
 * Bộ phân tích tài chính thông minh dự phòng (Smart Context-Aware Financial Engine)
 * Đảm bảo UC21 hoạt động 100% dựa trên dữ liệu thực của người dùng ngay cả khi Gemini API Key hết hạn
 */
function generateSmartFinancialReply(prompt = '', context = {}) {
  const q = prompt.toLowerCase()
  const sts = Number(context?.safe_to_spend_hom_nay || 0)
  const daysLeft = Number(context?.so_ngay_con_lai_trong_thang || 1)
  const totalBalance = Number(context?.tong_so_du_vi || 0)
  const recurring = Number(context?.khoan_dinh_ky_sap_toi || 0)
  const wallets = Array.isArray(context?.danh_sach_vi) ? context.danh_sach_vi : []
  const budgets = Array.isArray(context?.ngan_sach_thang) ? context.ngan_sach_thang : []
  const txns = Array.isArray(context?.giao_dich_gan_day) ? context.giao_dich_gan_day : []

  // 1. Hỏi về Safe-to-spend / Hôm nay tiêu bao nhiêu
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

  // 2. Hỏi về danh mục cụ thể (VD: Ăn uống, Di chuyển, Mua sắm...)
  if (q.includes('ăn uống') || q.includes('danh mục') || q.includes('đã chi bao nhiêu')) {
    const foodBudget = budgets.find(b => (b.danh_muc || '').toLowerCase().includes('ăn uống'))
    const foodTxns = txns.filter(t => (t.danh_muc || '').toLowerCase().includes('ăn uống') && t.loai === 'Chi tiêu')
    const foodSpent = foodBudget ? Number(foodBudget.da_chi || 0) : foodTxns.reduce((s, t) => s + Number(t.so_tien || 0), 0)

    const lines = [
      `🍽️ **Thống kê chi tiêu danh mục Ăn uống (${context?.thang_nam || 'Tháng này'}):**`,
      `- Tổng đã chi cho Ăn uống: **${formatVnd(foodSpent)}** (${foodTxns.length} giao dịch gần đây).`
    ]
    if (foodBudget) {
      lines.push(`- Hạn mức ngân sách đặt ra: **${formatVnd(foodBudget.han_muc)}** (Đã dùng **${foodBudget.phan_tram}**, còn lại **${formatVnd(foodBudget.con_lai)}**).`)
    }
    lines.push(`💡 *Gợi ý:* Bạn có thể sử dụng thanh **Nhập nhanh (Quick Entry)** trên Dashboard (VD: *"cafe 35k hôm nay momo"*) để theo dõi sát từng bữa ăn hằng ngày.`)
    return lines.join('\n')
  }

  // 3. Hỏi về cảnh báo ngân sách sắp vượt / đã vượt
  if (q.includes('ngân sách') || q.includes('vượt') || q.includes('hạn mức')) {
    if (budgets.length === 0) {
      return `📌 Hiện tại trong tháng **${context?.thang_nam || 'này'}** bạn chưa thiết lập hạn mức ngân sách cho danh mục nào.\n\n💡 Bạn hãy vào trang **Ngân sách** để đặt hạn mức cho các nhóm thiết yếu (Ăn uống, Di chuyển, Hóa đơn) nhằm kích hoạt thanh cảnh báo 3 mức (<80%, 80–99%, >=100%) nhé!`
    }
    const alerts = budgets.filter(b => b.trang_thai === 'warning' || b.trang_thai === 'exceeded')
    if (alerts.length === 0) {
      return [
        `✅ **Tin tuyệt vời!** Toàn bộ **${budgets.length} danh mục ngân sách** của bạn trong tháng ${context?.thang_nam || ''} đều đang ở ngưỡng **An toàn (<80%)**:`,
        ...budgets.map(b => `- **${b.danh_muc}:** Đã chi ${formatVnd(b.da_chi)} / ${formatVnd(b.han_muc)} (${b.phan_tram})`),
        `💡 Hãy tiếp tục duy trì thói quen chi tiêu kỷ luật này nhé!`
      ].join('\n')
    }
    return [
      `⚠️ **Cảnh báo các danh mục cần chú ý trong tháng ${context?.thang_nam || ''}:**`,
      ...alerts.map(b => `- **${b.danh_muc}:** Đã dùng **${b.phan_tram}** (${formatVnd(b.da_chi)} / ${formatVnd(b.han_muc)}) — Trạng thái: **${b.trang_thai === 'exceeded' ? 'Đã vượt hạn mức' : 'Sắp vượt (80-99%)'}**`),
      `💡 *Khuyến nghị:* Hãy hạn chế phát sinh thêm chi phí ở các danh mục trên trong **${daysLeft} ngày** còn lại của tháng.`
    ].join('\n')
  }

  // 4. Tư vấn phân bổ chi tiêu / Tổng quan tài chính
  const walletLines = wallets.length > 0
    ? wallets.map(w => `${w.name}: ${formatVnd(w.balance)}`).join(' | ')
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
 * Endpoint xử lý yêu cầu hỏi đáp tài chính cá nhân với Google Gemini API
 * Phụ trách: Leader (Phan Thanh Tùng) - Nhóm chức năng AIBOT (UC21)
 */
router.post('/chat', async (req, res) => {
  try {
    const { prompt, context } = req.body
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Nội dung câu hỏi không được để trống.'
      })
    }

    if (!apiKey || !apiKey.startsWith('AIza')) {
      const fallbackReply = generateSmartFinancialReply(prompt, context)
      return res.status(200).json({
        success: true,
        reply: fallbackReply,
        mode: 'smart_context_advisor',
        timestamp: new Date().toISOString()
      })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const systemInstruction = `
Bạn là Trợ lý Tài chính Cá nhân Thông minh của ứng dụng SpendWise (chạy trên Node.js Backend).
Dưới đây là TOÀN BỘ dữ liệu tài chính thời gian thực của người dùng (dạng JSON):
${context ? JSON.stringify(context, null, 2) : 'Chưa có ngữ cảnh tài chính.'}

NGUYÊN TẮC PHẢN HỒI:
1. Luôn phản hồi bằng TIẾNG VIỆT tự nhiên, thân thiện, súc tích và có tính khích lệ, chuyên môn cao.
2. Dựa HOÀN TOÀN vào số liệu trong JSON trên để trả lời. Không tự bịa đặt số liệu.
3. Nếu người dùng hỏi về "hôm nay tiêu được bao nhiêu", hãy trích dẫn chỉ số Safe-to-spend và giải thích ngắn gọn số ngày còn lại trong tháng.
4. Định dạng tiền tệ có dấu chấm phân cách hàng nghìn (VD: 35.000 VNĐ, 2.500.000 VNĐ).
5. Trả lời súc tích khoảng 2-4 đoạn văn ngắn hoặc gạch đầu dòng rõ ràng.
`

    const result = await model.generateContent([
      { text: systemInstruction },
      { text: `Người dùng hỏi: "${prompt}"` }
    ])

    const response = await result.response
    const reply = response.text()

    return res.status(200).json({
      success: true,
      reply,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.warn('[API /api/ai/chat Fallback Activated]:', error.message)
    const fallbackReply = generateSmartFinancialReply(req.body?.prompt, req.body?.context)
    return res.status(200).json({
      success: true,
      reply: fallbackReply,
      mode: 'smart_context_advisor',
      timestamp: new Date().toISOString()
    })
  }
})

export default router
