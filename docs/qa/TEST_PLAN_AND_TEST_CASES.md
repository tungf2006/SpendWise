# KẾ HOẠCH KIỂM THỬ & BỘ 50 TEST CASES – HỆ THỐNG SPENDWISE

> **Dự án:** SpendWise – Hệ thống quản lý chi tiêu cá nhân thông minh  
> **Đơn vị:** Trường Đại học Giao thông vận tải TP.HCM (UTH) – Đồ án thực tế Công nghệ phần mềm  
> **Giảng viên hướng dẫn:** TS. Lê Văn Quốc Anh  
> **Chủ trì QA:** TV1 – Trương Bích Vân (MSSV: `068303009740`)  
> **Phối hợp thực hiện:** Leader – Phan Thanh Tùng (`066206004656`), TV2 – Hồ Nguyên Văn (`054206009901`), TV3 – Lê Hoài Quốc (`079205009219`)  
> **Phiên bản:** v1.0 – Đồng bộ 26 Use Cases (`UC01`–`UC26`) & Bộ kiểm thử tự động Vitest + Supertest

---

## PHẦN I. KẾ HOẠCH KIỂM THỬ (TEST PLAN)

### 1. Mục tiêu kiểm thử
- Xác minh toàn bộ **26 Use Cases (`UC01`–`UC26`)** thuộc 12 nhóm chức năng hoạt động đúng đặc tả nghiệp vụ và ràng buộc cơ sở dữ liệu (8 bảng PostgreSQL + 4 RPC atomic).
- Đảm bảo tính chính xác tuyệt đối của các phép toán tiền tệ: bù trừ số dư ví khi thêm/sửa/xóa giao dịch, chuyển tiền nội bộ (`transfer`), nạp tiền mục tiêu (`deposit_to_goal`), công thức `SafeToSpend` và cảnh báo ngân sách 3 mức (`<80%`, `80–99%`, `>=100%`).
- Xác minh an toàn bảo mật: **Row Level Security (RLS)** cô lập dữ liệu giữa các tài khoản (`QA-02`), xác thực JWT Bearer cho Backend API `/api/ai/chat`, Rate Limit chống spam và không rò rỉ `GEMINI_API_KEY` ra bundle Client.

### 2. Phạm vi & Cấp độ kiểm thử
| Cấp độ | Công cụ / Phương pháp | Phạm vi kiểm thử |
| :--- | :--- | :--- |
| **Unit Test** | Vitest (`src/services/__tests__/*.test.js`) | Toàn bộ 13 Service Modules (Auth, Wallet, Category, Transaction, CSV, Budget, Report, QuickEntryParser, SafeToSpend, AI Assistant, Goal, Recurring, Notification, VietQR). |
| **Integration / API Test** | Vitest + Supertest (`server/__tests__/api.test.js`) | Express API Gateway (`/api/ai/chat`, `/api/quick-entry/parse`, `/api/finance/safe-to-spend`, `/api/finance/health`), JWT Auth Middleware, Rate Limiter. |
| **System / Manual E2E** | Trình duyệt Desktop & Mobile (`localhost:5173`) | 50 kịch bản `TC01`–`TC50` phủ đủ 26 Use Cases, luồng lỗi biên, thông báo Toast, ConfirmDialog, Responsive & PWA. |
| **Security & RLS Test** | Supabase Auth + PostgREST + CI Check | Cô lập dữ liệu đa người dùng (User A vs User B), kiểm tra bundle `dist/` không chứa API key. |

### 3. Môi trường kiểm thử
- **Frontend:** React 19, Vite, Tailwind CSS, Chart.js (`http://localhost:5173`).
- **Backend API Gateway:** Express.js trên Node.js v24 (`http://localhost:5000`).
- **Database & Auth:** Supabase (PostgreSQL 15, RLS bật trên 100% bảng).
- **Trình duyệt & Thiết bị:** Chrome/Edge (Desktop `1440x900` & Mobile Responsive `390x844`).

### 4. Tiêu chí nghiệm thu (Exit Criteria)
- **100%** Test Case mức độ **P0 (Critical)** đạt `Pass`.
- **100%** bộ kiểm thử tự động (`npm test`) và kiểm tra mã nguồn (`npm run lint`, `npm run build`) chạy xanh trên GitHub Actions CI.
- Không tồn tại lỗi rò rỉ bí mật (`VITE_GEMINI_API_KEY`) trong thư mục `dist/`.

---

## PHẦN II. DANH SÁCH CHI TIẾT 50 TEST CASES (`TC01`–`TC50`)

> File bảng tính chuẩn nộp đồ án (có công thức thống kê tự động và Ma trận truy vết 26 UC): [SpendWise_Test_Plan_va_50_TestCases.xlsx](file:///c:/Users/Public/SpendWise/docs/qa/SpendWise_Test_Plan_va_50_TestCases.xlsx)

### 1. Nhóm AUTH – Xác thực & Hồ sơ cá nhân (`UC01`–`UC05`)
| Mã TC | Mã UC | Tên Test Case | Ưu tiên | Dữ liệu đầu vào & Các bước chính | Kết quả mong đợi | Trạng thái |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| **TC01** | UC01 | Đăng ký tài khoản hợp lệ | P0 | Mở `/register`, nhập họ tên `"Nguyễn Văn A"`, email hợp lệ chưa tồn tại, mật khẩu `>= 6` ký tự, bấm Đăng ký. | Tạo user thành công; trigger `handle_new_user` tự sinh dòng `profiles` và ví mặc định `Tiền mặt`; hiển thị thông báo thành công. | Pass |
| **TC02** | UC01 | Đăng ký với email trùng / tên toàn dấu cách | P1 | Nhập họ tên `"   "` hoặc email đã đăng ký, bấm Đăng ký. | Form chặn submit hoặc báo lỗi cụ thể bằng tiếng Việt, không tạo user trùng. | Pass |
| **TC03** | UC02 | Đăng nhập tài khoản hợp lệ | P0 | Mở `/login`, nhập email & mật khẩu đúng, bấm Đăng nhập. | Lưu phiên Supabase Auth, điều hướng vào `/dashboard`, tải hồ sơ & dữ liệu cá nhân. | Pass |
| **TC04** | UC02 | Đăng nhập sai mật khẩu | P0 | Nhập email đúng, mật khẩu sai, bấm Đăng nhập. | Hiển thị lỗi thông tin đăng nhập không chính xác, giữ nguyên trang `/login`. | Pass |
| **TC05** | UC03 | Đăng xuất & Bảo vệ Route (`ProtectedRoute`) | P0 | Bấm Đăng xuất; sau đó truy cập trực tiếp `/dashboard` hoặc `/transactions`. | Hủy phiên hiện tại, xóa state cũ, tự động redirect về `/login`. | Pass |
| **TC06** | UC04 | Quên mật khẩu – Gửi email khôi phục | P1 | Mở `/forgot-password`, nhập email hợp lệ, bấm Gửi yêu cầu. | Gọi `resetPasswordForEmail` với `redirectTo: <origin>/reset-password`, hiện thông báo kiểm tra hộp thư. | Pass |
| **TC07** | UC04 | Đặt lại mật khẩu tại `/reset-password` | P1 | Truy cập `/reset-password` từ link khôi phục, nhập mật khẩu mới hợp lệ & xác nhận, bấm Lưu. | Gọi `updatePassword`, cập nhật mật khẩu thành công, không rơi vào trang 404. | Pass |
| **TC08** | UC05 | Cập nhật hồ sơ & ngân hàng VietQR mặc định | P1 | Mở `/profile`, sửa Họ tên, chọn `default_bank_bin`, nhập `default_bank_account`, bấm Lưu. | `updateProfile` dùng `upsert` chỉ cho phép trường whitelist; lưu thành công và giữ nguyên khi reload. | Pass |

### 2. Nhóm WALLET – Quản lý ví & Chuyển tiền nội bộ (`UC06`–`UC09`)
| Mã TC | Mã UC | Tên Test Case | Ưu tiên | Dữ liệu đầu vào & Các bước chính | Kết quả mong đợi | Trạng thái |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| **TC09** | UC06 | Thêm ví mới hợp lệ | P0 | Mở `/wallets`, bấm Thêm ví, nhập tên `"Techcombank"`, loại `bank`, số dư `5.000.000`, bấm Lưu. | Ví mới xuất hiện trong danh sách, tổng số dư cập nhật `+5.000.000 VNĐ`, hiện Toast thành công. | Pass |
| **TC10** | UC06 | Chặn thêm ví khi tên rỗng | P1 | Để trống tên ví (`"   "`), bấm Lưu. | Chặn gửi DB, báo lỗi `"Tên ví không được để trống"`. | Pass |
| **TC11** | UC07 | Sửa tên, màu và số dư ví | P1 | Mở Modal Sửa ví, đổi tên & cập nhật số dư (kể cả số dư âm hợp lệ), bấm Lưu. | Cập nhật đúng trường whitelist, UI hiển thị ngay, hỗ trợ đóng modal bằng phím `Escape`. | Pass |
| **TC12** | UC08 | Ẩn ví (Archive) có hộp thoại xác nhận | P1 | Bấm Ẩn ví -> hiện `ConfirmDialog` -> bấm Xác nhận. | `is_archived = true`, ví biến mất khỏi danh sách mặc định nhưng vẫn bảo toàn lịch sử giao dịch cũ. | Pass |
| **TC13** | UC08 | Chặn xóa cứng ví đã phát sinh giao dịch | P1 | Thực hiện xóa ví đang được tham chiếu trong `transactions`. | Bắt lỗi ràng buộc khóa ngoại (`ON DELETE RESTRICT`), gợi ý người dùng Ẩn ví thay vì xóa. | Pass |
| **TC14** | UC09 | Chuyển tiền nội bộ giữa 2 ví (`transfer_funds`) | P0 | Chuyển `1.000.000` từ Ví A (`5.000.000`) sang Ví B (`2.000.000`). | Ví A giảm còn `4.000.000`, Ví B tăng lên `3.000.000`; tạo 1 giao dịch `type='transfer'`; **không** cộng vào tổng Thu/Chi tháng. | Pass |
| **TC15** | UC09 | Chặn chuyển tiền cùng 1 ví hoặc số tiền `<= 0` | P0 | Chọn Ví nguồn = Ví đích hoặc nhập số tiền `0` / `-50000`. | Báo lỗi validation cụ thể, không thay đổi số dư ví nào. | Pass |

### 3. Nhóm CAT – Quản lý danh mục (`UC10`–`UC11`)
| Mã TC | Mã UC | Tên Test Case | Ưu tiên | Dữ liệu đầu vào & Các bước chính | Kết quả mong đợi | Trạng thái |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| **TC16** | UC10 | Thêm danh mục tùy chỉnh kèm từ khóa Parser | P1 | Mở `/categories`, thêm `"Thú cưng"`, loại `expense`, từ khóa `"meo, cho, hat"`. | Lưu mảng `keywords: ["meo", "cho", "hat"]`, hiển thị chấm màu và chip từ khóa. | Pass |
| **TC17** | UC10 | Chuẩn hóa chuỗi từ khóa rỗng | P2 | Thêm danh mục với ô từ khóa để trống `""`. | `normalizeKeywords` chuyển thành mảng rỗng `[]`, không sinh phần tử `""`. | Pass |
| **TC18** | UC11 | Sửa danh mục tùy chỉnh của người dùng | P1 | Mở Modal Sửa danh mục, đổi tên & thêm từ khóa mới, bấm Lưu. | Cập nhật thành công danh mục của user; không cho sửa danh mục hệ thống (`user_id IS NULL`). | Pass |
| **TC19** | UC11 | Xóa danh mục & Bắt lỗi FK `23503` | P1 | Xóa danh mục chưa có giao dịch -> thành công; xóa danh mục đang gắn giao dịch -> báo lỗi thân thiện. | `ConfirmDialog` xác nhận trước khi xóa; lỗi `23503` hiển thị thông báo rõ ràng bằng tiếng Việt. | Pass |

### 4. Nhóm TXN – Quản lý giao dịch, Tìm kiếm & Xuất CSV (`UC12`–`UC13`)
| Mã TC | Mã UC | Tên Test Case | Ưu tiên | Dữ liệu đầu vào & Các bước chính | Kết quả mong đợi | Trạng thái |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| **TC20** | UC12 | Thêm giao dịch Chi tiêu (`expense`) | P0 | Thêm chi `150.000`, danh mục `Ăn uống`, ví `Tiền mặt` (`1.000.000`). | Lưu giao dịch, số dư ví giảm còn `850.000`, cột `note_unaccent` tự sinh không dấu. | Pass |
| **TC21** | UC12 | Thêm giao dịch Thu nhập (`income`) | P0 | Thêm thu `10.000.000`, danh mục `Lương`, ví `Vietcombank`. | Lưu giao dịch, số dư ví tăng `+10.000.000`, cập nhật tổng thu tháng. | Pass |
| **TC22** | UC13 | Sửa số tiền / ví giao dịch (Bù trừ Net Delta) | P0 | Sửa giao dịch chi từ `100.000` thành `250.000` (hoặc đổi sang ví khác). | Tính đúng Net Delta, hoàn số dư ví cũ và trừ đúng số dư ví mới (có compensating rollback nếu lỗi). | Pass |
| **TC23** | UC13 | Xóa giao dịch & Hoàn lại số dư ví | P0 | Xóa giao dịch chi `200.000` qua `ConfirmDialog`. | Xóa dòng giao dịch và cộng hoàn lại `+200.000` vào ví tương ứng. | Pass |
| **TC24** | UC13 | Tìm kiếm không dấu theo ghi chú | P1 | Có giao dịch ghi chú `"Cà phê sữa đá"`, nhập từ khóa `"ca phe sua"`. | Trả về đúng giao dịch khớp cột `note_unaccent`. | Pass |
| **TC25** | UC13 | Lọc khoảng ngày sai (`startDate > endDate`) & Phân trang | P1 | Chọn `Từ ngày` > `Đến ngày`; kiểm tra danh sách > 20 dòng. | Hiện cảnh báo khoảng ngày không hợp lệ; phân trang `pageSize=20`, tự lùi trang khi xóa mục cuối trang. | Pass |
| **TC26** | UC13 | Xuất CSV chống Formula Injection | P0 | Có giao dịch ghi chú `"=cmd|' /C calc'!A0"`, bấm Xuất CSV. | File `.csv` tải về đúng UTF-8 BOM, tiền tố nguy hiểm (`=`, `+`, `-`, `@`) được escape an toàn bằng dấu `'`. | Pass |

### 5. Nhóm BUDGET – Quản lý ngân sách (`UC14`–`UC15`)
| Mã TC | Mã UC | Tên Test Case | Ưu tiên | Dữ liệu đầu vào & Các bước chính | Kết quả mong đợi | Trạng thái |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| **TC27** | UC14 | Thiết lập / Cập nhật ngân sách tháng (Upsert) | P0 | Mở `/budgets`, chọn danh mục chi `Ăn uống`, tháng `11/2026`, hạn mức `3.000.000`. | Lưu thành công; đặt lại cùng danh mục/tháng/năm sẽ cập nhật hạn mức (không tạo dòng trùng). | Pass |
| **TC28** | UC14 | Chặn đặt ngân sách cho danh mục Thu nhập / số tiền `<= 0` | P1 | Chọn hạn mức `0` hoặc truyền `category_id` loại `income`. | Service từ chối với thông báo lỗi cụ thể. | Pass |
| **TC29** | UC15 | Thanh tiến độ 2 mức: An toàn (`<80%`) & Sắp vượt (`80–99%`) | P0 | Hạn mức `1.000.000`: chi `500.000` (50%) và chi `850.000` (85%). | 50% hiện màu xanh (`emerald`, `"An toàn"`); 85% hiện màu vàng (`amber`, `"Sắp vượt"`). | Pass |
| **TC30** | UC15 | Thanh tiến độ mức Đã vượt (`>=100%`) | P0 | Hạn mức `1.000.000`, tổng chi `1.250.000` (125%). | Hiện màu đỏ (`rose`, `"Đã vượt"`), `actual_percentage = 125%`, chiều rộng thanh kẹp tối đa `100%`, `exceeded_amount = 250.000`. | Pass |

### 6. Nhóm DASH & REPORT – Tổng quan & Báo cáo (`UC16`–`UC17`)
| Mã TC | Mã UC | Tên Test Case | Ưu tiên | Dữ liệu đầu vào & Các bước chính | Kết quả mong đợi | Trạng thái |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| **TC31** | UC16 | Hiển thị Dashboard tổng quan | P0 | Mở `/dashboard` với tài khoản có sẵn ví, ngân sách và giao dịch. | Hiển thị đúng tổng số dư các ví chưa ẩn, thẻ Safe-to-spend, biểu đồ Donut danh mục và 5 giao dịch gần nhất. | Pass |
| **TC32** | UC17 | Biểu đồ cột Thu/Chi theo Tuần / Tháng / Năm | P1 | Mở `/reports`, chuyển lần lượt tab `Tuần`, `Tháng`, `Năm`. | Sinh đúng `7` cột (Tuần), `28–31` cột (Tháng), `12` cột `T1..T12` (Năm); loại trừ giao dịch `transfer`. | Pass |
| **TC33** | UC17 | So sánh Thu/Chi giữa 2 tháng liền kề | P1 | Tháng trước chi `5.000.000`, tháng này chi `6.000.000`. | `getPeriodComparison` trả `diffExpensePercent = +20%` và hiển thị chênh lệch ròng chính xác. | Pass |

### 7. Nhóm QUICK – Nhập nhanh câu tự nhiên (`UC18`–`UC19`, `QA-01`)
| Mã TC | Mã UC | Tên Test Case | Ưu tiên | Dữ liệu đầu vào & Các bước chính | Kết quả mong đợi | Trạng thái |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| **TC34** | UC18 | Bóc tách câu chi tiêu chuẩn (`k`, ngày tương đối, ví) | P0 | Nhập `"cafe 35k hôm qua momo"` vào ô Nhập nhanh. | Tách đúng: `amount = 35000`, `type = expense`, `date = T-1`, `wallet = Ví MoMo`, `category = Ăn uống`, 4 cờ `confidence = true`. | Pass |
| **TC35** | UC18 | Bóc tách định dạng `1tr2`, `1.5 triệu`, `250.000` & Thu nhập | P0 | Thử `"tiền phòng 1tr2 hôm kia vcb"` và `"nhận lương 15tr techcombank"`. | Tách đúng `1.200.000` (Nhà cửa, `T-2`) và `15.000.000` (`type = income`, Lương & Thưởng). | Pass |
| **TC36** | UC18 | Câu mơ hồ thiếu trường – Không tự đoán | P0 | Nhập `"chi linh tinh cho bạn"` (không có số tiền, ví, danh mục). | Trả về `amount/wallet/category = null`, `confidence.* = false`; Modal Preview đánh dấu **viền vàng** các trường cần bổ sung. | Pass |
| **TC37** | UC19 | Xem Preview & Xác nhận lưu giao dịch | P0 | Chỉnh sửa/bổ sung trường viền vàng trên Modal Preview rồi bấm Xác nhận lưu. | Tạo giao dịch thật vào Supabase, cập nhật số dư ví và làm mới Dashboard. | Pass |

### 8. Nhóm STS – Safe-to-spend (`UC20`)
| Mã TC | Mã UC | Tên Test Case | Ưu tiên | Dữ liệu đầu vào & Các bước chính | Kết quả mong đợi | Trạng thái |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| **TC38** | UC20 | Tính chỉ số Safe-to-spend chuẩn công thức | P0 | `RemainingBudget = 3.000.000`, `UpcomingRecurring = 600.000`, `DaysLeft = 4`. | `SafeToSpend = (3.000.000 - 600.000) / 4 = 600.000 VNĐ/ngày`. | Pass |
| **TC39** | UC20 | Trường hợp biên: Ngân sách âm hoặc định kỳ lớn hơn còn lại | P0 | `RemainingBudget = 200.000`, `UpcomingRecurring = 500.000`, `DaysLeft = 5`. | Công thức `max(0, ...)` trả về `0 VNĐ/ngày`, tuyệt đối không hiển thị số âm. | Pass |

### 9. Nhóm AIBOT – Trợ lý AI Gemini (`UC21`)
| Mã TC | Mã UC | Tên Test Case | Ưu tiên | Dữ liệu đầu vào & Các bước chính | Kết quả mong đợi | Trạng thái |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| **TC40** | UC21 | Chat với AI bằng 4 Quick Reply Chips (Context-Stuffing) | P0 | Mở `AiChatWidget`, bấm chip `"Hôm nay tôi có thể tiêu bao nhiêu tiền an toàn?"`. | Gửi `POST /api/ai/chat` kèm `Authorization: Bearer <JWT>` và JSON context tài chính; trả lời có số liệu khớp DB. | Pass |
| **TC41** | UC21 | Bảo mật Backend: Chặn `401` khi thiếu JWT & Không lộ API Key | P0 | Gọi `POST /api/ai/chat` không kèm header `Authorization`; kiểm tra bundle `dist/`. | API trả `401 Unauthorized`; thư mục `dist/` sau `npm run build` hoàn toàn không chứa `GEMINI_API_KEY`. | Pass |
| **TC42** | UC21 | Rate Limit `429` & Validation câu hỏi rỗng | P1 | Gửi câu hỏi `"   "` và gửi quá giới hạn request/phút lên `/api/ai/chat`. | Câu rỗng bị chặn ngay ở client; vượt tần suất trả `429` kèm thông báo đợi thử lại. | Pass |

### 10. Nhóm GOAL_REC – Mục tiêu tiết kiệm & Giao dịch định kỳ (`UC22`–`UC24`)
| Mã TC | Mã UC | Tên Test Case | Ưu tiên | Dữ liệu đầu vào & Các bước chính | Kết quả mong đợi | Trạng thái |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| **TC43** | UC22 | Tạo mục tiêu tiết kiệm mới | P1 | Mở `/goals`, tạo `"Mua Laptop"`, mục tiêu `20.000.000`, hạn `2027-06-01`. | Lưu thành công với `current_amount = 0`, `status = 'in_progress'`, thanh tiến độ `0%`. | Pass |
| **TC44** | UC23 | Nạp tiền vào mục tiêu atomic (`deposit_to_goal`) | P0 | Nạp `2.000.000` từ Ví A (`5.000.000`) vào mục tiêu (đang `18.000.000 / 20.000.000`). | Ví A còn `3.000.000`, mục tiêu tăng lên `20.000.000` và tự động chuyển trạng thái `completed`. | Pass |
| **TC45** | UC23 | Chặn nạp khi mục tiêu đã hoàn thành hoặc vượt số dư ví | P0 | Nạp tiền vào mục tiêu có `status = 'completed'` hoặc nạp `> balance` ví. | Bị chặn ngay kèm thông báo lỗi cụ thể, không trừ tiền ví. | Pass |
| **TC46** | UC24 | Tạo giao dịch định kỳ & Tự động sinh khi đến hạn | P1 | Mở `/recurring`, tạo khoản `"Tiền trọ 3.000.000"` hàng tháng ngày `01`; gọi `generate_due_recurring_transactions`. | Tính đúng `next_due_date` kỳ kế tiếp; khi đến hạn tự sinh giao dịch tương ứng và không lặp. | Pass |

### 11. Nhóm NOTI_QR – Thông báo & Chia hóa đơn VietQR (`UC25`–`UC26`)
| Mã TC | Mã UC | Tên Test Case | Ưu tiên | Dữ liệu đầu vào & Các bước chính | Kết quả mong đợi | Trạng thái |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| **TC47** | UC25 | Đồng bộ thông báo ngân sách/định kỳ & Đánh dấu đã đọc | P1 | Chi vượt 80%/100% ngân sách -> gọi `sync_finance_notifications`; bấm Chuông thông báo -> Đánh dấu đã đọc. | Sinh đúng loại `budget_warning` (80–99%) vs `budget_exceeded` (>=100%); badge chưa đọc giảm về `0`; chặn client tự tạo notification giả. | Pass |
| **TC48** | UC26 | Chia hóa đơn (Bill Split) & Tạo mã VietQR Napas247 | P1 | Mở `/bill-split`, nhập tổng `600.000`, `4` người, chọn ngân hàng `VCB` + STK hợp lệ. | Tính đúng `150.000 VNĐ/người`, sinh URL `https://img.vietqr.io/...` đã sanitize khoảng trắng và hiển thị ảnh QR hợp lệ. | Pass |

### 12. Kiểm thử Phi chức năng – Bảo mật RLS & Responsive/PWA (`QA-02`)
| Mã TC | Mã UC | Tên Test Case | Ưu tiên | Dữ liệu đầu vào & Các bước chính | Kết quả mong đợi | Trạng thái |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| **TC49** | RLS (QA-02) | Cô lập dữ liệu đa người dùng (Row Level Security) | P0 | Đăng nhập User A, dùng token của User A truy vấn/sửa/xóa `wallets`, `transactions`, `budgets`, `notifications` thuộc `user_id` của User B. | PostgreSQL RLS (`auth.uid() = user_id`) trả về `0` bản ghi khi đọc và từ chối mọi thao tác sửa/xóa dữ liệu của User B. | Pass |
| **TC50** | UI/PWA | Giao diện Responsive Mobile & Cấu hình PWA | P2 | Mở ứng dụng trên khung nhìn Mobile (`390x844`) và Desktop (`1440x900`); kiểm tra `manifest.json` & `sw.js`. | Desktop hiện Floating Island Navbar, Mobile hiện Floating Bottom Dock không tràn ngang; `manifest.json` và Service Worker nạp hợp lệ. | Pass |


---

## PHẦN III. BỘ 14 ẢNH MINH CHỨNG KIỂM THỬ (EVIDENCE GALLERY)

Toàn bộ ảnh chụp minh chứng thực tế được lưu tại thư mục `docs/qa/evidence/` và ánh xạ trực tiếp vào cột **Minh chứng (Evidence)** trong file [SpendWise_Test_Plan_va_50_TestCases.xlsx](file:///c:/Users/Public/SpendWise/docs/qa/SpendWise_Test_Plan_va_50_TestCases.xlsx):

| STT | Tệp minh chứng | Ánh xạ Test Case | Nội dung kiểm chứng |
| :---: | :--- | :---: | :--- |
| 1 | [EVID_01_vitest_123_pass.png](evidence/EVID_01_vitest_123_pass.png) | TC01–TC49 | Kết quả chạy `npm test`: **16/16 file – 123/123 tests PASS** phủ 13 Service + Express API. |
| 2 | [EVID_02_build_lint_clean.png](evidence/EVID_02_build_lint_clean.png) | TC41 | Kết quả `npm run build` thành công, bundle `dist/` sạch không lộ `GEMINI_API_KEY`. |
| 3 | [EVID_03_login.png](evidence/EVID_03_login.png) | TC01–TC08 | Màn hình Đăng nhập (`/login`) với 1-Click Demo Login, 0 lỗi console. |
| 4 | [EVID_04_dashboard_sts.png](evidence/EVID_04_dashboard_sts.png) | TC31, TC38–TC39 | Trang Dashboard tổng quan & thẻ chỉ số Safe-to-spend trên Desktop (`1440x900`). |
| 5 | [EVID_05_quick_entry_preview.png](evidence/EVID_05_quick_entry_preview.png) | TC34–TC37 | Nhập nhanh `"cafe 35k hôm qua momo"` hiển thị khung Xem trước (`35.000 đ`, `2026-11-26`). |
| 6 | [EVID_06_ai_chat.png](evidence/EVID_06_ai_chat.png) | TC40, TC42 | Khung chat Trợ lý AI (`AiChatWidget`) bấm Quick Reply Chip & cơ chế fallback an toàn khi server AI gián đoạn. |
| 7 | [EVID_07_wallets.png](evidence/EVID_07_wallets.png) | TC09–TC15 | Màn hình Quản lý Ví & nút Chuyển tiền nội bộ (`/wallets`). |
| 8 | [EVID_08_transactions.png](evidence/EVID_08_transactions.png) | TC20–TC26 | Màn hình Danh sách Giao dịch, bộ lọc tìm kiếm & nút Export CSV (`/transactions`). |
| 9 | [EVID_09_budgets.png](evidence/EVID_09_budgets.png) | TC27–TC30 | Màn hình Ngân sách tháng (`/budgets`). |
| 10 | [EVID_10_reports.png](evidence/EVID_10_reports.png) | TC32–TC33 | Màn hình Báo cáo tài chính với biểu đồ Chart.js (`/reports`). |
| 11 | [EVID_11_goals.png](evidence/EVID_11_goals.png) | TC43–TC45 | Màn hình Mục tiêu tiết kiệm (`/goals`). |
| 12 | [EVID_12_recurring.png](evidence/EVID_12_recurring.png) | TC46 | Màn hình Giao dịch định kỳ (`/recurring`). |
| 13 | [EVID_13_vietqr.png](evidence/EVID_13_vietqr.png) | TC48 | Màn hình Chia hóa đơn (`600.000 đ / 4 người = 150.000 đ/người`) & mã QR VietQR Napas247 (`/bill-split`). |
| 14 | [EVID_14_mobile_responsive.png](evidence/EVID_14_mobile_responsive.png) | TC50 | Giao diện Responsive Mobile (`390x844`) với Floating Bottom Dock không tràn ngang. |

### Ghi nhận thực tế qua E2E Walkthrough (Đề xuất hoàn thiện trước ngày bảo vệ)
1. **Dữ liệu mẫu Demo:** Tài khoản `tung123@gmail.com` hiện đang trống giao dịch/ví/ngân sách (`0 đ`) -> khuyến nghị chạy `supabase/seed_demo_data.sql` trước buổi demo để các biểu đồ & thanh ngân sách hiển thị sinh động hơn.
2. **UI nút bấm & Navbar trên Desktop (`1440x900`):** ✅ **Đã khắc phục triệt để** — đã thêm `min-w-0 flex-1`, `shrink-0` và `whitespace-nowrap` cho `PageHeader.jsx`, `Navbar.jsx` và các nút hành động trên `WalletPage`, `TransactionPage`, `BudgetPage`, `RecurringPage` (đã xác minh lại 100% hiển thị 1 dòng gọn gàng và cập nhật 4 ảnh minh chứng mới).
3. **AI Backend (`POST /api/ai/chat`):** ✅ **Đã khắc phục & nâng cấp hoàn chỉnh** — nâng cấp sang SDK chính chủ `@google/genai` (`apiVersion: 'v1beta'`), hỗ trợ cả key `AIza...` và `AQ....`, bật `thinkingBudget: 0` + timeout 6s/model + cơ chế auto-fallback 2 tầng (`gemini-2.5-flash` ↔ `gemini-3.8-flash`). Đã kiểm thử E2E thực tế 5/5 câu hỏi (4 Quick Reply Chips + 1 câu tự do) đạt **HTTP `200 OK`** live trong ~3.5–4.3 giây và cập nhật ảnh minh chứng [EVID_06_ai_chat.png](evidence/EVID_06_ai_chat.png).
