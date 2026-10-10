# SALES HUB - PROJECT CONVENTIONS & RULES

## 1. NGUYÊN TẮC THIẾT KẾ GIAO DIỆN & TỐI ƯU SMARTPHONE (MOBILE-FIRST UI CONVENTIONS)
- **NGƯỜI DÙNG MỤC TIÊU LÀ SMARTPHONE (MOBILE-FIRST PERSPECTIVE)**:
  - Đối tượng sử dụng chính là Quản lý siêu thị, Quản lý khu vực và Nhân viên xem báo cáo và ảnh báo cáo trực tiếp trên điện thoại thông minh (smartphone / Messaging App).
  - Mọi thiết kế giao diện, thẻ KPI, bảng biểu và tính năng phải đặt trải nghiệm đọc và tương tác trên smartphone làm ưu tiên số 1.
- **BỐ CỤC TỊNH TIẾN THEO CHIỀU DỌC (VERTICAL PROGRESSION / PORTRAIT FLOW)**:
  - Báo cáo và giao diện phải được cấu trúc tịnh tiến tự nhiên theo trục dọc, tối ưu hóa cho thao tác cuộn (scroll) trên màn hình dọc smartphone.
  - Tiêu chí thiết kế: Người dùng chỉ cần lướt dọc từ trên xuống dưới là có thể dễ dàng nắm bắt trọn vẹn bức tranh tổng quan của siêu thị/nhân sự/ngành hàng mà không bị rối mắt hay phải xoay ngang màn hình.
- **TỐI ƯU HÓA KHÔNG GIAN CHIỀU NGANG & CO GỌN CỘT DỮ LIỆU (HORIZONTAL COMPACTNESS)**:
  - Tuyệt đối không lãng phí không gian chiều ngang. Tối ưu padding, margin của các container để tận dụng tối đa bề ngang hiển thị.
  - **Độ rộng các cột dữ liệu (Column Width Optimization)**:
    - Khoảng cách giữa các cột trong bảng phải được co gọn tối đa, tinh tế và khít khao (compact), không để khoảng trống thừa vô nghĩa.
    - Padding ô bảng chuẩn: `px-1.5` đến `px-2.5`, `py-1.5` đến `py-2`.
    - Sử dụng các ký hiệu viết tắt chuẩn ngành (ví dụ: DTQĐ, DT Thực, TG, %HT, %DK, ĐL, Target) kết hợp chip badge và tooltip khi cần để giữ độ rộng cột gọn gàng nhất.
    - Cột số liệu (Doanh thu, số lượng, tỷ lệ) luôn căn phải (text-right), sử dụng font số rõ nét, dễ đọc (font-mono hoặc font-extrabold).
    - Hạn chế tối đa việc người dùng phải cuộn ngang quá nhiều trên mobile để xem các chỉ số kinh doanh then chốt.

## 2. NGUYÊN TẮC XUẤT ẢNH BÁO CÁO (IMAGE EXPORT RULES)
- **TƯƠNG THÍCH HOÀN HẢO MÀN HÌNH DỌC SMARTPHONE (PORTRAIT EXPORT ORIENTATION)**:
  - Khung hình ảnh báo cáo xuất ra (dùng `html2canvas` để gửi Messaging App) phải ưu tiên tỷ lệ theo chiều dọc (Portrait mode), vừa vặn với kích thước màn hình smartphone để người xem nhận ảnh mở ra đọc được ngay, không bị thu nhỏ chữ li ti như khi dàn trang quá rộng theo chiều ngang.
  - Chiều rộng vùng xuất ảnh (`export-container` / capture area) được cố định ở mức tối ưu cho hiển thị mobile/Messaging App (khoảng 800px - 1000px tùy bảng, không vượt quá giới hạn gây tràn ngang).
- **TUYỆT ĐỐI KHÔNG CHÈN FOOTER WATERMARK**:
  - Không chèn thêm bất kỳ Footer Watermark nào (thẻ chân trang ghi chú bản quyền, "SalesHub Analytics", "Hệ thống phân tích...", "Độ phân giải 4K/8K...", ngày giờ xuất...) vào ảnh báo cáo khi xuất ảnh (`html2canvas`) trên toàn bộ hệ thống.
  - Ảnh xuất ra phải tinh gọn, sạch sẽ, chỉ bao gồm nội dung báo cáo thực tế, không có khoảng trắng thừa hoặc watermark thừa ở cuối đáy ảnh.
  - Quy định này áp dụng bắt buộc cho tất cả các trang hiện tại và các tính năng xuất ảnh mới được triển khai sau này.
- **KHÔNG GIỚI HẠN CHIỀU DÀI ẢNH BÁO CÁO (UNLIMITED HEIGHT)**:
  - Khi cấu hình `html2canvas`, không truyền giá trị `height` hoặc `windowHeight` cố định làm giới hạn canvas.
  - Trong `onclone`, luôn đặt `height: auto`, `maxHeight: none`, `overflow: visible` cho toàn bộ tài liệu, container báo cáo và các container con để ảnh xuất ra tự động mở rộng theo 100% chiều dài tự nhiên của báo cáo, không bị cắt cụt.

## 3. NGUYÊN TẮC BẤT BIẾN HỆ THỐNG
- **Chiến lược chi phí**: FREE-FIRST (100% Zero Paid Infra).
- **Kiến trúc mã nguồn**: Chia để trị (Feature-Driven Modularization). Giới hạn độ dài file 250 - 300 dòng; nếu dài hơn phải tách component con hoặc custom hook.
- **Tầng bảo mật**: Frontend chỉ để hiển thị, Row Level Security (RLS) tại Supabase là chốt chặn bảo mật cuối cùng.

## 4. QUY TẮC BẮT BUỘC KHI TẠO TRANG/PHÂN HỆ MỚI (NEW PAGE & PERMISSION REGISTRATION RULE)
- **BẮT BUỘC ĐỒNG BỘ 4 ĐIỂM CHỐT CHẶN (MANDATORY 4-POINT REGISTRATION)**:
  Mỗi khi tạo bất kỳ trang, phân hệ, hoặc tuyến đường (route) mới nào trên hệ thống SalesHub, nhà phát triển và Agent **BẮT BUỘC PHẢI KHAI BÁO ĐỒNG BỘ TẠI 4 VỊ TRÍ**, tuyệt đối không được bỏ sót:
  1. **Router thực thi chính (`src/App.tsx`)**:
     - Khai báo import trang dạng `lazy()` và đăng ký thẻ `<Route path="/duong-dan" element={<ProtectedRoute path="/duong-dan"><TrangMoi /></ProtectedRoute>} />`.
     - *Lưu ý*: `App.tsx` là Router chính điều hướng của ứng dụng và thực thi `ProtectedRoute`, bắt buộc phải có route tại đây.
  2. **Quản trị phân quyền (`src/core/lib/permissions.ts`)**:
     - Khai báo trang vào `APP_SYSTEM_PAGES_REGISTRY` và `DEFAULT_PAGE_PERMISSIONS` với đầy đủ: `page_key`, `page_name`, `path`, `group_title`, `description`, `is_enabled: true`, `allowed_roles` và `order_index`.
     - Tránh tuyệt đối việc trang bị chặn bởi `ProtectedRoute` do không tìm thấy định nghĩa phân quyền hoặc chưa có vai trò được phép.
  3. **Menu điều hướng Sidebar (`src/shared/components/layout/SidebarNav.tsx`)**:
     - Thêm mục điều hướng (name, path, icon, badge) vào đúng nhóm chức năng tương ứng trong `NAVIGATION_GROUPS`.
  4. **Kiểm soát tính toàn vẹn (Route Audit & Registry)**:
     - Mọi trang mới phải đảm bảo tỷ lệ kiểm soát tại công cụ **Route Audit** (`auditRouteCoverage`) trên trang Quản trị hệ thống (`/quan-tri-he-thong`) luôn đạt chuẩn **100% HOÀN TOÀN ĐỒNG BỘ**, không để sót bất kỳ trang nào ở trạng thái "Chưa đăng ký".

## 5. NGUYÊN TẮC BẮT BUỘC LIÊN KẾT & LƯU TRỮ SUPABASE CHO CÁC TÍNH NĂNG CÀI ĐẶT / CẤU HÌNH DỮ LIỆU (MANDATORY SUPABASE INTEGRATION RULE)
- **100% CLOUD-FIRST CHO TOÀN BỘ CÀI ĐẶT & THÔNG TIN DỮ LIỆU NGHIỆP VỤ (MANDATORY CLOUD STORAGE)**:
  - Tất cả các trang, phân hệ hoặc tính năng mới và cũ có liên quan đến:
    + Cài đặt hệ thống, cấu hình tham số, định lượng, chỉ tiêu thi đua / kinh doanh.
    + Quản lý mã voucher, coupon, khuyến mãi, danh mục nghiệp vụ.
    + Phân quyền, danh sách tài khoản, thông tin nhân sự và siêu thị.
    + Nhật ký thao tác, lịch sử cấp phát dữ liệu.
    **BẮT BUỘC PHẢI LIÊN KẾT VÀ LƯU TRỮ TRỰC TIẾP TRÊN SUPABASE (PostgreSQL Cloud)**.
- **TUYỆT ĐỐI KHÔNG LƯU THUẦN LOCALSTORAGE CHO DỮ LIỆU DÙNG CHUNG**:
  - Tuyệt đối không được coi LocalStorage là nơi lưu trữ chính thức duy nhất cho các dữ liệu nghiệp vụ cần chia sẻ đa người dùng.
  - LocalStorage CHỈ ĐÓNG VAI TRÒ BỘ NHỚ ĐỆM (CACHE) tăng tốc hiển thị và dự phòng ngoại tuyến (offline fallback) khi mất kết nối mạng.
  - Khi có kết nối mạng, hệ thống phải tự động đồng bộ (upsert) dữ liệu lên Supabase Cloud để dữ liệu không bị thất thoát khi người dùng xóa bộ nhớ cache trình duyệt hoặc đổi thiết bị.
- **CHUẨN HÓA SCHEMA DDL, SẴN SÀNG KHỞI TẠO BẢNG & BẢO MẬT RLS**:
  - Mọi thực thể dữ liệu mới trên Supabase bắt buộc phải có câu lệnh SQL DDL chuẩn (`CREATE TABLE`, `ROW LEVEL SECURITY`, `INDEX`, `POLICIES` cho phép phân quyền truy cập).
  - Phải có hàm kiểm tra tính sẵn sàng của bảng (nhận diện lỗi mã `PGRST205: Could not find table in schema cache`) để cảnh báo minh bạch trên giao diện nếu bảng chưa được tạo.
  - Giao diện trang quản trị phải có thông báo trạng thái kết nối Cloud (🟢 Đã kết nối / 🟡 Cảnh báo chưa tạo bảng) và cung cấp modal/nút hỗ trợ sao chép SQL để Quản trị viên dễ dàng dán chạy 1 lần trong Supabase SQL Editor.
- **ĐỒNG BỘ ĐA THIẾT BỊ XUYÊN SUỐT (CROSS-DEVICE CONSISTENCY)**:
  - Dữ liệu cấu hình, cấp phát do Quản lý/Admin nạp từ máy tính để bàn (PC) phải phản ánh ngay lập tức và chính xác trên điện thoại di động (smartphone/Messaging App) của nhân viên và ngược lại thông qua Supabase Cloud.

