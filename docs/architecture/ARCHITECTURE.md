# THUYẾT MINH KIẾN TRÚC HỆ THỐNG & CƠ SỞ DỮ LIỆU (CHƯƠNG 4)

> **Tài liệu thuyết minh:** Phục vụ báo cáo thuyết minh đề tài SpendWise.
> **Chủ biên:** Leader – Phan Thanh Tùng (Project Manager & AI/DB Lead).

---

## 1. KIẾN TRÚC TÁCH BIỆT RÕ RÀNG GIỮA FRONTEND VÀ BACKEND

Hệ thống SpendWise được thiết kế theo mô hình **Client - Server - Database** phân định rõ ràng giữa hai phần Độc lập: **Frontend (Client)** và **Backend (Server)**:

```mermaid
graph TD
    subgraph "PHẦN 1: FRONTEND CLIENT (React 19 - Port 5173)"
        A1[React 19 AppRouter & Pages] --> A2[Tailwind CSS & Chart.js]
        A2 --> A3[PWA Shell & Mobile Dock]
        A1 --> A4[Service Layer: API Client]
    end

    subgraph "PHẦN 2: BACKEND REST API SERVER (Node.js + Express - Port 5000)"
        B1[Express HTTP Server - server.js]
        B2[REST Router: /api/ai/chat]
        B3[REST Router: /api/quick-entry/parse]
        B4[REST Router: /api/finance/safe-to-spend]
        B1 --> B2
        B1 --> B3
        B1 --> B4
        B2 --> B5[Google Gemini 1.5 Flash API]
    end

    subgraph "PHẦN 3: CƠ SỞ DỮ LIỆU & SECURITY (Supabase PostgreSQL 15)"
        C1[PostgreSQL 15 Database - 8 Bảng]
        C2[Row Level Security - RLS Policies]
        C3[Auth Server - auth.users]
        C4[Triggers & Analytical Views]
    end

    A4 -- "HTTP REST API Calls" --> B1
    A4 -- "PostgREST Client" --> C1
    B1 -- "Server-side Queries" --> C1
```

### 1.1. Phân hệ Frontend (Client - Cổng 5173)
* **Công nghệ:** React 19, Vite, Tailwind CSS, Lucide Icons, Chart.js.
* **Đặc điểm:** Ứng dụng Web Responsive (Mobile-First) và Progressive Web App (PWA).
* **Nhiệm vụ:** Xử lý hiển thị giao diện 13 màn hình, tiếp nhận tương tác người dùng, hiển thị đồ thị trực quan và gọi API về máy chủ Backend.

### 1.2. Phân hệ Backend (Server - Cổng 5000)
* **Công nghệ:** Node.js, Express framework, CORS, Dotenv.
* **Đặc điểm:** Máy chủ REST API độc lập nằm tại thư mục `server/`.
* **Nhiệm vụ cốt lõi:**
  1. Bảo mật API Key của Google Gemini, không để lộ key xuống trình duyệt người dùng.
  2. Bóc tách câu tự nhiên (Quick Entry Parser) phía Server.
  3. Cung cấp API tính toán công thức Safe-to-spend.
  4. Cung cấp API Healthcheck giám sát hoạt động của hệ thống.

### 1.3. Phân hệ Cơ sở dữ liệu (Data Layer - Supabase PostgreSQL)
* **Công nghệ:** PostgreSQL 15, Supabase Auth, Row Level Security (RLS).
* Quản trị 8 bảng dữ liệu quan hệ, kiểm soát quyền truy cập qua Row Level Security (RLS).
* Hệ thống Trigger tự động hóa: sinh ví mặc định khi đăng ký, tự động bỏ dấu tiếng Việt `note_unaccent`.
* Cung cấp các Views thống kê: `v_monthly_summary`, `v_budget_progress`.
- **Row Level Security (RLS)**: Bật bảo mật trên 100% các bảng. Người dùng chỉ có quyền truy xuất các bản ghi có `user_id = auth.uid()`.
- **Database Triggers**:
  * `trg_transactions_unaccent`: Tự động loại bỏ dấu tiếng Việt khi thêm/sửa giao dịch vào cột `note_unaccent`.
  * `on_auth_user_created`: Bắt sự kiện tạo user mới để tự sinh bản ghi `profiles` và ví `Tiền mặt` mặc định.

---

## 2. MÔ HÌNH THỰC THỂ QUAN HỆ (ERD - 8 BẢNG)

```mermaid
erDiagram
    PROFILES ||--o{ WALLETS : "sở hữu"
    PROFILES ||--o{ CATEGORIES : "tự tạo"
    PROFILES ||--o{ TRANSACTIONS : "thực hiện"
    PROFILES ||--o{ BUDGETS : "thiết lập"
    PROFILES ||--o{ SAVING_GOALS : "tạo mục tiêu"
    PROFILES ||--o{ RECURRING_RULES : "thiết lập định kỳ"
    PROFILES ||--o{ NOTIFICATIONS : "nhận thông báo"

    WALLETS ||--o{ TRANSACTIONS : "ghi nhận thu/chi"
    WALLETS ||--o{ SAVING_GOALS : "trích tiền nạp"
    WALLETS ||--o{ RECURRING_RULES : "thanh toán định kỳ"

    CATEGORIES ||--o{ TRANSACTIONS : "phân loại"
    CATEGORIES ||--o{ BUDGETS : "áp hạn mức"
    CATEGORIES ||--o{ RECURRING_RULES : "phân loại định kỳ"

    PROFILES {
        uuid id PK
        text full_name
        text avatar_url
        text default_bank_bin
        text default_bank_account
        timestamptz created_at
    }

    WALLETS {
        uuid id PK
        uuid user_id FK
        text name
        text type
        numeric balance
        text icon
        text color
        boolean is_archived
    }

    CATEGORIES {
        uuid id PK
        uuid user_id FK
        text name
        text type
        text_array keywords
        text icon
        text color
    }

    TRANSACTIONS {
        uuid id PK
        uuid user_id FK
        uuid wallet_id FK
        uuid to_wallet_id FK
        uuid category_id FK
        text type
        numeric amount
        date transaction_date
        text note
        text note_unaccent
    }

    BUDGETS {
        uuid id PK
        uuid user_id FK
        uuid category_id FK
        int month
        int year
        numeric amount_limit
    }

    SAVING_GOALS {
        uuid id PK
        uuid user_id FK
        uuid wallet_id FK
        text name
        numeric target_amount
        numeric current_amount
        date deadline
        text status
    }

    RECURRING_RULES {
        uuid id PK
        uuid user_id FK
        uuid wallet_id FK
        uuid category_id FK
        text title
        text type
        numeric amount
        text frequency
        int day_of_month
        date next_due_date
        boolean is_active
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        text title
        text message
        text type
        boolean is_read
    }
```
