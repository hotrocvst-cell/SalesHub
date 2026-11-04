import type { StoreReportingData, EmulationOcrItem, StoreMobileEmulationCardItem, OcrExtractionResult } from '../types/ocrTypes';
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
Nhiệm vụ: Trích xuất chính xác các số liệu DOANH THU QUY ĐỔI (DTQĐ) và DOANH THU THỰC TẾ (nếu có trên ảnh) từ ảnh chụp màn hình ứng dụng BI.

LƯU Ý NGHIỆP VỤ BẮT BUỘC:
1. BỎ QUA HOÀN TOÀN các watermark chữ mờ ("26479 - Đào Bá Linh",...).
2. BỎ QUA HOÀN TOÀN thẻ "Tổng" hoặc "Tổng (2 dòng)".
3. CHỈ TRÍCH XUẤT các thẻ của từng ST CỤ THỂ có tên bắt đầu bằng mã số (ví dụ: "10335 - AAR_BRV_VTA - 290 Trương Công Định", "111 - TGD_BRV_VTA - 290 Trương Công Định").
4. Đọc ngày giờ cập nhật ở góc trên bên phải ảnh (ví dụ: "30/10/2026", "17:19:12").
5. Đối với mỗi ST, lấy các chỉ số sau:
   - storeRawName: Tên đầy đủ của ST trên thẻ
   - revenueQd: Giá trị của "DOANH THU QĐ" (loại bỏ dấu phẩy phân cách hàng nghìn, ví dụ: trên ảnh "20,688" thì kết quả là 20688, "3,123" -> 3123)
   - targetQd: Giá trị của "TARGET" (nếu là cột Target của bảng DTQĐ)
   - quantityQd: Giá trị của "SỐ LƯỢNG" (ví dụ 1934)
   - dtTraGopQd: Giá trị của "DT TRẢ GÓP QĐ" (ví dụ 9093)
   - revenueReal: Nếu trên ảnh có thêm cột "DOANH THU" (Doanh thu thực tế), trích xuất giá trị này (ví dụ 15964)
   - targetReal: Giá trị của "TARGET" thực nếu có
   - installmentReal: Giá trị của "DT TRẢ GÓP" thực nếu có (ví dụ 6685)
   - avg3MonthsReal: Giá trị của "TB 3 THÁNG" nếu có

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
      "dtTraGopQd": 9093,
      "revenueReal": 15964,
      "targetReal": 10889,
      "installmentReal": 6685,
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
 * 2. TRÍCH XUẤT ẢNH DOANH THU THỰC (DT-THỰC)
 */
export async function extractRevenueRealImage(
    apiKey: string,
    file: File,
    keySource: GeminiKeySource = 'ADMIN'
): Promise<{ reportDate?: string; reportTime?: string; stores: Partial<StoreReportingData>[] }> {
    const base64 = await fileToBase64(file);
    const prompt = `Bạn là chuyên gia phân tích dữ liệu kinh doanh của hệ thống bán lẻ. 
Nhiệm vụ: Trích xuất chính xác các số liệu DOANH THU THỰC TẾ và DOANH THU QUY ĐỔI (nếu có trên ảnh) từ ảnh chụp màn hình ứng dụng BI.

LƯU Ý NGHIỆP VỤ BẮT BUỘC:
1. BỎ QUA HOÀN TOÀN các watermark chữ mờ ("26479 - Đào Bá Linh",...).
2. BỎ QUA HOÀN TOÀN thẻ "Tổng" hoặc "Tổng (2 dòng)".
3. CHỈ TRÍCH XUẤT các thẻ của từng ST CỤ THỂ (ví dụ: "10335 - AAR_BRV_VTA - 290 Trương Công Định", "111 - TGD_BRV_VTA - 290 Trương Công Định").
4. Đọc ngày giờ cập nhật ở góc trên bên phải ảnh.
5. Đối với mỗi ST, lấy các chỉ số sau:
   - storeRawName: Tên ST
   - revenueReal: Giá trị của "DOANH THU" (Doanh thu thực tế, ví dụ 15964)
   - targetReal: Giá trị của "TARGET" (ví dụ 10889)
   - installmentReal: Giá trị của "DT TRẢ GÓP" (ví dụ 6685)
   - quantityReal: Giá trị của "SỐ LƯỢNG" (ví dụ 1934)
   - avg3MonthsReal: Giá trị của "TB 3 THÁNG" (ví dụ 6738)
   - revenueQd: Nếu trên ảnh có thêm cột "DOANH THU QĐ", trích xuất giá trị này (ví dụ 20688)
   - targetQd: Giá trị của "TARGET" quy đổi nếu có

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
      "avg3MonthsReal": 6738,
      "revenueQd": 20688,
      "targetQd": 13919
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
4. DƯỚI DÒNG TỔNG là CÁC DÒNG ST:
   - Tên ST chữ màu xanh dương (ví dụ: "AAR_BRV_VTA - 290 Trương Công Định", "TGD_BRV_VTA - 290 Trương Công Định").
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
 * 3b. TRÍCH XUẤT THẺ THI ĐUA MOBILE TỪNG ST (LƯỚI THẺ 2 CỘT)
 * Dành riêng cho ảnh chụp màn hình điện thoại danh sách thẻ thi đua theo từng ST.
 */
export async function extractStoreMobileEmulationCards(
    apiKey: string,
    file: File,
    keySource: GeminiKeySource = 'ADMIN'
): Promise<{
    storeName?: string;
    reportDate?: string;
    reportTime?: string;
    cards: StoreMobileEmulationCardItem[];
}> {
    const base64 = await fileToBase64(file);
    const prompt = `Bạn là chuyên gia bóc tách số liệu kinh doanh bán lẻ từ ảnh chụp màn hình điện thoại (Mobile App).
Ảnh này chứa các THẺ THI ĐUA HÌNH CHỮ NHẬT XẾP THÀNH 2 CỘT (Mobile Card Grid).

CẤU TRÚC CHI TIẾT CỦA MỖI THẺ:
1. TIÊU ĐỀ THẺ: Tên chương trình thi đua ở góc trên bên trái của thẻ (ví dụ: "T11 - Trả chậm Homecredit", "T11 - VAS", "T11 - Phụ kiện khác IT & Nhóm khác", "T11 - Ví trả sau", "T11 - Cáp sạc", "T11 - Bảo hiểm Tổng", "T11 - Bảo hiểm Thợ ICT", "T11 - MỞ THẺ TÍN DỤNG VPBANK MWG VÀ TPBANK EVO",...).
2. BADGE ĐƠN VỊ: Thẻ badge nhỏ ở góc trên bên phải (chữ "DT" là Doanh thu, chữ "SL" là Số lượng).
3. TỶ LỆ HOÀN THÀNH LỚN: Số phần trăm cỡ lớn in đậm màu xanh lá cây hoặc đỏ nổi bật (ví dụ: "54.9%", "74.4%", "114.5%", "280.9%", "283%", "294.9%", "530.3%", "3,003%"). Đây là "% HT NGÀY".
4. BỐ CỤC 4 Ô SỐ LIỆU PHÍA DƯỚI THANH TIẾN ĐỘ:
   - Ô trên bên trái: "THỰC HIỆN" (Giá trị thực tế, ví dụ: 31.47, 12, 22.29, 20.00, 0.90, 35.00, 22.71, 1). Nếu badge là DT thì số này là Triệu đồng (giữ nguyên số thập phân, không tự ý nhân triệu).
   - Ô trên bên phải: "TARGET NGÀY" (Chỉ tiêu ngày, ví dụ: 57.29, 16, 19.47, 7.12, 0.32, 11.87, 4.28, 0).
   - Ô dưới bên trái: "% HT NGÀY" (Tỷ lệ hoàn thành ngày, ví dụ: 54.9%, 74.4%, 114.5%, 280.9%, 283%, 294.9%, 530.3%, 3,003%).
   - Ô dưới bên phải: "DT DỰ KIẾN" hoặc "SL DỰ KIẾN" (Nếu là dấu gạch "—" thì để null hoặc 0).

QUY TẮC BẮT BUỘC:
- BỎ QUA HOÀN TOÀN hình mờ watermark (ví dụ chữ mờ tên nhân viên/mã NV).
- Trích xuất ĐẦY ĐỦ TẤT CẢ các thẻ có trong ảnh theo thứ tự từ trên xuống dưới, từ trái qua phải.
- Với tỷ lệ ghi dạng "3,003%" thì chuyển thành số 3003 (loại bỏ dấu phẩy phân cách hàng nghìn).
- Với số thập phân (31.47, 22.29, 0.90), giữ nguyên phần thập phân.
- Nếu ở thanh tiêu đề ảnh có tên ST hoặc ngày giờ thì trích xuất vào storeName, reportDate, reportTime. Nếu không có thì để null.

Định dạng JSON trả về:
{
  "storeName": null,
  "reportDate": null,
  "reportTime": null,
  "cards": [
    {
      "programName": "T11 - Trả chậm Homecredit",
      "unit": "DT",
      "actual": 31.47,
      "target": 57.29,
      "completionRate": 54.9,
      "forecastRate": 0
    },
    {
      "programName": "T11 - VAS",
      "unit": "SL",
      "actual": 12,
      "target": 16,
      "completionRate": 74.4,
      "forecastRate": 0
    }
  ]
}`;

    const parsed = await callGeminiVision(apiKey, base64, file.type, prompt, keySource);
    const rawCards = Array.isArray(parsed?.cards) ? parsed.cards : [];

    const cleanedCards: StoreMobileEmulationCardItem[] = rawCards
        .filter((c: any) => c && (c.programName || c.name))
        .map((c: any) => {
            const progName = String(c.programName || c.name || '').trim();
            const unit = String(c.unit || 'DT').toUpperCase().includes('SL') ? 'SL' : 'DT';
            const act = cleanBiNumber(c.actual);
            const tg = cleanBiNumber(c.target);

            let pct = cleanBiNumber(c.completionRate);
            if (!pct && tg > 0) {
                pct = Number(((act / tg) * 100).toFixed(1));
            }

            const forecast = cleanBiNumber(c.forecastRate);

            return {
                programName: progName,
                unit,
                actual: act,
                target: tg,
                completionRate: pct,
                forecastRate: forecast > 0 ? forecast : undefined
            };
        });

    return {
        storeName: parsed?.storeName || undefined,
        reportDate: parsed?.reportDate || undefined,
        reportTime: parsed?.reportTime || undefined,
        cards: cleanedCards
    };
}

/**
 * 3c. TRÍCH XUẤT HÀNG LOẠT THẺ MOBILE (HỖ TRỢ NHIỀU ẢNH CUỘN MÀN HÌNH)
 */
export async function extractStoreMobileEmulationCardsBatch(
    apiKey: string,
    files: File[],
    onProgress?: (msg: string, percent: number) => void,
    keySource: GeminiKeySource = 'ADMIN'
): Promise<{
    storeName?: string;
    reportDate?: string;
    reportTime?: string;
    cards: StoreMobileEmulationCardItem[];
    errors?: string[];
}> {
    if (!files || files.length === 0) {
        return { cards: [] };
    }

    const cardMap = new Map<string, StoreMobileEmulationCardItem>();
    const errors: string[] = [];
    let detectedStore = '';
    let detectedDate = '';
    let detectedTime = '';

    const total = files.length;
    for (let i = 0; i < total; i++) {
        const file = files[i];
        const pct = Math.round(((i + 1) / total) * 100);
        onProgress?.(`Đang bóc tách thẻ mobile (${i + 1}/${total}): ${file.name || 'Ảnh dán'}...`, pct);

        try {
            const res = await extractStoreMobileEmulationCards(apiKey, file, keySource);
            if (res.storeName && !detectedStore) detectedStore = res.storeName;
            if (res.reportDate && !detectedDate) detectedDate = res.reportDate;
            if (res.reportTime && !detectedTime) detectedTime = res.reportTime;

            (res.cards || []).forEach(card => {
                const key = card.programName.toLowerCase().trim();
                // Nếu trùng chương trình, ưu tiên ghi đè bằng thẻ có số liệu khác 0
                if (!cardMap.has(key) || (card.actual > 0 || card.target > 0)) {
                    cardMap.set(key, card);
                }
            });
        } catch (err: any) {
            if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
            errors.push(`Lỗi đọc ảnh ${file.name || `thẻ #${i + 1}`}: ${err?.message || 'Không rõ lỗi'}`);
        }
    }

    return {
        storeName: detectedStore || undefined,
        reportDate: detectedDate || undefined,
        reportTime: detectedTime || undefined,
        cards: Array.from(cardMap.values()),
        errors: errors.length > 0 ? errors : undefined
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
        const codeMatch = rawName.match(/^(\d{3,6})/);
        const storeCode = code || (codeMatch ? codeMatch[1] : undefined);

        // Khớp ST thông minh: ưu tiên mã số ST (10335, 111...), sau đó đến tên rút gọn
        const existingKey = Object.keys(storeMap).find(k => {
            if (storeCode && storeMap[k].storeCode && storeMap[k].storeCode === storeCode) return true;
            return k === short;
        });

        if (existingKey) {
            if (storeCode && !storeMap[existingKey].storeCode) {
                storeMap[existingKey].storeCode = storeCode;
            }
            return storeMap[existingKey];
        }

        const newStore: StoreReportingData = {
            storeCode,
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
        storeMap[short] = newStore;
        return newStore;
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
                if (st.revenueQd !== undefined) store.revenueQd = cleanBiNumber(st.revenueQd);
                if (st.targetQd !== undefined) store.targetQd = cleanBiNumber(st.targetQd);
                if (st.quantityQd !== undefined) store.quantityQd = cleanBiNumber(st.quantityQd);

                // Nếu ảnh DT-QĐ cũng có cả cột Doanh thu thực
                if (st.revenueReal !== undefined && cleanBiNumber(st.revenueReal) > 0) {
                    store.revenueReal = cleanBiNumber(st.revenueReal);
                }
                if (st.targetReal !== undefined && cleanBiNumber(st.targetReal) > 0) {
                    store.targetReal = cleanBiNumber(st.targetReal);
                }
                if (st.installmentReal !== undefined && cleanBiNumber(st.installmentReal) > 0) {
                    store.installmentReal = cleanBiNumber(st.installmentReal);
                }
                if (st.avg3MonthsReal !== undefined && cleanBiNumber(st.avg3MonthsReal) > 0) {
                    store.avg3MonthsReal = cleanBiNumber(st.avg3MonthsReal);
                }
                if (store.revenueReal > 0 && store.installmentReal > 0) {
                    store.installmentRateReal = Number(((store.installmentReal / store.revenueReal) * 100).toFixed(2));
                }
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
                if (st.revenueReal !== undefined) store.revenueReal = cleanBiNumber(st.revenueReal);
                if (st.targetReal !== undefined) store.targetReal = cleanBiNumber(st.targetReal);
                if (st.quantityReal !== undefined) store.quantityReal = cleanBiNumber(st.quantityReal);
                if (st.installmentReal !== undefined) store.installmentReal = cleanBiNumber(st.installmentReal);
                if (st.avg3MonthsReal !== undefined) store.avg3MonthsReal = cleanBiNumber(st.avg3MonthsReal);

                // Nếu ảnh DT Thực có cột DT-QĐ mà trước đó chưa có
                if (st.revenueQd !== undefined && cleanBiNumber(st.revenueQd) > 0 && store.revenueQd === 0) {
                    store.revenueQd = cleanBiNumber(st.revenueQd);
                }
                if (st.targetQd !== undefined && cleanBiNumber(st.targetQd) > 0 && store.targetQd === 0) {
                    store.targetQd = cleanBiNumber(st.targetQd);
                }

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
