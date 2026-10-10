---
trigger: always_on
---

# QUY CHUẨN THIẾT KẾ GIAO DIỆN & BÁO CÁO SMARTPHONE (MOBILE-FIRST CONVENTIONS)

## 1. MỤC TIÊU & ĐỐI TƯỢNG NGƯỜI DÙNG (SMARTPHONE-FIRST)
- **Đối tượng cốt lõi**: Quản lý siêu thị, Quản lý khu vực, Giám đốc kinh doanh và Nhân viên bán hàng.
- **Thiết bị tiêu thụ chính**: Điện thoại thông minh (smartphone).
- **Kênh tiếp nhận chính**: Trực tiếp trên trình duyệt mobile và qua hình ảnh báo cáo được chia sẻ vào nhóm chat Messaging App.
- **Tiêu chuẩn cao nhất**: Mọi trang báo cáo và hình ảnh xuất ra phải đạt độ sắc nét, dễ đọc, xem nhanh được trên màn hình dọc smartphone mà không cần phải zoom in/zoom out hay xoay ngang máy.

---

## 2. BỐ CỤC BÁO CÁO TỊNH TIẾN THEO CHIỀU DỌC (VERTICAL FLOW)
1. **Dàn trang theo trục dọc tự nhiên**:
   - Bố cục các thành phần báo cáo theo trình tự từ trên xuống dưới:
     1. **Header**: Tên báo cáo, Siêu thị, Kỳ ngày/tháng, Badge trạng thái.
     2. **Khối Chỉ số Cốt Lõi (Key KPIs)**: Dàn thẻ dạng 1 cột hoặc 2 cột trên mobile (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3`).
     3. **Khối Trọng tâm & Vinh danh (Highlights / Reminders)**: Thẻ Top xuất sắc, Thẻ nhóm cần tăng tốc, Thẻ cảnh báo.
     4. **Bảng Chi Tiết (Detailed Table)**: Bảng dữ liệu số liệu chi tiết của từng nhân sự hoặc ngành hàng.
2. **Trải nghiệm cuộn dọc mượt mà**:
   - Người dùng lướt ngón tay từ trên xuống dưới là nắm trọn thông tin từ vĩ mô (tổng quan) đến vi mô (từng cá nhân/ngành hàng).
   - Tránh việc nhồi nhét quá nhiều cột dàn trải theo chiều ngang làm phân mảnh luồng đọc.

---

## 3. TỐI ƯU HÓA KHÔNG GIAN CHIỀU NGANG & CO GỌN ĐỘ RỘNG CỘT DỮ LIỆU
1. **Tiết kiệm tối đa bề ngang (Horizontal Compactness)**:
   - Giảm padding của container chính trên mobile (`p-2 sm:p-4`).
   - Loại bỏ các khoảng trắng vô nghĩa giữa các cột.
2. **Quy chuẩn độ rộng các cột trong bảng dữ liệu**:
   - **Padding ô bảng**: Sử dụng `px-1.5` đến `px-2.5` và `py-1.5` đến `py-2` (thay vì `px-4` hay `px-6` của desktop truyền thống).
   - **Căn chỉnh lề chuẩn**:
     - Cột STT, Thứ hạng, Badge: Căn giữa (`text-center`).
     - Cột Mã NV, Tên NV, Tên ngành hàng: Căn trái (`text-left`), tên có thể rút gọn kèm tooltip nếu cần.
     - Cột Số liệu (Doanh thu, Doanh số, Số lượng, %, Đạt): Luôn căn phải (`text-right`), áp dụng `font-black` hoặc `font-mono` cho chữ số.
   - **Viết tắt chuẩn & Tinh gọn tiêu đề cột**:
     - Doanh thu quy đổi -> `DTQĐ`
     - Doanh thu thực -> `DT Thực`
     - Trả góp / Trả chậm -> `Trả chậm` hoặc `TG`
     - Dự kiến hoàn thành -> `%DK`
     - Hoàn thành hiện tại -> `%HT`
     - Doanh thu trung bình -> `Mức TB`
   - **Sử dụng Chip Badge thay vì text dài dòng**:
     - Dùng các thẻ chip nhỏ (`text-[9.5px]` hoặc `text-[10px]`, `px-1.5 py-0.5 rounded`) để hiển thị trạng thái (ví dụ: `🥇 Top 1`, `Dưới TB (-2.5tr)`, `0% TG`, `🚨 Chậm`).

---

## 4. QUY CHUẨN XUẤT HÌNH ẢNH BÁO CÁO (IMAGE EXPORT FOR SMARTPHONE)
1. **Tỷ lệ dọc tương thích Smartphone (Portrait Aspect Ratio)**:
   - Chiều rộng vùng capture khi xuất ảnh được thiết kế trong khoảng **800px đến 1000px**.
   - Bố cục dọc giúp ảnh khi gửi vào Messaging App hiển thị vừa khít khung màn hình điện thoại, chữ và số hiển thị to rõ, không bị thu nhỏ li ti như ảnh ngang 1920px.
2. **Không giới hạn chiều dài ảnh (Unlimited Canvas Height)**:
   - Không truyền `height` hay `windowHeight` cố định vào cấu hình `html2canvas`.
   - Trong callback `onclone`:
     ```ts
     clonedDoc.documentElement.style.height = 'auto';
     clonedDoc.body.style.height = 'auto';
     clonedReport.style.height = 'auto';
     clonedReport.style.maxHeight = 'none';
     clonedReport.style.overflow = 'visible';
     ```
   - Gỡ bỏ thuộc tính cuộn (`overflow-x-auto, overflow-y-auto, max-h-*`) trên tất cả container con bên trong báo cáo.
3. **Tuyệt đối KHÔNG chèn Footer Watermark**:
   - Không chèn thêm bất kỳ ghi chú bản quyền, nhãn hệ thống, độ phân giải 4K/8K, hay ngày giờ xuất ở đáy ảnh.
   - Ảnh xuất ra phải tinh gọn 100% nội dung thực tế, không có khoảng trắng thừa.
