export interface EmployeePerformanceRow {
    rank: number;
    employee_id: string;
    full_name: string;
    short_name: string;                  // Tên rút gọn: 2 chữ cuối (nếu kế cuối là Thị thì chỉ lấy tên)
    store_name: string;
    job_title: string;
    revenue_target: number;              // Target DTQĐ (triệu đồng)
    revenue_actual: number;              // Lũy kế DT Thực (triệu đồng)
    revenue_qd: number;                  // Lũy kế DTQĐ (triệu đồng)
    completion_rate: number;             // %HT (real): (rev_qd / target) * 100
    forecast_completion_rate: number;    // %DKHT (Dự báo): ((rev_qd / passedDays * totalDays) / target) * 100
    exchange_rate: number;               // %Quy đổi: ((rev_qd - rev_actual) / rev_actual) * 100
    work_hours: number;                  // Giờ công (h)
    productivity_qd_per_hour: number;    // DTQĐ/GC: rev_qd / work_hours (triệu / giờ)
    productivity_actual_per_hour: number;// DT Thực / Giờ công (triệu / giờ)
    installment_revenue: number;         // Doanh thu trả chậm / trả góp (triệu đồng)
    installment_rate: number;            // % Trả chậm: (installment_revenue / rev_actual) * 100
    order_quantity: number;              // Số lượng đơn hàng
    top_bot_status: 'TOP' | 'BOT' | 'MID'; // Phân loại TOP/BOT
    top_bot_label: string;               // Nhãn hiển thị ví dụ "🏆 TOP 20%" hoặc "⚠️ BOT 20%"
    pace_status: 'EXCEED' | 'ON_TRACK' | 'SLOW' | 'CRITICAL'; // Đánh giá nhịp độ
}

export interface StorePerformanceSummary {
    topRevenueEmp: EmployeePerformanceRow | null;       // 👑 Top 1 Doanh Thu Quy Đổi
    topProductivityEmp: EmployeePerformanceRow | null;  // ⚡ Top 1 Năng Suất DTQĐ/GC
    topForecastEmp: EmployeePerformanceRow | null;      // 🎯 Top 1 %DKHT Dự Báo Về Đích
    topInstallmentEmp: EmployeePerformanceRow | null;   // 💳 Top 1 Doanh Thu Trả Chậm
    topCount: number;
    botCount: number;
    midCount: number;
    totalEmployees: number;
}
