import type { EmployeeOcrParsedItem } from './geminiEmployeeOcrService';
import type { EmployeeDataSession, EmployeeSessionRecord } from '../../employee-cumulative/utils/sessionStorage';
import type { EmployeeItem } from '../../../core/lib/storage';

export interface PartialOcrFlags {
    hasQd: boolean;
    hasInstallment: boolean;
    hasEmulation: boolean;
    hasWorkHours: boolean;
}

/**
 * Hợp nhất dữ liệu OCR mới quét (có thể chỉ gồm 1 phần như chỉ Giờ công hoặc chỉ DTQĐ)
 * với dữ liệu của phiên đã có cùng ngày/ST để không làm mất hoặc ghi 0 lên các cột chưa quét lại.
 */
export function mergeOcrItemsWithExistingSessions(
    ocrItems: EmployeeOcrParsedItem[],
    existingRevSession: EmployeeDataSession | null,
    existingHoursSession: EmployeeDataSession | null,
    flags: PartialOcrFlags,
    storeEmployees: EmployeeItem[] = []
): { mergedItems: EmployeeOcrParsedItem[]; hydratedFromExisting: boolean } {
    if (!existingRevSession && !existingHoursSession) {
        return { mergedItems: ocrItems, hydratedFromExisting: false };
    }

    const baseRecordMap = new Map<string, EmployeeSessionRecord>();

    // Nạp trước phiên WORK_HOURS (nếu có)
    (existingHoursSession?.records || []).forEach(rec => {
        const key = String(rec.employee_id || '').trim().toLowerCase();
        if (key) {
            baseRecordMap.set(key, { ...rec });
        }
    });

    // Chồng tiếp phiên REVENUE_CAMPAIGN (giữ work_hours từ WORK_HOURS nếu phiên doanh thu = 0)
    (existingRevSession?.records || []).forEach(rec => {
        const key = String(rec.employee_id || '').trim().toLowerCase();
        if (!key) return;
        const prev = baseRecordMap.get(key);
        const mergedHours = (Number(rec.work_hours) || 0) > 0
            ? Number(rec.work_hours)
            : (Number(prev?.work_hours) || 0);
        baseRecordMap.set(key, {
            ...rec,
            work_hours: mergedHours
        });
    });

    if (baseRecordMap.size === 0) {
        return { mergedItems: ocrItems, hydratedFromExisting: false };
    }

    let hydratedFromExisting = false;
    const seenIds = new Set<string>();

    const mergedItems: EmployeeOcrParsedItem[] = ocrItems.map(item => {
        const rawId = String(item.employeeId || '').trim();
        const isUnmapped = Boolean(item.isUnmappedName) || rawId.startsWith('UNMAPPED::');
        const key = rawId.toLowerCase();

        if (isUnmapped || !key) {
            return item;
        }

        seenIds.add(key);
        const base = baseRecordMap.get(key);
        if (!base) {
            return item;
        }

        const nextItem: EmployeeOcrParsedItem = {
            ...item,
            campaigns: { ...(item.campaigns || {}) },
            campaignDetails: [...(item.campaignDetails || [])]
        };

        if (!flags.hasQd && (Number(nextItem.revenueQd) || 0) === 0 && (Number(base.revenue_qd) || 0) !== 0) {
            nextItem.revenueQd = Number(base.revenue_qd) || 0;
            hydratedFromExisting = true;
        }

        if (!flags.hasQd && (Number(nextItem.installmentQd) || 0) === 0 && (Number(base.installment_revenue) || 0) !== 0) {
            nextItem.installmentQd = Number(base.installment_revenue) || 0;
            hydratedFromExisting = true;
        }

        if (!flags.hasInstallment && (Number(nextItem.installmentRate) || 0) === 0 && (Number(base.installment_rate) || 0) !== 0) {
            nextItem.installmentRate = Number(base.installment_rate) || 0;
            hydratedFromExisting = true;
        }

        if (
            !flags.hasEmulation &&
            Object.keys(nextItem.campaigns || {}).length === 0 &&
            base.campaigns &&
            Object.keys(base.campaigns).length > 0
        ) {
            nextItem.campaigns = { ...base.campaigns };
            nextItem.campaignDetails = Object.entries(base.campaigns).map(([campaignName, value]) => ({
                campaignName,
                value
            }));
            hydratedFromExisting = true;
        }

        if (!flags.hasWorkHours && (Number(nextItem.workHours) || 0) === 0 && (Number(base.work_hours) || 0) > 0) {
            nextItem.workHours = Number(base.work_hours) || 0;
            hydratedFromExisting = true;
        }

        return nextItem;
    });

    // Nếu đang quét bổ sung khi đã có phiên REVENUE_CAMPAIGN trước đó, giữ lại nhân sự cũ chưa có trong lô ảnh mới
    const isPartialUpdateOnRev = Boolean(
        existingRevSession &&
        (!flags.hasQd || !flags.hasInstallment || !flags.hasEmulation || !flags.hasWorkHours)
    );

    if (isPartialUpdateOnRev && existingRevSession?.records) {
        const allowedEmpIds = storeEmployees.length > 0
            ? new Set(storeEmployees.map(e => String(e.employee_id || '').trim().toLowerCase()))
            : null;
        const officialNameMap = new Map(
            storeEmployees.map(e => [String(e.employee_id || '').trim().toLowerCase(), e.full_name?.trim() || ''])
        );

        existingRevSession.records.forEach(rec => {
            const rawId = String(rec.employee_id || '').trim();
            const key = rawId.toLowerCase();
            if (!key || seenIds.has(key)) return;
            if (allowedEmpIds && !allowedEmpIds.has(key)) return;

            const mergedBase = baseRecordMap.get(key) || rec;
            mergedItems.push({
                employeeId: rawId,
                fullName: officialNameMap.get(key) || mergedBase.full_name,
                revenueQd: mergedBase.revenue_qd || 0,
                installmentQd: mergedBase.installment_revenue || 0,
                installmentRate: mergedBase.installment_rate || 0,
                workHours: mergedBase.work_hours || 0,
                campaigns: { ...(mergedBase.campaigns || {}) },
                campaignDetails: Object.entries(mergedBase.campaigns || {}).map(([campaignName, value]) => ({
                    campaignName,
                    value
                }))
            });
            seenIds.add(key);
            hydratedFromExisting = true;
        });
    }

    return { mergedItems, hydratedFromExisting };
}

