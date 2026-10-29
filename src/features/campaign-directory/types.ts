export type CampaignGroup = 'ICT' | 'CE' | 'Dịch vụ' | 'Phụ kiện' | 'Gia dụng' | 'Khác' | string;
export type CampaignOrientation = 'Chính' | 'Phụ' | 'Bán kèm' | 'Trọng tâm';
export type CampaignCalculationMethod = 'Doanh thu' | 'DTQĐ' | 'Số lượng' | 'SLQĐ';

export const CAMPAIGN_PRODUCT_STATUS_OPTIONS = [
    'Mới',
    'Mới (Giảm giá)',
    'Đã sử dụng',
    'Trưng Bày (Bỏ mẫu)'
] as const;

export type CampaignProductStatusOption = typeof CAMPAIGN_PRODUCT_STATUS_OPTIONS[number];

export type ProductStatusType =
    | 'All trạng thái'
    | CampaignProductStatusOption
    | 'Tất cả (All)'
    | 'Cũ'
    | 'Đổi trả'
    | string;

/**
 * Phân tích chuỗi product_status thành mảng các lựa chọn checkbox
 */
export function parseProductStatusToCheckboxes(raw?: string): string[] {
    if (!raw) return [...CAMPAIGN_PRODUCT_STATUS_OPTIONS];
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();

    // Nếu là All hoặc Tất cả hoặc chuỗi rỗng -> chọn toàn bộ
    if (
        lower === 'all trạng thái' ||
        lower === 'all' ||
        lower === 'tất cả (all)' ||
        lower === 'tất cả' ||
        lower === ''
    ) {
        return [...CAMPAIGN_PRODUCT_STATUS_OPTIONS];
    }

    const parts = trimmed.split(',').map(p => p.trim());
    const matched: string[] = [];

    // Khớp chính xác từng phần tử theo chuỗi phân cách dấu phẩy
    CAMPAIGN_PRODUCT_STATUS_OPTIONS.forEach(opt => {
        if (parts.includes(opt)) {
            matched.push(opt);
        }
    });

    if (matched.length > 0) {
        return matched;
    }

    // Khớp từ khóa dự phòng cho dữ liệu cũ hoặc dán từ nguồn ngoài
    if (lower.includes('giảm giá') || lower.includes('giam gia')) {
        matched.push('Mới (Giảm giá)');
    }
    if (lower.includes('trưng bày') || lower.includes('trung bay') || lower.includes('bỏ mẫu') || lower.includes('bo mau')) {
        matched.push('Trưng Bày (Bỏ mẫu)');
    }
    if (lower.includes('đã sử dụng') || lower.includes('da su dung') || lower.includes('cũ') || lower.includes('cu') || lower.includes('đổi trả') || lower.includes('doi tra')) {
        matched.push('Đã sử dụng');
    }
    if (lower.includes('mới') || lower.includes('moi')) {
        if (!lower.includes('giảm giá') || lower.includes('mới,') || lower.includes(', mới') || lower === 'mới') {
            if (!matched.includes('Mới')) {
                matched.push('Mới');
            }
        }
    }

    return matched.length > 0 ? matched : [...CAMPAIGN_PRODUCT_STATUS_OPTIONS];
}

/**
 * Định dạng mảng các lựa chọn thành chuỗi lưu trữ chuẩn
 */
export function formatSelectedProductStatuses(selected: string[]): string {
    if (selected.length === 0 || selected.length === CAMPAIGN_PRODUCT_STATUS_OPTIONS.length) {
        return 'All trạng thái';
    }
    return CAMPAIGN_PRODUCT_STATUS_OPTIONS
        .filter(opt => selected.includes(opt))
        .join(', ');
}

export interface CampaignProgramItem {
    id: string;
    group_name: CampaignGroup;          // Nhóm thi đua (ICT, CE, Dịch vụ...)
    program_name: string;                // Chương trình thi đua
    short_name?: string;                 // Tên viết tắt / hiển thị theo cấu hình admin (từ điển thi đua)
    mapped_key?: string;                 // Tên chương trình theo dữ liệu nhập (raw_key trong campaign_dictionary)
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
