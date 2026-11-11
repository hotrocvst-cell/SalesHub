import type { EmployeeItem, StoreItem } from '../../../core/lib/storage';
import { cleanEmployeeName, cleanBiNumber, isStoreMatch } from '../../../core/lib/formatters';
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
import {
    cleanBiPercent,
    normalizeViName,
    buildRevenueQdOcrPrompt,
    buildInstallmentRateOcrPrompt,
    findMatchedCandidateByName,
    findDirectoryEmployeeByName
} from '../../data-update/services/employeeOcrShared';

export interface DailyEmployeeOcrRecord extends ParsedEmployeeRevenue {
    mappingSource?: 'ID' | 'NAME_EXACT' | 'NAME_FUZZY' | 'UNMAPPED';
    ocrSourceName?: string;
    isUnmappedName?: boolean;
}

/**
 * Tách chuỗi "HH:mm:ss DD/MM/YYYY" hoặc "HH:mm:ss D/M/YYYY" thành reportTime và reportDate (YYYY-MM-DD)
 */
function parseScreenshotTimestamp(ts: unknown): { reportTime?: string; reportDate?: string; raw?: string } {
    if (!ts || typeof ts !== 'string') return {};
    const trimmed = ts.trim();
    if (!trimmed) return {};
    const timeMatch = trimmed.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    const dateMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const reportTime = timeMatch ? timeMatch[1] : undefined;
    let reportDate: string | undefined;
    if (dateMatch) {
        const dd = dateMatch[1].padStart(2, '0');
        const mm = dateMatch[2].padStart(2, '0');
        const yyyy = dateMatch[3];
        reportDate = `${yyyy}-${mm}-${dd}`;
    }
    return { reportTime, reportDate, raw: trimmed };
}

/**
 * Gọi Gemini Vision API hỗ trợ truyền 1 hoặc nhiều ảnh cùng lúc trong 1 request
 * (Timeout 45s, chuẩn hóa model Google và tự động chuyển Key dự phòng khi gặp HTTP 429)
 */
async function callGeminiVisionImages(
    apiKey: string,
    images: PreparedImage[],
    prompt: string,
    keySource: GeminiKeySource = 'ADMIN',
    timeoutMs: number = 45000
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
                console.warn(`⚠️ Key [${maskApiKey(currentKey)}] hết hạn ngạch. Tự động chuyển sang Key dự phòng #${kIdx + 2}...`);
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
 * Chuẩn hóa danh sách ảnh theo lô để tránh payload quá nặng gây timeout khi chụp nhiều màn hình cuộn
 */
function chunkArray<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}

/**
 * Bóc tách & hợp nhất ảnh báo cáo ngày nhân viên (KHÔNG còn DT Thực, KHÔNG có Thi đua):
 * 1. Nhóm ảnh "1. Doanh Thu QĐ" ("Doanh thu hợp nhất" chế độ Lưới): DOANH THU QĐ, DT TRẢ GÓP QĐ, SỐ LƯỢNG (nếu có)
 * 2. Nhóm ảnh "2. % Tỷ Trọng Trả Góp" ("Báo cáo trả chậm"): % Tỷ trọng trả chậm, tự đối chiếu Mã NV theo tên
 */
export async function extractDailyEmployeeRevenueImagesBatch(
    apiKey: string,
    options: {
        qdFiles: File[];
        installmentFiles: File[];
        selectedStore?: string;
        storesList?: StoreItem[];
    },
    employeesDirectory: EmployeeItem[] = [],
    onProgress?: (msg: string, percent: number) => void,
    keySource: GeminiKeySource = 'ADMIN'
): Promise<{
    success: boolean;
    reportDate?: string;
    reportTime?: string;
    screenshotTimestamp?: string;
    records: DailyEmployeeOcrRecord[];
    errors?: string[];
}> {
    const { qdFiles = [], installmentFiles = [], selectedStore = 'all', storesList = [] } = options;
    const totalFiles = qdFiles.length + installmentFiles.length;

    if (totalFiles === 0) {
        return { success: false, records: [], errors: ['Chưa chọn ảnh nào để trích xuất!'] };
    }

    onProgress?.('Đang nén và tối ưu hóa hình ảnh qua Canvas...', 10);

    const [preparedQd, preparedInstallment] = await Promise.all([
        Promise.all(qdFiles.map(f => prepareImageForOcr(f))),
        Promise.all(installmentFiles.map(f => prepareImageForOcr(f)))
    ]);

    // Ưu tiên danh bạ nhân sự thuộc ST đang chọn khi đối chiếu theo tên (tránh trùng tên giữa các ST)
    const activeDirectory = selectedStore && selectedStore !== 'all'
        ? employeesDirectory.filter(e => isStoreMatch(e.store_name, selectedStore, storesList))
        : employeesDirectory;
    const directoryForNameMatch = activeDirectory.length > 0 ? activeDirectory : employeesDirectory;

    const dictById = new Map<string, EmployeeItem>();
    employeesDirectory.forEach(emp => {
        const cleanId = String(emp.employee_id || '').trim();
        if (cleanId) dictById.set(cleanId, emp);
    });

    const empMap = new Map<string, {
        employeeId: string;
        fullName: string;
        quantity: number;
        revenueQd: number;
        installmentQd: number;
        installmentRate: number;
        loanQd: number;
        returnQd: number;
        hasExplicitReturnQd: boolean;
        mappingSource: 'ID' | 'NAME_EXACT' | 'NAME_FUZZY' | 'UNMAPPED';
        ocrSourceName?: string;
        isUnmappedName?: boolean;
    }>();

    let detectedTimestamp = '';
    let detectedDate = '';
    let detectedTime = '';
    const errors: string[] = [];

    const captureTimestamp = (ts: unknown) => {
        const parsedTs = parseScreenshotTimestamp(ts);
        if (parsedTs.raw && !detectedTimestamp) detectedTimestamp = parsedTs.raw;
        if (parsedTs.reportDate && !detectedDate) detectedDate = parsedTs.reportDate;
        if (parsedTs.reportTime && !detectedTime) detectedTime = parsedTs.reportTime;
    };

    onProgress?.(`Đang bóc tách ${totalFiles} ảnh bằng Gemini Vision...`, 35);

    // Bước 1: Quét nhóm ảnh Doanh Thu QĐ (chia lô 4 ảnh nếu nhiều ảnh cuộn)
    if (preparedQd.length > 0) {
        const qdChunks = chunkArray(preparedQd, 4);
        for (let i = 0; i < qdChunks.length; i++) {
            try {
                onProgress?.(
                    qdChunks.length > 1
                        ? `Đang đọc nhóm Doanh thu QĐ (đợt ${i + 1}/${qdChunks.length})...`
                        : 'Đang bóc tách Doanh thu QĐ & DT Trả góp QĐ...',
                    40 + Math.round((i / Math.max(1, qdChunks.length)) * 25)
                );

                const parsed = await callGeminiVisionImages(
                    apiKey,
                    qdChunks[i],
                    buildRevenueQdOcrPrompt({ includeDailyColumns: true }),
                    keySource
                );
                captureTimestamp(parsed?.screenshotTimestamp);

                const rawRows: any[] = Array.isArray(parsed?.employees) ? parsed.employees : [];
                rawRows.forEach((r: any) => {
                    const empId = String(r.employeeId || r.id || '').replace(/\D/g, '').trim();
                    const rawName = String(r.fullName || r.rawName || r.name || '')
                        .replace(/^\+\s*/, '')
                        .replace(/^\d+\s*-\s*/, '')
                        .trim();

                    if (!empId || empId.length < 3 || rawName.toLowerCase().includes('online - 18001060')) {
                        return;
                    }

                    const dictMatch = dictById.get(empId);
                    const officialName = dictMatch?.full_name?.trim() || cleanEmployeeName(rawName) || rawName || `Nhân viên ${empId}`;

                    const hasRevQd = r.revenueQd !== null && r.revenueQd !== undefined && r.revenueQd !== '';
                    const rawInstQd = r.installmentQd ?? r.dtTraGopQd;
                    const hasInstQd = rawInstQd !== null && rawInstQd !== undefined && rawInstQd !== '';
                    const hasQty = r.quantity !== null && r.quantity !== undefined && r.quantity !== '';
                    const hasLoan = r.loanQd !== null && r.loanQd !== undefined && r.loanQd !== '';
                    const hasRet = r.returnQd !== null && r.returnQd !== undefined && r.returnQd !== '';

                    const qdVal = hasRevQd ? cleanBiNumber(r.revenueQd) : null;
                    const instVal = hasInstQd ? cleanBiNumber(rawInstQd) : null;
                    const qtyVal = hasQty ? cleanBiNumber(r.quantity) : null;
                    const loanVal = hasLoan ? cleanBiNumber(r.loanQd) : null;
                    const retVal = hasRet ? cleanBiNumber(r.returnQd) : null;

                    const existing = empMap.get(empId);
                    if (existing) {
                        if (qdVal !== null && (qdVal !== 0 || existing.revenueQd === 0)) {
                            existing.revenueQd = qdVal;
                        }
                        if (instVal !== null && (instVal !== 0 || existing.installmentQd === 0)) {
                            existing.installmentQd = instVal;
                        }
                        if (qtyVal !== null && (qtyVal !== 0 || existing.quantity === 0)) {
                            existing.quantity = qtyVal;
                        }
                        if (loanVal !== null && (loanVal !== 0 || existing.loanQd === 0)) {
                            existing.loanQd = loanVal;
                        }
                        if (retVal !== null && (retVal !== 0 || !existing.hasExplicitReturnQd)) {
                            existing.returnQd = retVal;
                            existing.hasExplicitReturnQd = true;
                        }
                        if (!dictMatch && officialName.length > existing.fullName.length && !officialName.includes('...')) {
                            existing.fullName = officialName;
                        }
                    } else {
                        empMap.set(empId, {
                            employeeId: empId,
                            fullName: officialName,
                            quantity: qtyVal ?? 0,
                            revenueQd: qdVal ?? 0,
                            installmentQd: instVal ?? 0,
                            installmentRate: 0,
                            loanQd: loanVal ?? 0,
                            returnQd: retVal ?? 0,
                            hasExplicitReturnQd: retVal !== null,
                            mappingSource: 'ID',
                            isUnmappedName: false
                        });
                    }
                });
            } catch (err: any) {
                if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
                errors.push(`Lỗi đọc ảnh Doanh thu QĐ: ${err?.message || 'Không rõ lỗi'}`);
            }
        }
    }

    // Bước 2: Quét nhóm ảnh % Tỷ trọng trả góp ("Báo cáo trả chậm") và đối chiếu theo Họ tên
    if (preparedInstallment.length > 0) {
        const instChunks = chunkArray(preparedInstallment, 3);
        for (let i = 0; i < instChunks.length; i++) {
            try {
                onProgress?.(
                    instChunks.length > 1
                        ? `Đang đọc % Tỷ trọng trả góp (đợt ${i + 1}/${instChunks.length})...`
                        : 'Đang đọc % Tỷ trọng trả góp từ Báo cáo trả chậm...',
                    70 + Math.round((i / Math.max(1, instChunks.length)) * 20)
                );

                const parsed = await callGeminiVisionImages(
                    apiKey,
                    instChunks[i],
                    buildInstallmentRateOcrPrompt(),
                    keySource
                );
                captureTimestamp(parsed?.screenshotTimestamp);

                const instRows: any[] = Array.isArray(parsed?.employees) ? parsed.employees : [];
                instRows.forEach((r: any) => {
                    const rawId = r.employeeId ? String(r.employeeId).replace(/\D/g, '').trim() : '';
                    const rawName = String(r.fullName || r.name || '').trim();
                    if (!rawId && !rawName) return;
                    if (
                        rawId.toLowerCase() === 'online' ||
                        rawName.toLowerCase().includes('online - 18001060') ||
                        /^(tổng|tong)$/i.test(rawName)
                    ) {
                        return;
                    }

                    const rateVal = cleanBiPercent(r.installmentRate);

                    // 1. Có sẵn Mã NV
                    if (rawId && rawId.length >= 3) {
                        const existing = empMap.get(rawId);
                        if (existing) {
                            existing.installmentRate = rateVal;
                        } else {
                            const dictEmp = dictById.get(rawId);
                            empMap.set(rawId, {
                                employeeId: rawId,
                                fullName: dictEmp?.full_name?.trim() || cleanEmployeeName(rawName) || rawName,
                                quantity: 0,
                                revenueQd: 0,
                                installmentQd: 0,
                                installmentRate: rateVal,
                                loanQd: 0,
                                returnQd: 0,
                                hasExplicitReturnQd: false,
                                mappingSource: 'ID',
                                isUnmappedName: false
                            });
                        }
                        return;
                    }

                    // 2. Không có Mã NV -> Tìm theo tên trong các dòng DTQĐ vừa đọc
                    const mapCandidates = Array.from(empMap.values()).map(v => ({
                        employeeId: v.employeeId,
                        fullName: v.fullName,
                        isUnmappedName: v.isUnmappedName
                    }));
                    const inMapMatch = findMatchedCandidateByName(rawName, mapCandidates);
                    if (inMapMatch) {
                        const target = empMap.get(inMapMatch.item.employeeId);
                        if (target) {
                            target.installmentRate = rateVal;
                            target.ocrSourceName = target.ocrSourceName || rawName;
                            if (target.mappingSource === 'UNMAPPED') {
                                target.mappingSource = inMapMatch.mode;
                            }
                            return;
                        }
                    }

                    // 3. Đối chiếu danh bạ nhân sự ST
                    const dictMatch = findDirectoryEmployeeByName(rawName, directoryForNameMatch);
                    if (dictMatch?.emp?.employee_id) {
                        const dictId = String(dictMatch.emp.employee_id).trim();
                        const existingById = empMap.get(dictId);
                        if (existingById) {
                            existingById.installmentRate = rateVal;
                            existingById.ocrSourceName = existingById.ocrSourceName || rawName;
                        } else {
                            empMap.set(dictId, {
                                employeeId: dictId,
                                fullName: dictMatch.emp.full_name?.trim() || rawName,
                                quantity: 0,
                                revenueQd: 0,
                                installmentQd: 0,
                                installmentRate: rateVal,
                                loanQd: 0,
                                returnQd: 0,
                                hasExplicitReturnQd: false,
                                mappingSource: dictMatch.mode,
                                ocrSourceName: rawName,
                                isUnmappedName: false
                            });
                        }
                        return;
                    }

                    // 4. Chưa khớp được Mã NV -> giữ lại dòng UNMAPPED để user rà soát chọn Mã NV
                    const unmappedKey = `UNMAPPED::${normalizeViName(rawName, true) || rawName}`;
                    const existingUnmapped = empMap.get(unmappedKey);
                    if (existingUnmapped) {
                        existingUnmapped.installmentRate = rateVal;
                    } else {
                        empMap.set(unmappedKey, {
                            employeeId: unmappedKey,
                            fullName: rawName,
                            quantity: 0,
                            revenueQd: 0,
                            installmentQd: 0,
                            installmentRate: rateVal,
                            loanQd: 0,
                            returnQd: 0,
                            hasExplicitReturnQd: false,
                            mappingSource: 'UNMAPPED',
                            ocrSourceName: rawName,
                            isUnmappedName: true
                        });
                    }
                });
            } catch (err: any) {
                if (err?.isQuotaExceeded || err instanceof GeminiQuotaExceededError) throw err;
                errors.push(`Lỗi đọc ảnh % Tỷ trọng trả góp: ${err?.message || 'Không rõ lỗi'}`);
            }
        }
    }

    onProgress?.('Đang chuẩn hóa và hoàn tất đối chiếu nhân sự...', 95);

    const records: DailyEmployeeOcrRecord[] = Array.from(empMap.values()).map(item => {
        const returnQd = item.hasExplicitReturnQd
            ? item.returnQd
            : (item.revenueQd < 0 ? Math.abs(item.revenueQd) : 0);

        return {
            employee_id: item.employeeId,
            full_name: item.fullName,
            quantity: item.quantity,
            revenue_qd: item.revenueQd,
            revenue_actual: 0, // Người dùng không còn quyền xem DT Thực
            installment_revenue: item.installmentQd,
            installment_rate: item.installmentRate,
            revenue_return_qd: returnQd,
            revenue_loan_qd: item.loanQd,
            mappingSource: item.mappingSource,
            ocrSourceName: item.ocrSourceName,
            isUnmappedName: item.isUnmappedName
        };
    });

    // Đưa các dòng chưa khớp Mã NV lên đầu danh sách để dễ rà soát, sau đó sắp xếp theo DTQĐ giảm dần
    records.sort((a, b) => {
        if (Boolean(a.isUnmappedName) !== Boolean(b.isUnmappedName)) {
            return a.isUnmappedName ? -1 : 1;
        }
        return b.revenue_qd - a.revenue_qd || b.installment_rate - a.installment_rate;
    });

    onProgress?.('Hoàn tất trích xuất!', 100);

    return {
        success: records.length > 0,
        reportDate: detectedDate || undefined,
        reportTime: detectedTime || undefined,
        screenshotTimestamp: detectedTimestamp || undefined,
        records,
        errors: errors.length > 0 ? errors : undefined
    };
}
