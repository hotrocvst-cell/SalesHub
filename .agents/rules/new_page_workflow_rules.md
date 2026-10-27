# QUY CHUẨN TRIỂN KHAI TRANG MỚI & PHÂN QUYỀN (NEW PAGE WORKFLOW & PERMISSION RULES)

## 1. QUY TRÌNH TIẾP NHẬN YÊU CẦU & PHÊ DUYỆT KẾ HOẠCH (PLANNING FIRST)
- **TUYỆT ĐỐI KHÔNG TỰ Ý BẮT ĐẦU CODE NGAY**:
  - Khi nhận yêu cầu từ Boss về việc tạo bất kỳ một trang, module hoặc tính năng lớn mới nào, Agent **KHÔNG ĐƯỢC** bắt tay vào viết code ngay lập tức.
- **BẮT BUỘC TRÌNH BÀY KẾ HOẠCH TỔNG QUAN**:
  Agent phải phản hồi bằng một bản kế hoạch tổng quan tinh gọn gồm các đầu mục lớn:
  1. **Mục tiêu & Nghiệp vụ cốt lõi**: Xác định trang giải quyết bài toán gì, ai sử dụng, luồng thao tác chính.
  2. **Bố cục Giao diện (Mobile-First UI Layout)**:
     - Header & Bộ lọc (ưu tiên Siêu thị/Cụm ở dòng đầu theo Quy chuẩn 10).
     - Thẻ KPI tổng quan theo chiều dọc.
     - Bảng biểu chi tiết (gộp cột Nhân viên chuẩn hóa, font số sắc nét).
  3. **Mô hình Dữ liệu & Lưu trữ Supabase (100% Cloud-First)**:
     - Định nghĩa bảng PostgreSQL (DDL, RLS policies, index).
     - Banner trạng thái đồng bộ Cloud (`CloudDataSyncStatusBanner`).
     - Modal/nút SQL chỉ dành cho ADMIN (Quy chuẩn 12).
  4. **Kế hoạch đồng bộ 4 điểm chốt chặn**:
     - `src/App.tsx` (Route chính).
     - `src/core/lib/permissions.ts` (Registry & Default Permissions với quyền mặc định chỉ `ADMIN`).
     - `src/shared/components/layout/SidebarNav.tsx` (Sidebar menu).
     - Route Audit (`auditRouteCoverage` đạt 100%).
- **CHỈ BẮT ĐẦU CODE KHI BOSS PHÊ DUYỆT**:
  Chỉ sau khi Boss phản hồi đồng ý hoặc điều chỉnh kế hoạch, Agent mới bắt đầu triển khai code.

---

## 2. NGUYÊN TẮC PHÂN QUYỀN MẶC ĐỊNH CHO TRANG MỚI (DEFAULT ADMIN-ONLY ACCESS)
- **MẶC ĐỊNH CHỈ CẤP QUYỀN CHO VAI TRÒ ADMIN**:
  - Trong quá trình phát triển và thử nghiệm ban đầu, trang mới **MẶC ĐỊNH CHỈ MỞ DUY NHẤT CHO VAI TRÒ `ADMIN`**:
    ```ts
    allowed_roles: ['ADMIN']
    ```
  - Các vai trò khác (`QUAN_LY`, `TRUONG_CA`, `NHAN_VIEN`) mặc định chưa được truy cập và không nhìn thấy mục menu trên Sidebar.
- **MỤC ĐÍCH**:
  - Đảm bảo tính năng mới luôn trải qua giai đoạn kiểm thử nội bộ (Internal Beta/Sandbox).
  - Tránh ảnh hưởng hoặc gây nhầm lẫn cho người dùng cuối (Quản lý siêu thị, nhân viên) khi tính năng còn đang hoàn thiện hoặc chưa có dữ liệu chính thức.
- **CẤP QUYỀN MỞ RỘNG**:
  - Khi tính năng đã vận hành ổn định, dữ liệu Supabase được kiểm chứng và có chỉ đạo cụ thể từ Boss, Agent mới tiến hành mở rộng danh sách `allowed_roles`.
