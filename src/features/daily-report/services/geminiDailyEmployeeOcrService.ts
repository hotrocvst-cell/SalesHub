import type { EmployeeItem } from '../../../core/lib/storage';
import { getShortenedEmployeeName, cleanEmployeeName, cleanBiNumber } from '../../../core/lib/formatters';
import type { ParsedEmployeeRevenue } from '../../employee-cumulative/utils/employeeParsers';
import {
    GeminiQuotaExceededError,
    type GeminiKeySource,
    getAvailableApiKeys,
    maskApiKey,
    STANDARD_GEMINI_MODELS,
    sanitizeCachedGeminiModel
} from '../../data-update/services/geminiApiKeyService';
import { prepareImageForOcr, type PreparedImage } from '../../data-update/services/imageCompressionService';

interface RawOcrRow {
    employeeId: string;
    rawName: string;
    quantity?: number;
    revenueQd?: number;
    loanQd?: number;
    revenueActual?: number;
    straightRevenue?: number;
    installmentRevenue?: number;
}

/**
 * Gọi Gemini Vision API hỗ trợ truyền 1 hoặc nhiều ảnh cùng lúc trong 1 request
 * (Hỗ trợ timeout 35s, chuẩn hóa model Google và tự động chuyển Key dự phòng khi gặp HTTP 429)
 */
async function callGeminiVisionImages(
    apiKey: string,
    images: PreparedImage[],
    prompt: string,
    keySource: GeminiKeySource = 'ADMIN',
    timeoutMs: number = 35000
): Promise<any> {
    if (!images || images.length === 0) {
        throw new Error('Chưa cung cấp hình ảnh nào để xử lý.');
    }

    const candidateKeys = getAvailableApiKeys(apiKey);
    if (candidateKeys.length === 0) {
        throw new Error('Chưa cấu hình API Key nào.');
    }

    const cachedModel = sanitizeCachedGeminiModel();
    const models = Array.from(
        new Set([
            ...(cachedModel ? [cachedModel] : []),
            ...STANDARD_GEMINI_MODELS
        ])
    );

    const parts: any[] = [{ text: prompt }];
    for (const img of images) {
        parts.push({
            inline_data: {
                mime_type: img.mimeType || 'image/jpeg',
                data: img.data
            }
        });
    }

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
                        contents: [{ parts }],
                        generationConfig: {
                            temperature: 0.1,
                            response_mime_type: 'application/json'
                        }
                    })
                });

                clearTimeout(timeoutId);

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    const errMsg = errData?.error?.message || `HTTP ${res.status}`;
                    if (res.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit')) {
                        keyQuotaExceeded = true;
                        lastError = new GeminiQuotaExceededError(`Key [${maskApiKey(currentKey)}] đạt giới hạn 429: ${errMsg}`, keySource);
                        break;
                    }
                    lastError = new Error(`Model ${model} error: ${errMsg}`);
                    continue;
                }

                const json = await res.json();
                const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) {
                    lastError = new Error(`Empty response from ${model}`);
                    continue;
                }

                localStorage.setItem('SALESHUB_ACTIVE_GEMINI_MODEL', model);
                const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
                return JSON.parse(cleanText);
            } catch (err: any) {
                if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) {
                    keyQuotaExceeded = true;
                    lastError = err;
                    break;
                }
                const isTimeout = err?.name === 'AbortError' || err?.message?.includes('aborted');
                console.warn(`Lỗi model ${model}:`, isTimeout ? `Timeout ${timeoutMs / 1000}s` : err?.message);
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

    throw lastError || new Error('Không thể kết nối đến mô hình Gemini Vision.');
}

/**
 * Prompt bóc tách DOANH THU QUY ĐỔI & SỐ LƯỢNG (Hỗ trợ 1 hoặc nhiều ảnh cuộn màn hình)
 */
function buildEmployeeQdPrompt(): string {
    return `Bạn là chuyên gia phân tích dữ liệu bảng kinh doanh nhân viên bán lẻ từ ảnh chụp màn hình ứng dụng BI Mobile ("Doanh thu hợp nhất").
Hình ảnh gửi kèm gồm 1 hoặc nhiều ảnh chụp (có thể là ảnh cuộn màn hình nối tiếp).
Nhiệm vụ: Trích xuất chính xác danh sách nhân viên cùng số liệu DOANH THU QUY ĐỔI (DTQĐ) và SỐ LƯỢNG từ TẤT CẢ các ảnh.

LƯU Ý NGHIỆP VỤ CỰC KỲ QUAN TRỌNG:
1. BỎ QUA HOÀN TOÀN hình mờ watermark (ví dụ chữ mờ "26479 - Đào Bá Linh").
2. ĐỌC NGÀY GIỜ: Ở góc trên bên phải có dòng chữ "Cập nhật lúc: HH:mm:ss DD/MM/YYYY" (ví dụ: "20:56:17 1/11/2026" -> reportTime: "20:56:17", reportDate: "2026-11-01"). Nếu ảnh bị cuộn không thấy thì để null.
3. CẤU TRÚC BẢNG:
   - Cột 1: NHÂN VIÊN / NGÀNH HÀNG: Mỗi dòng có dạng "+ [Mã NV] - [Tên NV]" (Ví dụ: "+ 260732 - Nguyễn", "+ 245449 - Vương", "+ 4614 - Lê Quang", "+ 26479 - Đào Bá L"). Bóc tách riêng mã số nhân viên (chỉ lấy các chữ số, ví dụ "260732") và tên rawName.
   - Cột 2: SỐ LƯỢNG (SL): Giá trị số lượng (ví dụ: 29, 16, 25, 7, 3, 1, -1). Nếu là số âm giữ nguyên dấu âm.
   - Cột 3: DOANH THU QĐ: Giá trị DTQĐ tính bằng triệu đồng (ví dụ: 156, 143, 135, 128, 119, 89, 85, 0, -9). Giữ nguyên số âm nếu có.
   - Cột 4: DT QĐ KHOẢN VAY (nếu có, ví dụ: 0, 3, 6).
4. ĐẶC BIỆT LƯU Ý - ẢNH CUỘN MẤT TIÊU ĐỀ:
   - Nếu danh sách dài, từ ảnh thứ 2 trở đi thanh tiêu đề bảng có thể BỊ MẤT.
   - Khi đó, HÃY NHẬN DIỆN MỖI DÒNG bắt đầu bằng dấu cộng "+" và mã số nhân viên, các cột số bên phải theo đúng thứ tự: Cột số đầu tiên là SỐ LƯỢNG, Cột số thứ hai là DOANH THU QĐ, Cột số thứ ba là DT QĐ KHOẢN VAY.
5. Trích xuất ĐẦY ĐỦ TẤT CẢ các dòng nhân viên có trong tất cả các ảnh, không bỏ sót ai.

Định dạng JSON trả về duy nhất:
{
  "reportDate": "YYYY-MM-DD hoặc null",
  "reportTime": "HH:mm:ss hoặc null",
  "rows": [
    {
      "employeeId": "260732",
      "rawName": "Nguyễn",
      "quantity": 29,
      "revenueQd": 156,
      "loanQd": 0
    }
  ]
}`;
}

/**
 * Prompt bóc tách DOANH THU THỰC & TRẢ GÓP (Hỗ trợ 1 hoặc nhiều ảnh cuộn màn hình)
 */
function buildEmployeeRealPrompt(): string {
    return `Bạn là chuyên gia phân tích dữ liệu bảng kinh doanh nhân viên bán lẻ từ ảnh chụp màn hình ứng dụng BI Mobile ("Doanh thu hợp nhất").
Hình ảnh gửi kèm gồm 1 hoặc nhiều ảnh chụp (có thể là ảnh cuộn màn hình nối tiếp).
Nhiệm vụ: Trích xuất chính xác danh sách nhân viên cùng số liệu DOANH THU THỰC TẾ và DOANH THU TRẢ GÓP từ TẤT CẢ các ảnh.

LƯU Ý NGHIỆP VỤ CỰC KỲ QUAN TRỌNG:
1. BỎ QUA HOÀN TOÀN hình mờ watermark (ví dụ chữ mờ "26479 - Đào Bá Linh").
2. ĐỌC NGÀY GIỜ: Ở góc trên bên phải có dòng chữ "Cập nhật lúc: HH:mm:ss DD/MM/YYYY" (ví dụ: "20:55:53 1/11/2026" -> reportTime: "20:55:53", reportDate: "2026-11-01"). Nếu ảnh bị cuộn không thấy thì để null.
3. CẤU TRÚC BẢNG:
   - Cột 1: NHÂN VIÊN / NGÀNH HÀNG: Mỗi dòng có dạng "+ [Mã NV] - [Tên NV]" (Ví dụ: "+ 27560 - Bùi Minh", "+ 22838 - Trần Thị !", "+ 260732 - Nguyễn", "+ 4614 - Lê Quang", "+ 26479 - Đào Bá L"). Bóc tách riêng mã số nhân viên (chỉ lấy các chữ số) và tên rawName.
   - Cột 2: DOANH THU: Đây là DOANH THU THỰC TẾ tính bằng triệu đồng (ví dụ: 169, 118, 112, 106, 104, 97, 76, 50, 45, 0, -3). Giữ nguyên số âm nếu có.
   - Cột 3: DT TRẢ THẲNG: Doanh thu trả thẳng (ví dụ: 59, 118, 73, 40, 65, 0).
   - Cột 4: DT TRẢ GÓP: Doanh thu trả góp tính bằng triệu đồng (ví dụ: 166, 0, 39, 66, 39, 48, 15, 0).
4. ĐẶC BIỆT LƯU Ý - ẢNH CUỘN MẤT TIÊU ĐỀ:
   - Nếu danh sách dài, từ ảnh thứ 2 trở đi thanh tiêu đề bảng có thể BỊ MẤT.
   - Khi đó, HÃY NHẬN DIỆN MỖI DÒNG bắt đầu bằng dấu cộng "+" và mã số nhân viên, các cột số bên phải theo đúng thứ tự: Cột số đầu tiên là DOANH THU (thực tế), Cột số thứ hai là DT TRẢ THẲNG, Cột số thứ ba là DT TRẢ GÓP.
5. Trích xuất ĐẦY ĐỦ TẤT CẢ các dòng nhân viên có trong tất cả các ảnh, không bỏ sót ai.

Định dạng JSON trả về duy nhất:
{
  "reportDate": "YYYY-MM-DD hoặc null",
  "reportTime": "HH:mm:ss hoặc null",
  "rows": [
    {
      "employeeId": "27560",
      "rawName": "Bùi Minh",
      "revenueActual": 169,
      "straightRevenue": 59,
      "installmentRevenue": 166
    }
  ]
}`;
}

/**
 * 1. Bóc tách 1 ảnh DOANH THU QUY ĐỔI & SỐ LƯỢNG
 */
export async function extractEmployeeQdImage(
    apiKey: string,
    file: File
): Promise<{
    reportDate?: string;
    reportTime?: string;
    rows: RawOcrRow[];
}> {
    const prepared = await prepareImageForOcr(file);
    const parsed = await callGeminiVisionImages(apiKey, [prepared], buildEmployeeQdPrompt());
    const rawRows = Array.isArray(parsed?.rows) ? parsed.rows : [];

    const rows: RawOcrRow[] = rawRows
        .filter((r: any) => r && (r.employeeId || r.id))
        .map((r: any) => {
            const rawId = String(r.employeeId || r.id || '').replace(/\D/g, '').trim();
            return {
                employeeId: rawId,
                rawName: String(r.rawName || r.name || '').replace(/^\+\s*/, '').replace(/^\d+\s*-\s*/, '').trim(),
                quantity: cleanBiNumber(r.quantity),
                revenueQd: cleanBiNumber(r.revenueQd),
                loanQd: cleanBiNumber(r.loanQd)
            };
        })
        .filter(r => r.employeeId.length >= 3);

    return {
        reportDate: parsed?.reportDate || undefined,
        reportTime: parsed?.reportTime || undefined,
        rows
    };
}

/**
 * 2. Bóc tách 1 ảnh DOANH THU THỰC & TRẢ GÓP
 */
export async function extractEmployeeRealImage(
    apiKey: string,
    file: File
): Promise<{
    reportDate?: string;
    reportTime?: string;
    rows: RawOcrRow[];
}> {
    const prepared = await prepareImageForOcr(file);
    const parsed = await callGeminiVisionImages(apiKey, [prepared], buildEmployeeRealPrompt());
    const rawRows = Array.isArray(parsed?.rows) ? parsed.rows : [];

    const rows: RawOcrRow[] = rawRows
        .filter((r: any) => r && (r.employeeId || r.id))
        .map((r: any) => {
            const rawId = String(r.employeeId || r.id || '').replace(/\D/g, '').trim();
            return {
                employeeId: rawId,
                rawName: String(r.rawName || r.name || '').replace(/^\+\s*/, '').replace(/^\d+\s*-\s*/, '').trim(),
                revenueActual: cleanBiNumber(r.revenueActual),
                straightRevenue: cleanBiNumber(r.straightRevenue),
                installmentRevenue: cleanBiNumber(r.installmentRevenue)
            };
        })
        .filter(r => r.employeeId.length >= 3);

    return {
        reportDate: parsed?.reportDate || undefined,
        reportTime: parsed?.reportTime || undefined,
        rows
    };
}

/**
 * 3. HỢP NHẤT HÀNG LOẠT ĐA ẢNH SIÊU TỐC & ĐỐI CHIẾU DANH BẠ NHÂN SỰ
 * - Tự động nén tất cả ảnh qua Canvas (giảm 90% dung lượng)
 * - Gộp toàn bộ qdFiles vào 1 request duy nhất và realFiles vào 1 request duy nhất
 * - Chạy song song cả 2 request (Promise.all) -> Giảm thời gian từ 45s xuống còn ~3s
 * - Tự động đối chiếu employee_id vào danh bạ employees để khôi phục họ tên chuẩn mực
 */
export async function extractDailyEmployeeRevenueImagesBatch(
    apiKey: string,
    options: {
        qdFiles: File[];
        realFiles: File[];
    },
    employeesDirectory: EmployeeItem[] = [],
    onProgress?: (msg: string, percent: number) => void
): Promise<{
    success: boolean;
    reportDate?: string;
    reportTime?: string;
    records: ParsedEmployeeRevenue[];
    errors?: string[];
}> {
    const { qdFiles = [], realFiles = [] } = options;
    const totalFiles = qdFiles.length + realFiles.length;

    if (totalFiles === 0) {
        return { success: false, records: [], errors: ['Chưa chọn ảnh nào để trích xuất!'] };
    }

    onProgress?.('Đang nén và tối ưu hóa hình ảnh qua Canvas...', 10);

    const [preparedQd, preparedReal] = await Promise.all([
        Promise.all(qdFiles.map(f => prepareImageForOcr(f))),
        Promise.all(realFiles.map(f => prepareImageForOcr(f)))
    ]);

    const empMap = new Map<string, {
        employeeId: string;
        rawName: string;
        quantity?: number;
        revenueQd?: number;
        loanQd?: number;
        revenueActual?: number;
        straightRevenue?: number;
        installmentRevenue?: number;
    }>();

    let detectedDate = '';
    let detectedTime = '';
    const errors: string[] = [];

    onProgress?.(`Đang bóc tách đồng thời ${totalFiles} ảnh bằng Gemini AI siêu tốc...`, 40);

    // Chạy song song nhóm DTQĐ và nhóm DT Thực
    const tasks: Promise<void>[] = [];

    if (preparedQd.length > 0) {
        tasks.push(
            (async () => {
                try {
                    const parsed = await callGeminiVisionImages(apiKey, preparedQd, buildEmployeeQdPrompt());
                    if (parsed?.reportDate && !detectedDate) detectedDate = parsed.reportDate;
                    if (parsed?.reportTime && !detectedTime) detectedTime = parsed.reportTime;

                    const rawRows: any[] = Array.isArray(parsed?.rows) ? parsed.rows : [];
                    rawRows.forEach((r: any) => {
                        const rawId = String(r.employeeId || r.id || '').replace(/\D/g, '').trim();
                        if (rawId.length < 3) return;
                        const existing = empMap.get(rawId) || { employeeId: rawId, rawName: '' };
                        if (r.quantity !== undefined && r.quantity !== null) existing.quantity = cleanBiNumber(r.quantity);
                        if (r.revenueQd !== undefined && r.revenueQd !== null) existing.revenueQd = cleanBiNumber(r.revenueQd);
                        if (r.loanQd !== undefined && r.loanQd !== null) existing.loanQd = cleanBiNumber(r.loanQd);
                        const cleanName = String(r.rawName || r.name || '').replace(/^\+\s*/, '').replace(/^\d+\s*-\s*/, '').trim();
                        if (!existing.rawName && cleanName) existing.rawName = cleanName;
                        empMap.set(rawId, existing);
                    });
                } catch (err: any) {
                    if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
                    errors.push(`Lỗi đọc nhóm ảnh DTQĐ: ${err?.message || 'Không rõ lỗi'}`);
                }
            })()
        );
    }

    if (preparedReal.length > 0) {
        tasks.push(
            (async () => {
                try {
                    const parsed = await callGeminiVisionImages(apiKey, preparedReal, buildEmployeeRealPrompt());
                    if (parsed?.reportDate && !detectedDate) detectedDate = parsed.reportDate;
                    if (parsed?.reportTime && !detectedTime) detectedTime = parsed.reportTime;

                    const rawRows: any[] = Array.isArray(parsed?.rows) ? parsed.rows : [];
                    rawRows.forEach((r: any) => {
                        const rawId = String(r.employeeId || r.id || '').replace(/\D/g, '').trim();
                        if (rawId.length < 3) return;
                        const existing = empMap.get(rawId) || { employeeId: rawId, rawName: '' };
                        if (r.revenueActual !== undefined && r.revenueActual !== null) existing.revenueActual = cleanBiNumber(r.revenueActual);
                        if (r.straightRevenue !== undefined && r.straightRevenue !== null) existing.straightRevenue = cleanBiNumber(r.straightRevenue);
                        if (r.installmentRevenue !== undefined && r.installmentRevenue !== null) existing.installmentRevenue = cleanBiNumber(r.installmentRevenue);
                        const cleanName = String(r.rawName || r.name || '').replace(/^\+\s*/, '').replace(/^\d+\s*-\s*/, '').trim();
                        if (!existing.rawName && cleanName) existing.rawName = cleanName;
                        empMap.set(rawId, existing);
                    });
                } catch (err: any) {
                    if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
                    errors.push(`Lỗi đọc nhóm ảnh DT Thực: ${err?.message || 'Không rõ lỗi'}`);
                }
            })()
        );
    }

    await Promise.all(tasks);

    onProgress?.('Đang đối chiếu danh bạ nhân sự hệ thống và chuẩn hóa...', 92);

    // Đối chiếu danh bạ nhân sự để lấy họ tên đầy đủ chuẩn nhất
    const records: ParsedEmployeeRevenue[] = Array.from(empMap.values()).map(item => {
        const cleanId = item.employeeId.trim();

        // Tra cứu danh bạ employees
        const matched = employeesDirectory.find(e => String(e.employee_id || '').trim() === cleanId);
        let fullName = '';

        if (matched && matched.full_name) {
            fullName = matched.full_name.trim();
        } else {
            fullName = cleanEmployeeName(item.rawName) || item.rawName || `Nhân viên ${cleanId}`;
        }

        const qd = Number(item.revenueQd || 0);
        const actual = Number(item.revenueActual || 0);
        const inst = Number(item.installmentRevenue || 0);
        const qty = Number(item.quantity || 0);

        const instRate = actual > 0 ? Number(((inst / actual) * 100).toFixed(1)) : 0;
        const returnQd = qd < 0 ? Math.abs(qd) : 0;

        return {
            employee_id: cleanId,
            full_name: fullName,
            quantity: qty,
            revenue_qd: qd,
            revenue_actual: actual,
            installment_revenue: inst,
            installment_rate: instRate,
            revenue_return_qd: returnQd,
            revenue_loan_qd: Number(item.loanQd || 0)
        };
    });

    records.sort((a, b) => b.revenue_qd - a.revenue_qd || b.revenue_actual - a.revenue_actual);

    onProgress?.('Hoàn tất trích xuất!', 100);

    return {
        success: records.length > 0,
        reportDate: detectedDate || undefined,
        reportTime: detectedTime || undefined,
        records,
        errors: errors.length > 0 ? errors : undefined
    };
}
