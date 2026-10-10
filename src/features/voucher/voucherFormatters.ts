import type { VoucherItem, VoucherStockForecast } from './types';

/**
 * Định dạng số tiền thành chuỗi tiền tệ VNĐ có dấu phân cách hàng nghìn (VD: 50.000đ)
 */
export function formatCurrency(amount: number): string {
    if (!amount || isNaN(amount)) return '0đ';
    return `${Number(amount).toLocaleString('vi-VN')}đ`;
}

/**
 * Định dạng số nguyên thuần có dấu phân cách hàng nghìn (VD: 50.000 hoặc 100.000)
 */
export function formatThousandNumber(val: number | string): string {
    if (val === undefined || val === null || val === '') return '';
    const cleanNum = typeof val === 'number' ? val : Number(String(val).replace(/\D/g, ''));
    if (isNaN(cleanNum)) return '';
    return cleanNum.toLocaleString('vi-VN');
}

/**
 * Chuyển chuỗi nhập liệu (có thể có dấu chấm, phẩy) thành số nguyên
 */
export function parseCurrencyInput(input: string | number): number {
    if (typeof input === 'number') return input;
    if (!input) return 0;
    const cleanStr = String(input).replace(/[^\d]/g, '');
    const num = parseInt(cleanStr, 10);
    return isNaN(num) ? 0 : num;
}

/**
 * Xử lý sự kiện nhập số tiền có định dạng phần nghìn theo thời gian thực
 */
export function handleCurrencyInputChange(
    rawValue: string,
    callback: (numericValue: number) => void
): string {
    const numeric = parseCurrencyInput(rawValue);
    callback(numeric);
    return numeric > 0 ? numeric.toLocaleString('vi-VN') : '';
}

export type DenominationHotTier = 'ENTRY' | 'POPULAR' | 'MEDIUM' | 'HIGH' | 'PREMIUM' | 'VIP';

/**
 * Phân cấp độ Hot theo mệnh giá từ thấp đến cao:
 * - ENTRY: < 30.000đ (Xanh ngọc mát mẻ)
 * - POPULAR: 30.000đ - 50.000đ (Xanh lam tươi tắn)
 * - MEDIUM: 50.001đ - 100.000đ (Tím/Indigo sang trọng)
 * - HIGH: 100.001đ - 200.000đ (Vàng cam năng động)
 * - PREMIUM: 200.001đ - 500.000đ (Đỏ hồng Ruby rực rỡ)
 * - VIP: >= 1.000.000đ (Gradient Vàng Lửa Kim Cương Hoàng Gia)
 */
export function getDenominationHotTier(denomination: number): DenominationHotTier {
    const val = Number(denomination) || 0;
    if (val < 30000) return 'ENTRY';
    if (val <= 50000) return 'POPULAR';
    if (val <= 100000) return 'MEDIUM';
    if (val <= 200000) return 'HIGH';
    if (val <= 500000) return 'PREMIUM';
    return 'VIP';
}

export interface DenominationHotStyle {
    tier: DenominationHotTier;
    label: string;
    badgeClass: string;
    textClass: string;
    bgClass: string;
    borderClass: string;
    activeClass: string;
    tagIcon: string;
}

export function getDenominationHotStyle(denomination: number): DenominationHotStyle {
    const tier = getDenominationHotTier(denomination);

    switch (tier) {
        case 'ENTRY':
            return {
                tier,
                label: 'Nhập môn',
                badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                textClass: 'text-emerald-700',
                bgClass: 'bg-emerald-50/70',
                borderClass: 'border-emerald-200',
                activeClass: 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-300 shadow-md',
                tagIcon: '🌱'
            };
        case 'POPULAR':
            return {
                tier,
                label: 'Phổ biến',
                badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
                textClass: 'text-sky-700',
                bgClass: 'bg-sky-50/70',
                borderClass: 'border-sky-200',
                activeClass: 'bg-sky-600 text-white border-sky-700 ring-2 ring-sky-300 shadow-md',
                tagIcon: '✨'
            };
        case 'MEDIUM':
            return {
                tier,
                label: 'Hấp dẫn',
                badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                textClass: 'text-indigo-700',
                bgClass: 'bg-indigo-50/70',
                borderClass: 'border-indigo-200',
                activeClass: 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-300 shadow-md',
                tagIcon: '⭐'
            };
        case 'HIGH':
            return {
                tier,
                label: 'Giá trị cao',
                badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
                textClass: 'text-amber-700',
                bgClass: 'bg-amber-50/70',
                borderClass: 'border-amber-300',
                activeClass: 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300 shadow-md',
                tagIcon: '🔥'
            };
        case 'PREMIUM':
            return {
                tier,
                label: 'Cực Hot',
                badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
                textClass: 'text-rose-600',
                bgClass: 'bg-rose-50/70',
                borderClass: 'border-rose-300',
                activeClass: 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-300 shadow-md',
                tagIcon: '💥'
            };
        case 'VIP':
        default:
            return {
                tier,
                label: 'VIP Đặc Biệt',
                badgeClass: 'bg-gradient-to-r from-amber-500 to-rose-600 text-white border-rose-400 font-black shadow-xs',
                textClass: 'text-rose-700 font-black',
                bgClass: 'bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50',
                borderClass: 'border-rose-300',
                activeClass: 'bg-gradient-to-r from-amber-600 to-rose-600 text-white border-rose-700 ring-2 ring-amber-300 shadow-lg',
                tagIcon: '👑'
            };
    }
}

/**
 * Tính toán danh sách tổng hợp số lượng mã voucher theo từng chiến dịch & mệnh giá,
 * đồng thời phân tích tốc độ sử dụng trung bình mỗi ngày và dự báo số ngày còn lại.
 */
export function calculateStockForecasts(vouchers: VoucherItem[]): VoucherStockForecast[] {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Gom nhóm theo Campaign Name + Denomination
    const groups = new Map<string, {
        campaign_name: string;
        denomination: number;
        descriptions: Set<string>;
        total: number;
        available: number;
        claimed: number;
        used: number;
        claimTimestamps: number[];
    }>();

    vouchers.forEach(v => {
        const cName = v.campaign_name.trim();
        const denom = Number(v.denomination) || 0;
        const key = `${cName}___${denom}`;

        if (!groups.has(key)) {
            groups.set(key, {
                campaign_name: cName,
                denomination: denom,
                descriptions: new Set<string>(),
                total: 0,
                available: 0,
                claimed: 0,
                used: 0,
                claimTimestamps: []
            });
        }

        const g = groups.get(key)!;
        g.total++;

        if (v.description && v.description.trim()) {
            g.descriptions.add(v.description.trim());
        }

        const isExpired = Boolean(v.expires_at && v.expires_at < todayStr && v.status !== 'USED');
        if (v.status === 'AVAILABLE' && !isExpired) {
            g.available++;
        } else if (v.status === 'CLAIMED') {
            g.claimed++;
        } else if (v.status === 'USED') {
            g.used++;
        }

        if (v.claimed_at) {
            const ts = new Date(v.claimed_at).getTime();
            if (!isNaN(ts)) {
                g.claimTimestamps.push(ts);
            }
        }
    });

    const forecasts: VoucherStockForecast[] = [];

    groups.forEach((g) => {
        // Tính tốc độ trung bình sử dụng mỗi ngày:
        // Lấy các lượt cấp trong 14 ngày gần nhất (hoặc toàn bộ nếu ít hơn 14 ngày)
        const totalClaimedAll = g.claimed + g.used;
        let avgDailyUsage = 0;

        if (g.claimTimestamps.length > 0) {
            g.claimTimestamps.sort((a, b) => a - b);
            const firstClaim = g.claimTimestamps[0];
            const lastClaim = g.claimTimestamps[g.claimTimestamps.length - 1];
            
            // Số ngày trải qua từ lần cấp đầu tiên đến nay (tối thiểu 1 ngày)
            const daysSpan = Math.max(1, Math.ceil((today.getTime() - firstClaim) / (1000 * 60 * 60 * 24)));
            
            // Số mã cấp trong 14 ngày gần nhất
            const fourteenDaysAgo = today.getTime() - 14 * 24 * 60 * 60 * 1000;
            const recentClaims = g.claimTimestamps.filter(t => t >= fourteenDaysAgo).length;
            const recentDays = Math.min(daysSpan, 14);

            const recentRate = recentClaims / Math.max(1, recentDays);
            const overallRate = g.claimTimestamps.length / daysSpan;

            // Ưu tiên tỷ lệ gần đây (trọng số 70%) và toàn kỳ (30%)
            avgDailyUsage = Math.round((recentRate * 0.7 + overallRate * 0.3) * 10) / 10;
        } else if (totalClaimedAll > 0) {
            avgDailyUsage = 1.0;
        }

        // Tính số ngày còn lại dự kiến
        let daysRemaining = Infinity;
        if (g.available === 0) {
            daysRemaining = 0;
        } else if (avgDailyUsage > 0) {
            daysRemaining = Math.round((g.available / avgDailyUsage) * 10) / 10;
        }

        // Đánh giá mức độ cảnh báo:
        // CHỈ cảnh báo sắp hết mã nếu tồn kho dự báo không còn đủ dùng trong 2 ngày (daysRemaining <= 2)
        let alertLevel: VoucherStockForecast['alertLevel'] = 'SAFE';
        let alertMessage = 'Đủ dùng an toàn';

        if (g.available === 0) {
            alertLevel = 'OUT_OF_STOCK';
            alertMessage = '🚨 ĐÃ HẾT MÃ - CẦN NẠP BỔ SUNG NGAY';
        } else if (avgDailyUsage > 0 && daysRemaining <= 1) {
            alertLevel = 'CRITICAL';
            alertMessage = `⚡ SẮP HẾT CẤP BÁCH (Chỉ còn đủ dùng ~${daysRemaining} ngày)`;
        } else if (avgDailyUsage > 0 && daysRemaining <= 2) {
            alertLevel = 'WARNING';
            alertMessage = `⚠️ SẮP HẾT (Chỉ còn đủ dùng ~${daysRemaining} ngày)`;
        } else if (avgDailyUsage === 0) {
            alertLevel = 'INACTIVE';
            alertMessage = 'Chưa phát sinh lượt lấy';
        }

        const descriptionsArr = Array.from(g.descriptions);

        forecasts.push({
            campaign_name: g.campaign_name,
            denomination: g.denomination,
            description: descriptionsArr.length > 0 ? descriptionsArr.join('; ') : undefined,
            total: g.total,
            available: g.available,
            claimed: g.claimed,
            used: g.used,
            avgDailyUsage,
            daysRemaining,
            alertLevel,
            alertMessage
        });
    });

    // Sắp xếp: Ưu tiên loại Hết mã lên đầu, sau đó đến Sắp hết, sau đó đến Mệnh giá
    const alertPriority: Record<VoucherStockForecast['alertLevel'], number> = {
        OUT_OF_STOCK: 1,
        CRITICAL: 2,
        WARNING: 3,
        SAFE: 4,
        INACTIVE: 5
    };

    return forecasts.sort((a, b) => {
        const pA = alertPriority[a.alertLevel];
        const pB = alertPriority[b.alertLevel];
        if (pA !== pB) return pA - pB;
        if (a.daysRemaining !== b.daysRemaining) return a.daysRemaining - b.daysRemaining;
        return a.denomination - b.denomination;
    });
}

/**
 * Tách chuỗi điều kiện sử dụng thành danh sách các dòng điều kiện riêng biệt.
 * Tự động nhận diện xuống dòng (\n, \r\n), dấu chấm phẩy (;), hoặc dấu gạch đầu dòng (•, -).
 */
export function parseConditionLines(description?: string | null): string[] {
    if (!description || !description.trim()) return [];

    const raw = description.trim();

    // 1. Nếu có chứa dấu xuống dòng, tách theo từng dòng
    if (raw.includes('\n')) {
        return raw
            .split('\n')
            .map(line => line.trim().replace(/^[•\-\*📌✓✔]\s*/, ''))
            .filter(Boolean);
    }

    // 2. Nếu có dấu chấm phẩy (;), tách theo dấu chấm phẩy
    if (raw.includes(';')) {
        return raw
            .split(';')
            .map(line => line.trim().replace(/^[•\-\*📌✓✔]\s*/, ''))
            .filter(Boolean);
    }

    // 3. Chuỗi đơn dòng
    return [raw.replace(/^[•\-\*📌✓✔]\s*/, '')];
}

