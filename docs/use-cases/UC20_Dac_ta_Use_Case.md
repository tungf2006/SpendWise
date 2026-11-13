# ĐẶC TẢ USE CASE: UC20 – Xem chỉ số Safe-to-spend

> **Tài liệu tham khảo:** Mẫu `TEMPLATE USE CASE` và danh sách phân công trong `UC20.docx` của dự án SpendWise; đối chiếu mã nguồn tại [SpendWise](https://github.com/tungf2006/SpendWise).
> **Người thực hiện:** TV4 (Quốc) – Phụ trách chức năng Safe-to-spend (STS).

---

## 1. THÔNG TIN CHUNG
- **Mã Use Case:** `UC20`
- **Tên Use Case:** Xem chỉ số Safe-to-spend
- **Nhóm chức năng:** `STS` – Safe-to-spend hôm nay
- **Tác nhân chính (Primary Actor):** Người dùng đã đăng nhập (User)
- **Tác nhân phụ (Secondary Actor):** Supabase PostgreSQL; Backend REST API SpendWise (Node.js/Express)
- **Mức độ ưu tiên:** Trung bình (Tầng 2)

---

## 2. ĐIỀU KIỆN TIÊN QUYẾT & KẾT THÚC
- **Tiền điều kiện (Pre-conditions):**
  - Người dùng đã đăng nhập thành công và có thể truy cập trang Dashboard.
  - Hệ thống xác định được ngày hiện tại để lấy tháng/năm và số ngày còn lại trong tháng.
  - Có kết nối đến Supabase để truy xuất ngân sách và các khoản chi định kỳ; Backend REST API phải hoạt động khi cần tính chỉ số.
  - Người dùng **không bắt buộc** phải có ngân sách hoặc khoản chi định kỳ; nếu chưa đặt ngân sách tháng, hệ thống xử lý theo luồng rẽ nhánh 4a.
- **Hậu điều kiện thành công (Post-conditions - Success):**
  - Dashboard hiển thị chỉ số **Safe-to-spend hôm nay** (VNĐ/ngày) được tính từ ngân sách tháng còn lại, khoản chi định kỳ sắp đến và số ngày còn lại trong tháng.
  - Dashboard hiển thị các thông tin giải thích kết quả: **Ngân sách còn lại**, **Định kỳ sắp tới** và **Số ngày còn lại**.
  - Người dùng có thể nhấn **"Cách tính?"** để xem công thức và đóng cửa sổ giải thích bằng nút **"Đã hiểu"**.
  - Đây là chức năng **chỉ đọc và tính toán**; không thêm, sửa hoặc xóa dữ liệu trong cơ sở dữ liệu.
- **Hậu điều kiện thất bại (Post-conditions - Failure):**
  - Không có bản ghi nào trong cơ sở dữ liệu bị thay đổi.
  - Nếu không truy xuất hoặc tính toán được dữ liệu, hệ thống không có kết quả Safe-to-spend đáng tin cậy để xác nhận cho người dùng; xử lý theo luồng 4e.

---

## 3. LUỒNG SỰ KIỆN CHÍNH (MAIN FLOW)
1. Người dùng đã đăng nhập mở trang **Dashboard** của SpendWise.
2. Hệ thống khởi tạo quá trình tải dữ liệu Dashboard và gọi `safeToSpendService.calculateSafeToSpend()`.
3. Dịch vụ lấy thông tin người dùng hiện tại, xác định tháng/năm, ngày hôm nay, ngày cuối tháng và tính **số ngày còn lại của tháng** (bao gồm hôm nay, tối thiểu 1 ngày).
4. Hệ thống gọi `budgetService.getBudgetProgress(month, year)` để lấy tổng hạn mức **ngân sách tháng** và tổng số tiền đã chi trong các danh mục có đặt ngân sách. Hệ thống tính:
   - **Ngân sách còn lại (`RemainingBudget`)** = Tổng ngân sách tháng (`totalBudget`) − Tổng đã chi (`totalSpent`).
5. Hệ thống truy vấn `recurring_rules` của người dùng để tính **tổng khoản chi định kỳ sắp tới (`UpcomingRecurringExpenses`)**, chỉ lấy các quy tắc:
   - Có `type = 'expense'` và `is_active = true`.
   - Có `next_due_date` từ **hôm nay đến hết ngày cuối tháng** (bao gồm hai mốc).
   - Mỗi quy tắc phù hợp được cộng số tiền `amount` tại lần đến hạn kế tiếp một lần.
6. Khi đã có ngân sách được thiết lập trong tháng, dịch vụ gửi các giá trị `remainingBudget`, `upcomingRecurring` và `daysLeft` đến `POST /api/finance/safe-to-spend` để tính toán theo công thức:

   \[
   \text{SafeToSpend} = \max\left(0,\frac{\text{RemainingBudget} - \text{UpcomingRecurringExpenses}}{\text{RemainingDaysInMonth}}\right)
   \]

   Kết quả được làm tròn theo đơn vị VNĐ (`Math.round`) và không nhỏ hơn 0.
7. Dịch vụ `calculateSafeToSpend()` trả về dữ liệu gồm `safeToSpendToday`, `remainingBudget`, `upcomingRecurring`, `daysLeft` và thông tin liên quan; Dashboard cập nhật trạng thái hiển thị.
8. Hệ thống hiển thị thẻ **"Safe-to-spend Hôm nay"** với **"Số tiền an toàn có thể tiêu"** theo đơn vị **VNĐ/ngày**, kèm ba chỉ số giải thích **Ngân sách còn lại**, **Định kỳ sắp tới** và **Số ngày còn lại**.
9. Người dùng nhấn **"Cách tính?"** (nếu muốn); hệ thống mở cửa sổ giải thích công thức. Người dùng nhấn **"Đã hiểu"** để đóng cửa sổ và tiếp tục xem Dashboard.

---

## 4. CÁC LUỒNG RẼ NHÁNH / THẤT BẠI (ALTERNATIVE / EXCEPTION FLOWS)
- **4a. Chưa đặt ngân sách cho tháng hiện tại (tại bước 4):**
  - `getBudgetProgress()` không trả về ngân sách nào được thiết lập trong tháng (`hasBudgetSet = false`).
  - Dịch vụ trả **Safe-to-spend = 0 VNĐ/ngày**; không dùng tổng số dư các ví thay cho hạn mức ngân sách và không cần gọi API tính toán.
  - Người dùng có thể tạo ngân sách tháng tại chức năng Quản lý ngân sách để nhận chỉ số có ý nghĩa hơn.
- **4b. Không có khoản chi định kỳ sắp đến (tại bước 5):**
  - Không tìm thấy `recurring_rules` đang hoạt động, thuộc loại `expense`, có `next_due_date` trong thời gian còn lại của tháng.
  - Hệ thống lấy `UpcomingRecurringExpenses = 0` và tiếp tục tính chỉ số dựa trên ngân sách còn lại và số ngày còn lại.
- **4c. Ngân sách không đủ để chi thêm (tại bước 6):**
  - Tổng tiền đã chi bằng/vượt tổng ngân sách tháng hoặc tổng khoản chi định kỳ sắp tới lớn hơn ngân sách còn lại.
  - Hệ thống áp dụng `max(0, ...)` và hiển thị **0 VNĐ/ngày**, không hiển thị chỉ số âm.
- **4d. Đang ở ngày cuối tháng (tại bước 3):**
  - Số ngày còn lại được tính bằng **1**, vì công thức tính cả hôm nay.
  - Hệ thống tính Safe-to-spend theo phần ngân sách có thể sử dụng trong ngày cuối cùng, không thực hiện phép chia cho 0.
- **4e. Mất kết nối, lỗi Supabase hoặc lỗi Backend REST API (tại bước 3–7):**
  - Dịch vụ không thể lấy dữ liệu ngân sách/quy tắc định kỳ hoặc không nhận được phản hồi hợp lệ từ API.
  - Hàm `calculateSafeToSpend()` bắt lỗi, ghi log và trả dữ liệu mặc định với `safeToSpendToday = 0` cùng trường `error` để bên giao diện có thể phân biệt lỗi với chỉ số 0 hợp lệ.
  - **Lưu ý hiện trạng mã nguồn:** `DashboardPage.jsx` đang nhận kết quả nhưng chưa hiển thị riêng trường `stsData.error`. Để hoàn thiện luồng thất bại, giao diện **nên** hiển thị thông báo "Không thể tính Safe-to-spend lúc này. Vui lòng thử lại sau." thay vì khiến người dùng hiểu nhầm 0 VNĐ là kết quả chính xác.
- **4f. Phiên đăng nhập không hợp lệ (tại bước 3):**
  - Không lấy được thông tin người dùng từ `supabase.auth.getUser()`.
  - Dịch vụ trả lỗi với nội dung yêu cầu đăng nhập; không truy vấn dữ liệu tài chính của người dùng khác.
  - Người dùng cần đăng nhập lại để xem chỉ số.
- **4g. Dữ liệu tính toán không hợp lệ (tại bước 4–6):**
  - Giá trị ngân sách hoặc khoản định kỳ không phải số hợp lệ, hoặc dữ liệu gửi lên API không đáp ứng điều kiện tính toán.
  - Hệ thống không xác nhận kết quả tính toán; xử lý lỗi theo luồng 4e và không làm thay đổi dữ liệu đã lưu.

---

## 5. THÀNH PHẦN KỸ THUẬT LIÊN QUAN
- **Giao diện (Presentation):** `src/pages/DashboardPage.jsx` — thẻ "Safe-to-spend Hôm nay", các thành phần giải thích số liệu, nút "Cách tính?" và cửa sổ công thức.
- **Tầng dịch vụ (Service):**
  - `src/services/safeToSpendService.js` — `calculateSafeToSpend()`; truy xuất dữ liệu và điều phối tính toán.
  - `src/services/budgetService.js` — `getBudgetProgress(month, year)`; tổng hợp hạn mức ngân sách và chi tiêu tháng.
  - `src/services/safeToSpendService.js` — các hàm hỗ trợ ngày tháng, truy vấn khoản chi định kỳ, kiểm tra dữ liệu và tính số tiền an toàn.
- **Backend REST API:** `server/routes/financeRoutes.js` — `POST /api/finance/safe-to-spend` (được đăng ký dưới tiền tố `/api/finance` trong `server/server.js`).
- **Bảng cơ sở dữ liệu (Database):**
  - `public.budgets` — hạn mức ngân sách theo danh mục và theo tháng/năm.
  - `public.transactions` — dữ liệu chi tiêu dùng để tổng hợp tiến độ ngân sách thông qua `getBudgetProgress()`.
  - `public.recurring_rules` — các khoản chi định kỳ đang hoạt động và sắp đến hạn trong tháng.
  - `public.wallets` — bảng được liệt kê trong **UC20.docx** và được Dashboard dùng cho số dư ví; **không trực tiếp tham gia công thức** Safe-to-spend trong mã dịch vụ hiện tại.
- **Bảo mật dữ liệu:** Truy vấn theo người dùng đang đăng nhập; chính sách Row Level Security (RLS) của Supabase giới hạn truy cập bản ghi theo `user_id`.

> **Nguồn đối chiếu mã nguồn:** [Safe-to-spend Service](https://github.com/tungf2006/SpendWise/blob/main/src/services/safeToSpendService.js) · [DashboardPage](https://github.com/tungf2006/SpendWise/blob/main/src/pages/DashboardPage.jsx) · [Finance Routes](https://github.com/tungf2006/SpendWise/blob/main/server/routes/financeRoutes.js) · [Đặc tả dự án](https://github.com/tungf2006/SpendWise/blob/main/docs/PROJECT_SPEC.md).
