# ĐẶC TẢ USE CASE: UC24 – TẠO GIAO DỊCH ĐỊNH KỲ

> **Tài liệu tham khảo:** `UC24.docx`, `TEMPLATE_USE_CASE(3).md` và mã nguồn dự án [SpendWise](https://github.com/tungf2006/SpendWise).
> **Người thực hiện:** TV4 (Quốc) – Nhóm chức năng `GOAL_REC` (theo bảng phân công trong `UC24.docx`).

---

## 1. THÔNG TIN CHUNG
- **Mã Use Case:** `UC24`
- **Tên Use Case:** Tạo giao dịch định kỳ
- **Nhóm chức năng:** `GOAL_REC` – Mục tiêu tiết kiệm & Giao dịch định kỳ
- **Tác nhân chính (Primary Actor):** Người dùng đã đăng nhập (User)
- **Tác nhân phụ (Secondary Actor):** Supabase PostgreSQL (lưu trữ quy tắc định kỳ; xác thực và phân quyền dữ liệu)
- **Mức độ ưu tiên:** Trung bình (Tầng 2)

---

## 2. ĐIỀU KIỆN TIÊN QUYẾT & KẾT THÚC
- **Tiền điều kiện (Pre-conditions):**
  - Người dùng đã đăng nhập thành công vào hệ thống SpendWise.
  - Người dùng truy cập được trang **Giao dịch định kỳ**.
  - Người dùng có ít nhất một **Ví** và một **Danh mục** phù hợp với loại khoản thu/chi muốn thiết lập.
  - Hệ thống có thể kết nối Supabase để đọc danh sách Ví, Danh mục và lưu quy tắc định kỳ.
- **Hậu điều kiện thành công (Post-conditions - Success):**
  - Một quy tắc giao dịch định kỳ mới được lưu trong bảng `public.recurring_rules`, gắn với `user_id` của người dùng đang đăng nhập.
  - Quy tắc lưu các thông tin: tên khoản định kỳ, loại thu/chi, số tiền, Ví, Danh mục, tần suất, ngày lặp lại trong tháng (nếu áp dụng), ngày đến hạn tiếp theo; trạng thái `is_active = true`.
  - Hệ thống hiển thị thông báo **“Đã tạo Giao dịch định kỳ.”** và làm mới danh sách quy tắc.
  - **Việc tạo quy tắc không tự động ghi một giao dịch vào `transactions` và không cộng/trừ số dư `wallets` ngay tại thời điểm lưu.** Quy tắc được dùng để theo dõi khoản định kỳ và hỗ trợ các chức năng như Safe-to-spend.
- **Hậu điều kiện thất bại (Post-conditions - Failure):**
  - Không tạo thêm bản ghi quy tắc định kỳ mới trong `public.recurring_rules`.
  - Không phát sinh giao dịch thu/chi hoặc thay đổi số dư Ví do thao tác tạo thất bại.
  - Hệ thống hiển thị lỗi để người dùng sửa dữ liệu hoặc thử lại.

---

## 3. LUỒNG SỰ KIỆN CHÍNH (MAIN FLOW)
1. Người dùng mở trang **Giao dịch định kỳ** (`RecurringPage.jsx`). Hệ thống tải danh sách quy tắc hiện có, danh sách Ví và Danh mục của người dùng.
2. Người dùng nhấn nút **“Thêm Giao dịch định kỳ”**.
3. Hệ thống hiển thị biểu mẫu **“Thêm Giao dịch định kỳ”** với các trường: Tên giao dịch định kỳ, Loại khoản (Thu/Chi), Số tiền (VNĐ), Tần suất, Ngày đến hạn tiếp theo, Ngày lặp lại trong tháng (khi chọn hằng tháng), Ví và Danh mục.
4. Người dùng nhập tên khoản định kỳ, chọn loại khoản, nhập số tiền lớn hơn 0, chọn tần suất **hằng tuần** hoặc **hằng tháng**, thiết lập ngày đến hạn và chọn Ví, Danh mục tương ứng. Khi chọn khoản thu/chi, hệ thống lọc danh mục theo loại đã chọn.
5. Nếu tần suất là **hằng tháng**, người dùng chọn ngày lặp lại từ **1 đến 31**. Hệ thống có thể hiển thị ngày đến hạn của kỳ tiếp theo để người dùng xem trước.
6. Người dùng nhấn nút **“Tạo Giao dịch định kỳ”**.
7. Hệ thống kiểm tra tính hợp lệ của các trường bắt buộc, số tiền, ngày đến hạn, tần suất và ngày lặp lại trong tháng (nếu có).
8. Giao diện gọi `recurringService.createRecurringRule()`. Tầng dịch vụ lấy `user_id` từ phiên đăng nhập, chuẩn hóa dữ liệu và gửi lệnh `INSERT` đến bảng `public.recurring_rules` trên Supabase; quy tắc mới được kích hoạt với `is_active = true`.
9. Khi Supabase lưu thành công, hệ thống đóng biểu mẫu, hiển thị **“Đã tạo Giao dịch định kỳ.”**, tải lại danh sách và hiển thị quy tắc vừa tạo cùng ngày đến hạn, tần suất, Ví, Danh mục, số tiền và trạng thái kích hoạt.

---

## 4. CÁC LUỒNG RẼ NHÁNH / THẤT BẠI (ALTERNATIVE / EXCEPTION FLOWS)
- **4a. Người dùng bỏ trống thông tin bắt buộc (rẽ nhánh tại bước 4, 6–7):**
  - Nếu thiếu tên, Ví, Danh mục hoặc ngày đến hạn, hệ thống hiển thị thông báo **“Vui lòng nhập tên, chọn Ví, Danh mục và ngày đến hạn.”**
  - Người dùng bổ sung thông tin và thực hiện lưu lại.
- **4b. Số tiền không hợp lệ (rẽ nhánh tại bước 4, 7):**
  - Nếu số tiền để trống, không phải số hợp lệ hoặc nhỏ hơn hay bằng 0, hệ thống báo lỗi **“Số tiền Giao dịch định kỳ phải lớn hơn 0.”**
  - Người dùng nhập lại số tiền hợp lệ. Tầng dịch vụ cũng kiểm tra giới hạn dữ liệu `NUMERIC(15,2)`.
- **4c. Ngày lặp lại trong tháng không hợp lệ (rẽ nhánh tại bước 5, 7):**
  - Nếu chọn tần suất hằng tháng nhưng ngày lặp lại không phải số nguyên trong khoảng **1–31**, hệ thống hiển thị **“Ngày trong tháng phải từ 1 đến 31.”**
  - Người dùng chọn lại ngày. Với những tháng không đủ ngày tương ứng, quy tắc tính ngày kỳ tiếp theo theo **ngày cuối cùng của tháng**.
- **4d. Không có Ví hoặc Danh mục phù hợp (rẽ nhánh tại bước 1–4):**
  - Hệ thống hiển thị cảnh báo cần có Ví và Danh mục phù hợp trước khi tạo; nút lưu bị vô hiệu hóa khi thiếu danh sách lựa chọn cần thiết.
  - Người dùng tạo hoặc chọn dữ liệu phù hợp rồi quay lại biểu mẫu.
- **4e. Người dùng hủy thao tác (rẽ nhánh tại bước 3–6):**
  - Người dùng nhấn **“Hủy”** hoặc đóng cửa sổ trước khi lưu.
  - Hệ thống đóng biểu mẫu và không tạo quy tắc mới.
- **4f. Phiên đăng nhập không hợp lệ / không có quyền lưu (rẽ nhánh tại bước 8):**
  - Tầng dịch vụ không lấy được `user_id`, hoặc Supabase từ chối thao tác theo quyền truy cập/RLS.
  - Hệ thống hiển thị lỗi; không tạo bản ghi mới trong `public.recurring_rules`.
- **4g. Mất kết nối mạng / Lỗi Supabase (rẽ nhánh tại bước 8–9):**
  - Khi lệnh lưu thất bại, hệ thống hiển thị thông báo lỗi từ tầng dịch vụ, giữ biểu mẫu để người dùng kiểm tra và thử lại.
  - Danh sách quy tắc không được bổ sung bản ghi mới từ thao tác thất bại.
- **4h. Chọn tần suất hằng ngày khi cơ sở dữ liệu chưa hỗ trợ (rẽ nhánh tại bước 4, 8):**
  - Giao diện mã nguồn hiện có lựa chọn **“Hằng ngày (cần cập nhật schema)”**. Tuy nhiên, ràng buộc `CHECK` trong `supabase/init_schema.sql` hiện chỉ cho phép `weekly`, `monthly`, `yearly`.
  - Nếu chưa cập nhật cấu trúc cơ sở dữ liệu, Supabase từ chối lưu quy tắc có `frequency = 'daily'`; hệ thống hiển thị lỗi. Người dùng chọn chu kỳ đang được hỗ trợ hoặc chờ cập nhật schema.
  - Chu kỳ **hằng năm** được tầng dịch vụ hỗ trợ để tương thích dữ liệu cũ; trên giao diện hiện tại lựa chọn này chỉ xuất hiện khi chỉnh sửa quy tắc hằng năm đã có.

---

## 5. THÀNH PHẦN KỸ THUẬT LIÊN QUAN
- **Giao diện (Presentation):** `src/pages/RecurringPage.jsx`
  - Hiển thị danh sách, mở biểu mẫu, nhận dữ liệu, kiểm tra đầu vào, gọi dịch vụ tạo quy tắc và làm mới danh sách sau khi lưu.
- **Tầng dịch vụ (Service):** `src/services/recurringService.js` (`createRecurringRule`)
  - Các hàm liên quan: `getRecurringRules()` (tải danh sách), `calculateNextDueDate()` (xem trước ngày đến hạn kế tiếp).
  - `createRecurringRule()` lấy người dùng đăng nhập qua Supabase Auth, kiểm tra/chuẩn hóa dữ liệu và thêm bản ghi vào `recurring_rules`.
- **Bảng cơ sở dữ liệu (Database):** `public.recurring_rules`
  - **Bảng liên quan để lựa chọn và tham chiếu:** `public.wallets`, `public.categories`.
  - **Trường chính của quy tắc:** `id`, `user_id`, `wallet_id`, `category_id`, `title`, `type`, `amount`, `frequency`, `day_of_month`, `next_due_date`, `is_active`, `created_at`.
  - **Bảo mật:** Supabase Row Level Security (RLS) giới hạn thao tác theo người dùng sở hữu quy tắc.

**Nguồn đối chiếu mã nguồn:**
- [RecurringPage.jsx](https://github.com/tungf2006/SpendWise/blob/main/src/pages/RecurringPage.jsx)
- [recurringService.js](https://github.com/tungf2006/SpendWise/blob/main/src/services/recurringService.js)
- [init_schema.sql](https://github.com/tungf2006/SpendWise/blob/main/supabase/init_schema.sql)
- [PROJECT_SPEC.md](https://github.com/tungf2006/SpendWise/blob/main/docs/PROJECT_SPEC.md)
