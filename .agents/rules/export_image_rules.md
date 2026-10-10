---
trigger: always_on
---

# QUY TẮC XUẤT HÌNH ẢNH BÁO CÁO (EXPORT IMAGE RULES)

## NGUYÊN TẮC BẤT BIẾN: TUYỆT ĐỐI KHÔNG CHÈN FOOTER WATERMARK

1. **Không tạo chân trang Watermark**:
   - Tuyệt đối **KHÔNG** tạo, chèn, hoặc `appendChild` bất kỳ phần tử chân trang (Footer Watermark) nào vào DOM/clonedReport khi xử lý xuất ảnh (`html2canvas`), ví dụ:
     - Ghi chú hệ thống: *"Hệ thống phân tích hiệu quả...", "SalesHub Analytics System", "SalesHub Report..."*
     - Thông tin kỹ thuật: *"Độ phân giải siêu nét 4K/8K (xxx px)..."*
     - Ngày giờ xuất báo cáo: *"Xuất lúc: ...", "Xuất từ SalesHub: ..."*
     - Thông tin siêu thị phụ lục ở chân ảnh: *"Báo cáo... • Siêu thị: ..."*

2. **Mục đích**:
   - Giữ cho hình ảnh báo cáo tinh gọn, thẩm mỹ, sạch sẽ và tối ưu tối đa không gian hiển thị theo chiều dọc màn hình smartphone (portrait) cũng như màn hình desktop.
   - Tránh phát sinh khoảng trắng thừa ở cuối ảnh và tránh gây rối mắt cho người dùng khi chia sẻ qua Messaging App.

3. **Phạm vi áp dụng**:
   - Tất cả các trang hiện tại và các trang/tính năng mới phát triển có công cụ xuất hình ảnh báo cáo (Lưu ảnh, Copy ảnh vào clipboard, Tải ảnh 4K/8K, Xuất ảnh hàng loạt).

4. **Cấu hình không giới hạn chiều dài hình ảnh xuất báo cáo (Unlimited Height)**:
   - Khi gọi `html2canvas`, **TUYỆT ĐỐI KHÔNG** truyền thuộc tính `height` hoặc `windowHeight` cố định cứng nhắc làm giới hạn chiều cao của canvas.
   - Trong callback `onclone`:
     - Thiết lập `clonedDoc.documentElement.style.height = 'auto';` và `clonedDoc.body.style.height = 'auto';`
     - Thiết lập cho container báo cáo `height: 'auto'; maxHeight: 'none'; minHeight: 'auto'; overflow: 'visible';`
     - Gỡ bỏ giới hạn chiều cao trên tất cả container con (`overflow-x-auto, overflow-y-auto, max-h-*` -> `maxHeight: 'none', overflow: 'visible'`).
   - Đảm bảo `html2canvas` luôn tự động đo và bao bọc trọn vẹn 100% toàn bộ chiều dài tự nhiên của báo cáo, không bao giờ bị cắt cụt hay thiếu thông tin ở cuối trang.

5. **Tối ưu tỷ lệ dọc tương thích màn hình Smartphone (Portrait Aspect Ratio)**:
   - Khung hình ảnh xuất báo cáo (`export-container`) phải ưu tiên bố cục theo chiều dọc (Portrait mode), độ rộng tối ưu khoảng **800px - 1000px**.
   - Mục đích: Khi gửi ảnh vào Messaging App và người dùng mở xem trên điện thoại, toàn bộ ảnh hiển thị vừa khít màn hình dọc smartphone, chữ và số to rõ, dễ đọc, không bị thu nhỏ li ti như ảnh dàn quá rộng theo chiều ngang.

