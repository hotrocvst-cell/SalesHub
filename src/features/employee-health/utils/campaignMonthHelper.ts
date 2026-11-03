import type { CampaignDictItem } from '../../../core/lib/storage';

/**
 * Trích xuất danh sách tháng áp dụng của chương trình thi đua dựa theo raw_key & display_name
 * Ví dụ:
 * - "T10 - SẠC DỰ PHÒNG" -> [10]
 * - "T11 - Sạc dự phòng" -> [11]
 * - "T09 - T10 IPHONE 18 series" -> [9, 10]
 * - "Tháng 11 - Tai nghe" -> [11]
 * - "T10-T12 Mùa Mua Sắm" -> [10, 11, 12]
 */
export function getCampaignApplicableMonths(rawKey: string, displayName?: string): number[] {
    const text = `${rawKey} ${displayName || ''}`.toUpperCase().trim();

    // 1. Dải tháng (Range): ví dụ T09 - T10, T10 - T11, THÁNG 9 - 10, T09-T10
    const rangeMatch = text.match(/(?:T|THÁNG\s*)0?(\d{1,2})\s*[-–—]\s*(?:T|THÁNG\s*)?0?(\d{1,2})/i);
    if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (!isNaN(start) && !isNaN(end) && start >= 1 && start <= 12 && end >= 1 && end <= 12) {
            const list: number[] = [];
            if (start <= end) {
                for (let m = start; m <= end; m++) list.push(m);
            } else {
                for (let m = start; m <= 12; m++) list.push(m);
                for (let m = 1; m <= end; m++) list.push(m);
            }
            return list;
        }
    }

    // 2. Mốc tháng đơn (Single): ví dụ T10 - ..., T11 - ..., Tháng 10 ..., Tháng 11 ...
    const singleMatch = text.match(/(?:^|\s|\b)T0?(\d{1,2})(?:\s*[-–—_:]|\s|$)/i) ||
                        text.match(/(?:^|\s|\b)THÁNG\s*0?(\d{1,2})(?:\s*[-–—_:]|\s|$)/i);
    if (singleMatch) {
        const m = parseInt(singleMatch[1], 10);
        if (!isNaN(m) && m >= 1 && m <= 12) {
            return [m];
        }
    }

    return [];
}

/**
 * Kiểm tra xem chương trình thi đua có thuộc tháng được chọn hay không:
 * 1. Thuộc tháng nếu tháng này đã có target giao cho nhân viên (raw_key có trong DB của tháng đó).
 * 2. Hoặc tên/mã chương trình mang tiền tố tháng đang chọn (ví dụ T11 cho tháng 11).
 * 3. Nếu chương trình là mục chung không ghi tháng, chỉ giữ lại nếu tháng đó không có mục chuyên biệt nào.
 */
export function isCampaignInSelectedMonth(
    campaign: CampaignDictItem,
    month: number,
    existingTargetKeys?: Set<string>
): boolean {
    if (!campaign) return false;

    // 1. Nếu tháng này đã có nhân viên được giao target cho raw_key này -> Chắc chắn thuộc tháng đó
    if (existingTargetKeys && existingTargetKeys.has(campaign.raw_key)) {
        return true;
    }

    // 2. Kiểm tra qua tiền tố / dải tháng của chương trình
    const months = getCampaignApplicableMonths(campaign.raw_key, campaign.display_name);
    if (months.length > 0) {
        return months.includes(month);
    }

    // 3. Nếu không mang tiền tố tháng nào -> Mặc định không nạp vào tháng có chương trình chuyên biệt
    return false;
}

/**
 * Lọc danh sách chương trình thi đua theo tháng được chọn
 */
export function filterCampaignsByMonth(
    campaigns: CampaignDictItem[],
    month: number,
    existingTargetKeys?: Set<string>
): CampaignDictItem[] {
    return campaigns.filter(c => isCampaignInSelectedMonth(c, month, existingTargetKeys));
}

