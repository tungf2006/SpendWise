# SPENDWISE – BACKLOG & PHÂN CÔNG CÔNG VIỆC

> **Hướng dẫn:** Mỗi task có mã duy nhất dạng `[MÃ-NHÓM-số]`. Cột **Assignee** dùng vai trò thay tên thật để dễ giao việc. Cập nhật cột **Status** mỗi buổi họp sprint.
>
> **Vai trò:** `Lead` = Leader/Tech Lead | `BA` = BA/QA | `FE` = Frontend | `FS1` / `FS2` = Full-stack 1 & 2

---

## 🔴 Tầng 1 – Cao (Phải xong trước Demo)

### AUTH – Xác thực người dùng

| Task ID | Mô tả công việc | Assignee | Ước giờ | Status |
| :--- | :--- | :---: | :---: | :---: |
| AUTH-01 | Khởi tạo project Vite + React + Tailwind, cấu hình `.env.example`, `supabaseClient.js` | Lead | 2h | ✅ DONE |
| AUTH-02 | Trang Đăng ký (`/register`) – form email/password, gọi `supabase.auth.signUp()` | FS1 | 3h | ⬜ TODO |
| AUTH-03 | Trang Đăng nhập (`/login`) – form, gọi `supabase.auth.signInWithPassword()` | FS1 | 2h | ⬜ TODO |
| AUTH-04 | Chức năng Đăng xuất & bảo vệ route (redirect nếu chưa login) | FS1 | 1h | ⬜ TODO |
| AUTH-05 | Trang Quên mật khẩu – gọi `supabase.auth.resetPasswordForEmail()` | FS2 | 2h | ⬜ TODO |
| AUTH-06 | Trang Hồ sơ cá nhân – cập nhật `full_name`, `avatar_url`, `default_bank_bin/account` | FE | 3h | ⬜ TODO |

### WALLET – Quản lý ví

| Task ID | Mô tả công việc | Assignee | Ước giờ | Status |
| :--- | :--- | :---: | :---: | :---: |
| WALLET-01 | `walletService.js` – CRUD ví (thêm/sửa/xóa/ẩn) | FS2 | 3h | ⬜ TODO |
| WALLET-02 | Màn hình danh sách ví, hiển thị số dư từng ví | FE | 3h | ⬜ TODO |
| WALLET-03 | Form Thêm/Sửa ví – chọn loại (`cash`, `bank`, `ewallet`), icon, màu | FE | 2h | ⬜ TODO |
| WALLET-04 | Chức năng Chuyển tiền nội bộ (`type = 'transfer'`) – cập nhật số dư 2 ví | FS2 | 3h | ⬜ TODO |

### CAT – Quản lý danh mục

| Task ID | Mô tả công việc | Assignee | Ước giờ | Status |
| :--- | :--- | :---: | :---: | :---: |
| CAT-01 | `categoryService.js` – lấy danh mục hệ thống + danh mục của user | FS1 | 2h | ⬜ TODO |
| CAT-02 | Màn hình quản lý danh mục – danh sách, thêm/sửa/xóa danh mục riêng | FE | 3h | ⬜ TODO |

### TXN – Quản lý giao dịch

| Task ID | Mô tả công việc | Assignee | Ước giờ | Status |
| :--- | :--- | :---: | :---: | :---: |
| TXN-01 | `transactionService.js` – CRUD giao dịch, lấy danh sách có lọc + phân trang | FS1 | 4h | ⬜ TODO |
| TXN-02 | Màn hình danh sách giao dịch – hiển thị, lọc theo ngày/danh mục/ví/loại | FE | 4h | ⬜ TODO |
| TXN-03 | Form Thêm/Sửa giao dịch thủ công | FE | 3h | ⬜ TODO |
| TXN-04 | Tìm kiếm giao dịch theo note (dùng cột `note_unaccent`) | FS1 | 2h | ⬜ TODO |
| TXN-05 | Xuất danh sách giao dịch ra file CSV | FS2 | 2h | ⬜ TODO |

### BUDGET – Quản lý ngân sách

| Task ID | Mô tả công việc | Assignee | Ước giờ | Status |
| :--- | :--- | :---: | :---: | :---: |
| BUDGET-01 | `budgetService.js` – CRUD ngân sách tháng, tính % đã chi theo danh mục | FS2 | 3h | ⬜ TODO |
| BUDGET-02 | Màn hình ngân sách – thanh tiến độ 3 mức (an toàn / sắp vượt / đã vượt) | FE | 3h | ⬜ TODO |

### DASH – Dashboard

| Task ID | Mô tả công việc | Assignee | Ước giờ | Status |
| :--- | :--- | :---: | :---: | :---: |
| DASH-01 | Trang Dashboard – tổng thu/chi tháng, tổng số dư các ví | FE | 3h | ⬜ TODO |
| DASH-02 | Thẻ chỉ số Safe-to-spend trên Dashboard (dùng `SafeToSpendService`) | FS2 | 2h | ⬜ TODO |
| DASH-03 | Biểu đồ Donut chi tiêu theo danh mục (Chart.js) | FE | 2h | ⬜ TODO |
| DASH-04 | Danh sách 5 giao dịch gần nhất | FE | 1h | ⬜ TODO |

### REPORT – Báo cáo tài chính

| Task ID | Mô tả công việc | Assignee | Ước giờ | Status |
| :--- | :--- | :---: | :---: | :---: |
| REPORT-01 | Biểu đồ cột thu/chi theo tuần/tháng/năm (Chart.js, chuyển tab) | FS1 | 4h | ⬜ TODO |
| REPORT-02 | Biểu đồ tròn chi tiêu theo danh mục trong kỳ được chọn | FS1 | 2h | ⬜ TODO |
| REPORT-03 | Bảng so sánh thu/chi giữa 2 kỳ liền kề | FS2 | 3h | ⬜ TODO |

---

## 🟡 Tầng 2 – Trung bình (Làm sau khi Tầng 1 hoàn thành)

### QUICK – Nhập nhanh câu tự nhiên

| Task ID | Mô tả công việc | Assignee | Ước giờ | Status |
| :--- | :--- | :---: | :---: | :---: |
| QUICK-01 | `quickEntryParser.js` – tách số tiền (regex `35k`, `1tr2`, `200000`...) | Lead | 3h | ⬜ TODO |
| QUICK-02 | Parser – tách ngày (`hôm nay`, `hôm qua`, `dd/mm`) | Lead | 2h | ⬜ TODO |
| QUICK-03 | Parser – tách ví & danh mục qua từ khóa + `unaccent()` | Lead | 3h | ⬜ TODO |
| QUICK-04 | Giao diện ô nhập nhanh + khung Preview xem trước (trường không nhận diện = viền vàng) | FE | 3h | ⬜ TODO |

### STS – Safe-to-spend

| Task ID | Mô tả công việc | Assignee | Ước giờ | Status |
| :--- | :--- | :---: | :---: | :---: |
| STS-01 | `safeToSpendService.js` – hiện thực công thức STS đầy đủ | FS2 | 3h | ⬜ TODO |
| STS-02 | Tích hợp chỉ số STS vào Dashboard (thẻ nổi bật) | FE | 1h | ⬜ TODO |

### AIBOT – Trợ lý AI Gemini

| Task ID | Mô tả công việc | Assignee | Ước giờ | Status |
| :--- | :--- | :---: | :---: | :---: |
| AIBOT-01 | `geminiClient.js` – khởi tạo kết nối, đọc key từ `import.meta.env.VITE_GEMINI_API_KEY` | Lead | 1h | ✅ DONE |
| AIBOT-02 | `aiAssistantService.js` – gom context tài chính (dư ví, STS, budget, transactions tháng) | FS1 | 4h | ⬜ TODO |
| AIBOT-03 | Giao diện Chat – bubble tin nhắn, 4 nút Quick Reply Chips | FE | 4h | ⬜ TODO |

### GOAL_REC – Mục tiêu & Giao dịch định kỳ

| Task ID | Mô tả công việc | Assignee | Ước giờ | Status |
| :--- | :--- | :---: | :---: | :---: |
| GOAL-01 | CRUD Mục tiêu tiết kiệm – tạo, nạp tiền từ ví (`wallet_id`), theo dõi tiến độ | FS2 | 4h | ⬜ TODO |
| REC-01 | CRUD Giao dịch định kỳ – form tạo rule, tính `next_due_date` từ `day_of_month` | FS1 | 4h | ⬜ TODO |
| REC-02 | Logic tự sinh giao dịch hoặc tạo thông báo khi đến `next_due_date` | FS2 | 3h | ⬜ TODO |

---

## 🔵 Tầng 3 – Mở rộng (Nếu còn thời gian)

### NOTI_QR – Thông báo & VietQR

| Task ID | Mô tả công việc | Assignee | Ước giờ | Status |
| :--- | :--- | :---: | :---: | :---: |
| NOTI-01 | Màn hình Thông báo – danh sách, đánh dấu đã đọc | FE | 2h | ⬜ TODO |
| NOTI-02 | Logic tạo thông báo khi ngân sách sắp/đã vượt | FS2 | 2h | ⬜ TODO |
| QR-01 | `vietQrService.js` – tạo URL ảnh QR qua `img.vietqr.io` | FS1 | 2h | ⬜ TODO |
| QR-02 | Tính năng Bill Split – chia hóa đơn theo số người, hiển thị QR | FE | 3h | ⬜ TODO |

---

## ⚙️ Hạ tầng & QA (Xuyên suốt dự án)

| Task ID | Mô tả công việc | Assignee | Ước giờ | Status |
| :--- | :--- | :---: | :---: | :---: |
| INFRA-01 | Chạy `Script SQL` trên Supabase, verify 8 bảng + RLS + seed data | Lead | 1h | ✅ DONE |
| INFRA-02 | Cấu hình `manifest.json` + `sw.js` (Service Worker – chỉ cache static shell) | Lead | 2h | ⬜ TODO |
| INFRA-03 | Tạo `.env.example` và hướng dẫn setup cho thành viên mới | Lead | 1h | ✅ DONE |
| QA-01 | Viết test case cho `QuickEntryParser` (≥ 10 input mẫu) | BA | 3h | ⬜ TODO |
| QA-02 | Kiểm thử luồng RLS – đảm bảo user A không đọc được data user B | BA | 2h | ⬜ TODO |
| DOC-01 | Viết `docs/use_cases.md` – 5 use case chính | BA | 3h | ⬜ TODO |
| DOC-02 | Viết `docs/architecture.md` – sơ đồ kiến trúc 3 tầng | Lead | 2h | ⬜ TODO |
| DOC-03 | Viết `docs/class_diagram.md` – class diagram các Service | BA | 2h | ⬜ TODO |

---

## 📋 Ký hiệu trạng thái

| Ký hiệu | Nghĩa |
| :---: | :--- |
| ⬜ TODO | Chưa bắt đầu |
| 🔄 IN PROGRESS | Đang làm |
| 👀 REVIEW | Đang review / chờ merge |
| ✅ DONE | Hoàn thành |
| 🚫 BLOCKED | Bị chặn, cần giải quyết phụ thuộc trước |