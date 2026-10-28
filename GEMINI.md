# SPENDWISE – KNOWLEDGE BASE & CORE MEMORY (BỘ NÃO DỰ ÁN)

> **Mục đích:** File này lưu trữ toàn bộ kiến thức cốt lõi của dự án SpendWise. Mọi phiên chat mới của AI Agent (Antigravity) sẽ tự động nạp file này vào ngữ cảnh làm việc mà không cần rà soát lại tài liệu từ đầu.

---

## 1. THÔNG TIN DỰ ÁN & NHÂN SỰ CHÍNH THỨC
- **Tên dự án:** SpendWise – Hệ thống quản lý chi tiêu cá nhân thông minh.
- **Loại ứng dụng:** Web App Responsive (Mobile-First) + PWA cơ bản.
- **Ngôn ngữ 100%:** Tiếng Việt (UI, thông báo, tài liệu thuyết minh, comment code).
- **Phân công 5 thành viên chính thức (Theo Bảng phân công chuẩn):**
  1. `Leader` – **Phan Thanh Tùng** (Project Manager & AI/DB Lead):
     - *Nhiệm vụ Quản lý & Kiến trúc:* Khởi tạo repo Vite + React + Tailwind + dependencies; Khởi tạo Supabase DB 8 bảng + RLS; cấu hình `src/lib/supabaseClient.js`; Thuyết minh Chương 1 (Giới thiệu), Chương 4 (Kiến trúc) và mô hình ERD; Điều phối họp sprint & Review/Merge PR.
     - *Nhiệm vụ Tính năng AI:* Viết `src/services/aiAssistantService.js` (tổng hợp context tài chính & gọi Gemini API); Code component `AiChatWidget.jsx` (khung chat & 4 quick reply chips); Đặc tả Use Case **UC21** (Chat trợ lý AI Gemini).
  2. `TV1` – **Trương Bích Vân** (Full-stack Dev & BA/QA Lead):
     - *Nhiệm vụ Tài liệu & QA:* Vẽ file draw.io (1 sơ đồ Use Case tổng quát + 4 sơ đồ phân rã chi tiết); Đặc tả 8 Use Case (**UC01–UC05, UC22, UC23, UC26**); Chủ biên ghép nối, chuẩn hóa thuyết minh; Lập Test Plan & 40–50 test cases.
     - *Nhiệm vụ Lập trình:* Viết `src/services/authService.js`, `src/services/vietqrService.js`, `src/services/goalService.js`; Code các page: `LoginPage.jsx`, `RegisterPage.jsx`, `ProfilePage.jsx`, `BillSplitVietQR.jsx`, `GoalPage.jsx`.
  3. `TV2` – **Hồ Nguyên Văn** (Frontend Lead & UI/PWA Dev):
     - *Nhiệm vụ Thiết kế UI & Khung:* Vẽ Wireframe các trang chính (Figma/draw.io); Đặc tả 4 Use Case (**UC14–UC17**); Cấu hình Tailwind theme, `AppLayout.jsx` (Sidebar, Navbar, Theme Dark/Light), Router.
     - *Nhiệm vụ Lập trình & Báo cáo:* Viết `src/services/budgetService.js`, `src/services/reportService.js`; Code `DashboardPage.jsx`, `BudgetPage.jsx`, `ReportPage.jsx` (tích hợp Chart.js); Cấu hình PWA (`manifest.json`, `sw.js`).
  4. `TV3` – **Nguyễn Vũ Tấn Huy** (Full-stack Dev 1 - Core Data):
     - *Nhiệm vụ Tài liệu Lõi:* Đặc tả 8 Use Case (**UC06–UC13** về Ví, Danh mục, Giao dịch); Đóng góp thuộc tính/phương thức cho Class Diagram; Mô tả chi tiết luồng nghiệp vụ dữ liệu lõi.
     - *Nhiệm vụ Lập trình:* Viết `src/services/walletService.js`, `src/services/categoryService.js`, `src/services/transactionService.js` (chuyển ví nội bộ, tìm kiếm `note_unaccent`, phân trang, xuất CSV); Code `WalletPage.jsx`, `CategoryPage.jsx`, `TransactionPage.jsx` cùng các modal Thêm/Sửa/Xóa.
  5. `TV4` – **Lê Hoài Quốc** (Full-stack Dev 2 - Smart & Auto):
     - *Nhiệm vụ Sơ đồ lớp & Tài liệu Smart:* Vẽ Class Diagram tổng hợp bằng draw.io (8 Entity + các lớp Service); Đặc tả 5 Use Case (**UC18, UC19, UC20, UC24, UC25**).
     - *Nhiệm vụ Lập trình:* Viết `src/services/quickEntryParser.js` (bóc tách câu tự nhiên); Viết `src/services/safeToSpendService.js` (công thức Safe-to-spend); Viết logic giao dịch định kỳ (`recurring_rules`) và thông báo hệ thống; Code ô nhập nhanh & modal Preview, component `<SafeToSpendCard/>`, trang Định kỳ và chuông thông báo.

---

## 2. BẢNG CHỈ MỤC 26 USE CASES CHÍNH THỨC (USE CASE INDEX)

| Mã UC | Tên Use Case | Nhóm chức năng (#) | Thành viên phụ trách |
| :---: | :--- | :--- | :---: |
| **UC01** | Đăng ký tài khoản | AUTH (1) | TV1 (Trương Bích Vân) |
| **UC02** | Đăng nhập | AUTH (1) | TV1 (Trương Bích Vân) |
| **UC03** | Đăng xuất | AUTH (1) | TV1 (Trương Bích Vân) |
| **UC04** | Quên & đổi mật khẩu | AUTH (1) | TV1 (Trương Bích Vân) |
| **UC05** | Cập nhật hồ sơ cá nhân | AUTH (1) | TV1 (Trương Bích Vân) |
| **UC06** | Thêm ví | WALLET (2) | TV3 (Nguyễn Vũ Tấn Huy) |
| **UC07** | Sửa ví | WALLET (2) | TV3 (Nguyễn Vũ Tấn Huy) |
| **UC08** | Xóa / Ẩn ví | WALLET (2) | TV3 (Nguyễn Vũ Tấn Huy) |
| **UC09** | Chuyển tiền nội bộ giữa các ví | WALLET (2) | TV3 (Nguyễn Vũ Tấn Huy) |
| **UC10** | Thêm danh mục tùy chỉnh | CAT (3) | TV3 (Nguyễn Vũ Tấn Huy) |
| **UC11** | Sửa / Xóa danh mục | CAT (3) | TV3 (Nguyễn Vũ Tấn Huy) |
| **UC12** | Thêm giao dịch thu/chi | TXN (4) | TV3 (Nguyễn Vũ Tấn Huy) |
| **UC13** | Sửa / Xóa giao dịch; Tìm kiếm; Xuất CSV | TXN (4) | TV3 (Nguyễn Vũ Tấn Huy) |
| **UC14** | Đặt ngân sách tháng | BUDGET (5) | TV2 (Hồ Nguyên Văn) |
| **UC15** | Xem tiến độ ngân sách | BUDGET (5) | TV2 (Hồ Nguyên Văn) |
| **UC16** | Xem Dashboard tổng quan | DASH (6) | TV2 (Hồ Nguyên Văn) |
| **UC17** | Xem báo cáo tài chính | REPORT (7) | TV2 (Hồ Nguyên Văn) |
| **UC18** | Nhập nhanh bằng câu tự nhiên (Quick Entry) | QUICK (8) | TV4 (Lê Hoài Quốc) |
| **UC19** | Xem Preview & xác nhận giao dịch | QUICK (8) | TV4 (Lê Hoài Quốc) |
| **UC20** | Xem chỉ số Safe-to-spend hôm nay | STS (9) | TV4 (Lê Hoài Quốc) |
| **UC21** | Chat với trợ lý AI Gemini | AIBOT (10) | Leader (Phan Thanh Tùng) |
| **UC22** | Tạo mục tiêu tiết kiệm | GOAL_REC (11) | TV1 (Trương Bích Vân) |
| **UC23** | Nạp tiền vào mục tiêu tiết kiệm | GOAL_REC (11) | TV1 (Trương Bích Vân) |
| **UC24** | Tạo giao dịch định kỳ | GOAL_REC (11) | TV4 (Lê Hoài Quốc) |
| **UC25** | Xem thông báo trong ứng dụng | NOTI_QR (12) | TV4 (Lê Hoài Quốc) |
| **UC26** | Chia hóa đơn & tạo VietQR | NOTI_QR (12) | TV1 (Trương Bích Vân) |

---

## 3. KIẾN TRÚC KỸ THUẬT & TECH STACK
- **Kiến trúc 3 tầng (Layered Architecture):**
  1. `Presentation Layer`: React 19 + Tailwind CSS + Lucide Icons + Chart.js.
  2. `Service Layer` (`src/services/`): Xử lý logic thuần túy độc lập với UI.
  3. `Data Layer`: Supabase (PostgreSQL 15 + Row Level Security trên 100% các bảng).
- **Biến môi trường (`.env`):**
  - `VITE_SUPABASE_URL`: URL kết nối Supabase (`https://ndeohlqneywsducsyqsb.supabase.co`).
  - `VITE_SUPABASE_ANON_KEY`: Publishable Anon Key.
  - `VITE_GEMINI_API_KEY`: API Key của Google Gemini.

---

## 4. CƠ SỞ DỮ LIỆU (8 BẢNG ĐÃ TRIỂN KHAI TRÊN SUPABASE)
1. `profiles`: Thông tin người dùng (`id` = `auth.users.id`, `default_bank_bin`, `default_bank_account`).
2. `wallets`: Ví tiền (`cash`, `bank`, `ewallet`), quản lý `balance`.
3. `categories`: Danh mục (`income`, `expense`), mảng từ khóa `keywords` cho Parser.
4. `transactions`: Giao dịch thu/chi/chuyển tiền (`amount`, `type`, `wallet_id`, `to_wallet_id`, `category_id`, `note_unaccent`).
5. `budgets`: Hạn mức chi tiêu tháng theo danh mục (`month`, `amount`).
6. `saving_goals`: Mục tiêu tiết kiệm (`target_amount`, `current_amount`, `target_date`).
7. `recurring_rules`: Khoản thu/chi định kỳ lặp lại (`frequency`, `day_of_month`, `next_due_date`).
8. `notifications`: Thông báo hệ thống (`type`, `title`, `message`, `is_read`).

---

## 5. BỘ 3 TÍNH NĂNG CỐT LÕI (CORE ALGORITHMS)

### 5.1. Nhập nhanh câu tự nhiên (`src/services/quickEntryParser.js`)
- **Input:** Chuỗi tự nhiên (VD: `"cafe 35k hôm qua momo"`).
- **Thuật toán Rule-based:**
  - `amount`: Regex `(\d+)k`, `(\d+)tr(\d+)`, `(\d+(?:\.\d+)?)tr`, số nguyên.
  - `date`: `hôm nay` ($T$), `hôm qua` ($T-1$), `hôm kia` ($T-2$), `dd/mm`.
  - `wallet`: So khớp từ khóa ví (`momo`, `vcb`, `tiền mặt`,...).
  - `type`: Từ khóa thu nhập (`lương`, `thưởng`, `nhận`) $\rightarrow$ `income`; mặc định `expense`.
  - `category`: So khớp mảng `keywords` không dấu (`cafe` $\rightarrow$ Ăn uống).
- **Nguyên tắc an toàn:** Luôn mở Preview xác nhận, trường chưa nhận diện được đánh dấu viền vàng, tuyệt đối không tự đoán.

### 5.2. Công thức Safe-to-spend (`src/services/safeToSpendService.js`)
$$\text{SafeToSpend} = \max\left(0, \frac{\text{RemainingBudget} - \text{UpcomingRecurring}}{\text{DaysLeft}}\right)$$
- `RemainingBudget`: Ngân sách tháng còn lại = Tổng hạn mức - Tổng đã chi.
- `UpcomingRecurring`: Tổng chi phí định kỳ active có `next_due_date` từ hôm nay đến cuối tháng.
- `DaysLeft`: Số ngày còn lại trong tháng (tính cả hôm nay, $\ge 1$).

### 5.3. Trợ lý AI Gemini (`src/services/aiAssistantService.js`)
- Áp dụng kỹ thuật **Context-Stuffing**: Đóng gói JSON ngắn gọn (Dư ví, SafeToSpend hôm nay, Ngân sách tháng, Giao dịch trong tháng) đưa vào `systemInstruction`.
- UI Chat luôn có sẵn **4 Quick Reply Chips** để demo mượt mà không lỗi gõ.

---

## 6. BẢNG THUẬT NGỮ CHUẨN (GLOSSARY)
BẮT BUỘC dùng thống nhất khi đặt tên code và hiển thị giao diện:
- `User` / `Profile` (Người dùng)
- `Wallet` (Ví) – *Không dùng: Thẻ, Nguồn tiền, Tài khoản*.
- `Category` (Danh mục) – *Không dùng: Hạng mục, Loại giao dịch*.
- `Transaction` (Giao dịch)
- `Transfer` (Chuyển tiền nội bộ giữa 2 ví, `to_wallet_id`) – *Không tính vào tổng Thu/Chi*.
- `Budget` (Ngân sách) – *3 mức: An toàn <80%, Sắp vượt 80-99%, Đã vượt >=100%*.
- `SafeToSpend` (Số tiền an toàn có thể tiêu hôm nay).
- `SavingGoal` (Mục tiêu tiết kiệm).
- `RecurringRule` (Giao dịch định kỳ).

---

## 7. PHẠM VI 12 CHỨC NĂNG (ĐÃ KHÓA – KHÔNG TỰ THÊM TÍNH NĂNG MỚI)
1. `AUTH`: Xác thực Supabase Auth (Đăng ký, Đăng nhập, Quên mật khẩu, Profile).
2. `WALLET`: Quản lý ví, số dư, chuyển tiền nội bộ.
3. `CAT`: Danh mục hệ thống & tự tạo kèm từ khóa.
4. `TXN`: CRUD giao dịch, lọc, phân trang, tìm kiếm không dấu, xuất CSV.
5. `BUDGET`: Ngân sách tháng & thanh tiến độ 3 màu.
6. `DASH`: Dashboard tổng quan, thẻ Safe-to-spend, biểu đồ danh mục, 5 giao dịch gần nhất.
7. `REPORT`: Biểu đồ cột thu/chi theo kỳ, biểu đồ tròn danh mục, so sánh kỳ liền kề.
8. `QUICK`: Nhập nhanh câu tự nhiên kèm form Preview.
9. `STS`: Thẻ Safe-to-spend độc bản & chi tiết tính toán.
10. `AIBOT`: Chatbot tra cứu & tư vấn chi tiêu qua Gemini API.
11. `GOAL_REC`: Mục tiêu tiết kiệm & Giao dịch định kỳ tự động.
12. `NOTI_QR`: Cảnh báo ngân sách & tiện ích VietQR chia tiền (Bill Split).
*LƯU Ý:* **CẤM** tự thêm Offline Sync phức tạp, Đa ngôn ngữ (i18n), Nhập CSV ngân hàng.

---

## 8. QUY CHUẨN THIẾT KẾ UI/UX (Awwwards / Apple-tier)
- **Typography:** `Plus Jakarta Sans` (Nội dung) + `Outfit` (Số tiền & Tiêu đề).
- **Cấu trúc thẻ Double-Bezel:** Vỏ ngoài bo tròn lớn `rounded-[2rem]` + Lõi trong bo đồng tâm `rounded-[calc(2rem-0.375rem)]`.
- **Navigation:** Floating Island Navbar trên Desktop + Floating Dock ở đáy màn hình Mobile.
- **Nút bấm:** Pill-shaped `rounded-full` với Button-in-Button trailing icon.

---

## 9. QUY CHUẨN VẬN HÀNH BẮT BUỘC CHO AI AGENT (MANDATORY OPERATIONAL PROTOCOL)
Mỗi phiên làm việc, Agent PHẢI tuân thủ 5 nguyên tắc hành động sau như một phản xạ mặc định:

1. **🤖 Tự động kiểm thử & Quay video nghiệm thu (Browser Subagent):**
   - Bất cứ khi nào hoàn thiện hoặc sửa đổi một tính năng/màn hình UI, Agent PHẢI tự động khởi chạy `browser_subagent` để truy cập ứng dụng (`localhost`), thao tác click/nhập thử, kiểm tra responsive mobile/desktop và ghi lại video clip nghiệm thu (`.webp`) minh chứng tính năng hoạt động hoàn hảo trước khi bàn giao.
2. **📐 Lập kế hoạch chi tiết trước khi code (`/plan`):**
   - Với mọi tác vụ có độ phức tạp từ trung bình trở lên (sửa đổi kiến trúc, thêm luồng nghiệp vụ, thay đổi DB/Service), Agent BẮT BUỘC phải lập kế hoạch step-by-step rõ ràng (Checklist/Artifact) để hình dung toàn bộ quy trình trước khi can thiệp vào mã nguồn. Tuyệt đối không code hấp tấp.
3. **🔥 Chủ động phản biện & rà soát trường hợp biên (`/grill-me`):**
   - Đóng vai trò Senior Architect/Tech Lead: Trước khi thực thi một yêu cầu mới, chủ động rà soát, phản biện và chất vấn các lỗ hổng logic, xung đột dữ liệu, trường hợp biên (edge cases) hoặc trải nghiệm người dùng chưa hợp lý thay vì thụ động làm theo ngay.
4. **🎛️ Thu thập ý kiến qua Hộp thoại Trắc nghiệm tương tác (`ask_question`):**
   - Khi đứng trước các ngã rẽ có từ 2 phương án trở lên (chọn thư viện, lựa chọn layout, bảng màu, hướng xử lý logic), BẮT BUỘC gọi công cụ `ask_question` để mở Modal tương tác trực tiếp (Radio/Checkbox) cho User bấm chọn nhanh, không hỏi văn bản dài dòng trôi nổi trong hội thoại.
5. **💎 Triệt tiêu AI-Slop, tuân thủ thẩm mỹ cao cấp (Anti-AI Slop Design):**
   - Áp dụng nghiêm ngặt các tiêu chuẩn từ `taste-skill` và `high-end-visual-design`: Tuyệt đối không dùng màu sắc mặc định thô thiển; chuẩn hóa Typography (`Plus Jakarta Sans` + `Outfit`); áp dụng cấu trúc thẻ Double-Bezel (`rounded-[2rem]` bọc `rounded-[calc(2rem-0.375rem)]`); trau chuốt micro-animations, hiệu ứng hover/focus có chiều sâu; đảm bảo giao diện luôn đạt chuẩn Awwwards/Apple-tier.

