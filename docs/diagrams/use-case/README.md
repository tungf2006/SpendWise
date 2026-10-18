# HƯỚNG DẪN NỘP SƠ ĐỒ USE CASE (USE CASE DIAGRAMS)

> **Người phụ trách vẽ:** Trương Bích Vân (TV1 - BA/QA Lead)  
> **Công cụ khuyến nghị:** [draw.io](https://app.diagrams.net/) (hoặc extension Draw.io trên VS Code)

---

## 1. Cấu trúc file cần nộp vào thư mục này

Thành viên nộp cả **file nguồn (.drawio)** và **ảnh xuất ra (.png / .svg)** theo danh mục sau:

| STT | Tên sơ đồ | Tên file .drawio (nguồn) | Tên file ảnh (đưa vào báo cáo) |
| :---: | :--- | :--- | :--- |
| 1 | **Sơ đồ Use Case tổng quát** | `use_case_tong_quat.drawio` | `use_case_tong_quat.png` |
| 2 | **Phân rã nhóm Xác thực (AUTH)** | `use_case_auth.drawio` | `use_case_auth.png` |
| 3 | **Phân rã Quản lý Dữ liệu lõi (Ví, Danh mục, Giao dịch)** | `use_case_core_data.drawio` | `use_case_core_data.png` |
| 4 | **Phân rã Kế hoạch & AI (Ngân sách, Safe-to-spend, AI Bot)** | `use_case_smart_ai.drawio` | `use_case_smart_ai.png` |
| 5 | **Phân rã Mục tiêu, Định kỳ & VietQR** | `use_case_goals_qr.drawio` | `use_case_goals_qr.png` |

---

## 2. Quy trình nộp qua Git & Pull Request

1. Kéo mã nguồn mới nhất từ nhánh `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   ```

2. Tạo nhánh tài liệu:
   ```bash
   git checkout -b docs/DOC-01-use-case-diagram
   ```

3. Lưu các file `.drawio` và `.png` vào thư mục này (`docs/diagrams/use-case/`).

4. Commit và đẩy lên GitHub:
   ```bash
   git add docs/diagrams/use-case/
   git commit -m "docs(use-case): add system use case and decomposition diagrams"
   git push -u origin docs/DOC-01-use-case-diagram
   ```

5. Vào GitHub tạo **Pull Request (PR)** từ nhánh `docs/DOC-01-use-case-diagram` vào nhánh `develop`.
6. Leader duyệt (review hình ảnh) và bấm **Merge Pull Request**.
