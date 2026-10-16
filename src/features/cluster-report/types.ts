export interface ClusterStoreRow {
    id?: string;
    storeName: string;
    shortName: string;
    orderIndex: number;

    // === BẢNG 1: DỮ LIỆU CHUẨN CỦA HỆ THỐNG ===
    revenueActual: number;           // DT thực
    revenueQd: number;               // Lũy kế DTQĐ
    baseTarget: number;              // Target (Target chuẩn hệ thống)
    pctHtStandard: number;           // %HT chuẩn
    targetRemainingStandard: number; // Target còn lại
    forecastRevenueQd: number;       // DTQĐ Dự kiến
    pctDkhtStandard: number;         // %DKHT chuẩn
    pctQd: number;                   // %QĐ
    revenueInstallment: number;      // DT trả góp
    installmentRate: number;         // % Trả góp
    hasInstallmentRate?: boolean;    // Cờ đánh dấu có % trả góp hay không

    // === BẢNG 2: MỤC TIÊU VƯỢT TRỘI ===
    targetRate: number;              // % vượt trội (nhịp 100, 105, 110, 115, 120...)
    targetOver: number;              // Target vượt trội (baseTarget * targetRate / 100)
    pctHtOver: number;               // %HT vượt trội
    targetRemainingOver: number;     // Target còn lại vượt trội
    pctDkhtOver: number;             // %DKHT vượt trội
    targetDailyRemainingOver: number;// Target mỗi ngày còn lại

    // Khối TB 3 Tháng & phụ trợ
    avg3Months: number;              // TB 3 THÁNG
    pctGrowth: number;               // % TT (Tăng trưởng so với TB 3 tháng)

    // Metadata ngày
    reportDate?: string;
    passedDays: number;
    totalDays: number;
    remainingDays: number;
}

export interface ClusterSummaryData {
    // Bảng 1
    totalRevenueActual: number;
    totalRevenueQd: number;
    totalBaseTarget: number;
    avgPctHtStandard: number;
    totalTargetRemainingStandard: number;
    totalForecastRevenueQd: number;
    avgPctDkhtStandard: number;
    avgPctQd: number;
    totalRevenueInstallment: number;
    avgInstallmentRate: number;
    hasInstallmentRate?: boolean;

    // Bảng 2
    avgTargetRate: number;
    totalTargetOver: number;
    avgPctHtOver: number;
    totalTargetRemainingOver: number;
    avgPctDkhtOver: number;
    totalTargetDailyRemainingOver: number;

    // Khác
    totalAvg3Months: number;
    avgPctGrowth: number;
    storesCount: number;
}

export interface ClusterTargetConfigItem {
    storeName: string;
    month: number;
    year: number;
    baseTarget?: number;
    targetRate?: number;        // % Target riêng lẻ (100, 105, 110...)
    targetOver?: number;
    avg3Months?: number;
    revenueQdMultiplier?: number;
}

export interface ClusterAssessmentData {
    month: number;
    year: number;
    comment: string;
    highlights?: string[];
    actionItems?: string[];
    updatedAt?: string;
    updatedBy?: string;
}
