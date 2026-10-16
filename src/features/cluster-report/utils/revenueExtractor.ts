/**
 * Trích xuất chi tiết Doanh thu Quy đổi (DTQĐ) và Doanh thu Thực tế (DT Thực)
 * từ chuỗi dữ liệu thô (rawRevenue) được sao chép từ Dashboard BI TGDD.
 *
 * Cấu trúc cột chuẩn của Dashboard BI TGDD:
 * - Cột 0: SỐ LƯỢNG
 * - Cột 1: DOANH THU QĐ (Doanh thu quy đổi dùng để tính Target, %HT, %DKHT)
 * - Cột 2: % TỈ TRỌNG
 * - Cột 3: DOANH THU (Doanh thu thực tế phát sinh tại siêu thị)
 * - Cột 4: TARGET
 * - Cột 5: % HT TARGET
 * - Cột 6: TB 3 THÁNG
 * - Cột 7: % TT
 * - Cột 8: DT TRẢ GÓP
 * - Cột 9: % TRẢ GÓP
 */

export interface ExtractedStoreRevenue {
    revenueQd: number;          // Doanh thu quy đổi (Triệu đồng)
    revenueActual: number;      // Doanh thu thực (Triệu đồng)
    revenueTarget?: number;     // Target chuẩn (Triệu đồng)
    avg3Months?: number;        // TB 3 Tháng (Triệu đồng)
    pctGrowth?: number;         // % Tăng trưởng so với TB 3 tháng
    installmentRevenue?: number;// DT trả góp (Triệu đồng)
    installmentRate?: number;   // % Trả góp
}

export function extractStoreRevenueDetails(
    rawRevenue: string | undefined | null,
    storeName: string
): ExtractedStoreRevenue | null {
    if (!rawRevenue || !rawRevenue.trim() || !storeName) return null;

    const lines = rawRevenue.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // 1. Trích xuất mã số siêu thị từ storeName (ví dụ: '111', '10335', ...)
    const storeIdMatch = storeName.match(/^(\d{3,6})/);
    const targetStoreId = storeIdMatch ? storeIdMatch[1] : '';

    // 2. Trích xuất thương hiệu (TGD, AAR, ĐMX, TOP...)
    const extractBrand = (str: string): string => {
        const upper = str.toUpperCase();
        if (upper.includes('AAR')) return 'AAR';
        if (upper.includes('TGD') || upper.includes('TGDĐ')) return 'TGD';
        if (upper.includes('ĐMX') || upper.includes('DMX')) return 'DMX';
        if (upper.includes('TOP')) return 'TOP';
        return '';
    };
    const targetBrand = extractBrand(storeName);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
            line.startsWith('Đơn vị') ||
            line.includes('triệu đồng') ||
            line.startsWith('Siêu thị') ||
            line.startsWith('SỐ LƯỢNG') ||
            line.startsWith('DOANH THU')
        ) {
            continue;
        }

        // Bỏ qua dòng Tổng nếu đang tìm siêu thị cụ thể
        if (/^(tổng|tong)/i.test(line)) continue;

        // Kiểm tra xem dòng này có phải của siêu thị mục tiêu không
        let isMatch = false;

        const lineIdMatch = line.match(/^(\d{3,6})/);
        const lineStoreId = lineIdMatch ? lineIdMatch[1] : '';
        const lineBrand = extractBrand(line);

        if (targetStoreId && lineStoreId) {
            isMatch = (targetStoreId === lineStoreId);
        } else if (targetStoreId && (line.startsWith(targetStoreId + ' -') || line.startsWith(targetStoreId + ' '))) {
            isMatch = true;
        } else if (targetBrand && lineBrand && targetBrand !== lineBrand) {
            // Khác thương hiệu dù chung địa chỉ (ví dụ 111 TGD vs 10335 AAR cùng 290 Trương Công Định) => KHÔNG MATCH
            isMatch = false;
        } else if (line.includes(storeName) || storeName.includes(line)) {
            isMatch = true;
        } else if (targetBrand && lineBrand && targetBrand === lineBrand) {
            const getAddress = (s: string) => s.split(/[-–—_]/).pop()?.trim().toLowerCase() || '';
            const lineAddr = getAddress(line);
            const targetAddr = getAddress(storeName);
            if (lineAddr && targetAddr && (lineAddr.includes(targetAddr) || targetAddr.includes(lineAddr))) {
                isMatch = true;
            }
        }

        if (isMatch) {
            // Xác định dòng chứa số liệu: có thể nằm cùng dòng (inline) hoặc ở dòng kế tiếp
            let parts = line.split(/\t|\s{2,}/).map(x => x.trim()).filter(Boolean);
            if (parts.length < 5 && i + 1 < lines.length) {
                // Số liệu ở dòng kế tiếp
                parts = lines[i + 1].split(/\t|\s{2,}/).map(x => x.trim()).filter(Boolean);
            } else if (parts.length >= 5) {
                // Tên ST là phần tử đầu tiên, số liệu từ phần tử thứ 2 trở đi
                parts = parts.slice(1);
            }

            if (parts.length >= 4) {
                // Nhận diện định dạng mới vs cũ:
                // Nếu parts[4] chứa '%' -> Cấu trúc mới từ BI:
                // parts[0]: Số lượng | parts[1]: DT | parts[2]: % Tỉ trọng | parts[3]: Target | parts[4]: % HT Target
                // parts[5]: TB 3 tháng | parts[6]: % TT | parts[7]: DT Trả thẳng | parts[8]: DT Trả góp | parts[9]: DT Nhập trả
                const isNewFormat = String(parts[4] || '').includes('%');

                let qd = 0;
                let actual = 0;
                let target: number | undefined;
                let avg3M: number | undefined;
                let pctGr: number | undefined;
                let installmentRevenue: number | undefined;
                let installmentRate: number | undefined;

                if (isNewFormat) {
                    qd = parseFloat(String(parts[1] || '0').replace(/,/g, '')) || 0;
                    actual = qd; // Mặc định bảng đơn
                    target = parts[3] ? parseFloat(String(parts[3] || '0').replace(/,/g, '')) : undefined;
                    avg3M = parts[5] ? parseFloat(String(parts[5] || '0').replace(/,/g, '')) : undefined;
                    pctGr = parts[6] ? parseFloat(String(parts[6] || '0').replace(/%/g, '').replace(/\+/g, '').replace(/,/g, '')) : undefined;
                    // Đối với bảng DTQĐ mẫu mới: parts[8] là "DT Trả góp QĐ", KHÔNG lấy làm DT trả góp
                    // Chỉ lấy DT trả góp khi có nguồn dữ liệu Doanh thu thực
                    installmentRevenue = undefined;
                    installmentRate = undefined;
                } else {
                    // Cấu trúc cũ:
                    // parts[1]: DTQĐ | parts[3]: DT Thực | parts[4]: Target | parts[6]: TB 3 tháng | parts[7]: % TT | parts[8]: DT Trả góp | parts[9]: % Trả góp
                    qd = parseFloat(String(parts[1] || '0').replace(/,/g, '')) || 0;
                    actual = parseFloat(String(parts[3] || '0').replace(/,/g, '')) || qd;
                    target = parts[4] ? parseFloat(String(parts[4] || '0').replace(/,/g, '')) : undefined;
                    avg3M = parts[6] ? parseFloat(String(parts[6] || '0').replace(/,/g, '')) : undefined;
                    pctGr = parts[7] ? parseFloat(String(parts[7] || '0').replace(/%/g, '').replace(/\+/g, '').replace(/,/g, '')) : undefined;
                    installmentRevenue = parts[8] ? parseFloat(String(parts[8] || '0').replace(/,/g, '')) : undefined;
                    installmentRate = parts[9] ? parseFloat(String(parts[9] || '0').replace(/%/g, '').replace(/,/g, '')) : undefined;
                }

                return {
                    revenueQd: qd,
                    revenueActual: actual,
                    revenueTarget: target,
                    avg3Months: avg3M,
                    pctGrowth: pctGr,
                    installmentRevenue,
                    installmentRate
                };
            }
        }
    }

    return null;
}

/**
 * Trích xuất đồng thời cả phần Doanh thu quy đổi (DTQĐ) và Doanh thu thực (DT Thực)
 * nếu chuỗi rawRevenue được ghép từ 2 bảng (ngăn cách bởi dấu hiệu phân tách)
 */
export function extractStoreRevenueDetailsWithReal(
    rawRevenue: string | undefined | null,
    storeName: string
): ExtractedStoreRevenue | null {
    if (!rawRevenue || !rawRevenue.trim() || !storeName) return null;

    const SPLIT_TOKEN = '=== BẢNG DOANH THU THỰC ===';
    if (rawRevenue.includes(SPLIT_TOKEN)) {
        const [qdRaw, realRaw] = rawRevenue.split(SPLIT_TOKEN);
        const qdExtracted = extractStoreRevenueDetails(qdRaw, storeName);
        const realExtracted = extractStoreRevenueDetails(realRaw, storeName);

        if (qdExtracted && realExtracted) {
            // Khi có bảng Doanh thu thực: Tính % Trả góp = (DT trả góp / DT thực) * 100
            const realRevActual = realExtracted.revenueActual > 0 ? realExtracted.revenueActual : qdExtracted.revenueActual;
            // CHỈ lấy duy nhất DT Trả góp từ bảng Doanh thu thực (realExtracted)
            const instRev = realExtracted.installmentRevenue;
            let realInstRate = realExtracted.installmentRate;
            if (realInstRate === undefined && instRev !== undefined && realRevActual > 0) {
                realInstRate = Number(((instRev / realRevActual) * 100).toFixed(2));
            }

            return {
                revenueQd: qdExtracted.revenueQd,
                revenueActual: realRevActual,
                revenueTarget: realExtracted.revenueTarget || qdExtracted.revenueTarget,
                avg3Months: realExtracted.avg3Months ?? qdExtracted.avg3Months,
                pctGrowth: realExtracted.pctGrowth ?? qdExtracted.pctGrowth,
                installmentRevenue: instRev,
                installmentRate: realInstRate
            };
        } else if (qdExtracted) {
            return qdExtracted;
        } else if (realExtracted) {
            return realExtracted;
        }
    }

    return extractStoreRevenueDetails(rawRevenue, storeName);
}
