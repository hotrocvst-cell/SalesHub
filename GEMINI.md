# SALES HUB - PROJECT CONVENTIONS & RULES

## 1. NGUYÊN TẮC THIẾT KẾ GIAO DIỆN & TỐI ƯU SMARTPHONE (MOBILE-FIRST UI CONVENTIONS)
- **NGƯỜI DÙNG MỤC TIÊU LÀ SMARTPHONE (MOBILE-FIRST PERSPECTIVE)**:
  - Đối tượng sử dụng chính là Quản lý siêu thị, Quản lý khu vực và Nhân viên xem báo cáo và ảnh báo cáo trực tiếp trên điện thoại thông minh (smartphone / Zalo chat).
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
  - Khung hình ảnh báo cáo xuất ra (dùng `html2canvas` để gửi Zalo) phải ưu tiên tỷ lệ theo chiều dọc (Portrait mode), vừa vặn với kích thước màn hình smartphone để người xem nhận ảnh mở ra đọc được ngay, không bị thu nhỏ chữ li ti như khi dàn trang quá rộng theo chiều ngang.
  - Chiều rộng vùng xuất ảnh (`export-container` / capture area) được cố định ở mức tối ưu cho hiển thị mobile/Zalo (khoảng 800px - 1000px tùy bảng, không vượt quá giới hạn gây tràn ngang).
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
