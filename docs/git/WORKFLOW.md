# QUY TRÌNH PHỐI HỢP GIT & REVIEW CODE DỰ ÁN SPENDWISE

> **Áp dụng cho:** Cả 5 thành viên nhóm SpendWise.
> **Mục tiêu:** Tránh xung đột code (Merge Conflict), đảm bảo mã nguồn luôn build thành công trên nhánh chính.

---

## 1. NGUYÊN TẮC NHÁNH (BRANCHING STRATEGY)
- Nhánh **`master`** là nhánh bảo vệ, chỉ chứa mã nguồn đã kiểm thử và build thành công (`npm run build`).
- **CẤM** mọi thành viên push code trực tiếp lên `master`.
- Mỗi thành viên khi làm task của mình phải tạo nhánh riêng từ `master` theo quy ước:
  * TV1 (Trương Bích Vân - Auth & Goals & QR): `feature/auth-tv1`, `feature/goal-tv1`, `feature/vietqr-tv1`
  * TV2 (Hồ Nguyên Văn - UI/Dashboard & Budget & Report): `feature/dashboard-tv2`, `feature/budget-tv2`, `feature/report-tv2`
  * TV3 (Nguyễn Vũ Tấn Huy - Wallets & Transactions & Categories): `feature/wallet-tv3`, `feature/category-tv3`, `feature/transaction-tv3`
  * TV4 (Lê Hoài Quốc - Smart & Recurring & Notifications): `feature/safe-to-spend-tv4`, `feature/recurring-tv4`
  * Leader (Phan Thanh Tùng - AI & DB Architecture): `feature/ai-assistant-lead`

---

## 2. QUY TRÌNH 5 BƯỚC THỰC HIỆN CỦA MỖI THÀNH VIÊN

### Bước 1: Kéo code mới nhất từ `master`
```bash
git checkout master
git pull origin master
```

### Bước 2: Tạo nhánh tính năng mới
```bash
git checkout -b feature/wallet-tv3
```

### Bước 3: Code và kiểm tra lỗi cục bộ
- Chỉ sửa các file thuộc phạm vi phân công của mình (xem `docs/use-cases/UC_INDEX_AND_ASSIGNMENT.md`).
- Chạy kiểm tra build trước khi commit:
```bash
npm run build
```
*(Nếu build báo lỗi, phải sửa hết lỗi trước khi commit)*

### Bước 4: Commit theo chuẩn Conventional Commits
```bash
git add .
git commit -m "feat(wallet): them modal chuyen tien noi bo giua 2 vi"
```
Quy ước tiền tố commit:
- `feat:` Thêm tính năng mới hoặc component mới.
- `fix:` Sửa lỗi nghiệp vụ hoặc giao diện.
- `docs:` Viết tài liệu thuyết minh, đặc tả Use Case.
- `style:` Tinh chỉnh CSS, màu sắc, khoảng cách.
- `refactor:` Tối ưu cấu trúc code mà không đổi logic.

### Bước 5: Mở Pull Request (PR) gửi Leader
1. Push nhánh lên GitHub/GitLab: `git push -u origin feature/wallet-tv3`
2. Tạo Pull Request trỏ vào nhánh `master`.
3. Gửi link PR vào nhóm Zalo để Leader (Phan Thanh Tùng) review và merge vào nhánh chính.
