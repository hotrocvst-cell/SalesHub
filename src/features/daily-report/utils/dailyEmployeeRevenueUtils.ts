import { formatValue, formatDate, isStoreMatch } from '../../../core/lib/formatters';
import type { ParsedEmployeeRevenue } from '../../employee-cumulative/utils/employeeParsers';
import type { StoreItem } from '../../../core/lib/storage';

/**
 * Quy tắc rút gọn tên nhân viên báo cáo ngày:
 * - Chỉ lấy 1 từ sau cùng nếu từ áp chót là "Thị" (hoặc "thi")
 * - Ngược lại lấy 2 từ cuối cùng
 * Ví dụ:
 * - "Nguyễn Thị Hồng Loan" -> từ áp chót là "Hồng" -> "Hồng Loan"
 * - "Nguyễn Thị Loan" -> từ áp chót là "Thị" -> "Loan"
 * - "Trần Văn An" -> từ áp chót là "Văn" -> "Văn An"
 * - "Phạm Thị Thu" -> từ áp chót là "Thị" -> "Thu"
 */
export function formatDailyEmployeeShortName(fullName: string): string {
    if (!fullName) return '';
    const clean = fullName.trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return clean;

    const penultimate = parts[parts.length - 2].toLowerCase();
    if (penultimate === 'thị' || penultimate === 'thi') {
        return parts[parts.length - 1];
    }
    return parts.slice(-2).join(' ');
}

/**
 * Kiểm tra xem bản ghi có phải là nhân viên Online hay không
 */
export function isOnlineEmployee(emp: { employee_id?: string; full_name?: string }): boolean {
    const id = (emp.employee_id || '').toLowerCase().trim();
    const name = (emp.full_name || '').toLowerCase().trim();
    return id.includes('online') || name.includes('online');
}

export interface DailyReportEmployeeRow extends ParsedEmployeeRevenue {
    short_name: string;
    display_name: string;
    store_name?: string;
    contribution_rate: number; // % tỷ trọng DTQĐ trên tổng ST
    rank: number;
    is_top_30: boolean;
    is_below_avg: boolean;
    is_zero_or_negative: boolean;
    is_zero_installment: boolean;
    is_manual_shift_addition?: boolean; // Được thêm thủ công từ danh sách đi làm trong ca
}

export interface DailyReportSummary {
    totalRevenueQd: number;
    totalActualRevenue: number;
    totalInstallmentRevenue: number;
    avgInstallmentRate: number;
    avgRevenueQd: number;
    avgActualRevenue: number;
    totalQuantity: number;
    totalEmployees: number; // Tổng số nhân sự đi làm trong ca
    activeCount: number;    // Số nhân sự có phát sinh doanh số
    zeroOrNegCount: number; // Số nhân sự DTQĐ <= 0
    belowAvgCount: number;  // Số nhân sự DTQĐ dưới trung bình
    zeroInstallmentCount: number; // Số nhân sự chưa có trả góp
    top30Count: number;
}

/**
 * Tính toán & phân loại toàn bộ số liệu báo cáo ngày từ danh sách bóc tách
 * Hỗ trợ lọc theo siêu thị và bổ sung nhân sự đi làm trong ca nhưng chưa có doanh thu
 */
export function processDailyEmployeeRevenueData(
    rawList: ParsedEmployeeRevenue[],
    options?: {
        selectedStore?: string;
        empStoreMap?: Record<string, string>;
        storesList?: StoreItem[];
        detectedStoreName?: string;
        additionalZeroEmployees?: Array<{ employee_id: string; full_name: string; store_name?: string }>;
        manualShiftEmpIds?: Set<string>;
    }
): {
    analyzedEmployees: DailyReportEmployeeRow[];
    allShiftEmployees: DailyReportEmployeeRow[];
    top30Employees: DailyReportEmployeeRow[];
    belowAvgEmployees: DailyReportEmployeeRow[];
    zeroOrNegativeEmployees: DailyReportEmployeeRow[];
    zeroInstallmentEmployees: DailyReportEmployeeRow[];
    summary: DailyReportSummary;
} {
    const selectedStore = options?.selectedStore || 'all';
    const empStoreMap = options?.empStoreMap || {};
    const storesList = options?.storesList || [];
    const detectedStoreName = options?.detectedStoreName || '';
    const additionalZeroEmployees = options?.additionalZeroEmployees || [];
    const manualShiftEmpIds = options?.manualShiftEmpIds;

    // 1. Lọc bỏ các dòng Online từ danh sách thô
    const nonOnline = rawList.filter(e => !isOnlineEmployee(e));

    // 2. Lọc theo siêu thị (nếu có chọn siêu thị cụ thể)
    const storeFiltered = nonOnline.filter(e => {
        if (selectedStore === 'all') return true;
        const empId = e.employee_id.trim();
        const empStore = empStoreMap[empId];
        if (empStore) {
            return isStoreMatch(empStore, selectedStore, storesList);
        }
        // Nếu nhân viên chưa có trong danh bạ, kiểm tra theo siêu thị nhận diện được từ báo cáo
        if (detectedStoreName) {
            return isStoreMatch(detectedStoreName, selectedStore, storesList);
        }
        return false;
    });

    // 3. Tích hợp các nhân viên được chọn thủ công (có đi làm trong ca)
    // Mặc định chỉ nhận các nhân viên được chọn trong danh sách điểm danh ca
    const existingEmpIds = new Set(storeFiltered.map(e => e.employee_id.trim()));
    const seenMergedIds = new Set<string>();
    const mergedList: ParsedEmployeeRevenue[] = [];

    storeFiltered.forEach(emp => {
        const id = emp.employee_id.trim();
        // Nếu có danh sách điểm danh ca: chỉ lấy những ai được chọn (hoặc mặc định có DTQĐ khác 0)
        if (!manualShiftEmpIds || manualShiftEmpIds.has(id)) {
            if (!seenMergedIds.has(id)) {
                seenMergedIds.add(id);
                mergedList.push(emp);
            }
        }
    });

    // Bổ sung các nhân viên có đi làm trong ca nhưng không có trong báo cáo dán
    additionalZeroEmployees.forEach(extra => {
        const id = extra.employee_id.trim();
        if (!existingEmpIds.has(id) && !seenMergedIds.has(id)) {
            if (!manualShiftEmpIds || manualShiftEmpIds.has(id)) {
                seenMergedIds.add(id);
                existingEmpIds.add(id);
                mergedList.push({
                    employee_id: id,
                    full_name: extra.full_name,
                    quantity: 0,
                    revenue_qd: 0,
                    revenue_actual: 0,
                    installment_revenue: 0,
                    installment_rate: 0
                });
            }
        }
    });

    // 4. Phân nhóm rõ ràng, KHÔNG TRÙNG LẶP:
    // - activeList: Nhân viên có DTQĐ DƯƠNG (> 0) (dùng xếp hạng Top 30% & tính dưới trung bình)
    // - zeroOrNegList: Nhân viên có DTQĐ <= 0 (chưa phát sinh hoặc bị âm)
    const activeList = mergedList.filter(e => e.revenue_qd > 0);
    const zeroOrNegList = mergedList.filter(e => e.revenue_qd <= 0);

    // Tính tổng số liệu của toàn bộ ca làm việc (bao gồm cả nhân viên bị âm do trả hàng)
    const totalRevenueQd = mergedList.reduce((s, e) => s + (e.revenue_qd || 0), 0);
    const totalActualRevenue = mergedList.reduce((s, e) => s + (e.revenue_actual || 0), 0);
    const totalInstallmentRevenue = mergedList.reduce((s, e) => s + (e.installment_revenue || 0), 0);
    const totalQuantity = mergedList.reduce((s, e) => s + (e.quantity || 0), 0);

    const activeCount = activeList.length;
    // Mức TB: Chỉ tính theo trung bình của các nhân sự có phát sinh doanh thu (activeList)
    const activeRevenueQd = activeList.reduce((s, e) => s + (e.revenue_qd || 0), 0);
    const activeActualRevenue = activeList.reduce((s, e) => s + (e.revenue_actual || 0), 0);
    const avgRevenueQd = activeCount > 0 ? Number((activeRevenueQd / activeCount).toFixed(2)) : 0;
    const avgActualRevenue = activeCount > 0 ? Number((activeActualRevenue / activeCount).toFixed(2)) : 0;
    const avgInstallmentRate = totalActualRevenue > 0
        ? Number(((totalInstallmentRevenue / totalActualRevenue) * 100).toFixed(1))
        : 0;

    // 5. Sắp xếp nhóm có doanh thu giảm dần theo DTQĐ
    const sortedActive = [...activeList].sort((a, b) => b.revenue_qd - a.revenue_qd);

    // Xác định số lượng Top 30%
    const top30Count = activeCount > 0 ? Math.max(1, Math.round(activeCount * 0.3)) : 0;

    // 6. Gắn trường mở rộng cho nhóm có doanh thu
    const analyzedEmployees: DailyReportEmployeeRow[] = sortedActive.map((emp, idx) => {
        const shortName = formatDailyEmployeeShortName(emp.full_name);
        const displayName = `${emp.employee_id} - ${shortName}`;
        const contributionRate = totalRevenueQd > 0
            ? Number(((emp.revenue_qd / totalRevenueQd) * 100).toFixed(1))
            : 0;
        const rank = idx + 1;
        const isTop30 = rank <= top30Count;
        const isBelowAvg = emp.revenue_qd < avgRevenueQd && emp.revenue_qd > 0;
        const isZeroOrNeg = false;
        const isZeroInstallment = (emp.installment_revenue <= 0 || emp.installment_rate === 0);

        return {
            ...emp,
            short_name: shortName,
            display_name: displayName,
            store_name: empStoreMap[emp.employee_id.trim()] || detectedStoreName,
            contribution_rate: contributionRate,
            rank,
            is_top_30: isTop30,
            is_below_avg: isBelowAvg,
            is_zero_or_negative: isZeroOrNeg,
            is_zero_installment: isZeroInstallment,
            is_manual_shift_addition: false
        };
    });

    const top30Employees = analyzedEmployees.filter(e => e.is_top_30);
    const belowAvgEmployees = analyzedEmployees.filter(e => e.is_below_avg);

    // 7. Gắn trường mở rộng cho nhóm DTQĐ <= 0 (nhân viên chưa có số hoặc bị âm)
    const zeroOrNegativeEmployees: DailyReportEmployeeRow[] = zeroOrNegList.map((emp, idx) => {
        const shortName = formatDailyEmployeeShortName(emp.full_name);
        const isManual = additionalZeroEmployees.some(a => a.employee_id.trim() === emp.employee_id.trim());

        return {
            ...emp,
            short_name: shortName,
            display_name: `${emp.employee_id} - ${shortName}`,
            store_name: empStoreMap[emp.employee_id.trim()] || detectedStoreName,
            contribution_rate: 0,
            rank: activeCount + idx + 1,
            is_top_30: false,
            is_below_avg: false,
            is_zero_or_negative: true,
            is_zero_installment: true,
            is_manual_shift_addition: isManual
        };
    });

    // Toàn bộ nhân viên trong ca làm việc hiển thị trên bảng (Khử trùng lặp tuyệt đối theo employee_id)
    const seenEmpIds = new Set<string>();
    const allShiftEmployees: DailyReportEmployeeRow[] = [];
    [...analyzedEmployees, ...zeroOrNegativeEmployees].forEach(emp => {
        const id = emp.employee_id.trim();
        if (!seenEmpIds.has(id)) {
            seenEmpIds.add(id);
            allShiftEmployees.push(emp);
        }
    });

    // Nhóm chưa có trả góp: Bao gồm tất cả nhân sự đi làm trong ca chưa phát sinh trả góp (cả nhóm có DTQĐ nhưng 0% trả góp lẫn nhóm chưa có DT)
    const zeroInstallmentEmployees = allShiftEmployees.filter(e => e.is_zero_installment);

    const summary: DailyReportSummary = {
        totalRevenueQd: Number(totalRevenueQd.toFixed(2)),
        totalActualRevenue: Number(totalActualRevenue.toFixed(2)),
        totalInstallmentRevenue: Number(totalInstallmentRevenue.toFixed(2)),
        avgInstallmentRate,
        avgRevenueQd,
        avgActualRevenue,
        totalQuantity,
        totalEmployees: allShiftEmployees.length,
        activeCount,
        zeroOrNegCount: zeroOrNegativeEmployees.length,
        belowAvgCount: belowAvgEmployees.length,
        zeroInstallmentCount: zeroInstallmentEmployees.length,
        top30Count
    };

    return {
        analyzedEmployees,
        allShiftEmployees,
        top30Employees,
        belowAvgEmployees,
        zeroOrNegativeEmployees,
        zeroInstallmentEmployees,
        summary
    };
}

/**
 * Tạo văn bản tin nhắn báo cáo Messaging App chuẩn phong cách TGDD/ĐMX
 */
export function generateDailyZaloText(
    storeName: string,
    reportDate: string,
    summary: DailyReportSummary,
    top30: DailyReportEmployeeRow[],
    belowAvg: DailyReportEmployeeRow[],
    zeroOrNeg: DailyReportEmployeeRow[],
    zeroInstallment: DailyReportEmployeeRow[]
): string {
    const formattedDate = formatDate(reportDate) || reportDate;

    // Top 30% text
    const topText = top30.map((e) => {
        const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `🎖️ #${e.rank}`;
        return `   ${medal} ${e.display_name}: ${formatValue(e.revenue_qd)} tr | ${formatValue(e.installment_revenue)} tr (${e.installment_rate}%)`;
    }).join('\n');

    // Dưới trung bình text
    let belowAvgNames = '';
    if (belowAvg.length > 0) {
        belowAvgNames = belowAvg.map(e => `${e.short_name} (${formatValue(e.revenue_qd)} tr)`).join('\n   👉 ');
    } else if (summary.totalEmployees === 0 || summary.activeCount === 0) {
        belowAvgNames = 'Chưa có nhân sự nào phát sinh số';
    } else if (summary.zeroOrNegCount > 0) {
        belowAvgNames = 'Không có (các bạn đã nổ số đều đạt mức TB trở lên)';
    } else {
        belowAvgNames = 'Không có (100% nhân sự trong ca đều đạt mức TB trở lên)';
    }

    // DTQĐ <= 0 text
    const zeroOrNegNames = zeroOrNeg.length > 0
        ? zeroOrNeg.map(e => `${e.short_name} (${formatValue(e.revenue_qd)} tr)`).join('\n   👉 ')
        : 'Không có (100% nhân sự đều đã phát sinh số)';

    // 0% Trả góp text
    let zeroInstallmentNames = '';
    if (zeroInstallment.length > 0) {
        zeroInstallmentNames = zeroInstallment.map(e => `${e.short_name} (${formatValue(e.revenue_qd)} tr)`).join('\n   👉 ');
    } else if (summary.totalEmployees === 0 || summary.activeCount === 0) {
        zeroInstallmentNames = 'Chưa có nhân sự nào phát sinh doanh thu trong ca';
    } else {
        zeroInstallmentNames = 'Không có (100% nhân sự trong ca đều có hợp đồng trả góp)';
    }

    return `📢 DOANH THU NHÂN VIÊN (${formattedDate})
🏢 ${storeName}

💰 Doanh Thu Thực: ${formatValue(summary.totalActualRevenue)} tr
💎 DTQĐ: ${formatValue(summary.totalRevenueQd)} tr (TB: ${formatValue(summary.avgRevenueQd)} tr/nv)
💳 DT Trả Chậm: ${formatValue(summary.totalInstallmentRevenue)} tr (${summary.avgInstallmentRate}%)

🏆 TOP DẪN ĐẦU: (DTQĐ | Trả chậm)
${topText}

⚡ TRỌNG TÂM NHẮC NHỞ TĂNG TỐC:
⚠️ 1. Nhóm DTQĐ dưới trung bình (${summary.belowAvgCount} bạn < ${formatValue(summary.avgRevenueQd)} tr):
   👉 ${belowAvgNames}

🚨 2. Nhóm DT bất ổn (${summary.zeroOrNegCount} bạn):
   👉 ${zeroOrNegNames}

💳 3. Nhóm chưa có trả góp (${summary.zeroInstallmentCount} bạn):
   👉 ${zeroInstallmentNames}

`;
}
