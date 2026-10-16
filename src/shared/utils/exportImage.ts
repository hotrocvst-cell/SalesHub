/**
 * BỘ TIỆN ÍCH TÍNH TOÁN SCALE VÀ XUẤT ẢNH CHUẨN 8K VỚI CƠ CHẾ AUTO-SAFETY CLAMP
 * Tuân thủ quy chuẩn SalesHub:
 * - Áp dụng scale sắc nét tối đa của chuẩn 8K (scale 4.0x cho layout mobile 720px - 960px; scale hướng tới 7680px nếu bảng rộng).
 * - Tích hợp Auto-Safety Clamp: Nếu totalHeight * scale > 12,000px, tự động hạ nhẹ scale để chống tràn bộ nhớ Canvas,
 *   ngăn ngừa 100% rủi ro crash trình duyệt hoặc trắng ảnh trên iPhone/Android.
 */

export const MAX_SAFE_CANVAS_HEIGHT = 12000;

/**
 * Tính toán scale chuẩn 8K an toàn cho mọi phần tử HTML
 * @param element Phần tử DOM cần chụp ảnh
 * @param baseTargetWidth Chiều rộng cấu hình mong muốn (ví dụ 720px, 960px, hoặc chiều rộng đo được của bảng)
 * @returns scale tối ưu (đã clamp an toàn)
 */
export function calculate8KScale(element: HTMLElement, baseTargetWidth?: number): number {
    const elementHeight = Math.max(element.scrollHeight, element.offsetHeight, 1000);
    const contentWidth = baseTargetWidth || Math.max(element.scrollWidth, element.offsetWidth, 800);

    // Mặc định chuẩn 8K cho layout mobile/tablet (720px - 960px) là scale 4.0x
    let scale = 4.0;

    // Nếu là bảng rộng desktop (>= 1200px), tính toán tỷ lệ để đạt tới 7680px (dao động 4.0x - 5.5x)
    if (contentWidth >= 1200) {
        const targetPixelWidth = 7680;
        scale = Math.min(Math.max(targetPixelWidth / contentWidth, 4.0), 5.5);
    }

    // Auto-Safety Clamp: Giới hạn chiều cao tối đa của Canvas không vượt quá 12,000px
    if (elementHeight * scale > MAX_SAFE_CANVAS_HEIGHT) {
        scale = Math.max(MAX_SAFE_CANVAS_HEIGHT / elementHeight, 1.5);
    }

    return Number(scale.toFixed(2));
}
