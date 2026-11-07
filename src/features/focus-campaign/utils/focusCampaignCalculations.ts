import type {
    FocusStoreCampaignMetric,
    FocusEmployeeRow,
    FocusEmployeeCampaignDetail
} from '../types';
import type { BusinessDayRecord, CampaignDictItem } from '../../../core/lib/storage';
import type { EmployeeSessionRecord } from '../../employee-cumulative/utils/sessionStorage';
import type { CampaignOffsetItem } from '../../campaign-offset/services/campaignOffsetService';
import { resolveCanonicalCampaign, normalizeCampaignToken } from '../../campaign-summary/utils/campaignSummaryStorage';
import { getShortenedEmployeeName } from '../../employee-performance/utils/performanceConfig';

export { generateFocusSmartRemarks } from './focusRemarkGenerator';

/**
 * Trích xuất tiền tố tháng của một chuỗi thi đua (ví dụ: T11, T10, T09...)
 */
export function extractCampaignMonth(str: string): number | null {
    if (!str) return null;
    const match = str.match(/^T(\d{1,2})\s*[-_]/i);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Tìm dictItem tương ứng chuẩn xác cho cKey trong campaignDict:
 * 1. Khớp chính xác raw_key
 * 2. Khớp chính xác display_name
 * 3. Nếu cKey có tiền tố tháng (T11, T10...), ưu tiên tìm trong các item có CÙNG tiền tố tháng
 * 4. Đối chiếu token chuẩn hóa nhưng TUYỆT ĐỐI không để nhầm sang tháng khác
 */
export function findMatchingDictItem(cKey: string, campaignDict: CampaignDictItem[]): CampaignDictItem | undefined {
    if (!cKey || !campaignDict || campaignDict.length === 0) return undefined;

    // 1. Khớp tuyệt đối raw_key
    const exactRaw = campaignDict.find(d => d.raw_key === cKey);
    if (exactRaw) return exactRaw;

    // 2. Khớp tuyệt đối display_name
    const exactDisplay = campaignDict.find(d => d.display_name === cKey || d.display_name.toLowerCase() === cKey.toLowerCase());
    if (exactDisplay) return exactDisplay;

    const cMonth = extractCampaignMonth(cKey);
    const cToken = normalizeCampaignToken(cKey);

    // 3. Nếu có tiền tố tháng, ưu tiên tìm trong các item CÙNG tháng
    if (cMonth !== null) {
        const sameMonthItems = campaignDict.filter(d => {
            const dMonth = extractCampaignMonth(d.raw_key) ?? extractCampaignMonth(d.display_name);
            return dMonth === cMonth;
        });

        const matchSame = sameMonthItems.find(d =>
            normalizeCampaignToken(d.raw_key) === cToken ||
            normalizeCampaignToken(d.display_name) === cToken
        );
        if (matchSame) return matchSame;
    }

    // 4. Nếu không có tiền tố tháng hoặc không tìm thấy cùng tháng, chỉ tìm trong các item KHÔNG bị gắn tháng khác
    return campaignDict.find(d => {
        const dMonth = extractCampaignMonth(d.raw_key) ?? extractCampaignMonth(d.display_name);
        if (cMonth !== null && dMonth !== null && cMonth !== dMonth) return false;
        return normalizeCampaignToken(d.raw_key) === cToken ||
               normalizeCampaignToken(d.display_name) === cToken;
    });
}

/**
 * Kiểm tra xem một raw key có khớp với canonical key hoặc dictItem hay không
 */
function isKeyMatchingCampaign(rawKey: string, cKey: string, dictItem?: CampaignDictItem, campaignDict: CampaignDictItem[] = []): boolean {
    if (!rawKey || !cKey) return false;
    if (rawKey === cKey) return true;

    // QUY TẮC BẢO VỆ TIỀN TỐ THÁNG:
    // Nếu cả hai đều có tiền tố tháng (ví dụ: T10 vs T11) mà khác nhau thì TUYỆT ĐỐI KHÔNG ĐƯỢC KHỚP
    const rMonth = extractCampaignMonth(rawKey);
    const cMonth = extractCampaignMonth(cKey);
    const dMonth = dictItem ? (extractCampaignMonth(dictItem.raw_key) ?? extractCampaignMonth(dictItem.display_name)) : null;

    if (rMonth !== null && cMonth !== null && rMonth !== cMonth) return false;
    if (rMonth !== null && dMonth !== null && rMonth !== dMonth) return false;

    if (dictItem) {
        if (dictItem.raw_key === rawKey) return true;
        if (dictItem.display_name === rawKey) return true;
        if (dictItem.display_name.toLowerCase() === rawKey.toLowerCase()) return true;
    }

    const rToken = normalizeCampaignToken(rawKey);
    const cToken = normalizeCampaignToken(cKey);
    if (rToken && cToken && rToken === cToken) {
        if (rMonth === null || cMonth === null || rMonth === cMonth) return true;
    }

    if (dictItem) {
        if (normalizeCampaignToken(dictItem.raw_key) === rToken) return true;
        if (normalizeCampaignToken(dictItem.display_name) === rToken) return true;
    }

    const res = resolveCanonicalCampaign(rawKey, campaignDict);
    if (res.canonicalKey === cKey) return true;
    if (dictItem && res.canonicalKey === dictItem.raw_key) return true;

    return false;
}

/**
 * Tính toán số liệu lũy kế cấp ST trực tiếp từ emulationSummary của BusinessDayRecord
 * TUYỆT ĐỐI KHÔNG TÍNH TỔNG TỪ NHÂN VIÊN
 */
export function calculateStoreCampaignMetrics(
    campaignKeys: string[],
    campaignDict: CampaignDictItem[],
    matchedBusinessRecords: BusinessDayRecord[],
    passedDays: number,
    operatingDays: number,
    employeeRows: FocusEmployeeRow[]
): FocusStoreCampaignMetric[] {
    return campaignKeys.map((cKey, idx) => {
        const dictItem = findMatchingDictItem(cKey, campaignDict);
        const displayName = dictItem?.display_name || cKey;
        const unit = dictItem?.unit || 'Cái';
        const orderIndex = dictItem?.order_index ?? dictItem?.sort_order ?? idx;

        let sumTarget = 0;
        let sumActual = 0;
        let hasData = false;

        matchedBusinessRecords.forEach(br => {
            if (br.emulationSummary) {
                for (const [rawKey, emu] of Object.entries(br.emulationSummary)) {
                    if (isKeyMatchingCampaign(rawKey, cKey, dictItem, campaignDict)) {
                        sumTarget += Number(emu.target) || 0;
                        sumActual += Number(emu.actual) || 0;
                        hasData = true;
                        break;
                    }
                }
            }
        });

        const storeTarget = hasData ? Number(sumTarget.toFixed(1)) : 0;
        const storeActual = hasData ? Number(sumActual.toFixed(1)) : 0;
        const storeRemaining = Math.max(0, Number((storeTarget - storeActual).toFixed(1)));

        let forecastRate = 0;
        if (storeTarget > 0 && passedDays > 0) {
            forecastRate = Math.round(((storeActual / passedDays) * operatingDays) / storeTarget * 100);
        }

        let completionRate = 0;
        if (storeTarget > 0) {
            completionRate = Math.round((storeActual / storeTarget) * 100);
        }

        const empsWithTarget = employeeRows.filter(r => r.campaignMetrics[cKey]?.hasTarget);
        const achievedEmps = empsWithTarget.filter(r => r.campaignMetrics[cKey]?.isAchieved).length;
        const actualMetEmps = empsWithTarget.filter(r => r.campaignMetrics[cKey]?.isTargetMet).length;
        const employeeAchieveRate = empsWithTarget.length > 0
            ? Math.round((achievedEmps / empsWithTarget.length) * 100)
            : 0;

        return {
            campaignKey: cKey,
            displayName,
            unit,
            orderIndex,
            storeTarget,
            storeActual,
            storeRemaining,
            completionRate,
            forecastRate,
            isAchieved: forecastRate >= 100,
            totalEmployeesWithTarget: empsWithTarget.length,
            achievedEmployees: achievedEmps,
            actualMetEmployees: actualMetEmps,
            employeeAchieveRate
        };
    });
}

/**
 * Xây dựng bảng số liệu từng nhân viên cho các nhóm hàng thi đua được chọn
 */
export function buildFocusEmployeeRows(
    records: EmployeeSessionRecord[],
    targetsMap: Record<string, Record<string, number>>,
    campaignKeys: string[],
    campaignDict: CampaignDictItem[],
    passedDays: number,
    operatingDays: number,
    campaignOffsets: CampaignOffsetItem[] = []
): FocusEmployeeRow[] {
    const totalNH = campaignKeys.length;
    if (totalNH === 0) return [];

    // Chỉ giữ lại các nhân viên có ít nhất 1 target thi đua > 0 trong kỳ
    const validRecords = records.filter(r => {
        const empId = (r.employee_id || '').trim();
        if (!empId) return false;
        const empTargets = targetsMap[empId];
        if (!empTargets) return false;
        return Object.values(empTargets).some(v => Number(v) > 0);
    });

    return validRecords.map(r => {
        const empId = (r.employee_id || '').trim();
        const fullName = r.full_name || '';
        const shortName = r.short_name || getShortenedEmployeeName(fullName);
        const displayName = `${empId} - ${fullName}`;
        const storeName = r.store_name || '';
        const empTargets = targetsMap[empId] || {};

        const campaignMetrics: Record<string, FocusEmployeeCampaignDetail> = {};
        let actualAchievedCount = 0;
        let forecastAchievedCount = 0;

        campaignKeys.forEach(cKey => {
            const dictItem = findMatchingDictItem(cKey, campaignDict);

            // 1. Tìm Target chuẩn xác qua mapping
            let target = 0;
            for (const [rawK, rawV] of Object.entries(empTargets)) {
                const val = Number(rawV) || 0;
                if (val > 0 && isKeyMatchingCampaign(rawK, cKey, dictItem, campaignDict)) {
                    target = val;
                    break;
                }
            }

            // 2. Tìm Actual từ session records
            let actual = 0;
            if (r.campaigns) {
                for (const [rawK, rawV] of Object.entries(r.campaigns)) {
                    const val = Number(rawV) || 0;
                    if (isKeyMatchingCampaign(rawK, cKey, dictItem, campaignDict)) {
                        actual = val;
                        break;
                    }
                }
            }

            // 3. Tính Cấn trừ thi đua nếu có
            let offsetIn = 0;
            let offsetOut = 0;
            campaignOffsets.forEach(o => {
                if (o.employee_id.trim() === empId) {
                    const toKey = (o.to_campaign_key || '').trim();
                    const fromKey = (o.from_campaign_key || '').trim();
                    if (isKeyMatchingCampaign(toKey, cKey, dictItem, campaignDict)) {
                        offsetIn += Number(o.offset_quantity) || 0;
                    }
                    if (isKeyMatchingCampaign(fromKey, cKey, dictItem, campaignDict)) {
                        offsetOut += Number(o.offset_quantity) || 0;
                    }
                }
            });

            const offsetAdjustment = offsetIn - offsetOut;
            const finalActual = Math.max(0, actual + offsetAdjustment);

            const hasTarget = target > 0;
            const remaining = Math.max(0, target - finalActual);
            const completionRate = hasTarget ? Math.round((finalActual / target) * 100) : 0;
            let forecastRate = 0;
            if (hasTarget && passedDays > 0) {
                forecastRate = Math.round(((finalActual / passedDays) * operatingDays) / target * 100);
            }

            const isAchieved = hasTarget ? forecastRate >= 100 : (finalActual > 0);
            const isTargetMet = hasTarget ? finalActual >= target : (finalActual > 0);

            if (isTargetMet) actualAchievedCount++;
            if (isAchieved) forecastAchievedCount++;

            campaignMetrics[cKey] = {
                campaignKey: cKey,
                target,
                actual: finalActual,
                rawActual: actual,
                offsetAdjustment,
                remaining,
                completionRate,
                forecastRate,
                isAchieved,
                isTargetMet,
                hasTarget
            };
        });

        const achievementRate = totalNH > 0 ? Math.round((forecastAchievedCount / totalNH) * 100) : 0;

        return {
            employeeId: empId,
            fullName,
            shortName,
            displayName,
            storeName,
            campaignMetrics,
            actualAchievedCount,
            forecastAchievedCount,
            totalTrackedNH: totalNH,
            achievementRate
        };
    }).sort((a, b) => b.forecastAchievedCount - a.forecastAchievedCount || b.actualAchievedCount - a.actualAchievedCount);
}
