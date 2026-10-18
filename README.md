# 💰 SpendWise – Hệ Thống Quản Lý Chi Tiêu Cá Nhân Thông Minh

> Dự án đồ án phát triển ứng dụng Web Responsive (Mobile-First) và Progressive Web App (PWA) hỗ trợ người dùng kiểm soát tài chính cá nhân chủ động.

---

## 🌟 Tính Năng Nổi Bật (3 Điểm Khác Biệt Cốt Lõi)
1. **Chỉ số Safe-to-spend hôm nay:** Tự động tính toán số tiền an toàn có thể chi tiêu trong ngày dựa trên hạn mức ngân sách còn lại, các khoản định kỳ sắp tới và số ngày còn lại trong tháng.
2. **Nhập nhanh bằng câu tự nhiên (Quick Entry):** Gõ câu tự nhiên như `"cafe 35k hôm qua momo"`, hệ thống tự tách số tiền, ngày, ví và danh mục với form xem trước an toàn.
3. **Trợ lý AI Gemini:** Hỏi đáp tra cứu lịch sử chi tiêu và nhận lời khuyên phân bổ tài chính thông minh qua Google Gemini API.

---

## 👥 Thành Viên Nhóm & Phân Công Chính Thức

> 📌 **DÀNH CHO THÀNH VIÊN NHẬN VIỆC:** Mọi thành viên bắt buộc đọc hướng dẫn chi tiết tại **[HUONG_DAN_LAM_VIEC.md](HUONG_DAN_LAM_VIEC.md)** để biết nhánh Git cần tạo, danh sách file code và mẫu viết Use Case.

| Vai trò | Thành viên | Phụ trách chính | Nhánh Git |
| :--- | :--- | :--- | :--- |
| **Leader / Tech Lead** | **Phan Thanh Tùng** | Kiến trúc hệ thống, Supabase DB 8 bảng, Trợ lý AI Gemini (`UC21`), Điều phối PR | `master` / `feature/ai-lead` |
| **TV1 (BA/QA Lead & Full-stack)** | **Trương Bích Vân** | Vẽ Use Case (1 tổng + 4 phân rã), Test Plan, Xác thực (`UC01-05`), Tiết kiệm (`UC22-23`), VietQR (`UC26`) | `feature/auth-goal-tv1` |
| **TV2 (Frontend Lead & UI/PWA)** | **Hồ Nguyên Văn** | Wireframe UI, PWA, Ngân sách tháng (`UC14-15`), Dashboard (`UC16`), Báo cáo Chart.js (`UC17`) | `feature/dashboard-reports-tv2` |
| **TV3 (Full-stack 1 - Core Data)** | **Nguyễn Vũ Tấn Huy** | Dữ liệu lõi, Quản lý Ví (`UC06-09`), Danh mục (`UC10-11`), Giao dịch & Xuất CSV (`UC12-13`) | `feature/wallets-txns-tv3` |
| **TV4 (Full-stack 2 - Smart & Auto)** | **Lê Hoài Quốc** | Vẽ Class Diagram, Nhập nhanh câu tự nhiên (`UC18-19`), Safe-to-spend (`UC20`), Định kỳ & Chuông (`UC24-25`) | `feature/smart-features-tv4` |

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)
* **Frontend:** Vite + React 19 + Tailwind CSS + Lucide Icons + Chart.js
* **Backend & Database:** Supabase (PostgreSQL 15 + Row Level Security)
* **Trí tuệ nhân tạo:** Google Gemini API (`@google/generative-ai`)
* **Tiện ích:** Chuẩn VietQR API (`img.vietqr.io`)

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dành Cho Thành Viên

### 1. Clone & Cài đặt thư viện
```bash
# Clone dự án về máy
git clone <URL_REPO_CUA_NHOM>
cd SpendWise

# Cài đặt toàn bộ dependencies
npm install
```

### 2. Cấu hình biến môi trường
Sao chép file `.env.example` thành `.env`:
```bash
cp .env.example .env
```
Mở file `.env` và điền cấu hình Supabase do Leader cung cấp:
```env
VITE_SUPABASE_URL=https://ndeohlqneywsducsyqsb.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Chạy ứng dụng ở môi trường phát triển
```bash
npm run dev
```
Mở trình duyệt tại: `http://localhost:5173`

---

## 📁 Cấu Trúc Mã Nguồn Chuẩn

```text
SpendWise/
├── docs/                    # Tài liệu thuyết minh & báo cáo
│   ├── use-cases/           # Mẫu đặc tả Use Case & bảng tra cứu 26 UC
│   ├── git/                 # Quy trình nhánh Git & Review PR
│   └── architecture/        # Sơ đồ kiến trúc 3 tầng & ERD 8 bảng
├── supabase/                # Script khởi tạo DB (init_schema.sql) & Dữ liệu mẫu (seed_demo_data.sql)
├── src/
│   ├── components/          # Giao diện dùng chung (common/, layout/, ai/)
│   ├── context/             # Quản lý phiên đăng nhập (AuthContext.jsx)
│   ├── lib/                 # Kết nối Supabase & Gemini API
│   ├── pages/               # 13 màn hình giao diện chính
│   ├── services/            # Tầng xử lý nghiệp vụ độc lập (12 services)
│   └── utils/               # Tiện ích format tiền VNĐ, bỏ dấu tiếng Việt
├── HUONG_DAN_LAM_VIEC.md    # Hướng dẫn nhận việc & phối hợp nhóm (BẮT BUỘC ĐỌC)
├── AI_RULES.md              # Quy tắc viết code & glossary cho AI và nhóm
├── PROJECT_SPEC.md          # Đặc tả kỹ thuật 12 nhóm chức năng
└── TASKS.md                 # Bảng theo dõi tiến độ chi tiết (Backlog)
```

---

## 📜 Tài Liệu Quan Trọng Cần Đọc
* **[HUONG_DAN_LAM_VIEC.md](HUONG_DAN_LAM_VIEC.md)** – Cẩm nang bắt đầu và phối hợp làm việc nhóm
* **[docs/use-cases/TEMPLATE_USE_CASE.md](docs/use-cases/TEMPLATE_USE_CASE.md)** – Mẫu viết đặc tả Use Case
* **[docs/use-cases/UC_INDEX_AND_ASSIGNMENT.md](docs/use-cases/UC_INDEX_AND_ASSIGNMENT.md)** – Bảng tra cứu 26 Use Cases chi tiết
* **[docs/git/WORKFLOW.md](docs/git/WORKFLOW.md)** – Quy định nhánh Git và review Pull Request
* **[docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)** – Thuyết minh kiến trúc 3 tầng và mô hình ERD
* **[TASKS.md](TASKS.md)** – Backlog phân công công việc chi tiết

