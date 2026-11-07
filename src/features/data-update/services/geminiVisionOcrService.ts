import type {
    StoreReportingData,
    EmulationOcrItem,
    StoreMobileEmulationCardItem,
    OcrExtractionResult,
    EmulationUploadMode,
    SingleStoreEmulationEntry
} from '../types/ocrTypes';
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
    getAvailableApiKeys,
    maskApiKey,
    testGeminiApiKey,
    SYSTEM_SETTINGS_SQL,
    STANDARD_GEMINI_MODELS,
    sanitizeCachedGeminiModel
} from './geminiApiKeyService';
import { prepareImageForOcr, fileToBase64 } from './imageCompressionService';

// Tái xuất các hàm quản lý Key & nén ảnh để tương thích ngược
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
    SYSTEM_SETTINGS_SQL,
    fileToBase64,
    prepareImageForOcr
};

// Hàm cũ tương thích
export function getSavedGeminiApiKey(): string {
    return resolveActiveGeminiKey().key;
}

export function saveGeminiApiKey(key: string): void {
    saveUserGeminiKey(key);
}

/**
 * Gọi Gemini Vision API trích xuất JSON (Hỗ trợ tự động chuyển Key dự phòng khi gặp lỗi 429 và timeout 35s)
 */
async function callGeminiVision(
    apiKey: string,
    base64Image: string,
    mimeType: string,
    prompt: string,
    keySource: GeminiKeySource = 'ADMIN',
    timeoutMs: number = 35000
): Promise<any> {
    const candidateKeys = getAvailableApiKeys(apiKey);
    if (candidateKeys.length === 0) {
        throw new Error('Chưa cấu hình API Key Gemini nào.');
    }

    const cachedModel = sanitizeCachedGeminiModel();
    const models = Array.from(
        new Set([
            ...(cachedModel ? [cachedModel] : []),
            ...STANDARD_GEMINI_MODELS
        ])
    );
    let lastError: any = null;

    for (let kIdx = 0; kIdx < candidateKeys.length; kIdx++) {
        const currentKey = candidateKeys[kIdx];
        let keyQuotaExceeded = false;

        for (const model of models) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
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

                clearTimeout(timeoutId);

                if (res.status === 429) {
                    keyQuotaExceeded = true;
                    lastError = new GeminiQuotaExceededError(
                        `Key [${maskApiKey(currentKey)}] đạt giới hạn 429 (Resource Exhausted).`,
                        keySource
                    );
                    break;
                }

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    const errMsg = errData?.error?.message || `Lỗi HTTP ${res.status} từ Gemini API (${model})`;
                    const isQuota =
                        errData?.error?.status === 'RESOURCE_EXHAUSTED' ||
                        errMsg.toLowerCase().includes('quota') ||
                        errMsg.toLowerCase().includes('rate limit');

                    if (isQuota) {
                        keyQuotaExceeded = true;
                        lastError = new GeminiQuotaExceededError(errMsg, keySource);
                        break;
                    }

                    throw new Error(errMsg);
                }

                const json = await res.json();
                const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!rawText) throw new Error('Không nhận được nội dung từ Gemini');

                localStorage.setItem('SALESHUB_ACTIVE_GEMINI_MODEL', model);
                return JSON.parse(rawText);
            } catch (err: any) {
                if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) {
                    keyQuotaExceeded = true;
                    lastError = err;
                    break;
                }
                const isTimeout = err?.name === 'AbortError' || err?.message?.includes('aborted');
                console.warn(`Lỗi gọi model ${model} với key ${maskApiKey(currentKey)}:`, isTimeout ? `Timeout ${timeoutMs / 1000}s` : err?.message);
                lastError = isTimeout ? new Error(`Mô hình ${model} phản hồi quá lâu (${timeoutMs / 1000}s)`) : err;
            }
        }

        if (keyQuotaExceeded) {
            if (kIdx + 1 < candidateKeys.length) {
                console.warn(`⚠️ Key [${maskApiKey(currentKey)}] hết hạn ngạch. Tự động chuyển sang Key dự phòng #${kIdx + 2} [${maskApiKey(candidateKeys[kIdx + 1])}]...`);
                continue;
            } else {
                throw new GeminiQuotaExceededError(
                    `Toàn bộ ${candidateKeys.length} API Key dự phòng đều đã đạt giới hạn hạn ngạch (429 Resource Exhausted).`,
                    keySource
                );
            }
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
    const prepared = await prepareImageForOcr(file);
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

    const parsed = await callGeminiVision(apiKey, prepared.data, prepared.mimeType, prompt, keySource);
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
    const prepared = await prepareImageForOcr(file);
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

    const parsed = await callGeminiVision(apiKey, prepared.data, prepared.mimeType, prompt, keySource);
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
    const prepared = await prepareImageForOcr(file);
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

    const parsed = await callGeminiVision(apiKey, prepared.data, prepared.mimeType, prompt, keySource);
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
    const prepared = await prepareImageForOcr(file);
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

    const parsed = await callGeminiVision(apiKey, prepared.data, prepared.mimeType, prompt, keySource);
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
    onProgress?.(`Đang bóc tách đồng thời ${total} ảnh thẻ thi đua qua Canvas & AI...`, 20);

    const results = await Promise.all(
        files.map(async (file, i) => {
            try {
                return await extractStoreMobileEmulationCards(apiKey, file, keySource);
            } catch (err: any) {
                if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
                errors.push(`Lỗi đọc ảnh ${file.name || `thẻ #${i + 1}`}: ${err?.message || 'Không rõ lỗi'}`);
                return null;
            }
        })
    );

    results.forEach(res => {
        if (!res) return;
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
    });

    onProgress?.('Bóc tách thẻ thi đua hoàn tất!', 100);

    return {
        storeName: detectedStore || undefined,
        reportDate: detectedDate || undefined,
        reportTime: detectedTime || undefined,
        cards: Array.from(cardMap.values()),
        errors: errors.length > 0 ? errors : undefined
    };
}

/**
 * 3d. TRÍCH XUẤT ẢNH THI ĐUA ĐÍCH DANH CHO 1 ST CỤ THỂ
 * Hỗ trợ cả 2 định dạng:
 * 1) Thẻ Mobile 2 cột (Mobile Cards Grid) chụp từ điện thoại của ST.
 * 2) Bảng thi đua Dark Mode BI (tìm dòng của ST này hoặc bảng của ST này).
 */
export async function extractSingleStoreEmulationImage(
    apiKey: string,
    file: File,
    targetStoreName: string,
    keySource: GeminiKeySource = 'ADMIN'
): Promise<{
    programs: Array<{
        programName: string;
        unit: string;
        actual: number;
        target: number;
        completionRate?: number;
    }>;
}> {
    const prepared = await prepareImageForOcr(file);
    const prompt = `Bạn là chuyên gia phân tích dữ liệu kinh doanh bán lẻ từ ảnh chụp màn hình ứng dụng (Mobile App hoặc BI Dashboard).
Nhiệm vụ: Trích xuất ĐẦY ĐỦ các chương trình thi đua và số liệu kinh doanh dành riêng cho ST: "${targetStoreName}".

Ảnh có thể thuộc 1 trong 2 định dạng sau:
ĐỊNH DẠNG 1: THẺ THI ĐUA MOBILE 2 CỘT (Lưới thẻ chữ nhật trên điện thoại):
- Tiêu đề thẻ ở góc trên: Tên chương trình thi đua (ví dụ: "T11 - Trả chậm Homecredit", "T11 - VAS", "T11 - Cáp sạc", "T11 - Bảo hiểm Tổng", "T11 - Phụ kiện", "T11 - Ví trả sau"...).
- Badge góc trên bên phải: Chữ "DT" (DOANH THU) hoặc "SL" (SỐ LƯỢNG).
- 4 ô số liệu:
  + "THỰC HIỆN" (actual)
  + "TARGET NGÀY" hoặc "TARGET" (target)
  + "% HT NGÀY" hoặc "% HT" (completionRate)
  + "DT DỰ KIẾN" / "SL DỰ KIẾN" (forecast)

ĐỊNH DẠNG 2: BẢNG THI ĐUA DARK MODE:
- Tiêu đề bảng ở góc trên (ví dụ: "T10 - IPHONE 18 series...", "T10 - NẠP - RÚT TIỀN...", "T10 - Bảo Hiểm Tổng"...).
- Cột 2: Tiêu đề là "DOANH THU" hoặc "SỐ LƯỢNG".
- Cột 3: "TARGET".
- Cột 4: "% HT THÁNG".
- Tìm dòng của ST "${targetStoreName}" (hoặc dòng dữ liệu nếu bảng chỉ có 1 ST) và lấy số liệu. Bỏ qua dòng TỔNG.

LƯU Ý NGHIỆP VỤ BẮT BUỘC:
1. BỎ QUA HOÀN TOÀN hình mờ watermark ("26479 - Đào Bá Linh",...).
2. Nếu đơn vị là "DT" hoặc "DOANH THU": số liệu tính bằng Triệu đồng (ví dụ 31.47 hoặc 15964), giữ nguyên số, TUYỆT ĐỐI không tự ý nhân một triệu.
3. Nếu đơn vị là "SL" hoặc "SỐ LƯỢNG": lấy số nguyên tương ứng.
4. Trích xuất TẤT CẢ các thẻ/chương trình có trong ảnh.

Định dạng JSON trả về duy nhất:
{
  "programs": [
    {
      "programName": "T11 - Trả chậm Homecredit",
      "unit": "DOANH THU",
      "actual": 31.47,
      "target": 57.29,
      "completionRate": 54.9
    }
  ]
}`;

    const parsed = await callGeminiVision(apiKey, prepared.data, prepared.mimeType, prompt, keySource);
    const rawProgs = Array.isArray(parsed?.programs) ? parsed.programs : [];

    const cleaned = rawProgs
        .filter((p: any) => p && (p.programName || p.name))
        .map((p: any) => {
            const pName = String(p.programName || p.name || '').trim();
            const u = String(p.unit || 'DOANH THU').toUpperCase().includes('SL') ? 'SỐ LƯỢNG' : 'DOANH THU';
            const act = cleanBiNumber(p.actual);
            const tg = cleanBiNumber(p.target);
            let pct = cleanBiNumber(p.completionRate);
            if (!pct && tg > 0) {
                pct = Number(((act / tg) * 100).toFixed(1));
            }
            return {
                programName: pName,
                unit: u,
                actual: act,
                target: tg,
                completionRate: pct
            };
        });

    return { programs: cleaned };
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
        emulationMode?: EmulationUploadMode;
        singleStoreEmulations?: SingleStoreEmulationEntry[];
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

    // Bước 1 & 2: Phân tích đồng thời cả ảnh Doanh thu quy đổi (DT-QĐ) và Doanh thu thực (DT-THỰC)
    onProgress?.('Đang nén ảnh và phân tích doanh thu qua Canvas & AI...', 25);

    const [qdRes, realRes] = await Promise.all([
        files.qdFile ? extractRevenueQdImage(apiKey, files.qdFile, keySource).catch(err => {
            if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
            errors.push(`Lỗi đọc ảnh DT-QĐ: ${err?.message}`);
            return null;
        }) : Promise.resolve(null),
        files.realFile ? extractRevenueRealImage(apiKey, files.realFile, keySource).catch(err => {
            if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
            errors.push(`Lỗi đọc ảnh DT Thực: ${err?.message}`);
            return null;
        }) : Promise.resolve(null)
    ]);

    if (qdRes) {
        if (qdRes.reportDate) detectedReportDate = qdRes.reportDate;
        if (qdRes.reportTime) detectedReportTime = qdRes.reportTime;

        qdRes.stores.forEach(st => {
            if (!st.storeRawName) return;
            const store = getOrCreateStore(st.storeRawName);
            if (st.revenueQd !== undefined) store.revenueQd = cleanBiNumber(st.revenueQd);
            if (st.targetQd !== undefined) store.targetQd = cleanBiNumber(st.targetQd);
            if (st.quantityQd !== undefined) store.quantityQd = cleanBiNumber(st.quantityQd);

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
    }

    if (realRes) {
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
    }

    // Bước 3: Trích xuất ảnh Thi đua lũy kế (Hỗ trợ switch: CẢ CỤM hoặc ĐÍCH DANH TỪNG ST)
    const isSingleStoreMode = files.emulationMode === 'SINGLE_STORE';

    if (isSingleStoreMode && files.singleStoreEmulations && files.singleStoreEmulations.length > 0) {
        // Chế độ: Nạp đích danh theo từng ST có thể nạp
        const validEntries = files.singleStoreEmulations.filter(e => e.storeName && e.files && e.files.length > 0);
        const totalFiles = validEntries.reduce((sum, e) => sum + e.files.length, 0);

        if (totalFiles > 0) {
            onProgress?.(`Đang bóc tách ${totalFiles} ảnh thi đua đích danh cho ${validEntries.length} ST...`, 60);

            for (const entry of validEntries) {
                const store = getOrCreateStore(entry.storeName);
                const fileResults = await Promise.all(
                    entry.files.map(async (file, idx) => {
                        try {
                            return await extractSingleStoreEmulationImage(apiKey, file, entry.storeName, keySource);
                        } catch (err: any) {
                            if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
                            errors.push(`Lỗi đọc ảnh thi đua ${file.name || `#${idx + 1}`} (ST: ${entry.storeName}): ${err?.message}`);
                            return null;
                        }
                    })
                );

                fileResults.forEach(res => {
                    if (!res) return;
                    (res.programs || []).forEach(p => {
                        const pName = p.programName.trim();
                        const pUnit = p.unit || 'DOANH THU';
                        const act = cleanBiNumber(p.actual);
                        const tg = cleanBiNumber(p.target);
                        const pct = p.completionRate !== undefined ? cleanBiNumber(p.completionRate) : (tg > 0 ? Number(((act / tg) * 100).toFixed(1)) : 0);

                        store.emulations[pName] = {
                            programName: pName,
                            unit: pUnit,
                            actual: act,
                            target: tg,
                            completionRate: pct
                        };
                    });
                });
            }
        }
    } else if (files.emulationFiles && files.emulationFiles.length > 0) {
        // Chế độ mặc định: Nạp cả cụm (nhiều ST đồng thời trong bảng Dark Mode)
        const totalEmu = files.emulationFiles.length;
        onProgress?.(`Đang bóc tách đồng thời ${totalEmu} bảng thi đua cụm qua Canvas & AI...`, 60);

        const emuResults = await Promise.all(
            files.emulationFiles.map(async (emuFile, i) => {
                try {
                    return await extractSingleEmulationImage(apiKey, emuFile, keySource);
                } catch (err: any) {
                    if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
                    errors.push(`Lỗi đọc ảnh thi đua ${emuFile.name}: ${err?.message}`);
                    return null;
                }
            })
        );

        emuResults.forEach(emuRes => {
            if (!emuRes) return;
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
        });
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
