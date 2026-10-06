export interface EmployeeCampaignProgressDetail {
    employeeId: string;
    fullName: string;
    displayName: string;
    storeName: string;
    target: number;
    actual: number;
    remaining: number;
    completionRate: number; // %HT thực tế hiện tại
    forecastRate: number;   // %DKHT dự kiến hoàn thành
    isAchieved: boolean;    // forecastRate >= 100%
    isTargetMet: boolean;   // actual >= target
}

export interface CampaignProgressItem {
    campaignKey: string;
    displayName: string;
    unit: string;
    orderIndex: number;
    totalTarget: number;
    totalActual: number;
    totalRemaining: number;
    completionRate: number; // %HT thực tế
    forecastRate: number;   // %DKHT dự kiến hoàn thành
    isAchieved: boolean;    // forecastRate >= 100%
    totalEmployees: number; // Số NV được giao target
    achievedEmployees: number; // Số NV dự kiến đạt target
    unachievedEmployees: number; // Số NV dự kiến chưa đạt target
    employeeAchieveRate: number; // % NV đạt = achievedEmployees / totalEmployees * 100
    employees: EmployeeCampaignProgressDetail[];
}

export type QuickFilterMode = 'ALL' | 'NOT_ACHIEVED' | 'ACHIEVED';

export type SortMode = 'FORECAST_ASC' | 'FORECAST_DESC' | 'NAME_ASC' | 'TARGET_DESC' | 'GAP_DESC';

export interface CampaignOverallMetrics {
    totalCampaigns: number;
    achievedCampaigns: number;
    notAchievedCampaigns: number;
    avgForecastRate: number;
    totalAssignedEmployees: number;
}
