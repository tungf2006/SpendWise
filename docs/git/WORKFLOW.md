# QUY TRÌNH PHỐI HỢP GIT & REVIEW CODE DỰ ÁN SPENDWISE

> **Áp dụng cho:** Cả 4 thành viên nhóm SpendWise.
> **Mục tiêu:** Tránh xung đột code (Merge Conflict), đảm bảo mã nguồn luôn build thành công trên nhánh chính.

---

## 1. NGUYÊN TẮC NHÁNH (BRANCHING STRATEGY)
- Nhánh **`main`** là nhánh phát hành (Production/Release), chỉ chứa mã nguồn ổn định, đã kiểm thử toàn diện và build thành công (`npm run build`).
- Nhánh **`develop`** là nhánh tích hợp trung tâm (Integration/Staging), nơi tiếp nhận các Pull Request từ các nhánh tính năng (`feature/*`).
- **CẤM** mọi thành viên push code trực tiếp lên cả hai nhánh `main` và `develop` (cả hai nhánh đều áp dụng Branch Protection).
- Mỗi thành viên khi làm task của mình phải tạo nhánh riêng từ **`develop`** theo quy ước:
  * TV1 (Trương Bích Vân - Auth & Goals & QR): `feature/auth-tv1`, `feature/goal-tv1`, `feature/vietqr-tv1`
  * TV2 (Hồ Nguyên Văn - UI/Dashboard & Budget & Report): `feature/dashboard-tv2`, `feature/budget-tv2`, `feature/report-tv2`
  * TV3 (Lê Hoài Quốc - Smart & Core Data): `feature/smart-features-tv3`, `feature/recurring-tv3`
  * Leader & Nhóm tiếp quản (Phan Thanh Tùng & TV3): `feature/ai-assistant-lead`, `feature/core-data-lead`

---

## 2. QUY TRÌNH 5 BƯỚC THỰC HIỆN CỦA MỖI THÀNH VIÊN

### Bước 1: Kéo code mới nhất từ `develop`
```bash
git checkout develop
git pull origin develop
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

### Bước 5: Mở Pull Request (PR) trỏ vào `develop`
1. Push nhánh lên GitHub: `git push -u origin feature/<ten-nhanh-cua-ban>`
2. Tạo Pull Request trên GitHub với:
   - **Base branch:** `develop`
   - **Compare branch:** `feature/<ten-nhanh-cua-ban>`
3. Gửi link PR vào nhóm Zalo/kênh nội bộ để Leader (Phan Thanh Tùng) và QA review, đối soát và duyệt merge vào `develop`.

---

## 3. QUY TRÌNH PHÁT HÀNH (MERGE DEVELOP VÀO MAIN)
1. Sau khi các nhánh `feature/*` hoàn thành kiểm thử và được merge đầy đủ vào `develop`.
2. Chạy toàn bộ bộ kiểm thử tự động (Regression Test) và build kiểm tra trên nhánh `develop`.
3. Khi mọi tiêu chí nghiệm thu đạt 100%, Leader thực hiện mở Pull Request từ `develop` vào `main` (`base: main <- compare: develop`), phê duyệt merge và gắn tag phát hành (Release tag).
