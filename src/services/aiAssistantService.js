import { supabase } from '@/lib/supabaseClient'
import { getGeminiModel } from '@/lib/geminiClient'
import { calculateSafeToSpend } from './safeToSpendService'
import { getBudgetProgress } from './budgetService'

/**
 * Service Trợ lý AI Gemini tra cứu và tư vấn tài chính thông minh
 * Phụ trách: Leader (Phan Thanh Tùng) - Nhóm chức năng AIBOT (UC21)
 * 
 * Áp dụng kỹ thuật Context-Stuffing:
 * Gom số dư ví, chỉ số Safe-to-spend hôm nay, ngân sách tháng, và các giao dịch gần nhất
 * đưa vào System Instruction để Gemini trả lời chính xác số liệu cá nhân của người dùng.
 */

export const QUICK_REPLY_CHIPS = [
  'Hôm nay tôi có thể tiêu bao nhiêu tiền an toàn?',
  'Tháng này tôi đã chi bao nhiêu cho Ăn uống?',
  'Ngân sách danh mục nào đang sắp vượt hạn mức?',
  'Cho tôi lời khuyên phân bổ tiền chi tiêu từ giờ đến cuối tháng'
]

/**
 * Gom ngữ cảnh tài chính của người dùng hiện tại thành đối tượng JSON súc tích
 * @returns {Promise<object>}
 */
export async function buildFinancialContext() {
  try {
    const today = new Date()
    const currentMonth = today.getMonth() + 1
    const currentYear = today.getFullYear()
    const dateStr = today.toISOString().split('T')[0]

    // 1. Số dư ví
    const { data: wallets } = await supabase
      .from('wallets')
      .select('name, type, balance')
      .eq('is_archived', false)

    const totalBalance = (wallets || []).reduce((sum, w) => sum + Number(w.balance || 0), 0)

    // 2. Chỉ số Safe-to-spend hôm nay
    const stsData = await calculateSafeToSpend()

    // 3. Tiến độ ngân sách tháng
    const { data: budgets } = await getBudgetProgress(currentMonth, currentYear)
    const budgetSummary = (budgets || []).map(b => ({
      danh_muc: b.category_name,
      han_muc: b.budget_amount,
      da_chi: b.spent_amount,
      con_lai: b.remaining_amount,
      phan_tram: `${b.actual_percentage}%`,
      trang_thai: b.status
    }))

    // 4. Giao dịch trong tháng hiện tại (lấy tối đa 25 giao dịch gần nhất)
    const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    const { data: transactions } = await supabase
      .from('transactions')
      .select(`
        type,
        amount,
        transaction_date,
        note,
        category:categories(name)
      `)
      .gte('transaction_date', startDate)
      .order('transaction_date', { ascending: false })
      .limit(25)

    const txnSummary = (transactions || []).map(t => ({
      ngay: t.transaction_date,
      loai: t.type === 'income' ? 'Thu nhập' : t.type === 'expense' ? 'Chi tiêu' : 'Chuyển tiền',
      so_tien: t.amount,
      danh_muc: t.category?.name || 'Khác',
      ghi_chu: t.note || ''
    }))

    return {
      ngay_hien_tai: dateStr,
      thang_nam: `${currentMonth}/${currentYear}`,
      so_ngay_con_lai_trong_thang: stsData.daysLeft,
      tong_so_du_vi: totalBalance,
      danh_sach_vi: wallets || [],
      safe_to_spend_hom_nay: stsData.safeToSpendToday,
      khoan_dinh_ky_sap_toi: stsData.upcomingRecurring,
      ngan_sach_thang: budgetSummary,
      giao_dich_gan_day: txnSummary
    }
  } catch (err) {
    console.error('Lỗi khi đóng gói Financial Context:', err)
    return {
      error: 'Không thể tải toàn bộ dữ liệu tài chính'
    }
  }
}

/**
 * Gửi câu hỏi kèm Financial Context đến Gemini API
 * Ưu tiên gọi Backend REST API (POST http://localhost:5000/api/ai/chat),
 * nếu Backend chưa khởi động thì tự động fallback sang gọi trực tiếp Gemini SDK phía Client.
 * @param {string} userPrompt Câu hỏi của người dùng
 * @returns {Promise<{ reply: string, error: any }>}
 */
export async function askGeminiAssistant(userPrompt) {
  try {
    const context = await buildFinancialContext()

    // 1. Thử gọi Backend REST API (Cổng 5000)
    try {
      const response = await fetch('http://localhost:5000/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: userPrompt,
          context
        })
      })

      if (response.ok) {
        const json = await response.json()
        if (json.success && json.reply) {
          return { reply: json.reply, error: null, source: 'backend_api' }
        }
      }
    } catch (networkErr) {
      // Backend Express chưa chạy -> Chuyển sang fallback gọi SDK phía Client
      console.warn('[AI Assistant] Backend API cổng 5000 chưa khởi chạy, tự động fallback sang Client SDK.')
    }

    // 2. Fallback: Gọi trực tiếp SDK phía Client nếu Backend chưa mở
    const model = getGeminiModel('gemini-1.5-flash')
    if (!model) {
      return {
        reply: 'Chưa cấu hình VITE_GEMINI_API_KEY trong file .env hoặc Backend chưa khởi chạy.',
        error: new Error('Missing Gemini API Key')
      }
    }

    const systemPrompt = `
Bạn là Trợ lý Tài chính Cá nhân Thông minh của ứng dụng SpendWise.
Dưới đây là TOÀN BỘ dữ liệu tài chính hiện tại của người dùng (dạng JSON):
${JSON.stringify(context, null, 2)}

NGUYÊN TẮC TRẢ LỜI CỦA BẠN:
1. Luôn trả lời bằng TIẾNG VIỆT tự nhiên, thân thiện, súc tích và có tính khích lệ, chuyên môn.
2. Dựa HOÀN TOÀN vào số liệu trong JSON trên để trả lời. Không bịa đặt số liệu.
3. Nếu người dùng hỏi về "hôm nay tiêu được bao nhiêu", hãy trích dẫn chỉ số safe_to_spend_hom_nay và giải thích ngắn gọn số ngày còn lại trong tháng.
4. Nếu người dùng hỏi về danh mục chi tiêu, hãy tra cứu trong mục ngan_sach_thang và giao_dich_gan_day.
5. Định dạng số tiền có dấu chấm phân cách hàng nghìn (VD: 35.000 VNĐ, 2.500.000 VNĐ).
6. Giữ câu trả lời ngắn gọn (khoảng 2-4 đoạn văn ngắn hoặc gạch đầu dòng), không viết quá dài dòng.
`

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Người dùng hỏi: "${userPrompt}"` }
    ])

    const response = await result.response
    const replyText = response.text()

    return { reply: replyText, error: null, source: 'client_sdk' }
  } catch (err) {
    console.error('Lỗi khi gọi Gemini Assistant:', err)
    return {
      reply: 'Rất tiếc, trợ lý AI đang bận hoặc gặp sự cố kết nối. Vui lòng thử lại sau giây lát.',
      error: err
    }
  }
}

