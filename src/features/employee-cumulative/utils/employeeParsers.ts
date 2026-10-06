/**
 * Bộ giải mã cú pháp (Parser) cho dữ liệu nhân viên bóc tách từ báo cáo
 */

export interface ParsedEmployeeRevenue {
    employee_id: string;
    full_name: string;
    quantity: number;
    revenue_qd: number;       // Doanh thu quy đổi (Triệu đồng)
    revenue_actual: number;   // Doanh thu thực (Triệu đồng)
    installment_revenue: number; // DT trả góp
    installment_rate: number;    // % trả góp
}

export interface ParsedCampaignBlock {
    campaign_name: string;
    unit_type: 'DOANH THU' | 'SỐ LƯỢNG';
    employee_values: Record<string, number>; // { [empId]: number }
}

export interface WorkShiftLog {
    date: string;
    store_name: string;
    employee_id: string;
    full_name: string;
    department?: string;
    job_title?: string;
    shift_name: string;
    hours: number;
}

export interface ParsedWorkHoursResult {
    total_hours_by_emp: Record<string, number>; // { [empId]: number }
    shift_logs: WorkShiftLog[];
    unique_shift_count: number;
}

/**
 * Bóc tách tên Siêu thị từ chuỗi văn bản thô (nếu người dùng copy toàn bộ màn hình Dashboard)
 */
export function detectStoreFromRawText(rawText: string): string | null {
    if (!rawText || !rawText.trim()) return null;
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
        // Cách 1: Nằm sau chữ "Siêu thị"
        if (lines[i].toLowerCase() === 'siêu thị' && i + 1 < lines.length) {
            const nextL = lines[i + 1].replace(/[×x]/g, '').trim();
            if (nextL.includes(' - ') && !nextL.toLowerCase().includes('quỹ thời gian')) {
                return nextL;
            }
        }
        // Cách 2: Dòng trực tiếp có dạng mã siêu thị [10335 - AAR_BRV_VTA - 290 Trương Công Định]
        const l = lines[i];
        if (/^\d{3,6}\s*-\s*[A-Z0-9_]{3,}/i.test(l)) {
            const parts = l.split(' - ');
            if (parts.length >= 2) {
                const brandPart = parts[1].trim().toUpperCase();
                if (
                    brandPart.startsWith('AAR_') ||
                    brandPart.startsWith('TGD_') ||
                    brandPart.startsWith('DMX_') ||
                    brandPart.startsWith('BHX_') ||
                    brandPart.startsWith('AVA_') ||
                    brandPart.startsWith('TOP_') ||
                    brandPart.startsWith('ĐMX') ||
                    brandPart.startsWith('TGDĐ') ||
                    parts.length >= 3
                ) {
                    return l;
                }
            }
        }
    }
    return null;
}

/**
 * 1. BÓC TÁCH DOANH THU NHÂN VIÊN (Raw Data Parsing & Extraction)
 * Logic xử lý dữ liệu thô:
 * 1. Chuẩn hóa chuỗi văn bản đầu vào: rawText.split(/\r?\n/), .trim(), lọc bỏ dòng trống (line !== ''), loại trừ header/footer cố định TGDD.
 * 2. Thuật toán nhận diện "Dòng Cặp" (Pair Lines):
 *    - Dòng 1 (Dòng Định Danh): Chứa mã nhân viên và tên (ngăn cách bằng dấu -)
 *    - Dòng 2 (Dòng Chỉ Số Số Liệu): Nằm ngay bên dưới Dòng 1, chứa dãy số liệu ngăn cách bằng Tab (\t) hoặc nhiều khoảng trắng.
 */
export function parseEmployeeRevenueText(rawText: string): ParsedEmployeeRevenue[] {
    if (!rawText || !rawText.trim()) return [];

    // Kiểm tra dòng tiêu đề siêu thị để không bị bóc nhầm thành nhân viên
    const isStoreHeader = (str: string): boolean => {
        if (/^\d{3,6}\s*-\s*[A-Z0-9_]{3,}/i.test(str)) {
            const parts = str.split(' - ');
            if (parts.length >= 2) {
                const brandPart = parts[1].trim().toUpperCase();
                if (
                    brandPart.startsWith('AAR_') ||
                    brandPart.startsWith('TGD_') ||
                    brandPart.startsWith('DMX_') ||
                    brandPart.startsWith('BHX_') ||
                    brandPart.startsWith('AVA_') ||
                    brandPart.startsWith('TOP_') ||
                    brandPart.startsWith('ĐMX') ||
                    brandPart.startsWith('TGDĐ') ||
                    parts.length >= 3
                ) {
                    return true;
                }
            }
        }
        return false;
    };

    // 1. Chuẩn hóa chuỗi văn bản đầu vào
    const rawLines = rawText.split(/\r?\n/)
        .map(l => l.trim())
        .filter(line => line !== '');

    // Danh sách các từ khóa cố định cần loại trừ từ hệ thống TGDD
    const IGNORE_KEYWORDS = [
        'nhân viên',
        'số lượng',
        'doanh thu qđ',
        '% tỉ trọng',
        'doanh thu',
        'target',
        '% ht target',
        'tb 3 tháng',
        '% tt',
        'dt trả góp',
        '% trả góp',
        'tổng',
        'đơn vị:',
        'tỉ trọng tính',
        'tỉ trọng',
        'tăng trưởng',
        'dự kiến',
        'off / onl',
        'tổng hợp',
        'ngành hàng bi',
        'chi tiết chi phí',
        'thi đua',
        'doanh thu theo cấp'
    ];

    // Lọc bỏ dòng tiêu đề và footer cố định
    const cleanLines = rawLines.filter(line => {
        const lower = line.toLowerCase();
        if (
            lower.startsWith('tổng') ||
            lower.startsWith('đơn vị:') ||
            lower.startsWith('tỉ trọng tính') ||
            lower.includes('/ trang') ||
            /^\d+-\d+\s*\/\s*tổng/.test(lower) ||
            isStoreHeader(line)
        ) {
            return false;
        }
        // Lọc bỏ dòng tiêu đề bảng nếu chứa các từ khóa cột
        if (lower.includes('nhân viên') && (lower.includes('số lượng') || lower.includes('doanh thu'))) {
            return false;
        }
        return !IGNORE_KEYWORDS.some(kw => lower === kw);
    });

    const results: ParsedEmployeeRevenue[] = [];

    // Hàm nhận diện dòng nhân viên: "Mã NV - Họ và Tên"
    const extractEmployeeInfo = (str: string): { empId: string; fullName: string } | null => {
        if (isStoreHeader(str)) return null;
        // Mã nhân viên không được bắt đầu bằng dấu trừ '-'
        const m = str.match(/^([a-zA-Z0-9_.]+)\s*-\s*([^\t\r\n]+)$/);
        if (m && m[1].toLowerCase() !== 'online' && !m[1].startsWith('-')) {
            const name = m[2].trim();
            // Tên nhân viên phải chứa ký tự chữ cái (tránh nhận nhầm biểu thức toán/số âm)
            if (/[a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9]/.test(name)) {
                return { empId: m[1].trim(), fullName: name };
            }
        }
        return null;
    };

    /**
     * Bóc tách số liệu theo thứ tự cột chuẩn xác:
     * - Cột 0: SỐ LƯỢNG (cần)
     * - Cột 1: DOANH THU QĐ (cần)
     * - Cột 2: % TỈ TRỌNG (không cần)
     * - Cột 3: DOANH THU (cần)
     * - Cột 4: TB 3 THÁNG (không cần)
     * - Cột 5: % TT (không cần)
     * - Cột 6: DT TRẢ GÓP (cần)
     * - Cột 7: % TRẢ GÓP (cần)
     */
    const extractMetrics = (cols: string[]): {
        quantity: number;
        revenue_qd: number;
        revenue_actual: number;
        installment_revenue: number;
        installment_rate: number;
    } => {
        const quantity = cols.length > 0 ? parseNumber(cols[0]) : 0;
        const revenue_qd = cols.length > 1 ? parseNumber(cols[1]) : 0;
        const revenue_actual = cols.length > 3 ? parseNumber(cols[3]) : 0;

        let installment_revenue = 0;
        let installment_rate = 0;

        if (cols.length >= 10) {
            // Tương thích ngược: Định dạng 10 cột cũ (có Target & % HT Target ở giữa)
            installment_revenue = parseNumber(cols[8]);
            installment_rate = parseNumber(cols[9]);
        } else if (cols.length >= 7) {
            // Định dạng chuẩn 8 cột theo quy định mới
            installment_revenue = parseNumber(cols[6]);
            installment_rate = cols.length > 7 ? parseNumber(cols[7]) : 0;
        }

        return {
            quantity,
            revenue_qd,
            revenue_actual,
            installment_revenue,
            installment_rate
        };
    };

    // Hàm ghi nhận kết quả và gộp trùng lặp nếu cùng 1 nhân viên xuất hiện nhiều dòng
    const addOrUpdateResult = (empInfo: { empId: string; fullName: string }, metrics: ReturnType<typeof extractMetrics>) => {
        const existingIdx = results.findIndex(r => r.employee_id === empInfo.empId);
        if (existingIdx >= 0) {
            results[existingIdx].quantity += metrics.quantity;
            results[existingIdx].revenue_qd = Number((results[existingIdx].revenue_qd + metrics.revenue_qd).toFixed(2));
            results[existingIdx].revenue_actual = Number((results[existingIdx].revenue_actual + metrics.revenue_actual).toFixed(2));
            results[existingIdx].installment_revenue = Number((results[existingIdx].installment_revenue + metrics.installment_revenue).toFixed(2));
            if (results[existingIdx].revenue_actual > 0) {
                results[existingIdx].installment_rate = Number(((results[existingIdx].installment_revenue / results[existingIdx].revenue_actual) * 100).toFixed(1));
            }
        } else {
            results.push({
                employee_id: empInfo.empId,
                full_name: empInfo.fullName,
                ...metrics
            });
        }
    };

    for (let i = 0; i < cleanLines.length; i++) {
        const line = cleanLines[i];

        // TRƯỜNG HỢP 1: Tất cả nằm trên 1 dòng duy nhất phân cách bằng Tab
        // Ví dụ: 27560 - Bùi Minh Lãm\t235\t2,141\t22.0%\t1,606\t0\t—\t482\t30.0%
        if (line.includes('\t')) {
            const parts = line.split('\t').map(p => p.trim());
            const empInfo = extractEmployeeInfo(parts[0]);
            if (empInfo && parts.length >= 5) {
                const cols = parts.slice(1);
                const metrics = extractMetrics(cols);
                addOrUpdateResult(empInfo, metrics);
                continue;
            }
        }

        // TRƯỜNG HỢP 2 & 3: Bắt đầu bằng dòng "Mã NV - Họ và tên"
        const empInfo = extractEmployeeInfo(line);
        if (empInfo) {
            // Kiểm tra dòng tiếp theo (Dòng 2) chứa các cột số liệu cách nhau bằng Tab hoặc 2+ khoảng trắng
            if (i + 1 < cleanLines.length) {
                const nextLine = cleanLines[i + 1];
                const nextCols = nextLine.split(/\t+|\s{2,}/).map(c => c.trim()).filter(Boolean);

                if (nextCols.length >= 4) {
                    const metrics = extractMetrics(nextCols);
                    addOrUpdateResult(empInfo, metrics);
                    i++; // Bỏ qua dòng 2 vì đã xử lý
                    continue;
                }
            }

            // TRƯỜNG HỢP 3: Khi người dùng copy bảng web mà mỗi ô dữ liệu thành 1 dòng riêng lẻ
            const collectedCols: string[] = [];
            let j = i + 1;
            while (j < cleanLines.length && collectedCols.length < 8) {
                const checkLine = cleanLines[j];
                // Dừng lại nếu gặp nhân viên tiếp theo
                if (extractEmployeeInfo(checkLine)) {
                    break;
                }
                collectedCols.push(checkLine);
                j++;
            }

            if (collectedCols.length >= 4) {
                const metrics = extractMetrics(collectedCols);
                addOrUpdateResult(empInfo, metrics);
                i = j - 1; // Nhảy con trỏ tới dòng số liệu cuối cùng đã gom
                continue;
            }
        }
    }

    return results;
}

/**
 * 2. BÓC TÁCH THI ĐUA NHÂN VIÊN (từ nv-thidua.txt)
 */
export function parseEmployeeCampaignText(rawText: string): {
    campaigns: ParsedCampaignBlock[];
    employee_campaign_matrix: Record<string, Record<string, number>>; // { [empId]: { [campaignName]: val } }
} {
    if (!rawText.trim()) return { campaigns: [], employee_campaign_matrix: {} };

    const lines = rawText.split(/\r?\n/).map(l => l.trim());
    const campaigns: ParsedCampaignBlock[] = [];
    let currentCampaign: ParsedCampaignBlock | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // Dòng header thi đua: "Bảo hiểm tổng \t DOANH THU \t HẠNG TRONG ST..."
        if (line.includes('\tDOANH THU\t') || line.includes('\tSỐ LƯỢNG\t')) {
            const parts = line.split('\t').map(p => p.trim());
            const campName = parts[0];
            const unitType = parts[1].toUpperCase().includes('SỐ LƯỢNG') ? 'SỐ LƯỢNG' : 'DOANH THU';

            currentCampaign = {
                campaign_name: campName,
                unit_type: unitType,
                employee_values: {}
            };
            campaigns.push(currentCampaign);
            continue;
        }

        if (!currentCampaign) continue;

        // Bỏ qua dòng TỔNG hoặc online
        if (line.startsWith('TỔNG\t') || line.toLowerCase().includes('online - 18001060')) {
            continue;
        }

        // Dòng nhân viên: "27560 - Bùi Minh Lãm \t 93.53 \t 1 \t TOP"
        const parts = line.split('\t').map(p => p.trim());
        if (parts.length >= 2) {
            const empRaw = parts[0];
            const match = empRaw.match(/^(\w+)\s*-\s*(.+)$/);
            if (match) {
                const empId = match[1].trim();
                const value = parseNumber(parts[1]);
                currentCampaign.employee_values[empId] = value;
            }
        }
    }

    // Xây dựng ma trận [empId][campaignName]
    const matrix: Record<string, Record<string, number>> = {};
    campaigns.forEach(camp => {
        Object.entries(camp.employee_values).forEach(([empId, val]) => {
            if (!matrix[empId]) matrix[empId] = {};
            matrix[empId][camp.campaign_name] = val;
        });
    });

    return { campaigns, employee_campaign_matrix: matrix };
}

/**
 * 3. BÓC TÁCH GIỜ CÔNG NHÂN VIÊN (từ nv-giocong.txt)
 * Hỗ trợ khử trùng lặp (Deduplicate) theo Ngày + Ca + Mã NV
 */
export function parseWorkHoursLogs(
    rawText: string,
    existingShiftKeys: Set<string> = new Set<string>()
): {
    newShiftLogs: WorkShiftLog[];
    totalHoursByEmp: Record<string, number>;
    duplicateCount: number;
} {
    if (!rawText.trim()) return { newShiftLogs: [], totalHoursByEmp: {}, duplicateCount: 0 };

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const newShiftLogs: WorkShiftLog[] = [];
    const totalHoursByEmp: Record<string, number> = {};
    let duplicateCount = 0;

    for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.startsWith('ngày') || lower.includes('tổng giờ công') || lower.startsWith('tổng:')) {
            continue;
        }

        const parts = line.split('\t').map(p => p.trim());
        if (parts.length < 9) continue;

        const date = parts[0];        // 2026/09/26
        const storeName = parts[2];   // 10335 - AAR_BRV_VTA - 290 Trương Công Định
        const empRaw = parts[3];      // 22838 - Trần Thị Sáu
        const shiftName = parts[7];   // Ca 1, Ca 2...
        const hours = parseNumber(parts[8]); // 0.97, 3, 1...

        const match = empRaw.match(/^(\w+)\s*-\s*(.+)$/);
        if (!match) continue;

        const empId = match[1].trim();
        const fullName = match[2].trim();

        // Khóa định danh chống trùng lặp ca
        const uniqueShiftKey = `${date}_${empId}_${shiftName}`;
        if (existingShiftKeys.has(uniqueShiftKey)) {
            duplicateCount++;
            continue;
        }

        existingShiftKeys.add(uniqueShiftKey);

        const log: WorkShiftLog = {
            date,
            store_name: storeName,
            employee_id: empId,
            full_name: fullName,
            department: parts[5] || '',
            job_title: parts[6] || '',
            shift_name: shiftName,
            hours
        };

        newShiftLogs.push(log);
        totalHoursByEmp[empId] = Number(((totalHoursByEmp[empId] || 0) + hours).toFixed(2));
    }

    return { newShiftLogs, totalHoursByEmp, duplicateCount };
}

function parseNumber(val: any): number {
    if (val === null || val === undefined) return 0;
    let str = String(val).trim();
    if (!str || str === '—' || str === '-' || str === 'N/A' || str === 'null') return 0;
    // Bỏ ký tự %, tiền tệ và khoảng trắng
    str = str.replace(/[%đĐ]/g, '').trim();

    // Xử lý số âm trong ngoặc đơn (1,500) -> -1,500
    if (/^\(.*\)$/.test(str)) {
        str = '-' + str.slice(1, -1).trim();
    }
    // Xử lý khoảng trắng giữa dấu trừ và số (- 1,500 -> -1,500)
    str = str.replace(/^-\s+/, '-');

    // Nếu dạng "30,5" hoặc "12,5" (1 dấu phẩy và theo sau là 1 hoặc 2 chữ số): chuyển thành dấu chấm thập phân
    if (/^-?\d+,\d{1,2}$/.test(str)) {
        str = str.replace(',', '.');
    } else {
        // Xóa dấu phẩy phân cách hàng nghìn (ví dụ "1,255.25" -> "1255.25", "2,141" -> "2141")
        str = str.replace(/,/g, '');
    }

    const num = Number(str);
    return isNaN(num) ? 0 : Number(num.toFixed(2));
}
