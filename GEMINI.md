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

## 6. QUY CHUẨN ĐƠN VỊ TIỀN TỆ & DOANH THU TOÀN HỆ THỐNG (MILLION-UNIT STANDARD)
- **ĐỒNG NHẤT ĐƠN VỊ TRIỆU ĐỒNG CHO TẤT CẢ DOANH THU VÀ TARGET**:
  - Mọi dữ liệu doanh thu (Doanh thu quy đổi, Doanh thu thực, Doanh thu trả góp), chỉ tiêu (Target siêu thị, Target nhân sự) trên toàn bộ hệ thống SalesHub đều được lưu trữ, nhập liệu và tính toán theo đơn vị **TRIỆU ĐỒNG (rút gọn phần triệu)**.
  - Ví dụ chuẩn:
    + Doanh thu thực tế: `100,000,000 VNĐ` -> Lưu và hiển thị: `100` (hoặc `100 tr`).
    + Target giao: `100,000,000 VNĐ` -> Lưu và hiển thị: `100` (hoặc `100 tr`).
    + Tỷ lệ hoàn thành: `%HT` = `(100 / 100) * 100 = 100%`.
  - **Tuyệt đối không tự ý nhân `1,000,000`** khi lưu trữ hoặc tính toán làm lệch thứ bậc độ lớn (orders of magnitude) dẫn đến %HT bị chia nhỏ li ti (`0.0001%`).
  - Hàm chuẩn hóa `normalizeToMillion(val)`: Nếu giá trị nhập vào hoặc dán từ nguồn ngoài `>= 100,000`, hệ thống tự động chia `1,000,000` để đưa về đơn vị triệu đồng.

## 7. QUY CHUẨN LỊCH TUẦN & NGÀY ĐẦU TUẦN (MONDAY-FIRST WEEK CONVENTION)
- **NGÀY ĐẦU TUẦN LUÔN TÍNH TỪ THỨ HAI (MONDAY-FIRST)**:
  - Toàn bộ hệ thống SalesHub áp dụng quy chuẩn bắt đầu tuần làm việc từ **THỨ HAI (Monday)**.
  - Tất cả các bộ lọc preset "Tuần này", các hàm tính toán chu kỳ tuần (`getStartOfWeek()`), lịch kinh doanh đều phải lấy Thứ Hai làm ngày mốc đầu tiên của tuần (Monday = Day 1).

## 8. BẮT BUỘC BANNER BÁO CÁO TRẠNG THÁI LƯU TRỮ DỮ LIỆU (MANDATORY CLOUD STORAGE STATUS BANNER)
- **MINH BẠCH NGUỒN LƯU TRỮ TRÊN TẤT CẢ TRANG CÓ DỮ LIỆU**:
  - Tất cả các báo cáo, phân hệ quản lý hoặc trang chức năng có liên quan đến lưu trữ dữ liệu (phiên nhân viên, chỉ tiêu thi đua, target giai đoạn, chốt số kinh doanh, voucher,...) **BẮT BUỘC PHẢI CÓ THÀNH PHẦN BÁO CÁO Ở ĐẦU TRANG** (`CloudDataSyncStatusBanner`):
    1. **Nguồn dữ liệu hiện tại**: Supabase Cloud hay LocalStorage cache.
    2. **Trạng thái đồng bộ**: Đã đồng bộ thời gian thực hay còn bản ghi máy khách chưa đồng bộ.
    3. **Trạng thái sẵn sàng kết nối Cloud**: Bảng cơ sở dữ liệu Supabase đã tồn tại hay chưa (nếu chưa, hiển thị cảnh báo kèm nút xem/sao chép mã SQL DDL để Quản trị viên kích hoạt).
  - Thành phần này luôn gắn thuộc tính `data-html2canvas-ignore="true"` và `data-export-ignore="true"` để không bao giờ bị dính vào hình ảnh báo cáo khi người dùng xuất ảnh gửi Zalo.

## 9. QUY CHUẨN XUẤT FILE EXCEL TOÀN HỆ THỐNG (MANDATORY EXCEL EXPORT PERMISSION RULE)
- **MẶC ĐỊNH KHÓA VÀ ẨN NÚT XUẤT EXCEL (LOCKED & HIDDEN BY DEFAULT)**:
  - Trên toàn bộ hệ thống SalesHub, chức năng xuất file Excel (`onExportExcel`) KHÔNG được phép hiển thị tự do cho tất cả người dùng.
  - Mặc định trên mọi trang và mọi tài khoản: nút/công cụ Xuất Excel là **KHÓA VÀ ẨN HOÀN TOÀN** (`canExportExcel = false`).
  - Nút xuất file Excel CHỈ ĐƯỢC HIỂN THỊ khi thỏa mãn đồng thời:
    1. Trang đó được cấu hình kích hoạt tính năng xuất Excel (`allow_excel_export: true` trong cấu hình phân quyền trang).
    2. Tài khoản người dùng có vai trò (`role`) nằm trong danh sách được cấp phép xuất dữ liệu (`allowed_excel_roles`, hoặc mặc định vai trò Quản trị viên `ADMIN` khi trang được mở khóa).
  - Sử dụng hook chuẩn `useExcelExportPermission(pagePath)` để kiểm soát hiển thị nút Excel trên từng giao diện báo cáo/danh mục.

## 10. QUY CHUẨN BỐ CỤC BỘ LỌC BÁO CÁO (FILTER BAR CONVENTION - STORE/CLUSTER FIRST ON DEDICATED ROW)
- **ƯU TIÊN BỘ LỌC SIÊU THỊ / CỤM Ở VỊ TRÍ ĐẦU TIÊN & NẰM RIÊNG LẺ 1 DÒNG (DEDICATED FIRST ROW)**:
  - Trên tất cả các trang báo cáo, phân hệ hoặc bảng điều khiển có thanh bộ lọc:
    + Bộ lọc xem theo **Siêu thị / Cụm** (Store / Cluster) **BẮT BUỘC ĐẶT Ở VỊ TRÍ LỰA CHỌN ĐẦU TIÊN VÀ NẰM RIÊNG LẺ TRÊN 1 DÒNG ĐỘC LẬP (DÒNG ĐẦU TIÊN)**.
    + Có thể kết hợp cùng dòng này với các nút hành động (Làm mới, Xuất ảnh, Xuất Excel nếu được cấp quyền) ở góc phải để tối ưu diện tích.
    + Sau dòng Siêu thị / Cụm mới đến các tiêu chí bộ lọc khác (Từ ngày - Đến ngày, Lịch tuần, Kỳ tháng, Presets xem nhanh, Chế độ xem, Chỉ tiêu, Tìm kiếm,...).
  - **Mục đích**: Người dùng (Quản lý khu vực, Quản lý siêu thị, Nhân viên) luôn chủ động xác định đúng phạm vi đơn vị (siêu thị/cụm) mình đang phụ trách trước tiên, trực quan, không bị lẫn với các tiêu chí thời gian hay tùy chọn phức tạp.

## 11. QUY CHUẨN HIỂN THỊ CỘT NHÂN VIÊN TRONG BẢNG DỮ LIỆU (EMPLOYEE COLUMN STANDARD)
- **GỘP CHUNG MÃ NV VÀ TÊN NHÂN VIÊN TRÊN CÙNG MỘT CỘT (SINGLE COMBINED COLUMN)**:
  - Tất cả các bảng báo cáo và danh mục có thông tin nhân viên (Báo cáo hiệu quả nhân viên, Xếp hạng doanh thu lũy kế, Bảng chỉ tiêu thi đua, Phân bổ target,...) **BẮT BUỘC ÁP DỤNG ĐỒNG BỘ CẤU TRÚC 1 CỘT DUY NHẤT MANG TÊN "NHÂN VIÊN"**.
  - Tuyệt đối không tách rời thành 2 cột riêng biệt "Mã NV" và "Họ và Tên" gây lãng phí không gian chiều ngang trên thiết bị di động (smartphone).
- **QUY TẮC HIỂN THỊ TÊN RÚT GỌN (SHORTENED EMPLOYEE NAME)**:
  - Trên bảng dữ liệu, tên nhân viên hiển thị bằng **Tên rút gọn** chuẩn (`getShortenedEmployeeName(fullName)`):
    + Lấy 2 từ cuối cùng của tên nhân viên (ví dụ: *"Nguyễn Phương Nam"* -> **"Phương Nam"**, *"Lê Quang Vinh"* -> **"Quang Vinh"**).
    + Ngoại lệ chữ đệm: Nếu từ kế cuối là *"Thị"* (không phân biệt hoa thường), chỉ hiển thị từ cuối cùng (ví dụ: *"Nguyễn Thị Loan"* -> **"Loan"**; *"Trần Thị Kim Cúc"* -> **"Kim Cúc"**).
  - Thuộc tính `title` của phần tử tên luôn hiển thị đầy đủ mã và họ tên chuẩn hóa: `title={`Mã NV: ${employeeId} - ${cleanEmployeeName(fullName)}`}` để người dùng rê chuột xem trọn vẹn khi cần.
- **TỰ ĐỘNG ĐỒNG BỘ CHIỀU RỘNG BADGE MÃ NHÂN VIÊN (UNIFORM BADGE WIDTH)**:
  - Badge mã nhân viên sử dụng `font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0`.
  - Chiều rộng của badge mã NV phải được tính toán tự động dựa trên độ dài mã lớn nhất trong bảng dữ liệu:
    ```ts
    const maxIdLength = useMemo(() => {
        if (!rows || rows.length === 0) return 6;
        return Math.max(6, ...rows.map(r => String(r.employee_id || r.employeeId || '').trim().length));
    }, [rows]);
    ```
    và gắn thuộc tính `style={{ minWidth: `${maxIdLength + 2.2}ch`, width: `${maxIdLength + 2.2}ch` }}`.
  - **Mục đích**: Đảm bảo tất cả các badge mã nhân viên có kích thước hoàn toàn bằng nhau, giúp toàn bộ phần tên nhân viên phía sau được căn thẳng tắp một hàng dọc từ trên xuống dưới, tạo giao diện chuyên nghiệp, sắc nét và ngay ngắn.

