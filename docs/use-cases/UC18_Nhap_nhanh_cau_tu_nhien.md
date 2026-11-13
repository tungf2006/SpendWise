# ĐẶC TẢ USE CASE: UC18 – Nhập nhanh câu tự nhiên

> **Tài liệu tham khảo:** `UC18.docx`, `TEMPLATE_USE_CASE.md` và mã nguồn dự án [SpendWise](https://github.com/tungf2006/SpendWise).
> **Người thực hiện:** Lê Hoài Quốc (TV4 – Full-stack 2, Smart & Auto).

---

## 1. THÔNG TIN CHUNG
- **Mã Use Case:** `UC18`
- **Tên Use Case:** Nhập nhanh câu tự nhiên
- **Nhóm chức năng:** `QUICK`
- **Tác nhân chính (Primary Actor):** Người dùng đã đăng nhập (User).
- **Tác nhân phụ (Secondary Actor):** Không có tác nhân ngoài hệ thống cho thao tác phân tích. Bộ phân tích `parseQuickEntry()` chạy trực tiếp ở phía Client; không gọi Gemini API hay Supabase để phân tích câu.
- **Mức độ ưu tiên:** Trung bình (Tầng 2).

---

## 2. ĐIỀU KIỆN TIÊN QUYẾT & KẾT THÚC
- **Tiền điều kiện (Pre-conditions):**
  - Người dùng đã đăng nhập thành công vào hệ thống SpendWise và có thể truy cập trang Dashboard.
  - Giao diện **Nhập nhanh bằng câu tự nhiên (Quick Entry)** đã sẵn sàng để người dùng nhập nội dung.
  - Người dùng có câu mô tả khoản thu/chi bằng ngôn ngữ tự nhiên. Ví dụ: `cafe 35k hôm qua momo`.
  - Không bắt buộc phải có sẵn ví hoặc danh mục để **phân tích** câu; việc lựa chọn ví hợp lệ cần được xử lý ở bước lưu giao dịch, ngoài phạm vi UC18.
- **Hậu điều kiện thành công (Post-conditions - Success):**
  - Nội dung được phân tích thành dữ liệu có cấu trúc, bao gồm số tiền (`amount`), ngày (`date`), loại thu/chi (`type`), ví (`wallet`), danh mục (`category`), ghi chú (`note`) và trạng thái nhận diện (`confidence`).
  - Hệ thống hiển thị phần **Xem trước** trên Dashboard để người dùng kiểm tra kết quả trước khi thực hiện thao tác lưu.
  - Người dùng có thể sửa lại **câu nhập** để hệ thống phân tích và cập nhật kết quả xem trước.
  - **Không có bản ghi nào được tạo hoặc thay đổi trong cơ sở dữ liệu ở riêng bước phân tích UC18.**
- **Hậu điều kiện thất bại (Post-conditions - Failure):**
  - Nếu nội dung không hợp lệ hoặc không nhận diện được số tiền, hệ thống không tạo được dữ liệu nhập nhanh đầy đủ để tiếp tục lưu.
  - Thông tin chưa nhận diện được cần được thể hiện rõ ở phần xem trước; người dùng vẫn có thể nhập lại câu.
  - Không có dữ liệu giao dịch hoặc số dư ví nào bị thay đổi do thao tác phân tích thất bại.

---

## 3. LUỒNG SỰ KIỆN CHÍNH (MAIN FLOW)
1. Người dùng mở trang **Dashboard** và tìm đến khu vực **Nhập nhanh bằng câu tự nhiên (Quick Entry)**.
2. Hệ thống hiển thị ô nhập văn bản cùng câu ví dụ, chẳng hạn `cafe 35k hôm qua momo`, và phần **Xem trước** kết quả.
3. Người dùng gõ một câu tự nhiên mô tả giao dịch, ví dụ: **`cafe 35k hôm qua momo`**.
4. Mỗi khi nội dung ô nhập thay đổi, `DashboardPage.jsx` gọi `handleQuickInputChange()`, sau đó truyền văn bản vào `quickEntryParser.parseQuickEntry(input)`.
5. Bộ phân tích chuẩn hóa văn bản bằng `removeVietnameseTones()` và áp dụng các quy tắc nhận diện (rule-based):
   - **Loại giao dịch:** Nhận diện các từ khóa thu nhập như `lương`, `thưởng`, `nhận tiền`; nếu không khớp, mặc định `expense` (chi tiêu).
   - **Ngày giao dịch:** Nhận diện `hôm nay`, `hôm qua`, `hôm kia`, hoặc ngày dạng `dd/mm`, `dd/mm/yyyy`; nếu không có thông tin, mặc định ngày hiện tại.
   - **Ví:** So khớp từ khóa như `momo`, `zalopay`, `vcb`, `techcombank`, `tiền mặt` để xác định **tên ví gợi ý**; nếu không khớp, trả về `null`.
   - **Danh mục:** Dựa vào nhóm từ khóa, ví dụ `cafe`, `phở`, `cơm` → `Ăn uống`; `grab`, `xăng` → `Di chuyển`. Nếu không khớp, trả về `null`.
   - **Số tiền:** Dùng biểu thức chính quy để nhận diện các dạng `35k`, `500 nghìn`, `1tr2`, `1.5 triệu`, `200000` và quy đổi thành giá trị số theo đơn vị VNĐ.
6. Hàm `parseQuickEntry()` trả về đối tượng kết quả gồm `originalText`, `amount`, `date`, `dateLabel`, `type`, `wallet`, `category`, `note`, `confidence`.
7. Dashboard cập nhật phần **Xem trước**, thể hiện số tiền, loại giao dịch, ngày, danh mục và ví. Với câu ví dụ ở bước 3, kết quả phân tích dự kiến là: **35.000 VNĐ**, **Chi tiêu**, **Hôm qua**, **Ăn uống**, **Ví MoMo**.
8. Người dùng kiểm tra kết quả. Nếu cần điều chỉnh, người dùng sửa câu nhập và hệ thống lặp lại từ bước 4. Khi kết quả phù hợp, UC18 kết thúc; **thao tác xác nhận/lưu giao dịch là bước nghiệp vụ tiếp theo, không thuộc xử lý phân tích của UC18**.

---

## 4. CÁC LUỒNG RẼ NHÁNH / THẤT BẠI (ALTERNATIVE / EXCEPTION FLOWS)
- **4a. Người dùng xóa toàn bộ nội dung ô nhập (tại bước 3–4):**
  - Hàm `parseQuickEntry('')` trả về `null`; hệ thống không có dữ liệu mới để hiển thị trong khung xem trước.
  - Người dùng nhập một câu mới để bắt đầu phân tích lại.
- **4b. Không nhận diện được số tiền (tại bước 5):**
  - Kết quả có `amount = null` và `confidence.amount = false`.
  - Giao diện hiển thị **“Số tiền: Chưa nhận diện”**, đồng thời vô hiệu hóa nút **Lưu** khi chưa có số tiền hợp lệ.
  - Người dùng bổ sung hoặc sửa số tiền trong câu rồi thử lại.
- **4c. Không có thông tin ngày giao dịch (tại bước 5):**
  - Hệ thống sử dụng ngày hiện tại làm giá trị mặc định (`dateLabel = 'Hôm nay'` và `confidence.date = false`).
  - Người dùng có thể thêm cụm từ như `hôm qua` hoặc ngày cụ thể vào câu nếu muốn thay đổi.
- **4d. Không nhận diện được ví hoặc danh mục (tại bước 5):**
  - Bộ phân tích trả về `wallet = null` và/hoặc `category = null`, với cờ `confidence` tương ứng bằng `false`.
  - Theo thiết kế, giao diện cần thông báo rõ các trường chưa nhận diện để người dùng kiểm tra; không được mặc nhiên coi kết quả suy đoán là chính xác.
  - Người dùng bổ sung từ khóa ví hoặc danh mục vào câu và hệ thống phân tích lại.
- **4e. Không nhận diện được từ khóa loại thu nhập (tại bước 5):**
  - Hệ thống mặc định `type = 'expense'` (chi tiêu).
  - Nếu thực tế là khoản thu, người dùng diễn đạt lại câu bằng các từ khóa thu nhập được hỗ trợ, ví dụ `nhận lương 5tr momo`.
- **4f. Câu nhập chứa từ khóa không được hỗ trợ hoặc thông tin mơ hồ (tại bước 5):**
  - Bộ phân tích chỉ trả về các trường khớp quy tắc hiện có; những trường khác không được nhận diện hoặc dùng giá trị mặc định đã quy định.
  - Người dùng chỉnh sửa câu nhập; UC18 không tự động gọi AI để đoán ý định hoặc bổ sung dữ liệu còn thiếu.

---

## 5. THÀNH PHẦN KỸ THUẬT LIÊN QUAN
- **Giao diện (Presentation):** `src/pages/DashboardPage.jsx` — khu vực Quick Entry, `handleQuickInputChange()`, trạng thái `quickInput`/`parsedData` và các nhãn xem trước.
- **Tầng dịch vụ (Service):** `src/services/quickEntryParser.js` — hàm `parseQuickEntry(input)`; dùng `src/utils/unaccent` (`removeVietnameseTones`) để hỗ trợ nhận diện không dấu.
- **Bảng cơ sở dữ liệu (Database):** **Không** — đây là **Client parser**, chỉ xử lý dữ liệu trong bộ nhớ trình duyệt. Không truy vấn hay ghi vào bảng Supabase khi phân tích.
- **Liên quan nhưng ngoài phạm vi UC18:** `src/services/transactionService.js` — `createTransaction()` được dùng khi người dùng thực sự lưu giao dịch; khi đó có liên quan các bảng `public.transactions` và `public.wallets`.

**Lưu ý đối chiếu mã nguồn hiện tại:**
- `parseQuickEntry()` đang trả về thuộc tính `wallet`, `category` và `originalText`, nhưng `DashboardPage.jsx` lại đọc `walletKeyword`, `categoryName` và `rawText`. Vì tên thuộc tính chưa thống nhất, thông tin ví/danh mục có thể không hiển thị đúng trong phần xem trước và không được ánh xạ đúng khi lưu. Cần thống nhất hợp đồng dữ liệu giữa parser và Dashboard.
- Mã giao diện hiện tại hiển thị **nhãn xem trước** và cho phép sửa **câu nhập**, chưa có các trường chỉnh sửa riêng từng thuộc tính trong Preview như mô tả mục tiêu của `docs/PROJECT_SPEC.md`.
- Với chuỗi chỉ chứa khoảng trắng, parser hiện vẫn tạo đối tượng kết quả có `amount = null`; nên bổ sung kiểm tra `input.trim()` nếu muốn hành vi đồng nhất với trường hợp đầu vào rỗng.

**Nguồn tham chiếu mã nguồn:**
- [Quick Entry parser](https://github.com/tungf2006/SpendWise/blob/main/src/services/quickEntryParser.js)
- [Dashboard và phần Xem trước](https://github.com/tungf2006/SpendWise/blob/main/src/pages/DashboardPage.jsx)
- [Đặc tả phạm vi QUICK](https://github.com/tungf2006/SpendWise/blob/main/docs/PROJECT_SPEC.md)
