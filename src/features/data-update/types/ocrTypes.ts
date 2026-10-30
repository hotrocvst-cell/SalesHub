export type OcrEngineType = 'GEMINI_FLASH' | 'TESSERACT_CLIENT';

export interface EmulationOcrItem {
    programName: string;
    unit: 'DOANH THU' | 'SỐ LƯỢNG' | string;
    actual: number;
    target: number;
    completionRate?: number;
    forecastRate?: number;
}

export interface StoreReportingData {
    storeCode?: string;
    storeRawName: string;
    storeShortName: string;
    
    // 1. Doanh thu quy đổi (DTQĐ)
    revenueQd: number;
    targetQd: number;
    quantityQd: number;
    completionRateQd?: number;
    forecastRateQd?: number;

    // 2. Doanh thu thực
    revenueReal: number;
    targetReal: number;
    quantityReal: number;
    installmentReal: number;
    installmentRateReal: number;
    avg3MonthsReal?: number;
    growthReal?: number;

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

