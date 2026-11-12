# BIÊN BẢN GIAO VIỆC SỬA LỖI & YÊU CẦU HOÀN THIỆN
**Dự án:** SpendWise – Quản lý chi tiêu cá nhân thông minh  
**Người lập biên bản:** Leader – Phan Thanh Tùng (Project Manager & AI/DB Lead)  
**Ngày lập:** 03/11/2026  
**Căn cứ tài liệu:** 
- [UC_INDEX_AND_ASSIGNMENT.md](../use-cases/UC_INDEX_AND_ASSIGNMENT.md)
- [WORKFLOW.md](../git/WORKFLOW.md)
- Kết quả kiểm thử tự động toàn diện hệ thống (20/20 test cases & Chrome headless audit)

---

## I. MỤC ĐÍCH & NGUYÊN TẮC THỰC HIỆN
1. **Tuân thủ đúng phân công (Scope of Responsibility):**
   - Leader đã hoàn thiện và tích hợp phần việc của mình lên nhánh `main`: **UC21** (Trợ lý AI Gemini, `src/services/aiAssistantService.js`, `server/routes/aiRoutes.js`), cấu hình CSDL Supabase (Views, RPCs) và tối ưu cấu hình nền tảng.
   - Toàn bộ các mã nguồn thuộc phạm vi của **TV1, TV2, TV3** được giữ nguyên bản gốc để các thành viên tự chủ động code, kiểm thử và mở Pull Request (PR) theo đúng trách nhiệm cá nhân.
2. **Quy trình Git bắt buộc:**
   - Mỗi thành viên tạo đúng tên nhánh theo quy định (mục II).
   - Tuyệt đối **không push trực tiếp lên `main`**.
   - Chạy `npm run lint` và `npm run build` trước khi mở PR.

---

## II. BẢNG TỔNG HỢP NHIỆM VỤ PHÂN CÔNG THEO THÀNH VIÊN

| Thành viên | Nhóm Use Case | Tên nhánh Git quy chuẩn | Tệp cần xử lý | Mức độ ưu tiên |
| :--- | :--- | :--- | :--- | :---: |
| **TV1 – Trương Bích Vân** | AUTH (UC01, UC05) | `feature/auth-tv1` | `src/services/authService.js`<br>`src/context/AuthContext.jsx` | 🔴 Khẩn cấp (Chặn tạo data) |
| **TV2 – Hồ Nguyên Văn** | UI/DASH (UC16) | `feature/dashboard-tv2` | `src/components/layout/Navbar.jsx`<br>`src/pages/DashboardPage.jsx` | 🟡 Trung bình (Trải nghiệm UI) |
| **Nhóm tiếp quản (Leader & TV3 Quốc)** | WALLET, CAT, TXN (UC07, UC11, UC13) | `feature/core-data-lead` | `src/pages/WalletPage.jsx`<br>`src/pages/CategoryPage.jsx`<br>`src/pages/TransactionPage.jsx`<br>`src/services/transactionService.js` | 🔴 Khẩn cấp (Thiếu nghiệp vụ CRUD) |
| **TV3 – Lê Hoài Quốc** | QUICK, NOTI, REC (UC18, UC24, UC25) | `feature/safe-to-spend-tv3`<br>`feature/recurring-tv3` | `src/services/quickEntryParser.js`<br>`server/routes/quickEntryRoutes.js`<br>`src/services/recurringService.js`<br>`src/services/notificationService.js`<br>`src/components/layout/Navbar.jsx` | 🔴 Khẩn cấp (Thuật toán Parser & Cảnh báo) |

---

## III. HƯỚNG DẪN KỸ THUẬT CHI TIẾT CHO TỪNG THÀNH VIÊN

### 1. TV1 – Trương Bích Vân (BA/QA Lead & Full-stack Dev)
- **Vấn đề phát hiện:**
  - Khi người dùng đăng ký hoặc đăng nhập tài khoản mới, trong bảng `profiles` chưa có dòng tương ứng.
  - Gọi `.single()` trong `authService.getProfile()` và `AuthContext.jsx` gây lỗi `PGRST116: JSON object requested, multiple (or no) rows returned`.
  - Hậu quả nghiêm trọng: Do bảng `wallets`, `transactions`, `budgets` có khóa ngoại trỏ về `profiles.id`, khi người dùng thêm ví hoặc giao dịch sẽ bị lỗi `23503: foreign key constraint violation`.
- **Yêu cầu kỹ thuật:**
  1. Trong `src/services/authService.js`:
     - Đổi `.single()` thành `.maybeSingle()`.
     - Nếu không tìm thấy profile, tự động `.upsert()` một dòng profile mặc định (`full_name: 'Người dùng SpendWise'`).
     - Hàm `updateProfile(userId, profileData)` chuyển từ `.update().eq('id', userId)` sang `.upsert({ id: userId, ...profileData })`.
  2. Trong `src/context/AuthContext.jsx`:
     - Hàm `fetchProfile` nhận tham số `authUser`, kiểm tra `.maybeSingle()`, nếu chưa có thì tự động `upsert` profile ban đầu với tên lấy từ `user_metadata.full_name` hoặc email prefix.
- **Tiêu chí nghiệm thu (Acceptance Criteria):**
  - Tài khoản mới đăng ký khi đăng nhập vào Dashboard không bị crash màn hình trắng.
  - Có thể tạo ngay Ví tiền đầu tiên mà không bị lỗi ràng buộc khóa ngoại `profiles`.

---

### 2. TV2 – Hồ Nguyên Văn (Frontend Lead & UI/PWA Dev)
- **Vấn đề phát hiện:**
  - Thanh Navbar (`src/components/layout/Navbar.jsx`) thiếu mục điều hướng sang `/categories` ("Danh mục"), khiến người dùng không có cách nào vào trang Quản lý danh mục từ menu chính.
  - Trên `DashboardPage.jsx`, chip Preview của Nhập nhanh (Quick Entry) chỉ đọc `parsedData.category` và `parsedData.wallet`, dẫn đến việc khi Parser trả về `categoryName` hoặc `walletKeyword` thì chip bị rỗng hoặc viền đỏ không khớp.
- **Yêu cầu kỹ thuật:**
  1. Trong `src/components/layout/Navbar.jsx`:
     - Bổ sung tab `{ name: 'Danh mục', path: '/categories', icon: Tags }` vào danh sách `navItems` cho cả Desktop Navbar và Mobile Navigation Bar.
     - Đảm bảo hiển thị highlight active route tương ứng.
  2. Trong `src/pages/DashboardPage.jsx`:
     - Kiểm tra fallback: `parsedData.category || parsedData.categoryName` và `parsedData.wallet || parsedData.walletKeyword`.
     - So khớp danh mục không chỉ theo tên cứng mà duyệt qua mảng `keywords` của danh mục người dùng đã tạo trong cơ sở dữ liệu.
- **Tiêu chí nghiệm thu (Acceptance Criteria):**
  - Bấm vào tab "Danh mục" trên menu chuyển trang mượt mà đến `/categories`.
  - Nhập câu tự nhiên trên Dashboard hiển thị đúng chip Preview danh mục và ví tiền được tô sáng.

---

### 3. Nhóm tiếp quản Dữ liệu lõi (Leader Phan Thanh Tùng & TV3 Lê Hoài Quốc)
- **Vấn đề phát hiện:**
  - Theo đặc tả **UC07 (Sửa ví)**, **UC11 (Sửa danh mục)**, **UC13 (Sửa giao dịch)**: Cả 3 trang `WalletPage.jsx`, `CategoryPage.jsx`, `TransactionPage.jsx` mới chỉ có nút Thêm và Xóa, **hoàn toàn thiếu nút Sửa (Icon Pencil) và Modal cập nhật thông tin**.
  - Trong `src/services/transactionService.js`: Hàm `updateTransaction` chỉ mới cập nhật bảng `transactions`, **chưa hề hoàn lại và bù trừ số dư cho ví (`wallets.balance`)**, khiến số dư ví bị sai lệch khi người dùng sửa số tiền hoặc sửa ví thanh toán.
- **Yêu cầu kỹ thuật:**
  1. Trong `src/pages/WalletPage.jsx` (**UC07**):
     - Thêm nút Sửa bên cạnh nút Xóa ở mỗi thẻ ví.
     - Mở Modal cho phép sửa `name`, `balance`, `color`, `icon`. Gọi `walletService.updateWallet`.
  2. Trong `src/pages/CategoryPage.jsx` (**UC11**):
     - Thêm nút Sửa cho từng danh mục người dùng tự tạo.
     - Cho phép chỉnh sửa `name`, `icon`, `color`, và danh sách từ khóa `keywords`. Gọi `categoryService.updateCategory`.
  3. Trong `src/pages/TransactionPage.jsx` (**UC13**):
     - Thêm nút Sửa trong bảng lịch sử giao dịch.
     - Mở modal cho phép sửa số tiền, danh mục, ví, ghi chú và ngày giao dịch.
  4. Trong `src/services/transactionService.js` (**UC13 Logic**):
     - Trong `updateTransaction(id, updates)`: Đọc giao dịch cũ (`oldTxn`).
     - Tính chênh lệch `diff = newEffect - oldEffect` (với `income` là dương, `expense` là âm).
     - Cập nhật số dư `balance` tương ứng trong bảng `wallets`. Nếu chuyển sang ví khác, trừ ví cũ và cộng ví mới.
- **Tiêu chí nghiệm thu (Acceptance Criteria):**
  - Cả 3 trang Ví, Danh mục, Giao dịch đều có đầy đủ bộ nút Thêm / Sửa / Xóa hoạt động trơn tru.
  - Sửa một khoản chi từ 50.000đ thành 70.000đ thì số dư ví tự động giảm đi đúng 20.000đ.

---

### 3. TV3 – Lê Hoài Quốc (Full-stack Dev - Smart & Core Data)
- **Vấn đề phát hiện:**
  - Thuật toán bóc tách trong `src/services/quickEntryParser.js` và `server/routes/quickEntryRoutes.js` (**UC18**) bị lỗi nghiêm trọng khi dùng `includes('an')`: Khi nhập `"nhận lương 15tr"`, chuỗi không dấu `"nhan luong"` chứa chuỗi con `'an'`, dẫn đến bị gán nhầm sang danh mục `"Ăn uống"`.
  - Chưa bổ sung nhận diện cho các từ khóa thu nhập phổ biến như `"lương"`, `"thưởng"`, `"nhận"`.
  - Thuộc tính trả về bị lệch: Frontend cần cả `categoryName`, `walletKeyword`, `rawText` để hiển thị Preview.
  - Trong `recurringService.js` và `notificationService.js`: Gọi hàm RPC `generate_due_recurring_transactions` và `sync_finance_notifications` bị crash với lỗi `PGRST202` nếu phía Supabase SQL chưa tạo hàm này.
  - Chưa tích hợp Popover Chuông thông báo (**UC25**) trên giao diện.
- **Yêu cầu kỹ thuật:**
  1. Trong `src/services/quickEntryParser.js` và `server/routes/quickEntryRoutes.js`:
     - Thay việc so khớp chuỗi con `str.includes('an')` bằng Regex ranh giới từ nguyên vẹn: `new RegExp(`(?:^|\\s)${kw}(?:\\s|$)`, 'i')`.
     - Thêm quy tắc nhận diện danh mục:
       * Từ khóa `"lương"`, `"luong"`, `"salary"` $\rightarrow$ Danh mục `"Lương"`, `type = 'income'`.
       * Từ khóa `"thưởng"`, `"bonus"` $\rightarrow$ Danh mục `"Thưởng & Thu nhập phụ"`, `type = 'income'`.
     - Chuẩn hóa object trả về gồm cả: `{ category, categoryName, wallet, walletKeyword, amount, type, date, note, originalText, rawText }`.
  2. Trong `src/services/recurringService.js` và `src/services/notificationService.js`:
     - Bọc lời gọi `supabase.rpc()` trong `try/catch`. Nếu mã lỗi là `'PGRST202'`, tự động bỏ qua hoặc fallback đọc trực tiếp bảng `notifications` / `recurring_rules`.
  3. Tích hợp Chuông thông báo (**UC25**):
     - Tạo component Dropdown hiển thị thông báo ngân sách và các khoản định kỳ sắp đến hạn trên Navbar.
- **Tiêu chí nghiệm thu (Acceptance Criteria):**
  - Nhập `"nhận lương 10tr hôm nay vcb"` nhận diện chính xác: `type: 'income'`, `amount: 10000000`, `category: 'Lương'`, `wallet: 'vcb'`, không bị nhận diện nhầm thành `"Ăn uống"`.
  - Gọi Service định kỳ và thông báo không gây lỗi đỏ console `PGRST202`.

---

## IV. QUY TRÌNH PHỐI HỢP VÀ THỜI HẠN HOÀN THÀNH
1. **Thời hạn (Deadline đề xuất):** Các thành viên hoàn thành và nộp Pull Request trước **20h00 ngày 05/11/2026**.
2. **Quy trình nộp bài:**
   ```bash
   # Bước 1: Kéo code mới nhất từ main
   git checkout main
   git pull origin main

   # Bước 2: Tạo nhánh riêng theo bảng mục II
   git checkout -b feature/<ten-nhanh-cua-ban>

   # Bước 3: Code và kiểm tra build
   npm run build

   # Bước 4: Commit theo chuẩn Conventional Commits
   git commit -m "fix(<module>): mo ta loi da sua"
   git push origin feature/<ten-nhanh-cua-ban>
   ```
3. **Review & Merge:** Sau khi nộp PR, Leader (Phan Thanh Tùng) sẽ chạy lại bộ kiểm thử tự động để đối soát và tiến hành Merge vào nhánh chính.

