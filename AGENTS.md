# AGENTS.md — Hướng dẫn phối hợp `ui-ux-pro-max` và `impeccable` cho SalesHub

Tài liệu này quy định cách agent kết hợp hai bộ skill UI/UX đang cài trong dự án:
- **`ui-ux-pro-max`** (`.agents/skills/ui-ux-pro-max/SKILL.md` cùng sub-skill `design-system`, `ui-styling`, `design`, `brand`, `slides`, `banner-design`)
- **`impeccable`** (`.agent/skills/impeccable/SKILL.md` cùng `.agent/skills/impeccable/reference/`)

---

## 1. Thứ tự ưu tiên bất biến (Precedence)

Khi có bất kỳ xung đột nào về quy chuẩn, dữ liệu gợi ý hoặc thói quen mặc định, agent **bắt buộc** tuân theo thứ tự ưu tiên từ cao xuống thấp:

1. `GEMINI.md`, `.agents/rules/*.md` và `PRODUCT.md` (Quy chuẩn bất biến & nghiệp vụ SalesHub)
2. `AGENTS.md` (Quy ước phối hợp skill của dự án)
3. `impeccable` (Kỷ luật bề mặt, ngữ cảnh vận hành `Operate`/`Read`, `craft-floor.md`)
4. `ui-ux-pro-max` (Kho gợi ý thiết kế, UX guidelines, biểu đồ, stack best practices)

---

## 2. Phân vai hai skill (Không chồng lấn)

| Hạng mục | `ui-ux-pro-max` — **Tư vấn & Tra cứu mẫu** | `impeccable` — **Định hình & Hoàn thiện UI** |
|---|---|---|
| **Vai trò chính** | Gợi ý cấu trúc thông tin, UX pattern, loại biểu đồ, nguyên tắc React/Tailwind theo bài toán cụ thể. | Đọc ngữ cảnh sản phẩm (`PRODUCT.md`), giữ kỷ luật thiết kế (`craft-floor.md`), đánh giá & tinh chỉnh giao diện đạt độ hoàn thiện cao. |
| **Thời điểm dùng mạnh nhất** | Trước khi thiết kế trang/bảng/biểu đồ mới hoặc khi cần tra cứu nguyên tắc UX/accessibility cụ thể. | Khi lập phương án (`shape`), sửa/nâng cấp giao diện (`layout`, `clarify`, `adapt`, `harden`, `optimize`), hoặc rà soát trước bàn giao (`critique`, `audit`, `polish`). |
| **Giới hạn áp dụng** | Chỉ dùng như **nguồn tham khảo**; mọi gợi ý về font, icon, màu sắc, thư viện ngoài đều phải lọc qua chuẩn SalesHub. | Chạy theo chế độ **`Operate`** (báo cáo/dashboard/tiện ích tác nghiệp) hoặc **`Read`** (tài liệu/hướng dẫn); không tự động hóa thành landing page tiếp thị. |

---

## 3. Quy trình phối hợp chuẩn theo loại yêu cầu

### A. Tạo trang, phân hệ hoặc tính năng giao diện mới
1. **Giữ nguyên Quy tắc #4 (`GEMINI.md` / `.agents/rules/new_page_workflow_rules.md`)**: Tuyệt đối không viết code ngay; luôn trình bày kế hoạch tổng quan (Mục tiêu, Bố cục Mobile-First, Mô hình dữ liệu Supabase Cloud-first, Đồng bộ 4 điểm chốt chặn & quyền mặc định `ADMIN`) để Boss phê duyệt trước.
2. **Giai đoạn lên phương án (Planning)**:
   - Dùng `ui-ux-pro-max` tra nhanh UX pattern, cấu trúc biểu đồ hoặc layout mobile phù hợp nếu có thành phần trực quan mới.
   - Dùng tư duy `shape` của `impeccable` (chế độ `Operate`) để chốt luồng đọc dọc trên smartphone, mật độ hiển thị và các trạng thái dữ liệu (`loading`, `empty`, `error`).
3. **Giai đoạn triển khai (Sau khi Boss duyệt)**:
   - Chạy ngữ cảnh `impeccable` một lần đầu phiên: `.agent/skills/impeccable/scripts/impeccable.cmd context --target <đường-dẫn-file-chính>` (nếu launcher lỗi, đọc trực tiếp `PRODUCT.md`).
   - Đọc `.agent/skills/impeccable/reference/craft-floor.md` ngay trước khi sửa/viết file UI.
   - Code theo đúng phân tách module (`250–300` dòng/file), kèm `CloudDataSyncStatusBanner` và phân quyền RBAC/Excel/SQL chuẩn.
4. **Giai đoạn hoàn thiện**: Rà soát nhanh theo `polish` / `audit` của `impeccable` và kiểm tra build (`npm run build` / `tsc`).

### B. Cải tiến, sửa lỗi hoặc tối ưu UI hiện có
1. Xác định rõ mục tiêu bằng đúng lệnh/playbook của `impeccable`:
   - Bố cục, khoảng cách, tràn chiều ngang mobile -> `layout` / `adapt`
   - Nhãn nút, thuật ngữ, thông báo lỗi, tooltip -> `clarify`
   - Thiếu trạng thái lỗi/rỗng/edge case/a11y -> `harden`
   - Giật lag, render thừa -> `optimize` (kết hợp tra `react-performance.csv` của `ui-ux-pro-max`)
   - Đánh giá tổng thể -> `critique` / `audit`
   - Chốt chất lượng cuối -> `polish`
2. Giữ nguyên cấu trúc nghiệp vụ, hành vi dữ liệu và bộ lọc hiện có trừ khi được yêu cầu đổi.

### C. Thêm hoặc nâng cấp biểu đồ, bảng số liệu
1. Tra `ui-ux-pro-max` (`charts.csv`, `ux-guidelines.csv`) để chọn dạng biểu đồ phù hợp với đọc nhanh trên màn hình dọc smartphone.
2. Triển khai bằng **`recharts`** đã cài sẵn trong dự án; không tự cài thư viện biểu đồ khác.
3. Kết hợp `impeccable` (`craft-floor.md`) để kiểm tra tương phản nhãn trục, chú giải rõ ràng, không dùng màu sắc là tín hiệu duy nhất.

---

## 4. Quy tắc hóa giải xung đột bắt buộc (SalesHub Overrides)

| Điểm dễ xung đột giữa 2 skill | Quy ước bắt buộc tại SalesHub |
|---|---|
| **Font chữ** (`ui-ux-pro-max` hay đề xuất Google Fonts mới) | Giữ cố định **Roboto** cho toàn hệ thống và **UTM-Avo** cho bảng báo cáo / vùng xuất ảnh (`.report-table`, `[data-report-table="true"]`, `.font-avo`). Không đổi font hệ thống. |
| **Icon & Emoji** (`ui-ux-pro-max` mặc định gợi ý Phosphor/Heroicons) | Luôn dùng **`lucide-react`** đã cài sẵn; không cài thêm `@phosphor-icons/react` hay `@heroicons/react`. Icon trang trí cạnh chữ dùng `aria-hidden="true"`; nút chỉ có icon phải có `aria-label`. Không dùng emoji làm icon điều khiển/navigation (chỉ giữ chip xếp hạng theo chuẩn bảng báo cáo hiện hành nếu có). |
| **Stack & Thư viện** | Stack thực tế là **React 18 + TypeScript + Vite + Tailwind CSS v3.4 + Recharts + html2canvas + Supabase**. Chỉ tham khảo nhóm `react` và `html-tailwind` (đảm bảo tương thích Tailwind v3). Không tự ý cài `GSAP`, `Next.js` patterns, hay UI kit trả phí/trùng lặp (`Free-First`). |
| **Bố cục Smartphone & Báo cáo** | Ưu tiên luồng cuộn dọc smartphone (`375px+`), thanh lọc **ST / Cụm ở dòng đầu tiên**, bảng co gọn (`px-1.5`–`px-2.5`), cột **Nhân viên** gộp 1 cột chuẩn, số liệu `text-right` + `tabular-nums`, xuất ảnh dọc `800–1000px` không footer watermark. |
| **Platform (`web` vs `native`)** | Đây là **web app ưu tiên mobile**, không phải app iOS/Android native; bỏ qua các checklist chỉ dành cho native (`safe-areas` iOS/Android SDK, SwiftUI, Jetpack Compose), nhưng vẫn đảm bảo vùng chạm nút thoải mái khi dùng một tay trên điện thoại. |
| **Ngữ cảnh & Artifact** | `PRODUCT.md` đã được thiết lập đầy đủ — không chạy `impeccable init` ghi đè trừ khi được yêu cầu cập nhật. Không tự tạo `DESIGN.md` hoặc retheme toàn bộ app nếu Boss chưa chỉ đạo. |
| **Thuật ngữ & Trung lập** | Dùng tiếng Việt chuẩn, thay mọi từ chỉ địa điểm bán hàng bằng **ST**, đơn vị tiền tệ quy chuẩn **triệu đồng**, tuần bắt đầu từ **Thứ Hai**, tuyệt đối không dùng tên chuỗi/thương hiệu thương mại. |

---

## 5. Cách vận hành công cụ của 2 skill trên Windows

- **Với `impeccable`**:
  - Trên Windows PowerShell, gọi launcher:
    `.agent/skills/impeccable/scripts/impeccable.cmd context`
  - Chỉ đọc file playbook trong `.agent/skills/impeccable/reference/*.md` đúng với tác vụ đang làm để tiết kiệm ngữ cảnh.
- **Với `ui-ux-pro-max`**:
  - Kiểm tra Python trước nếu muốn chạy script (`python --version`).
  - **Nếu máy chưa cài Python 3: tuyệt đối không tự ý cài đặt.** Thay vào đó, tra trực tiếp các tệp dữ liệu cục bộ trong `.agents/skills/ui-ux-pro-max/data/` (như `ux-guidelines.csv`, `charts.csv`, `styles.csv`, `react-performance.csv`, `stacks/react.csv`, `stacks/html-tailwind.csv`) và phần Quick Reference trong `SKILL.md`.

---

## 6. Checklist chốt trước khi bàn giao UI (Pre-Delivery Gate)

- [ ] **Mobile-first (`375px`)**: Không vỡ layout, không tràn ngang bất thường, thao tác lọc ST/Cụm ở dòng đầu rõ ràng.
- [ ] **Khả năng đọc & Trạng thái**: Độ tương phản chữ `>= 4.5:1`, icon/control `>= 3:1`, focus ring rõ ràng; có đủ `loading`, `empty`, `error`, `disabled`.
- [ ] **Chuẩn số liệu & Thuật ngữ**: Đúng chữ **ST**, trung lập thương hiệu, số liệu căn phải `tabular-nums`, đơn vị triệu đồng, cột Nhân viên gộp 1 cột.
- [ ] **Phân quyền & Xuất dữ liệu**: Nút Excel mặc định ẩn/khóa theo `useExcelExportPermission`; nút/modal SQL chỉ hiện với `ADMIN`; ảnh xuất `html2canvas` không có footer watermark và không bị cắt chiều dài.
- [ ] **Kiểm chứng kỹ thuật**: Chạy kiểm tra TypeScript / `npm run build` (hoặc `npm run lint`) sau chỉnh sửa cuối và chỉ báo cáo kết quả đã quan sát trực tiếp.

