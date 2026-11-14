# BÁO CÁO RÀ SOÁT VÀ ĐỀ XUẤT XỬ LÝ TÀI NGUYÊN REPOSITORY SPENDWISE

> **Dự án:** SpendWise – Hệ thống quản lý chi tiêu cá nhân thông minh  
> **Chặng thực hiện:** Chặng 1 – Dọn nền Git, rà soát repository, thiết lập Branch Protection và chuẩn hóa tài liệu quy trình  
> **Ngày lập báo cáo:** 13/11/2026  
> **Người thực hiện:** Đội ngũ Kỹ thuật & QA Dự án SpendWise  
> **Căn cứ yêu cầu:** Mục R1 trong `ORIGINAL_REQUEST.md` và `PROJECT.md` (Milestone M1)

---

## 1. MỤC ĐÍCH & PHẠM VI RÀ SOÁT

Trong quá trình phát triển nhanh các Sprint của đồ án SpendWise, kho lưu trữ mã nguồn đã trải qua nhiều đợt tích hợp, đóng gói hồ sơ nộp bài và tích hợp công cụ AI hỗ trợ. Mục đích của báo cáo này là:
1. **Kiểm kê toàn diện:** Rà soát toàn bộ cây thư mục làm việc (Working Tree), các tệp chưa được theo dõi (untracked files), tệp bị thay đổi (modified files) và lịch sử các commit đã đẩy lên Git.
2. **Phát hiện tệp thừa & trùng lặp:** Định danh chính xác các tệp tin nén dung lượng lớn, các tệp ảnh sơ đồ bị trùng lặp byte-for-byte, các tệp rác hệ điều hành/môi trường phát sinh.
3. **Đề xuất xử lý minh bạch:** Đưa ra phương án xử lý cụ thể (`git rm`, cập nhật `.gitignore`, `keep`) kèm đánh giá rủi ro để Người dùng (hoặc Leader/Giảng viên) xem xét và phê duyệt trước khi thực thi xóa vĩnh viễn.

---

## 2. BẢNG TỔNG HỢP KIỂM KÊ VÀ ĐỀ XUẤT XỬ LÝ (REPOSITORY INVENTORY)

Dưới đây là danh mục chi tiết 10 đối tượng tài nguyên được rà soát, đánh giá thực trạng và kiến nghị phương án giải quyết:

| STT | Đối tượng / Đường dẫn | Trạng thái Git | Kích thước / Chi tiết | Đánh giá bản chất | Hành động đề xuất | Rủi ro & Lưu ý |
| :---: | :--- | :---: | :---: | :--- | :--- | :--- |
| **1** | `Bao_Cao_Thuyet_Minh_Thiet_Ke_SpendWise_Chinh_Thuc.zip` | Committed (Commit `78887e9`) | 5,591,117 bytes (~5.59 MB) | File zip nén 39 tệp báo cáo nộp bài cho Giảng viên. Toàn bộ 39 tệp bên trong (gồm 3 sơ đồ kiến trúc, 5 sơ đồ use case, 26 file đặc tả UC và 5 sơ đồ class diagram) **đều đã tồn tại độc lập dạng markdown và ảnh PNG trong thư mục `docs/`**. Việc lưu thêm file zip này trên Git gây phình to vô ích kích thước `.git/` và dung lượng clone/pull. | **Gỡ bỏ khỏi Git:**<br>`git rm Bao_Cao_Thuyet_Minh_Thiet_Ke_SpendWise_Chinh_Thuc.zip`<br>Đồng thời bổ sung rule `*.zip` vào `.gitignore`. Lưu file zip này tại kho lưu trữ ngoài hoặc GitHub Releases nếu cần nộp bài. | **Thấp.** Không ảnh hưởng đến mã nguồn ứng dụng hay tài liệu dự án vì tất cả nội dung đã có trong `docs/`. Cần User xác nhận trước khi commit xóa. |
| **2** | `docs/architecture/deployment_diagram.png` | Committed (Commit `78887e9`) | 418,168 bytes (~408 KB) | Trùng lặp hoàn toàn byte-for-byte (SHA-256: `993FDE97292C92EAD7DFCDDCDA6A4CC4331E4CA899F741F9F2784A030AAB9A84`) với `docs/diagrams/architecture/deployment_diagram.png`. Tệp `docs/architecture/ARCHITECTURE.md` không nhúng ảnh này. | **Xóa file trùng lặp:**<br>`git rm docs/architecture/deployment_diagram.png`<br>Giữ bản chính tại thư mục chuẩn `docs/diagrams/architecture/`. | **Không có.** Ảnh gốc chuẩn đã được lưu trữ trong `docs/diagrams/architecture/`. |
| **3** | `docs/architecture/erd_8_tables.png` | Committed (Commit `78887e9`) | 477,599 bytes (~466 KB) | Trùng lặp hoàn toàn byte-for-byte (SHA-256: `D411DB3125B1E04C3C10F57F5E6F23D71042FB7818BECD325F7C91B6D87804E1`) với `docs/diagrams/architecture/erd_8_tables.png`. | **Xóa file trùng lặp:**<br>`git rm docs/architecture/erd_8_tables.png`<br>Giữ bản chính tại thư mục chuẩn `docs/diagrams/architecture/`. | **Không có.** |
| **4** | `docs/architecture/system_architecture.png` | Committed (Commit `78887e9`) | 504,907 bytes (~493 KB) | Trùng lặp hoàn toàn byte-for-byte (SHA-256: `D196AF0EC15ADA55CCC910DABF5110CDE3B359608172FE15D96992FF8C6AE22E`) với `docs/diagrams/architecture/system_architecture.png` (bản đi kèm file vẽ gốc `.drawio`). | **Xóa file trùng lặp:**<br>`git rm docs/architecture/system_architecture.png`<br>Giữ bản chính tại thư mục chuẩn `docs/diagrams/architecture/`. | **Không có.** |
| **5** | Thư mục `.agent/` (`.agent/skills/{docx,pdf,pptx,xlsx}`) | Untracked (`?? .agent/`) | 182 files, 3,542,060 bytes (~3.54 MB) | Chứa các công cụ bổ trợ Python scripts và schemas cho AI Agent xử lý tài liệu Office. Không phải mã nguồn SpendWise và không nên đưa vào Git repo. | **Cập nhật `.gitignore`:** Bổ sung `.agent/` và `.agents/` vào `.gitignore` (đã thực hiện). Giữ lại tệp trên ổ đĩa để AI Agent tiếp tục phục vụ người dùng. | **Không có.** `.agent/` chỉ phục vụ agent cục bộ, không đẩy lên repo. |
| **6** | Tệp `.gitignore` | Committed / Modified | 38 dòng ban đầu | `.gitignore` ban đầu thiếu các khối quan trọng: chặn file nén (`*.zip`, `*.tar.gz`), chặn thư mục agent (`.agent/`, `.agents/`), python artifacts (`__pycache__/`, `*.pyc`), OS metadata (`desktop.ini`, `._*`), test coverage (`coverage/`). | **Đã nâng cấp:** Bổ sung đầy đủ 5 khối quy tắc tiêu chuẩn, bảo vệ repository khỏi các nguy cơ ô nhiễm trong tương lai. | **Không có.** Rất an toàn và tăng cường bảo mật repo. |
| **7** | Tệp `GEMINI.md` | Modified (Working Tree) | ~25.5 KB | Bộ não kiến thức dự án (Knowledge Base) ghi lại phân công 4 thành viên, danh mục 26 Use Cases, ràng buộc DB 8 bảng và quy chuẩn tài liệu nộp đồ án. | **Giữ lại (Keep):** Giữ nguyên vẹn, tiếp tục đồng bộ và đưa vào commit cập nhật tài liệu chính thức. | **Không có.** Đây là tài liệu lõi của dự án. |
| **8** | Nhánh `develop` so với `main` | Outdated Branch | Trễ 39 commit trên máy và 35 commit trên remote | `origin/develop` dừng ở commit `305a2da` (27/10), local `develop` dừng ở `d06ad0b` (19/10), trong khi `main` đã tiến tới `7262402`. Tuy nhiên `develop` là tổ tiên trực tiếp (`ancestor`) của `main`, độ lệch là thuần túy 0 commit xung đột. | **Đồng bộ Fast-Forward:**<br>1. Local: Đã đồng bộ `develop` lên `7262402` an toàn.<br>2. Remote: Leader chạy `git push origin develop` để hoàn tất đồng bộ GitHub. | **Không có.** Do là Fast-Forward thuần túy nên không gây mất mát hay xung đột code. |
| **9** | 6 nhánh tính năng cũ trên `origin/` (`origin/docs/*`, `origin/feature/*`) | Remote Stale Branches | 6 nhánh đã merge | Các nhánh tính năng của TV1, TV2, TV3, Leader đã được merge trọn vẹn vào `main` qua các Pull Requests (#33, #34, #38, #40, #41, #42) nhưng chưa được xóa trên remote GitHub. | **Dọn dẹp nhánh GitHub:** Sau khi hoàn thành Chặng 1 và nghiệm thu, Leader có thể xóa các nhánh này trên GitHub để danh sách branch gọn gàng. | **Thấp.** Nhánh đã merge hoàn toàn, có thể khôi phục lại từ commit lịch sử nếu cần. |
| **10** | Thư mục `NOP_BAI_16_11/` | Đã xóa | 0 byte | Thư mục nộp bài tạm thời trước đây. Đã được người dùng xác nhận xóa vĩnh viễn khỏi máy cục bộ. | **Đã xử lý xong:** Không còn bất kỳ dấu vết nào trong Working Tree cũng như trong lịch sử Git. | **Không có.** |

---

## 3. CHI TIẾT PHÂN TÍCH KỸ THUẬT CÁC TỆP CẦN XỬ LÝ

### 3.1. File nén `Bao_Cao_Thuyet_Minh_Thiet_Ke_SpendWise_Chinh_Thuc.zip` (5.59 MB)
- **Lịch sử commit:** File được commit tại `78887e97869d256df2a6bfee736b3bd05ccf4496` ngày 12/11/2026 bởi Leader Phan Thanh Tùng với thông điệp *"docs: sync all 26 standardized Use Cases, architecture/class diagrams, and official design report package"*.
- **Cấu trúc nội dung bên trong:**
  - `01_KIEN_TRUC_HE_THONG/`: gồm `deployment_diagram.png`, `erd_8_tables.png`, `system_architecture.png`.
  - `02_LUOC_DO_USE_CASE/`: gồm 5 sơ đồ tổng thể/phân rã `.png` và 26 file `.md` (`UC01.md` – `UC26.md`).
  - `03_LUOC_DO_LOP/`: gồm 5 sơ đồ class diagram `.png`.
- **Đánh giá mức độ cần thiết:**
  - Toàn bộ 39 tệp tin trên đã được lưu trữ công khai, minh bạch tại:
    - `docs/diagrams/architecture/` (chứa các sơ đồ kiến trúc + file gốc `system_architecture.drawio`)
    - `docs/diagrams/use-case/` và `docs/use-cases/` (chứa 5 sơ đồ use case + 26 file đặc tả)
    - `docs/diagrams/` (chứa 5 sơ đồ class diagram)
  - Vì vậy, file `.zip` 5.59 MB hoàn toàn là bản sao dư thừa. Việc duy trì file nén nhị phân này trong Git khiến repository bị tăng dung lượng không cần thiết và vi phạm best practices về quản trị mã nguồn.

### 3.2. Sự trùng lặp giữa `docs/architecture/*.png` và `docs/diagrams/architecture/*.png` (1.40 MB)
- **Kiểm tra đối chiếu mã băm (Get-FileHash SHA-256):**
  ```text
  Algorithm  Hash                                                              Path
  ---------  ----                                                              ----
  SHA256     993FDE97292C92EAD7DFCDDCDA6A4CC4331E4CA899F741F9F2784A030AAB9A84 docs/architecture/deployment_diagram.png
  SHA256     993FDE97292C92EAD7DFCDDCDA6A4CC4331E4CA899F741F9F2784A030AAB9A84 docs/diagrams/architecture/deployment_diagram.png

  SHA256     D411DB3125B1E04C3C10F57F5E6F23D71042FB7818BECD325F7C91B6D87804E1 docs/architecture/erd_8_tables.png
  SHA256     D411DB3125B1E04C3C10F57F5E6F23D71042FB7818BECD325F7C91B6D87804E1 docs/diagrams/architecture/erd_8_tables.png

  SHA256     D196AF0EC15ADA55CCC910DABF5110CDE3B359608172FE15D96992FF8C6AE22E docs/architecture/system_architecture.png
  SHA256     D196AF0EC15ADA55CCC910DABF5110CDE3B359608172FE15D96992FF8C6AE22E docs/diagrams/architecture/system_architecture.png
  ```
- **Kết luận:** Trùng lặp byte-for-byte 100%. Quy hoạch chuẩn của dự án là đưa toàn bộ diagram vào `docs/diagrams/`. Do đó, việc xóa 3 file trong `docs/architecture/` giải phóng ~1.40 MB dư thừa trên working tree mà không làm mất bất kỳ thông tin nào.

---

## 4. KẾ HOẠCH HÀNH ĐỘNG ĐỀ XUẤT CHO NGƯỜI DÙNG / LEADER

Để đảm bảo tính toàn vẹn và nguyên tắc **Integrity Mandate**, các hành động xóa tệp committed (`git rm`) sẽ được thực thi khi có sự xác nhận của Quản trị viên/User:

### Bước 1: Các hành động đã được thực hiện an toàn ngay trong Chặng 1
1. **Đồng bộ nhánh cục bộ `develop`:** Đã cập nhật `develop` trỏ chính xác về commit `72624024260f6cdd62341d9c99c82c2095e3ea22`, ngang bằng với `main`.
2. **Cập nhật `.gitignore`:** Đã bổ sung 5 khối rule chuẩn, lập tức loại trừ hoàn toàn 182 files untracked của `.agent/` và ngăn chặn commit file `.zip`, `.tar.gz`, python cache hay OS metadata trong tương lai.

### Bước 2: Các lệnh đề xuất Quản trị viên / Leader thực hiện tiếp theo (Chờ phê duyệt)
```bash
# 1. Gỡ bỏ file zip nộp bài và 3 ảnh trùng lặp khỏi Git tracking:
git rm Bao_Cao_Thuyet_Minh_Thiet_Ke_SpendWise_Chinh_Thuc.zip
git rm docs/architecture/deployment_diagram.png
git rm docs/architecture/erd_8_tables.png
git rm docs/architecture/system_architecture.png

# 2. Tạo commit dọn dẹp vệ sinh repository:
git commit -m "chore(repo): remove redundant zip package and duplicate architecture diagrams"

# 3. Đồng bộ nhánh develop lên GitHub (yêu cầu quyền push hoặc mở PR):
git push origin develop
```

---

## 5. KẾT LUẬN

Báo cáo này đã cung cấp bức tranh hoàn chỉnh, minh bạch về hiện trạng kho lưu trữ SpendWise. Việc thực thi các đề xuất trên sẽ giúp repository giảm bớt hơn **7.0 MB** dữ liệu dư thừa, chuẩn hóa cấu trúc thư mục tài liệu và thiết lập hàng rào bảo vệ vững chắc qua file `.gitignore` cải tiến.
