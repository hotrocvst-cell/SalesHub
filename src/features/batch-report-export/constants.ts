import type { BatchReportItemConfig, BatchReportCustomOptions } from './types';

export const BATCH_REPORT_OPTIONS: BatchReportItemConfig[] = [
    {
        key: 'DAILY_REPORT',
        name: 'Báo Cáo Doanh Thu Ngày',
        shortName: 'BC Ngày',
        description: 'Doanh thu thực, DTQĐ, trả góp, %HT ngày và chi tiết ngành hàng của ST',
        iconName: 'Zap',
        exportFilePrefix: 'Bao_Cao_Ngay',
        defaultChecked: true
    },
    {
        key: 'EMPLOYEE_PERFORMANCE',
        name: 'Báo Cáo Hiệu Quả Nhân Viên',
        shortName: 'Hiệu Quả NV',
        description: 'Chi tiết DTQĐ, target cá nhân, %HT, xếp hạng vinh danh nhân sự tại ST',
        iconName: 'UserCheck',
        exportFilePrefix: 'Hieu_Qua_Nhan_Vien',
        defaultChecked: true
    },
    {
        key: 'MONTHLY_REPORT',
        name: 'Báo Cáo Doanh Thu Tháng',
        shortName: 'BC Tháng',
        description: 'Doanh thu lũy kế tháng, so sánh cùng kỳ, nhịp doanh thu còn lại của ST',
        iconName: 'CalendarDays',
        exportFilePrefix: 'Bao_Cao_Thang',
        defaultChecked: true
    },
    {
        key: 'CAMPAIGN_SUMMARY',
        name: 'Tổng Hợp Tiến Độ Thi Đua',
        shortName: 'Tiến Độ Thi Đua',
        description: 'Bảng ma trận %DKHT các nhóm thi đua trọng tâm của nhân viên ST',
        iconName: 'Trophy',
        exportFilePrefix: 'Tong_Hop_Thi_Dua',
        defaultChecked: true
    },
    {
        key: 'REVENUE_TREND',
        name: 'Nhịp Doanh Thu & Tăng Trưởng',
        shortName: 'Nhịp Doanh Thu',
        description: 'Biểu đồ nhịp doanh thu ngày và diễn biến tăng trưởng của ST',
        iconName: 'TrendingUp',
        exportFilePrefix: 'Nhip_Doanh_Thu',
        defaultChecked: false
    }
];

export const BATCH_EXPORT_PREFERENCE_KEY = 'saleshub_batch_export_checked_keys_v1';
export const BATCH_EXPORT_OPTIONS_PREFERENCE_KEY = 'saleshub_batch_export_custom_options_v1';

export const DEFAULT_CUSTOM_OPTIONS: BatchReportCustomOptions = {
    daily: {
        mode: 'realtime',
        showTable: true
    },
    employeePerformance: {
        showWorkHours: false,
        sortBy: 'forecast'
    },
    monthly: {
        viewMode: 'categories'
    },
    campaign: {
        scoringMode: 'COUNT',
        applyOffsets: true
    },
    revenueTrend: {
        showBarChart: true,
        showDetailTable: true
    }
};
