import html2canvas from 'html2canvas';
import { calculate8KScale } from '../../../shared/utils/exportImage';

/**
 * Tạo canvas báo cáo thi đua trọng tâm chuẩn hóa:
 * - Tự động đo bề rộng của bảng chi tiết để mở rộng targetWidth, đảm bảo 100% cột dữ liệu hiển thị trọn vẹn, không bị cắt cụt.
 * - Gỡ bỏ overflow-x-auto và các giới hạn cuộn khi render canvas.
 * - Tuân thủ Quy tắc xuất ảnh: Unlimited Height (không giới hạn chiều dài) & Tuyệt đối không Footer Watermark.
 */
export async function generateFocusCampaignCanvas(reportElement: HTMLElement): Promise<HTMLCanvasElement | null> {
    if (!reportElement) return null;

    // 1. Đo chính xác chiều rộng tự nhiên của bảng chi tiết
    const originalTable = reportElement.querySelector('table');
    let tableContentWidth = 0;
    if (originalTable) {
        tableContentWidth = Math.max(originalTable.scrollWidth, originalTable.offsetWidth);
    }

    // Chiều rộng xuất ảnh: tối thiểu 960px cho mobile/smartphone, mở rộng tự động theo độ rộng thực tế của bảng
    const targetWidth = Math.max(tableContentWidth + 48, 960);

    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'fixed';
    exportContainer.style.left = '-99999px';
    exportContainer.style.top = '0';
    exportContainer.style.width = `${targetWidth}px`;
    exportContainer.style.minWidth = `${targetWidth}px`;
    exportContainer.style.maxWidth = `${targetWidth}px`;
    exportContainer.style.backgroundColor = '#ffffff';
    exportContainer.style.overflow = 'visible';
    exportContainer.style.zIndex = '-9999';

    const cloned = reportElement.cloneNode(true) as HTMLElement;
    cloned.style.width = `${targetWidth}px`;
    cloned.style.minWidth = `${targetWidth}px`;
    cloned.style.maxWidth = `${targetWidth}px`;
    cloned.style.height = 'auto';
    cloned.style.minHeight = 'auto';
    cloned.style.maxHeight = 'none';
    cloned.style.overflow = 'visible';
    cloned.style.boxSizing = 'border-box';
    cloned.style.padding = '20px';
    cloned.style.backgroundColor = '#ffffff';

    // Xóa tất cả các phần tử bị đánh dấu bỏ qua khi xuất ảnh
    cloned.querySelectorAll<HTMLElement>(
        '[data-export-ignore="true"], [data-html2canvas-ignore="true"], [data-freshness-bar="true"]'
    ).forEach(el => el.remove());

    // Gỡ bỏ giới hạn cuộn và mở rộng toàn bộ container con
    cloned.querySelectorAll<HTMLElement>('.overflow-hidden').forEach(el => {
        el.style.overflow = 'visible';
    });

    cloned.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-y-auto, [class*="max-h-"]').forEach(el => {
        el.style.overflow = 'visible';
        el.style.overflowX = 'visible';
        el.style.overflowY = 'visible';
        el.style.maxHeight = 'none';
        el.style.height = 'auto';
        el.style.width = '100%';
        el.style.minWidth = '100%';
    });

    // Bung 100% bảng dữ liệu để hiển thị trọn vẹn toàn bộ các cột
    const clonedTable = cloned.querySelector('table');
    if (clonedTable) {
        clonedTable.style.width = '100%';
        if (tableContentWidth > 0) {
            clonedTable.style.minWidth = `${tableContentWidth}px`;
        }
        clonedTable.style.tableLayout = 'auto';
    }

    // Gỡ bỏ sticky trên thead và th/td
    cloned.querySelectorAll<HTMLElement>('.sticky, thead, th, td').forEach(el => {
        el.style.position = 'static';
    });

    // Chuẩn hóa th
    cloned.querySelectorAll<HTMLElement>('th').forEach(th => {
        th.style.overflow = 'visible';
        th.style.whiteSpace = 'normal';
    });

    exportContainer.appendChild(cloned);
    document.body.appendChild(exportContainer);

    try {
        if (document.fonts?.ready) {
            await document.fonts.ready;
        }

        await new Promise(resolve => {
            requestAnimationFrame(() => {
                setTimeout(resolve, 150);
            });
        });

        // Áp dụng scale tối ưu với cơ chế an toàn bộ nhớ (Auto-Safety Clamp)
        const exportScale = Math.min(calculate8KScale(cloned, targetWidth), 3.0);

        const canvas = await html2canvas(cloned, {
            scale: exportScale,
            width: targetWidth,
            windowWidth: targetWidth,
            scrollX: 0,
            scrollY: 0,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: true,
            logging: false,
            ignoreElements: (el) =>
                el.getAttribute('data-html2canvas-ignore') === 'true' ||
                el.getAttribute('data-export-ignore') === 'true' ||
                el.getAttribute('data-freshness-bar') === 'true',
            onclone: (clonedDoc) => {
                clonedDoc.documentElement.style.height = 'auto';
                clonedDoc.body.style.height = 'auto';
                clonedDoc.documentElement.style.width = `${targetWidth}px`;
                clonedDoc.body.style.width = `${targetWidth}px`;
                clonedDoc.documentElement.style.overflow = 'visible';
                clonedDoc.body.style.overflow = 'visible';
            }
        });

        return canvas;
    } finally {
        if (document.body.contains(exportContainer)) {
            document.body.removeChild(exportContainer);
        }
    }
}

/**
 * Tải file ảnh báo cáo thi đua trọng tâm PNG về máy khách
 */
export async function exportFocusCampaignImage(
    reportElement: HTMLElement,
    fileNamePrefix: string
): Promise<boolean> {
    try {
        const canvas = await generateFocusCampaignCanvas(reportElement);
        if (!canvas) return false;

        const link = document.createElement('a');
        link.download = `${fileNamePrefix}_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
        return true;
    } catch (err) {
        console.error('Lỗi xuất ảnh thi đua trọng tâm:', err);
        return false;
    }
}

/**
 * Sao chép ảnh báo cáo thi đua trọng tâm vào Clipboard để dán trực tiếp vào Messaging App
 */
export async function copyFocusCampaignImage(
    reportElement: HTMLElement
): Promise<boolean> {
    try {
        const canvas = await generateFocusCampaignCanvas(reportElement);
        if (!canvas) return false;

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
        if (!blob) return false;

        if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            return true;
        } else {
            // Fallback tự động tải file ảnh về nếu trình duyệt không hỗ trợ ClipboardItem
            const link = document.createElement('a');
            link.download = `Thi_Dua_Trong_Tam_${new Date().toISOString().slice(0, 10)}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
            return true;
        }
    } catch (err) {
        console.error('Lỗi sao chép ảnh thi đua trọng tâm:', err);
        return false;
    }
}
