# BIÊN BẢN GIAO VIỆC SỬA LỖI & NÂNG CẤP CHẤT LƯỢNG DỰ ÁN
**Dự án:** SpendWise – Quản lý chi tiêu cá nhân thông minh  
**Người lập biên bản:** Leader – Phan Thanh Tùng (Project Manager & AI/DB Lead)  
**Ngày cập nhật:** 15/11/2026 (Rà soát & chuẩn hóa lại từ bản 03/11/2026)  
**Căn cứ tài liệu & kiểm định thực tế:**
- [UC_INDEX_AND_ASSIGNMENT.md](../use-cases/UC_INDEX_AND_ASSIGNMENT.md)
- [WORKFLOW.md](../git/WORKFLOW.md)
- **Kết quả kiểm định mã nguồn & chạy thử nghiệm ngày 14–15/11/2026 (commit `55e8009` trên `main` / `develop`):**
  - `npm run lint` (`oxlint`): `exit 0` — **0 lỗi, còn 56 cảnh báo** (`33 no-unused-vars`, `8 set-state-in-effect`, `7 purity`, `4 no-useless-escape`, `2 exhaustive-deps`, `1 immutability`, `1 only-export-components`).
  - `npm run build` (`vite build` v8.3.4): `exit 0` — bundle JS đơn khối **863.11 kB** (`gzip: 248.59 kB`, có cảnh báo chunk > 500 kB).
  - Kiểm thử hàm thuần (`Node v24.20.0`) & dispatch trực tiếp Express API routes (`server/routes/*.js`).
  - Rà soát trạng thái Git, cấu trúc Supabase SQL (`supabase/*.sql`) và toàn bộ 26 Use Case.

---

## I. MỤC ĐÍCH & NGUYÊN TẮC THỰC HIỆN
1. **Minh bạch hiện trạng & phân đúng trách nhiệm (Không bỏ sót lỗi nền tảng):**
   - Bản biên bản ngày 03/11/2026 trước đây ghi nhận chưa đầy đủ thực trạng (chưa phản ánh phần việc Leader còn lỗ hổng bảo mật/DB/CI, chưa liệt kê UC04 bị thiếu hoàn toàn, lỗi mất tiền non-atomic ở `depositToGoal`/`transferFunds`, lỗi `handleQuickSave` ghi nhầm ví/danh mục đầu tiên, và chưa có test tự động trong repo).
   - Toàn bộ thành viên (**Leader, TV1, TV2, TV3**) cùng chịu trách nhiệm khắc phục dứt điểm các hạng mục **P0 (Chặn nghiệp vụ / Bảo mật / Sai lệch tiền tệ)**, **P1 (Kiến trúc / Đồng bộ FE–BE / Trải nghiệm người dùng)** và **P2 (QA/CI, Lint, Chuẩn UI Double-Bezel)**.
2. **Quy trình Git & Pull Request bắt buộc (Đã đồng bộ tên nhánh với `WORKFLOW.md`, `README.md`, `HUONG_DAN_LAM_VIEC.md`):**
   - Mỗi thành viên tách đúng nhánh `feature/*` từ nhánh **`develop`** theo Bảng Mục II.
   - Tuyệt đối **không push trực tiếp lên `main` và `develop`** (Branch Protection).
   - Mọi đóng góp bắt buộc mở Pull Request trỏ vào **`develop`** (`Base: develop <- Compare: feature/<ten-nhanh>`).
   - Chạy `npm run lint` và `npm run build` (cùng test tự động sau khi thiết lập Vitest) đạt kết quả xanh trước khi mở PR.

---

## II. BẢNG PHÂN CÔNG SỬA LỖI & HOÀN THIỆN THEO THÀNH VIÊN

| Thành viên | Nhóm Use Case / Phạm vi | Tên nhánh Git quy chuẩn | Tệp cần xử lý chính | Mức độ ưu tiên |
| :--- | :--- | :--- | :--- | :---: |
| **Leader – Phan Thanh Tùng** | Bảo mật, Backend API, AI (**UC21**), DB RPC, CI/CD & Git | `feature/security-infra-lead`<br>`feature/ai-assistant-lead` | `.env.example`, `server/.env.example`, `server/server.js`, `server/package.json`, `server/routes/aiRoutes.js`, `server/routes/financeRoutes.js`, `src/lib/geminiClient.js`, `src/services/aiAssistantService.js`, `src/components/ai/AiChatWidget.jsx`, `supabase/*.sql`, `.github/workflows/ci.yml` | 🔴 **P0** (Lộ API key, mở API không Auth, thiếu RPC/CI) |
| **TV1 – Trương Bích Vân** | AUTH (**UC01–UC05**), Goals (**UC22–UC23**), VietQR (**UC26**), QA Plan | `feature/auth-goal-tv1`<br>`feature/vietqr-tv1` | `src/services/authService.js`, `src/context/AuthContext.jsx`, `src/App.jsx`, `src/pages/LoginPage.jsx`, `src/pages/RegisterPage.jsx`, `src/pages/ProfilePage.jsx`, `src/pages/ResetPasswordPage.jsx` *(mới)*, `src/services/goalService.js`, `src/pages/GoalPage.jsx`, `src/services/vietqrService.js`, `src/pages/BillSplitVietQR.jsx` | 🔴 **P0** (Lỗi `profiles`, mất UC04, non-atomic nạp mục tiêu) |
| **TV2 – Hồ Nguyên Văn** | Layout/Navbar, Dashboard (**UC16**), Budget (**UC14–15**), Report (**UC17**), PWA | `feature/dashboard-reports-tv2`<br>`feature/budget-tv2` | `src/components/layout/Navbar.jsx`, `src/components/layout/BottomNav.jsx`, `src/components/layout/AppLayout.jsx`, `src/pages/DashboardPage.jsx`, `src/pages/BudgetPage.jsx`, `src/pages/ReportPage.jsx`, `src/services/budgetService.js`, `src/services/reportService.js`, `public/sw.js`, `public/manifest.json`, `index.html` | 🔴 **P0** (Sai dữ liệu Quick Entry save, mất menu Mobile/Danh mục) |
| **Nhóm tiếp quản (Leader & TV3 Quốc)** | Core Data: Wallet (**UC06–09**), Category (**UC10–11**), Transaction (**UC12–13**) | `feature/core-data-lead` | `src/pages/WalletPage.jsx`, `src/pages/CategoryPage.jsx`, `src/pages/TransactionPage.jsx`, `src/services/walletService.js`, `src/services/categoryService.js`, `src/services/transactionService.js` | 🔴 **P0** (Thiếu Modal Sửa, lệch số dư ví khi sửa/xóa `transfer`) |
| **TV3 – Lê Hoài Quốc** | Smart Parser (**UC18–19**), Safe-to-spend (**UC20**), Recurring (**UC24**), Notifications (**UC25**) | `feature/smart-features-tv3`<br>`feature/recurring-tv3` | `src/services/quickEntryParser.js`, `server/routes/quickEntryRoutes.js`, `src/services/safeToSpendService.js`, `src/services/recurringService.js`, `src/pages/RecurringPage.jsx`, `src/services/notificationService.js`, `src/components/layout/Navbar.jsx` *(phần chuông UC25)* | 🔴 **P0** (Sai Parser FE/BE, crash RPC `PGRST202`, thiếu Chuông UC25) |

> **Lưu ý tránh xung đột file:** `Navbar.jsx` có 2 phần việc tách biệt — TV2 phụ trách link điều hướng `/categories` + active route + toggle Dark/Light; TV3 chỉ gắn component `<NotificationBell />` tách riêng (`src/components/layout/NotificationBell.jsx`) vào vị trí nút thông báo trên `Navbar.jsx` sau khi TV2 merge hoặc phối hợp qua PR riêng.

---

## III. HƯỚNG DẪN KỸ THUẬT CHI TIẾT TỪNG THÀNH VIÊN

### 1. Leader – Phan Thanh Tùng (Bảo mật, Backend, AI, DB & QA/CI)
- **Hiện trạng phát hiện qua kiểm định (Khắc phục nhận định sai của bản cũ):**
  1. **[P0] Lộ `VITE_GEMINI_API_KEY` ra JS Bundle Client:** Dù `server/README.md` cam kết giữ key ở Backend, `src/lib/geminiClient.js` (`L3`) vẫn đọc `VITE_GEMINI_API_KEY` và `src/services/aiAssistantService.js` (`L132-164`) fallback gọi Gemini SDK ngay trên trình duyệt. Ngoài ra `server/.env.example` và `server/routes/aiRoutes.js` (`L98`) cũng dùng tên biến `VITE_GEMINI_API_KEY`.
  2. **[P0] Backend Express mở không Auth & thiếu Rate Limit:** `server/server.js` và các router `/api/ai/chat`, `/api/quick-entry/parse`, `/api/finance/safe-to-spend` chưa xác thực Supabase JWT, không rate limiting, đặt `express.json({ limit: '10mb' })`, và hardcode CORS `localhost:5173`.
  3. **[P0] Thiếu RPC & Bất nhất SQL Schema trong `supabase/`:**
     - `supabase/init_schema.sql` chỉ có 2 Views (`v_monthly_summary`, `v_budget_progress`) và 2 Triggers, **chưa có bất kỳ hàm RPC nào**; hàm `generate_due_recurring_transactions` mà `recurringService.js` (`L298`) gọi hoàn toàn chưa có file SQL trong `supabase/`.
     - `handle_new_user()` (`init_schema.sql:184-217`) là `SECURITY DEFINER` nhưng thiếu `SET search_path = ''`, thiếu `ON CONFLICT (id) DO NOTHING` và thiếu lệnh backfill cho user cũ.
     - `recurring_rules.category_id` (`init_schema.sql:118`) đang là `ON DELETE CASCADE` (trái đặc tả `UC11.md`: `ON DELETE RESTRICT`); `recurring_rules.frequency` (`L122`) thiếu `'daily'` trong khi `RecurringPage.jsx` (`L452`) cho chọn `'daily'`.
     - `notification_service_migration.sql` (`L117`) chỉ ghi `'budget_warning'` kể cả khi ngân sách `>= 100%` thay vì `'budget_exceeded'`.
  4. **[P0] Không có Test tự động & CI/CD thực tế:** Repo hiện có **0 file test** (trái ghi chú "20/20 test cases" cũ) và chưa có `.github/workflows/ci.yml`.
  5. **[P1] Lỗi AI & Cấu hình Server:**
     - `aiRoutes.js` (`L146-155`) nuốt lỗi Gemini API và trả HTTP `200 OK` bằng câu trả lời `if/else` giả lập; model `'gemini-1.5-flash'` hardcode; `aiAssistantService.js` (`L110`) hardcode `http://localhost:5000` (bỏ qua `VITE_API_BASE_URL`), `buildFinancialContext` (`L31, L57-68`) dùng UTC date, chỉ lấy 25 giao dịch nhưng prompt lại nói "TOÀN BỘ dữ liệu" và không check Supabase `error`.
     - `server/server.js` (`L8-9`) khi chạy từ root (`npm run server`) không load `server/.env`; `server/package.json` lệch `express@^4.21.2` so với root `express@^5.3.0` và cài thừa `@supabase/supabase-js`; `app.listen()` chạy thẳng ở top-level nên không import test Supertest được.
     - `financeRoutes.js` (`L14`) kẹp `Math.max(0, Number(remainingBudget) || 0)` làm mất trường hợp âm và vẫn trả `200 OK` cho input lỗi (`daysLeft <= 0` hoặc chuỗi không hợp lệ).
- **Yêu cầu kỹ thuật:**
  1. **Bảo mật AI & Backend:**
     - Xóa bỏ fallback gọi Gemini SDK trên trình duyệt ở `src/lib/geminiClient.js` và `src/services/aiAssistantService.js`; xóa `VITE_GEMINI_API_KEY` khỏi root `.env.example` và `README.md`/`HUONG_DAN_LAM_VIEC.md`, chỉ dùng `GEMINI_API_KEY` ở `server/.env`.
     - Thêm middleware xác thực Supabase JWT (`Authorization: Bearer <token>`), rate limiter (ví dụ `express-rate-limit`), giảm `express.json({ limit: '100kb' })`, cấu hình `CORS_ORIGIN` và `GEMINI_MODEL` qua biến môi trường.
     - Tách `createApp()` ở `server/app.js` khỏi `app.listen()` ở `server/server.js`; load tường minh `server/.env` bằng `path.resolve(__dirname, '.env')`; đồng bộ `express@^5` và xóa `@supabase/supabase-js` thừa trong `server/package.json`.
  2. **Đồng bộ AI & Finance API (`UC21`, `UC20`):**
     - `aiAssistantService.js`: dùng `VITE_API_BASE_URL`, sửa `buildFinancialContext` lấy local date (`YYYY-MM-DD`), kiểm tra `error` Supabase, tổng hợp đủ dữ liệu tháng thay vì cắt 25 dòng.
     - `aiRoutes.js`: trả đúng HTTP error status (`502`/`503`) hoặc cờ cảnh báo rõ ràng khi Gemini lỗi, không âm thầm trả `200` giả mạo AI. `AiChatWidget.jsx`: render Markdown an toàn, hỗ trợ đóng bằng `Escape`/backdrop và `role="dialog"`.
     - `financeRoutes.js`: tái sử dụng logic `validateSafeToSpendInput` + `buildSafeToSpendData` (trả HTTP `400` khi input sai, giữ nguyên `remainingBudget` âm trước khi tính `max(0, ...)`).
  3. **Database Supabase Migrations & Atomic RPC (`supabase/migrations/`):**
     - Bổ sung SQL RPC `generate_due_recurring_transactions()`, RPC atomic cho `deposit_to_goal(p_goal_id, p_wallet_id, p_amount)` và `transfer_funds(p_from_wallet_id, p_to_wallet_id, p_amount, p_note, p_date)`.
     - Sửa `handle_new_user()` thêm `SET search_path = ''`, `ON CONFLICT (id) DO NOTHING`, kèm script backfill user cũ.
     - Chuẩn hóa `recurring_rules.category_id` sang `ON DELETE RESTRICT`, đồng bộ `frequency` với UI, và sửa `notification_service_migration.sql` phân biệt `'budget_warning'` (80–99%) vs `'budget_exceeded'` (>= 100%).
  4. **QA / CI-CD & Git Hygiene:**
     - Thiết lập `vitest` + `supertest` + `@testing-library/react` với bộ unit/integration test thật cho Parser, Safe-to-spend, Transaction/Goal/Auth services và Express routes.
     - Tạo `.github/workflows/ci.yml` chạy `npm ci`, `npm run lint`, `npm test`, `npm run build` cho mọi PR vào `develop` và `main`; bổ sung `VITE_API_BASE_URL` vào `.env.example`.
     - Rà soát và xử lý 2 nhánh remote tồn đọng (`origin/feature/dashboard-tv2-main` chứa `22bd41e`, `origin/feature/smart-features-tv4` chứa `6801e28`).
- **Tiêu chí nghiệm thu:**
  - `dist/` sau `npm run build` không chứa `GEMINI_API_KEY` hay `@google/generative-ai` ở phía client; gọi `/api/ai/chat` không kèm token bị chặn `401`.
  - GitHub Actions CI chạy xanh (`lint` + `test` + `build`) trên PR; DB có đủ RPC `generate_due_recurring_transactions` và atomic RPC cho Goal/Transfer.

---

### 2. TV1 – Trương Bích Vân (BA/QA Lead & Full-stack Dev: AUTH, Goals, VietQR)
- **Hiện trạng phát hiện qua kiểm định:**
  1. **[P0] Lỗi `profiles` (`PGRST116` / `23503`) vẫn còn nguyên ở Client:**
     - `src/services/authService.js`: `getProfile(userId)` (`L84-95`) vẫn dùng `.single()`; `updateProfile(userId, profileData)` (`L103-118`) vẫn dùng `.update({...}).eq('id', userId).select().single()` và spread `...profileData` không whitelist trường cho phép.
     - `src/context/AuthContext.jsx`: `fetchProfile(userId)` (`L36-51`) chỉ nhận `userId`, vẫn dùng `.single()`, không tự `upsert` profile mặc định nếu DB thiếu dòng. Ngoài ra `useEffect` (`L11-34`) gọi cả `getSession()` và `onAuthStateChange()` (`INITIAL_SESSION`) khiến `fetchProfile` chạy 2 lần khi mount, thiếu `isMounted` guard; `signOut()` (`L53-57`) bỏ qua `{ error }`.
  2. **[P0] UC04 (Quên & Đổi mật khẩu) bị hỏng / thiếu hoàn toàn:**
     - `authService.resetPasswordForEmail` (`L71`) redirect về `/reset-password`, nhưng `src/App.jsx` **không có route `/reset-password`** (rơi thẳng vào `NotFoundPage`).
     - `authService.js` thiếu hàm `updatePassword`; `LoginPage.jsx` thiếu nút/luồng "Quên mật khẩu"; `ProfilePage.jsx` thiếu form "Đổi mật khẩu".
  3. **[P0] Rủi ro mất tiền Non-atomic ở `goalService.js` (`UC23`):**
     - `depositToGoal` (`L112-177`) trừ `wallets.balance` trước rồi mới cộng `saving_goals.current_amount` sau — nếu bước 2 lỗi thì tiền ví đã bị trừ mất; không chặn nạp khi `goal.status === 'completed'`, không chặn nạp vượt `target_amount`, không ghi lịch sử giao dịch, và check `<= 0` lọt `NaN`.
     - `GoalPage.jsx`: thiếu nút & modal **Sửa mục tiêu** dù `goalService.updateGoal` đã có; **thiếu Error State** (`fetchGoalsList` nuốt `gRes.error`/`wRes.error`); dùng `alert()`/`window.confirm()`; mở modal Nạp tiền khi chưa có ví bị dropdown rỗng; không reset `depositAmount` khi mở lại modal; hiện `deadline` thô `YYYY-MM-DD`.
  4. **[P1/P2] Lỗi khác ở Login, Register, Profile & VietQR (`UC01–05`, `UC26`):**
     - `LoginPage.jsx`: hardcode `DEMO_ACCOUNTS` với mật khẩu `'123456'` ở client (`L9-14`); `handleDemoLogin` (`L75-83`) khi sai mật khẩu lại gọi `signUp` gây báo nhầm `"User already registered"`; mất query/hash khi redirect; check thông báo lỗi bằng chuỗi text thay vì error code.
     - `RegisterPage.jsx`: chỉ check `!fullName` (lọt toàn dấu cách); `setTimeout` chuyển trang (`L42-49`) không cleanup khi unmount.
     - `ProfilePage.jsx`: thiếu validate `fullName.trim()` và định dạng `bankAccount`; `handleSignOut` thiếu loading/error handling.
     - `vietqrService.js` (`L38`): ghép thẳng `bankBin` và `bankAccount` vào URL `img.vietqr.io` không sanitize khoảng trắng/encode. `BillSplitVietQR.jsx`: nút tải ảnh QR (`L241-250`) dùng `<a download target="_blank">` bị trình duyệt bỏ qua do cross-origin; `<img>` thiếu `onError` fallback; `clipboard.writeText` thiếu try/catch; input số người (`L102, L116`) không chặn `NaN` và vượt `max="50"`.
- **Yêu cầu kỹ thuật:**
  1. `authService.js` & `AuthContext.jsx`:
     - Đổi `.single()` thành `.maybeSingle()`; tự động `.upsert()` profile mặc định (từ `user_metadata.full_name` hoặc email prefix) khi chưa có dòng.
     - `updateProfile`: dùng `.upsert({ id: userId, ...allowedFields })` (whitelist `full_name`, `default_bank_bin`, `default_bank_account`, `avatar_url`).
     - Bổ sung `updatePassword(newPassword)` trong `authService.js`; chống gọi `fetchProfile` trùng lặp ở `AuthContext.jsx`, thêm `isMounted` cleanup và bắt `{ error }` trong `signOut`.
  2. Hoàn thiện **UC04**:
     - Tạo `src/pages/ResetPasswordPage.jsx` và khai báo route `/reset-password` trong `src/App.jsx`.
     - Thêm luồng "Quên mật khẩu?" trên `LoginPage.jsx` và mục "Đổi mật khẩu" trên `ProfilePage.jsx`.
  3. Hoàn thiện **UC22–UC23** (`goalService.js` & `GoalPage.jsx`):
     - Chuyển `depositToGoal` sang gọi PostgreSQL RPC atomic (`deposit_to_goal`) hoặc rollback an toàn; kiểm tra `Number.isFinite(amount) && amount > 0`, chặn goal đã `completed` và không cho vượt quá số cần nạp.
     - Thêm nút/modal **Sửa mục tiêu**, Error State, Toast + Confirm Dialog (thay `alert`/`window.confirm`), format `deadline` `DD/MM/YYYY`, chuẩn hóa modal Double-Bezel (đóng bằng `Escape`/backdrop).
  4. Hoàn thiện **UC26** (`vietqrService.js` & `BillSplitVietQR.jsx`):
     - Sanitize `bankBin`/`bankAccount`; tải ảnh QR qua `fetch(qrUrl)` -> `Blob` URL (fallback mở tab mới nếu CORS chặn); thêm `onError` cho ảnh QR; validate số người hợp lệ `1..50`.
  5. Hoàn thiện `LoginPage.jsx`, `RegisterPage.jsx`, `ProfilePage.jsx`: Ẩn hoặc chỉ bật demo login khi `import.meta.env.DEV`, cleanup `setTimeout`, validate form chặt chẽ.
- **Tiêu chí nghiệm thu:**
  - User mới đăng ký đăng nhập lần đầu vào thẳng Dashboard, tạo Ví đầu tiên thành công không lỗi `PGRST116`/`23503`.
  - Luồng Quên mật khẩu -> nhận link `/reset-password` -> đặt mật khẩu mới và Đổi mật khẩu trong Profile hoạt động thông suốt.
  - Nạp tiền mục tiêu đảm bảo ví và mục tiêu luôn khớp số dư, không crash khi mất mạng hay thiếu ví.

---

### 3. TV2 – Hồ Nguyên Văn (Frontend Lead & UI/PWA Dev: Layout, Dashboard, Budget, Report, PWA)
- **Hiện trạng phát hiện qua kiểm định:**
  1. **[P0] Lỗi lưu & hiển thị Quick Entry trên `DashboardPage.jsx` nặng hơn biên bản cũ:**
     - `DashboardPage.jsx` (`L330-345`) đọc `parsedData.categoryName` và `parsedData.walletKeyword`, trong khi `quickEntryParser.js` (`L13-28`) trả về `category` và `wallet` -> Preview luôn hiện `"Mặc định (Chung)"` và `"Ví mặc định"`.
     - Nghiêm trọng hơn, tại `handleQuickSave` (`L111-118`), code dùng `w.name.toLowerCase().includes(parsedData.walletKeyword || '')` và `c.name.toLowerCase().includes(parsedData.categoryName?.toLowerCase() || '')`. Vì cả 2 trường là `undefined`, biểu thức trở thành `.includes('') === true`, khiến **mọi giao dịch Quick Entry luôn lưu nhầm vào `wallets[0]` và `categories[0]`**! Đồng thời chưa duyệt mảng `categories.keywords` trong DB và đọc `parsedData.rawText` bị `undefined`.
  2. **[P0] Thiếu điều hướng `/categories` & mất 5 trang trên Mobile:**
     - `src/components/layout/Navbar.jsx` (`L46-95`) chỉ có 8 link Desktop, **thiếu `/categories` ("Danh mục")**, không highlight active route, hardcode fallback `'Phan Thanh Tùng'` (`L13`), thiếu nút chuyển Dark/Light theme.
     - `src/components/layout/BottomNav.jsx` (`L8-14`) chỉ có 4 mục + Quick Entry trong khi `Navbar` ẩn menu ở `< md` (`hidden md:flex`), dẫn đến **trên Mobile không thể mở 5 trang: `/categories`, `/reports`, `/goals`, `/recurring`, `/bill-split`**.
     - `AppLayout.jsx` (`L101`) dùng `window.location.href = '/#quick-entry'` gây reload toàn trang; `L48` `if (data.generatedCount > 0)` có nguy cơ crash nếu `data === null`.
  3. **[P1] Lỗi State, Logic & Biểu đồ trên `DashboardPage.jsx`, `BudgetPage.jsx`, `ReportPage.jsx`:**
     - `DashboardPage.jsx`: bỏ qua lỗi từ `walletsRes`, `txnsRes`, `catsRes`, `stsRes` (không hiện Error State); thiếu Loading State cho khối Ví và 5 giao dịch gần nhất; thông báo rỗng ghi `"trong tháng này"` nhưng query `getTransactions({ limit: 5 })` không lọc tháng; Quick Entry chưa bấm `Enter` để parse; `setTimeout` (`L142`) không cleanup; Modal công thức (`L477-498`) thiếu nút `X`/Escape/backdrop; card chưa đồng bộ chuẩn Double-Bezel.
     - `BudgetPage.jsx` (`L123, L196, L209`): tự tính `Math.min(100, Math.round(...))` thay vì dùng `res.overall_percentage` và `res.overall_status` từ `budgetService.getBudgetProgress` (vượt >100% vẫn hiện 100%, 79.6% làm tròn thành 80% gây cảnh báo sai); thiếu race-condition guard khi đổi tháng nhanh.
     - `ReportPage.jsx` & `reportService.js`: `ReportPage` thiếu Error State UI và Empty State cho biểu đồ cột; đổi `period === 'week' | 'year'` nhưng vẫn hiển thị 3 KPI tháng & bộ lọc tháng gây hiểu nhầm; trục Y/tooltip chưa format VNĐ. `reportService.js` (`L78-87`) gom nhóm theo `category.name` thay vì `category.id`, `getPeriodComparison` thiếu validate `month/year`, `fetchReportTransactions` nên filter tường minh `.eq('user_id', user.id)`.
  4. **[P1/P2] PWA (`public/sw.js`, `manifest.json`, `index.html`) & Bundle Size:**
     - `public/sw.js` (`L36-46`) đang dùng Cache-First cho `'/'` và `'/index.html'` (dễ giữ HTML cũ trỏ bundle JS hash cũ gây trắng trang sau deploy), chưa lọc `method === 'GET'`, scheme `http/https` và chưa bỏ qua `/api/`.
     - `public/manifest.json` thiếu icon PNG `192x192` và `512x512` (chỉ có 1 SVG); `App.jsx` chưa code-split bằng `React.lazy()` nên chunk JS lên tới `863.11 kB`.
- **Yêu cầu kỹ thuật:**
  1. `Navbar.jsx`, `BottomNav.jsx`, `AppLayout.jsx`:
     - Bổ sung link `{ name: 'Danh mục', path: '/categories', icon: Tags }` và highlight active route (`NavLink` / `useLocation`).
     - Thêm Menu Drawer ("Thêm / Mở rộng") trên Mobile hoặc BottomNav để người dùng Mobile truy cập đủ cả 13 màn hình (kèm `/categories`, `/reports`, `/goals`, `/recurring`, `/bill-split`).
     - Bỏ hardcode tên `'Phan Thanh Tùng'`, thêm nút Toggle Dark/Light theme, thay `window.location.href` bằng `navigate()`, kiểm tra `data?.generatedCount` an toàn.
  2. `DashboardPage.jsx`:
     - Đồng bộ đọc field chuẩn từ Parser (`category || categoryName`, `wallet || walletKeyword`, `note || rawText || originalText`), duyệt khớp theo mảng `keywords` của danh mục từ DB; bỏ bug `.includes('')` khi field rỗng; hỗ trợ phím `Enter`.
     - Hiển thị đầy đủ Loading / Error / Empty state cho Ví, Giao dịch và Safe-to-spend; chuẩn hóa thẻ & modal Double-Bezel (có đóng Escape/backdrop).
  3. `BudgetPage.jsx`, `ReportPage.jsx`, `reportService.js`:
     - Dùng `res.overall_percentage` và `res.overall_status` từ `budgetService`; gom nhóm báo cáo theo `category.id`; bổ sung Error State, Empty State cho Bar chart, format tiền VNĐ trên trục/tooltip Chart.js, thêm `isMounted`/abort guard khi chuyển tháng/kỳ.
  4. PWA & Code Splitting:
     - Đổi `public/sw.js` sang **Network-First** cho HTML/navigation và bỏ qua `/api/`; thêm icon PNG 192x192 & 512x512 vào `public/manifest.json` + `apple-touch-icon` ở `index.html`; áp dụng `React.lazy()` + `Suspense` trong `App.jsx` để giảm kích thước chunk khởi tạo xuống `< 500 kB`.
- **Tiêu chí nghiệm thu:**
  - Desktop & Mobile truy cập được toàn bộ các trang chức năng (bao gồm `/categories`).
  - Nhập nhanh câu tự nhiên trên Dashboard nhận diện & lưu đúng chính xác ví + danh mục khớp từ khóa DB (tuyệt đối không fallback nhầm về `wallets[0]`/`categories[0]`).
  - Bundle sau build tách chunk rõ ràng, PWA không dính cache HTML cũ sau khi deploy.

---

### 4. Nhóm tiếp quản Core Data (Leader Phan Thanh Tùng & TV3 Lê Hoài Quốc)
- **Hiện trạng phát hiện qua kiểm định:**
  1. **[P0] Thiếu hoàn toàn nút Sửa & Modal cập nhật tại 3 trang cốt lõi (`UC07`, `UC11`, `UC13`):**
     - `WalletPage.jsx` (`L227-234`) mới có Archive, thiếu nút Sửa & Modal gọi `walletService.updateWallet`.
     - `CategoryPage.jsx` (`L157-177`) mới có nút Xóa, thiếu nút Sửa & Modal gọi `categoryService.updateCategory` (ngoài ra state `loading` và `color` không hiển thị trên thẻ custom).
     - `TransactionPage.jsx` (`L312-319`) mới có nút Xóa (`opacity-0 group-hover:opacity-100` khó bấm trên mobile), thiếu nút Sửa & Modal gọi `transactionService.updateTransaction`.
  2. **[P0] Sai lệch số dư ví khi Sửa / Xóa / Tạo giao dịch (`transactionService.js` & `walletService.js`):**
     - `updateTransaction` (`transactionService.js:143-165`): chỉ update bảng `transactions`, **không hoàn tác giao dịch cũ và bù trừ lại `wallets.balance`** (kể cả khi đổi `amount`, đổi `type`, hoặc chuyển sang `wallet_id` khác).
     - `deleteTransaction` (`transactionService.js:173-213`): `L178` không select `to_wallet_id`, `L193` điều kiện `if (txn && txn.type !== 'transfer')` **bỏ qua hoàn tiền 2 ví khi xóa giao dịch chuyển khoản `transfer`**, và không kiểm tra `error` / rollback khi cập nhật ví thất bại.
     - `createTransaction` (`transactionService.js:81-135`): nếu truyền `type === 'transfer'` lại trừ tiền như `expense` (`L124`); không kiểm tra lỗi khi cập nhật số dư ví.
     - `transferFunds` (`walletService.js:115-194`): chạy 3 câu lệnh ghi tuần tự không atomic (dễ race condition TOCTOU tại bước kiểm tra số dư `L142`).
  3. **[P1] Lỗi phụ trợ ở Category, Transaction Filter/Pagination & CSV Export:**
     - `categoryService.js` (`L74`): khi `updates.keywords === ''` không chuyển thành `[]` mà đẩy chuỗi rỗng lên cột `TEXT[]`; `L43, L75` thiếu `.filter(Boolean)` sau `.split(',')`.
     - `TransactionPage.jsx`: khai báo `startDate`/`endDate` (`L40-41`) nhưng không render `<input type="date">` trên bộ lọc; hardcode `limit: 100` (`L57`) và chưa có nút phân trang; đổi `formType` (Thu/Chi) không reset `formCategoryId`; bỏ `alert()`/`window.confirm()`, bổ sung Error State.
     - Trùng lặp xuất CSV: `transactionService.js:220-252` có hàm `exportTransactionsCSV` cũ (thiếu chống formula injection, thiếu `to_wallet`, không `revokeObjectURL`) chạy song song với `transactionCsvExport.js` + `transactionCsv.js` đã làm chuẩn.
- **Yêu cầu kỹ thuật:**
  1. `WalletPage.jsx` (**UC07**): Thêm nút Sửa bên cạnh Archive/Xóa, Modal chỉnh sửa `name`, `type`, `balance`, `color`, `icon`; dùng Toast & Confirm Dialog thay `alert`/`confirm`.
  2. `CategoryPage.jsx` (**UC11**): Thêm nút Sửa cho danh mục tùy chỉnh (`name`, `icon`, `color`, `keywords`); hiển thị đầy đủ `loading`/error state, màu sắc và danh sách `keywords`; sửa `categoryService.js` xử lý `keywords === ''` -> `[]` và `.filter(Boolean)`.
  3. `TransactionPage.jsx` (**UC13**): Thêm nút Sửa hiển thị rõ trên cả Desktop lẫn Mobile; bổ sung Modal Sửa giao dịch; thêm bộ lọc khoảng ngày (`startDate`/`endDate`), phân trang rõ ràng, reset `formCategoryId` khi đổi loại Thu/Chi.
  4. `transactionService.js` & `walletService.js`:
     - Hoàn thiện `updateTransaction`, `deleteTransaction`, `createTransaction`: xử lý đầy đủ 3 loại `income`, `expense`, `transfer` (hoàn lại cả ví nguồn lẫn ví đích khi xóa/sửa chuyển khoản); kiểm tra lỗi từng bước hoặc chuyển sang PostgreSQL RPC atomic.
     - Chuyển `transferFunds` sang gọi RPC atomic `transfer_funds` để chống race condition.
     - Xóa hàm `exportTransactionsCSV` trùng lặp ở `transactionService.js` (hoặc re-export từ `transactionCsvExport.js`) để dùng thống nhất 1 bản an toàn chống CSV Formula Injection.
- **Tiêu chí nghiệm thu:**
  - Bộ CRUD Thêm / Sửa / Xóa trên Ví, Danh mục, Giao dịch hoạt động mượt trên cả Desktop và Mobile.
  - Sửa khoản chi 50.000đ -> 70.000đ, đổi ví thanh toán, hoặc xóa giao dịch chuyển tiền nội bộ đều cho số dư các ví chính xác tuyệt đối 100%.

---

### 5. TV3 – Lê Hoài Quốc (Smart Features: Quick Entry, Safe-to-spend, Recurring, Notifications)
- **Hiện trạng phát hiện qua kiểm định:**
  1. **[P0] Lệch & Sai thuật toán Parser (`quickEntryParser.js` vs `quickEntryRoutes.js`) — UC18/UC19:**
     - **Backend (`server/routes/quickEntryRoutes.js`):** `L94` **vẫn còn `unaccented.includes('an')`** khiến `"nhận lương 15tr"`, `"chuyển 2tr từ vcb sang momo"`, `"mua bàn phím 500k"` đều nhận nhầm thành danh mục `'Ăn uống'`; `incomeKeywords` chứa `'thu'`, `'nhan'` bắt nhầm `"thuê nhà"`, `"thử"`, `"nhắn"`; `regexMillionK` (`L41, L49`) nhân sai `100000` khiến `"1tr25"` thành `3.500.000`; thiếu ngày `dd/mm` và thiếu `'Thưởng & Thu nhập phụ'`.
     - **Frontend (`src/services/quickEntryParser.js`):** Đã bỏ `'an'` đứng riêng nhưng vẫn dùng `.includes()` cho `'be'`, `'com'`, `'rac'`, `'mb'`; trả về `{ category, wallet, originalText }` lệch với `{ categoryName, walletKeyword, rawText }` mà `DashboardPage` và biên bản yêu cầu; hardcode `'Lương & Thưởng'`, `'Nhà cửa'`, `'Giải trí'` không khớp tên danh mục trong `init_schema.sql`; dùng `.toISOString().split('T')[0]` gây **lệch `-1` ngày ở múi giờ Việt Nam (UTC+7)** khi nhập `dd/mm` (`"15/11"` -> `"2026-11-14"`) hoặc vào khung `00:00–06:59`; chưa nhận diện giao dịch `transfer` (`"chuyển 2tr từ vcb sang momo"` bị gán nhầm `expense` vào ví đích `Ví MoMo`); chuỗi toàn khoảng trắng `"   "` trả về object rỗng thay vì `null`.
  2. **[P0] Lỗi `PGRST202` ở `recurringService.js` & `notificationService.js` (`UC24`, `UC25`):**
     - `recurringService.js` (`L297-301`) gọi `supabase.rpc('generate_due_recurring_transactions')` và ném lỗi thẳng ra ngoài (chưa bắt/fallback khi gặp mã lỗi `PGRST202`), trong khi `AppLayout.jsx` (`L38-81`) tự động gọi hàm này mỗi lần mở trang.
     - `notificationService.js` (`L171-175`) gọi `sync_finance_notifications` cũng chưa có fallback riêng cho `PGRST202`; thiếu hàm `clearReadNotifications` theo đặc tả `UC25.md`.
     - `RecurringPage.jsx`: cho phép chọn `'daily'` (`L452`) nhưng DB `CHECK` hiện chỉ nhận `'weekly' | 'monthly' | 'yearly'`; chưa bắn sự kiện `spendwise:finance-updated` sau khi tạo/sửa/xóa để Dashboard cập nhật Safe-to-spend.
  3. **[P0] Chưa tích hợp Chuông Thông báo trên giao diện (`UC25`):**
     - `Navbar.jsx` (`L3`) mới import icon `Bell` nhưng chưa render nút chuông, badge đếm số chưa đọc và Popover danh sách thông báo.
  4. **[P1] `safeToSpendService.js` (`UC20`) phụ thuộc cứng vào Backend `:5000`:**
     - `L97-119, L168-182`: khi server `:5000` tắt hoặc lỗi mạng, hàm rơi `catch` và trả `safeToSpendToday: 0` thay vì fallback sang hàm thuần `calculateSafeToSpendAmount` có sẵn ngay trong file (`L221-224`).
     - `L73-84`: ước tính `upcomingRecurring` chỉ đếm `next_due_date` 1 lần/rule (nếu rule chu kỳ `weekly`/`daily` lặp nhiều lần trong tháng sẽ ước tính thiếu).
- **Yêu cầu kỹ thuật:**
  1. Chuẩn hóa & hợp nhất logic **Quick Entry Parser** (`quickEntryParser.js` & `quickEntryRoutes.js`):
     - Dùng ranh giới từ nguyên vẹn (Unicode-aware / `(?<![a-z0-9])kw(?![a-z0-9])`) cho cả từ khóa danh mục, ví và thu nhập; tuyệt đối xóa `includes('an')`.
     - Sửa parse số tiền `(\d+)tr(\d+)` theo đúng số chữ số thập phân (VD: `1tr5` = `1.500.000`, `1tr25` = `1.250.000`), parse ngày theo **Local Timezone** (không dùng `.toISOString()`), kiểm tra ngày hợp lệ (chặn `31/02`), năm 2 chữ số (`26` -> `2026`), trả `null` nếu input rỗng/khoảng trắng.
     - Khớp tên danh mục chuẩn với `init_schema.sql` (`'Lương'`, `'Thưởng & Thu nhập phụ'`, `'Hóa đơn & Nhà cửa'`, `'Giải trí & Du lịch'`,...) và ưu tiên đối chiếu mảng `keywords` từ DB.
     - Chuẩn hóa object trả về thống nhất cả FE và BE: `{ amount, type, date, wallet, walletKeyword, category, categoryName, note, originalText, rawText }`.
  2. `safeToSpendService.js`:
     - Bổ sung fallback tính cục bộ qua `calculateSafeToSpendAmount` khi gọi Backend `/api/finance/safe-to-spend` thất bại (nhưng vẫn gắn cờ nguồn tính toán để dễ debug).
     - Tính đủ số lần phát sinh trong phần còn lại của tháng đối với rule định kỳ `weekly` (và `daily` nếu kích hoạt).
  3. `recurringService.js`, `RecurringPage.jsx` & `notificationService.js`:
     - Bọc `supabase.rpc()` trong `try/catch`: nếu `error.code === 'PGRST202'` hoặc hàm chưa tồn tại, fallback an toàn đọc/xử lý trực tiếp trên bảng `recurring_rules` và `notifications` mà không làm đỏ console/crash UI.
     - Bổ sung `clearReadNotifications(userId)` theo `UC25.md`; đồng bộ `frequency` với DB schema; dispatch `spendwise:finance-updated` sau mỗi thao tác ở `RecurringPage.jsx`.
  4. Tạo component **`NotificationBell.jsx`** (**UC25**) và tích hợp vào `Navbar.jsx`:
     - Hiển thị badge số thông báo chưa đọc, Popover danh sách cảnh báo ngân sách & lịch định kỳ sắp đến hạn, nút "Đánh dấu đã đọc", "Đánh dấu tất cả đã đọc" và "Xóa đã đọc".
- **Tiêu chí nghiệm thu:**
  - Nhập `"nhận lương 15tr"`, `"nhận lương 10tr hôm nay vcb"`, `"mua bàn phím 500k"`, `"cafe 35k 15/11"`, `"thưởng tết 5tr"` cho kết quả đúng 100% ở cả FE lẫn BE, đúng ngày giờ Việt Nam.
  - Bấm Chuông thông báo trên Navbar hiển thị danh sách cảnh báo, đánh dấu đã đọc/xóa mượt mà, không phát sinh lỗi `PGRST202`.
  - Tắt server `:5000`, thẻ Safe-to-spend trên Dashboard vẫn tính đúng qua fallback thay vì rơi về `0 ₫`.

---

## IV. LỘ TRÌNH THỰC HIỆN, KIỂM SOÁT LINT/TEST & THỜI HẠN HOÀN THÀNH

1. **Mốc thời gian (Deadlines):**
   - **Mốc P0 (Chặn lỗi nghiêm trọng & Bảo mật):** Trước **20h00 ngày 20/11/2026** — hoàn thành toàn bộ các mục gắn nhãn `[P0]` của **Leader**, **TV1**, **TV2**, **TV3** và **Nhóm Core Data**.
   - **Mốc P1 & P2 (Hoàn thiện toàn diện, Test & Dọn sạch 56 cảnh báo Lint):** Trước **20h00 ngày 23/11/2026** — mọi thành viên mở Pull Request sạch hoàn chỉnh vào nhánh `develop`.
2. **Tiêu chuẩn kiểm tra trước khi mở PR (Bắt buộc):**
   ```bash
   # Bước 1: Kéo code mới nhất từ develop
   git checkout develop
   git pull origin develop

   # Bước 2: Tạo nhánh quy chuẩn từ develop (theo bảng Mục II)
   git checkout -b feature/<ten-nhanh-cua-ban>

   # Bước 3: Kiểm tra Lint, Unit Test và Build trước khi commit
   npm run lint    # Mục tiêu: 0 errors, dọn dần 56 warnings về 0
   npm run build   # Phải báo thành công: ✓ built in ...s

   # Bước 4: Commit theo chuẩn Conventional Commits & Push
   git commit -m "fix(<module>): mo ta ngan gon loi da sua"
   git push -u origin feature/<ten-nhanh-cua-ban>

   # Bước 5: Tạo Pull Request trên GitHub
   # Base branch: develop  <--  Compare branch: feature/<ten-nhanh-cua-ban>
   ```
3. **Quy trình Review & Phát hành:**
   - Mọi PR gửi vào `develop` phải qua đối soát mã nguồn + chạy kiểm thử từ **Leader (Phan Thanh Tùng)** và **QA Lead (Trương Bích Vân)**.
   - Sau khi `develop` vượt qua toàn bộ bộ test tự động, kiểm thử E2E trên trình duyệt (Desktop + Mobile) và build sạch, Leader mở PR merge từ `develop` vào `main` để phát hành chính thức.
