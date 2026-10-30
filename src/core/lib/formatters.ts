import { ALLOWED_STORES, CAMPAIGN_CONFIG } from '../config/constants';

// Định dạng số hiển thị (Ví dụ: 17,803 hoặc 157.78)
export function formatValue(num: number | null | undefined): string {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Tính số lượng mục tiêu còn lại chuẩn toàn hệ thống:
 * - Nếu thực tế đã hoàn thành mục tiêu (actual >= target, không phụ thuộc dự kiến) -> trả về 0
 * - Nếu chưa hoàn thành (actual < target) -> trả về số dương (target - actual).
 * Ví dụ: mục tiêu 5, đã bán 2, còn lại 3.
 */
export function calculateRemainingTarget(target: number, actual: number, decimals: number = 1): number {
    const t = Number(target) || 0;
    const a = Number(actual) || 0;
    if (a >= t) return 0;
    const diff = t - a;
    return Number(diff.toFixed(decimals));
}

/**
 * Định dạng hiển thị trường mục tiêu còn lại:
 * - Nếu thực tế đã hoàn thành mục tiêu (remaining <= 0) -> để trống hoặc '0'
 * - Nếu chưa hoàn thành -> hiển thị số dương có phân cách hàng nghìn tiếng Việt
 */
export function formatRemainingTarget(
    remaining: number | null | undefined,
    formatBlank: boolean = false,
    forceDecimals: boolean = false
): string {
    if (remaining === null || remaining === undefined || isNaN(remaining) || remaining <= 0) {
        return formatBlank ? '' : '0';
    }
    const abs = Math.abs(remaining);
    const formattedStr = forceDecimals
        ? abs.toFixed(1)
        : (abs % 1 !== 0 ? abs.toFixed(1) : abs.toString());
    const [intPart, decPart] = formattedStr.split('.');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decPart !== undefined ? `${formattedInt},${decPart}` : formattedInt;
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

    // Nếu so sánh getShortStoreName khớp nhau thì là cùng 1 siêu thị
    const shortA = getShortStoreName(a).toLowerCase();
    const shortB = getShortStoreName(b).toLowerCase();
    if (shortA && shortB && shortA === shortB && shortA !== 'tổng') {
        return true;
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

    // Kiểm tra mã số siêu thị ở đầu chuỗi (ví dụ "10335 - ..." đối chiếu "10335")
    const codeMatchA = a.match(/^(\d+)/);
    const codeMatchB = b.match(/^(\d+)/);
    if (codeMatchA && codeMatchB && codeMatchA[1] === codeMatchB[1]) {
        return true;
    }
    if (codeMatchA && (b.includes(codeMatchA[1]) || b.startsWith(codeMatchA[1]))) {
        return true;
    }
    if (codeMatchB && (a.includes(codeMatchB[1]) || a.startsWith(codeMatchB[1]))) {
        return true;
    }

    // Loại bỏ mã số đầu chuỗi để đối chiếu phần tên và địa chỉ
    const cleanA = a.replace(/^\d+\s*-\s*|^\d+\s+/, '').trim().toLowerCase();
    const cleanB = b.replace(/^\d+\s*-\s*|^\d+\s+/, '').trim().toLowerCase();
    if (cleanA && cleanB && cleanA === cleanB) return true;

    // Đối chiếu theo brand/prefix (ví dụ: AAR vs TGDĐ)
    const prefixA = cleanA.split(' - ')[0]?.trim().toLowerCase();
    const prefixB = cleanB.split(' - ')[0]?.trim().toLowerCase();
    const getBrandKey = (p: string) => {
        const raw = p.split('_')[0]?.trim().toLowerCase() || p.toLowerCase();
        if (raw.includes('tgd')) return 'tgdd';
        if (raw.includes('dmx') || raw.includes('đmx')) return 'dmx';
        if (raw.includes('aar')) return 'aar';
        if (raw.includes('topzone')) return 'topzone';
        if (raw.includes('bhx')) return 'bhx';
        return raw;
    };
    const brandA = getBrandKey(prefixA);
    const brandB = getBrandKey(prefixB);
    const knownBrands = ['aar', 'tgdd', 'dmx', 'topzone', 'bhx'];
    const isBrandA = knownBrands.includes(brandA);
    const isBrandB = knownBrands.includes(brandB);
    if (isBrandA && isBrandB && brandA !== brandB) {
        return false;
    }

    return cleanA.includes(cleanB) || cleanB.includes(cleanA);
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
 * Chuẩn hóa ngày từ mọi định dạng (YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, Date, timestamp...)
 * về chuỗi chuẩn ISO YYYY-MM-DD để so sánh logic chính xác.
 */
export function normalizeToDateString(input: string | Date | number | null | undefined): string | null {
    if (!input && input !== 0) return null;

    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (!trimmed) return null;

        // Khớp dạng YYYY-MM-DD hoặc YYYY/MM/DD
        const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (ymdMatch) {
            const y = ymdMatch[1];
            const m = ymdMatch[2].padStart(2, '0');
            const d = ymdMatch[3].padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        // Khớp dạng DD/MM/YYYY hoặc DD-MM-YYYY
        const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (dmyMatch) {
            const d = dmyMatch[1].padStart(2, '0');
            const m = dmyMatch[2].padStart(2, '0');
            const y = dmyMatch[3];
            return `${y}-${m}-${d}`;
        }

        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const d = String(parsed.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return null;
    }

    const dObj = typeof input === 'number' ? new Date(input) : input;
    if (dObj instanceof Date && !isNaN(dObj.getTime())) {
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    return null;
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
    { key: /Bảo hiểm Thợ ĐMX|BẢO_HIỂM_ĐMX|BẢO HIỂM ĐMX|BẢO HIỂM DMX|THỢ ĐMX|THO DMX/i, label: 'BẢO_HIỂM_ĐMX' },
    { key: /^BẢO_HIỂM$|^Bảo hiểm$|Bảo hiểm(?!.*(ĐMX|DMX|thợ|tho|tổng|tong))/i, label: 'BẢO_HIỂM' },
    { key: /SIM MOBIFONE\/VINAPHONE\/SIM DMX/i, label: 'SIM_MOBI_VINA_ĐMX' },
    { key: /Sim Vinaphone & Sim ĐMX/i, label: 'SIM_VINA_ĐMX' },
    { key: /Sim Tổng/i, label: 'SIM_TỔNG' },
    { key: /OTT MANGO\+, ICALLME/i, label: 'MANGO_iCALLME' },
    { key: /VAS/i, label: 'VAS' },
    { key: /ĐIỆN THOẠI & TABLET ANDROID|DIEN THOAI & TABLET ANDROID|ĐT & TABLET ANDROID|DT & TABLET ANDROID|ICT_ANDROID|ICT ANDROID/i, label: 'ICT_ANDROID' },
    { key: /^TABLET_ANDROID$|^TABLET ANDROID$|TABLET ANDROID(?!.*(ĐIỆN THOẠI|DIEN THOAI|ICT|ĐT|DT))/i, label: 'TABLET_ANDROID' },
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

        // BƯỚC 1: Khớp TUYỆT ĐỐI (100% Exact match) theo raw_key hoặc display_name
        const exact = searchList.find(
            d => d.raw_key.trim().toUpperCase() === trimmed.toUpperCase() ||
                d.display_name.trim().toUpperCase() === trimmed.toUpperCase()
        );
        if (exact) return exact.display_name || exact.raw_key;

        // BƯỚC 2: Khớp TUYỆT ĐỐI theo token chuẩn hóa
        const rawToken = trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/^t\d{1,2}\s*-\s*(t\d{1,2}\s*)?/i, '').replace(/[^a-z0-9]/g, '');
        if (rawToken) {
            const tokenMatch = searchList.find(d => {
                const dRawToken = (d.raw_key || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/^t\d{1,2}\s*-\s*(t\d{1,2}\s*)?/i, '').replace(/[^a-z0-9]/g, '');
                const dDispToken = (d.display_name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/^t\d{1,2}\s*-\s*(t\d{1,2}\s*)?/i, '').replace(/[^a-z0-9]/g, '');
                return dRawToken === rawToken || dDispToken === rawToken;
            });
            if (tokenMatch) return tokenMatch.display_name || tokenMatch.raw_key;
        }
    }

    // 2. Tra cứu theo cấu hình mẫu mặc định (Regex)
    for (const cfg of DEFAULT_CAMPAIGN_CONFIG) {
        if (cfg.key.test(trimmed)) return cfg.label;
    }

    // 3. Fallback: Nếu vẫn chưa khớp, tìm chuỗi con với ưu tiên độ dài lớn nhất (Longest match first)
    if (dict && dict.length > 0) {
        const activeItems = dict.filter(d => (d as any).is_active !== false);
        const searchList = activeItems.length > 0 ? [...activeItems, ...dict.filter(d => (d as any).is_active === false)] : dict;
        const upper = trimmed.toUpperCase();

        const sortedByLength = [...searchList].sort((a, b) => {
            const lenA = Math.max((a.display_name || '').length, (a.raw_key || '').length);
            const lenB = Math.max((b.display_name || '').length, (b.raw_key || '').length);
            return lenB - lenA;
        });

        const sub = sortedByLength.find(d => {
            const dRawUpper = (d.raw_key || '').trim().toUpperCase();
            const dDispUpper = (d.display_name || '').trim().toUpperCase();
            if (dRawUpper.length >= 4 && upper.includes(dRawUpper)) return true;
            if (dDispUpper.length >= 4 && upper.includes(dDispUpper)) return true;
            return false;
        });
        if (sub) return sub.display_name || sub.raw_key;
    }

    return trimmed;
}

/**
 * Tự động viết hoa chữ cái đầu tiên của mỗi từ (Capitalize each word)
 * Ví dụ: "nguyễn văn an" -> "Nguyễn Văn An"
 */
export function formatCapitalizeWords(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '')
        .join(' ');
}

/**
 * Chuẩn hóa số từ kết quả OCR ứng dụng BI:
 * - Trên ảnh BI: dấu phẩy ',' là dấu phân cách hàng nghìn: "3,123" -> 3123
 * - "4,237" -> 4237
 * - "14,352.92" -> 14352.92
 * - Nếu AI nhầm dấu phẩy thành dấu chấm: ví dụ 3.123 (khi phần nguyên < 100 và có đúng 3 chữ số thập phân) -> 3123
 */
export function cleanBiNumber(val: any): number {
    if (val === null || val === undefined || val === '') return 0;

    if (typeof val === 'number') {
        if (isNaN(val)) return 0;
        const str = val.toString();
        const match = str.match(/^(\d+)\.(\d{3})$/);
        if (match && Number(match[1]) < 100) {
            return Number(match[1] + match[2]);
        }
        return val;
    }

    if (typeof val === 'string') {
        let clean = val.trim();
        if (!clean) return 0;

        if (clean.includes(',') && clean.includes('.')) {
            clean = clean.replace(/,/g, '');
        } else if (clean.includes(',')) {
            clean = clean.replace(/,/g, '');
        } else if (clean.includes('.')) {
            const match = clean.match(/^(\d+)\.(\d{3})$/);
            if (match && Number(match[1]) < 100) {
                clean = match[1] + match[2];
            }
        }

        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    }

    return 0;
}

/**
 * Chuẩn hóa số liệu doanh thu / target về đơn vị Triệu đồng (rút gọn phần triệu)
 * - Nếu số >= 100,000 (ví dụ: 100,000,000 VNĐ) -> chia 1,000,000 = 100
 * - Nếu số < 100,000 (ví dụ: 100, 15.5) -> giữ nguyên 100, 15.5
 */
export function normalizeToMillion(val: number | string | undefined | null): number {
    if (val === null || val === undefined) return 0;
    const num = Number(val);
    if (isNaN(num)) return 0;
    if (Math.abs(num) >= 100_000) {
        return Math.round((num / 1_000_000) * 100) / 100;
    }
    return Math.round(num * 100) / 100;
}

/**
 * Lấy ngày đầu tuần (Mặc định tính từ Thứ Hai - Monday-first) theo chuẩn dự án SalesHub
 * Trả về chuỗi định dạng YYYY-MM-DD
 */
export function getStartOfWeek(d: Date = new Date()): string {
    const date = new Date(d);
    const day = date.getDay(); // 0: CN, 1: T2, ..., 6: T7
    const diff = date.getDate() - (day === 0 ? 6 : day - 1);
    date.setDate(diff);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
}

/**
 * Chuẩn hóa họ tên nhân viên, loại bỏ hoàn toàn các hậu tố/tiền tố bộ phận:
 * - "Nguyễn Văn A - AIO - TZ" -> "Nguyễn Văn A"
 * - "Trần Thị B - ĐMX" -> "Trần Thị B"
 * - "Lê Văn C (AIO)" -> "Lê Văn C"
 */
export function cleanEmployeeName(fullName: string): string {
    if (!fullName || !fullName.trim()) return '';
    let clean = fullName.trim();
    // 1. Loại bỏ các phần chú thích trong ngoặc đơn: (AIO), (ĐMX), (TGD), (Kho), (QL), v.v.
    clean = clean.replace(/\s*\([^)]*(aio|đmx|dmx|tgd|tgdd|kho|thu ngân|tư vấn|new|tz|ql|sm|am|asm|pg|sub|ctv|dịch vụ|dv|kỹ thuật|kt)[^)]*\)/gi, '');
    // 2. Loại bỏ các phần bộ phận nối bằng dấu gạch ngang ở đuôi: - AIO, - ĐMX, - TGD, - AIO - TZ, - Kho, v.v.
    clean = clean.replace(/\s*[-–—]\s*(aio|đmx|dmx|tgd|tgdd|bh|kho|thu ngân|tư vấn|new|tz|ql|sm|am|asm|pg|sub|ctv|dịch vụ|dv|kỹ thuật|kt)(\s*[-–—]\s*[\w\s]+)*\s*$/gi, '');
    return clean.trim();
}

/**
 * Rút gọn tên nhân viên chuẩn toàn hệ thống SalesHub:
 * Cấu trúc: 2 chữ cuối của tên nhân viên.
 * Ngoại lệ: Nếu chữ kế cuối là "Thị" (không phân biệt hoa/thường), chỉ hiển thị chữ cuối cùng (tên).
 * Ví dụ:
 * - "Nguyễn Phương Nam" -> "Phương Nam"
 * - "Nguyễn Thị Loan" -> "Loan" (vì chữ kế cuối là "Thị")
 * - "Trần Thị Kim Cúc" -> "Kim Cúc" (chữ kế cuối là "Kim")
 * - "Lê Quang Vinh" -> "Quang Vinh"
 */
export function getShortenedEmployeeName(fullName: string): string {
    const cleaned = cleanEmployeeName(fullName);
    if (!cleaned) return '';
    const words = cleaned.split(/\s+/);
    if (words.length <= 1) return words[0];

    const lastWord = words[words.length - 1];
    const secondToLast = words[words.length - 2];

    if (secondToLast.toLowerCase() === 'thị') {
        return lastWord;
    }
    return `${secondToLast} ${lastWord}`;
}
