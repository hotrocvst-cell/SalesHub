# QUY CHUẨN NÚT VÀ MODAL MÃ LỆNH SQL SUPABASE (SQL ACCESS RULES)

## 1. NGUYÊN TẮC CỐT LÕI: CHỈ KHẢ DỤNG CHO QUẢN TRỊ VIÊN (ADMIN-ONLY)
- **Bảo mật và Tối ưu trải nghiệm**:
  - Mã lệnh cơ sở dữ liệu (`CREATE TABLE`, `ALTER TABLE`, RLS Policies, DDL Schema) là thông tin kỹ thuật hạ tầng nhạy cảm.
  - Các tài khoản nghiệp vụ thông thường (Nhân viên, Trưởng ca, Quản lý siêu thị, Quản lý khu vực) không cần và không được phép thao tác trực tiếp với mã SQL này.
  - Mục đích: Tránh gây hoang mang, nhầm lẫn trong vận hành bán hàng hàng ngày và phòng ngừa rò rỉ cấu trúc cơ sở dữ liệu.

---

## 2. QUY TẮC HIỂN THỊ TRÊN GIAO DIỆN (UI IMPLEMENTATION)
1. **Thanh công cụ trang (Page Toolbars) & Modal**:
   - Tất cả nút bấm, icon code (`<Code />`, `<Database />`), hoặc menu có chức năng mở Modal xem mã lệnh SQL Supabase **BẮT BUỘC ĐƯỢC BỌC BẰNG ĐIỀU KIỆN `isAdmin`**:
     ```tsx
     {isAdmin && (
         <button
             type="button"
             onClick={() => setShowSqlModal(true)}
             className="..."
             title="Xem mã lệnh SQL Supabase"
         >
             <Code className="w-4 h-4" />
         </button>
     )}
     ```
2. **Banner Cảnh Báo Trạng Thái Lưu Trữ (`CloudDataSyncStatusBanner` & Alert Banners)**:
   - Khi bảng Supabase chưa được tạo (`!tableReady` hoặc `!tableExists`):
     - Nếu người dùng là **Admin** (`isAdmin = true`): Hiển thị nút bấm kèm hành động mở modal xem mã SQL DDL.
     - Nếu người dùng **không phải Admin** (`isAdmin = false`): Chỉ hiển thị badge cảnh báo tĩnh dạng nhãn thông báo (ví dụ: `Chưa tạo bảng Cloud`), tuyệt đối không hiển thị nút mở xem mã SQL.
3. **Bảo vệ Modal render (Double Guard)**:
   - Ngoài việc ẩn nút mở modal, tại vị trí render Modal cũng phải được kiểm tra kèm `isAdmin`:
     ```tsx
     {showSqlModal && isAdmin && (
         <SqlModal ... />
     )}
     ```

---

## 3. PHẠM VI ÁP DỤNG
- Toàn bộ các trang báo cáo, cấu hình và quản trị trong hệ thống SalesHub:
  - Trang Quản lý Voucher (`VoucherAdminPage.tsx`)
  - Banner đồng bộ Cloud dùng chung (`CloudDataSyncStatusBanner.tsx`)
  - Modal cấu hình Target giai đoạn (`PeriodTargetConfigModal.tsx`)
  - Modal cấu hình Hiệu quả nhân viên (`PerformanceConfigModal.tsx`)
  - Trang phân quyền siêu thị / tài khoản (`UserStorePermissionPage.tsx`)
  - Bất kỳ phân hệ mới nào phát triển trong tương lai có chứa mã SQL DDL Supabase.
