export type CampaignGroup = 'ICT' | 'CE' | 'Dịch vụ' | 'Phụ kiện' | 'Gia dụng' | 'Khác' | string;
export type CampaignOrientation = 'Chính' | 'Phụ' | 'Bán kèm' | 'Trọng tâm';
export type CampaignCalculationMethod = 'Doanh thu' | 'DTQĐ' | 'Số lượng' | 'SLQĐ';
export type ProductStatusType = 'Mới' | 'Cũ' | 'Tất cả (All)' | 'Đổi trả';

export interface CampaignProgramItem {
    id: string;
    group_name: CampaignGroup;          // Nhóm thi đua (ICT, CE, Dịch vụ...)
    program_name: string;                // Chương trình thi đua
    orientation: CampaignOrientation;    // Định hướng (Chính, Phụ, Bán kèm)
    calculation_method: CampaignCalculationMethod; // Cách tính (Doanh thu, DTQĐ, Số lượng, SLQĐ)
    rules: string;                       // Thể lệ (điều kiện đạt, cách tính điểm/thưởng)
    product_status: ProductStatusType;   // Trạng thái sản phẩm (mới, cũ, all...)
    opportunity?: string;                // Cơ hội (CTKM) nếu có
    target_period?: string;              // Kỳ áp dụng (ví dụ: Tháng 10/2026, Q4/2026)
    start_date?: string;                 // Ngày bắt đầu (YYYY-MM-DD)
    end_date?: string;                   // Ngày kết thúc (YYYY-MM-DD)
    order_index?: number;
    is_active: boolean;                  // Đang chạy hay đã kết thúc
    created_at?: string;
    updated_at?: string;
    created_by?: string;
}

export type ViewMode = 'CARD' | 'TABLE';
export type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
