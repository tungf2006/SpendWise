# HƯỚNG DẪN THIẾT LẬP BRANCH PROTECTION CHO QUẢN TRỊ VIÊN REPOSITORY SPENDWISE

> **Dự án:** SpendWise – Quản lý chi tiêu cá nhân thông minh  
> **Tài liệu:** Cẩm nang quản trị Branch Protection (Chặng 1)  
> **Người thực hiện chính:** Quản trị viên Kho lưu trữ (Leader Phan Thanh Tùng – `tungf2006`)  
> **Đối tượng áp dụng:** Nhánh `main` (Production) và nhánh `develop` (Integration)  
> **Căn cứ:** Yêu cầu R2 trong `ORIGINAL_REQUEST.md` và `PROJECT.md` (Milestone M2)

---

## 1. MỤC TIÊU VÀ NGUYÊN TẮC BẢO VỆ NHÁNH

Để đảm bảo tính toàn vẹn mã nguồn, ngăn ngừa rủi ro ghi đè lịch sử (overwrite history), xóa nhầm nhánh hoặc đẩy thẳng mã nguồn chưa qua kiểm thử lên hệ thống, nhóm SpendWise áp dụng chính sách bảo vệ nghiêm ngặt đối với 2 nhánh trung tâm:
- **Nhánh `main`:** Bản phát hành chính thức (Production). Tuyệt đối không cho phép push trực tiếp. Chỉ nhận mã nguồn thông qua Pull Request từ nhánh `develop` sau khi đã kiểm thử nghiệm thu toàn diện.
- **Nhánh `develop`:** Bản tích hợp trung tâm (Staging / Integration). Tuyệt đối không cho phép push trực tiếp. Mọi đóng góp tính năng (`feature/*`) hay sửa lỗi (`bugfix/*`) bắt buộc phải thông qua Pull Request có tối thiểu **1 review phê duyệt** (approvals).

---

## 2. PHƯƠNG PHÁP 1: CẤU HÌNH QUA GIAO DIỆN WEB GITHUB (CLASSIC BRANCH PROTECTION) — KHUYẾN NGHỊ

Đây là phương thức trực quan, dễ thao tác nhất và tương thích với mọi loại tài khoản GitHub (Free, Pro, Team).

### 2.1. Cấu hình bảo vệ cho nhánh `main`

1. Đăng nhập GitHub bằng tài khoản quản trị `tungf2006` và truy cập kho lưu trữ:  
   👉 **`https://github.com/tungf2006/SpendWise`**
2. Bấm vào tab **Settings** (biểu tượng bánh răng ở thanh menu trên cùng).
3. Ở thanh điều hướng bên trái, chọn mục **Branches** (nằm dưới nhóm *Code and automation*).
4. Tại phần **Branch protection rules**, bấm nút **Add branch protection rule** (hoặc nút **Add rule**).
5. Điền thông số chi tiết như sau:
   - **Branch name pattern:** Điền chính xác `main`
   - **Protect matching branches:** Tích chọn các mục sau:
     - [x] **Require a pull request before merging**
       - [x] **Require approvals:** Chọn số lượng là `1` (ít nhất 1 thành viên hoặc QA review).
       - [x] **Dismiss stale pull request approvals when new commits are pushed:** (Tự động hủy phê duyệt cũ khi có commit mới được đẩy lên PR, bắt buộc phải review lại).
       - [x] **Require review from Code Owners** (Tùy chọn, nếu có khai báo file `.github/CODEOWNERS`).
     - [x] **Require status checks to pass before merging** (Kích hoạt nếu có thiết lập GitHub Actions CI kiểm tra build/lint).
       - [x] **Require branches to be up to date before merging** (Yêu cầu code nhánh phải cập nhật mới nhất với `main` trước khi gộp).
     - [x] **Do not allow bypassing the above settings:** (Bắt buộc áp dụng quy tắc này cho cả Quản trị viên/Administrators).
     - [x] **Restrict who can push to matching branches:** Bật tùy chọn này và **KHÔNG** thêm bất kỳ người dùng hay đội nhóm nào vào danh sách push trực tiếp.
6. Bấm nút **Create** (hoặc **Save changes**) ở cuối trang. Nhập mật khẩu tài khoản GitHub nếu hệ thống yêu cầu xác thực bảo mật.

---

### 2.2. Cấu hình bảo vệ cho nhánh `develop`

Sau khi tạo xong rule cho `main`, quản trị viên tiến hành tạo rule thứ hai cho `develop`:

1. Vẫn tại trang **Settings** -> **Branches**, bấm nút **Add branch protection rule** lần thứ 2.
2. Điền thông số chi tiết cho `develop`:
   - **Branch name pattern:** Điền chính xác `develop`
   - **Protect matching branches:** Tích chọn:
     - [x] **Require a pull request before merging**
       - [x] **Require approvals:** Chọn số lượng là `1`.
       - [x] **Dismiss stale pull request approvals when new commits are pushed:** Tích chọn.
     - [x] **Require status checks to pass before merging** (nếu có CI).
     - [x] **Do not allow bypassing the above settings:** Tích chọn.
     - [x] **Restrict who can push to matching branches:** Bật tùy chọn này và **KHÔNG** thêm ai vào danh sách push. Điều này đảm bảo 100% các thành viên phải tạo PR từ nhánh `feature/*` vào `develop`.
3. Bấm nút **Create** (hoặc **Save changes**) để lưu cấu hình.

---

## 3. PHƯƠNG PHÁP 2: CẤU HÌNH QUA GIAO DIỆN GITHUB RULESETS (GIAO DIỆN MỚI CỦA GITHUB)

GitHub cung cấp giao diện quản trị quy tắc mới linh hoạt hơn gọi là **Rulesets**. Quản trị viên có thể áp dụng 1 ruleset chung cho cả hai nhánh cùng lúc:

1. Truy cập: `https://github.com/tungf2006/SpendWise/settings/rules`
2. Bấm nút **New ruleset** -> Chọn **New branch ruleset**.
3. Thiết lập thông tin chung:
   - **Ruleset Name:** `SpendWise Core Branches Protection`
   - **Enforcement status:** Chọn **Active** (Kích hoạt).
4. Mục **Target branches:**
   - Chọn **Add target** -> Chọn **Include default branch** (tự động bao gồm `main`).
   - Bấm **Add target** lần nữa -> Chọn **Include by fnmatch pattern** -> Điền `develop`.
5. Mục **Branch rules:** Tích chọn các điều kiện bảo vệ:
   - [x] **Restrict deletions:** Cấm xóa nhánh `main` và `develop`.
   - [x] **Block force pushes:** Chặn hoàn toàn `git push --force`.
   - [x] **Require a pull request before merging:**
     - **Required approvals:** `1`
     - [x] **Dismiss stale pull request approvals when new commits are pushed**
     - [x] **Require code owner review** (tùy chọn)
   - [x] **Do not allow bypassing the above settings:** Áp dụng cho cả Administrators.
6. Bấm **Create** để lưu và áp dụng Ruleset.

---

## 4. PHƯƠNG PHÁP 3: THIẾT LẬP TỰ ĐỘNG BẰNG GITHUB CLI (`gh api`) VÀ CÔNG CỤ CƠ SỞ (`curl`) TRÊN MÁY QUẢN TRỊ VIÊN

Nếu Quản trị viên sử dụng terminal cá nhân trên máy trạm đã có quyền truy cập repo GitHub, có thể kích hoạt bảo vệ tự động bằng GitHub CLI (`gh api`) hoặc công cụ `curl` tiêu chuẩn qua GitHub REST API endpoint `PUT /repos/{owner}/{repo}/branches/{branch}/protection`.

### 4.1. Bước chuẩn bị xác thực trên terminal cá nhân

- **Cách 1: Đối với GitHub CLI (`gh`):**
  ```bash
  # Đăng nhập vào GitHub CLI với quyền repo
  gh auth login -w -s repo,admin:repo_hook
  ```

- **Cách 2: Đối với `curl` (Sử dụng Personal Access Token):**
  Tạo Personal Access Token (PAT) có phạm vi quyền `repo` tại `https://github.com/settings/tokens`, sau đó thiết lập biến môi trường:
  ```bash
  # Linux / macOS / Git Bash:
  export GITHUB_TOKEN="ghp_yourPersonalAccessTokenHere"

  # Windows PowerShell:
  $env:GITHUB_TOKEN="ghp_yourPersonalAccessTokenHere"
  ```

---

### 4.2. Thiết lập bằng GitHub CLI (`gh api`)

> **⚠️ Lưu ý kỹ thuật quan trọng về cờ `-F` (`--field`):**  
> GitHub CLI phân biệt giữa cờ `-f` (`--raw-field`: luôn gửi giá trị dưới dạng chuỗi `string`) và cờ `-F` (`--field`: tự động ép kiểu thành JSON boolean `true`/`false`, số nguyên `int`, hoặc `null` literal).  
> GitHub REST API yêu cầu `required_status_checks` và `restrictions` phải là `object` hoặc `null` nguyên bản (không được là chuỗi `"null"`). Do đó, **bắt buộc sử dụng `-F`** không có dấu nháy quanh `null` để tránh lỗi **HTTP 422 Unprocessable Entity**.

#### a) Lệnh bảo vệ nhánh `main`:
```bash
gh api --method PUT repos/tungf2006/SpendWise/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -F required_status_checks=null \
  -F enforce_admins=true \
  -F "required_pull_request_reviews[dismiss_stale_reviews]=true" \
  -F "required_pull_request_reviews[require_code_owner_reviews]=false" \
  -F "required_pull_request_reviews[required_approving_review_count]=1" \
  -F restrictions=null \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

#### b) Lệnh bảo vệ nhánh `develop`:
```bash
gh api --method PUT repos/tungf2006/SpendWise/branches/develop/protection \
  -H "Accept: application/vnd.github+json" \
  -F required_status_checks=null \
  -F enforce_admins=true \
  -F "required_pull_request_reviews[dismiss_stale_reviews]=true" \
  -F "required_pull_request_reviews[require_code_owner_reviews]=false" \
  -F "required_pull_request_reviews[required_approving_review_count]=1" \
  -F restrictions=null \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

---

### 4.3. Thiết lập bằng lệnh `curl` tiêu chuẩn (Raw JSON Payload)

Dành cho môi trường Linux/macOS/Git Bash hoặc máy chủ CI/CD không cài sẵn GitHub CLI. Lệnh truyền trực tiếp payload JSON với đầy đủ kiểu dữ liệu bản địa (`null`, `true`, `false`, `1`):

#### a) Lệnh `curl` bảo vệ nhánh `main`:
```bash
curl -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN:-<YOUR_GITHUB_TOKEN>}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/tungf2006/SpendWise/branches/main/protection \
  -d '{
    "required_status_checks": null,
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "dismiss_stale_reviews": true,
      "require_code_owner_reviews": false,
      "required_approving_review_count": 1
    },
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
  }'
```

#### b) Lệnh `curl` bảo vệ nhánh `develop`:
```bash
curl -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN:-<YOUR_GITHUB_TOKEN>}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/tungf2006/SpendWise/branches/develop/protection \
  -d '{
    "required_status_checks": null,
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "dismiss_stale_reviews": true,
      "require_code_owner_reviews": false,
      "required_approving_review_count": 1
    },
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
  }'
```

*(Lưu ý trên Windows PowerShell: Có thể dùng `curl.exe` hoặc sử dụng `Invoke-RestMethod` với cùng cấu trúc body JSON).*

---

### 4.4. Lệnh kiểm tra xác nhận cấu hình (Verification Commands)

- **Cách 1: Kiểm tra bằng GitHub CLI (`gh api`):**
  ```bash
  # Kiểm tra nhánh main
  gh api repos/tungf2006/SpendWise/branches/main/protection --jq '{enforce_admins: .enforce_admins.enabled, required_approvals: .required_pull_request_reviews.required_approving_review_count, dismiss_stale: .required_pull_request_reviews.dismiss_stale_reviews}'

  # Kiểm tra nhánh develop
  gh api repos/tungf2006/SpendWise/branches/develop/protection --jq '{enforce_admins: .enforce_admins.enabled, required_approvals: .required_pull_request_reviews.required_approving_review_count, dismiss_stale: .required_pull_request_reviews.dismiss_stale_reviews}'
  ```

- **Cách 2: Kiểm tra bằng `curl`:**
  ```bash
  # Kiểm tra nhánh main
  curl -s \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_TOKEN:-<YOUR_GITHUB_TOKEN>}" \
    https://api.github.com/repos/tungf2006/SpendWise/branches/main/protection

  # Kiểm tra nhánh develop
  curl -s \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_TOKEN:-<YOUR_GITHUB_TOKEN>}" \
    https://api.github.com/repos/tungf2006/SpendWise/branches/develop/protection
  ```

*Kết quả kỳ vọng:* Cả hai lệnh trả về phản hồi HTTP 200 kèm JSON xác nhận `enforce_admins: true`, `required_approvals: 1`, `dismiss_stale: true`.

---

## 5. HƯỚNG DẪN DÀNH CHO THÀNH VIÊN SAU KHI BẬT BRANCH PROTECTION

1. **Hiện tượng khi cố tình push trực tiếp:**
   - Nếu bất kỳ thành viên nào (kể cả Leader) chạy `git push origin main` hoặc `git push origin develop`, GitHub sẽ chặn lại với thông báo lỗi:
     ```text
     remote: error: GH006: Protected branch update failed for refs/heads/develop.
     remote: error: Changes must be made through a pull request.
     ```
2. **Quy trình làm việc chuẩn xác:**
   - Luôn rẽ nhánh từ `develop`: `git checkout develop && git pull origin develop && git checkout -b feature/<tên-task>`
   - Đẩy nhánh lên GitHub: `git push -u origin feature/<tên-task>`
   - Truy cập GitHub tạo Pull Request:
     - **Base branch:** `develop`
     - **Compare branch:** `feature/<tên-task>`
   - Nhờ Leader hoặc đồng đội review và bấm Merge sau khi kiểm thử đạt chuẩn.
