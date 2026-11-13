# ĐẶC TẢ USE CASE: UC25 – XEM THÔNG BÁO HỆ THỐNG

> **Tài liệu tham khảo:** Mẫu `TEMPLATE_USE_CASE(4).md`, bảng phân công `UC25.docx` và mã nguồn dự án [SpendWise](https://github.com/tungf2006/SpendWise).
> **Người thực hiện:** Lê Hoài Quốc (TV4 – Full-stack, phụ trách UC25).

---

## 1. THÔNG TIN CHUNG
- **Mã Use Case:** `UC25`
- **Tên Use Case:** Xem thông báo hệ thống
- **Nhóm chức năng:** `NOTI_QR` – Thông báo & VietQR
- **Tác nhân chính (Primary Actor):** Người dùng đã đăng nhập (User)
- **Tác nhân phụ (Secondary Actor):** Supabase Auth và Supabase PostgreSQL (bảng `public.notifications`)
- **Mức độ ưu tiên:** Mở rộng (Tầng 3)

---

## 2. ĐIỀU KIỆN TIÊN QUYẾT & KẾT THÚC
- **Tiền điều kiện (Pre-conditions):**
  - Người dùng đã đăng nhập thành công và đang sử dụng SpendWise.
  - Ứng dụng có kết nối đến Supabase và có quyền truy cập các thông báo thuộc tài khoản hiện tại.
  - Chức năng mở danh sách thông báo trên giao diện đã được tích hợp với tầng dịch vụ (theo thiết kế của UC25).
  - Người dùng **không bắt buộc** phải có thông báo trước đó; danh sách rỗng là tình huống hợp lệ.
- **Hậu điều kiện thành công (Post-conditions - Success):**
  - Hệ thống hiển thị danh sách thông báo thuộc về người dùng đang đăng nhập, sắp xếp theo thời điểm tạo mới nhất trước.
  - Mỗi thông báo có thể hiển thị tiêu đề, nội dung, loại thông báo, thời gian tạo và trạng thái đã đọc/chưa đọc.
  - Người dùng có thể xem số lượng thông báo chưa đọc nếu giao diện sử dụng `getUnreadCount()`.
  - **Thao tác chỉ xem** không làm thay đổi dữ liệu trong `public.notifications`; chỉ khi người dùng chủ động đánh dấu đã đọc mới cập nhật `is_read`.
- **Hậu điều kiện thất bại (Post-conditions - Failure):**
  - Danh sách thông báo không tải được hoặc không được hiển thị đầy đủ; hệ thống thông báo lỗi phù hợp để người dùng thử lại.
  - Không phát sinh thao tác ghi dữ liệu từ yêu cầu xem thông báo; các thông báo hiện có không bị thay đổi.
  - Hệ thống không hiển thị thông báo của tài khoản khác.

---

## 3. LUỒNG SỰ KIỆN CHÍNH (MAIN FLOW)
1. Người dùng đã đăng nhập truy cập một màn hình trong ứng dụng SpendWise.
2. Người dùng nhấn biểu tượng **chuông thông báo** hoặc mục **Thông báo** trên khu vực điều hướng (giao diện dự kiến tích hợp trong `AppLayout`/`Navbar`).
3. Hệ thống mở khung hoặc danh sách **Thông báo** và bắt đầu tải dữ liệu của người dùng.
4. Hệ thống gọi `notificationService.getNotifications()` để lấy các thông báo từ Supabase; nếu không truyền tham số, giới hạn mặc định là **30 thông báo**.
5. Tầng dịch vụ lấy người dùng hiện tại qua `supabase.auth.getUser()`, truy vấn bảng `notifications` với điều kiện `user_id` bằng ID của người dùng, sắp xếp theo `created_at` giảm dần và áp dụng giới hạn số bản ghi.
6. Supabase trả về dữ liệu gồm các trường `id`, `user_id`, `title`, `message`, `type`, `is_read`, `created_at` (hoặc thông tin lỗi khi truy vấn thất bại).
7. Hệ thống hiển thị danh sách thông báo, phân biệt **chưa đọc/đã đọc** và cho phép người dùng xem nội dung từng thông báo. Các loại thông báo có thể bao gồm: `budget_warning`, `budget_exceeded`, `recurring_due`, `system`.
8. Nếu giao diện hiển thị huy hiệu số lượng chưa đọc, hệ thống gọi `notificationService.getUnreadCount()` để cập nhật số lượng thông báo có `is_read = false`.
9. Người dùng xem xong và đóng danh sách thông báo hoặc tiếp tục sử dụng ứng dụng. Use Case kết thúc; không bắt buộc thay đổi trạng thái đã đọc.

---

## 4. CÁC LUỒNG RẼ NHÁNH / THẤT BẠI (ALTERNATIVE / EXCEPTION FLOWS)
- **4a. Người dùng chưa có thông báo (tại bước 6–7):**
  - `getNotifications()` trả về `data: []` mà không có lỗi.
  - Hệ thống hiển thị trạng thái rỗng, ví dụ: **"Bạn chưa có thông báo nào."**
  - Người dùng có thể đóng danh sách thông báo bình thường.
- **4b. Người dùng chưa đăng nhập hoặc phiên đăng nhập không còn hợp lệ (tại bước 5):**
  - Theo tầng dịch vụ hiện tại, khi không tìm thấy người dùng, `getNotifications()` trả về `{ data: [], error: null }`.
  - Giao diện cần yêu cầu người dùng đăng nhập lại nếu phiên đã hết hạn, thay vì hiển thị thông báo của tài khoản khác.
- **4c. Mất kết nối mạng / Lỗi truy vấn Supabase (tại bước 5–6):**
  - `getNotifications()` trả về lỗi trong thuộc tính `error`; hệ thống không coi đây là danh sách rỗng hợp lệ.
  - Giao diện thông báo, ví dụ: **"Không thể tải thông báo. Vui lòng kiểm tra kết nối và thử lại."**
  - Người dùng có thể thực hiện thao tác tải lại khi kết nối ổn định.
- **4d. Người dùng chọn đánh dấu một thông báo là đã đọc (sau bước 7 – luồng mở rộng):**
  - Hệ thống gọi `notificationService.markAsRead(id)` đối với thông báo được chọn.
  - Dịch vụ kiểm tra ID ở định dạng UUID, xác định người dùng hiện tại và cập nhật `is_read = true` đối với bản ghi có `id` và `user_id` phù hợp.
  - Nếu thành công, giao diện cập nhật trạng thái thông báo và số lượng chưa đọc (nếu có).
  - Nếu thất bại, hệ thống hiển thị thông báo lỗi và không xác nhận đã đọc khi chưa cập nhật thành công.
- **4e. Người dùng chọn đánh dấu tất cả thông báo là đã đọc (sau bước 7 – luồng mở rộng):**
  - Hệ thống gọi `notificationService.markAllAsRead()` để cập nhật các thông báo chưa đọc thuộc tài khoản hiện tại.
  - Sau khi thao tác thành công, giao diện tải lại trạng thái danh sách và số lượng chưa đọc.
- **4f. Yêu cầu số lượng thông báo không hợp lệ (tại bước 4 – trường hợp kỹ thuật):**
  - `getNotifications(limit)` chỉ chấp nhận số nguyên từ **1 đến 100**.
  - Nếu tham số nằm ngoài phạm vi này, dịch vụ trả về lỗi; giao diện cần sử dụng giới hạn hợp lệ và cho phép thử lại.
- **4g. Có yêu cầu truy cập thông báo của người dùng khác:**
  - Tầng dịch vụ giới hạn truy vấn theo `user_id` hiện tại; chính sách **Row Level Security (RLS)** của `public.notifications` tiếp tục cô lập dữ liệu theo `auth.uid()`.
  - Hệ thống không hiển thị dữ liệu thông báo không thuộc tài khoản đang đăng nhập.

---

## 5. THÀNH PHẦN KỸ THUẬT LIÊN QUAN
- **Giao diện (Presentation):** `src/components/layout/AppLayout.jsx` (layout chung, khởi chạy đồng bộ thông báo); `src/components/layout/Navbar.jsx` (khu vực điều hướng dự kiến hiển thị chuông/danh sách thông báo). Trong bảng UC25, tệp giao diện được ghi ngắn gọn là `AppLayout.jsx`.
- **Tầng dịch vụ (Service):** `src/services/notificationService.js`:
  - `getNotifications(limit = 30)`: truy vấn tối đa 100 thông báo của người dùng hiện tại, mới nhất trước; trả về `{ data, error }`.
  - `getUnreadCount()`: đếm số thông báo chưa đọc; trả về `{ count, error }`.
  - `markAsRead(id)`: đánh dấu một thông báo đã đọc (luồng mở rộng).
  - `markAllAsRead()`: đánh dấu tất cả thông báo chưa đọc (luồng mở rộng).
  - `startNotificationAutoSync(...)`: hỗ trợ tự đồng bộ/tạo thông báo theo các sự kiện tài chính; **không thay thế** thao tác đọc danh sách của UC25.
- **Bảng cơ sở dữ liệu (Database):** `public.notifications` với các trường `id`, `user_id`, `title`, `message`, `type`, `is_read`, `created_at`. Bảng được bật **RLS** để giới hạn truy cập thông báo theo chủ sở hữu.
- **Trạng thái đối chiếu mã nguồn:** Nhánh `main` đã có các hàm dịch vụ phục vụ UC25 và `AppLayout.jsx` đã gọi `startNotificationAutoSync(...)`. Tuy nhiên, mã `Navbar.jsx` được đối chiếu mới import biểu tượng `Bell`, chưa thấy nút mở danh sách thông báo hay lời gọi `getNotifications()` trong phần giao diện đó. Các bước mở danh sách/hiển thị chuông ở mục 3 và 4 là **luồng nghiệp vụ cần tích hợp để hoàn chỉnh UC25**, không phải xác nhận rằng giao diện này đã được triển khai.
- **Mã nguồn tham khảo:**
  - [notificationService.js](https://github.com/tungf2006/SpendWise/blob/main/src/services/notificationService.js)
  - [AppLayout.jsx](https://github.com/tungf2006/SpendWise/blob/main/src/components/layout/AppLayout.jsx)
  - [Navbar.jsx](https://github.com/tungf2006/SpendWise/blob/main/src/components/layout/Navbar.jsx)
  - [init_schema.sql](https://github.com/tungf2006/SpendWise/blob/main/supabase/init_schema.sql)
  - [TASKS.md](https://github.com/tungf2006/SpendWise/blob/main/docs/TASKS.md)
