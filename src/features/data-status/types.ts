export type DataStreamId =
    | 'store_revenue'
    | 'store_emulation'
    | 'employee_revenue'
    | 'employee_emulation'
    | 'employee_targets'
    | 'employee_work_hours';

export type StatusLevel = 'OK' | 'WARNING';

export interface DataStreamStatus {
    id: DataStreamId;
    title: string;
    shortTitle: string;
    category: 'store' | 'employee' | 'config';
    isOk: boolean;
    statusText: 'OK' | 'CẦN CẬP NHẬT' | 'CHẬM PHIÊN' | 'CHƯA CÓ DỮ LIỆU';
    expectedDate: string; // YYYY-MM-DD (ngày n-1)
    latestDataDate: string | null; // YYYY-MM-DD
    lastUpdatedAt: string | null; // ISO timestamp
    lastUpdatedBy?: string | null;
    recordCount: number;
    storeCoveredCount: number;
    totalStoreCount: number;
    coveragePercent: number;
    description: string;
    warningMessage?: string;
    actionUrl: string;
    actionLabel: string;
}

export interface StoreMatrixRow {
    storeName: string;
    storeCode?: string;
    storeRevenueOk: boolean;
    storeRevenueDate: string | null;
    storeEmulationOk: boolean;
    storeEmulationCount: number;
    employeeRevenueOk: boolean;
    employeeRevenueDate: string | null;
    employeeEmulationOk: boolean;
    employeeEmulationCount: number;
    employeeTargetsOk: boolean;
    employeeTargetsCount: number;
    workHoursOk: boolean;
    workHoursTotal?: number;
    readinessScore: number; // 0 - 100
    allOk: boolean;
}

export interface OverallReadinessSummary {
    totalStreams: number;
    okStreams: number;
    warningStreams: number;
    readinessPercent: number;
    todayDate: string; // Ngày n
    expectedDate: string; // Ngày n-1
    totalStores: number;
    fullyReadyStores: number;
}
