import { ALLOWED_STORES, CAMPAIGN_CONFIG } from '../config/constants';

// Định dạng số hiển thị (Ví dụ: 17,803 hoặc 157.78)
export function formatValue(num: number | null | undefined): string {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Rút gọn tên siêu thị hiển thị trên giao diện
export function getShortStoreName(name: string): string {
    if (!name) return "Tổng";
    const trimmed = name.trim();
    if (trimmed.toUpperCase().startsWith("TỔNG") || trimmed.toUpperCase().startsWith("TONG")) return "Tổng";

    const cleaned = trimmed.replace(/^\d+\s*-\s*/, '');
    if (cleaned.includes(' - ')) {
        const p = cleaned.split(' - ');
        const prefix = p[0].trim();
        const addr = p.slice(1).join(' - ').trim();
        const chain = prefix.split('_')[0] || prefix;
        return `${chain} - ${addr}`;
    }
    return cleaned;
}

// Chuẩn hóa tên siêu thị để kiểm tra quyền
export function cleanStoreNameForAuth(name: string): string {
    if (!name) return '';
    return name.trim().replace(/^\d+\s*-\s*/, '').trim();
}

// Kiểm tra quyền siêu thị
export function isStoreAuthorized(name: string): boolean {
    if (!name) return true;
    const cleaned = cleanStoreNameForAuth(name);
    if (/^(tổng|tong)/i.test(cleaned)) return true;

    return ALLOWED_STORES.some(allowed => {
        const normClean = cleaned.toLowerCase().replace(/\s+/g, ' ');
        const normAllowed = allowed.toLowerCase().replace(/\s+/g, ' ');
        return normClean === normAllowed || normClean.includes(normAllowed);
    });
}

/**
 * So sánh chính xác 2 tên siêu thị có cùng là một siêu thị hay không
 * Ngăn chặn tuyệt đối việc nhầm lẫn giữa các siêu thị có cùng số nhà/địa chỉ (ví dụ: AAR và TGD cùng tại 290 Trương Công Định)
 */
export function isStoreMatch(
    storeNameA: string | undefined | null,
    storeNameB: string | undefined | null,
    storesList?: Array<{ code?: string; name: string; id?: string }>
): boolean {
    if (!storeNameA || !storeNameB) return false;
    const a = storeNameA.trim();
    const b = storeNameB.trim();
    if (a.toLowerCase() === b.toLowerCase()) return true;

    // Kiểm tra 'all' hoặc 'Toàn Cụm'
    const isAllA = a === 'all' || a.toLowerCase().includes('toàn cụm');
    const isAllB = b === 'all' || b.toLowerCase().includes('toàn cụm');
    if (isAllA || isAllB) {
        return isAllA && isAllB;
    }

    // Nếu có danh sách stores từ DB, đối chiếu chính xác theo store code/id
    if (storesList && storesList.length > 0) {
        const objA = storesList.find(s => s.name === a || (s.code && (a.startsWith(s.code) || a.includes(`(${s.code})`))));
        const objB = storesList.find(s => s.name === b || (s.code && (b.startsWith(s.code) || b.includes(`(${s.code})`))));
        if (objA && objB) {
            return Boolean((objA.id && objA.id === objB.id) || (objA.code && objA.code === objB.code));
        }
        if (objA && !objB) {
            if (objA.code && (b.startsWith(objA.code) || b.includes(`(${objA.code})`))) return true;
        }
        if (objB && !objA) {
            if (objB.code && (a.startsWith(objB.code) || a.includes(`(${objB.code})`))) return true;
        }
    }

    // Đối chiếu theo brand/prefix (ví dụ: AAR_BRV_VTA vs TGD_BRV_VTA)
    const prefixA = a.split(' - ')[0]?.trim().toLowerCase();
    const prefixB = b.split(' - ')[0]?.trim().toLowerCase();
    if (prefixA && prefixB && prefixA !== prefixB) {
        return false;
    }

    if (getShortStoreName(a).toLowerCase() === getShortStoreName(b).toLowerCase()) {
        return true;
    }

    return false;
}


// Lấy ngày hôm qua chuẩn định dạng YYYY-MM-DD (xử lý chính xác cả ngày đầu tháng và năm mới)
export function getYesterdayDateString(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Định dạng ngày tháng hiển thị theo chuẩn Việt Nam: dd/mm/yyyy hoặc dd/mm
 * Hỗ trợ nhận vào:
 * - Chuỗi 'YYYY-MM-DD' hoặc 'YYYY/MM/DD' (tránh triệt để lỗi lệch múi giờ UTC)
 * - Chuỗi ISO 8601
 * - Đối tượng Date
 * - Timestamp số
 */
export function formatDate(
    input: string | Date | number | null | undefined,
    format: 'dd/mm/yyyy' | 'dd/mm' = 'dd/mm/yyyy'
): string {
    if (!input && input !== 0) return '';

    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (!trimmed) return '';

        // Khớp dạng YYYY-MM-DD hoặc YYYY/MM/DD
        const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (ymdMatch) {
            const y = ymdMatch[1];
            const m = ymdMatch[2].padStart(2, '0');
            const d = ymdMatch[3].padStart(2, '0');
            return format === 'dd/mm' ? `${d}/${m}` : `${d}/${m}/${y}`;
        }

        // Khớp dạng DD/MM/YYYY hoặc DD-MM-YYYY
        const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (dmyMatch) {
            const d = dmyMatch[1].padStart(2, '0');
            const m = dmyMatch[2].padStart(2, '0');
            const y = dmyMatch[3];
            return format === 'dd/mm' ? `${d}/${m}` : `${d}/${m}/${y}`;
        }

        // Parse ngày dạng khác
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
            const d = String(parsed.getDate()).padStart(2, '0');
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const y = parsed.getFullYear();
            return format === 'dd/mm' ? `${d}/${m}` : `${d}/${m}/${y}`;
        }

        return trimmed;
    }

    const dObj = typeof input === 'number' ? new Date(input) : input;
    if (dObj instanceof Date && !isNaN(dObj.getTime())) {
        const d = String(dObj.getDate()).padStart(2, '0');
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const y = dObj.getFullYear();
        return format === 'dd/mm' ? `${d}/${m}` : `${d}/${m}/${y}`;
    }

    return '';
}

/**
 * Định dạng ngày giờ: HH:mm dd/mm/yyyy hoặc HH:mm:ss dd/mm/yyyy
 */
export function formatDateTime(
    input: string | Date | number | null | undefined,
    includeSeconds = false
): string {
    if (!input && input !== 0) return '';
    const dObj = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
    if (!dObj || isNaN(dObj.getTime())) return '';

    const hh = String(dObj.getHours()).padStart(2, '0');
    const mm = String(dObj.getMinutes()).padStart(2, '0');
    const dateStr = formatDate(dObj, 'dd/mm/yyyy');

    if (includeSeconds) {
        const ss = String(dObj.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss} ${dateStr}`;
    }
    return `${hh}:${mm} ${dateStr}`;
}

// Bộ nhớ đệm tạm thời cho từ điển thi đua
let campaignDictCache: Record<string, string> = {};

export function updateCampaignDictCache(dictList: { raw_key: string; display_name: string }[]) {
    campaignDictCache = {};
    dictList.forEach(item => {
        campaignDictCache[item.raw_key.trim().toUpperCase()] = item.display_name.trim();
    });
}

// Danh sách cấu hình mặc định (fallback)
export const DEFAULT_CAMPAIGN_CONFIG = [
    { key: /Bảo hiểm tổng/i, label: 'BẢO_HIỂM_TỔNG' },
    { key: /Bảo hiểm Thợ ĐMX/i, label: 'BẢO_HIỂM_ĐMX' },
    { key: /Bảo hiểm/i, label: 'BẢO_HIỂM' },
    { key: /SIM MOBIFONE\/VINAPHONE\/SIM DMX/i, label: 'SIM_MOBI_VINA_ĐMX' },
    { key: /Sim Vinaphone & Sim ĐMX/i, label: 'SIM_VINA_ĐMX' },
    { key: /Sim Tổng/i, label: 'SIM_TỔNG' },
    { key: /OTT MANGO\+, ICALLME/i, label: 'MANGO_iCALLME' },
    { key: /VAS/i, label: 'VAS' },
    { key: /ĐIỆN THOẠI & TABLET ANDROID/i, label: 'ICT_ANDROID' },
    { key: /TABLET ANDROID/i, label: 'TABLET_ANDROID' },
    { key: /Điện thoại realme/i, label: 'REALME' },
    { key: /Điện thoại Vivo/i, label: 'VIVO' },
    { key: /Điện thoại Flagship Samsung Galaxy S/i, label: 'GALAXY_S.Z' },
    { key: /TRẢ CHẬM FECREDIT, SHINHAN, SAMSUNG FINANCE\+/i, label: 'FE_SH_SSF' },
    { key: /TRẢ CHẬM HOMECREDIT/i, label: 'HOMECREDIT' },
    { key: /Vay tiền mặt/i, label: 'VTM_CAKE_FE' },
    { key: /Ví trả sau/i, label: 'VÍ_TRẢ_SAU' },
    { key: /Camera/i, label: 'CAMERA' },
    { key: /Cáp - Sạc/i, label: 'CÁP_SẠC' },
    { key: /Đồng hồ/i, label: 'ĐỒNG_HỒ' },
    { key: /Phụ kiện IT và nhóm khác/i, label: 'PK_IT_KHÁC' },
    { key: /PHỤ KIỆN CÔNG NGHỆ/i, label: 'PK_CÔNG_NGHỆ' },
    { key: /SẠC DỰ PHÒNG/i, label: 'PIN_SDP' },
    { key: /TAI NGHE/i, label: 'TAI_NGHE' },
    { key: /QUẠT GIÓ/i, label: 'QUẠT_GIÓ' },
    { key: /Laptop \(trừ Apple\)/i, label: 'LAPTOP' },
    { key: /Laptop/i, label: 'LAPTOP' },
    { key: /NẠP RÚT TIỀN TÀI KHOẢN NGÂN HÀNG/i, label: 'NẠP_RÚT' },
    { key: /MỞ THẺ TÍN DỤNG TPBANK EVO VÀ VPBANK MWG/i, label: 'THẺ_TP_VPBANK' },
    { key: /T09 - T10 IPHONE 18 series, iPhone Duo/i, label: 'iPHONE_2026' },
    { key: /MOTOROLA/i, label: 'MOTOROLA' }
];

/**
 * Nâng cấp: Tự động ánh xạ tên viết tắt thi đua.
 * Ưu tiên tra cứu theo từ điển động (dict) từ Supabase nếu có, sau đó mới fallback về regex mặc định.
 */
export function getCampaignLabel(raw: string, dict?: { raw_key: string; display_name: string }[]): string {
    if (!raw) return 'CHỈ TIÊU';
    const trimmed = raw.trim();

    // 1. Kiểm tra trong danh mục từ điển động truyền vào từ Supabase (ưu tiên active items)
    if (dict && dict.length > 0) {
        const activeItems = dict.filter(d => (d as any).is_active !== false);
        const searchList = activeItems.length > 0 ? [...activeItems, ...dict.filter(d => (d as any).is_active === false)] : dict;

        const found = searchList.find(
            d => d.raw_key.toUpperCase() === trimmed.toUpperCase() ||
                d.display_name.toUpperCase() === trimmed.toUpperCase() ||
                trimmed.toUpperCase().includes(d.raw_key.toUpperCase()) ||
                trimmed.toUpperCase().includes(d.display_name.toUpperCase())
        );
        if (found) return found.display_name || found.raw_key;
    }

    // 2. Tra cứu theo cấu hình mẫu mặc định (Regex)
    for (const cfg of DEFAULT_CAMPAIGN_CONFIG) {
        if (cfg.key.test(trimmed)) return cfg.label;
    }

    return trimmed;
}