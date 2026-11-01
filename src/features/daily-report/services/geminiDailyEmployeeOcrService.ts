import type { EmployeeItem } from '../../../core/lib/storage';
import { getShortenedEmployeeName, cleanEmployeeName, cleanBiNumber } from '../../../core/lib/formatters';
import type { ParsedEmployeeRevenue } from '../../employee-cumulative/utils/employeeParsers';
import {
    GeminiQuotaExceededError,
    type GeminiKeySource
} from '../../data-update/services/geminiApiKeyService';
import { fileToBase64 } from '../../data-update/services/geminiVisionOcrService';

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
 * Gọi Gemini Vision API
 */
async function callGeminiVisionText(
    apiKey: string,
    base64Image: string,
    mimeType: string,
    prompt: string
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

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const errMsg = errData?.error?.message || `HTTP ${res.status}`;
                if (res.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit')) {
                    throw new GeminiQuotaExceededError(`Quota exceeded for ${model}`);
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

            const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleanText);
        } catch (err: any) {
            if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) {
                throw err;
            }
            lastError = err;
        }
    }

    throw lastError || new Error('Không thể kết nối đến mô hình Gemini Vision.');
}

/**
 * 1. Bóc tách ảnh DOANH THU QUY ĐỔI & SỐ LƯỢNG (Ảnh Loại 2)
 * Hỗ trợ cả trường hợp ảnh đầu tiên (có header) và ảnh thứ 2, 3... (mất header do cuộn màn hình).
 */
export async function extractEmployeeQdImage(
    apiKey: string,
    file: File
): Promise<{
    reportDate?: string;
    reportTime?: string;
    rows: RawOcrRow[];
}> {
    const base64 = await fileToBase64(file);
    const prompt = `Bạn là chuyên gia phân tích dữ liệu bảng kinh doanh nhân viên bán lẻ từ ảnh chụp màn hình ứng dụng BI Mobile ("Doanh thu hợp nhất").
Nhiệm vụ: Trích xuất chính xác danh sách nhân viên cùng số liệu DOANH THU QUY ĐỔI (DTQĐ) và SỐ LƯỢNG.

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
5. Trích xuất ĐẦY ĐỦ TẤT CẢ các dòng nhân viên có trong ảnh.

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

    const parsed = await callGeminiVisionText(apiKey, base64, file.type, prompt);
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
 * 2. Bóc tách ảnh DOANH THU THỰC & TRẢ GÓP (Ảnh Loại 1)
 * Hỗ trợ cả ảnh đầu tiên và ảnh thứ 2, 3... (mất header do cuộn màn hình).
 */
export async function extractEmployeeRealImage(
    apiKey: string,
    file: File
): Promise<{
    reportDate?: string;
    reportTime?: string;
    rows: RawOcrRow[];
}> {
    const base64 = await fileToBase64(file);
    const prompt = `Bạn là chuyên gia phân tích dữ liệu bảng kinh doanh nhân viên bán lẻ từ ảnh chụp màn hình ứng dụng BI Mobile ("Doanh thu hợp nhất").
Nhiệm vụ: Trích xuất chính xác danh sách nhân viên cùng số liệu DOANH THU THỰC TẾ và DOANH THU TRẢ GÓP.

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
5. Trích xuất ĐẦY ĐỦ TẤT CẢ các dòng nhân viên có trong ảnh.

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

    const parsed = await callGeminiVisionText(apiKey, base64, file.type, prompt);
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
 * 3. HỢP NHẤT HÀNG LOẠT ĐA ẢNH & ĐỐI CHIẾU DANH BẠ NHÂN SỰ
 * - Quét toàn bộ ảnh DTQĐ (kể cả ảnh cuộn mất tiêu đề)
 * - Quét toàn bộ ảnh DT Thực & Trả góp (kể cả ảnh cuộn mất tiêu đề)
 * - Tự động đối chiếu employee_id vào danh bạ employees để khôi phục họ tên chuẩn mực đầy đủ
 * - Luôn luôn dùng danh bạ hệ thống, khi nào không có thì mới dùng kết quả OCR
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
    let completedCount = 0;

    // A. Quét nhóm ảnh DTQĐ & Số lượng
    for (let i = 0; i < qdFiles.length; i++) {
        const file = qdFiles[i];
        completedCount++;
        const pct = Math.round((completedCount / totalFiles) * 85);
        onProgress?.(`Đang bóc tách DTQĐ & Số Lượng (${i + 1}/${qdFiles.length}): ${file.name || 'Ảnh dán'}...`, pct);

        try {
            const res = await extractEmployeeQdImage(apiKey, file);
            if (res.reportDate && !detectedDate) detectedDate = res.reportDate;
            if (res.reportTime && !detectedTime) detectedTime = res.reportTime;

            res.rows.forEach(row => {
                const id = row.employeeId;
                const existing = empMap.get(id) || { employeeId: id, rawName: row.rawName };
                existing.quantity = row.quantity !== undefined ? row.quantity : existing.quantity;
                existing.revenueQd = row.revenueQd !== undefined ? row.revenueQd : existing.revenueQd;
                existing.loanQd = row.loanQd !== undefined ? row.loanQd : existing.loanQd;
                if (!existing.rawName && row.rawName) existing.rawName = row.rawName;
                empMap.set(id, existing);
            });
        } catch (err: any) {
            if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
            errors.push(`Lỗi đọc ảnh DTQĐ ${file.name}: ${err?.message || 'Không rõ lỗi'}`);
        }
    }

    // B. Quét nhóm ảnh DT Thực & Trả góp
    for (let i = 0; i < realFiles.length; i++) {
        const file = realFiles[i];
        completedCount++;
        const pct = Math.round((completedCount / totalFiles) * 85);
        onProgress?.(`Đang bóc tách DT Thực & Trả Góp (${i + 1}/${realFiles.length}): ${file.name || 'Ảnh dán'}...`, pct);

        try {
            const res = await extractEmployeeRealImage(apiKey, file);
            if (res.reportDate && !detectedDate) detectedDate = res.reportDate;
            if (res.reportTime && !detectedTime) detectedTime = res.reportTime;

            res.rows.forEach(row => {
                const id = row.employeeId;
                const existing = empMap.get(id) || { employeeId: id, rawName: row.rawName };
                existing.revenueActual = row.revenueActual !== undefined ? row.revenueActual : existing.revenueActual;
                existing.straightRevenue = row.straightRevenue !== undefined ? row.straightRevenue : existing.straightRevenue;
                existing.installmentRevenue = row.installmentRevenue !== undefined ? row.installmentRevenue : existing.installmentRevenue;
                if (!existing.rawName && row.rawName) existing.rawName = row.rawName;
                empMap.set(id, existing);
            });
        } catch (err: any) {
            if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
            errors.push(`Lỗi đọc ảnh DT Thực ${file.name}: ${err?.message || 'Không rõ lỗi'}`);
        }
    }

    onProgress?.('Đang đối chiếu danh bạ nhân sự hệ thống và chuẩn hóa...', 92);

    // C. Đối chiếu danh bạ nhân sự để lấy họ tên đầy đủ chuẩn nhất
    const records: ParsedEmployeeRevenue[] = Array.from(empMap.values()).map(item => {
        const cleanId = item.employeeId.trim();

        // Tra cứu danh bạ employees
        const matched = employeesDirectory.find(e => String(e.employee_id || '').trim() === cleanId);
        let fullName = '';

        if (matched && matched.full_name) {
            // Luôn luôn dùng danh bạ hệ thống
            fullName = matched.full_name.trim();
        } else {
            // Khi không tìm thấy dữ liệu trong danh bạ mới dùng kết quả OCR
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

    // Sắp xếp mặc định theo DTQĐ giảm dần, nếu DTQĐ bằng 0 thì theo DT Thực giảm dần
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

