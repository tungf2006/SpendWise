# ĐẶC TẢ USE CASE: [MÃ UC] – [TÊN USE CASE]

> **Tài liệu tham khảo:** Dùng mẫu chuẩn này để viết đặc tả cho tất cả 26 Use Cases của dự án SpendWise.
> **Người thực hiện:** [Tên thành viên] ([Vai trò])

---

## 1. THÔNG TIN CHUNG
- **Mã Use Case:** `UCxx`
- **Tên Use Case:** [Ví dụ: Thêm giao dịch thu/chi]
- **Nhóm chức năng:** [AUTH | WALLET | CAT | TXN | BUDGET | DASH | REPORT | QUICK | STS | AIBOT | GOAL_REC | NOTI_QR]
- **Tác nhân chính (Primary Actor):** Người dùng đã đăng nhập (User)
- **Tác nhân phụ (Secondary Actor):** Supabase PostgreSQL, Gemini API (nếu có)
- **Mức độ ưu tiên:** [Cao (Tầng 1) | Trung bình (Tầng 2) | Mở rộng (Tầng 3)]

---

## 2. ĐIỀU KIỆN TIÊN QUYẾT & KẾT THÚC
- **Tiền điều kiện (Pre-conditions):**
  - Người dùng đã đăng nhập thành công vào hệ thống.
  - [Các điều kiện khác, ví dụ: Người dùng đã có ít nhất 1 ví tiền].
- **Hậu điều kiện thành công (Post-conditions - Success):**
  - Giao dịch được lưu vào bảng `transactions`.
  - Số dư của ví trong bảng `wallets` được cập nhật tương ứng (+ với income, - với expense).
  - Giao diện người dùng hiển thị thông báo thành công và cập nhật lại danh sách.
- **Hậu điều kiện thất bại (Post-conditions - Failure):**
  - Không có dữ liệu nào bị thay đổi trong cơ sở dữ liệu.
  - Hiển thị thông báo lỗi rõ ràng cho người dùng.

---

## 3. LUỒNG SỰ KIỆN CHÍNH (MAIN FLOW)
1. Người dùng nhấn nút "Thêm giao dịch" tại trang Giao dịch hoặc Dashboard.
2. Hệ thống hiển thị Modal "Thêm Giao dịch Mới" kèm các trường: Loại (Thu/Chi), Số tiền, Ví thanh toán, Danh mục, Ngày, Ghi chú.
3. Người dùng chọn loại giao dịch, nhập số tiền, chọn ví nguồn và danh mục tương ứng.
4. Người dùng nhấn nút "Lưu giao dịch".
5. Hệ thống kiểm tra tính hợp lệ của dữ liệu (số tiền > 0, ví hợp lệ).
6. Hệ thống gọi `transactionService.createTransaction()` để lưu bản ghi vào Supabase và cập nhật số dư ví.
7. Hệ thống đóng Modal, làm mới danh sách giao dịch và cập nhật số dư trên giao diện.

---

## 4. CÁC LUỒNG RẼ NHÁNH / THẤT BẠI (ALTERNATIVE / EXCEPTION FLOWS)
- **4a. Số tiền không hợp lệ (<= 0 hoặc để trống):**
  - Hệ thống báo lỗi "Số tiền giao dịch phải lớn hơn 0" viền đỏ trường nhập liệu.
  - Người dùng nhập lại số tiền hợp lệ.
- **4b. Người dùng chưa có ví tiền:**
  - Hệ thống hiển thị cảnh báo yêu cầu tạo ví trước khi ghi nhận giao dịch.
- **4c. Mất kết nối mạng / Lỗi Supabase:**
  - Hệ thống thông báo "Không thể kết nối đến máy chủ. Vui lòng thử lại sau giây lát."

---

## 5. THÀNH PHẦN KỸ THUẬT LIÊN QUAN
- **Giao diện (Presentation):** `src/pages/TransactionPage.jsx`
- **Tầng dịch vụ (Service):** `src/services/transactionService.js` (`createTransaction`)
- **Bảng cơ sở dữ liệu (Database):** `public.transactions`, `public.wallets`
