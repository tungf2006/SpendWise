import { supabase } from '@/lib/supabaseClient'
import { calculateSafeToSpend, getCurrentMonthDates, toLocalDateString } from './safeToSpendService'
import { getBudgetProgress } from './budgetService'

/**
 * Service Trợ lý AI Gemini tra cứu và tư vấn tài chính thông minh
 * Phụ trách: Leader (Phan Thanh Tùng) - Nhóm chức năng AIBOT (UC21)
 *
 * Bảo mật: Tuyệt đối KHÔNG gọi Gemini SDK hoặc dùng API Key trên trình duyệt.
 * Mọi truy vấn AI đều gửi kèm Supabase JWT qua Backend REST API (POST /api/ai/chat).
 */

export const QUICK_REPLY_CHIPS = [
  'Hôm nay tôi có thể tiêu bao nhiêu tiền an toàn?',
  'Tháng này tôi đã chi bao nhiêu cho Ăn uống?',
  'Ngân sách danh mục nào đang sắp vượt hạn mức?',
  'Cho tôi lời khuyên phân bổ tiền chi tiêu từ giờ đến cuối tháng'
]

function formatVnd(amount) {
  const num = Number(amount) || 0
  return `${num.toLocaleString('vi-VN')} VNĐ`
}

/**
 * Gom ngữ cảnh tài chính của người dùng hiện tại thành đối tượng JSON súc tích.
 * Sử dụng ngày địa phương và tổng hợp toàn bộ giao dịch trong tháng hiện tại.
 * @returns {Promise<object>}
 */
export async function buildFinancialContext() {
  try {
    const today = new Date()
    const { month: currentMonth, year: currentYear, todayDate, endOfMonthDate } = getCurrentMonthDates(today)
    const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`

    // 1. Số dư các ví đang hoạt động
    const { data: wallets, error: walletError } = await supabase
      .from('wallets')
      .select('name, type, balance')
      .eq('is_archived', false)

    if (walletError) throw walletError

    const safeWallets = wallets || []
    const totalBalance = safeWallets.reduce((sum, w) => sum + Number(w.balance || 0), 0)

    // 2. Chỉ số Safe-to-spend hôm nay
    const stsData = await calculateSafeToSpend(today)

    // 3. Tiến độ ngân sách tháng
    const { data: budgets, error: budgetError } = await getBudgetProgress(currentMonth, currentYear)
    if (budgetError) throw budgetError

    const budgetSummary = (budgets || []).map((b) => ({
      danh_muc: b.category_name,
      han_muc: b.budget_amount,
      da_chi: b.spent_amount,
      con_lai: b.remaining_amount,
      phan_tram: `${b.actual_percentage}%`,
      trang_thai: b.status
    }))

    // 4. Toàn bộ giao dịch trong tháng hiện tại để tổng hợp số liệu chính xác
    const { data: monthTransactions, error: txnError } = await supabase
      .from('transactions')
      .select(`
        type,
        amount,
        transaction_date,
        note,
        category:categories(name)
      `)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endOfMonthDate)
      .order('transaction_date', { ascending: false })

    if (txnError) throw txnError

    const allMonthTxns = monthTransactions || []
    let totalIncomeMonth = 0
    let totalExpenseMonth = 0

    for (const txn of allMonthTxns) {
      const amt = Number(txn.amount || 0)
      if (txn.type === 'income') totalIncomeMonth += amt
      else if (txn.type === 'expense') totalExpenseMonth += amt
    }

    const txnSummary = allMonthTxns.slice(0, 30).map((t) => ({
      ngay: t.transaction_date,
      loai: t.type === 'income' ? 'Thu nhập' : t.type === 'expense' ? 'Chi tiêu' : 'Chuyển tiền',
      so_tien: t.amount,
      danh_muc: t.category?.name || 'Khác',
      ghi_chu: t.note || ''
    }))

    return {
      ngay_hien_tai: todayDate || toLocalDateString(today),
      thang_nam: `${currentMonth}/${currentYear}`,
      so_ngay_con_lai_trong_thang: stsData.daysLeft,
      tong_so_du_vi: totalBalance,
      danh_sach_vi: safeWallets,
      safe_to_spend_hom_nay: stsData.safeToSpendToday,
      khoan_dinh_ky_sap_toi: stsData.upcomingRecurring,
      tong_thu_thang: totalIncomeMonth,
      tong_chi_thang: totalExpenseMonth,
      tong_so_giao_dich_thang: allMonthTxns.length,
      ngan_sach_thang: budgetSummary,
      giao_dich_gan_day: txnSummary
    }
  } catch (err) {
    console.error('Lỗi khi đóng gói Financial Context:', err)
    return {
      error: err?.message || 'Không thể tải toàn bộ dữ liệu tài chính'
    }
  }
}

/**
 * Bộ phân tích tài chính dự phòng dựa trên dữ liệu thực khi Backend hoặc Gemini tạm gián đoạn.
 */
export function buildClientFallbackReply(prompt = '', context = {}) {
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
        ? `💡 *Lời khuyên:* Hãy giữ mức chi tiêu trong ngày dưới **${formatVnd(sts)}** để đảm bảo ngân sách cuối tháng luôn an toàn.`
        : `⚠️ *Lưu ý:* Bạn chưa thiết lập ngân sách tháng hoặc ngân sách còn lại đã chạm ngưỡng giới hạn. Hãy kiểm tra mục **Ngân sách**.`
    ].join('\n')
  }

  if (q.includes('ăn uống') || q.includes('danh mục') || q.includes('đã chi bao nhiêu')) {
    const foodBudget = budgets.find((b) => (b.danh_muc || '').toLowerCase().includes('ăn uống'))
    const foodTxns = txns.filter((t) => (t.danh_muc || '').toLowerCase().includes('ăn uống') && t.loai === 'Chi tiêu')
    const foodSpent = foodBudget
      ? Number(foodBudget.da_chi || 0)
      : foodTxns.reduce((sum, t) => sum + Number(t.so_tien || 0), 0)

    const lines = [
      `🍽️ **Thống kê chi tiêu danh mục Ăn uống (${context?.thang_nam || 'Tháng này'}):**`,
      `- Tổng đã chi cho Ăn uống: **${formatVnd(foodSpent)}** (${foodTxns.length} giao dịch gần đây).`
    ]
    if (foodBudget) {
      lines.push(
        `- Hạn mức ngân sách đặt ra: **${formatVnd(foodBudget.han_muc)}** (Đã dùng **${foodBudget.phan_tram}**, còn lại **${formatVnd(foodBudget.con_lai)}**).`
      )
    }
    lines.push('💡 *Gợi ý:* Bạn có thể dùng ô **Nhập nhanh** trên Dashboard (VD: *"cafe 35k hôm nay momo"*) để ghi chép nhanh hằng ngày.')
    return lines.join('\n')
  }

  if (q.includes('ngân sách') || q.includes('vượt') || q.includes('hạn mức')) {
    if (budgets.length === 0) {
      return `📌 Hiện tại trong tháng **${context?.thang_nam || 'này'}** bạn chưa thiết lập hạn mức ngân sách nào.\n\n💡 Hãy vào trang **Ngân sách** để đặt hạn mức cho các nhóm chi tiêu thiết yếu nhằm kích hoạt cảnh báo 3 mức (<80%, 80–99%, >=100%).`
    }
    const alerts = budgets.filter((b) => b.trang_thai === 'warning' || b.trang_thai === 'exceeded')
    if (alerts.length === 0) {
      return [
        `✅ Toàn bộ **${budgets.length} danh mục ngân sách** trong tháng ${context?.thang_nam || ''} đều đang ở ngưỡng **An toàn (<80%)**:`,
        ...budgets.map((b) => `- **${b.danh_muc}:** Đã chi ${formatVnd(b.da_chi)} / ${formatVnd(b.han_muc)} (${b.phan_tram})`)
      ].join('\n')
    }
    return [
      `⚠️ **Cảnh báo các danh mục cần chú ý trong tháng ${context?.thang_nam || ''}:**`,
      ...alerts.map(
        (b) =>
          `- **${b.danh_muc}:** Đã dùng **${b.phan_tram}** (${formatVnd(b.da_chi)} / ${formatVnd(b.han_muc)}) — Trạng thái: **${
            b.trang_thai === 'exceeded' ? 'Đã vượt hạn mức' : 'Sắp vượt (80–99%)'
          }**`
      ),
      `💡 *Khuyến nghị:* Hạn chế phát sinh thêm chi phí ở các nhóm trên trong **${daysLeft} ngày** còn lại.`
    ].join('\n')
  }

  const walletLines = wallets.length > 0 ? wallets.map((w) => `${w.name}: ${formatVnd(w.balance)}`).join(' | ') : 'Chưa có ví hoạt động'
  return [
    `✨ **Tổng quan & Gợi ý phân bổ tài chính (${daysLeft} ngày còn lại):**`,
    `- **Tổng số dư các ví:** **${formatVnd(totalBalance)}** (${walletLines}).`,
    `- **Hạn mức chi an toàn mỗi ngày (Safe-to-spend):** **${formatVnd(sts)}/ngày**.`,
    `- **Khoản chi định kỳ sắp tới:** **${formatVnd(recurring)}**.`,
    `💡 Hãy giữ lại tối thiểu **${formatVnd(recurring)}** cho các hóa đơn định kỳ và giới hạn chi tiêu hằng ngày trong ngưỡng **${formatVnd(sts)}**.`
  ].join('\n')
}

/**
 * Gửi câu hỏi kèm Financial Context đến Backend REST API (`POST /api/ai/chat`).
 * Không gọi trực tiếp Gemini SDK trên Client để đảm bảo giấu kín GEMINI_API_KEY.
 * @param {string} userPrompt Câu hỏi của người dùng
 * @returns {Promise<{ reply: string, error: any, source: string }>}
 */
export async function askGeminiAssistant(userPrompt) {
  const trimmedPrompt = typeof userPrompt === 'string' ? userPrompt.trim() : ''
  if (!trimmedPrompt) {
    return {
      reply: '',
      error: new Error('Nội dung câu hỏi không được để trống.'),
      source: 'validation_error'
    }
  }

  const context = await buildFinancialContext()

  try {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '')
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token

    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const fetchTimeout = controller ? setTimeout(() => controller.abort(), 15000) : null

    let response
    try {
      response = await fetch(`${baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers,
        signal: controller?.signal,
        body: JSON.stringify({
          prompt: trimmedPrompt,
          context
        })
      })
    } finally {
      if (fetchTimeout) clearTimeout(fetchTimeout)
    }

    const json = await response.json().catch(() => null)

    if (response.ok && json?.success && json?.reply) {
      return { reply: json.reply, error: null, source: json.mode || 'backend_api' }
    }

    if (response.status === 401) {
      return {
        reply: 'Phiên đăng nhập chưa hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại để sử dụng Trợ lý AI.',
        error: new Error(json?.message || 'Unauthorized'),
        source: 'auth_error'
      }
    }

    if (response.status === 429) {
      return {
        reply: json?.message || 'Bạn đang gửi quá nhiều câu hỏi liên tiếp. Vui lòng đợi một lát rồi thử lại.',
        error: new Error(json?.message || 'Rate limit exceeded'),
        source: 'rate_limited'
      }
    }

    if (json?.fallbackReply) {
      return {
        reply: `${json.fallbackReply}\n\n*(Chế độ phân tích cục bộ do máy chủ AI tạm thời gián đoạn)*`,
        error: null,
        source: json.mode || 'server_fallback'
      }
    }

    throw new Error(json?.error || json?.message || `HTTP ${response.status}`)
  } catch (err) {
    console.warn('[AI Assistant] Chuyển sang phân tích dự phòng cục bộ:', err?.message || err)
    return {
      reply: `${buildClientFallbackReply(trimmedPrompt, context)}\n\n*(Đang sử dụng bộ phân tích ngoại tuyến do chưa kết nối được máy chủ Backend AI)*`,
      error: null,
      source: 'client_fallback'
    }
  }
}
