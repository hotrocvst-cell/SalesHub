# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary users — Quản lý cụm ST, Quản lý ST (`QUAN_LY`) và Trưởng ca (`TRUONG_CA`)**: Theo dõi sức khỏe doanh thu, tiến độ chỉ tiêu/thi đua theo ngày và lũy kế tháng ngay trên smartphone; nhanh chóng xuất ảnh báo cáo tỷ lệ dọc gửi vào nhóm chat (Messaging App) để thúc đẩy và điều phối đội ngũ; cấu hình chỉ tiêu và duyệt nhân sự/tài khoản trong phạm vi ST được phân quyền.
- **Primary users — Nhân viên bán hàng (`NHAN_VIEN`)**: Tra cứu KPI, bảng xếp hạng, tiến độ thi đua cá nhân theo thời gian thực trên điện thoại và sử dụng các tiện ích tác nghiệp trực tiếp tại ST (cấp mã voucher, kiểm quỹ, cân tồn kho, sinh mã đơn hàng, tra cứu thi đua).
- **Secondary users — Quản trị viên hệ thống (`ADMIN`)**: Quản trị cấu hình toàn cục, phân quyền trang và phạm vi ST (RBAC + Store Scope), kiểm soát xuất Excel, quản lý phiên dữ liệu và tài khoản trải nghiệm (`Guest`).

## Product Purpose

SalesHub là nền tảng điều hành bán hàng và tiện ích vận hành ST trên nền web (ưu tiên smartphone), chuyển hóa số liệu kinh doanh rời rạc thành báo cáo trực quan theo thời gian thực, ảnh báo cáo sẵn sàng chia sẻ qua nhóm chat và bộ công cụ tác nghiệp hàng ngày cho đội ngũ tại ST. Thành công của sản phẩm được đo bằng tốc độ đọc hiểu tình hình kinh doanh chỉ qua thao tác lướt dọc trên điện thoại, tính chính xác/đồng bộ dữ liệu đa thiết bị và mức độ sử dụng ổn định tại ST với chi phí hạ tầng bằng 0.

## Positioning

Là lớp điều hành và tác nghiệp nhanh dành cho ST: cho phép nạp trực tiếp dữ liệu thô (copy-paste hoặc trích xuất ảnh chụp qua AI OCR) từ các nguồn báo cáo rời rạc để tạo ngay bảng điểm real-time chuẩn smartphone, ảnh báo cáo dọc không watermark gửi nhóm chat và tích hợp các tiện ích trên cùng một ứng dụng miễn phí hạ tầng (Supabase Free + Cloudflare Pages / Netlify Free).

## Operating Context

- **Môi trường sử dụng**: Nhân sự sử dụng trực tiếp trên trình duyệt điện thoại khi di chuyển hoặc tác nghiệp tại ST, trên PC khi nạp số liệu/cấu hình, và tiếp nhận báo cáo dạng hình ảnh dọc qua Messaging App (Zalo/chat nội bộ).
- **Nhịp độ vận hành**: Theo dõi nhiều lần trong ngày (báo cáo real-time, phiên dữ liệu nhân viên), tổng kết theo tuần bắt đầu từ **Thứ Hai** (Monday-first) và lũy kế theo kỳ tháng.
- **Quy trình dữ liệu**: Dữ liệu được nạp qua nhập thủ công/dán bảng hoặc OCR, lưu trữ tập trung trên Supabase Cloud để đồng bộ tức thì từ PC quản lý xuống điện thoại nhân viên.

## Capabilities and Constraints

- **Phân hệ chức năng đã xác nhận**:
  - Báo cáo kinh doanh: BC Cụm ST (11 cột), BC Ngày (Realtime), BC Doanh Thu NV Ngày, BC Tháng (Lũy kế), Nhịp Doanh Thu.
  - Sức khỏe nhân viên & Thi đua: Tổng hợp xếp hạng, Xếp hạng DT lũy kế, Hiệu quả NV lũy kế, Tiến độ/Tổng hợp/Tra cứu/Cấn trừ/Trọng tâm thi đua, Chi tiết nhân viên.
  - Dữ liệu & Phiên làm việc: Cập nhật số liệu LK & NV (dán dữ liệu & AI OCR), Quản lý phiên nhân viên, Quản lý bản ghi ST, Trạng thái dữ liệu, Dữ liệu mẫu.
  - Tiện ích bán hàng & Hỗ trợ ST: Cấp mã & Quản lý kho voucher, Sinh mã đơn hàng, Cân tồn kho, Kiểm quỹ - Kiểm tiền, Xmusic Playlist, Trợ lý AI, Hỗ trợ & Góp ý, Đấu trường giải trí.
  - Phân hệ In Ấn: In Sticker, In Pop-up, Phiếu Bán Hàng, Công Việc ST, In Trang Trí.
  - Hệ thống & Phân quyền: Đăng nhập/Đăng ký/Onboarding xét duyệt tài khoản, Cấu hình ST & NV, Cấu hình thi đua, Mục tiêu nhân viên, Phân quyền ST, Tài khoản trải nghiệm (`Guest` bị khóa cứng các route cấu hình/nạp liệu), Quản trị hệ thống.
- **Chiến lược hạ tầng & bảo mật (Free-First)**: 100% không dùng hạ tầng trả phí (Supabase Free, Cloudflare Pages chính, Netlify dự phòng); Row Level Security (RLS) tại Supabase là chốt chặn bảo mật cuối cùng; Cloud-first cho mọi dữ liệu dùng chung (LocalStorage chỉ làm cache/dự phòng offline).
- **Quy chuẩn số liệu & nghiệp vụ**:
  - Mọi doanh thu và chỉ tiêu thống nhất lưu trữ/hiển thị theo đơn vị **triệu đồng** (chuẩn hóa `>= 100,000` chia `1,000,000`).
  - Chu kỳ tuần luôn tính **Thứ Hai là ngày đầu tuần**.
  - Hiển thị tên nhân viên theo quy chuẩn 1 cột gộp Mã NV + Tên rút gọn.
  - Chức năng xuất Excel mặc định khóa và ẩn trên toàn hệ thống, chỉ mở theo cấu hình quyền trang và vai trò; nút/modal xem SQL Supabase chỉ hiển thị cho `ADMIN`.
  - Xuất ảnh báo cáo (`html2canvas`) theo khung dọc tương thích smartphone, mở rộng đủ 100% chiều dài báo cáo và tuyệt đối không chèn footer watermark.
  - Mọi trang/phân hệ mới mặc định chỉ mở quyền cho `ADMIN` cho đến khi ổn định và đồng bộ đủ 4 điểm kiểm soát route/RBAC.

## Brand Commitments

- **Tên sản phẩm**: SalesHub (`Sales Hub - CRM`).
- **Ngôn ngữ & Thuật ngữ bắt buộc**: Tiếng Việt (`vi`). Tuyệt đối dùng **ST** thay cho "siêu thị" trên toàn bộ giao diện, báo cáo và thông báo.
- **Trung lập thương hiệu (Brand-Neutral)**: Tuyệt đối không sử dụng tên gọi bất kỳ chuỗi bán lẻ hoặc thương hiệu thương mại cụ thể nào trong văn bản UI, nhãn danh mục, ghi chú hay thông báo; dùng định danh trung lập (*Hệ thống, Cụm, ST, Đơn vị, Dashboard BI, Báo cáo kinh doanh*).
- **Giọng văn (Voice)**: Nội bộ rõ ràng, ngắn gọn, khách quan về số liệu nhưng mang tính khích lệ (vinh danh nhóm dẫn đầu, nhắc nhở tăng tốc mang tính xây dựng).

## Evidence on Hand

- Tài liệu quy chuẩn và kiểm soát dự án: `GEMINI.md`, `PROJECT_CONTROL_CENTER.md`, `SalesHub_PROJECT_AUDIT.md`, `.agents/rules/mobile_first_ui_rules.md`, `.agents/rules/export_image_rules.md`.
- Cấu trúc route, phân quyền RBAC và danh mục tính năng thực tế: `src/App.tsx`, `src/core/lib/permissions.ts`, `src/core/lib/authService.ts`, `src/shared/components/layout/SidebarNav.tsx`.
- Dữ liệu mẫu kiểm chứng hiện có: `public/sample-data/tonkho-sample.json`.
- **Khoảng trống chưa có (không được tự bịa)**: Không có tài liệu marketing công khai, bảng giá thương mại, nhận xét khách hàng bên ngoài hay số liệu benchmark thị trường; đây là hệ thống vận hành nội bộ.

## Product Principles

1. **Smartphone-First & Vertical Flow**: Thiết kế từ trải nghiệm lướt dọc và mở ảnh trên điện thoại trước; mọi nội dung ưu tiên ngắn gọn, đọc nhanh, hạn chế tràn hoặc cuộn ngang.
2. **Cloud-First, Free-First**: Dữ liệu nghiệp vụ dùng chung phải đồng bộ đa thiết bị qua Supabase Cloud và vận hành bền vững hoàn toàn trên gói miễn phí.
3. **Neutral & Standardized Data Language**: Thống nhất thuật ngữ ST trung lập, đơn vị triệu đồng, lịch tuần Thứ Hai và cách hiển thị nhân sự gọn gàng trên toàn hệ thống.
4. **Share-Ready Without Noise**: Ảnh báo cáo xuất ra giữ nguyên độ tinh gọn để đọc tức thì trong nhóm chat, không gắn watermark hay phần chân trang thừa.
5. **Least-Privilege by Default**: Trang mới mặc định chỉ mở cho Admin, xuất Excel mặc định khóa/ẩn, và tài khoản Guest trải nghiệm bị cách ly khỏi các thao tác cấu hình/nhập liệu.

## Accessibility & Inclusion

- Tối ưu thao tác một tay trên màn hình dọc smartphone và đảm bảo độ rõ nét, tương phản dễ đọc nhanh dưới điều kiện ánh sáng.
- Nội dung viết bằng tiếng Việt chuẩn dấu, dùng từ viết tắt ngành có giải thích/tooltip khi cần để mọi cấp nhân sự mới hay lâu năm đều nắm bắt nhanh.

