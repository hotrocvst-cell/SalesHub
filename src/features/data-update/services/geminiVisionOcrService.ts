import type { StoreReportingData, EmulationOcrItem, OcrExtractionResult } from '../types/ocrTypes';
import { getShortStoreName, normalizeToMillion, cleanBiNumber } from '../../../core/lib/formatters';
import {
    GeminiQuotaExceededError,
    type GeminiKeySource,
    getUserGeminiKey,
    saveUserGeminiKey,
    clearUserGeminiKey,
    getAdminGeminiKeyLocal,
    fetchAdminGeminiKeyCloud,
    saveAdminGeminiKeyCloud,
    resolveActiveGeminiKey,
    testGeminiApiKey,
    SYSTEM_SETTINGS_SQL
} from './geminiApiKeyService';

// Tái xuất các hàm quản lý Key để tương thích ngược
export {
    GeminiQuotaExceededError,
    type GeminiKeySource,
    getUserGeminiKey,
    saveUserGeminiKey,
    clearUserGeminiKey,
    getAdminGeminiKeyLocal,
    fetchAdminGeminiKeyCloud,
    saveAdminGeminiKeyCloud,
    resolveActiveGeminiKey,
    testGeminiApiKey,
    SYSTEM_SETTINGS_SQL
};

// Hàm cũ tương thích
export function getSavedGeminiApiKey(): string {
    return resolveActiveGeminiKey().key;
}

export function saveGeminiApiKey(key: string): void {
    saveUserGeminiKey(key);
}

/**
 * Chuyển đổi File sang Base64
 */
export async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

/**
 * Gọi Gemini Vision API trích xuất JSON
 */
async function callGeminiVision(
    apiKey: string,
    base64Image: string,
    mimeType: string,
    prompt: string,
    keySource: GeminiKeySource = 'ADMIN'
): Promise<any> {
    const cachedModel = localStorage.getItem('SALESHUB_ACTIVE_GEMINI_MODEL');
    const models = Array.from(
        new Set([
            ...(cachedModel ? [cachedModel] : []),
            'gemini-3.5-flash',
            'gemini-flash-lite-latest',
            'gemini-3.8-flash',
            'gemini-2.5-flash'
        ])
    );
    let lastError: any = null;

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: mimeType || 'image/jpeg',
                                        data: base64Image
                                    }
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        response_mime_type: 'application/json'
                    }
                })
            });

            if (res.status === 429) {
                throw new GeminiQuotaExceededError(
                    'Hạn ngạch API đã đạt giới hạn (HTTP 429 Too Many Requests / Resource Exhausted).',
                    keySource
                );
            }

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const errMsg = errData?.error?.message || `Lỗi HTTP ${res.status} từ Gemini API (${model})`;
                const isQuota =
                    errData?.error?.status === 'RESOURCE_EXHAUSTED' ||
                    errMsg.toLowerCase().includes('quota') ||
                    errMsg.toLowerCase().includes('rate limit');

                if (isQuota) {
                    throw new GeminiQuotaExceededError(errMsg, keySource);
                }

                throw new Error(errMsg);
            }

            const json = await res.json();
            const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawText) throw new Error('Không nhận được nội dung từ Gemini');

            localStorage.setItem('SALESHUB_ACTIVE_GEMINI_MODEL', model);
            return JSON.parse(rawText);
        } catch (err: any) {
            // Nếu là lỗi Quota, ném ra ngay lập tức để UI mở modal Google cá nhân
            if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) {
                throw err;
            }
            console.warn(`Lỗi gọi model ${model}:`, err);
            lastError = err;
        }
    }

    throw lastError || new Error('Không thể kết nối tới Gemini API');
}

/**
 * 1. TRÍCH XUẤT ẢNH DOANH THU QUY ĐỔI (DT-QĐ)
 */
export async function extractRevenueQdImage(
    apiKey: string,
    file: File,
    keySource: GeminiKeySource = 'ADMIN'
): Promise<{ reportDate?: string; reportTime?: string; stores: Partial<StoreReportingData>[] }> {
    const base64 = await fileToBase64(file);
    const prompt = `Bạn là chuyên gia phân tích dữ liệu kinh doanh của hệ thống bán lẻ. 
Nhiệm vụ: Trích xuất chính xác các số liệu DOANH THU QUY ĐỔI (DTQĐ) từ ảnh chụp màn hình ứng dụng BI.

LƯU Ý NGHIỆP VỤ BẮT BUỘC:
1. BỎ QUA HOÀN TOÀN các watermark chữ mờ ("26479 - Đào Bá Linh",...).
2. BỎ QUA HOÀN TOÀN thẻ "Tổng" hoặc "Tổng (2 dòng)".
3. CHỈ TRÍCH XUẤT các thẻ của từng SIÊU THỊ CỤ THỂ có tên bắt đầu bằng mã số (ví dụ: "10335 - AAR_BRV_VTA - 290 Trương Công Định", "111 - TGD_BRV_VTA - 290 Trương Công Định").
4. Đọc ngày giờ cập nhật ở góc trên bên phải ảnh (ví dụ: "30/10/2026", "17:19:12").
5. Đối với mỗi siêu thị, lấy các chỉ số sau:
   - storeRawName: Tên đầy đủ của siêu thị trên thẻ
   - revenueQd: Giá trị của "DOANH THU QĐ" (loại bỏ dấu phẩy phân cách hàng nghìn, ví dụ: trên ảnh "20,688" thì kết quả là 20688, "3,123" -> 3123)
   - targetQd: Giá trị của "TARGET" (ví dụ 13919)
   - quantityQd: Giá trị của "SỐ LƯỢNG" (ví dụ 1934)
   - dtTraGopQd: Giá trị của "DT TRẢ GÓP QĐ" (ví dụ 9093)

Định dạng JSON trả về:
{
  "reportDate": "YYYY-MM-DD",
  "reportTime": "HH:mm:ss",
  "stores": [
    {
      "storeRawName": "10335 - AAR_BRV_VTA - 290 Trương Công Định",
      "revenueQd": 20688,
      "targetQd": 13919,
      "quantityQd": 1934,
      "dtTraGopQd": 9093
    }
  ]
}`;

    const parsed = await callGeminiVision(apiKey, base64, file.type, prompt, keySource);
    return {
        reportDate: parsed.reportDate,
        reportTime: parsed.reportTime,
        stores: parsed.stores || []
    };
}

/**
 * 2. TRÍCH XUẤT ẢNH DOANH THU THỰC (DT-THỰC)
 */
export async function extractRevenueRealImage(
    apiKey: string,
    file: File,
    keySource: GeminiKeySource = 'ADMIN'
): Promise<{ reportDate?: string; reportTime?: string; stores: Partial<StoreReportingData>[] }> {
    const base64 = await fileToBase64(file);
    const prompt = `Bạn là chuyên gia phân tích dữ liệu kinh doanh của hệ thống bán lẻ. 
Nhiệm vụ: Trích xuất chính xác các số liệu DOANH THU THỰC TẾ từ ảnh chụp màn hình ứng dụng BI.

LƯU Ý NGHIỆP VỤ BẮT BUỘC:
1. BỎ QUA HOÀN TOÀN các watermark chữ mờ ("26479 - Đào Bá Linh",...).
2. BỎ QUA HOÀN TOÀN thẻ "Tổng" hoặc "Tổng (2 dòng)".
3. CHỈ TRÍCH XUẤT các thẻ của từng SIÊU THỊ CỤ THỂ (ví dụ: "10335 - AAR_BRV_VTA - 290 Trương Công Định", "111 - TGD_BRV_VTA - 290 Trương Công Định").
4. Đọc ngày giờ cập nhật ở góc trên bên phải ảnh.
5. Đối với mỗi siêu thị, lấy các chỉ số sau:
   - storeRawName: Tên siêu thị
   - revenueReal: Giá trị của "DOANH THU" (ví dụ 15964)
   - targetReal: Giá trị của "TARGET" (ví dụ 10889)
   - installmentReal: Giá trị của "DT TRẢ GÓP" (ví dụ 6685)
   - quantityReal: Giá trị của "SỐ LƯỢNG" (ví dụ 1934)
   - avg3MonthsReal: Giá trị của "TB 3 THÁNG" (ví dụ 6738)

Định dạng JSON trả về:
{
  "reportDate": "YYYY-MM-DD",
  "reportTime": "HH:mm:ss",
  "stores": [
    {
      "storeRawName": "10335 - AAR_BRV_VTA - 290 Trương Công Định",
      "revenueReal": 15964,
      "targetReal": 10889,
      "installmentReal": 6685,
      "quantityReal": 1934,
      "avg3MonthsReal": 6738
    }
  ]
}`;

    const parsed = await callGeminiVision(apiKey, base64, file.type, prompt, keySource);
    return {
        reportDate: parsed.reportDate,
        reportTime: parsed.reportTime,
        stores: parsed.stores || []
    };
}

/**
 * 3. TRÍCH XUẤT 1 ẢNH THI ĐUA LŨY KẾ (BẢNG DARK MODE)
 */
export async function extractSingleEmulationImage(
    apiKey: string,
    file: File,
    keySource: GeminiKeySource = 'ADMIN'
): Promise<{
    programs: Array<{
        programName: string;
        unit: string;
        stores: Array<{
            storeRawName: string;
            actual: number;
            target: number;
            completionRate?: number;
        }>;
    }>;
}> {
    const base64 = await fileToBase64(file);
    const prompt = `Bạn là chuyên gia trích xuất dữ liệu bảng thi đua lũy kế từ ảnh giao diện Dark Mode ứng dụng BI.
Ảnh này chứa một hoặc nhiều BẢNG THI ĐUA LŨY KẾ xếp dọc.

LƯU Ý NGHIỆP VỤ BẮT BUỘC:
1. BỎ QUA HOÀN TOÀN watermark chữ mờ ("26479 - Đào Bá Linh",...).
2. BỎ QUA HOÀN TOÀN dòng "TỔNG" trong từng bảng.
3. Mỗi bảng có:
   - TIÊU ĐỀ BẢNG ở góc trên bên trái (Ví dụ: "T09 - T10 IPHONE 18 series, iPhone Duo", "T10 - NẠP - RÚT TIỀN TÀI KHOẢN NGÂN HÀNG", "T10 - Bảo Hiểm Tổng", "T10 - BẢO HIỂM THỢ ĐMX_ICT",...).
   - CỘT 2: Tiêu đề cột có thể là "DOANH THU" hoặc "SỐ LƯỢNG".
   - CỘT 3: Luôn là "TARGET".
   - CỘT 4: "% HT THÁNG".
4. DƯỚI DÒNG TỔNG là CÁC DÒNG SIÊU THỊ:
   - Tên siêu thị chữ màu xanh dương (ví dụ: "AAR_BRV_VTA - 290 Trương Công Định", "TGD_BRV_VTA - 290 Trương Công Định").
   - Giá trị Cột 2 (DOANH THU hoặc SỐ LƯỢNG thực tế).
   - Giá trị Cột 3 (TARGET).
   - Giá trị Cột 4 (% HT nếu đọc được, nếu bị cắt như "142...." thì tính lại = actual / target * 100).

Định dạng JSON trả về:
{
  "programs": [
    {
      "programName": "T09 - T10 IPHONE 18 series, iPhone Duo",
      "unit": "DOANH THU",
      "stores": [
        {
          "storeRawName": "AAR_BRV_VTA - 290 Trương Công Định",
          "actual": 14352.92,
          "target": 10097.16,
          "completionRate": 142.15
        }
      ]
    }
  ]
}`;

    const parsed = await callGeminiVision(apiKey, base64, file.type, prompt, keySource);
    return {
        programs: parsed.programs || []
    };
}

/**
 * 4. TỔNG HỢP VÀ GHÉP NỐI TOÀN DIỆN TỪ 3 NHÓM ẢNH
 */
export async function extractAndMergeAllImages(
    apiKey: string,
    files: {
        qdFile?: File | null;
        realFile?: File | null;
        emulationFiles?: File[];
    },
    onProgress?: (msg: string, percent: number) => void,
    keySource: GeminiKeySource = 'ADMIN'
): Promise<OcrExtractionResult> {
    if (!apiKey) {
        return {
            success: false,
            stores: [],
            errors: ['Chưa có API Key hoạt động!']
        };
    }

    const errors: string[] = [];
    let detectedReportDate = '';
    let detectedReportTime = '';

    const storeMap: Record<string, StoreReportingData> = {};

    function getOrCreateStore(rawName: string, code?: string): StoreReportingData {
        const short = getShortStoreName(rawName);
        if (!storeMap[short]) {
            storeMap[short] = {
                storeCode: code,
                storeRawName: rawName,
                storeShortName: short,
                revenueQd: 0,
                targetQd: 0,
                quantityQd: 0,
                revenueReal: 0,
                targetReal: 0,
                quantityReal: 0,
                installmentReal: 0,
                installmentRateReal: 0,
                emulations: {}
            };
        }
        return storeMap[short];
    }

    // Bước 1: Trích xuất ảnh Doanh thu quy đổi
    if (files.qdFile) {
        onProgress?.('Đang phân tích ảnh Doanh thu quy đổi (DT-QĐ)...', 20);
        try {
            const qdRes = await extractRevenueQdImage(apiKey, files.qdFile, keySource);
            if (qdRes.reportDate) detectedReportDate = qdRes.reportDate;
            if (qdRes.reportTime) detectedReportTime = qdRes.reportTime;

            qdRes.stores.forEach(st => {
                if (!st.storeRawName) return;
                const store = getOrCreateStore(st.storeRawName);
                store.revenueQd = cleanBiNumber(st.revenueQd);
                store.targetQd = cleanBiNumber(st.targetQd);
                store.quantityQd = cleanBiNumber(st.quantityQd);
            });
        } catch (err: any) {
            if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
            errors.push(`Lỗi đọc ảnh DT-QĐ: ${err?.message}`);
        }
    }

    // Bước 2: Trích xuất ảnh Doanh thu thực
    if (files.realFile) {
        onProgress?.('Đang phân tích ảnh Doanh thu thực (DT-THỰC)...', 45);
        try {
            const realRes = await extractRevenueRealImage(apiKey, files.realFile, keySource);
            if (!detectedReportDate && realRes.reportDate) detectedReportDate = realRes.reportDate;
            if (!detectedReportTime && realRes.reportTime) detectedReportTime = realRes.reportTime;

            realRes.stores.forEach(st => {
                if (!st.storeRawName) return;
                const store = getOrCreateStore(st.storeRawName);
                store.revenueReal = cleanBiNumber(st.revenueReal);
                store.targetReal = cleanBiNumber(st.targetReal);
                store.quantityReal = cleanBiNumber(st.quantityReal);
                store.installmentReal = cleanBiNumber(st.installmentReal);
                store.avg3MonthsReal = cleanBiNumber(st.avg3MonthsReal);

                if (store.revenueReal > 0 && store.installmentReal > 0) {
                    store.installmentRateReal = Number(((store.installmentReal / store.revenueReal) * 100).toFixed(2));
                }
            });
        } catch (err: any) {
            if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
            errors.push(`Lỗi đọc ảnh DT Thực: ${err?.message}`);
        }
    }

    // Bước 3: Trích xuất danh sách ảnh Thi đua lũy kế
    if (files.emulationFiles && files.emulationFiles.length > 0) {
        const totalEmu = files.emulationFiles.length;
        for (let i = 0; i < totalEmu; i++) {
            const emuFile = files.emulationFiles[i];
            const currentPct = 50 + Math.round(((i + 1) / totalEmu) * 45);
            onProgress?.(`Đang phân tích bảng thi đua (${i + 1}/${totalEmu}): ${emuFile.name}...`, currentPct);

            try {
                const emuRes = await extractSingleEmulationImage(apiKey, emuFile, keySource);
                (emuRes.programs || []).forEach(prog => {
                    const pName = prog.programName.trim();
                    const pUnit = prog.unit || 'DOANH THU';

                    (prog.stores || []).forEach(stRow => {
                        if (!stRow.storeRawName) return;
                        const store = getOrCreateStore(stRow.storeRawName);

                        const act = cleanBiNumber(stRow.actual);
                        const tg = cleanBiNumber(stRow.target);
                        const pct = tg > 0 ? Number(((act / tg) * 100).toFixed(1)) : 0;

                        store.emulations[pName] = {
                            programName: pName,
                            unit: pUnit,
                            actual: act,
                            target: tg,
                            completionRate: pct
                        };
                    });
                });
            } catch (err: any) {
                if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
                errors.push(`Lỗi đọc ảnh thi đua ${emuFile.name}: ${err?.message}`);
            }
        }
    }

    onProgress?.('Tổng hợp số liệu hoàn tất!', 100);

    return {
        success: Object.keys(storeMap).length > 0,
        reportDate: detectedReportDate,
        reportTime: detectedReportTime,
        stores: Object.values(storeMap),
        errors: errors.length > 0 ? errors : undefined
    };
}
