# SPENDWISE – KNOWLEDGE BASE & CORE MEMORY (BỘ NÃO DỰ ÁN)

> **Mục đích:** File này lưu trữ toàn bộ kiến thức cốt lõi của dự án SpendWise. Mọi phiên chat mới của AI Agent (Antigravity) sẽ tự động nạp file này vào ngữ cảnh làm việc mà không cần rà soát lại tài liệu từ đầu.

---

## 1. THÔNG TIN DỰ ÁN & NHÂN SỰ
- **Tên dự án:** SpendWise – Hệ thống quản lý chi tiêu cá nhân thông minh.
- **Loại ứng dụng:** Web App Responsive (Mobile-First) + PWA cơ bản.
- **Nhóm phát triển:** 5 thành viên (Trưởng nhóm / Leader: **Phan Thanh Tùng**).
- **Ngôn ngữ 100%:** Tiếng Việt (UI, thông báo, tài liệu, comment code).
- **Phân công vai trò:**
  - `Lead` (Phan Thanh Tùng): Kiến trúc, Supabase DB, Parser, Gemini Client, PWA.
  - `FS1` (Full-stack 1): Auth, Danh mục, Giao dịch, Báo cáo Chart.
  - `FS2` (Full-stack 2): Ví tiền, Ngân sách, Công thức STS, Tiết kiệm & Định kỳ.
  - `FE` (Frontend): UI/UX Mobile-First, Dashboard, Forms, Modals.
  - `BA` (Business Analyst / QA): Use cases, Class diagram, Test RLS & Parser.

---

## 2. KIẾN TRÚC KỸ THUẬT & TECH STACK
- **Kiến trúc 3 tầng (Layered Architecture):**
  1. `Presentation Layer`: React 19 + Tailwind CSS + Lucide Icons + Chart.js.
  2. `Service Layer` (`src/services/`): Xử lý logic thuần túy độc lập với UI.
  3. `Data Layer`: Supabase (PostgreSQL 15 + Row Level Security trên 100% các bảng).
- **Biến môi trường (`.env`):**
  - `VITE_SUPABASE_URL`: URL kết nối Supabase (`https://ndeohlqneywsducsyqsb.supabase.co`).
  - `VITE_SUPABASE_ANON_KEY`: Publishable Anon Key.
  - `VITE_GEMINI_API_KEY`: API Key của Google Gemini.

---

## 3. CƠ SỞ DỮ LIỆU (8 BẢNG ĐÃ TRIỂN KHAI TRÊN SUPABASE)
1. `profiles`: Thông tin người dùng (`id` = `auth.users.id`, `default_bank_bin`, `default_bank_account`).
2. `wallets`: Ví tiền (`cash`, `bank`, `ewallet`), quản lý `balance`.
3. `categories`: Danh mục (`income`, `expense`), mảng từ khóa `keywords` cho Parser.
4. `transactions`: Giao dịch thu/chi/chuyển tiền (`amount`, `type`, `wallet_id`, `to_wallet_id`, `category_id`, `note_unaccent`).
5. `budgets`: Hạn mức chi tiêu tháng theo danh mục (`month`, `amount`).
6. `saving_goals`: Mục tiêu tiết kiệm (`target_amount`, `current_amount`, `target_date`).
7. `recurring_rules`: Khoản thu/chi định kỳ lặp lại (`frequency`, `day_of_month`, `next_due_date`).
8. `notifications`: Thông báo hệ thống (`type`, `title`, `message`, `is_read`).

---

## 4. BỘ 3 TÍNH NĂNG CỐT LÕI (CORE ALGORITHMS)

### 4.1. Nhập nhanh câu tự nhiên (`src/services/quickEntryParser.js`)
- **Input:** Chuỗi tự nhiên (VD: `"cafe 35k hôm qua momo"`).
- **Thuật toán Rule-based:**
  - `amount`: Regex `(\d+)k`, `(\d+)tr(\d+)`, `(\d+(?:\.\d+)?)tr`, số nguyên.
  - `date`: `hôm nay` ($T$), `hôm qua` ($T-1$), `hôm kia` ($T-2$), `dd/mm`.
  - `wallet`: So khớp từ khóa ví (`momo`, `vcb`, `tiền mặt`,...).
  - `type`: Từ khóa thu nhập (`lương`, `thưởng`, `nhận`) $\rightarrow$ `income`; mặc định `expense`.
  - `category`: So khớp mảng `keywords` không dấu (`cafe` $\rightarrow$ Ăn uống).
- **Nguyên tắc an toàn:** Luôn mở Preview xác nhận, trường chưa nhận diện được đánh dấu viền vàng, tuyệt đối không tự đoán.

### 4.2. Công thức Safe-to-spend (`src/services/safeToSpendService.js`)
$$\text{SafeToSpend} = \max\left(0, \frac{\text{RemainingBudget} - \text{UpcomingRecurring}}{\text{DaysLeft}}\right)$$
- `RemainingBudget`: Ngân sách tháng còn lại = Tổng hạn mức - Tổng đã chi.
- `UpcomingRecurring`: Tổng chi phí định kỳ active có `next_due_date` từ hôm nay đến cuối tháng.
- `DaysLeft`: Số ngày còn lại trong tháng (tính cả hôm nay, $\ge 1$).

### 4.3. Trợ lý AI Gemini (`src/services/aiAssistantService.js`)
- Áp dụng kỹ thuật **Context-Stuffing**: Đóng gói JSON ngắn gọn (Dư ví, SafeToSpend hôm nay, Ngân sách tháng, Giao dịch trong tháng) đưa vào `systemInstruction`.
- UI Chat luôn có sẵn **4 Quick Reply Chips** để demo mượt mà không lỗi gõ.

---

## 5. BẢNG THUẬT NGỮ CHUẨN (GLOSSARY)
BẮT BUỘC dùng thống nhất khi đặt tên code và hiển thị giao diện:
- `User` / `Profile` (Người dùng)
- `Wallet` (Ví) – *Không dùng: Thẻ, Nguồn tiền, Tài khoản*.
- `Category` (Danh mục) – *Không dùng: Hạng mục, Loại giao dịch*.
- `Transaction` (Giao dịch)
- `Transfer` (Chuyển tiền nội bộ giữa 2 ví, `to_wallet_id`) – *Không tính vào tổng Thu/Chi*.
- `Budget` (Ngân sách) – *3 mức: An toàn <80%, Sắp vượt 80-99%, Đã vượt >=100%*.
- `SafeToSpend` (Số tiền an toàn có thể tiêu hôm nay).
- `SavingGoal` (Mục tiêu tiết kiệm).
- `RecurringRule` (Giao dịch định kỳ).

---

## 6. PHẠM VI 12 CHỨC NĂNG (ĐÃ KHÓA – KHÔNG TỰ THÊM TÍNH NĂNG MỚI)
1. `AUTH`: Xác thực Supabase Auth (Đăng ký, Đăng nhập, Quên mật khẩu, Profile).
2. `WALLET`: Quản lý ví, số dư, chuyển tiền nội bộ.
3. `CAT`: Danh mục hệ thống & tự tạo kèm từ khóa.
4. `TXN`: CRUD giao dịch, lọc, phân trang, tìm kiếm không dấu, xuất CSV.
5. `BUDGET`: Ngân sách tháng & thanh tiến độ 3 màu.
6. `DASH`: Dashboard tổng quan, thẻ Safe-to-spend, biểu đồ danh mục, 5 giao dịch gần nhất.
7. `REPORT`: Biểu đồ cột thu/chi theo kỳ, biểu đồ tròn danh mục, so sánh kỳ liền kề.
8. `QUICK`: Nhập nhanh câu tự nhiên kèm form Preview.
9. `STS`: Thẻ Safe-to-spend độc bản & chi tiết tính toán.
10. `AIBOT`: Chatbot tra cứu & tư vấn chi tiêu qua Gemini API.
11. `GOAL_REC`: Mục tiêu tiết kiệm & Giao dịch định kỳ tự động.
12. `NOTI_QR`: Cảnh báo ngân sách & tiện ích VietQR chia tiền (Bill Split).
*LƯU Ý:* **CẤM** tự thêm Offline Sync phức tạp, Đa ngôn ngữ (i18n), Nhập CSV ngân hàng.

---

## 7. QUY CHUẨN THIẾT KẾ UI/UX (Awwwards / Apple-tier)
- **Typography:** `Plus Jakarta Sans` (Nội dung) + `Outfit` (Số tiền & Tiêu đề).
- **Cấu trúc thẻ Double-Bezel:** Vỏ ngoài bo tròn lớn `rounded-[2rem]` + Lõi trong bo đồng tâm `rounded-[calc(2rem-0.375rem)]`.
- **Navigation:** Floating Island Navbar trên Desktop + Floating Dock ở đáy màn hình Mobile.
- **Nút bấm:** Pill-shaped `rounded-full` với Button-in-Button trailing icon.
