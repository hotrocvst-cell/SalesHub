import html2canvas from 'html2canvas';

export async function exportFocusCampaignImage(
    reportElement: HTMLElement,
    fileNamePrefix: string
): Promise<void> {
    if (!reportElement) return;

    // Chiều rộng xuất ảnh chuẩn tối ưu smartphone theo Quy chuẩn xuất ảnh (850px - 1000px)
    const targetWidth = 950;

    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'fixed';
    exportContainer.style.left = '-9999px';
    exportContainer.style.top = '0';
    exportContainer.style.width = `${targetWidth}px`;
    exportContainer.style.backgroundColor = '#ffffff';
    exportContainer.style.zIndex = '-9999';

    const cloned = reportElement.cloneNode(true) as HTMLElement;
    cloned.style.width = `${targetWidth}px`;
    cloned.style.maxWidth = `${targetWidth}px`;
    cloned.style.height = 'auto';
    cloned.style.maxHeight = 'none';
    cloned.style.overflow = 'visible';

    // Xóa tất cả các phần tử bị đánh dấu bỏ qua khi xuất ảnh
    cloned.querySelectorAll<HTMLElement>(
        '[data-export-ignore="true"], [data-html2canvas-ignore="true"]'
    ).forEach(el => el.remove());

    // Gỡ bỏ giới hạn cuộn
    cloned.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-y-auto, [class*="max-h-"]').forEach(el => {
        el.style.overflow = 'visible';
        el.style.maxHeight = 'none';
    });

    exportContainer.appendChild(cloned);
    document.body.appendChild(exportContainer);

    try {
        if (document.fonts?.ready) {
            await document.fonts.ready;
        }

        await new Promise(res => setTimeout(res, 150));

        const canvas = await html2canvas(cloned, {
            scale: 2.5,
            width: targetWidth,
            windowWidth: targetWidth,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            onclone: (clonedDoc) => {
                clonedDoc.documentElement.style.height = 'auto';
                clonedDoc.body.style.height = 'auto';
            }
        });

        const link = document.createElement('a');
        link.download = `${fileNamePrefix}_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error('Lỗi xuất ảnh thi đua trọng tâm:', err);
        alert('Không thể tạo file ảnh. Vui lòng thử lại!');
    } finally {
        if (document.body.contains(exportContainer)) {
            document.body.removeChild(exportContainer);
        }
    }
}

