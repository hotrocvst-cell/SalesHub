export interface CampaignWatchlist {
    id: string;
    list_name: string;
    description?: string;
    store_name: string; // 'ALL' hoặc mã/tên ST cụ thể
    month: number;
    year: number;
    campaign_keys: string[]; // Mảng canonical keys hoặc tên ngành hàng thi đua
    is_default?: boolean;
    order_index?: number;
    created_at?: string;
    updated_at?: string;
    created_by?: string;
}

export interface FocusStoreCampaignMetric {
    campaignKey: string;
    displayName: string;
    unit: string;
    orderIndex: number;
    storeTarget: number;
    storeActual: number;
    storeRemaining: number;
    completionRate: number; // %HT thực tế của ST
    forecastRate: number;   // %DK dự kiến hoàn thành của ST
    isAchieved: boolean;
    totalEmployeesWithTarget: number;
    achievedEmployees: number; // Số NV dự kiến đạt (forecastRate >= 100%)
    actualMetEmployees: number; // Số NV đã đạt thực tế (actual >= target)
    employeeAchieveRate: number; // % NV đạt
}

export interface FocusEmployeeCampaignDetail {
    campaignKey: string;
    target: number;
    actual: number;
    rawActual: number;
    offsetAdjustment: number;
    remaining: number;
    completionRate: number;
    forecastRate: number;
    isAchieved: boolean;  // forecastRate >= 100%
    isTargetMet: boolean; // actual >= target
    hasTarget: boolean;   // target > 0
}

export interface FocusEmployeeRow {
    employeeId: string;
    fullName: string;
    shortName: string;
    displayName: string;
    storeName: string;
    campaignMetrics: Record<string, FocusEmployeeCampaignDetail>;
    actualAchievedCount: number;    // Số NH thực tế đã đạt (actual >= target)
    forecastAchievedCount: number;  // Số NH dự kiến đạt (forecastRate >= 100%)
    totalTrackedNH: number;         // Tổng số NH được giao target hoặc trong watchlist
    achievementRate: number;        // (forecastAchievedCount / totalTrackedNH) * 100
}

export interface SmartRemarkAnalysis {
    totalEmployees: number;
    topPerformers: { name: string; achievedText: string; rate: number }[];
    moderatePerformers: { name: string; achievedText: string; rate: number }[];
    needSupportPerformers: { name: string; achievedText: string; rate: number }[];
    zeroPerformers: { name: string; achievedText: string; rate: number }[];
    bestCampaigns: { name: string; passRate: number; passedCount: number }[];
    weakCampaigns: { name: string; storePctDK: number }[];
    recommendedSummaryText: string;
}

export type QuickFilterEmployeeMode = 'ALL' | 'NOT_ACHIEVED' | 'ACHIEVED' | 'ALL_PASS';
export type TableViewMode = 'FULL' | 'FORECAST_ONLY' | 'ACTUAL_ONLY';

