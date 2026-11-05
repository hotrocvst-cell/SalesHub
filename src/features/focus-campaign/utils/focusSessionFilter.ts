import type { BusinessDayRecord, StoreItem, EmployeeItem } from '../../../core/lib/storage';
import type { EmployeeDataSession, EmployeeSessionRecord } from '../../employee-cumulative/utils/sessionStorage';
import { isStoreMatch } from '../../../core/lib/formatters';
import { isEmployeeInStore } from '../../campaign-summary/utils/campaignSummaryStorage';

export function getAvailableSessions(
    sessions: EmployeeDataSession[],
    selectedStore: string,
    stores: StoreItem[]
): EmployeeDataSession[] {
    if (!sessions || sessions.length === 0) return [];
    if (selectedStore === 'all') return sessions;
    return sessions.filter(s => isStoreMatch(s.store_name, selectedStore, stores));
}

export function getMatchedBusinessRecords(
    businessRecords: BusinessDayRecord[],
    activeSession: EmployeeDataSession | undefined,
    selectedStore: string,
    stores: StoreItem[]
): BusinessDayRecord[] {
    if (!businessRecords.length) return [];
    const reportDateStr = activeSession?.report_date || '';

    if (selectedStore === 'all') {
        let onDate = businessRecords.filter(r => r.reportDate === reportDateStr);
        if (!onDate.length && businessRecords.length > 0) {
            const latestDate = businessRecords[businessRecords.length - 1].reportDate;
            onDate = businessRecords.filter(r => r.reportDate === latestDate);
        }
        return onDate.filter(r => !/^(tổng|tong)/i.test(r.storeName));
    }

    const storeRecs = businessRecords.filter(r => isStoreMatch(r.storeName, selectedStore, stores));
    if (!storeRecs.length) return [];
    const exactDate = storeRecs.find(r => r.reportDate === reportDateStr);
    if (exactDate) return [exactDate];
    return [storeRecs[storeRecs.length - 1]];
}

export function getFilteredSessionRecords(
    activeSession: EmployeeDataSession | undefined,
    selectedStore: string,
    employees: EmployeeItem[],
    stores: StoreItem[]
): EmployeeSessionRecord[] {
    const rawRecs = activeSession?.records || [];
    if (selectedStore === 'all') return rawRecs;

    const empStoreMap: Record<string, string> = {};
    employees.forEach(e => {
        const id = (e.employee_id || '').trim();
        if (id) empStoreMap[id] = e.store_name || '';
    });

    return rawRecs.filter(r => {
        const empId = (r.employee_id || '').trim();
        if (!empId) return false;
        return isEmployeeInStore(empId, selectedStore, empStoreMap, activeSession?.store_name, stores);
    });
}

