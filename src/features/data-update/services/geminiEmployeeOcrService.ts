import {
    GeminiQuotaExceededError,
    type GeminiKeySource,
    getAvailableApiKeys,
    maskApiKey,
    STANDARD_GEMINI_MODELS,
    sanitizeCachedGeminiModel
} from './geminiApiKeyService';
import { getShortenedEmployeeName, cleanBiNumber } from '../../../core/lib/formatters';
import type { EmployeeSessionRecord } from '../../employee-cumulative/utils/sessionStorage';
import type { EmployeeItem } from '../../../core/lib/storage';
import {
    resolveCampaignNameByTarget,
    isQuantityCampaign,
    type KnownStoreCampaignTarget,
    type CampaignMappingItem
} from './campaignTargetMappingService';
import { prepareImageForOcr, fileToBase64 } from './imageCompressionService';

export { prepareImageForOcr, fileToBase64 };
export type { KnownStoreCampaignTarget, CampaignMappingItem };

function getCachedModel(): string | null {
    return sanitizeCachedGeminiModel();
}

function setCachedModel(model: string): void {
    try {
        localStorage.setItem('SALESHUB_ACTIVE_GEMINI_MODEL', model);
    } catch {}
}

export interface EmployeeOcrCampaignItem {
    campaignName: string;
    rawCampaignName?: string;
    value: number;
    rank?: number | null;
    badge?: string | null;
    ratioPercent?: number;
    storeActual?: number;
    storeTarget?: number;
    unit?: string;
    isAutoMatched?: boolean;
    mappedReason?: string;
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
    campaignMappings?: CampaignMappingItem[];
    reportDate?: string;
    screenshotTimestamp?: string;
    errors?: string[];
    rawLogs?: string;
}

const CANDIDATE_MODELS = STANDARD_GEMINI_MODELS;

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
 * Hỗ trợ cả 2 định dạng:
 * 1. Định dạng phân cấp hình cây theo Siêu Thị (BI Smartphone Tree: Chương trình -> Siêu thị -> Nhân viên % tỉ trọng)
 * 2. Định dạng bảng phẳng truyền thống (Danh sách nhân viên với giá trị trực tiếp)
 */
function buildEmulationBatchPrompt(): string {
    return `
Bạn là chuyên gia phân tích dữ liệu thi đua bán lẻ từ ảnh chụp màn hình BI trên điện thoại thông minh (smartphone).
Hình ảnh gửi gồm các bảng/khối chương trình thi đua nhân viên theo Siêu Thị (ST).

ĐẶC BIỆT CHÚ Ý CẤU TRÚC PHÂN CẤP THEO SIÊU THỊ (HIERARCHICAL TREE FORMAT):
Bảng có các cột: CHƯƠNG TRÌNH | THỰC HIỆN | TARGET | % DỰ KIẾN HOÀN THÀNH (hoặc % HOÀN THÀNH).
Cấu trúc các hàng:
1. HÀNG CHƯƠNG TRÌNH: Bắt đầu bằng tên chương trình (ví dụ: 'T11 - Tai nghe', 'T11 - Sạc dự phòng', 'T11 - Trả chậm...', 'T11 - Bảo hiểm Tổng', 'T11 - VAS', 'T11 - Topzone', 'T11 - Phụ kiện khác IT...', 'T11 - Bảo hiểm Thợ ICT', 'T11 - Loa', 'T11 - Phụ kiện công...', 'T11 - Ví trả sau').
   - Có huy hiệu đơn vị: '[DT]' (Doanh thu) hoặc '[SL]' (Số lượng).
   - Cột THỰC HIỆN: Số lũy kế thực hiện ST (ví dụ: -1.93, 3.26, 179.40, 68.37, 92, 1,844.77, 296.22, 149.77, 45.41, 14.40, 10.29, 165.08).
   - Cột TARGET: Chỉ tiêu (ví dụ: 20.79, 23.79, 1,169.83, 356.05, 484, 10,887.00, 1,718.82, 584.09, 128.48, 32.51, 15.58, 213.60).
2. HÀNG SIÊU THỊ (ST): Nằm dưới hàng chương trình (thường có dấu '-' hoặc icon, ví dụ: '[-] AAR_BRV_VTA - 290 Trương Công Định...').
   - Cột THỰC HIỆN và TARGET: Giá trị thực hiện và target của ST này.
3. HÀNG NHÂN VIÊN: Nằm thụt lề dưới hàng ST.
   - Cột CHƯƠNG TRÌNH: '<Mã NV> - <Họ và tên nhân viên>' (ví dụ: '22838 - Trần Thị Sáu', '260732 - Nguyễn Thị Hồ...', '27560 - Bùi Minh Lãm', '4614 - Lê Quang Vinh', '267997 - Nguyễn Thùy...', '249041 - Nguyễn Phương...').
   - Cột THỰC HIỆN: Hiển thị TỶ LỆ TỈ TRỌNG (%) của nhân viên so với ST (ví dụ: '66.9%', '33.4%', '43.3%', '35%', '21.7%', '51%', '30.5%', '100%', '88%', '11.9%...'). Nếu là dấu gạch ngang '-' nghĩa là 0%.
   - Cột TARGET: thường để trống.

(NGOÀI RA CŨNG HỖ TRỢ BẢNG PHẲNG TRUYỀN THỐNG: Nếu cột THỰC HIỆN của nhân viên ghi số tiền/số lượng trực tiếp không có dấu % thì trích xuất vào directValue).

QUY TẮC BẮT BUỘC:
1. DẤU PHẨY ',' LÀ DẤU PHÂN CÁCH HÀNG NGHÌN (ví dụ: '1,169.83' -> 1169.83; '1,718.82' -> 1718.82; '10,887.00' -> 10887; '1,844.77' -> 1844.77).
2. TỈ LỆ TỈ TRỌNG (%): Loại bỏ ký tự '%' và chuyển thành số (ví dụ: '66.9%' -> 66.9; '43.3%' -> 43.3; '100%' -> 100; '-' -> 0).
3. ĐƠN VỊ: Nhận diện nhãn '[DT]' -> 'DT', '[SL]' -> 'SL'. Nếu chương trình có nhãn [SL] hoặc đơn vị là Số Lượng, bắt buộc đặt unit là 'SL'.
4. TÊN BỊ CẮT NGẮN: Giữ nguyên tên gốc (kể cả có '...' như 'T11 - Trả chậm...').
5. BỎ QUA HOÀN TOÀN: Dòng 'online - Online - 18001060' và các dòng chữ mờ watermark.

Trả về DUY NHẤT một khối JSON thuần:
{
  "campaignTotals": [
    { "campaignName": string, "totalValue": number }
  ],
  "campaigns": [
    {
      "programName": string,
      "unit": "DT" | "SL",
      "storeName": string,
      "storeActual": number,
      "storeTarget": number,
      "employees": [
        {
          "employeeId": string,
          "fullName": string,
          "ratioPercent": number | null,
          "directValue": number | null,
          "rank": number | null,
          "badge": string | null
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
    const candidateKeys = getAvailableApiKeys(apiKey);
    if (candidateKeys.length === 0) {
        throw new Error('Chưa cấu hình API Key nào.');
    }

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

    for (let kIdx = 0; kIdx < candidateKeys.length; kIdx++) {
        const currentKey = candidateKeys[kIdx];
        let keyQuotaExceeded = false;

        for (const model of modelsToTry) {
            try {
                onLog?.(`Đang gọi mô hình ${model} (Key #${kIdx + 1})...`);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`;

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
                    keyQuotaExceeded = true;
                    lastError = new GeminiQuotaExceededError(`Key [${maskApiKey(currentKey)}] đạt giới hạn 429`, keySource);
                    break;
                }

                if (!response.ok) {
                    const errJson = await response.json().catch(() => ({}));
                    const errMsg = errJson.error?.message || response.statusText;
                    const isQuota =
                        errJson?.error?.status === 'RESOURCE_EXHAUSTED' ||
                        errMsg.toLowerCase().includes('quota') ||
                        errMsg.toLowerCase().includes('rate limit');

                    if (isQuota) {
                        keyQuotaExceeded = true;
                        lastError = new GeminiQuotaExceededError(errMsg, keySource);
                        break;
                    }

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
                if (err instanceof GeminiQuotaExceededError || err?.isQuotaExceeded) {
                    keyQuotaExceeded = true;
                    lastError = err;
                    break;
                }
                if (err.name === 'AbortError' || err.message?.includes('aborted')) {
                    lastError = new Error(`Xử lý nhóm ảnh vượt quá thời gian cho phép (${Math.round(timeoutMs / 1000)}s).`);
                } else {
                    lastError = err;
                }
                console.warn(`Lỗi khi gọi model ${model}:`, err);
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

    throw lastError || new Error('Không thể nhận diện hình ảnh qua các mô hình AI.');
}

/**
 * Xử lý kết quả trả về từ một lô ảnh thi đua (Emulation Chunk Result)
 * Hỗ trợ bóc tách phân cấp theo Siêu Thị, tính toán giá trị từ % tỉ trọng
 * và tự động mapping tên thi đua bị cắt ngắn (...) qua Target ST.
 */
function processEmulationChunkResult(
    emuParsed: any,
    employeeMap: Map<string, EmployeeOcrParsedItem>,
    allCampaignTotals: Array<{ campaignName: string; totalValue: number }>,
    detectedMappings: Map<string, CampaignMappingItem>,
    targetMappingOptions?: {
        knownTargets?: KnownStoreCampaignTarget[];
        campaignDict?: Array<{ raw_key: string; display_name: string }>;
    }
) {
    if (!emuParsed) return;

    // 1. Gộp campaignTotals
    if (Array.isArray(emuParsed.campaignTotals)) {
        emuParsed.campaignTotals.forEach((ct: any) => {
            const cName = String(ct.campaignName || '').trim();
            const val = cleanBiNumber(ct.totalValue);
            if (cName) {
                allCampaignTotals.push({ campaignName: cName, totalValue: val });
            }
        });
    }

    // 2. Gộp danh sách nhân viên & thành tích thi đua
    const campaignsList: any[] = Array.isArray(emuParsed.campaigns) ? emuParsed.campaigns : [];
    campaignsList.forEach(camp => {
        const rawName = String(camp.programName || camp.campaignName || '').trim();
        const storeActual = cleanBiNumber(camp.storeActual || camp.actual || camp.totalValue);
        const storeTarget = cleanBiNumber(camp.storeTarget || camp.target);
        let unit = String(camp.unit || 'DT').toUpperCase().includes('SL') ? 'SL' : 'DT';

        // Tự động mapping tên chương trình qua Target ST
        const mappingRes = resolveCampaignNameByTarget(
            rawName,
            storeTarget,
            storeActual,
            targetMappingOptions?.knownTargets || [],
            targetMappingOptions?.campaignDict || []
        );
        const resolvedName = mappingRes.resolvedName || rawName;

        if (mappingRes.unit) {
            const mappedUnit = String(mappingRes.unit).toUpperCase();
            if (mappedUnit.includes('SL') || mappedUnit.includes('SỐ LƯỢNG') || mappedUnit.includes('SO LUONG')) {
                unit = 'SL';
            }
        }

        // Nhận diện chương trình thi đua tính theo số lượng (SL)
        const isQty = isQuantityCampaign(
            unit,
            resolvedName || rawName,
            targetMappingOptions?.knownTargets,
            targetMappingOptions?.campaignDict
        );
        if (isQty) {
            unit = 'SL';
        }

        if (resolvedName) {
            detectedMappings.set(resolvedName, {
                rawName,
                resolvedName,
                unit,
                storeActual,
                storeTarget,
                isAutoMatched: mappingRes.isAutoMatched,
                mappedReason: mappingRes.reason
            });
        }

        const emps: any[] = Array.isArray(camp.employees) ? camp.employees : [];
        emps.forEach(empRow => {
            const empId = String(empRow.employeeId || '').trim();
            let fullName = String(empRow.fullName || '').trim();
            if (!empId || empId === 'online' || fullName.toLowerCase().includes('online - 18001060')) return;

            // Tính giá trị thực hiện của nhân viên
            let val = 0;
            let ratioPercent: number | undefined;

            if (empRow.directValue !== undefined && empRow.directValue !== null && cleanBiNumber(empRow.directValue) > 0) {
                val = cleanBiNumber(empRow.directValue);
            } else if (empRow.ratioPercent !== undefined && empRow.ratioPercent !== null) {
                ratioPercent = cleanBiNumber(empRow.ratioPercent);
                if (ratioPercent > 0 && storeActual !== 0) {
                    const rawCalculated = storeActual * (ratioPercent / 100);
                    // Đối với các chương trình thi đua tính theo số lượng (SL), làm tròn số kết quả (ví dụ: 47,8 → 48)
                    val = isQty ? Math.round(rawCalculated) : Number(rawCalculated.toFixed(2));
                }
            } else if (empRow.value !== undefined && empRow.value !== null) {
                val = cleanBiNumber(empRow.value);
            }

            // Đảm bảo kết quả số lượng luôn được làm tròn thành số nguyên
            if (isQty && !isNaN(val)) {
                val = Math.round(val);
            }

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
                if (fullName && (!targetEmp.fullName || targetEmp.fullName.endsWith('...') || targetEmp.fullName.length <= 8)) {
                    targetEmp.fullName = fullName;
                }
            }

            if (resolvedName) {
                targetEmp.campaigns[resolvedName] = val;
                targetEmp.campaignDetails = targetEmp.campaignDetails || [];

                const detailItem: EmployeeOcrCampaignItem = {
                    campaignName: resolvedName,
                    rawCampaignName: rawName,
                    value: val,
                    ratioPercent,
                    storeActual,
                    storeTarget,
                    unit,
                    rank: empRow.rank ? Number(empRow.rank) : null,
                    badge: empRow.badge || null,
                    isAutoMatched: mappingRes.isAutoMatched,
                    mappedReason: mappingRes.reason
                };

                const existingIdx = targetEmp.campaignDetails.findIndex(d => d.campaignName === resolvedName);
                if (existingIdx !== -1) {
                    targetEmp.campaignDetails[existingIdx] = detailItem;
                } else {
                    targetEmp.campaignDetails.push(detailItem);
                }
            }
        });
    });
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
    keySource: GeminiKeySource = 'ADMIN',
    targetMappingOptions?: {
        knownTargets?: KnownStoreCampaignTarget[];
        campaignDict?: Array<{ raw_key: string; display_name: string }>;
    }
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
    const detectedMappings = new Map<string, CampaignMappingItem>();
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

            processEmulationChunkResult(
                emuParsed,
                employeeMap,
                allCampaignTotals,
                detectedMappings,
                targetMappingOptions
            );
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
        campaignMappings: Array.from(detectedMappings.values()),
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
    keySource: GeminiKeySource = 'ADMIN',
    targetMappingOptions?: {
        knownTargets?: KnownStoreCampaignTarget[];
        campaignDict?: Array<{ raw_key: string; display_name: string }>;
    }
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
    const detectedMappings = new Map<string, CampaignMappingItem>();

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

            processEmulationChunkResult(
                emuParsed,
                employeeMap,
                allCampaignTotals,
                detectedMappings,
                targetMappingOptions
            );
        } catch (err: any) {
            console.warn(`Lỗi khi quét nhóm bổ sung ${cIdx + 1}:`, err);
        }
    }

    onProgress?.('Đã hợp nhất xong số liệu thi đua bổ sung!', 100);

    return {
        success: true,
        employees: Array.from(employeeMap.values()),
        campaignTotals: allCampaignTotals,
        campaignMappings: Array.from(detectedMappings.values())
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
