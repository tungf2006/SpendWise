import { Router } from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'

const router = Router()

/**
 * POST /api/ai/chat
 * Endpoint xử lý yêu cầu hỏi đáp tài chính cá nhân với Google Gemini API
 * Phụ trách: Leader (Phan Thanh Tùng) - Nhóm chức năng AIBOT (UC21)
 */
router.post('/chat', async (req, res) => {
  try {
    const { prompt, context } = req.body
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Chưa cấu hình GEMINI_API_KEY ở phía Server.'
      })
    }

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Nội dung câu hỏi không được để trống.'
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
    console.error('[API /api/ai/chat Error]:', error)
    return res.status(500).json({
      success: false,
      error: 'Lỗi máy chủ khi xử lý câu hỏi qua Gemini AI: ' + (error.message || 'Lỗi không xác định')
    })
  }
})

export default router
