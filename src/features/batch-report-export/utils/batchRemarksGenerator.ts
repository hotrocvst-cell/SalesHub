import type { BusinessDayRecord, CampaignDictItem } from '../../../core/lib/storage';
import type { EmployeePerformanceRow, StorePerformanceSummary } from '../../employee-performance/types';
import type { CampaignSummaryData } from '../../campaign-summary/types';
import { generateSmartRemarks } from '../../campaign-summary/utils/campaignSummaryStorage';
import { formatValue, getShortStoreName, cleanEmployeeName, getShortenedEmployeeName } from '../../../core/lib/formatters';
import type { BatchReportKey, BatchReportCustomOptions, ReportRemarkItem } from '../types';

/**
 * 1. Nhận xét Báo Cáo Doanh Thu Ngày
 */
export function generateDailyRemarks(
    record: BusinessDayRecord | null,
    selectedStore: string,
    selectedDate: string
): string {
    const storeLabel = getShortStoreName(selectedStore);
    if (!record) {
        return `📢 [ST ${storeLabel}] Chưa có dữ liệu ghi nhận cho ngày ${selectedDate.split('-').reverse().join('/')}.`;
    }

    const revReal = record.revenueActual || 0;
    const revQd = record.revenueActual || 0;
    const target = record.revenueTarget || 0;
    const pct = target > 0 ? Number(((revQd / target) * 100).toFixed(1)) : 0;
    const inst = record.revenueInstallment || 0;
    const instRate = record.installmentRate || (revReal > 0 ? Number(((inst / revReal) * 100).toFixed(1)) : 0);

    const emulationEntries = Object.entries(record.emulationSummary || {});
    const passedCats = emulationEntries.filter(([_, v]) => (v.pctDK || 0) >= 100);
    const slowCats = emulationEntries.filter(([_, v]) => (v.pctDK || 0) < 100);

    let txt = `⚡ [ST ${storeLabel}] - BÁO CÁO DOANH THU & THI ĐUA NGÀY ${selectedDate.split('-').reverse().join('/')}\n`;
    txt += `💰 DTQĐ: ${formatValue(revQd)} tr / Target: ${formatValue(target)} tr (%HT: ${pct}%)\n`;
    txt += `💳 Doanh thu trả góp: ${formatValue(inst)} tr (Tỷ lệ: ${instRate}%)\n`;

    if (emulationEntries.length > 0) {
        txt += `🎯 Thi đua ngày: Đạt ${passedCats.length}/${emulationEntries.length} ngành hàng (${Math.round((passedCats.length / emulationEntries.length) * 100)}%)\n`;
        if (slowCats.length > 0) {
            txt += `🔥 Cần tập trung tăng tốc các ngành:\n`;
            slowCats.slice(0, 5).forEach(([name, v]) => {
                txt += ` - ${name}: Đạt ${v.pctDK || 0}% (Thiếu ${formatValue(Math.max(0, v.target - v.actual))} tr)\n`;
            });
        } else {
            txt += `🎉 Xuất sắc! Tất cả ngành hàng thi đua đều hoàn thành mục tiêu ngày!\n`;
        }
    }

    return txt.trim();
}

/**
 * 2. Nhận xét Báo Cáo Hiệu Quả Nhân Viên
 */
export function generateEmployeePerformanceRemarks(
    rows: EmployeePerformanceRow[],
    summary: StorePerformanceSummary | null,
    selectedStore: string,
    selectedMonth: number,
    selectedYear: number,
    showWorkHours: boolean = false
): string {
    const storeLabel = getShortStoreName(selectedStore);
    if (!rows || rows.length === 0) {
        return `🏆 [ST ${storeLabel}] Chưa có dữ liệu nhân sự trong tháng ${selectedMonth}/${selectedYear}.`;
    }

    let txt = `🏆 [ST ${storeLabel}] - VINH DANH & HIỆU QUẢ NHÂN SỰ THÁNG ${selectedMonth}/${selectedYear}\n`;
    txt += `👥 Quy mô nhân sự: ${rows.length} nhân viên\n\n`;

    if (summary) {
        if (summary.topRevenueEmp) {
            txt += `👑 Top 1 DTQĐ: ${getShortenedEmployeeName(summary.topRevenueEmp.full_name)} (${formatValue(summary.topRevenueEmp.revenue_qd)} tr)\n`;
        }
        if (summary.topForecastEmp) {
            txt += `🎯 Top 1 %DKHT: ${getShortenedEmployeeName(summary.topForecastEmp.full_name)} (${summary.topForecastEmp.forecast_completion_rate}%)\n`;
        }
        if (showWorkHours && summary.topProductivityEmp) {
            txt += `⚡ Top 1 Năng suất: ${getShortenedEmployeeName(summary.topProductivityEmp.full_name)} (${summary.topProductivityEmp.productivity_qd_per_hour} tr/h)\n`;
        }
        if (summary.topInstallmentEmp) {
            txt += `💳 Top 1 Trả chậm: ${getShortenedEmployeeName(summary.topInstallmentEmp.full_name)} (${formatValue(summary.topInstallmentEmp.installment_revenue)} tr)\n`;
        }
    }

    const topGroup = rows.filter(r => r.top_bot_status === 'TOP');
    if (topGroup.length > 0) {
        txt += `\n🌟 Nhóm xuất sắc dẫn đầu (TOP):\n`;
        topGroup.forEach(r => {
            txt += ` • ${getShortenedEmployeeName(r.full_name)}: ${formatValue(r.revenue_qd)} tr (%DKHT: ${r.forecast_completion_rate}%)\n`;
        });
    }

    const botGroup = rows.filter(r => r.top_bot_status === 'BOT');
    if (botGroup.length > 0) {
        txt += `\n⚠️ Nhóm cần đôn đốc tăng tốc:\n`;
        botGroup.forEach(r => {
            txt += ` • ${getShortenedEmployeeName(r.full_name)}: ${formatValue(r.revenue_qd)} tr (%DKHT: ${r.forecast_completion_rate}%)\n`;
        });
    }

    return txt.trim();
}

/**
 * 3. Nhận xét Báo Cáo Doanh Thu Tháng
 */
export function generateMonthlyRemarks(
    latestRecord: BusinessDayRecord | null,
    selectedStore: string,
    selectedMonth: number,
    selectedYear: number
): string {
    const storeLabel = getShortStoreName(selectedStore);
    if (!latestRecord) {
        return `📊 [ST ${storeLabel}] Chưa có dữ liệu lũy kế tháng ${selectedMonth}/{selectedYear}.`;
    }

    const target = latestRecord.revenueTarget || 0;
    const revQd = latestRecord.revenueActual || 0;
    const pct = target > 0 ? Number(((revQd / target) * 100).toFixed(1)) : 0;
    const remaining = Math.max(0, target - revQd);

    const recordDay = latestRecord.reportDate ? Number(latestRecord.reportDate.split('-')[2]) : 1;
    const totalDays = new Date(selectedYear, selectedMonth, 0).getDate();
    const remainingDays = Math.max(1, totalDays - recordDay);
    const requiredPace = remaining > 0 ? Number((remaining / remainingDays).toFixed(1)) : 0;

    let txt = `📊 [ST ${storeLabel}] - TIẾN ĐỘ KINH DOANH THÁNG ${selectedMonth}/${selectedYear}\n`;
    txt += `(Lũy kế đến ngày ${latestRecord.reportDate ? latestRecord.reportDate.split('-').reverse().join('/') : ''})\n\n`;
    txt += `💰 DTQĐ Lũy kế: ${formatValue(revQd)} tr / Target: ${formatValue(target)} tr (%HT: ${pct}%)\n`;
    txt += `🎯 Còn lại cần hoàn thành: ${formatValue(remaining)} tr\n`;
    txt += `⏳ Số ngày còn lại trong tháng: ${remainingDays} ngày\n`;
    txt += `🚀 Nhịp doanh thu cần đạt: ${formatValue(requiredPace)} tr/ngày\n`;

    return txt.trim();
}

/**
 * 4. Nhận xét Tổng Hợp Thi Đua Trọng Tâm
 */
export function generateCampaignRemarks(
    campaignSummary: CampaignSummaryData | null,
    campaignDict: CampaignDictItem[] = [],
    selectedStore: string
): string {
    const storeLabel = getShortStoreName(selectedStore);
    if (!campaignSummary || !campaignSummary.rows || campaignSummary.rows.length === 0) {
        return `🏆 [ST ${storeLabel}] Chưa có phiên dữ liệu thi đua trọng tâm.`;
    }

    const remarksAnalysis = generateSmartRemarks(campaignSummary, campaignDict);
    if (remarksAnalysis.recommendedZaloText) {
        return remarksAnalysis.recommendedZaloText.trim();
    }

    const rows = campaignSummary.rows;
    const avgRate = Number((rows.reduce((s, r) => s + r.achievement_rate, 0) / (rows.length || 1)).toFixed(1));
    const topPerformer = [...rows].sort((a, b) => b.achievement_rate - a.achievement_rate)[0];

    let txt = `🏆 [ST ${storeLabel}] - TỔNG HỢP TIẾN ĐỘ THI ĐUA TRỌNG TÂM\n`;
    txt += `👥 Nhân sự tham gia: ${rows.length} | Tỷ lệ đạt bình quân: ${avgRate}%\n`;
    if (topPerformer) {
        txt += `🥇 Dẫn đầu thi đua: ${getShortenedEmployeeName(topPerformer.full_name)} (Đạt ${topPerformer.achievement_rate}%)\n`;
    }
    return txt.trim();
}

/**
 * 5. Nhận xét Nhịp Doanh Thu & Diễn Biến
 */
export function generateRevenueTrendRemarks(
    records: BusinessDayRecord[],
    selectedStore: string,
    selectedMonth: number,
    selectedYear: number
): string {
    const storeLabel = getShortStoreName(selectedStore);
    if (!records || records.length === 0) {
        return `📈 [ST ${storeLabel}] Chưa có dữ liệu nhịp doanh thu tháng ${selectedMonth}/${selectedYear}.`;
    }

    const totalQd = records.reduce((s, r) => s + (r.revenueActual || 0), 0);
    const target = records.reduce((s, r) => s + (r.revenueTarget || 0), 0);
    const avgPace = Number((totalQd / (records.length || 1)).toFixed(2));

    const sortedByRev = [...records].sort((a, b) => (b.revenueActual || 0) - (a.revenueActual || 0));
    const bestDay = sortedByRev[0];
    const lowestDay = sortedByRev[sortedByRev.length - 1];

    let txt = `📈 [ST ${storeLabel}] - DIỄN BIẾN NHỊP DOANH THU THÁNG ${selectedMonth}/${selectedYear}\n`;
    txt += `📅 Tổng số ngày ghi nhận: ${records.length} ngày\n`;
    txt += `💰 Tổng DTQĐ: ${formatValue(totalQd)} tr | Nhịp TB: ${formatValue(avgPace)} tr/ngày\n`;
    if (bestDay) {
        txt += `🔥 Ngày cao nhất: Ngày ${bestDay.reportDate?.split('-')[2]} (${formatValue(bestDay.revenueActual)} tr)\n`;
    }
    if (lowestDay) {
        txt += `⚠️ Ngày thấp nhất: Ngày ${lowestDay.reportDate?.split('-')[2]} (${formatValue(lowestDay.revenueActual)} tr)\n`;
    }

    return txt.trim();
}

/**
 * 6. Gom toàn bộ nhận xét của các báo cáo được chọn thành 1 tin nhắn tổng hợp duy nhất
 */
export function generateCombinedRemarks(
    checkedKeys: Set<BatchReportKey>,
    options: BatchReportCustomOptions,
    data: {
        dailyRecord: BusinessDayRecord | null;
        performanceRows: EmployeePerformanceRow[];
        performanceSummary: StorePerformanceSummary | null;
        monthlyRecords: BusinessDayRecord[];
        campaignSummary: CampaignSummaryData | null;
        campaignDict: CampaignDictItem[];
        trendRecords: BusinessDayRecord[];
        selectedStore: string;
        selectedDate: string;
        selectedMonth: number;
        selectedYear: number;
    }
): string {
    const storeLabel = getShortStoreName(data.selectedStore);
    const divider = '\n\n═══════════════════════════\n\n';
    const sections: string[] = [];

    const header = `📢 BÁO CÁO KINH DOANH TỔNG HỢP • ST ${storeLabel.toUpperCase()}\nKỳ: Ngày ${data.selectedDate.split('-').reverse().join('/')} • Tháng ${data.selectedMonth}/${data.selectedYear}`;
    sections.push(header);

    if (checkedKeys.has('DAILY_REPORT')) {
        sections.push(generateDailyRemarks(data.dailyRecord, data.selectedStore, data.selectedDate));
    }

    if (checkedKeys.has('EMPLOYEE_PERFORMANCE')) {
        sections.push(generateEmployeePerformanceRemarks(
            data.performanceRows,
            data.performanceSummary,
            data.selectedStore,
            data.selectedMonth,
            data.selectedYear,
            options.employeePerformance.showWorkHours
        ));
    }

    if (checkedKeys.has('MONTHLY_REPORT')) {
        const latestRecord = [...data.monthlyRecords].sort((a, b) => (b.reportDate || '').localeCompare(a.reportDate || ''))[0] || null;
        sections.push(generateMonthlyRemarks(latestRecord, data.selectedStore, data.selectedMonth, data.selectedYear));
    }

    if (checkedKeys.has('CAMPAIGN_SUMMARY')) {
        sections.push(generateCampaignRemarks(data.campaignSummary, data.campaignDict, data.selectedStore));
    }

    if (checkedKeys.has('REVENUE_TREND')) {
        sections.push(generateRevenueTrendRemarks(data.trendRecords, data.selectedStore, data.selectedMonth, data.selectedYear));
    }

    return sections.join(divider).trim();
}
