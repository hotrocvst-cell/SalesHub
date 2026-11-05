import { useState } from 'react';
import html2canvas from 'html2canvas';

export function useLeaderboardExport() {
    const [isExporting, setIsExporting] = useState(false);

    const exportLeaderboardImage = async (elementId: string, title: string = 'Bang-Xep-Hang-Game') => {
        const element = document.getElementById(elementId);
        if (!element) return;

        setIsExporting(true);
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    clonedDoc.documentElement.style.height = 'auto';
                    clonedDoc.body.style.height = 'auto';

                    const clonedEl = clonedDoc.getElementById(elementId);
                    if (clonedEl) {
                        clonedEl.style.height = 'auto';
                        clonedEl.style.maxHeight = 'none';
                        clonedEl.style.overflow = 'visible';
                        clonedEl.style.width = '850px'; // Cố định chiều rộng tối ưu dọc Smartphone
                    }

                    // Ẩn tất cả các phần tử gắn data-html2canvas-ignore hoặc data-export-ignore
                    const ignoreEls = clonedDoc.querySelectorAll('[data-html2canvas-ignore="true"], [data-export-ignore="true"]');
                    ignoreEls.forEach(el => {
                        (el as HTMLElement).style.display = 'none';
                    });
                }
            });

            // Tải ảnh về
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            link.download = `${title}-${new Date().toISOString().slice(0, 10)}.png`;
            link.click();
        } catch (error) {
            console.error('Lỗi khi xuất ảnh bảng xếp hạng:', error);
        } finally {
            setIsExporting(false);
        }
    };

    return { exportLeaderboardImage, isExporting };
}

