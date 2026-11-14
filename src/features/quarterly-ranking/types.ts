export type QuarterPreset = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'H1' | 'H2' | 'YEAR' | 'CUSTOM';

export type QuarterlyTab = 'REVENUE' | 'EMULATION';

export type SortField =
    | 'REVENUE_RANK'
    | 'EMULATION_RANK'
    | 'NAME'
    | 'STORE'
    | 'REVENUE_QD'
    | 'TARGET'
    | 'COMPLETION_RATE'
    | 'CONSISTENCY';

export type FilterCategory = 'ALL' | 'TOP' | 'BOT' | 'ACHIEVED' | 'UNACHIEVED';

export interface QuarterlyFilterOptions {
    store: string;
    year: number;
    preset: QuarterPreset;
    startMonth: number;
    endMonth: number;
    searchQuery: string;
    tab: QuarterlyTab;
    filterCategory: FilterCategory;
}

export interface MonthlyRevenueDetail {
    month: number;
    monthLabel: string; // "T1", "T2", ...
    revenueQd: number; // Triệu đồng
    revenueActual: number; // Triệu đồng
    targetRevenue: number; // Triệu đồng
    completionRate: number; // %
    isAchieved: boolean;
}

export interface MonthlyEmulationDetail {
    month: number;
    monthLabel: string; // "T10", "T11", ...
    achievedCount: number; // Số mục tiêu đã đạt trong tháng
    targetCount: number; // Tổng mục tiêu giao trong tháng
    completionRate: number; // % (achievedCount / targetCount * 100)
    isAchieved: boolean; // Đạt >= 100% mục tiêu của tháng
}

export interface MonthlyCampaignDetail {
    month: number;
    monthLabel: string;
    targetValue: number;
    actualValue: number;
    rate: number;
    isAchieved: boolean;
}

export interface CampaignSummaryDetail {
    rawKey: string;
    displayName: string;
    unit: string;
    totalTarget: number;
    totalActual: number;
    completionRate: number;
    isAchieved: boolean;
    byMonth: Record<number, MonthlyCampaignDetail>;
}

export interface QuarterlyEmployeeRow {
    employee_id: string;
    full_name: string;
    short_name: string;
    store_name: string;
    job_title: string;

    // Doanh thu quy đổi lũy kế Quý / Kỳ
    total_revenue_qd: number; // Triệu đồng
    total_revenue_actual: number; // Triệu đồng
    total_target_revenue: number; // Triệu đồng
    completion_rate: number; // %
    revenue_rank: number;
    top_bot_status: 'TOP' | 'BOT' | 'MID';

    // Phong độ giữ chuẩn doanh thu (số tháng đạt target trong kỳ)
    months_achieved_count: number;
    total_months_count: number;
    consistency_rate: number; // %
    consistency_label: string; // ví dụ: "3/3 T"
    month_details: MonthlyRevenueDetail[];

    // Thi đua lũy kế Quý / Kỳ (tính theo tổng đã đạt / tổng mục tiêu, không đo theo CT cụ thể)
    total_emulation_achieved: number; // Tổng đã đạt
    total_emulation_target: number; // Tổng mục tiêu
    emulation_points_achieved: number;
    emulation_points_total: number;
    emulation_campaigns_achieved: number; // Alias tổng đã đạt
    emulation_campaigns_total: number; // Alias tổng mục tiêu
    emulation_rate: number; // % = (total_emulation_achieved / total_emulation_target) * 100
    emulation_rank: number;
    emulation_top_bot_status: 'TOP' | 'BOT' | 'MID';
    emulation_months_achieved_count: number;
    emulation_consistency_label: string; // ví dụ: "3/3 T"
    emulation_month_details: MonthlyEmulationDetail[];
    campaigns: Record<string, CampaignSummaryDetail>;
}

export interface QuarterlySummary {
    totalEmployees: number;
    totalRevenueQd: number;
    totalRevenueActual: number;
    totalTargetRevenue: number;
    avgCompletionRate: number;
    achievedTargetCount: number;
    achievedTargetPercent: number;
    consistentAchieverCount: number; // Đạt 100% tất cả các tháng
    topRevenueCount: number;
    botRevenueCount: number;
    top1RevenueEmployee: {
        id: string;
        name: string;
        store: string;
        revenue: number;
        rate: number;
    } | null;

    // Thi đua (tính theo tổng đã đạt / tổng mục tiêu, chuẩn >= 60%)
    avgEmulationRate: number;
    totalCampaignsAchieved: number; // Tổng đã đạt toàn kỳ
    totalCampaignsTracked: number; // Tổng mục tiêu toàn kỳ
    fullyAchievedEmulationCount: number; // Số NV đạt >= 100% thi đua
    consistentEmulationCount: number; // Số NV đạt chuẩn >= 60% tất cả các tháng
    top1EmulationEmployee: {
        id: string;
        name: string;
        store: string;
        points: number; // Số đã đạt
        target?: number; // Mục tiêu
        rate: number;
    } | null;
}
