# SPENDWISE – SYSTEM RULES & PROJECT CONTEXT (CHO AI AGENT)

## 1. Tổng quan dự án
- **Tên dự án:** SpendWise – Hệ thống quản lý chi tiêu cá nhân thông minh.
- **Loại ứng dụng:** Web App Responsive (ưu tiên Mobile-first) + Progressive Web App (PWA cơ bản).
- **Quy mô nhóm:** 5 sinh viên (1 Leader/Tech Lead, 1 BA/QA, 1 Frontend, 2 Full-stack).
- **Ngôn ngữ giao tiếp & hiển thị:** Tiếng Việt 100% (cả giao diện người dùng và tài liệu/comment giải thích).

## 2. Kiến trúc & Tech Stack bắt buộc
- **Kiến trúc 3 tầng (3-Tier Architecture):**
  1. **Presentation Layer (UI + PWA):** Giao diện người dùng, Web App Manifest, Service Worker (chỉ cache static shell và trang thông báo mất mạng, KHÔNG làm Offline Sync với IndexedDB).
  2. **Application / Service Layer (`src/services/`):** Chứa toàn bộ business logic phía client:
     - `QuickEntryParser`: Tách câu tự nhiên bằng quy tắc & từ điển (Rule-based), có thể fallback sang Gemini API.
     - `SafeToSpendService`: Tính toán số tiền an toàn chi tiêu trong ngày.
     - `AiAssistantService`: Gom dữ liệu tài chính (Context-stuffing) gửi tới Google Gemini API để tra cứu và tư vấn chi tiêu.
     - `VietQrService`: Chia hóa đơn (Bill Split) và tạo URL ảnh mã QR qua chuẩn `img.vietqr.io`.
  3. **Data Layer (Supabase Backend-as-a-Service):**
     - PostgreSQL Database + Row Level Security (RLS) bắt buộc trên mọi bảng.
     - Supabase Auth (Email/Password).
     - SQL Views / Functions cho các truy vấn thống kê tổng thu/chi và tiến độ ngân sách.
- **Công nghệ mặc định (trừ khi có chỉ định khác):** Vite + React (hoặc Vue) + Tailwind CSS + `@supabase/supabase-js` + `@google/generative-ai` (Gemini API) + Chart.js.

## 3. Bảng thuật ngữ chuẩn (Glossary - Bắt buộc tuân thủ)
Khi đặt tên biến, tên hàm, tên bảng và chữ trên giao diện, BẮT BUỘC dùng thống nhất:
- **Người dùng** (`User` / `Profile`) - Không dùng: Khách hàng, Thành viên.
- **Ví** (`Wallet`) - Không dùng: Tài khoản, Nguồn tiền, Thẻ.
- **Danh mục** (`Category`) - Không dùng: Loại giao dịch, Hạng mục.
- **Giao dịch** (`Transaction`) - Không dùng: Hóa đơn, Bản ghi.
- **Chuyển tiền nội bộ** (`Transfer` - lưu trong `transactions` với `type = 'transfer'` và `to_wallet_id`) - Không tính vào tổng Thu/Chi.
- **Ngân sách** (`Budget`) - Hạn mức chi tiêu tháng theo danh mục.
- **Safe-to-spend** (`SafeToSpend`) - Số tiền an toàn có thể tiêu hôm nay.
- **Mục tiêu tiết kiệm** (`SavingGoal`) - Không dùng: Heo đất, Quỹ.
- **Giao dịch định kỳ** (`RecurringRule`) - Quy tắc thu/chi lặp lại.

## 4. Quy tắc viết Code cho AI trong Antigravity
1. **Đơn giản & Dễ hiểu:** Code phải rõ ràng, tách hàm nhỏ, có comment tiếng Việt ở các đoạn thuật toán quan trọng (như Parser, công thức Safe-to-spend, gọi Gemini API) để các thành viên trình độ trung bình dễ đọc và bảo trì.
2. **Bảo mật:** Không bao giờ hardcode `SUPABASE_ANON_KEY` hay `GEMINI_API_KEY` trực tiếp vào mã nguồn; luôn đọc từ biến môi trường (`import.meta.env.VITE_...`).
3. **Không tự ý thêm tính năng ngoài danh sách 12 chức năng đã chốt:** Không viết code cho Offline Sync, Đa ngôn ngữ (i18n), Nhập CSV ngân hàng hay Chế độ Khách (Guest Mode).