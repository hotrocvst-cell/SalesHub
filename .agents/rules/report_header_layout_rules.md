# QUY CHUẨN ĐỒNG BỘ BỐ CỤC ĐẦU TRANG BÁO CÁO (REPORT HEADER & FILTER LAYOUT CONVENTION)

## 1. NGUYÊN TẮC BẤT BIẾN: BỐ CỤC ĐẦU TRANG 4 TẦNG (STANDARDIZED 4-TIER HEADER)
Trên toàn bộ hệ thống SalesHub, các trang báo cáo kinh doanh (Báo Cáo Ngày Realtime, Báo Cáo Tháng Lũy Kế, Báo Cáo Doanh Thu Nhân Viên, Báo Cáo Cụm ST, v.v.) **BẮT BUỘC ÁP DỤNG ĐỒNG BỘ CẤU TRÚC ĐẦU TRANG 4 TẦNG** theo đúng thứ tự từ trên xuống dưới:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: TRẠNG THÁI CLOUD (CloudDataSyncStatusBanner) - [Rule 8]             │
│   • Thuộc tính: compact={true}, data-html2canvas-ignore="true"              │
│   • Minh bạch: Nguồn lưu trữ (Cloud/Local), Trạng thái Sync, Table Ready    │
├─────────────────────────────────────────────────────────────────────────────┤
│ TẦNG 2: CHI TIẾT PHIÊN & ĐỘ MỚI DỮ LIỆU (Session / Freshness Banner)        │
│   • Báo cáo Realtime: RealtimeSessionBanner (Thời điểm ảnh chụp, số ST)     │
│   • Báo cáo Lũy Kế & Nhân Viên: ReportDataFreshnessBar (Ngày chốt, giờ sync)│
├─────────────────────────────────────────────────────────────────────────────┤
│ TẦNG 3: TIÊU ĐỀ BÁO CÁO & PHÂN NHÓM CHẾ ĐỘ (Page Header & Sub-Tabs)        │
│   • Tiêu đề báo cáo (H1), nhãn phân loại, mô tả ngắn gọn                    │
│   • Tab Segmented Switcher (nếu có các chế độ xem nâng cao / tiêu chuẩn)    │
│   • Nút tác vụ nhanh toàn cục (Làm mới, Đổi đơn vị Tỷ/Triệu nếu có)         │
├─────────────────────────────────────────────────────────────────────────────┤
│ TẦNG 4: THANH BỘ LỌC DỮ LIỆU SMARTPHONE-FIRST (Filter Bar) - [Rule 10]      │
│   • DÒNG 1 (ƯU TIÊN ĐỘC LẬP): [Chọn ST / Cụm] + [Nút thao tác theo ST]      │
│   • DÒNG 2 (TIÊU CHÍ BỔ TRỢ & CÔNG CỤ): [Kỳ Tháng / Ngày / Lịch]            │
│     + [Chế độ xem / Phạm vi] + [Cụm Action Buttons: Tải ảnh, Copy, Excel]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. QUY ĐỊNH CHI TIẾT TỪNG TẦNG

### TẦNG 1: BANNER BÁO CÁO TRẠNG THÁI LƯU TRỮ CLOUD (`CloudDataSyncStatusBanner`)
- Luôn đặt ở vị trí đầu tiên của trang, trước các khối nội dung và tiêu đề.
- Sử dụng `compact={true}` để tiết kiệm tối đa chiều cao màn hình smartphone.
- Gắn đầy đủ thuộc tính `data-html2canvas-ignore="true"` và `data-export-ignore="true"` để không bao giờ bị xuất vào hình ảnh báo cáo gửi Messaging App.
- Tuyệt đối không nhét các đoạn văn bản mô tả dài dòng vào `customMessage`. Nếu không có lỗi, để `customMessage={undefined}` hoặc chỉ hiển thị thông tin vắn tắt về phiên.

### TẦNG 2: CHI TIẾT PHIÊN DỮ LIỆU & ĐỘ MỚI CLOUD (`Session / Freshness Banner`)
- **Báo cáo Realtime**: Sử dụng `RealtimeSessionBanner` hiển thị thời điểm ảnh chụp màn hình phiên, số lượng ST đã nạp trong phiên, nút nạp/sửa số liệu.
- **Báo cáo Lũy Kế / Báo Cáo Nhân Viên**: Sử dụng `ReportDataFreshnessBar` (`compact={true}`) hiển thị:
  - Ngày chốt của dữ liệu (`latestDataDate`).
  - Thời điểm cập nhật Cloud gần nhất (`lastUpdatedAt`).
  - Người thực hiện cập nhật (`lastUpdatedBy`).
  - Tên ST hoặc Cụm ST áp dụng (`storeName`).
  - Nút chuyển nhanh đến trang cập nhật số liệu (`actionUrl`, `actionLabel`, `canUpdate`).
- Cũng luôn được gắn thuộc tính bỏ qua khi chụp ảnh (`data-html2canvas-ignore="true"`).

### TẦNG 3: KHỐI TIÊU ĐỀ TRANG & PHÂN NHÓM CHẾ ĐỘ (Page Header & Sub-Tabs)
- Chứa thẻ Tiêu đề chính `<h1>` với kích thước chuẩn (`text-lg sm:text-xl font-extrabold text-slate-900`).
- Icon nhận diện phân hệ được bọc trong container bo tròn `rounded-xl` (`w-9 h-9` hoặc `w-10 h-10`).
- Nếu trang có nhiều chế độ xem con (sub-tabs, ví dụ: Chuẩn Realtime vs Mục Tiêu Còn Lại), đặt `role="tablist"` dạng segmented pill switcher tại đây để người dùng chuyển đổi ngay trước khi lọc.

### TẦNG 4: THANH ĐIỀU KHIỂN & BỘ LỌC CHUẨN SMARTPHONE (Filter Bar - Rule 10)
- **Dòng 1: Bộ lọc ST / Cụm nằm riêng biệt ở vị trí đầu tiên**:
  - `w-full` hoặc chiếm trọn độ rộng khả dụng, hỗ trợ hiển thị badge "Đã khóa" nếu tài khoản nhân viên bị cố định ST.
  - Được phép đặt các nút hành động trực tiếp gắn liền với ST ở góc phải cùng dòng (ví dụ: Nạp Doanh Thu, Sửa Số Liệu Phiên, Điểm danh ca, Cấu hình Target).
- **Dòng 2: Tiêu chí thời gian, hiển thị và bộ công cụ xuất ảnh**:
  - Tiêu chí thời gian: Chọn Kỳ Tháng, Chọn Ngày chốt số liệu, Lịch tuần (Thứ Hai làm ngày đầu tuần theo Rule 7).
  - Bộ lọc hiển thị: Chế độ xem (Đầy đủ / Chỉ DT / Chỉ Thi đua), Phạm vi xuất ảnh (Đầy đủ / Chỉ bảng / Chỉ tóm tắt).
  - Nút Tải lại số liệu (`RefreshCw`).
  - Cụm nút hành động xuất báo cáo (`ReportActionButtons`): Nhận xét mẫu, Tải ảnh, Copy ảnh, Copy Text Zalo, và Xuất Excel (chỉ hiện khi có quyền theo Rule 9).
