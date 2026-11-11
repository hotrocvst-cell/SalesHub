export type OcrEngineType = 'GEMINI_FLASH';

export type EmulationUploadMode = 'CLUSTER' | 'SINGLE_STORE';

export interface SingleStoreEmulationEntry {
    storeName: string;
    files: File[];
}

export interface EmulationOcrItem {
    programName: string;
    unit: 'DOANH THU' | 'SỐ LƯỢNG' | string;
    actual: number;
    target: number;
    completionRate?: number;
    forecastRate?: number;
}

export interface StoreMobileEmulationCardItem {
    programName: string;
    unit: 'DT' | 'SL' | string;
    actual: number;
    target: number;
    completionRate: number;
    forecastRate?: number;
    forecastValue?: number;
}

export interface StoreReportingData {
    storeCode?: string;
    storeRawName: string;
    storeShortName: string;

    // 1. Doanh thu quy đổi (Ảnh 1 - Doanh thu hợp nhất)
    revenueQd: number;          // Doanh thu QĐ (triệu đồng)
    installmentQd: number;      // DT Trả góp QĐ (triệu đồng)
    targetQd: number;           // Target (triệu đồng)
    avg3Months: number;         // TB 3 Tháng (triệu đồng)
    pctGrowth: number;          // % TT Doanh thu (%)
    quantityQd?: number;
    completionRateQd?: number;
    forecastRateQd?: number;

    // 2. Tỷ trọng trả góp (Ảnh 2 - Báo cáo trả chậm)
    installmentRate: number;    // % Tỷ trọng trả góp (%)

    // 3. Thi đua lũy kế (Tên chương trình -> Chi tiết)
    emulations: Record<string, EmulationOcrItem>;
}

export interface OcrExtractionResult {
    success: boolean;
    reportDate?: string;
    reportTime?: string;
    stores: StoreReportingData[];
    errors?: string[];
    rawLogs?: string;
}

