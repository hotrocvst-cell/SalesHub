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
import {
    cleanBiPercent,
    cleanWorkHoursValue,
    normalizeViName,
    buildRevenueQdOcrPrompt,
    buildInstallmentRateOcrPrompt,
    buildWorkHoursOcrPrompt,
    findMatchedCandidateByName,
    findDirectoryEmployeeByName
} from './employeeOcrShared';

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
    revenueQd: number;         // Doanh thu QĐ (triệu đồng)
    installmentQd: number;     // DT Trả góp QĐ (triệu đồng)
    installmentRate: number;   // % Tỷ trọng trả góp (%)
    workHours?: number;        // Giờ công tại ST làm việc (h)
    campaigns: Record<string, number>;
    campaignDetails?: EmployeeOcrCampaignItem[];
    mappingSource?: 'ID' | 'NAME_EXACT' | 'NAME_FUZZY' | 'UNMAPPED';
    ocrSourceName?: string;    // Tên gốc đọc từ ảnh không có Mã NV để user rà soát
    isUnmappedName?: boolean;  // Đánh dấu dòng chưa khớp được Mã NV trong danh bạ
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
 * Prompt chuyên biệt cho trích xuất BẢNG THI ĐUA NHÂN VIÊN (MẪU MỚI: HÀNG = NHÂN VIÊN, CỘT = CHƯƠNG TRÌNH)
 * Cũng giữ fallback nếu ảnh dùng bảng phân cấp cũ.
 */
function buildEmulationBatchPrompt(): string {
    return `
Bạn là chuyên gia phân tích dữ liệu thi đua bán lẻ từ ảnh chụp màn hình ứng dụng BI trên điện thoại thông minh.

CẤU TRÚC ẢNH MẪU CHÍNH ("Hàng: nhân viên · Cột: chương trình", "Chỉ số: THỰC HIỆN"):
- Góc trên bên phải có thời gian cập nhật "Cập nhật lúc: HH:mm:ss DD/MM/YYYY" (nếu thấy, ghi vào "screenshotTimestamp").
- Cột đầu tiên bên trái: "NHÂN VIÊN"
  + Hàng đầu tiên là "TỔNG": chứa tổng số liệu của từng cột chương trình (dùng làm "storeActual" và "campaignTotals", TUYỆT ĐỐI KHÔNG đưa "TỔNG" vào danh sách nhân viên).
  + Các hàng tiếp theo: CHỈ CÓ HỌ VÀ TÊN NHÂN VIÊN (không có Mã NV, ví dụ: "Đào Hoàng Anh", "Trần Thị Hoài Thu", "Vương Trà Mi", "Trần Thị Tuyết Nga", "Nguyễn Quốc Bảo", "Phan Đình Đức",...).
- Các cột tiếp theo bên phải là TÊN CHƯƠNG TRÌNH THI ĐUA kèm đơn vị trong ngoặc đơn ở cuối tiêu đề:
  + Ví dụ: "Trả chậm FECREDIT, SAMSUNG F+, SHINHAN, MCREDIT (DT)", "Tai nghe (DT)", "Sim ĐMX (SL)", "Trả Chậm Điện máy & Gia dụng (DT)", "Ví trả sau (DT)", "VAS (SL)", "Vay tiền mặt (DT)", "Trả chậm Homecredit (DT)".
  + "(DT)" -> unit = "DT" (triệu đồng).
  + "(SL)" -> unit = "SL" (số lượng).
  + Tách bỏ phần "(DT)" hoặc "(SL)" khỏi "programName" để giữ tên chương trình sạch sẽ.
- Giá trị trong từng ô giao giữa hàng nhân viên và cột chương trình là KẾT QUẢ LŨY KẾ TRỰC TIẾP ("directValue") của nhân viên đó:
  + Nếu ô là dấu gạch ngang "—" hoặc "-" -> directValue = 0.
  + Dấu chấm "." là phần thập phân (ví dụ: "35.84" -> 35.84; "44.80" -> 44.8; "0.05" -> 0.05; "82.44" -> 82.44).
  + Dấu phẩy "," (nếu có trong số >= 1,000) là phân cách hàng nghìn (ví dụ: "1,234.50" -> 1234.5).
  + Đối với cột "(SL)", giá trị là số nguyên (ví dụ: "4", "6", "58", "300").

(Lưu ý bổ sung: nếu ảnh là định dạng bảng cây cũ có % tỉ trọng, vẫn đọc ratioPercent/storeActual/storeTarget như chuẩn cũ).

QUY TẮC BẮT BUỘC:
1. BỎ QUA HOÀN TOÀN các dòng chữ mờ watermark in chéo trên ảnh ("26479 - Đào Bá Linh",...) — TUYỆT ĐỐI KHÔNG lấy số "26479" từ watermark làm giá trị ô!
2. BỎ QUA dòng "online - Online - 18001060" (nếu có).
3. Đọc ĐẦY ĐỦ TẤT CẢ các cột chương trình và ĐẦY ĐỦ TẤT CẢ các hàng nhân viên hiển thị trong bảng theo đúng hàng ngang, không lệch cột.

Trả về DUY NHẤT một khối JSON thuần:
{
  "screenshotTimestamp": string | null,
  "campaignTotals": [
    { "campaignName": string, "unit": "DT" | "SL", "totalValue": number }
  ],
  "campaigns": [
    {
      "programName": string,
      "unit": "DT" | "SL",
      "storeActual": number,
      "storeTarget": number,
      "employees": [
        {
          "employeeId": string | null,
          "fullName": string,
          "directValue": number | null,
          "ratioPercent": number | null,
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
 * Đối chiếu & tạo/cập nhật bản ghi nhân viên theo Mã NV hoặc Họ tên (khi ảnh không có Mã NV)
 * Tự động đánh dấu `mappingSource` và `isUnmappedName` để user rà soát khi cần.
 */
function resolveOrCreateEmployeeByIdOrName(
    employeeMap: Map<string, EmployeeOcrParsedItem>,
    systemEmployees: EmployeeItem[],
    rawId: string | null | undefined,
    rawName: string
): EmployeeOcrParsedItem | null {
    const empId = rawId ? String(rawId).trim() : '';
    const name = String(rawName || '').trim();
    if (!empId && !name) return null;
    if (
        empId.toLowerCase() === 'online' ||
        name.toLowerCase().includes('online - 18001060') ||
        /^(tổng|tong)$/i.test(name)
    ) {
        return null;
    }

    // 1. Có Mã NV rõ ràng
    if (empId) {
        const existing = employeeMap.get(empId);
        if (existing) {
            if (name && (!existing.fullName || existing.fullName.endsWith('...') || existing.fullName.length <= 8)) {
                existing.fullName = name;
            }
            return existing;
        }
        const dictEmp = systemEmployees.find(se => String(se.employee_id || '').trim() === empId);
        const created: EmployeeOcrParsedItem = {
            employeeId: empId,
            fullName: dictEmp?.full_name?.trim() || name,
            revenueQd: 0,
            installmentQd: 0,
            installmentRate: 0,
            workHours: 0,
            campaigns: {},
            campaignDetails: [],
            mappingSource: 'ID',
            isUnmappedName: false
        };
        employeeMap.set(empId, created);
        return created;
    }

    // 2. Không có Mã NV -> Tìm theo Họ tên trong employeeMap trước (từ ảnh Doanh thu QĐ hoặc ảnh trước)
    const normNoAccent = normalizeViName(name, true);
    const inMapMatch = findMatchedCandidateByName(name, Array.from(employeeMap.values()));

    if (inMapMatch) {
        if (!inMapMatch.item.ocrSourceName) inMapMatch.item.ocrSourceName = name;
        if (!inMapMatch.item.mappingSource) inMapMatch.item.mappingSource = inMapMatch.mode;
        return inMapMatch.item;
    }

    // 3. Đối chiếu danh bạ nhân sự ST (systemEmployees)
    const dictRes = findDirectoryEmployeeByName(name, systemEmployees);
    if (dictRes?.emp?.employee_id) {
        const dictId = String(dictRes.emp.employee_id).trim();
        const existingById = employeeMap.get(dictId);
        if (existingById) {
            if (!existingById.ocrSourceName) existingById.ocrSourceName = name;
            return existingById;
        }
        const created: EmployeeOcrParsedItem = {
            employeeId: dictId,
            fullName: dictRes.emp.full_name?.trim() || name,
            revenueQd: 0,
            installmentQd: 0,
            installmentRate: 0,
            workHours: 0,
            campaigns: {},
            campaignDetails: [],
            mappingSource: dictRes.mode,
            ocrSourceName: name,
            isUnmappedName: false
        };
        employeeMap.set(dictId, created);
        return created;
    }

    // 4. Chưa khớp được Mã NV nào -> tạo bản ghi tạm để user rà soát & chọn lại trong Tab 2
    const unmappedKey = `UNMAPPED::${normNoAccent || name}`;
    const existingUnmapped = employeeMap.get(unmappedKey);
    if (existingUnmapped) return existingUnmapped;

    const unmappedItem: EmployeeOcrParsedItem = {
        employeeId: unmappedKey,
        fullName: name,
        revenueQd: 0,
        installmentQd: 0,
        installmentRate: 0,
        workHours: 0,
        campaigns: {},
        campaignDetails: [],
        mappingSource: 'UNMAPPED',
        ocrSourceName: name,
        isUnmappedName: true
    };
    employeeMap.set(unmappedKey, unmappedItem);
    return unmappedItem;
}

/**
 * Xử lý kết quả trả về từ ảnh thi đua (hỗ trợ cả bảng Hàng=Nhân viên/Cột=Chương trình và bảng cây cũ)
 */
function processEmulationChunkResult(
    emuParsed: any,
    employeeMap: Map<string, EmployeeOcrParsedItem>,
    systemEmployees: EmployeeItem[],
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

        // Tự động mapping tên chương trình qua danh mục & Target ST
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
            const targetEmp = resolveOrCreateEmployeeByIdOrName(
                employeeMap,
                systemEmployees,
                empRow.employeeId,
                empRow.fullName
            );
            if (!targetEmp) return;

            // Tính giá trị thực hiện của nhân viên (ưu tiên kết quả lũy kế trực tiếp directValue)
            let val = 0;
            let ratioPercent: number | undefined;

            if (empRow.directValue !== undefined && empRow.directValue !== null && empRow.directValue !== '') {
                val = cleanBiNumber(empRow.directValue);
            } else if (empRow.ratioPercent !== undefined && empRow.ratioPercent !== null) {
                ratioPercent = cleanBiNumber(empRow.ratioPercent);
                if (ratioPercent > 0 && storeActual !== 0) {
                    const rawCalculated = storeActual * (ratioPercent / 100);
                    val = isQty ? Math.round(rawCalculated) : Number(rawCalculated.toFixed(2));
                }
            } else if (empRow.value !== undefined && empRow.value !== null && empRow.value !== '') {
                val = cleanBiNumber(empRow.value);
            }

            if (isQty && !isNaN(val)) {
                val = Math.round(val);
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
 * Gộp danh sách giờ công nhân viên từ 1 ảnh "Theo giờ công" vào employeeMap (bỏ qua dòng bị cắt mất số liệu)
 */
function applyWorkHoursEntries(
    hoursEmployees: any[],
    employeeMap: Map<string, EmployeeOcrParsedItem>,
    systemEmployees: EmployeeItem[]
) {
    hoursEmployees.forEach(e => {
        if (!e || e.workHours === null || e.workHours === undefined || e.workHours === '') {
            return;
        }
        const hoursVal = cleanWorkHoursValue(e.workHours);
        const targetEmp = resolveOrCreateEmployeeByIdOrName(
            employeeMap,
            systemEmployees,
            e.employeeId,
            e.fullName || ''
        );
        if (!targetEmp) return;

        if (hoursVal > 0 || !(targetEmp.workHours && targetEmp.workHours > 0)) {
            targetEmp.workHours = hoursVal;
        }
    });
}

/**
 * Trích xuất và hợp nhất toàn bộ các ảnh chụp nhân viên (DT-QĐ, % Tỷ trọng trả góp, Giờ công, Thi đua)
 * - Ảnh 1 & 2 (Doanh thu hợp nhất): Lấy Doanh thu QĐ & DT Trả góp QĐ (hỗ trợ nhiều ảnh cuộn ngang/dọc)
 * - Ảnh 3 (Báo cáo trả chậm): Lấy % Tỷ trọng trả góp (đối chiếu theo Họ tên nếu ảnh không hiện Mã NV)
 * - Ảnh 4 (Theo giờ công): Lấy Giờ công tại ST làm việc (hỗ trợ nhiều ảnh cuộn trùng dòng)
 * - Ảnh Thi đua: giữ nguyên theo lô 3 ảnh/lần
 */
export async function extractAndMergeEmployeeImages(
    apiKey: string,
    files: {
        qdFile?: File | null;
        qdFiles?: File[];
        installmentFile?: File | null;
        installmentFiles?: File[];
        workHoursFile?: File | null;
        workHoursFiles?: File[];
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
    const qdFilesList: File[] = files.qdFiles && files.qdFiles.length > 0
        ? files.qdFiles
        : (files.qdFile ? [files.qdFile] : []);
    const installmentFilesList: File[] = files.installmentFiles && files.installmentFiles.length > 0
        ? files.installmentFiles
        : (files.installmentFile ? [files.installmentFile] : []);
    const workHoursFilesList: File[] = files.workHoursFiles && files.workHoursFiles.length > 0
        ? files.workHoursFiles
        : (files.workHoursFile ? [files.workHoursFile] : []);
    const emulationFiles = files.emulationFiles || [];

    const totalRevenueFiles = qdFilesList.length + installmentFilesList.length;
    const totalWorkHoursFiles = workHoursFilesList.length;
    const totalEmulation = emulationFiles.length;

    if (totalRevenueFiles === 0 && totalWorkHoursFiles === 0 && totalEmulation === 0) {
        return { success: false, employees: [], errors: ['Chưa chọn hình ảnh nào để trích xuất.'] };
    }

    onProgress?.('Đang nén và tối ưu hóa kích thước hình ảnh...', 5);

    // 1. Nén ảnh Doanh thu QĐ & DT Trả góp QĐ
    const preparedQdImages: Array<{ data: string; mimeType: string }> = [];
    for (let i = 0; i < qdFilesList.length; i++) {
        preparedQdImages.push(await prepareImageForOcr(qdFilesList[i]));
    }

    // 2. Nén ảnh % Tỷ trọng trả góp (Báo cáo trả chậm)
    const preparedInstallmentImages: Array<{ data: string; mimeType: string }> = [];
    for (let i = 0; i < installmentFilesList.length; i++) {
        preparedInstallmentImages.push(await prepareImageForOcr(installmentFilesList[i]));
    }

    // 3. Nén ảnh Giờ công nhân viên (Theo giờ công)
    const preparedWorkHoursImages: Array<{ data: string; mimeType: string }> = [];
    for (let i = 0; i < workHoursFilesList.length; i++) {
        preparedWorkHoursImages.push(await prepareImageForOcr(workHoursFilesList[i]));
    }

    // 4. Nén ảnh Thi đua
    const preparedEmulationImages: Array<{ data: string; mimeType: string }> = [];
    for (let i = 0; i < emulationFiles.length; i++) {
        preparedEmulationImages.push(await prepareImageForOcr(emulationFiles[i]));
    }

    const employeeMap = new Map<string, EmployeeOcrParsedItem>();
    const allCampaignTotals: Array<{ campaignName: string; totalValue: number }> = [];
    const detectedMappings = new Map<string, CampaignMappingItem>();
    let detectedTimestamp: string | undefined;

    // Helper merge nhân sự từ các ảnh Doanh thu QĐ & DT Trả góp QĐ
    const mergeRevenueQdEmployees = (revEmployees: any[]) => {
        revEmployees.forEach(e => {
            const empId = String(e.employeeId || '').trim();
            const name = String(e.fullName || '').trim();
            if (!empId || empId === 'online' || name.toLowerCase().includes('online - 18001060')) return;

            const hasRevQd = e.revenueQd !== null && e.revenueQd !== undefined && e.revenueQd !== '';
            const rawInstQd = e.installmentQd ?? e.dtTraGopQd;
            const hasInstQd = rawInstQd !== null && rawInstQd !== undefined && rawInstQd !== '';

            const revQdVal = hasRevQd ? cleanBiNumber(e.revenueQd) : null;
            const instQdVal = hasInstQd ? cleanBiNumber(rawInstQd) : null;

            if (employeeMap.has(empId)) {
                const existing = employeeMap.get(empId)!;
                if (revQdVal !== null && (revQdVal > 0 || existing.revenueQd === 0)) {
                    existing.revenueQd = revQdVal;
                }
                if (instQdVal !== null && (instQdVal > 0 || existing.installmentQd === 0)) {
                    existing.installmentQd = instQdVal;
                }
                if (name && (name.length > existing.fullName.length || existing.fullName.includes('...')) && !name.includes('...')) {
                    existing.fullName = name;
                }
            } else {
                employeeMap.set(empId, {
                    employeeId: empId,
                    fullName: name,
                    revenueQd: revQdVal ?? 0,
                    installmentQd: instQdVal ?? 0,
                    installmentRate: 0,
                    workHours: 0,
                    campaigns: {},
                    campaignDetails: []
                });
            }
        });
    };

    // Helper merge % Tỷ trọng trả góp từ Ảnh mẫu 3 (đối chiếu theo Mã NV hoặc Họ tên tiếng Việt)
    const mergeInstallmentRateEmployees = (instEmployees: any[]) => {
        instEmployees.forEach(e => {
            const targetEmp = resolveOrCreateEmployeeByIdOrName(
                employeeMap,
                systemEmployees,
                e.employeeId,
                e.fullName
            );
            if (!targetEmp) return;
            targetEmp.installmentRate = cleanBiPercent(e.installmentRate);
        });
    };

    // Quét từng ảnh riêng lẻ để không lệch cột khi cuộn ngang/dọc
    const REV_CHUNK_SIZE = 1;
    const qdChunks: Array<Array<{ data: string; mimeType: string }>> = [];
    for (let i = 0; i < preparedQdImages.length; i += REV_CHUNK_SIZE) {
        qdChunks.push(preparedQdImages.slice(i, i + REV_CHUNK_SIZE));
    }

    const installmentChunks: Array<Array<{ data: string; mimeType: string }>> = [];
    for (let i = 0; i < preparedInstallmentImages.length; i += REV_CHUNK_SIZE) {
        installmentChunks.push(preparedInstallmentImages.slice(i, i + REV_CHUNK_SIZE));
    }

    const workHoursChunks: Array<Array<{ data: string; mimeType: string }>> = [];
    for (let i = 0; i < preparedWorkHoursImages.length; i += REV_CHUNK_SIZE) {
        workHoursChunks.push(preparedWorkHoursImages.slice(i, i + REV_CHUNK_SIZE));
    }

    const EMU_CONCURRENCY = 3;
    const totalSteps =
        qdChunks.length +
        installmentChunks.length +
        workHoursChunks.length +
        preparedEmulationImages.length;
    let currentStep = 0;

    // =========================================================================
    // GIAI ĐOẠN 1A: TRÍCH XUẤT DOANH THU QĐ & DT TRẢ GÓP QĐ (ẢNH 1 & 2)
    // =========================================================================
    for (let qIdx = 0; qIdx < qdChunks.length; qIdx++) {
        currentStep++;
        const chunk = qdChunks[qIdx];
        const pct = Math.round((currentStep / (totalSteps + 1)) * 90);

        onProgress?.(
            `Đang trích xuất Doanh thu QĐ & Trả góp QĐ (ảnh ${qIdx + 1}/${qdFilesList.length})...`,
            pct
        );

        try {
            const revParsed = await callGeminiVisionJson(
                apiKey,
                buildRevenueQdOcrPrompt(),
                chunk,
                60000,
                keySource,
                (msg) => onProgress?.(`DT-QĐ (ảnh ${qIdx + 1}): ${msg}`, pct)
            );

            if (revParsed.screenshotTimestamp && !detectedTimestamp) {
                detectedTimestamp = revParsed.screenshotTimestamp;
            }

            const revEmployees: any[] = Array.isArray(revParsed.employees) ? revParsed.employees : [];
            mergeRevenueQdEmployees(revEmployees);
        } catch (err: any) {
            if (err instanceof GeminiQuotaExceededError || err?.isQuotaExceeded) throw err;
            console.error(`Lỗi khi quét ảnh DT-QĐ #${qIdx + 1}:`, err);
            if (qdChunks.length === 1 && installmentChunks.length === 0 && workHoursChunks.length === 0 && preparedEmulationImages.length === 0) {
                throw err;
            }
        }
    }

    // =========================================================================
    // GIAI ĐOẠN 1B: TRÍCH XUẤT % TỶ TRỌNG TRẢ GÓP (ẢNH MẪU 3 - BÁO CÁO TRẢ CHẬM)
    // =========================================================================
    for (let rIdx = 0; rIdx < installmentChunks.length; rIdx++) {
        currentStep++;
        const chunk = installmentChunks[rIdx];
        const pct = Math.round((currentStep / (totalSteps + 1)) * 90);

        onProgress?.(
            `Đang trích xuất % Tỷ trọng trả góp (ảnh ${rIdx + 1}/${installmentFilesList.length})...`,
            pct
        );

        try {
            const instParsed = await callGeminiVisionJson(
                apiKey,
                buildInstallmentRateOcrPrompt(),
                chunk,
                60000,
                keySource,
                (msg) => onProgress?.(`% Tỷ trọng TG (ảnh ${rIdx + 1}): ${msg}`, pct)
            );

            if (instParsed.screenshotTimestamp && !detectedTimestamp) {
                detectedTimestamp = instParsed.screenshotTimestamp;
            }

            const instEmployees: any[] = Array.isArray(instParsed.employees) ? instParsed.employees : [];
            mergeInstallmentRateEmployees(instEmployees);
        } catch (err: any) {
            if (err instanceof GeminiQuotaExceededError || err?.isQuotaExceeded) throw err;
            console.error(`Lỗi khi quét ảnh % Tỷ trọng trả góp #${rIdx + 1}:`, err);
            if (installmentChunks.length === 1 && qdChunks.length === 0 && workHoursChunks.length === 0 && preparedEmulationImages.length === 0) {
                throw err;
            }
        }
    }

    // =========================================================================
    // GIAI ĐOẠN 1C: TRÍCH XUẤT GIỜ CÔNG NHÂN VIÊN (THEO GIỜ CÔNG)
    // =========================================================================
    for (let wIdx = 0; wIdx < workHoursChunks.length; wIdx++) {
        currentStep++;
        const chunk = workHoursChunks[wIdx];
        const pct = Math.round((currentStep / (totalSteps + 1)) * 90);

        onProgress?.(
            `Đang trích xuất Giờ công nhân viên (ảnh ${wIdx + 1}/${workHoursFilesList.length})...`,
            pct
        );

        try {
            const hoursParsed = await callGeminiVisionJson(
                apiKey,
                buildWorkHoursOcrPrompt(),
                chunk,
                60000,
                keySource,
                (msg) => onProgress?.(`Giờ công (ảnh ${wIdx + 1}): ${msg}`, pct)
            );

            if (hoursParsed.screenshotTimestamp && !detectedTimestamp) {
                detectedTimestamp = hoursParsed.screenshotTimestamp;
            }

            const hoursEmployees: any[] = Array.isArray(hoursParsed.employees) ? hoursParsed.employees : [];
            applyWorkHoursEntries(hoursEmployees, employeeMap, systemEmployees);
        } catch (err: any) {
            if (err instanceof GeminiQuotaExceededError || err?.isQuotaExceeded) throw err;
            console.error(`Lỗi khi quét ảnh Giờ công #${wIdx + 1}:`, err);
            if (workHoursChunks.length === 1 && qdChunks.length === 0 && installmentChunks.length === 0 && preparedEmulationImages.length === 0) {
                throw err;
            }
        }
    }

    // =========================================================================
    // GIAI ĐOẠN 2: TRÍCH XUẤT THI ĐUA (MỖI ẢNH 1 CALL RIÊNG BIỆT, CHẠY SONG SONG ĐỢT 3 ẢNH)
    // =========================================================================
    for (let bStart = 0; bStart < preparedEmulationImages.length; bStart += EMU_CONCURRENCY) {
        const batch = preparedEmulationImages.slice(bStart, bStart + EMU_CONCURRENCY);
        const fromImg = bStart + 1;
        const toImg = bStart + batch.length;
        currentStep += batch.length;
        const pct = Math.round((currentStep / (totalSteps + 1)) * 90);

        onProgress?.(
            `Đang trích xuất bảng thi đua (Ảnh ${fromImg}${toImg > fromImg ? ` - ${toImg}` : ''}/${emulationFiles.length})...`,
            pct
        );

        const batchResults = await Promise.all(
            batch.map(async (img, offset) => {
                try {
                    return await callGeminiVisionJson(
                        apiKey,
                        buildEmulationBatchPrompt(),
                        [img],
                        60000,
                        keySource
                    );
                } catch (err: any) {
                    if (err instanceof GeminiQuotaExceededError || err?.isQuotaExceeded) throw err;
                    console.warn(`Lỗi khi quét ảnh thi đua #${bStart + offset + 1}:`, err);
                    return null;
                }
            })
        );

        batchResults.forEach(emuParsed => {
            if (!emuParsed) return;
            if (emuParsed.screenshotTimestamp && !detectedTimestamp) {
                detectedTimestamp = emuParsed.screenshotTimestamp;
            }
            processEmulationChunkResult(
                emuParsed,
                employeeMap,
                systemEmployees,
                allCampaignTotals,
                detectedMappings,
                targetMappingOptions
            );
        });
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

    const EMU_CONCURRENCY = 3;
    const allCampaignTotals: Array<{ campaignName: string; totalValue: number }> = [];
    const detectedMappings = new Map<string, CampaignMappingItem>();

    for (let bStart = 0; bStart < preparedImages.length; bStart += EMU_CONCURRENCY) {
        const batch = preparedImages.slice(bStart, bStart + EMU_CONCURRENCY);
        const fromImg = bStart + 1;
        const toImg = bStart + batch.length;
        const pct = Math.round((toImg / (preparedImages.length + 1)) * 85);
        onProgress?.(`Đang quét thi đua bổ sung (Ảnh ${fromImg}${toImg > fromImg ? ` - ${toImg}` : ''}/${additionalFiles.length})...`, pct);

        const batchResults = await Promise.all(
            batch.map(async (img, offset) => {
                try {
                    return await callGeminiVisionJson(
                        apiKey,
                        buildEmulationBatchPrompt(),
                        [img],
                        60000,
                        keySource
                    );
                } catch (err: any) {
                    if (err instanceof GeminiQuotaExceededError || err?.isQuotaExceeded) throw err;
                    console.warn(`Lỗi khi quét ảnh bổ sung #${bStart + offset + 1}:`, err);
                    return null;
                }
            })
        );

        batchResults.forEach(emuParsed => {
            if (!emuParsed) return;
            processEmulationChunkResult(
                emuParsed,
                employeeMap,
                systemEmployees,
                allCampaignTotals,
                detectedMappings,
                targetMappingOptions
            );
        });
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
 * Trích xuất BỔ SUNG ảnh giờ công và hợp nhất vào danh sách nhân viên hiện tại
 */
export async function extractAdditionalWorkHoursImages(
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

    onProgress?.('Đang nén ảnh giờ công bổ sung...', 10);

    const employeeMap = new Map<string, EmployeeOcrParsedItem>();
    currentEmployees.forEach(e => {
        employeeMap.set(e.employeeId, {
            ...e,
            campaigns: { ...e.campaigns },
            campaignDetails: [...(e.campaignDetails || [])]
        });
    });

    let detectedTimestamp: string | undefined;
    for (let i = 0; i < additionalFiles.length; i++) {
        const pct = Math.round(((i + 1) / (additionalFiles.length + 1)) * 85);
        onProgress?.(`Đang quét giờ công bổ sung (${i + 1}/${additionalFiles.length})...`, pct);
        try {
            const prepared = await prepareImageForOcr(additionalFiles[i]);
            const hoursParsed = await callGeminiVisionJson(
                apiKey,
                buildWorkHoursOcrPrompt(),
                [prepared],
                60000,
                keySource
            );
            if (hoursParsed?.screenshotTimestamp && !detectedTimestamp) {
                detectedTimestamp = hoursParsed.screenshotTimestamp;
            }
            const hoursEmployees: any[] = Array.isArray(hoursParsed?.employees) ? hoursParsed.employees : [];
            applyWorkHoursEntries(hoursEmployees, employeeMap, systemEmployees);
        } catch (err: any) {
            if (err instanceof GeminiQuotaExceededError || err?.isQuotaExceeded) throw err;
            console.warn(`Lỗi khi quét ảnh giờ công bổ sung #${i + 1}:`, err);
            if (additionalFiles.length === 1) throw err;
        }
    }

    onProgress?.('Đã hợp nhất xong giờ công nhân viên!', 100);

    return {
        success: true,
        employees: Array.from(employeeMap.values()),
        screenshotTimestamp: detectedTimestamp
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
        revenue_actual: 0,
        installment_revenue: item.installmentQd,
        installment_rate: item.installmentRate,
        work_hours: Number(item.workHours) || 0,
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
        installmentQd: r.installment_revenue || 0,
        installmentRate: r.installment_rate || 0,
        workHours: Number(r.work_hours) || 0,
        campaigns: r.campaigns || {},
        campaignDetails: Object.entries(r.campaigns || {}).map(([cName, cVal]) => ({
            campaignName: cName,
            value: cVal
        }))
    }));
}
