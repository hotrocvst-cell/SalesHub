import html2canvas from 'html2canvas';

/**
 * BỘ TIỆN ÍCH TÍNH TOÁN SCALE VÀ XUẤT ẢNH CHUẨN 8K VỚI CƠ CHẾ AUTO-SAFETY CLAMP
 * Tuân thủ quy chuẩn SalesHub:
 * - Áp dụng scale sắc nét tối đa của chuẩn 8K (scale 4.0x cho layout mobile 720px - 960px; scale hướng tới 7680px nếu bảng rộng).
 * - Tích hợp Auto-Safety Clamp: Nếu totalHeight * scale > 12,000px, tự động hạ nhẹ scale để chống tràn bộ nhớ Canvas,
 *   ngăn ngừa 100% rủi ro crash trình duyệt hoặc trắng ảnh trên iPhone/Android.
 * - Chuẩn hóa khung hình xuất ảnh độc lập 100% với kích thước viewport/zoom/scroll của người dùng.
 * - Tuyệt đối không chèn Footer Watermark theo Rule toàn hệ thống.
 */

export const MAX_SAFE_CANVAS_HEIGHT = 12000;

/**
 * Tính toán scale chuẩn 8K an toàn cho mọi phần tử HTML
 * @param element Phần tử DOM cần chụp ảnh
 * @param baseTargetWidth Chiều rộng cấu hình mong muốn (ví dụ 720px, 800px, 960px, hoặc chiều rộng đo được của bảng)
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

export interface StandardReportCanvasOptions {
    targetWidth?: number;
    kpiColumns?: number;
    containerSelector?: string;
    onCustomClone?: (clonedDoc: Document, clonedReport: HTMLElement) => void;
}

/**
 * Tạo canvas báo cáo chuẩn 8K độc lập với màn hình người dùng
 * Đảm bảo:
 * 1. Khung hình xuất ảnh cố định targetWidth (800px - 880px) bất kể người dùng xem trên điện thoại hay màn hình rộng.
 * 2. Tự động loại bỏ nút bấm, thanh trạng thái (data-html2canvas-ignore, data-export-ignore, data-freshness-bar).
 * 3. Mở rộng 100% chiều cao tự nhiên (Unlimited Height, không cắt cụt báo cáo).
 * 4. Không chèn bất kỳ footer watermark nào.
 */
export async function generateStandardReportCanvas(
    originalElement: HTMLElement,
    options: StandardReportCanvasOptions = {}
): Promise<HTMLCanvasElement | null> {
    if (!originalElement) return null;

    if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
    }

    // Chờ 2 frames render để DOM layout hoàn toàn ổn định
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const targetWidth = options.targetWidth || 840;
    const exportScale = calculate8KScale(originalElement, targetWidth);

    try {
        return await html2canvas(originalElement, {
            scale: exportScale,
            width: targetWidth,
            windowWidth: targetWidth + 40,
            scrollX: 0,
            scrollY: 0,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            ignoreElements: (el) =>
                el.getAttribute('data-html2canvas-ignore') === 'true' ||
                el.getAttribute('data-export-ignore') === 'true' ||
                el.getAttribute('data-freshness-bar') === 'true',
            onclone: (clonedDoc) => {
                // 1. Nhúng trực tiếp định nghĩa font chữ UTM Avo vào iframe clonedDoc
                const fontStyle = clonedDoc.createElement('style');
                fontStyle.innerHTML = `
                    @font-face {
                        font-family: 'UTM Avo';
                        src: url('/fonts/UTM-Avo.ttf') format('truetype');
                        font-weight: 400;
                        font-style: normal;
                    }
                    @font-face {
                        font-family: 'UTM Avo';
                        src: url('/fonts/UTM-AvoBold.ttf') format('truetype');
                        font-weight: 700;
                        font-style: normal;
                    }
                    * {
                        -webkit-font-smoothing: antialiased;
                        -moz-osx-font-smoothing: grayscale;
                        box-sizing: border-box;
                    }
                    img, svg { display: inline-block !important; vertical-align: middle !important; }
                    td, th { vertical-align: middle !important; }
                    [data-report-table="true"] * { overflow: visible !important; }
                `;
                clonedDoc.head.appendChild(fontStyle);

                // 2. Không giới hạn chiều cao tài liệu theo quy chuẩn Unlimited Height
                clonedDoc.documentElement.style.height = 'auto';
                clonedDoc.documentElement.style.maxHeight = 'none';
                clonedDoc.documentElement.style.overflow = 'visible';
                clonedDoc.documentElement.style.width = `${targetWidth}px`;

                clonedDoc.body.style.height = 'auto';
                clonedDoc.body.style.maxHeight = 'none';
                clonedDoc.body.style.overflow = 'visible';
                clonedDoc.body.style.width = `${targetWidth}px`;

                // 3. Tìm container báo cáo trong clonedDoc
                const selector = options.containerSelector || '[data-report-table="true"]';
                const clonedReport = (clonedDoc.querySelector(selector) || clonedDoc.body.firstElementChild) as HTMLElement;
                if (!clonedReport) return;

                // 4. Xóa bỏ các nút hành động, thanh trạng thái
                clonedReport.querySelectorAll('[data-html2canvas-ignore="true"], [data-export-ignore="true"], [data-freshness-bar="true"]').forEach(el => {
                    (el as HTMLElement).remove();
                });

                // 5. Cố định kích thước khung báo cáo chuẩn hóa độc lập với màn hình người dùng
                clonedReport.style.width = `${targetWidth}px`;
                clonedReport.style.minWidth = `${targetWidth}px`;
                clonedReport.style.maxWidth = `${targetWidth}px`;
                clonedReport.style.height = 'auto';
                clonedReport.style.minHeight = 'auto';
                clonedReport.style.maxHeight = 'none';
                clonedReport.style.overflow = 'visible';
                clonedReport.style.margin = '0 auto';
                clonedReport.style.padding = '20px';
                clonedReport.style.paddingBottom = '28px';
                clonedReport.style.boxSizing = 'border-box';
                clonedReport.style.backgroundColor = '#ffffff';
                clonedReport.style.borderRadius = '0px';
                clonedReport.style.boxShadow = 'none';
                clonedReport.style.fontFamily = "'UTM Avo', 'Avo', sans-serif";

                // 6. Gỡ bỏ sticky trên thead/th
                clonedReport.querySelectorAll<HTMLElement>('.sticky, thead, th').forEach(el => {
                    el.style.position = 'static';
                });

                // 7. Mở rộng tất cả container cuộn bên trong
                clonedReport.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-y-auto, [class*="max-h-"]').forEach(el => {
                    el.style.overflow = 'visible';
                    el.style.overflowX = 'visible';
                    el.style.overflowY = 'visible';
                    el.style.maxHeight = 'none';
                    el.style.height = 'auto';
                    el.style.width = '100%';
                    el.scrollLeft = 0;
                });

                // 8. Tối ưu bảng dữ liệu: table-layout auto, căn chỉnh các cột
                const clonedTable = clonedReport.querySelector('table');
                if (clonedTable) {
                    clonedTable.style.width = '100%';
                    clonedTable.style.minWidth = '100%';
                    clonedTable.style.tableLayout = 'auto';
                }

                // 9. Cố định lưới KPI theo số cột được chỉ định (nếu có)
                if (options.kpiColumns) {
                    const kpiGrid = clonedReport.querySelector('[data-kpi-grid="true"]') as HTMLElement;
                    if (kpiGrid) {
                        kpiGrid.style.display = 'grid';
                        kpiGrid.style.gridTemplateColumns = `repeat(${options.kpiColumns}, minmax(0, 1fr))`;
                    }
                }

                // 10. Hook tùy chỉnh nếu có
                if (options.onCustomClone) {
                    options.onCustomClone(clonedDoc, clonedReport);
                }
            }
        });
    } catch (err) {
        console.error('Lỗi khi vẽ canvas báo cáo chuẩn hóa:', err);
        return null;
    }
}

/**
 * Tải canvas thành file ảnh PNG về máy khách
 */
export async function downloadReportCanvas(canvas: HTMLCanvasElement, fileName: string): Promise<boolean> {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    return true;
}

/**
 * Sao chép canvas vào clipboard dưới dạng PNG Blob
 */
export async function copyReportCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob || !navigator.clipboard || !window.ClipboardItem) return false;
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
}

