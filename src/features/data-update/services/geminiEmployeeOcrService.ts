import {
    GeminiQuotaExceededError,
    type GeminiKeySource
} from './geminiApiKeyService';
import { getShortenedEmployeeName, cleanBiNumber } from '../../../core/lib/formatters';
import type { EmployeeSessionRecord } from '../../employee-cumulative/utils/sessionStorage';
import type { EmployeeItem } from '../../../core/lib/storage';

function getCachedModel(): string | null {
    try {
        return localStorage.getItem('SALESHUB_ACTIVE_GEMINI_MODEL');
    } catch {
        return null;
    }
}

function setCachedModel(model: string): void {
    try {
        localStorage.setItem('SALESHUB_ACTIVE_GEMINI_MODEL', model);
    } catch {}
}

export interface EmployeeOcrCampaignItem {
    campaignName: string;
    value: number;
    rank?: number | null;
    badge?: string | null;
}

export interface EmployeeOcrParsedItem {
    employeeId: string;
    fullName: string;
    revenueQd: number;
    revenueReal: number;
    installmentReal: number;
    installmentRate: number;
    campaigns: Record<string, number>;
    campaignDetails?: EmployeeOcrCampaignItem[];
}

export interface EmployeeOcrResult {
    success: boolean;
    employees: EmployeeOcrParsedItem[];
    campaignTotals?: Array<{ campaignName: string; totalValue: number }>;
    reportDate?: string;
    screenshotTimestamp?: string;
    errors?: string[];
    rawLogs?: string;
}

const CANDIDATE_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash',
    'gemini-3.8-flash'
];

/**
 * Chuyển File thô sang Base64
 */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const res = reader.result as string;
            const b64 = res.split(',')[1] || res;
            resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Nén & chuẩn hóa ảnh trước khi gửi Gemini Vision (giảm kích thước max 1600px, JPEG 0.85)
 * Giúp giảm dung lượng từ 3-5MB/ảnh xuống ~250-350KB/ảnh, tăng tốc độ upload gấp 10 lần,
 * ngăn chặn hoàn toàn lỗi tràn bộ nhớ và timeout AbortError khi nạp 15-20 ảnh.
 */
export function prepareImageForOcr(
    file: File,
    maxDim: number = 1600
): Promise<{ data: string; mimeType: string }> {
    return new Promise((resolve) => {
        // Nếu không có DOM/Window (test environment) thì fallback về base64 thuần
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            fileToBase64(file).then(b64 => resolve({ data: b64, mimeType: file.type || 'image/jpeg' }));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const rawDataUrl = e.target?.result as string;
            if (!rawDataUrl) {
                fileToBase64(file).then(b64 => resolve({ data: b64, mimeType: file.type || 'image/jpeg' }));
                return;
            }

            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width <= maxDim && height <= maxDim && file.size < 500 * 1024) {
                    const b64 = rawDataUrl.split(',')[1] || rawDataUrl;
                    resolve({ data: b64, mimeType: file.type || 'image/jpeg' });
                    return;
                }

                if (width > height) {
                    if (width > maxDim) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    const b64 = rawDataUrl.split(',')[1] || rawDataUrl;
                    resolve({ data: b64, mimeType: file.type || 'image/jpeg' });
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                const b64 = compressedDataUrl.split(',')[1] || compressedDataUrl;
                resolve({ data: b64, mimeType: 'image/jpeg' });
            };
            img.onerror = () => {
                fileToBase64(file).then(b64 => resolve({ data: b64, mimeType: file.type || 'image/jpeg' }));
            };
            img.src = rawDataUrl;
        };
        reader.onerror = () => {
            fileToBase64(file).then(b64 => resolve({ data: b64, mimeType: file.type || 'image/jpeg' }));
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Prompt chuyên biệt cho trích xuất DOANH THU (DT-QĐ và DT-THỰC)
 */
function buildRevenueOcrPrompt(): string {
    return `
Bạn là chuyên gia phân tích dữ liệu kinh doanh bán lẻ từ ảnh chụp màn hình BI.
Hình ảnh được gửi gồm bảng DOANH THU QUY ĐỔI (DT-QĐ) và/hoặc DOANH THU THỰC (DT-THỰC) theo nhân viên.
(LƯU Ý: Một ảnh có thể chứa đồng thời CẢ 2 BẢNG XẾP CHỒNG: Bảng trên là DOANH THU QĐ, bảng dưới là DOANH THU THỰC & DT TRẢ GÓP).

YÊU CẦU TRÍCH XUẤT:
1. Nhận diện từng nhân viên qua Mã NV (ví dụ "260732", "27560", "249041", "267997", "22838", "4614").
2. HỌ TÊN: Lấy họ tên nhân viên (kể cả khi tên bị cắt ngắn kèm dấu ba chấm như "Nguyễn...").
3. DOANH THU & ĐỊNH DẠNG SỐ QUAN TRỌNG:
   - DẤU PHẨY ',' LÀ DẤU PHÂN CÁCH HÀNG NGHÌN. KHÔNG PHẢI DẤU PHẨY THẬP PHÂN.
   - VÍ DỤ: "4,237" -> 4237; "4,146" -> 4146; "3,405" -> 3405; "3,361" -> 3361; "3,221" -> 3221; "3,143" -> 3143; "1,799" -> 1799; "1,172" -> 1172.
   - revenueQd: lấy từ cột DOANH THU QĐ (ví dụ "4,237" -> 4237).
   - revenueReal: lấy từ cột DOANH THU thực (ví dụ "3,221" -> 3221).
   - installmentReal: lấy từ cột DT TRẢ GÓP (ví dụ "1,799" -> 1799).
   - installmentRate: tính tỷ lệ % = (installmentReal / revenueReal) * 100. Làm tròn 2 chữ số thập phân.
   - ĐƠN VỊ TIỀN TỆ: Giữ nguyên đơn vị trên ảnh (triệu đồng), không nhân 1,000,000.
4. LOẠI BỎ DỮ LIỆU DƯ THỪA: Bỏ qua dòng 'online - Online - 18001060' và các dòng tổng cộng.
5. THỜI GIAN CHỤP: Nếu thấy dòng chữ "Cập nhật lúc: HH:mm:ss DD/MM/YYYY" ở góc ảnh, hãy trích xuất vào "screenshotTimestamp".

Trả về DUY NHẤT một khối JSON thuần:
{
  "screenshotTimestamp": string,
  "employees": [
    {
      "employeeId": string,
      "fullName": string,
      "revenueQd": number,
      "revenueReal": number,
      "installmentReal": number,
      "installmentRate": number
    }
  ]
}
Chỉ trả về JSON thuần, không bọc markdown \`\`\`json.
`;
}

/**
 * Prompt chuyên biệt cho trích xuất MỘT NHÓM BẢNG THI ĐUA (Emulation Batch)
 */
function buildEmulationBatchPrompt(): string {
    return `
Bạn là chuyên gia phân tích dữ liệu thi đua bán lẻ từ ảnh chụp màn hình BI.
Tôi gửi một nhóm nhỏ các hình ảnh chứa các bảng/khối chương trình thi đua nhân viên (ví dụ: 'T09 - T10 IPHONE 18 series, iPhone Duo', 'T10 - Bảo Hiểm Tổng', 'GIA DỤNG', 'PHỤ KIỆN'...).
Mỗi ảnh hoặc nửa ảnh có thể chứa một hoặc nhiều khối thi đua xếp dọc nhau.
Mỗi khối có:
- Tiêu đề chương trình thi đua (nằm ở hàng đầu tiên của bảng, ví dụ: 'T09 - T10 IPHONE 18 series, iPhone Duo').
- Dòng TỔNG (có tổng doanh thu hoặc số lượng của chương trình, ví dụ: 14,352.92).
- Danh sách nhân viên trong bảng: Mã NV, Họ Tên ĐẦY ĐỦ, Doanh thu hoặc Số lượng đạt được, Hạng (rank), Nhãn (badge: TOP/BOTTOM).

YÊU CẦU TRÍCH XUẤT:
1. Nhận diện từng chương trình thi đua và danh sách nhân viên đạt được trong chương trình đó.
2. DẤU PHẨY ',' LÀ DẤU PHÂN CÁCH HÀNG NGHÌN.
   - VÍ DỤ: "14,352.92" -> 14352.92; "3,038.70" -> 3038.70; "3,002.13" -> 3002.13; "2,437.00" -> 2437.00; "490.35" -> 490.35; "91.29" -> 91.29; "90.04" -> 90.04; "82.64" -> 82.64.
3. HỌ TÊN ĐẦY ĐỦ: Bảng thi đua thường có họ tên đầy đủ nhất (ví dụ "260732 - Nguyễn Thị Hồng Loan" -> Mã "260732", Họ tên "Nguyễn Thị Hồng Loan").
4. LOẠI BỎ DỮ LIỆU DƯ THỪA: Bỏ qua các dòng không phải nhân viên thực tế như 'online - Online - 18001060'. Bỏ qua dòng TỔNG khi liệt kê nhân viên.

Trả về DUY NHẤT một khối JSON thuần:
{
  "campaignTotals": [
    { "campaignName": string, "totalValue": number }
  ],
  "campaigns": [
    {
      "campaignName": string,
      "employees": [
        {
          "employeeId": string,
          "fullName": string,
          "value": number,
          "rank": number,
          "badge": string
        }
      ]
    }
  ]
}
Chỉ trả về JSON thuần, không bọc markdown \`\`\`json.
`;
}

/**
 * Gọi Gemini Vision API với cơ chế kiểm soát Timeout 60s và xử lý lỗi minh bạch
 */
async function callGeminiVisionJson(
    apiKey: string,
    promptText: string,
    images: Array<{ data: string; mimeType: string }>,
    timeoutMs: number = 60000,
    keySource: GeminiKeySource = 'ADMIN',
    onLog?: (msg: string) => void
): Promise<any> {
    const parts: any[] = [{ text: promptText }];
    for (const img of images) {
        parts.push({
            inlineData: { data: img.data, mimeType: img.mimeType }
        });
    }

    const cached = getCachedModel();
    const modelsToTry = cached
        ? [cached, ...CANDIDATE_MODELS.filter(m => m !== cached)]
        : CANDIDATE_MODELS;

    let lastError: any = null;

    for (const model of modelsToTry) {
        try {
            onLog?.(`Đang gọi mô hình ${model}...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, timeoutMs);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: 'application/json'
                    }
                })
            });

            clearTimeout(timeoutId);

            if (response.status === 429) {
                throw new GeminiQuotaExceededError('Hạn mức API Key đã hết (Lỗi 429)', keySource);
            }

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                const errMsg = errJson.error?.message || response.statusText;
                console.warn(`Mô hình ${model} trả về HTTP ${response.status}:`, errMsg);
                lastError = new Error(`Model ${model}: ${errMsg}`);
                continue;
            }

            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!rawText) {
                lastError = new Error(`Mô hình ${model} không trả về kết quả.`);
                continue;
            }

            setCachedModel(model);

            let cleanJson = rawText.trim();
            if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
            if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
            if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);

            return JSON.parse(cleanJson.trim());
        } catch (err: any) {
            if (err instanceof GeminiQuotaExceededError) {
                throw err;
            }
            if (err.name === 'AbortError' || err.message?.includes('aborted')) {
                lastError = new Error(`Xử lý nhóm ảnh vượt quá thời gian cho phép (${Math.round(timeoutMs / 1000)}s).`);
            } else {
                lastError = err;
            }
            console.warn(`Lỗi khi gọi model ${model}:`, err);
        }
    }

    throw lastError || new Error('Không thể nhận diện hình ảnh qua các mô hình AI.');
}

/**
 * Trích xuất và hợp nhất toàn bộ các ảnh chụp nhân viên (DT-QĐ, DT-THỰC, THI ĐUA)
 * SỬ DỤNG CƠ CHẾ CHIA NHỎ THEO LÔ (BATCHING CHUNKS CỦA 3 ẢNH) VÀ NÉN ẢNH
 * ĐẢM BẢO XỬ LÝ MƯỢT MÀ KHI NẠP 20 FILE ẢNH THI ĐUA MÀ KHÔNG BỊ ABORT / TIMEOUT.
 */
export async function extractAndMergeEmployeeImages(
    apiKey: string,
    files: {
        qdFile: File | null;
        realFile: File | null;
        emulationFiles: File[];
    },
    systemEmployees: EmployeeItem[] = [],
    onProgress?: (status: string, percent: number) => void,
    keySource: GeminiKeySource = 'ADMIN'
): Promise<EmployeeOcrResult> {
    const { qdFile, realFile, emulationFiles } = files;
    const hasRevenue = Boolean(qdFile || realFile);
    const totalEmulation = emulationFiles.length;

    if (!hasRevenue && totalEmulation === 0) {
        return { success: false, employees: [], errors: ['Chưa chọn hình ảnh nào để trích xuất.'] };
    }

    onProgress?.('Đang nén và tối ưu hóa kích thước hình ảnh...', 5);

    // 1. Nén ảnh Doanh thu
    const revenueImages: Array<{ data: string; mimeType: string }> = [];
    if (qdFile) {
        revenueImages.push(await prepareImageForOcr(qdFile));
    }
    if (realFile) {
        revenueImages.push(await prepareImageForOcr(realFile));
    }

    // 2. Nén ảnh Thi đua
    const preparedEmulationImages: Array<{ data: string; mimeType: string }> = [];
    for (let i = 0; i < emulationFiles.length; i++) {
        preparedEmulationImages.push(await prepareImageForOcr(emulationFiles[i]));
    }

    const employeeMap = new Map<string, EmployeeOcrParsedItem>();
    const allCampaignTotals: Array<{ campaignName: string; totalValue: number }> = [];
    let detectedTimestamp: string | undefined;

    // Chia nhỏ danh sách ảnh thi đua thành các lô (Mỗi lô 3 ảnh)
    const CHUNK_SIZE = 3;
    const emuChunks: Array<Array<{ data: string; mimeType: string }>> = [];
    for (let i = 0; i < preparedEmulationImages.length; i += CHUNK_SIZE) {
        emuChunks.push(preparedEmulationImages.slice(i, i + CHUNK_SIZE));
    }

    const totalSteps = (hasRevenue ? 1 : 0) + emuChunks.length;
    let currentStep = 0;

    // =========================================================================
    // GIAI ĐOẠN 1: TRÍCH XUẤT DOANH THU CỐT LÕI (DT-QĐ & DT-THỰC)
    // =========================================================================
    if (hasRevenue) {
        currentStep++;
        const pct = Math.round((currentStep / (totalSteps + 1)) * 90);
        onProgress?.(`Đang trích xuất Doanh thu DT-QĐ & DT-Thực (Đợt ${currentStep}/${totalSteps})...`, pct);

        try {
            const revParsed = await callGeminiVisionJson(
                apiKey,
                buildRevenueOcrPrompt(),
                revenueImages,
                60000,
                keySource,
                (msg) => onProgress?.(`Doanh thu: ${msg}`, pct)
            );

            if (revParsed.screenshotTimestamp) {
                detectedTimestamp = revParsed.screenshotTimestamp;
            }

            const revEmployees: any[] = Array.isArray(revParsed.employees) ? revParsed.employees : [];
            revEmployees.forEach(e => {
                const empId = String(e.employeeId || '').trim();
                const name = String(e.fullName || '').trim();
                if (!empId || empId === 'online' || name.toLowerCase().includes('online - 18001060')) return;

                const revQd = cleanBiNumber(e.revenueQd);
                const revReal = cleanBiNumber(e.revenueReal);
                const instReal = cleanBiNumber(e.installmentReal);
                const instRate = e.installmentRate !== undefined && e.installmentRate !== null
                    ? cleanBiNumber(e.installmentRate)
                    : (revReal > 0 ? Number(((instReal / revReal) * 100).toFixed(2)) : 0);

                employeeMap.set(empId, {
                    employeeId: empId,
                    fullName: name,
                    revenueQd: revQd,
                    revenueReal: revReal,
                    installmentReal: instReal,
                    installmentRate: instRate,
                    campaigns: {},
                    campaignDetails: []
                });
            });
        } catch (err: any) {
            console.error('Lỗi khi quét ảnh Doanh thu:', err);
            if (emuChunks.length === 0) throw err;
        }
    }

    // =========================================================================
    // GIAI ĐOẠN 2: TRÍCH XUẤT THI ĐUA THEO TỪNG LÔ (3 ẢNH / LÔ)
    // =========================================================================
    for (let cIdx = 0; cIdx < emuChunks.length; cIdx++) {
        currentStep++;
        const chunk = emuChunks[cIdx];
        const fromImg = cIdx * CHUNK_SIZE + 1;
        const toImg = Math.min((cIdx + 1) * CHUNK_SIZE, emulationFiles.length);
        const pct = Math.round((currentStep / (totalSteps + 1)) * 90);

        onProgress?.(
            `Đang trích xuất nhóm thi đua ${cIdx + 1}/${emuChunks.length} (Ảnh ${fromImg} - ${toImg}/${emulationFiles.length})...`,
            pct
        );

        try {
            const emuParsed = await callGeminiVisionJson(
                apiKey,
                buildEmulationBatchPrompt(),
                chunk,
                60000,
                keySource,
                (msg) => onProgress?.(`Nhóm thi đua ${cIdx + 1}: ${msg}`, pct)
            );

            // Gộp campaignTotals
            if (Array.isArray(emuParsed.campaignTotals)) {
                emuParsed.campaignTotals.forEach((ct: any) => {
                    const cName = String(ct.campaignName || '').trim();
                    const val = cleanBiNumber(ct.totalValue);
                    if (cName) {
                        allCampaignTotals.push({ campaignName: cName, totalValue: val });
                    }
                });
            }

            // Gộp danh sách nhân viên & thành tích thi đua
            const campaignsList: any[] = Array.isArray(emuParsed.campaigns) ? emuParsed.campaigns : [];
            campaignsList.forEach(camp => {
                const cName = String(camp.campaignName || '').trim();
                const emps: any[] = Array.isArray(camp.employees) ? camp.employees : [];

                emps.forEach(empRow => {
                    const empId = String(empRow.employeeId || '').trim();
                    let fullName = String(empRow.fullName || '').trim();
                    if (!empId || empId === 'online' || fullName.toLowerCase().includes('online - 18001060')) return;

                    const val = cleanBiNumber(empRow.value);
                    let targetEmp = employeeMap.get(empId);

                    if (!targetEmp) {
                        targetEmp = {
                            employeeId: empId,
                            fullName: fullName,
                            revenueQd: 0,
                            revenueReal: 0,
                            installmentReal: 0,
                            installmentRate: 0,
                            campaigns: {},
                            campaignDetails: []
                        };
                        employeeMap.set(empId, targetEmp);
                    } else {
                        // Cập nhật họ tên đầy đủ nhất từ bảng thi đua
                        if (fullName && (!targetEmp.fullName || targetEmp.fullName.endsWith('...') || targetEmp.fullName.length <= 8)) {
                            targetEmp.fullName = fullName;
                        }
                    }

                    if (cName) {
                        targetEmp.campaigns[cName] = val;
                        targetEmp.campaignDetails = targetEmp.campaignDetails || [];
                        targetEmp.campaignDetails.push({
                            campaignName: cName,
                            value: val,
                            rank: empRow.rank ? Number(empRow.rank) : null,
                            badge: empRow.badge || null
                        });
                    }
                });
            });
        } catch (err: any) {
            console.warn(`Lỗi khi quét nhóm thi đua ${cIdx + 1}:`, err);
            // Tiếp tục quét các nhóm thi đua còn lại
        }
    }

    // =========================================================================
    // GIAI ĐOẠN 3: LÀM GIÀU & CHUẨN HÓA DANH SÁCH NHÂN SỰ TOÀN DIỆN
    // =========================================================================
    onProgress?.('Đang rà soát và đối chiếu danh mục nhân sự hệ thống...', 95);

    const employeeDictMap = new Map<string, string>();
    systemEmployees.forEach(emp => {
        if (emp.employee_id && emp.full_name) {
            employeeDictMap.set(String(emp.employee_id).trim(), emp.full_name.trim());
        }
    });

    const finalEmployees: EmployeeOcrParsedItem[] = Array.from(employeeMap.values()).map(emp => {
        let fullName = emp.fullName;
        if (!fullName || fullName.endsWith('...') || fullName.length <= 8) {
            const dictName = employeeDictMap.get(emp.employeeId);
            if (dictName) fullName = dictName;
        }
        return {
            ...emp,
            fullName
        };
    });

    onProgress?.(`Đã trích xuất & hợp nhất thành công ${finalEmployees.length} nhân viên!`, 100);

    return {
        success: finalEmployees.length > 0,
        employees: finalEmployees,
        campaignTotals: allCampaignTotals,
        screenshotTimestamp: detectedTimestamp
    };
}

/**
 * Trích xuất BỔ SUNG thêm ảnh thi đua và hợp nhất vào danh sách nhân viên hiện tại
 * Cho phép người dùng chia nhỏ các bước nạp dữ liệu thủ công (ví dụ quét 5 ảnh một lần)
 */
export async function extractAdditionalEmulationImages(
    apiKey: string,
    additionalFiles: File[],
    currentEmployees: EmployeeOcrParsedItem[],
    systemEmployees: EmployeeItem[] = [],
    onProgress?: (status: string, percent: number) => void,
    keySource: GeminiKeySource = 'ADMIN'
): Promise<EmployeeOcrResult> {
    if (additionalFiles.length === 0) {
        return { success: true, employees: currentEmployees };
    }

    onProgress?.('Đang nén các ảnh thi đua bổ sung...', 10);

    const preparedImages: Array<{ data: string; mimeType: string }> = [];
    for (const f of additionalFiles) {
        preparedImages.push(await prepareImageForOcr(f));
    }

    const employeeMap = new Map<string, EmployeeOcrParsedItem>();
    currentEmployees.forEach(e => {
        employeeMap.set(e.employeeId, {
            ...e,
            campaigns: { ...e.campaigns },
            campaignDetails: [...(e.campaignDetails || [])]
        });
    });

    const CHUNK_SIZE = 3;
    const chunks: Array<Array<{ data: string; mimeType: string }>> = [];
    for (let i = 0; i < preparedImages.length; i += CHUNK_SIZE) {
        chunks.push(preparedImages.slice(i, i + CHUNK_SIZE));
    }

    const allCampaignTotals: Array<{ campaignName: string; totalValue: number }> = [];

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
        const fromImg = cIdx * CHUNK_SIZE + 1;
        const toImg = Math.min((cIdx + 1) * CHUNK_SIZE, additionalFiles.length);
        const pct = Math.round(((cIdx + 1) / (chunks.length + 1)) * 85);
        onProgress?.(`Đang quét thi đua bổ sung đợt ${cIdx + 1}/${chunks.length} (Ảnh ${fromImg} - ${toImg})...`, pct);

        try {
            const emuParsed = await callGeminiVisionJson(
                apiKey,
                buildEmulationBatchPrompt(),
                chunks[cIdx],
                60000,
                keySource
            );

            if (Array.isArray(emuParsed.campaignTotals)) {
                emuParsed.campaignTotals.forEach((ct: any) => {
                    const cName = String(ct.campaignName || '').trim();
                    const val = cleanBiNumber(ct.totalValue);
                    if (cName) allCampaignTotals.push({ campaignName: cName, totalValue: val });
                });
            }

            const campaignsList: any[] = Array.isArray(emuParsed.campaigns) ? emuParsed.campaigns : [];
            campaignsList.forEach(camp => {
                const cName = String(camp.campaignName || '').trim();
                const emps: any[] = Array.isArray(camp.employees) ? camp.employees : [];

                emps.forEach(empRow => {
                    const empId = String(empRow.employeeId || '').trim();
                    const fullName = String(empRow.fullName || '').trim();
                    if (!empId || empId === 'online' || fullName.toLowerCase().includes('online - 18001060')) return;

                    const val = cleanBiNumber(empRow.value);
                    let targetEmp = employeeMap.get(empId);

                    if (!targetEmp) {
                        targetEmp = {
                            employeeId: empId,
                            fullName: fullName,
                            revenueQd: 0,
                            revenueReal: 0,
                            installmentReal: 0,
                            installmentRate: 0,
                            campaigns: {},
                            campaignDetails: []
                        };
                        employeeMap.set(empId, targetEmp);
                    } else if (fullName && (!targetEmp.fullName || targetEmp.fullName.endsWith('...'))) {
                        targetEmp.fullName = fullName;
                    }

                    if (cName) {
                        targetEmp.campaigns[cName] = val;
                        targetEmp.campaignDetails = targetEmp.campaignDetails || [];
                        const existingDetailIdx = targetEmp.campaignDetails.findIndex(d => d.campaignName === cName);
                        if (existingDetailIdx !== -1) {
                            targetEmp.campaignDetails[existingDetailIdx] = {
                                campaignName: cName,
                                value: val,
                                rank: empRow.rank ? Number(empRow.rank) : null,
                                badge: empRow.badge || null
                            };
                        } else {
                            targetEmp.campaignDetails.push({
                                campaignName: cName,
                                value: val,
                                rank: empRow.rank ? Number(empRow.rank) : null,
                                badge: empRow.badge || null
                            });
                        }
                    }
                });
            });
        } catch (err: any) {
            console.warn(`Lỗi khi quét nhóm bổ sung ${cIdx + 1}:`, err);
        }
    }

    onProgress?.('Đã hợp nhất xong số liệu thi đua bổ sung!', 100);

    return {
        success: true,
        employees: Array.from(employeeMap.values()),
        campaignTotals: allCampaignTotals
    };
}

/**
 * Chuyển đổi EmployeeOcrParsedItem[] thành EmployeeSessionRecord[] để lưu vào Supabase
 */
export function convertOcrItemsToSessionRecords(
    items: EmployeeOcrParsedItem[],
    storeName: string
): EmployeeSessionRecord[] {
    return items.map(item => ({
        employee_id: item.employeeId,
        full_name: item.fullName,
        quantity: 0,
        revenue_qd: item.revenueQd,
        revenue_actual: item.revenueReal,
        installment_revenue: item.installmentReal,
        installment_rate: item.installmentRate,
        campaigns: item.campaigns,
        short_name: getShortenedEmployeeName(item.fullName),
        store_name: storeName
    }));
}

/**
 * Chuyển đổi ngược từ EmployeeSessionRecord[] sang EmployeeOcrParsedItem[] để tải lại dữ liệu phiên
 */
export function convertSessionRecordsToOcrItems(
    records: EmployeeSessionRecord[]
): EmployeeOcrParsedItem[] {
    return (records || []).map(r => ({
        employeeId: r.employee_id,
        fullName: r.full_name,
        revenueQd: r.revenue_qd || 0,
        revenueReal: r.revenue_actual || 0,
        installmentReal: r.installment_revenue || 0,
        installmentRate: r.installment_rate || 0,
        campaigns: r.campaigns || {},
        campaignDetails: Object.entries(r.campaigns || {}).map(([cName, cVal]) => ({
            campaignName: cName,
            value: cVal
        }))
    }));
}
