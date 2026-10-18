# 🖥️ SPENDWISE BACKEND REST API SERVICE

> **Phân hệ Backend Độc lập:** Xây dựng bằng Node.js + Express REST API.  
> **Chủ biên:** Leader – Phan Thanh Tùng (Project Manager & AI/DB Lead).  
> **Cổng mặc định:** `http://localhost:5000`

---

## 1. MỤC TIÊU CỦA PHÂN HỆ BACKEND
1. **Tách biệt hoàn toàn Kiến trúc BE & FE:** Đáp ứng 100% tiêu chí đồ án về phân định rõ ràng giữa Client (Giao diện) và Server (Nghiệp vụ & API).
2. **Bảo mật API Key:** Xử lý và gọi Google Gemini API tại máy chủ Backend, giấu kín `VITE_GEMINI_API_KEY` không để lộ ra phía trình duyệt người dùng.
3. **Cung cấp RESTful Endpoints:** Cho phép tính toán Safe-to-spend, bóc tách câu tự nhiên NLP và phục vụ mở rộng trong tương lai.

---

## 2. HƯỚNG DẪN KHỞI CHẠY BACKEND

### Cách 1: Chạy trực tiếp từ thư mục gốc dự án
```bash
npm run server
```

### Cách 2: Chạy từ thư mục `server/`
```bash
cd server
npm start
```
Server sẽ lắng nghe tại: `http://localhost:5000`

---

## 3. DANH SÁCH ENDPOINTS CHÍNH THỨC

### 1. Healthcheck Endpoint
* **URL:** `GET /api/finance/health`
* **Mô tả:** Kiểm tra tình trạng hoạt động và thời gian uptime của máy chủ Backend.
* **Phản hồi mẫu:**
```json
{
  "status": "online",
  "service": "SpendWise Backend REST API",
  "version": "1.0.0",
  "uptime": 124.5,
  "timestamp": "2026-10-18T11:00:00.000Z"
}
```

### 2. Trợ lý AI Gemini Chatbot Endpoint (UC21)
* **URL:** `POST /api/ai/chat`
* **Mô tả:** Tiếp nhận câu hỏi và ngữ cảnh tài chính của người dùng, gọi Google Gemini API tại máy chủ và trả kết quả tư vấn thông minh.
* **Request Body:**
```json
{
  "prompt": "Hôm nay tôi có thể tiêu bao nhiêu tiền an toàn?",
  "context": {
    "safe_to_spend_hom_nay": 125000,
    "tong_so_du_vi": 15000000,
    "so_ngay_con_lai_trong_thang": 14
  }
}
```
* **Phản hồi mẫu:**
```json
{
  "success": true,
  "reply": "Chào bạn, hôm nay bạn có thể chi tiêu an toàn tối đa 125.000 VNĐ...",
  "timestamp": "2026-10-18T11:00:05.000Z"
}
```

### 3. Bộ phân tích câu tự nhiên NLP (Quick Entry Parser - UC18)
* **URL:** `POST /api/quick-entry/parse`
* **Mô tả:** Nhận chuỗi văn bản tự nhiên tiếng Việt, bóc tách ra số tiền, ngày, ví, loại thu/chi và danh mục.
* **Request Body:**
```json
{
  "text": "cafe 35k hôm qua momo"
}
```
* **Phản hồi mẫu:**
```json
{
  "success": true,
  "data": {
    "rawText": "cafe 35k hôm qua momo",
    "amount": 35000,
    "date": "2026-10-17",
    "walletKeyword": "momo",
    "type": "expense",
    "categoryName": "Ăn uống"
  }
}
```

### 4. Tính toán chỉ số Safe-to-spend (UC20)
* **URL:** `POST /api/finance/safe-to-spend`
* **Request Body:**
```json
{
  "remainingBudget": 4000000,
  "upcomingRecurring": 500000,
  "daysLeft": 14
}
```
* **Phản hồi:**
```json
{
  "success": true,
  "data": {
    "safeToSpendToday": 250000,
    "remainingBudget": 4000000,
    "upcomingRecurring": 500000,
    "daysLeft": 14,
    "formula": "max(0, (remainingBudget - upcomingRecurring) / daysLeft)"
  }
}
```
