import type {
    QuarterPreset,
    QuarterlyEmployeeRow,
    QuarterlySummary,
    MonthlyRevenueDetail,
    MonthlyEmulationDetail,
    CampaignSummaryDetail,
    MonthlyCampaignDetail
} from '../types';
import type { EmployeeDataSession } from '../../employee-cumulative/utils/sessionStorage';
import type { EmployeeItem, CampaignDictItem, StoreItem } from '../../../core/lib/storage';
import { isStoreMatch, cleanEmployeeName, getShortenedEmployeeName } from '../../../core/lib/formatters';
import { isGuestDemoStore } from '../../../core/lib/guestDemoStoreService';

export function getPresetMonths(
    preset: QuarterPreset,
    year: number,
    customStart = 1,
    customEnd = 12
): { startMonth: number; endMonth: number; months: number[]; label: string } {
    switch (preset) {
        case 'Q1':
            return { startMonth: 1, endMonth: 3, months: [1, 2, 3], label: `Quý 1/${year} (T1 - T3)` };
        case 'Q2':
            return { startMonth: 4, endMonth: 6, months: [4, 5, 6], label: `Quý 2/${year} (T4 - T6)` };
        case 'Q3':
            return { startMonth: 7, endMonth: 9, months: [7, 8, 9], label: `Quý 3/${year} (T7 - T9)` };
        case 'Q4':
            return { startMonth: 10, endMonth: 12, months: [10, 11, 12], label: `Quý 4/${year} (T10 - T12)` };
        case 'H1':
            return { startMonth: 1, endMonth: 6, months: [1, 2, 3, 4, 5, 6], label: `6 Tháng Đầu Năm ${year} (T1 - T6)` };
        case 'H2':
            return { startMonth: 7, endMonth: 12, months: [7, 8, 9, 10, 11, 12], label: `6 Tháng Cuối Năm ${year} (T7 - T12)` };
        case 'YEAR':
            return { startMonth: 1, endMonth: 12, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], label: `Cả Năm ${year} (T1 - T12)` };
        case 'CUSTOM':
        default: {
            const start = Math.min(Math.max(1, customStart), 12);
            const end = Math.min(Math.max(start, customEnd), 12);
            const months: number[] = [];
            for (let m = start; m <= end; m++) months.push(m);
            return { startMonth: start, endMonth: end, months, label: `Kỳ T${start} - T${end}/${year}` };
        }
    }
}

export function getCurrentQuarterPreset(month: number): QuarterPreset {
    if (month >= 1 && month <= 3) return 'Q1';
    if (month >= 4 && month <= 6) return 'Q2';
    if (month >= 7 && month <= 9) return 'Q3';
    return 'Q4';
}

interface AggregateParams {
    months: number[];
    year: number;
    monthlySessions: Record<number, EmployeeDataSession[]>;
    monthlyRevTargets: Record<number, Record<string, number>>;
    monthlyCampTargets: Record<number, Record<string, Record<string, number>>>;
    employees: EmployeeItem[];
    campaignDict: CampaignDictItem[];
    selectedStore: string;
    storesList: StoreItem[];
    isGuest?: boolean;
}

export function aggregateQuarterlyRankingData(params: AggregateParams): {
    rows: QuarterlyEmployeeRow[];
    summary: QuarterlySummary;
} {
    const {
        months,
        monthlySessions,
        monthlyRevTargets,
        monthlyCampTargets,
        employees,
        campaignDict,
        selectedStore,
        storesList,
        isGuest = false
    } = params;

    // 1. Lọc phiên hợp lệ theo ST cho từng tháng và lấy record mới nhất của từng nhân viên
    const monthlyEmpRecords: Record<number, Record<string, any>> = {};

    months.forEach(m => {
        const rawSessions = monthlySessions[m] || [];
        const validSessions = rawSessions.filter(sess => {
            if (sess.session_type !== 'REVENUE_CAMPAIGN' && sess.session_type !== 'FULL_SYNC') {
                return false;
            }
            const isDemo = isGuestDemoStore(sess.store_name);
            if (isGuest) return isDemo;
            if (isDemo) return false;

            if (!selectedStore || selectedStore === 'all') return true;
            return isStoreMatch(sess.store_name, selectedStore, storesList);
        });

        const sorted = validSessions.slice().sort((a, b) =>
            (b.report_date || '').localeCompare(a.report_date || '') ||
            (b.created_at || '').localeCompare(a.created_at || '')
        );

        const empMap: Record<string, any> = {};
        sorted.forEach(sess => {
            if (Array.isArray(sess.records)) {
                sess.records.forEach(r => {
                    const k = (r.employee_id || '').trim();
                    if (k && !empMap[k]) {
                        empMap[k] = { ...r, store_name: r.store_name || sess.store_name };
                    }
                });
            }
        });

        monthlyEmpRecords[m] = empMap;
    });

    // 2. Thu thập danh sách toàn bộ nhân viên xuất hiện trong kỳ
    const allEmpIds = new Set<string>();

    employees.forEach(e => {
        if (!e.employee_id) return;
        const empStore = e.store_name || '';
        if (selectedStore && selectedStore !== 'all') {
            if (!isStoreMatch(empStore, selectedStore, storesList)) return;
        }
        allEmpIds.add(e.employee_id.trim());
    });

    months.forEach(m => {
        Object.keys(monthlyEmpRecords[m] || {}).forEach(id => allEmpIds.add(id));
    });

    const empInfoMap: Record<string, { name: string; store: string; title: string }> = {};
    employees.forEach(e => {
        if (e.employee_id) {
            empInfoMap[e.employee_id.trim()] = {
                name: e.full_name || '',
                store: e.store_name || '',
                title: e.job_title || 'Nhân viên'
            };
        }
    });

    // 3. Xây dựng dữ liệu lũy kế cho từng nhân viên
    const rawRows: QuarterlyEmployeeRow[] = [];

    allEmpIds.forEach(empId => {
        let fullName = empInfoMap[empId]?.name || '';
        let storeName = empInfoMap[empId]?.store || '';
        let jobTitle = empInfoMap[empId]?.title || 'Nhân viên';

        for (const m of months) {
            const rec = monthlyEmpRecords[m]?.[empId];
            if (rec) {
                if (!fullName && rec.full_name) fullName = rec.full_name;
                if (!storeName && rec.store_name) storeName = rec.store_name;
                if (rec.job_title) jobTitle = rec.job_title;
            }
        }

        if (!fullName) fullName = `NV ${empId}`;

        if (selectedStore && selectedStore !== 'all') {
            if (!isStoreMatch(storeName, selectedStore, storesList)) {
                return;
            }
        }

        // Doanh thu
        let totalRevenueQd = 0;
        let totalRevenueActual = 0;
        let totalTargetRevenue = 0;
        let monthsAchievedCount = 0;
        const monthDetails: MonthlyRevenueDetail[] = [];

        // Thi đua (Tính theo tổng đã đạt / tổng mục tiêu, không đo theo CT cụ thể)
        let totalEmulationAchieved = 0;
        let totalEmulationTarget = 0;
        let emulationMonthsAchievedCount = 0;
        const emulationMonthDetails: MonthlyEmulationDetail[] = [];

        // Gom các chiến dịch thi đua cho chi tiết (nếu cần tra cứu phụ)
        const campMap: Record<string, { target: number; actual: number; byMonth: Record<number, MonthlyCampaignDetail> }> = {};

        months.forEach(m => {
            const rec = monthlyEmpRecords[m]?.[empId];
            const revQd = Number(rec?.revenue_qd) || 0;
            const revActual = Number(rec?.revenue_actual) || 0;
            const revTarget = Number(monthlyRevTargets[m]?.[empId]) || 0;

            totalRevenueQd += revQd;
            totalRevenueActual += revActual;
            totalTargetRevenue += revTarget;

            const mRate = revTarget > 0 ? (revQd / revTarget) * 100 : revQd > 0 ? 100 : 0;
            const isAchieved = revTarget > 0 ? revQd >= revTarget : revQd > 0;
            if (isAchieved) monthsAchievedCount++;

            monthDetails.push({
                month: m,
                monthLabel: `T${m}`,
                revenueQd: Math.round(revQd * 10) / 10,
                revenueActual: Math.round(revActual * 10) / 10,
                targetRevenue: Math.round(revTarget * 10) / 10,
                completionRate: Math.round(mRate * 10) / 10,
                isAchieved
            });

            // Thi đua trong tháng m: tính tổng đã đạt / tổng mục tiêu
            const monthCampTargets = monthlyCampTargets[m]?.[empId] || {};
            const monthCampActuals = rec?.campaigns || {};

            let monthAchieved = 0;
            let monthTarget = 0;

            // Đếm các mục tiêu giao có giá trị > 0
            Object.entries(monthCampTargets).forEach(([rawKey, targetVal]) => {
                const tVal = Number(targetVal) || 0;
                if (tVal > 0) {
                    monthTarget++;
                    const actVal = Number(monthCampActuals[rawKey]) || 0;
                    if (actVal >= tVal) {
                        monthAchieved++;
                    }
                }
            });

            // Nếu tháng không có target giao nhưng có actuals
            if (monthTarget === 0) {
                const actKeys = Object.keys(monthCampActuals).filter(k => (Number(monthCampActuals[k]) || 0) > 0);
                if (actKeys.length > 0) {
                    monthTarget = actKeys.length;
                    monthAchieved = actKeys.length;
                }
            }

            const monthEmuRate = monthTarget > 0
                ? Math.round((monthAchieved / monthTarget) * 1000) / 10
                : 0;

            // Đạt chuẩn phong độ thi đua tháng nếu tỷ lệ đạt >= 60%
            const isMonthEmuAchieved = monthTarget > 0
                ? monthEmuRate >= 60
                : monthAchieved > 0;

            if (isMonthEmuAchieved && monthTarget > 0) {
                emulationMonthsAchievedCount++;
            }

            emulationMonthDetails.push({
                month: m,
                monthLabel: `T${m}`,
                achievedCount: monthAchieved,
                targetCount: monthTarget,
                completionRate: monthEmuRate,
                isAchieved: isMonthEmuAchieved
            });

            totalEmulationAchieved += monthAchieved;
            totalEmulationTarget += monthTarget;

            // Thu thập chi tiết rawKey cho tra cứu phụ (nếu có)
            const monthCampKeys = new Set([...Object.keys(monthCampTargets), ...Object.keys(monthCampActuals)]);
            monthCampKeys.forEach(rawKey => {
                const targetVal = Number(monthCampTargets[rawKey]) || 0;
                const actualVal = Number(monthCampActuals[rawKey]) || 0;
                const cRate = targetVal > 0 ? (actualVal / targetVal) * 100 : actualVal > 0 ? 100 : 0;

                if (!campMap[rawKey]) {
                    campMap[rawKey] = { target: 0, actual: 0, byMonth: {} };
                }
                campMap[rawKey].target += targetVal;
                campMap[rawKey].actual += actualVal;
                campMap[rawKey].byMonth[m] = {
                    month: m,
                    monthLabel: `T${m}`,
                    targetValue: targetVal,
                    actualValue: actualVal,
                    rate: Math.round(cRate * 10) / 10,
                    isAchieved: targetVal > 0 ? actualVal >= targetVal : actualVal > 0
                };
            });
        });

        const completionRate = totalTargetRevenue > 0
            ? Math.round((totalRevenueQd / totalTargetRevenue) * 1000) / 10
            : totalRevenueQd > 0 ? 100 : 0;

        // Tính kết quả thi đua lũy kế: Tổng đã đạt / Tổng mục tiêu
        const emulationRate = totalEmulationTarget > 0
            ? Math.round((totalEmulationAchieved / totalEmulationTarget) * 1000) / 10
            : totalEmulationAchieved > 0 ? 100 : 0;

        const campaigns: Record<string, CampaignSummaryDetail> = {};
        Object.entries(campMap).forEach(([rawKey, val]) => {
            const dictItem = campaignDict.find(d => d.raw_key === rawKey);
            const displayName = dictItem?.display_name || rawKey;
            const unit = dictItem?.unit || 'SL';
            const isAchieved = val.target > 0 ? val.actual >= val.target : val.actual > 0;
            const cRate = val.target > 0 ? Math.round((val.actual / val.target) * 1000) / 10 : val.actual > 0 ? 100 : 0;

            campaigns[rawKey] = {
                rawKey,
                displayName,
                unit,
                totalTarget: val.target,
                totalActual: val.actual,
                completionRate: cRate,
                isAchieved,
                byMonth: val.byMonth
            };
        });

        const consistencyRate = months.length > 0
            ? Math.round((monthsAchievedCount / months.length) * 1000) / 10
            : 0;

        rawRows.push({
            employee_id: empId,
            full_name: cleanEmployeeName(fullName),
            short_name: getShortenedEmployeeName(fullName),
            store_name: storeName,
            job_title: jobTitle,
            total_revenue_qd: Math.round(totalRevenueQd * 10) / 10,
            total_revenue_actual: Math.round(totalRevenueActual * 10) / 10,
            total_target_revenue: Math.round(totalTargetRevenue * 10) / 10,
            completion_rate: completionRate,
            revenue_rank: 0,
            top_bot_status: 'MID',
            months_achieved_count: monthsAchievedCount,
            total_months_count: months.length,
            consistency_rate: consistencyRate,
            consistency_label: `${monthsAchievedCount}/${months.length} T`,
            month_details: monthDetails,

            // Thi đua
            total_emulation_achieved: totalEmulationAchieved,
            total_emulation_target: totalEmulationTarget,
            emulation_points_achieved: totalEmulationAchieved,
            emulation_points_total: totalEmulationTarget,
            emulation_campaigns_achieved: totalEmulationAchieved,
            emulation_campaigns_total: totalEmulationTarget,
            emulation_rate: emulationRate,
            emulation_rank: 0,
            emulation_top_bot_status: 'MID',
            emulation_months_achieved_count: emulationMonthsAchievedCount,
            emulation_consistency_label: `${emulationMonthsAchievedCount}/${months.length} T`,
            emulation_month_details: emulationMonthDetails,
            campaigns
        });
    });

    // 4. Xếp hạng Doanh thu & gắn cờ TOP/BOT
    rawRows.sort((a, b) => b.total_revenue_qd - a.total_revenue_qd || b.completion_rate - a.completion_rate);
    const totalCount = rawRows.length;
    const topThreshold = Math.max(1, Math.ceil(totalCount * 0.2));
    const botThreshold = totalCount - Math.max(1, Math.ceil(totalCount * 0.2));

    rawRows.forEach((r, idx) => {
        r.revenue_rank = idx + 1;
        if (idx < topThreshold) {
            r.top_bot_status = 'TOP';
        } else if (idx >= botThreshold && totalCount > 3) {
            r.top_bot_status = 'BOT';
        } else {
            r.top_bot_status = 'MID';
        }
    });

    // 5. Xếp hạng Thi đua: tính theo emulation_rate, sau đó đến total_emulation_achieved, sau đó đến completion_rate
    const sortedByEmu = [...rawRows].sort((a, b) =>
        b.emulation_rate - a.emulation_rate ||
        b.total_emulation_achieved - a.total_emulation_achieved ||
        b.completion_rate - a.completion_rate
    );
    sortedByEmu.forEach((r, idx) => {
        r.emulation_rank = idx + 1;
        if (idx < topThreshold) {
            r.emulation_top_bot_status = 'TOP';
        } else if (idx >= botThreshold && totalCount > 3) {
            r.emulation_top_bot_status = 'BOT';
        } else {
            r.emulation_top_bot_status = 'MID';
        }
    });

    // 6. Tính toán KPI Tổng hợp
    const totalRevenueQd = rawRows.reduce((acc, r) => acc + r.total_revenue_qd, 0);
    const totalRevenueActual = rawRows.reduce((acc, r) => acc + r.total_revenue_actual, 0);
    const totalTargetRevenue = rawRows.reduce((acc, r) => acc + r.total_target_revenue, 0);
    const achievedTargetCount = rawRows.filter(r => r.completion_rate >= 100).length;
    const consistentAchieverCount = rawRows.filter(r => r.months_achieved_count === months.length && r.total_target_revenue > 0).length;
    const topRevenueCount = rawRows.filter(r => r.top_bot_status === 'TOP').length;
    const botRevenueCount = rawRows.filter(r => r.top_bot_status === 'BOT').length;

    const avgCompletionRate = totalTargetRevenue > 0
        ? Math.round((totalRevenueQd / totalTargetRevenue) * 1000) / 10
        : 0;

    const totalCampaignsAchieved = rawRows.reduce((acc, r) => acc + r.total_emulation_achieved, 0);
    const totalCampaignsTracked = rawRows.reduce((acc, r) => acc + r.total_emulation_target, 0);
    const avgEmulationRate = totalCampaignsTracked > 0
        ? Math.round((totalCampaignsAchieved / totalCampaignsTracked) * 1000) / 10
        : 0;
    const fullyAchievedEmulationCount = rawRows.filter(r => r.emulation_rate >= 100 && r.total_emulation_target > 0).length;
    const consistentEmulationCount = rawRows.filter(r => r.emulation_months_achieved_count === months.length && r.total_emulation_target > 0).length;

    const top1Rev = rawRows.length > 0 ? {
        id: rawRows[0].employee_id,
        name: rawRows[0].short_name,
        store: rawRows[0].store_name,
        revenue: rawRows[0].total_revenue_qd,
        rate: rawRows[0].completion_rate
    } : null;

    const top1Emu = sortedByEmu.length > 0 ? {
        id: sortedByEmu[0].employee_id,
        name: sortedByEmu[0].short_name,
        store: sortedByEmu[0].store_name,
        points: sortedByEmu[0].total_emulation_achieved,
        target: sortedByEmu[0].total_emulation_target,
        rate: sortedByEmu[0].emulation_rate
    } : null;

    const summary: QuarterlySummary = {
        totalEmployees: totalCount,
        totalRevenueQd: Math.round(totalRevenueQd * 10) / 10,
        totalRevenueActual: Math.round(totalRevenueActual * 10) / 10,
        totalTargetRevenue: Math.round(totalTargetRevenue * 10) / 10,
        avgCompletionRate,
        achievedTargetCount,
        achievedTargetPercent: totalCount > 0 ? Math.round((achievedTargetCount / totalCount) * 1000) / 10 : 0,
        consistentAchieverCount,
        top1RevenueEmployee: top1Rev,
        topRevenueCount,
        botRevenueCount,
        avgEmulationRate,
        totalCampaignsAchieved,
        totalCampaignsTracked,
        fullyAchievedEmulationCount,
        consistentEmulationCount,
        top1EmulationEmployee: top1Emu
    };

    return { rows: rawRows, summary };
}
