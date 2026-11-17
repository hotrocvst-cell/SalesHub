import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { BusinessDayRecord, CampaignDictItem } from '../../core/lib/storage';
import type { EmployeePerformanceRow, StorePerformanceSummary } from '../employee-performance/types';
import type { CampaignSummaryData } from '../campaign-summary/types';

export type BatchReportKey =
    | 'DAILY_REPORT'
    | 'EMPLOYEE_PERFORMANCE'
    | 'MONTHLY_REPORT'
    | 'CAMPAIGN_SUMMARY'
    | 'REVENUE_TREND';

export interface BatchReportItemConfig {
    key: BatchReportKey;
    name: string;
    shortName: string;
    description: string;
    iconName: string;
    exportFilePrefix: string;
    defaultChecked: boolean;
}

export interface BatchExportStepProgress {
    isExporting: boolean;
    currentIndex: number;
    totalCount: number;
    currentReportName: string;
    statusText: string;
}

export interface BatchReportCustomOptions {
    daily: {
        mode: 'realtime' | 'remaining';
        showTable: boolean;
    };
    employeePerformance: {
        showWorkHours: boolean;
        sortBy: 'forecast' | 'revenue_qd' | 'actual' | 'installment';
    };
    monthly: {
        viewMode: 'categories' | 'daily_pace';
    };
    campaign: {
        scoringMode: 'COUNT' | 'POINTS';
        applyOffsets: boolean;
    };
    revenueTrend: {
        showBarChart: boolean;
        showDetailTable: boolean;
    };
}

export interface ReportRemarkItem {
    key: BatchReportKey;
    title: string;
    content: string;
    description?: string;
}

export interface BatchReportStoreData {
    selectedStore: string;
    selectedDate: string;
    selectedMonth: number;
    selectedYear: number;
    dailyRecord: BusinessDayRecord | null;
    dailyLoading: boolean;
    performanceRows: EmployeePerformanceRow[];
    performanceSummary: StorePerformanceSummary | null;
    performanceLoading: boolean;
    monthlyRecords: BusinessDayRecord[];
    monthlyLoading: boolean;
    campaignSummary: CampaignSummaryData | null;
    campaignDict: CampaignDictItem[];
    campaignLoading: boolean;
    trendRecords: BusinessDayRecord[];
    trendLoading: boolean;
}
