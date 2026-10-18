# BẢNG TRA CỨU 26 USE CASES VÀ ÁNH XẠ KỸ THUẬT

> **Tài liệu hướng dẫn:** Mọi thành viên khi thực hiện Use Case cần bám sát bảng này để đối chiếu đúng file Service, Component UI và Bảng Database.

---

| Mã UC | Tên Use Case | Nhóm | Phụ trách | Tệp Giao diện (`src/pages/`) | Tệp Dịch vụ (`src/services/`) | Bảng Database (`public.`) |
| :---: | :--- | :---: | :---: | :--- | :--- | :--- |
| **UC01** | Đăng ký tài khoản | AUTH | TV1 (Vân) | `RegisterPage.jsx` | `authService.js` (`signUp`) | `auth.users`, `profiles`, `wallets` |
| **UC02** | Đăng nhập | AUTH | TV1 (Vân) | `LoginPage.jsx` | `authService.js` (`signIn`) | `auth.users` |
| **UC03** | Đăng xuất | AUTH | TV1 (Vân) | `ProfilePage.jsx` | `authService.js` (`signOut`) | `auth.users` |
| **UC04** | Quên & đổi mật khẩu | AUTH | TV1 (Vân) | `LoginPage.jsx` | `authService.js` (`resetPasswordForEmail`) | `auth.users` |
| **UC05** | Cập nhật hồ sơ cá nhân | AUTH | TV1 (Vân) | `ProfilePage.jsx` | `authService.js` (`updateProfile`) | `profiles` |
| **UC06** | Thêm ví | WALLET | TV3 (Huy) | `WalletPage.jsx` | `walletService.js` (`createWallet`) | `wallets` |
| **UC07** | Sửa ví | WALLET | TV3 (Huy) | `WalletPage.jsx` | `walletService.js` (`updateWallet`) | `wallets` |
| **UC08** | Xóa / Ẩn ví | WALLET | TV3 (Huy) | `WalletPage.jsx` | `walletService.js` (`archiveWallet`, `deleteWallet`) | `wallets` |
| **UC09** | Chuyển tiền nội bộ | WALLET | TV3 (Huy) | `WalletPage.jsx` | `walletService.js` (`transferFunds`) | `wallets`, `transactions` |
| **UC10** | Thêm danh mục tùy chỉnh | CAT | TV3 (Huy) | `CategoryPage.jsx` | `categoryService.js` (`createCategory`) | `categories` |
| **UC11** | Sửa / Xóa danh mục | CAT | TV3 (Huy) | `CategoryPage.jsx` | `categoryService.js` (`updateCategory`, `deleteCategory`) | `categories` |
| **UC12** | Thêm giao dịch thu/chi | TXN | TV3 (Huy) | `TransactionPage.jsx` | `transactionService.js` (`createTransaction`) | `transactions`, `wallets` |
| **UC13** | Sửa/Xóa giao dịch; Tìm kiếm; CSV | TXN | TV3 (Huy) | `TransactionPage.jsx` | `transactionService.js` (`getTransactions`, `exportTransactionsCSV`) | `transactions`, `wallets` |
| **UC14** | Đặt ngân sách tháng | BUDGET | TV2 (Văn) | `BudgetPage.jsx` | `budgetService.js` (`setBudget`) | `budgets` |
| **UC15** | Xem tiến độ ngân sách | BUDGET | TV2 (Văn) | `BudgetPage.jsx` | `budgetService.js` (`getBudgetProgress`) | `budgets`, `transactions` |
| **UC16** | Xem Dashboard tổng quan | DASH | TV2 (Văn) | `DashboardPage.jsx` | `walletService.js`, `transactionService.js` | `wallets`, `transactions` |
| **UC17** | Xem báo cáo tài chính | REPORT | TV2 (Văn) | `ReportPage.jsx` | `reportService.js` (`getFinancialSummary`, `getCategoryExpenseBreakdown`) | `transactions`, `categories` |
| **UC18** | Nhập nhanh câu tự nhiên | QUICK | TV4 (Quốc) | `DashboardPage.jsx` | `quickEntryParser.js` (`parseQuickEntry`) | Không (Client parser) |
| **UC19** | Preview & Xác nhận giao dịch | QUICK | TV4 (Quốc) | `DashboardPage.jsx` | `transactionService.js` (`createTransaction`) | `transactions`, `wallets` |
| **UC20** | Xem chỉ số Safe-to-spend | STS | TV4 (Quốc) | `DashboardPage.jsx` | `safeToSpendService.js` (`calculateSafeToSpend`) | `budgets`, `recurring_rules`, `wallets` |
| **UC21** | Chat với trợ lý AI Gemini | AIBOT | Leader (Tùng) | `AiChatWidget.jsx` | `aiAssistantService.js` (`askGeminiAssistant`) | Toàn bộ dữ liệu tài chính (Context) |
| **UC22** | Tạo mục tiêu tiết kiệm | GOAL_REC | TV1 (Vân) | `GoalPage.jsx` | `goalService.js` (`createGoal`) | `saving_goals` |
| **UC23** | Nạp tiền vào mục tiêu | GOAL_REC | TV1 (Vân) | `GoalPage.jsx` | `goalService.js` (`depositToGoal`) | `saving_goals`, `wallets` |
| **UC24** | Tạo giao dịch định kỳ | GOAL_REC | TV4 (Quốc) | `RecurringPage.jsx` | `recurringService.js` (`createRecurringRule`) | `recurring_rules` |
| **UC25** | Xem thông báo hệ thống | NOTI_QR | TV4 (Quốc) | `AppLayout.jsx` | `notificationService.js` (`getNotifications`) | `notifications` |
| **UC26** | Chia hóa đơn & tạo VietQR | NOTI_QR | TV1 (Vân) | `BillSplitVietQR.jsx` | `vietqrService.js` (`generateVietQrUrl`, `splitBill`) | `profiles` |
