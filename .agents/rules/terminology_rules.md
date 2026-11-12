# QUY CHUẨN DANH XƯNG & TỪ NGỮ HỆ THỐNG (SYSTEM TERMINOLOGY & NAMING CONVENTIONS)

## 1. NGUYÊN TẮC BẤT BIẾN: THAY THẾ TOÀN BỘ "SIÊU THỊ" BẰNG "ST"
1. **Không sử dụng từ "siêu thị"**:
   - Tuyệt đối **KHÔNG SỬ DỤNG** từ *"siêu thị"*, *"Siêu thị"*, *"Siêu Thị"*, *"SIÊU THỊ"* trên bất kỳ giao diện, thành phần hoặc thông báo nào của hệ thống.
   - **Bắt buộc thay thế đồng nhất bằng "ST"**:
     - *"Cụm ST"* (thay vì Cụm siêu thị).
     - *"Mã ST"*, *"Tên ST"*, *"Chọn ST"*, *"Phạm vi ST"*.
     - *"Quản lý ST"* (hoặc *"QLST"*), *"Nhân sự ST"*.
     - *"Toàn Cụm ST"* (thay vì Toàn Cụm Siêu Thị).
     - *"Thi Đua Từng ST"* (thay vì Thi Đua Từng Siêu Thị).
     - *"Phân quyền ST"*, *"Cấu hình ST"*.
2. **Mục đích**:
   - Tối ưu hóa tối đa diện tích màn hình dọc Smartphone (Mobile-First UI).
   - Co gọn các thẻ badge, tiêu đề cột bảng biểu, dropdown bộ lọc, loại bỏ tình trạng tràn dòng chữ (text-wrapping) gây mất cân đối giao diện.

---

## 2. NGUYÊN TẮC TRUNG LẬP THƯƠNG HIỆU: CẤM TÊN THƯƠNG HIỆU / CHUỖI CỤ THỂ
1. **Danh sách các từ ngữ cấm sử dụng**:
   - Tuyệt đối **KHÔNG SỬ DỤNG** các tên thương hiệu, chuỗi bán lẻ cụ thể trong bất kỳ văn bản giao diện, nhãn danh mục, mô tả tính năng hay thông báo nào:
     - *"Thế giới di động"*, *"Thế Giới Di Động"*, *"TGDD"*
     - *"Điện máy xanh"*, *"Điện Máy Xanh"*, *"ĐMX"*, *"DMX"*
     - *"Topzone"*, *"TopZone"*
     - *"Bách hóa xanh"*, *"BHX"*, *"An Khang"*, *"AVAKids"*, v.v.
2. **Quy chuẩn thay thế trung lập**:
   - Sử dụng các định danh trung lập, mang tính quy chuẩn phần mềm nghiệp vụ:
     - Thay *"Dashboard BI TGDD"* bằng *"Dashboard BI"*.
     - Thay *"Mẫu tin nhắn TGDD/DMX"* bằng *"Mẫu tin nhắn Messaging App"*.
     - Thay *"Siêu thị TGDD/DMX"* bằng *"ST"*, *"Đơn vị"*, *"Cụm"*.
     - Giữ nguyên các token mã hóa kỹ thuật thuần túy chỉ dùng trong parser dữ liệu gốc nếu có (như regex bóc tách mã).

---

## 3. KHÔNG SÁNG CHẾ THUẬT NGỮ "QUẦY ST" & ĐỒNG NHẤT CÁCH GỌI TẠI ST
1. **Cấm tự ý sáng chế / sử dụng `"quầy ST"`**:
   - Dự án **không có** khái niệm hay định nghĩa `"quầy ST"`. Tuyệt đối không tự bịa hoặc đưa cụm từ `"quầy ST"` vào giao diện, tài liệu (`PRODUCT.md`) hoặc câu trả lời.
2. **Tránh dùng các cụm từ *"tại quầy"*, *"đứng quầy"*, *"quầy kệ"* khi mô tả ngữ cảnh vận hành chung**:
   - Thay thế đồng nhất bằng **"tại ST"**, **"tác nghiệp tại ST"**, **"vận hành ST"** để giữ ngôn ngữ nhất quán toàn hệ thống.
   - Ngoại lệ: Không tự ý sửa đổi tên/mô tả vật phẩm in ấn vật lý đã định nghĩa sẵn trong danh mục chuyên biệt nếu không có yêu cầu trực tiếp từ người dùng.

