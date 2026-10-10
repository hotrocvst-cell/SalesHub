export type VoucherStatus = 'AVAILABLE' | 'CLAIMED' | 'USED' | 'EXPIRED';

export interface VoucherItem {
    id: string;
    store_name: string;                // Siêu thị sở hữu kho mã
    campaign_name: string;             // Tên chương trình (VD: "Đồng Hồ & Phụ Kiện", "Gia Dụng",...)
    denomination: number;              // Mệnh giá (VNĐ)
    code: string;                      // Mã voucher thực tế
    status: VoucherStatus;             // Trạng thái mã
    expires_at?: string;               // Thời hạn sử dụng (YYYY-MM-DD), mặc định ngày cuối tháng hiện tại
    created_at: string;
    created_by: string;                // Tên/Mã người nạp mã
    claimed_at?: string;               // Thời điểm cấp mã
    claimed_by_id?: string;            // Mã NV được cấp
    claimed_by_name?: string;          // Tên NV được cấp
    claimed_by_store?: string;         // Siêu thị của NV được cấp (khi lấy mã toàn cụm)
    order_id?: string;                 // Mã đơn hàng gắn kèm
    used_at?: string;                  // Thời điểm hoàn tất đơn
    note?: string;                     // Ghi chú / Lịch sử reset
    description?: string;              // Diễn giải / Điều kiện sử dụng voucher
}

export interface DenominationStock {
    denomination: number;
    total: number;
    available: number;
    claimed: number;
    used: number;
    description?: string;              // Điều kiện sử dụng của mệnh giá
}

export interface VoucherCampaignSummary {
    campaign_name: string;
    total_available: number;
    total_vouchers: number;
    denominations: DenominationStock[];
}

export interface VoucherStockForecast {
    campaign_name: string;
    denomination: number;
    description?: string;
    total: number;
    available: number;
    claimed: number;
    used: number;
    avgDailyUsage: number;             // Trung bình sử dụng / ngày
    daysRemaining: number;             // Số ngày còn lại dự kiến
    alertLevel: 'OUT_OF_STOCK' | 'CRITICAL' | 'WARNING' | 'SAFE' | 'INACTIVE';
    alertMessage: string;
}

export interface VoucherClaimRequest {
    store_name: string;
    accessible_stores?: string[];      // Danh sách siêu thị trong cụm được phân quyền
    campaign_name: string;
    denomination: number;
    order_id: string;
    employee_id: string;
    employee_name: string;
}

export interface VoucherHoardingAlert {
    employee_id: string;
    employee_name: string;
    store_name: string;
    claimed_today_count: number;       // Số mã đã lấy trong ngày
    unspent_count: number;             // Số mã đã lấy nhưng chưa hoàn tất
    total_month: number;               // Tổng số mã đã lấy trong tháng
    total_claimed_month?: number;      // Alias cho total_month
    latest_order_ids: string[];        // Các đơn hàng gần nhất
    latest_claimed_at: string;
    risk_level: 'NORMAL' | 'WARNING' | 'CRITICAL';
    reasons: string[];
}

export interface VoucherFilterOptions {
    storeName?: string;
    status?: string;
    campaignName?: string;
    denomination?: number;
    searchQuery?: string;
}

