# SPENDWISE – HƯỚNG DẪN BẮT ĐẦU VÀ PHỐI HỢP CÔNG VIỆC NHÓM

> **Dành cho:** Tất cả 5 thành viên nhóm dự án SpendWise.  
> **Chủ biên:** Leader – Phan Thanh Tùng (Project Manager & AI/DB Lead).  
> **Mục tiêu:** Giúp mọi thành viên hiểu rõ nhiệm vụ, nhận nhánh làm việc, không bị xung đột code (Merge Conflict) và đạt tiến độ nộp bài ngày 29 (15/11).

---

## 1. HƯỚNG DẪN 3 BƯỚC KHỞI ĐỘNG (SETUP MÔI TRƯỜNG DEV)

Mọi thành viên sau khi clone repo hoặc mở dự án trên máy tính, thực hiện theo đúng 3 bước:

### Bước 1: Kéo mã nguồn mới nhất từ nhánh `master`
```bash
git checkout master
git pull origin master
```

### Bước 2: Cài đặt thư viện dependencies
```bash
npm install
```

### Bước 3: Cấu hình biến môi trường `.env`
Sao chép file `.env.example` thành file `.env` (nếu chưa có):
```env
VITE_SUPABASE_URL=https://ndeohlqneywsducsyqsb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GEMINI_API_KEY=AIzaSy...
```

### Bước 4: Chạy thử nghiệm môi trường phát triển (Cả FE và BE)
* **Khởi chạy Frontend (Giao diện React 19):**
  ```bash
  npm run dev
  ```
  *(Mở trình duyệt tại địa chỉ `http://localhost:5173` để xem giao diện web)*

* **Khởi chạy Backend REST API (Máy chủ Node.js Express):**
  Mở thêm một cửa sổ terminal mới và chạy:
  ```bash
  npm run server
  ```
  *(Máy chủ Backend sẽ lắng nghe tại `http://localhost:5000`. Kiểm tra API Healthcheck tại `http://localhost:5000/api/finance/health`)*

* **Kiểm tra biên dịch mã nguồn (Build check):**
  ```bash
  npm run build
  ```
  *(Đảm bảo terminal báo `✓ built in ...s` màu xanh không có bất kỳ lỗi nào)*

### Bước 5: Đăng nhập vào hệ thống (Tiện ích 1-Click Demo Login)
Mở trình duyệt tại `http://localhost:5173/login`:
* **Cách 1 (Nhanh nhất):** Bấm nút **"⚡ Đăng nhập 1-Click tài khoản Demo"** để vào ngay với tài khoản mẫu `demo@spendwise.vn`.
* **Cách 2:** Bấm chọn nhanh tài khoản tương ứng với vai trò của mình trong nhóm:
  * 👑 **Leader (Tùng):** `tung123@gmail.com` (Pass: `123456`)
  * 👩‍💻 **TV1 (Bích Vân):** `van@spendwise.vn` (Pass: `123456`)
  * 👨‍💻 **TV2 (Nguyên Văn):** `nguyenvan@spendwise.vn` (Pass: `123456`)
  * 👨‍💻 **TV3 (Tấn Huy):** `huy@spendwise.vn` (Pass: `123456`)
  * 👨‍💻 **TV4 (Hoài Quốc):** `quoc@spendwise.vn` (Pass: `123456`)
* *Lưu ý:* Nếu tài khoản chưa từng tạo trên Supabase, nút bấm sẽ tự động khởi tạo và đăng nhập tức thì.

---

## 2. QUY ƯỚC NHÁNH GIT (GIT BRANCHING & PULL REQUEST)

> ⛔ **NGHIÊM CẤM:** Không thành viên nào được `git push` trực tiếp lên nhánh `master`. Nhánh `master` được bảo vệ và do Leader kiểm duyệt.

### Quy trình 4 bước khi làm một chức năng:
1. **Tạo nhánh mới từ `master`:**
   ```bash
   git checkout master
   git pull origin master
   git checkout -b <tên-nhánh-của-bạn>
   ```
2. **Quy ước đặt tên nhánh:**
   * **TV1 (Trương Bích Vân):** `feature/auth-goal-tv1` hoặc `feature/vietqr-tv1`
   * **TV2 (Hồ Nguyên Văn):** `feature/dashboard-reports-tv2` hoặc `feature/budget-tv2`
   * **TV3 (Nguyễn Vũ Tấn Huy):** `feature/wallets-txns-tv3` hoặc `feature/categories-tv3`
   * **TV4 (Lê Hoài Quốc):** `feature/smart-features-tv4` hoặc `feature/recurring-tv4`
3. **Commit đúng chuẩn Conventional Commits:**
   * `feat: them modal chuyen tien noi bo giua 2 vi`
   * `fix: sua loi tinh toan thanh tien do ngan sach`
   * `docs: bo sung dac ta use case UC06`
4. **Mở Pull Request (PR):**
   * Sau khi code xong và chạy `npm run build` không báo lỗi, push nhánh lên repo:
     ```bash
     git push -u origin <tên-nhánh-của-bạn>
     ```
   * Mở Pull Request trên GitHub hướng về `master`, gắn tag Leader (`@PhanThanhTung`) để review và merge.

---

## 3. PHÂN CÔNG CHI TIẾT THEO TỪNG THÀNH VIÊN

Leader đã khởi tạo sẵn bộ khung 13 trang màn hình (`src/pages/`), các lớp dịch vụ (`src/services/`) và bảng mẫu Use Case. Mỗi bạn mở đúng file được phân công để làm việc:

### 👤 1. TV1 – Trương Bích Vân (BA/QA Lead & Full-stack Dev)
* **Tài liệu & Sơ đồ (Trọng tâm):**
  * Dùng **draw.io** vẽ: **1 Sơ đồ Use Case tổng quát** + **4 Sơ đồ Use Case phân rã chi tiết** (lưu file `.drawio` vào thư mục `docs/use-cases/`).
  * Viết đặc tả 8 Use Case: **UC01, UC02, UC03, UC04, UC05, UC22, UC23, UC26** theo biểu mẫu chuẩn `docs/use-cases/TEMPLATE_USE_CASE.md`.
  * Lập bảng Test Plan (40–50 test cases) và chủ biên ghép nối tài liệu thuyết minh.
* **Lập trình (Giao diện & Dịch vụ):**
  * Nhánh làm việc: `feature/auth-goal-tv1`
  * Trang phụ trách: `src/pages/LoginPage.jsx`, `RegisterPage.jsx`, `ProfilePage.jsx`, `GoalPage.jsx`, `BillSplitVietQR.jsx`.
  * Dịch vụ phụ trách: `src/services/authService.js`, `goalService.js`, `vietqrService.js`.

---

### 👤 2. TV2 – Hồ Nguyên Văn (Frontend Lead & UI/PWA Dev)
* **Tài liệu & Thiết kế:**
  * Vẽ Wireframe các trang chính (Dashboard, Ngân sách, Báo cáo) trên Figma hoặc draw.io.
  * Viết đặc tả 4 Use Case: **UC14, UC15, UC16, UC17** theo `docs/use-cases/TEMPLATE_USE_CASE.md`.
* **Lập trình (Giao diện & Dịch vụ):**
  * Nhánh làm việc: `feature/dashboard-reports-tv2`
  * Trang phụ trách: `src/pages/DashboardPage.jsx`, `BudgetPage.jsx`, `ReportPage.jsx`.
  * Dịch vụ phụ trách: `src/services/budgetService.js`, `reportService.js` (tích hợp biểu đồ Chart.js).
  * Kiểm tra và hoàn thiện cấu hình PWA: `public/manifest.json`, `public/sw.js`.

---

### 👤 3. TV3 – Nguyễn Vũ Tấn Huy (Full-stack Dev 1 - Core Data)
* **Tài liệu Lõi:**
  * Đặc tả 8 Use Case dữ liệu lõi: **UC06, UC07, UC08, UC09, UC10, UC11, UC12, UC13** theo `docs/use-cases/TEMPLATE_USE_CASE.md`.
  * Liệt kê các thuộc tính và phương thức các thực thể Ví, Danh mục, Giao dịch để gửi TV4 đưa vào Class Diagram.
* **Lập trình (Giao diện & Dịch vụ):**
  * Nhánh làm việc: `feature/wallets-txns-tv3`
  * Trang phụ trách: `src/pages/WalletPage.jsx`, `CategoryPage.jsx`, `TransactionPage.jsx` (cùng các modal Thêm/Sửa/Xóa).
  * Dịch vụ phụ trách: `src/services/walletService.js`, `categoryService.js`, `transactionService.js` (tìm kiếm `note_unaccent`, xuất CSV).

---

### 👤 4. TV4 – Lê Hoài Quốc (Full-stack Dev 2 - Smart & Auto)
* **Tài liệu & Sơ đồ:**
  * Dùng **draw.io** vẽ **Class Diagram tổng hợp** (8 Entity Supabase + các Service class).
  * Đặc tả 5 Use Case: **UC18, UC19, UC20, UC24, UC25** theo `docs/use-cases/TEMPLATE_USE_CASE.md`.
* **Lập trình (Giao diện & Dịch vụ):**
  * Nhánh làm việc: `feature/smart-features-tv4`
  * Trang phụ trách: Ô nhập nhanh câu tự nhiên & modal Preview trên `DashboardPage.jsx`, thẻ `<SafeToSpendCard/>`, trang `src/pages/RecurringPage.jsx`, chuông thông báo trên `Navbar.jsx`.
  * Dịch vụ phụ trách: `src/services/quickEntryParser.js`, `safeToSpendService.js`, `recurringService.js`, `notificationService.js`.

---

### 👤 5. Leader – Phan Thanh Tùng (Project Manager & AI/DB Lead)
* **Tài liệu:** Thuyết minh Chương 1 (Giới thiệu), Chương 4 (Kiến trúc hệ thống, ERD), Đặc tả Use Case **UC21** (Trợ lý AI Gemini).
* **Lập trình:** `src/services/aiAssistantService.js`, `src/components/ai/AiChatWidget.jsx`.
* **Quản trị:** Điều phối họp Sprint ngắn, review & merge Pull Request từ 4 thành viên.

---

## 4. BẢNG MẪU & TÀI LIỆU CẦN ĐỌC TRƯỚC KHI CODE

| Tên tài liệu | Đường dẫn file | Mục đích sử dụng |
| :--- | :--- | :--- |
| **Quy trình Git & Commit** | `docs/git/WORKFLOW.md` | Hướng dẫn tạo nhánh, commit và mở PR |
| **Bảng tra cứu 26 Use Case** | `docs/use-cases/UC_INDEX_AND_ASSIGNMENT.md` | Tra cứu mã UC tương ứng với từng file Page/Service |
| **Mẫu viết đặc tả Use Case** | `docs/use-cases/TEMPLATE_USE_CASE.md` | Mẫu chuẩn bắt buộc khi viết mô tả Use Case |
| **Kiến trúc hệ thống & ERD** | `docs/architecture/ARCHITECTURE.md` | Xem sơ đồ 3 tầng và mô hình 8 bảng dữ liệu |
| **Kế hoạch 2 Sprint (Excel)** | `docs/sprints/` | Chi tiết phân công công việc, thời gian và mốc bàn giao |
| **Script Dữ liệu Mẫu (Seed)** | `supabase/seed_demo_data.sql` | Dữ liệu test có sẵn ví, giao dịch, ngân sách |

---

## 5. ĐỊNH NGHĨA HOÀN THÀNH (DEFINITION OF DONE - DOD)
Trước khi gửi link PR cho Leader duyệt, thành viên tự kiểm tra:
- [ ] Giao diện hiển thị chuẩn tiếng Việt 100%, không lỗi font hay vỡ layout trên mobile.
- [ ] Đã xử lý các trường hợp ngoại lệ (validate số tiền > 0, bắt lỗi khi mất mạng).
- [ ] Chạy lệnh `npm run build` ở terminal máy mình ra kết quả `✓ built in ...s` màu xanh không lỗi.
- [ ] Không có file thừa hoặc file cấu hình cá nhân bị commit nhầm.
