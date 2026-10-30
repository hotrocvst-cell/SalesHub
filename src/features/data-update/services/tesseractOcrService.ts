import Tesseract from 'tesseract.js';
import type { StoreReportingData } from '../types/ocrTypes';
import { getShortStoreName } from '../../../core/lib/formatters';

/**
 * OCR bằng Tesseract.js chạy thuần WebAssembly cục bộ trên trình duyệt
 * (Dành cho chế độ dự phòng Offline khi không dùng API key ngoài)
 */
export async function runClientTesseractOcr(
    file: File,
    onProgress?: (msg: string, percent: number) => void
): Promise<string> {
    onProgress?.(`Đang khởi tạo Tesseract OCR cho ${file.name}...`, 10);

    const result = await Tesseract.recognize(file, 'vie', {
        logger: m => {
            if (m.status === 'recognizing text' && m.progress) {
                onProgress?.(`Đang nhận diện chữ: ${Math.round(m.progress * 100)}%`, Math.round(m.progress * 90));
            }
        }
    });

    onProgress?.(`Hoàn tất đọc ảnh ${file.name}`, 100);
    return result.data.text || '';
}

