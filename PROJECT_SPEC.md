# ĐẶC TẢ KỸ THUẬT DỰ ÁN SPENDWISE

## 1. Danh sách 12 Chức năng Chính thức (Phạm vi đã khóa)

| # | Mã Nhóm | Tên chức năng | Mô tả chi tiết | Ưu tiên |
| :-: | :---: | :--- | :--- | :---: |
| **1** | AUTH | **Xác thực người dùng** | Đăng ký, đăng nhập, đăng xuất, đổi mật khẩu, quên mật khẩu, cập nhật hồ sơ; bảo mật RLS cô lập dữ liệu từng người dùng. | Tầng 1 (Cao) |
| **2** | WALLET | **Quản lý ví/tài khoản** | Thêm, sửa, xóa ví tiền mặt, ngân hàng, ví điện tử (MoMo, ZaloPay...); xem số dư từng ví; chuyển tiền nội bộ giữa các ví không tính vào thu/chi. | Tầng 1 (Cao) |
| **3** | CAT | **Quản lý danh mục** | Danh mục thu/chi mặc định của hệ thống và danh mục do người dùng tự tạo (kèm từ khóa gợi ý). | Tầng 1 (Cao) |
| **4** | TXN | **Quản lý giao dịch** | Thêm, sửa, xóa giao dịch thu/chi; tìm kiếm không phân biệt dấu (`note_unaccent`); lọc theo thời gian, danh mục, ví, loại thu/chi; sắp xếp; phân trang; xuất CSV. | Tầng 1 (Cao) |
| **5** | BUDGET | **Quản lý ngân sách** | Đặt ngân sách tháng theo danh mục; thanh tiến độ nhiều mức (An toàn < 80%, Sắp vượt 80-99%, Đã vượt >= 100%). | Tầng 1 (Cao) |
| **6** | DASH | **Dashboard tổng quan** | Hiển thị tổng thu, tổng chi, tổng số dư các ví, thẻ chỉ số *Safe-to-spend*, biểu đồ chi tiêu theo danh mục và giao dịch gần đây. | Tầng 1 (Cao) |
| **7** | REPORT | **Báo cáo tài chính** | Biểu đồ và thống kê thu chi theo tuần/tháng/năm, theo danh mục, so sánh giữa các kỳ. | Tầng 1 (Cao) |
| **8** | QUICK | **Nhập nhanh bằng câu tự nhiên *(Khác biệt 1)*** | Gõ câu như `"cafe 35k hôm qua momo"`, hệ thống tự tách số tiền, ngày, ví, loại và danh mục, hiển thị khung Xem trước (Preview) để kiểm tra/chỉnh sửa trước khi lưu. | Tầng 2 (TB) |
| **9** | STS | **Safe-to-spend hôm nay *(Khác biệt 2)*** | Tự tính số tiền có thể tiêu trong ngày: `(Tổng ngân sách còn lại của tháng - Tổng khoản định kỳ sắp đến trong tháng) / Số ngày còn lại trong tháng (tính cả hôm nay)`. | Tầng 2 (TB) |
| **10** | AIBOT | **Trợ lý AI tra cứu & tư vấn *(Khác biệt 3)*** | Chatbot tích hợp Gemini API hỗ trợ hỏi đáp tự nhiên: tra cứu chi tiêu theo ngày/danh mục và tư vấn phân bổ số tiền còn lại trong tháng. | Tầng 2 (TB) |
| **11** | GOAL_REC | **Mục tiêu tiết kiệm & Giao dịch định kỳ** | Tạo mục tiêu tiết kiệm, nạp tiền, theo dõi tiến độ; thiết lập khoản thu/chi lặp lại để hệ thống tự sinh giao dịch hoặc nhắc nhở khi đến hạn. | Tầng 2 (TB) |
| **12** | NOTI_QR | **Thông báo & Tiện ích VietQR** | Cảnh báo ngân sách, nhắc khoản định kỳ (xem/đánh dấu đã đọc); tiện ích chia nhanh hóa đơn (Bill Split) và tạo mã VietQR chuẩn ngân hàng. | Tầng 3 (Mở rộng) |

---

## 2. Thiết kế Chi tiết Bộ 3 Tính năng Thông minh (Core Logic)

### 2.1. Bộ phân tích câu tự nhiên (`QuickEntryParser`)
- **Đầu vào:** Chuỗi văn bản tự nhiên (VD: `"cafe 35k hôm qua momo"`).
- **Thứ tự bóc tách (Rule-based):**
  1. **Số tiền (`amount`):** Bắt Regex các định dạng `35k`, `35 nghìn`, `1tr2`, `1.5 triệu`, `200000`.
  2. **Ngày (`transaction_date`):** Bắt từ khóa `hôm nay` ($T$), `hôm qua` ($T-1$), `hôm kia` ($T-2$), hoặc định dạng `dd/mm`, `dd/mm/yyyy`. Mặc định là hôm nay nếu không ghi.
  3. **Ví (`wallet_id`):** So khớp tên ví của người dùng hoặc từ khóa phổ biến (`momo`, `zalopay`, `vcb`, `tiền mặt`).
  4. **Loại (`type`):** Nếu có từ khóa `"lương"`, `"thưởng"`, `"nhận"`, `"thu"` $\rightarrow$ `'income'`; ngược lại mặc định `'expense'`.
  5. **Danh mục (`category_id`):** So khớp từ khóa trong câu với mảng `keywords` của bảng `categories` (VD: `cafe`, `phở`, `cơm` $\rightarrow$ `Ăn uống`).
- **Nguyên tắc an toàn:** Luôn mở form Preview cho người dùng xác nhận. Trường nào không nhận diện được thì để trống và đánh dấu viền vàng, tuyệt đối không đoán bừa.

### 2.2. Công thức Safe-to-spend (`SafeToSpendService`)
$$\text{SafeToSpend} = \max\left(0, \frac{\text{RemainingBudget} - \text{UpcomingRecurringExpenses}}{\text{RemainingDaysInMonth}}\right)$$
- `RemainingBudget`: Tổng hạn mức ngân sách tháng hiện tại trừ đi tổng chi tiêu trong tháng (của các danh mục có đặt ngân sách).
- `UpcomingRecurringExpenses`: Tổng số tiền của các `recurring_rules` (loại `'expense'`, đang active) có `next_due_date` nằm trong khoảng từ hôm nay đến cuối tháng.
- `RemainingDaysInMonth`: Số ngày còn lại của tháng hiện tại (bao gồm cả ngày hôm nay, luôn $\ge 1$).

### 2.3. Trợ lý AI Gemini (`AiAssistantService`)
- Sử dụng kỹ thuật **Context-Stuffing**:
  1. Truy vấn nhanh từ Supabase: Tổng số dư ví, chỉ số Safe-to-spend hôm nay, danh sách ngân sách tháng, và danh sách giao dịch trong tháng hiện tại (chỉ lấy các cột: `transaction_date`, `type`, `amount`, tên `category`, `note`).
  2. Đóng gói JSON gọn nhẹ đưa vào `systemInstruction` của model `gemini-2.5-flash` (hoặc `gemini-1.5-flash`).
  3. Cung cấp sẵn 4 nút gợi ý nhanh (Quick Reply Chips) trên giao diện chat để chống lỗi nhập liệu khi demo.

---

## 3. Cấu trúc Thư mục Chuẩn của Dự án
```text
spendwise/
├── .antigravity/
│   └── rules.md                 # Quy tắc cho AI trong Antigravity
├── public/
│   ├── manifest.json            # Cấu hình PWA
│   └── sw.js                    # Service Worker cache giao diện cơ bản
├── supabase/
│   └── init_schema.sql          # Script khởi tạo 8 bảng + View + RLS
├── docs/                        # Tài liệu nộp ngày 29 (15/11/2026)
│   ├── use_cases.md
│   ├── architecture.md
│   └── class_diagram.md
├── src/
│   ├── lib/
│   │   ├── supabaseClient.js    # Khởi tạo kết nối Supabase
│   │   └── geminiClient.js      # Khởi tạo kết nối Gemini API
│   ├── services/                # Tầng Service (Tách biệt khỏi UI)
│   │   ├── authService.js
│   │   ├── walletService.js
│   │   ├── transactionService.js
│   │   ├── budgetService.js
│   │   ├── quickEntryParser.js  # Chức năng 8
│   │   ├── safeToSpendService.js# Chức năng 9
│   │   ├── aiAssistantService.js# Chức năng 10
│   │   └── vietQrService.js     # Chức năng 12
│   ├── components/              # UI Components dùng chung
│   ├── pages/                   # Các màn hình chính theo Vertical Slice
│   └── utils/                   # Hàm bỏ dấu tiếng Việt, format tiền VNĐ
├── .env.example
├── PROJECT_SPEC.md
└── TASKS.md
```