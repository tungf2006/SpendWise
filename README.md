# 💰 SpendWise – Hệ Thống Quản Lý Chi Tiêu Cá Nhân Thông Minh

> Dự án đồ án phát triển ứng dụng Web Responsive (Mobile-First) và Progressive Web App (PWA) hỗ trợ người dùng kiểm soát tài chính cá nhân chủ động.

---

## 🌟 Tính Năng Nổi Bật (3 Điểm Khác Biệt Cốt Lõi)
1. **Chỉ số Safe-to-spend hôm nay:** Tự động tính toán số tiền an toàn có thể chi tiêu trong ngày dựa trên hạn mức ngân sách còn lại, các khoản định kỳ sắp tới và số ngày còn lại trong tháng.
2. **Nhập nhanh bằng câu tự nhiên (Quick Entry):** Gõ câu tự nhiên như `"cafe 35k hôm qua momo"`, hệ thống tự tách số tiền, ngày, ví và danh mục với form xem trước an toàn.
3. **Trợ lý AI Gemini:** Hỏi đáp tra cứu lịch sử chi tiêu và nhận lời khuyên phân bổ tài chính thông minh qua Google Gemini API.

---

## 👥 Thành Viên Nhóm & Phân Công Vai Trò

| Vai trò | Phụ trách | Phạm vi công việc chính |
| :--- | :--- | :--- |
| **Leader / Tech Lead** | Phan Thanh Tùng | Kiến trúc hệ thống, Supabase DB, Thuật toán Parser, Gemini Client, PWA |
| **FS1 (Full-stack 1)** | Thành viên 2 | Xác thực Auth, Quản lý Danh mục, Giao dịch, Báo cáo Chart |
| **FS2 (Full-stack 2)** | Thành viên 3 | Quản lý Ví, Ngân sách, Công thức Safe-to-spend, Mục tiêu tiết kiệm |
| **FE (Frontend UI)** | Thành viên 4 | UI/UX Mobile-first, Dashboard, Danh sách ví, Dialogs & Micro-interactions |
| **BA / QA** | Thành viên 5 | Đặc tả Use cases, Sơ đồ lớp, Kiểm thử bảo mật RLS & Test cases thuật toán |

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
├── supabase/                # Script cơ sở dữ liệu (init_schema.sql)
├── src/
│   ├── components/          # Giao diện dùng chung (common/, layout/)
│   ├── context/             # Quản lý phiên đăng nhập (AuthContext.jsx)
│   ├── hooks/               # Custom hooks
│   ├── lib/                 # Kết nối Supabase & Gemini API
│   ├── pages/               # Màn hình chính (Auth, Dashboard, Wallets,...)
│   ├── services/            # Tầng xử lý nghiệp vụ độc lập (Business logic)
│   └── utils/               # Tiện ích format tiền VNĐ, bỏ dấu tiếng Việt
├── .env.example             # Mẫu biến môi trường
├── AI_RULES.md              # Quy tắc viết code & glossary cho AI và nhóm
├── PROJECT_SPEC.md          # Đặc tả kỹ thuật 12 chức năng
└── TASKS.md                 # Bảng theo dõi tiến độ chi tiết (Backlog)
```

---

## 📜 Tài Liệu Tham Khảo
* [AI_RULES.md](AI_RULES.md) – Quy tắc viết code và bảng thuật ngữ chuẩn
* [PROJECT_SPEC.md](PROJECT_SPEC.md) – Đặc tả 12 chức năng chi tiết
* [TASKS.md](TASKS.md) – Backlog phân công công việc chi tiết
