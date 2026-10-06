# PROJECT_CONTROL_CENTER v1.1

## 1. NGUYÊN TẮC BẤT BIẾN (IMMUTABLE RULES)
- **Chiến lược chi phí**: FREE-FIRST (100% Zero Paid Infra). Tuyệt đối không dùng domain/server trả phí.
- **Kiến trúc mã nguồn**: Chia để trị (Feature-Driven Modularization). Tuyệt đối KHÔNG gom logic vào file App.tsx.
- **Giới hạn độ dài file**: Tối đa 250 - 300 dòng/file. Nếu dài hơn, bắt buộc phải tách component con hoặc custom hook.
- **Nguyên tắc làm việc với AI**: Mỗi lần chỉ xử lý duy nhất 1 trang hoặc 1 tính năng nhỏ (One-Feature-At-A-Time).
- **Tầng bảo mật**: Frontend chỉ để hiển thị. Row Level Security (RLS) tại Supabase là chốt chặn bảo mật cuối cùng.
- **Quy chuẩn Người dùng & Smartphone (Mobile-First)**:
  1. Người dùng chủ yếu sử dụng smartphone để xem báo cáo (qua tin nhắn và ảnh báo cáo Zalo).
  2. Bố cục báo cáo ưu tiên tịnh tiến theo chiều dọc (Vertical Flow / Portrait Mode), dễ dàng xem tổng quan khi cuộn dọc màn hình điện thoại.
  3. Xuất hình ảnh báo cáo (html2canvas) ưu tiên tỷ lệ dọc tương thích màn hình smartphone, chữ rõ nét khi mở ảnh trên điện thoại; TUYỆT ĐỐI không chèn footer watermark; tự động mở rộng 100% chiều dài tự nhiên (không giới hạn height canvas).
  4. Giao diện trang luôn tối ưu không gian chiều ngang, đặc biệt là co gọn khoảng cách và chiều rộng giữa các cột dữ liệu trong bảng.

## 2. STACK CÔNG NGHỆ CHUẨN
- **Frontend Core**: React 18+ (TypeScript), Vite.
- **Routing**: React Router DOM (Lazy loading).
- **Styling**: Tailwind CSS + Icon Lucide-react.
- **Backend / Database**: Supabase Free (PostgreSQL 15+, Supabase Auth, RLS).
- **Hosting / CI-CD**: GitHub Free + Netlify Free.

## 3. TIÊU CHUẨN GIAO DIỆN & BẢNG BIỂU SMARTPHONE (MOBILE-FIRST UI STANDARDS)
- **Cấu trúc phân tầng dọc**: Header -> Thẻ KPI/Tổng quan -> Biểu đồ / Thẻ phân tích -> Bảng chi tiết.
- **Bảng dữ liệu (Table Layout)**:
  - Tối ưu chiều rộng cột (compact column widths): Sử dụng padding `px-1.5` đến `px-2.5`, `py-1.5` đến `py-2`.
  - Căn lề số liệu: Cột định lượng, doanh thu, phần trăm luôn căn phải (`text-right`), font số sắc nét.
  - Viết tắt chuẩn ngành: Dùng nhãn viết tắt ngắn gọn kèm tooltip thay vì tiêu đề cột quá dài.
- **Xuất ảnh báo cáo (Export Canvas)**:
  - Container xuất ảnh có chiều rộng chuẩn dọc (800px - 1000px).
  - Không truyền `height` hay `windowHeight` cố định vào `html2canvas`.
  - Trong `onclone`, luôn set `height: auto`, `maxHeight: none`, `overflow: visible` cho toàn bộ container và phần tử con.