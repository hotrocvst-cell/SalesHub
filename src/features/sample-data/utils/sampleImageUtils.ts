import type { SampleImageAsset } from '../types';

/**
 * Nén hình ảnh mẫu bằng HTML5 Canvas (tối đa 1400px, JPEG 0.78 ~ 120-220KB/ảnh)
 * Đảm bảo chữ và số liệu BI vẫn sắc nét khi xem/test OCR nhưng tối ưu dung lượng Cloud.
 */
export function compressSampleImage(
    file: File,
    maxDim: number = 1400,
    quality: number = 0.78
): Promise<SampleImageAsset> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const rawDataUrl = e.target?.result as string;
            if (!rawDataUrl) {
                reject(new Error('Không thể đọc dữ liệu ảnh.'));
                return;
            }

            const img = new Image();
            img.onload = () => {
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;

                if (width > maxDim || height > maxDim) {
                    if (width >= height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                let finalDataUrl = rawDataUrl;
                let finalMime = file.type || 'image/jpeg';

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Nền trắng tránh viền đen nếu ảnh PNG trong suốt chuyển sang JPEG
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    finalDataUrl = canvas.toDataURL('image/jpeg', quality);
                    finalMime = 'image/jpeg';
                }

                const base64Body = finalDataUrl.split(',')[1] || '';
                const estimatedBytes = Math.round((base64Body.length * 3) / 4);
                const sizeKb = Math.max(1, Math.round(estimatedBytes / 1024));

                resolve({
                    id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    file_name: file.name || `anh_mau_${Date.now()}.jpg`,
                    mime_type: finalMime,
                    data_url: finalDataUrl,
                    width,
                    height,
                    size_kb: sizeKb,
                    caption: '',
                    uploaded_at: new Date().toISOString()
                });
            };

            img.onerror = () => reject(new Error('Tệp hình ảnh bị lỗi hoặc không được trình duyệt hỗ trợ.'));
            img.src = rawDataUrl;
        };

        reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh từ thiết bị.'));
        reader.readAsDataURL(file);
    });
}

/**
 * Chuyển đổi Data URL sang PNG Blob để sao chép vào Clipboard (chuẩn ClipboardItem trên Chrome/Edge)
 */
function dataUrlToPngBlob(dataUrl: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Không thể tạo canvas sao chép ảnh.'));
                return;
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Không thể xuất blob PNG.'));
            }, 'image/png');
        };
        img.onerror = () => reject(new Error('Không thể tải ảnh để sao chép.'));
        img.src = dataUrl;
    });
}

/**
 * Sao chép hình ảnh mẫu vào Clipboard để dán nhanh (Ctrl + V) vào công cụ OCR
 */
export async function copySampleImageToClipboard(dataUrl: string): Promise<boolean> {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        return false;
    }
    try {
        const pngBlob = await dataUrlToPngBlob(dataUrl);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
        return true;
    } catch (err) {
        console.warn('Không thể copy ảnh vào clipboard:', err);
        return false;
    }
}

/**
 * Tải hình ảnh mẫu về thiết bị
 */
export function downloadSampleImage(asset: SampleImageAsset, fallbackPrefix: string = 'Anh_Mau_OCR') {
    const cleanName = (asset.file_name || `${fallbackPrefix}.jpg`).replace(/[^\w.-]+/g, '_');
    const link = document.createElement('a');
    link.href = asset.data_url;
    link.download = cleanName.endsWith('.jpg') || cleanName.endsWith('.png') || cleanName.endsWith('.webp')
        ? cleanName
        : `${cleanName}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
