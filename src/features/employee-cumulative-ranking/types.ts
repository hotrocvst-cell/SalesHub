export type CumulativeRankingViewMode = 'CUMULATIVE_ONLY' | 'WITH_DAILY';

export type TargetSelectionMode = 'AUTO' | 'MONTH' | 'PERIOD';

export interface CumulativeRankingFilter {
    fromDate: string;
    toDate: string;
    store: string;
    viewMode: CumulativeRankingViewMode;
    showTarget: boolean;
    targetMode: TargetSelectionMode;
    searchQuery: string;
}

export interface PeriodTargetConfig {
    id: string; // Composite key dạng `${store_name}_${from_date}_${to_date}`
    periodTitle: string; // Tên đợt/giai đoạn (ví dụ: "Chiến dịch 7 ngày đầu tháng 10")
    storeName: string;
    fromDate: string; // YYYY-MM-DD
    toDate: string;   // YYYY-MM-DD
    storeTarget: number; // Target của cả siêu thị trong giai đoạn (Triệu đồng)
    targets: Record<string, number>; // { [employee_id]: target_in_million (Triệu đồng) }
    isCloudStored?: boolean; // True nếu đã lưu trên Supabase Cloud, False nếu chỉ có ở LocalStorage
    createdAt?: string;
    updatedAt?: string;
    updatedBy?: string;
}

export interface EmployeeCumulativeRankingRow {
    rank: number;
    employeeId: string;
    fullName: string;
    storeName: string;
    jobTitle?: string;
    target: number; // Target doanh thu của nhân viên trong kỳ (Triệu đồng)
    targetSource?: 'PERIOD' | 'MONTH' | 'NONE'; // Nguồn target: theo giai đoạn riêng hay theo tháng
    dailyRevenues: Record<string, number>; // { [YYYY-MM-DD]: number } (Triệu đồng)
    dailyQuantities: Record<string, number>; // { [YYYY-MM-DD]: number }
    cumulativeRevenue: number; // Tổng lũy kế doanh thu trong kỳ (Triệu đồng)
    cumulativeQty: number; // Tổng số lượng trong kỳ
    cumulativeInstallment: number; // Tổng trả góp trong kỳ (Triệu đồng)
    completionRate: number; // %HT = (cumulativeRevenue / target) * 100 (nếu target > 0)
    storeShareRate: number; // % Tỷ trọng đóng góp vào doanh thu siêu thị
    activeDaysCount: number; // Số ngày có phát sinh doanh thu
}

export interface StoreCumulativeSummary {
    storeName: string;
    fromDate: string;
    toDate: string;
    dateList: string[]; // Danh sách các ngày trong khoảng [fromDate .. toDate] (YYYY-MM-DD)
    
    // DỮ LIỆU LŨY KẾ CỐT LÕI CỦA SIÊU THỊ (KHÔNG PHẢI TỔNG CỘNG CÁC DÒNG NHÂN VIÊN)
    storeCumulativeRevenue: number; // Doanh thu lũy kế chốt của siêu thị trong kỳ (Triệu đồng)
    storeDailyRevenue: Record<string, number>; // Doanh thu từng ngày của siêu thị { [YYYY-MM-DD]: number } (Triệu đồng)
    storeTarget: number; // Target siêu thị trong kỳ (Triệu đồng)
    storeCompletionRate: number; // %HT của siêu thị
    targetSource?: 'PERIOD' | 'MONTH' | 'NONE';
    activePeriodTitle?: string; // Tên cấu hình giai đoạn nếu đang kích hoạt
    activePeriodConfig?: PeriodTargetConfig | null; // Cấu hình giai đoạn chi tiết
    isPeriodTargetCloudStored?: boolean; // Trạng thái lưu Cloud của cấu hình giai đoạn này
    
    // ĐỐI CHIẾU NHÂN SỰ
    totalEmployeesWithSales: number; // Số lượng nhân sự có doanh thu
    sumOfEmployeesCumulative: number; // Tổng doanh thu cộng dồn từ các dòng nhân viên (Triệu đồng)
    unassignedOrOnlineDiff: number; // storeCumulativeRevenue - sumOfEmployeesCumulative (Chênh lệch)
    
    top1Employee: {
        id: string;
        name: string;
        revenue: number;
        shareRate: number;
    } | null;
    avgRevenuePerEmployee: number; // Doanh thu trung bình mỗi nhân viên (Triệu đồng)
}
