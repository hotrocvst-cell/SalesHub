export interface CampaignSummaryRow {
    stt: number;
    employee_id: string;
    full_name: string;
    display_name: string; // Ví dụ: "12803 - NGUYỄN THỊ NHẬN"
    store_name?: string;
    achieved_count: number; // Số ngành hàng đạt (>= 100%) ví dụ 15
    total_count: number;    // Tổng số ngành hàng xét, ví dụ 39
    achievement_rate: number; // Tỷ lệ % đạt (15/39 = 38.5%)
    campaign_rates: Record<string, number>; // { [categoryName]: percentageNumber (e.g. 76, 145, 0) }
}

export interface CampaignSummaryData {
    report_date: string;       // "2026-09-26"
    date_display: string;      // "26-09-2026"
    mode_label: string;        // "DỰ KIẾN" | "CHÍNH THỨC"
    store_name: string;        // Siêu thị hoặc "Toàn Cụm Siêu Thị"
    total_categories: number;  // ví dụ 39
    categories: string[];      // Danh sách tên các ngành hàng thi đua
    rows: CampaignSummaryRow[];
    created_at: string;
    updated_at: string;
    notes?: string;
}

export interface SmartRemarkAnalysis {
    topEmployees: { name: string; achieved: string; rate: number }[];
    bottomEmployees: { name: string; achieved: string; rate: number }[];
    bestCategories: { name: string; passRate: number; passedCount: number }[];
    weakCategories: { name: string; zeroCount: number; under50Count: number }[];
    recommendedZaloText: string;
}
