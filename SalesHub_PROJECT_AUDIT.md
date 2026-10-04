# SalesHub_PROJECT_AUDIT.md

## I. HIỆN TRẠNG & ĐÁNH GIÁ SOURCE CODE (CURRENT STATE AUDIT)

1. **Cấu trúc Project hiện tại:**
* Codebase ban đầu đang bị gom toàn bộ trong một file duy nhất (`App.tsx` > 1000 dòng) và một file style toàn cục (`index.css`).
* Rủi ro kỹ thuật: Xuất hiện hiện tượng **"God Component"** – trộn lẫn State toàn cục, Authentication, Logic xử lý chuỗi (Text Parser), Layout UI (Sidebar, Topbar) và Render view chi tiết vào cùng một nơi.
* Khi dự án mở rộng thêm các module (Daily report, Employee, Target, KPI, Utilities, Administration), file sẽ vượt ngưỡng ngữ cảnh (Context Window) của LLM, dẫn đến tình trạng AI tự ý cắt xén mã nguồn, ghi đè gây lỗi hệ thống hoặc phá vỡ cấu trúc.


2. **Framework & Công nghệ thực tế:**
* Core: React 18+ (TypeScript), Vite.
* Styling: Tailwind CSS kết hợp cấu hình inline rules.
* Third-party: `@supabase/supabase-js`, `lucide-react`, `html2canvas`.
* Đánh giá: Bộ công cụ hiện tại chuẩn SPA, tải nhanh và hoàn toàn tương thích với các nền tảng Static Hosting.


3. **Build & Deployment System:**
* VCS: GitHub Free repository.
* CI/CD: Netlify Continuous Deployment tự động trigger theo luồng Git webhook từ branch `main`.


4. **Netlify Configuration:**
* File cấu hình `netlify.toml` đã thiết lập publish thư mục `dist` và rewrite `/* -> /index.html (200)` cho SPA routing. Cần tiếp tục duy trì cấu hình này.



---

## II. ĐỀ XUẤT KIẾN TRÚC CHO BUSINESS PLATFORM (CHIA ĐỂ TRỊ)

Để đảm bảo AI không bao giờ phá vỡ cấu trúc dự án khi viết lại mã nguồn, hệ thống bắt buộc phải được module hóa theo nguyên tắc **Separation of Concerns (SoC)** và **Feature-driven Folder Structure**:

```text
src/
├── app/                          # Cấu hình gốc ứng dụng
│   ├── App.tsx                   # Chỉ chứa Provider tree & Router outlet
│   └── routes.tsx                # Định nghĩa toàn bộ Route, phân cấp quyền truy cập
├── core/                         # Nền tảng cốt lõi không thay đổi
│   ├── config/                   # Hằng số hệ thống, campaign config, danh mục cố định
│   ├── lib/                      # Supabase client, parser engines, export utils
│   └── types/                    # Khai báo TypeScript types toàn hệ thống (Database, User, KPI...)
├── shared/                       # Thành phần dùng chung giữa các module
│   ├── components/
│   │   ├── layout/               # MainLayout, Sidebar, Topbar, ZoomControls (độc lập)
│   │   ├── ui/                   # Button, Card, Modal, Input, Table, Badge (chuẩn atomic)
│   │   └── feedback/             # Toast, LoadingSpinner, EmptyState
│   ├── contexts/                 # State dùng chung (AuthContext, StoreContext, ZoomContext)
│   └── hooks/                    # useAuth, useActiveStore, useZoom
└── features/                     # TỪNG MODULE ĐỘC LẬP (Mỗi module tối đa 150-300 dòng/file)
    ├── auth/                     # LoginPage, RegisterModal, ForgotPassword
    ├── monthly-report/           # Module Báo cáo tháng (Overview, Cum, ThiDua, KPI Cards)
    ├── daily-report/             # Module Báo cáo doanh thu ngày
    ├── data-update/              # Module Nạp & Dán dữ liệu (Realtime, Lũy kế)
    ├── store-management/         # Module Quản lý siêu thị, gán Store Scope
    ├── employee-management/      # Module Quản lý danh sách nhân sự, KPI cá nhân
    ├── target-setting/           # Module Giao chỉ tiêu ngành hàng & nhân sự
    ├── utilities/                # Công cụ in ấn, Kiểm quỹ (BBKQ), Sinh nhật, File Excel
    └── administration/           # Quản lý User, Phân quyền RBAC, System Audit Logs

```

---

## III. CHIẾN LƯỢC VẬN HÀNH FREE-FIRST (ZERO-INFRA-COST)

* **Netlify Free Tier**: Giới hạn 100GB Bandwidth/tháng và 300 phút build/tháng.
* *Giải pháp*: 100% Client-Side Rendering (CSR). Không dùng Serverless Compute nặng. Tách nhỏ chunk bằng Vite `dynamic import()` (Lazy Loading các route lớn).


* **Supabase Free Tier**: Giới hạn 500MB PostgreSQL, 50,000 MAU, 1GB Storage.
* *Giải pháp*:
* Không lưu file binary lớn vào Database.
* Tạo các bảng Aggregate tổng hợp (`daily_summaries`, `monthly_kpi_rollups`) để Dashboard chỉ đọc 1 dòng thay vì scan hàng chục nghìn transaction.
* Cấu hình GitHub Action ping nhẹ định kỳ 4 ngày/lần để ngăn chặn cơ chế tạm dừng dự án (Project Inactivity Pause) của Supabase Free.





---

## IV. ĐỀ XUẤT SUPABASE HIGH-LEVEL SCHEMA

Hệ thống database PostgreSQL chia thành 4 nhóm bảng quan hệ chặt chẽ:

1. **Identity & Phân quyền (Auth & RBAC):**
* `profiles`: `id (UUID - PK, FK auth.users.id)`, `email`, `full_name`, `avatar_url`, `created_at`.
* `roles`: `id`, `code` (`SUPER_ADMIN`, `STORE_MANAGER`, `SALES_LEAD`, `STAFF`), `name`, `description`.
* `permissions`: `id`, `code` (`REPORT_VIEW`, `REPORT_EDIT`, `DATA_IMPORT`, `TARGET_ASSIGN`, `USER_MANAGE`).
* `role_permissions`: `role_id`, `permission_id`.
* `user_roles`: `user_id`, `role_id`.


2. **Quản trị Chuỗi & Phạm vi Cửa hàng (Store & Store Scope):**
* `stores`: `id`, `code` (e.g. `290TCD`), `name`, `brand` (TGDĐ / ĐMX / AAR / TopZone), `region`, `status`.
* `user_store_scopes`: `user_id`, `store_id`, `is_default` (Xác định user được xem những siêu thị nào).
* `employees`: `id`, `employee_code`, `full_name`, `store_id`, `role_title`, `status`.


3. **Dữ liệu Nghiệp vụ & Báo cáo (Business Data & KPIs):**
* `categories`: Danh mục ngành hàng (Điện thoại, Điện lạnh, Gia dụng, Phụ kiện, VAS...).
* `campaigns`: Danh mục thi đua (`id`, `code`, `name`, `unit`, `weight_score`, `is_active`).
* `daily_business_records`: Dữ liệu giao dịch / doanh số phát sinh hàng ngày.
* `monthly_targets`: Chỉ tiêu doanh thu và thi đua theo từng tháng của Store hoặc Employee.
* `monthly_kpi_snapshots`: Bản ghi chụp số liệu lũy kế/realtime tổng hợp theo ngày.


4. **Tiện ích & Kiểm soát (Utilities & Audit):**
* `cash_audits`: Dữ liệu biên bản kiểm quỹ tiền mặt (BBKQ).
* `import_export_logs`: Lịch sử tải/dán file dữ liệu của user.
* `system_audit_logs`: Nhật ký can thiệp dữ liệu nhạy cảm.



---

## V. ĐỀ XUẤT BẢO MẬT: AUTHENTICATION + RBAC + STORE SCOPE + RLS

Nguyên tắc bất biến: **Frontend chỉ để hiển thị; Row Level Security (RLS) tại PostgreSQL là tầng thực thi bảo mật cuối cùng.**

1. **Authentication:**
* Dùng Supabase Auth (JWT). Payload chứa `sub (user_id)` và session metadata.


2. **SQL Helper Functions cho RLS:**
* `auth.user_has_permission(required_perm TEXT) -> BOOLEAN`: Kiểm tra user đăng nhập có quyền tương ứng hay không.
* `auth.get_user_scoped_stores() -> SETOF UUID`: Lấy danh sách `store_id` mà user được phép truy cập từ bảng `user_store_scopes`.


3. **RLS Policy Rules:**
* Bảng `stores`: User chỉ thấy các store có trong `auth.get_user_scoped_stores()`, trừ Quản trị viên (`ADMIN`).
* Bảng `daily_business_records` & `monthly_targets`:
* `SELECT`: `store_id IN (SELECT auth.get_user_scoped_stores())`.
* `INSERT / UPDATE`: Phải thỏa mãn `store_id IN (SELECT auth.get_user_scoped_stores())` VÀ có permission `DATA_IMPORT` hoặc `REPORT_EDIT`.





---

## VI. ĐỀ XUẤT ROADMAP MODULE TRIỂN KHAI

* **Giai đoạn 1: Móng kiến trúc & Router (Clean Foundation)**
* Tái cấu trúc lại toàn bộ thư mục theo chuẩn `features/`, `core/`, `shared/`.
* Thiết lập React Router DOM v6 và Layout Core (`MainLayout`, `Sidebar`, `Topbar`, `ZoomProvider`).


* **Giai đoạn 2: Tách biệt Module Báo Cáo Tháng (Monthly Report Feature)**
* Đóng gói toàn bộ logic Báo cáo Lũy kế, Parser, Summary Cards, Bảng thi đua, Zoom và Xuất ảnh vào đúng thư mục `src/features/monthly-report/`.


* **Giai đoạn 3: Phân hệ Cập nhật dữ liệu & Quản lý Store (Data Ingestion & Store Scopes)**
* Xây dựng riêng module `src/features/data-update/` và `src/features/store-management/`.


* **Giai đoạn 4: Báo Cáo Ngày, Dashboard & KPI Nhân viên**
* Xây dựng các page `daily-report`, `dashboard`, `employee-management`.


* **Giai đoạn 5: Tiện ích mở rộng & Quản trị Hệ thống**
* Kiểm quỹ (BBKQ), Import/Export Excel, Quản lý tài khoản, Phân quyền RBAC.



---

# BẢN QUY CHUẨN: PROJECT_CONTROL_CENTER v1.0

| Thông số / Quy tắc | Quy định chuẩn mực | Ràng buộc kỹ thuật |
| --- | --- | --- |
| **Tên dự án** | **Sales Hub** | Business Operations Platform |
| **Chiến lược chi phí** | **FREE-FIRST (Zero Paid Infra)** | Không dùng dịch vụ trả phí, tối ưu hoá ngưỡng tài nguyên miễn phí |
| **Frontend Architecture** | **Feature-Based Modularization** | Tuyệt đối không dồn logic vào `App.tsx`. Mỗi page/feature nằm trong thư mục riêng |
| **File Length Constraint** | **Tối đa 250 - 300 dòng/file** | Mọi file vượt quá giới hạn phải được tách thành component con hoặc hooks |
| **Routing Strategy** | **React Router DOM (Code-splitting)** | Sử dụng `React.lazy()` để cô lập hoàn toàn các trang, AI chỉ can thiệp đúng file trang đó |
| **Database & Auth** | **Supabase PostgreSQL Free** | Bảo vệ dữ liệu bằng RLS + Store Scope Function tại database |
| **State Management** | **React Context + Custom Hooks** | Quản lý độc lập theo từng phạm vi: `AuthContext`, `StoreContext`, `ZoomContext` |
| **AI Work Boundary** | **One-Feature-At-A-Time** | Mỗi phiên làm việc chỉ sửa đổi trong phạm vi một thư mục feature, không sửa tràn lan |
