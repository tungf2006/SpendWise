# ĐẶC TẢ USE CASE: UC19 – Preview & Xác nhận giao dịch

> **Tài liệu tham khảo:** Mẫu `TEMPLATE_USE_CASE.md`, bảng phân công `UC19.docx` và dự án [SpendWise](https://github.com/tungf2006/SpendWise).
> **Người thực hiện:** TV4 (Quốc) – Full-stack 2 (Smart & Auto).

---

## 1. THÔNG TIN CHUNG
- **Mã Use Case:** `UC19`
- **Tên Use Case:** Preview & Xác nhận giao dịch
- **Nhóm chức năng:** `QUICK` – Nhập nhanh bằng câu tự nhiên
- **Tác nhân chính (Primary Actor):** Người dùng đã đăng nhập (User)
- **Tác nhân phụ (Secondary Actor):** Supabase PostgreSQL (lưu giao dịch và cập nhật số dư ví)
- **Mức độ ưu tiên:** Trung bình (Tầng 2)

---

## 2. ĐIỀU KIỆN TIÊN QUYẾT & KẾT THÚC
- **Tiền điều kiện (Pre-conditions):**
  - Người dùng đã đăng nhập thành công vào SpendWise và đang ở trang Dashboard.
  - Người dùng đã nhập nội dung giao dịch bằng câu tự nhiên tại ô **Nhập nhanh**; hệ thống đã thực hiện phân tích dữ liệu của `UC18` qua `parseQuickEntry()`.
  - Hệ thống có thể hiển thị bản xem trước (Preview) gồm các thông tin được nhận diện: số tiền, loại giao dịch, ngày giao dịch, ví và danh mục; ghi chú có thể lấy từ câu nhập ban đầu.
  - Người dùng có ít nhất một ví hợp lệ thuộc tài khoản của mình để ghi nhận giao dịch.
- **Hậu điều kiện thành công (Post-conditions - Success):**
  - Người dùng đã kiểm tra/chỉnh sửa các thông tin cần thiết và **xác nhận lưu** giao dịch.
  - Một bản ghi mới được lưu vào bảng `public.transactions` với thông tin đã xác nhận (`wallet_id`, `category_id` nếu có, `type`, `amount`, `transaction_date`, `note`).
  - Số dư của ví tương ứng trong bảng `public.wallets` được cập nhật theo loại giao dịch: cộng số tiền với `income`, trừ số tiền với `expense`.
  - Hệ thống hiển thị thông báo lưu thành công; danh sách giao dịch gần đây, số dư và các chỉ số liên quan trên Dashboard được làm mới.
- **Hậu điều kiện thất bại (Post-conditions - Failure):**
  - Khi người dùng hủy hoặc dữ liệu chưa hợp lệ, hệ thống không tạo giao dịch mới và không thay đổi số dư ví.
  - Nếu thao tác lưu gặp lỗi, hệ thống hiển thị thông báo lỗi và cần bảo đảm dữ liệu giao dịch/số dư ví không bị cập nhật dở dang (yêu cầu tính nhất quán dữ liệu).
  - Dữ liệu đang xem trước được giữ lại để người dùng kiểm tra, sửa và thử lại khi phù hợp.

---

## 3. LUỒNG SỰ KIỆN CHÍNH (MAIN FLOW)
1. Người dùng nhập một câu giao dịch tại mục **Nhập nhanh bằng câu tự nhiên (Quick Entry)** trên `DashboardPage.jsx` (ví dụ: `cafe 35k hôm qua momo`).
2. Hệ thống gọi `parseQuickEntry()` của `quickEntryParser.js` để trích xuất thông tin theo `UC18`.
3. Hệ thống hiển thị khu vực **Xem trước (Preview)**, cho phép người dùng kiểm tra các trường **Số tiền**, **Loại (Thu/Chi)**, **Ngày**, **Ví**, **Danh mục** và **Ghi chú**. Trường chưa nhận diện được được đánh dấu để người dùng bổ sung; hệ thống không tự ý phỏng đoán giá trị chưa xác định.
4. Người dùng rà soát kết quả phân tích và chỉnh sửa/bổ sung những trường chưa đúng hoặc còn thiếu trong form Preview.
5. Người dùng chọn **Xác nhận/Lưu giao dịch** sau khi kiểm tra thông tin.
6. Hệ thống kiểm tra dữ liệu trước khi lưu: `amount > 0`, loại giao dịch là `income` hoặc `expense`, ngày hợp lệ, ví được chọn tồn tại và thuộc người dùng; danh mục (nếu được chọn) phải hợp lệ. Hệ thống khóa thao tác lưu trong lúc đang xử lý để tránh gửi lặp.
7. Hệ thống gọi `transactionService.createTransaction()` với dữ liệu cuối cùng đã được xác nhận, tạo bản ghi trong `public.transactions` và thực hiện cập nhật số dư ví ở `public.wallets`.
8. Khi lưu thành công, hệ thống hiển thị thông báo **"Giao dịch đã được lưu thành công"**, xóa trạng thái nhập nhanh phù hợp và tải lại dữ liệu Dashboard.

---

## 4. CÁC LUỒNG RẼ NHÁNH / THẤT BẠI (ALTERNATIVE / EXCEPTION FLOWS)
- **4a. Người dùng chỉnh sửa thông tin tại Preview (bước 4):**
  - Người dùng thay đổi số tiền, loại, ngày, ví, danh mục hoặc ghi chú đã nhận diện.
  - Hệ thống cập nhật bản xem trước theo giá trị được chỉnh sửa và tiếp tục tại bước 5.
- **4b. Không nhận diện được số tiền hoặc số tiền không hợp lệ (bước 3 hoặc 6):**
  - Hệ thống đánh dấu trường số tiền cần bổ sung và không cho phép lưu khi số tiền trống, không phải số hợp lệ hoặc `<= 0`.
  - Người dùng nhập số tiền hợp lệ rồi tiếp tục xác nhận.
- **4c. Không xác định được ví hoặc người dùng chưa có ví (bước 3 hoặc 6):**
  - Hệ thống yêu cầu người dùng chọn một ví hiện có; không tự động gán một ví không được người dùng xác nhận.
  - Nếu chưa có ví, hệ thống thông báo **"Vui lòng tạo ít nhất 1 ví tiền trước khi lưu giao dịch"**; thao tác lưu không được thực hiện.
- **4d. Danh mục chưa nhận diện được hoặc kết quả phân tích không chính xác (bước 3–4):**
  - Hệ thống đánh dấu thông tin cần kiểm tra; người dùng chọn danh mục phù hợp hoặc xác nhận không chọn danh mục nếu nghiệp vụ cho phép.
  - Không lưu danh mục sai do suy đoán tự động.
- **4e. Ngày giao dịch hoặc loại giao dịch không hợp lệ (bước 6):**
  - Hệ thống thông báo rõ trường cần sửa, giữ nguyên dữ liệu Preview và yêu cầu người dùng điều chỉnh trước khi tiếp tục.
- **4f. Người dùng hủy thao tác xác nhận (bước 4–5):**
  - Hệ thống đóng/thoát chế độ chỉnh sửa hoặc xác nhận, không gọi `createTransaction()` và không thay đổi cơ sở dữ liệu.
- **4g. Mất phiên đăng nhập, mất kết nối mạng hoặc lỗi Supabase (bước 7):**
  - Hệ thống thông báo không thể lưu giao dịch; nếu phiên đăng nhập hết hạn, yêu cầu đăng nhập lại.
  - Không báo thành công khi chưa xác nhận thao tác ghi dữ liệu; bảo lưu thông tin người dùng đã nhập để có thể thử lại.
- **4h. Người dùng nhấn nút lưu nhiều lần (bước 5–7):**
  - Hệ thống vô hiệu hóa nút lưu trong lúc yêu cầu trước đang xử lý, tránh tạo giao dịch trùng lặp ngoài ý muốn.

---

## 5. THÀNH PHẦN KỸ THUẬT LIÊN QUAN
- **Giao diện (Presentation):** `src/pages/DashboardPage.jsx` – ô Quick Entry, khung Preview và thao tác xác nhận/lưu (`handleQuickSave`).
- **Tầng dịch vụ (Service):**
  - `src/services/quickEntryParser.js` – `parseQuickEntry()` (phân tích câu tự nhiên phục vụ bước Preview, liên quan `UC18`).
  - `src/services/transactionService.js` – `createTransaction()` (tạo giao dịch thu/chi và cập nhật số dư ví).
- **Bảng cơ sở dữ liệu (Database):** `public.transactions`, `public.wallets` (tham chiếu `public.categories` để kiểm tra/chọn danh mục).
- **Tài liệu kỹ thuật tham chiếu:** [PROJECT_SPEC.md](https://github.com/tungf2006/SpendWise/blob/main/docs/PROJECT_SPEC.md), [DashboardPage.jsx](https://github.com/tungf2006/SpendWise/blob/main/src/pages/DashboardPage.jsx), [quickEntryParser.js](https://github.com/tungf2006/SpendWise/blob/main/src/services/quickEntryParser.js), [transactionService.js](https://github.com/tungf2006/SpendWise/blob/main/src/services/transactionService.js).