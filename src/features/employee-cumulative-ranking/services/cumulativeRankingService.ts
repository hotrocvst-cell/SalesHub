import { supabase } from '../../../core/lib/supabase';
import { isStoreMatch, normalizeToMillion } from '../../../core/lib/formatters';
import { fetchEmployeeRevenueTargets } from '../../../core/lib/storage';
import { syncAndFetchEmployeeDataSessions } from '../../employee-cumulative/utils/sessionStorage';
import { fetchPeriodTarget } from './periodTargetStorage';
import type { EmployeeCumulativeRankingRow, StoreCumulativeSummary, TargetSelectionMode } from '../types';

/**
 * Sinh danh sách các ngày liên tục giữa fromDate và toDate (định dạng YYYY-MM-DD)
 */
export function generateDateRange(fromDate: string, toDate: string): string[] {
    if (!fromDate || !toDate) return [];
    
    let start = new Date(fromDate);
    let end = new Date(toDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
    if (start > end) {
        const temp = start;
        start = end;
        end = temp;
    }

    const dates: string[] = [];
    const current = new Date(start);

    while (current <= end) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

/**
 * Lấy danh sách các cặp (month, year) xuất hiện trong dải ngày
 */
function extractMonthsAndYears(dates: string[]): { month: number; year: number }[] {
    const set = new Set<string>();
    dates.forEach(d => {
        const parts = d.split('-');
        if (parts.length >= 2) {
            set.add(`${Number(parts[1])}_${Number(parts[0])}`);
        }
    });

    return Array.from(set).map(item => {
        const [month, year] = item.split('_').map(Number);
        return { month, year };
    });
}

/**
 * Trích xuất Doanh thu quy đổi (DTQĐ) từ bản ghi phiên của nhân viên.
 * Ưu tiên revenue_qd; nếu không có hoặc bằng 0 thì fallback sang revenue_actual.
 */
export function extractEmployeeRevenueQd(rec: any): number {
    if (!rec) return 0;
    const qd = typeof rec.revenue_qd === 'string'
        ? parseFloat(rec.revenue_qd.replace(/,/g, ''))
        : Number(rec.revenue_qd);
    if (!isNaN(qd) && qd > 0) {
        return normalizeToMillion(qd);
    }
    const act = typeof rec.revenue_actual === 'string'
        ? parseFloat(rec.revenue_actual.replace(/,/g, ''))
        : Number(rec.revenue_actual);
    if (!isNaN(act) && act > 0) {
        return normalizeToMillion(act);
    }
    return 0;
}

/**
 * Trích xuất tổng Doanh thu quy đổi (DTQĐ) của siêu thị từ phiên cập nhật.
 * Ưu tiên total_revenue_qd; nếu không có hoặc bằng 0 thì tính tổng từ records của phiên.
 */
export function getSessionStoreTotalQd(sess: any): number {
    if (!sess) return 0;
    const totalQd = typeof sess.total_revenue_qd === 'string'
        ? parseFloat(sess.total_revenue_qd.replace(/,/g, ''))
        : Number(sess.total_revenue_qd);
    if (!isNaN(totalQd) && totalQd > 0) {
        return normalizeToMillion(totalQd);
    }
    const records = Array.isArray(sess.records) ? sess.records : [];
    let sum = 0;
    records.forEach((r: any) => {
        sum += extractEmployeeRevenueQd(r);
    });
    return Math.round(sum * 100) / 100;
}

/**
 * Tải và tổng hợp dữ liệu Xếp hạng Doanh thu Lũy kế Nhân viên theo Doanh thu quy đổi (DTQĐ)
 * Cách tính: Phiên (ngày n) - Phiên (ngày n-1) tuần tự từng ngày
 */
export async function fetchCumulativeRankingData(params: {
    fromDate: string;
    toDate: string;
    store: string;
    storesList?: { name: string; short_name?: string }[];
    targetMode?: TargetSelectionMode;
}): Promise<{
    success: boolean;
    rows: EmployeeCumulativeRankingRow[];
    summary: StoreCumulativeSummary;
    error?: string;
}> {
    const { fromDate, toDate, store, storesList = [], targetMode = 'AUTO' } = params;
    const dateList = generateDateRange(fromDate, toDate);

    if (dateList.length === 0) {
        return {
            success: false,
            rows: [],
            summary: {
                storeName: store,
                fromDate,
                toDate,
                dateList: [],
                storeCumulativeRevenue: 0,
                storeDailyRevenue: {},
                storeTarget: 0,
                storeCompletionRate: 0,
                totalEmployeesWithSales: 0,
                sumOfEmployeesCumulative: 0,
                unassignedOrOnlineDiff: 0,
                top1Employee: null,
                avgRevenuePerEmployee: 0
            },
            error: 'Khoảng thời gian không hợp lệ'
        };
    }

    try {
        const monthsYears = extractMonthsAndYears(dateList);
        const firstMonth = monthsYears[0];
        const startOfFirstMonth = `${firstMonth.year}-${String(firstMonth.month).padStart(2, '0')}-01`;

        // 1. TẢI DỮ LIỆU KINH DOANH CHỐT CỦA SIÊU THỊ (daily_business_records - bc tháng)
        // Lấy từ ngày đầu của tháng đầu tiên để có điểm mốc so sánh nhịp và lũy kế chuẩn
        const { data: businessRecords, error: busError } = await supabase
            .from('daily_business_records')
            .select('*')
            .gte('report_date', startOfFirstMonth)
            .lte('report_date', toDate)
            .order('report_date', { ascending: true });

        if (busError) {
            console.warn('Cảnh báo tải daily_business_records:', busError);
        }

        // 2. TẢI DỮ LIỆU PHIÊN NHÂN VIÊN (employee_data_sessions)
        // Lấy từ đầu tháng đầu tiên để có điểm mốc phiên ngày trước đó (ngày n-1)
        const { data: sessions, error: sessError } = await supabase
            .from('employee_data_sessions')
            .select('*')
            .gte('report_date', startOfFirstMonth)
            .lte('report_date', toDate)
            .order('created_at', { ascending: true });

        if (sessError) {
            console.warn('Cảnh báo tải employee_data_sessions:', sessError);
        }

        // 3. TẢI CẤU HÌNH TARGET THEO GIAI ĐOẠN RIÊNG BIỆT (A - B)
        const periodTargetConfig = await fetchPeriodTarget(store, fromDate, toDate, storesList);
        const hasPeriodTarget = !!periodTargetConfig;

        // 3b. TẢI TARGET THÁNG CẤU HÌNH TỪ TRƯỚC
        const monthTargetMap: Record<string, number> = {};
        for (const my of monthsYears) {
            const tRes = await fetchEmployeeRevenueTargets(my.month, my.year);
            if (tRes.success && tRes.data) {
                if (Array.isArray(tRes.data)) {
                    tRes.data.forEach((r: any) => {
                        if (r && r.employee_id) {
                            const empId = String(r.employee_id).trim();
                            const val = Number(r.target_revenue) || 0;
                            const normalizedVal = normalizeToMillion(val);
                            monthTargetMap[empId] = (monthTargetMap[empId] || 0) + normalizedVal;
                        }
                    });
                } else if (typeof tRes.data === 'object') {
                    Object.entries(tRes.data).forEach(([empId, val]) => {
                        const num = Number(val) || 0;
                        const normalizedVal = normalizeToMillion(num);
                        monthTargetMap[empId.trim()] = (monthTargetMap[empId.trim()] || 0) + normalizedVal;
                    });
                }
            }
        }

        // 4. TÍNH TARGET THÁNG CỦA SIÊU THỊ TỪ daily_business_records (NẾU CÓ)
        const storeDailyRevenue: Record<string, number> = {};
        dateList.forEach(d => {
            storeDailyRevenue[d] = 0;
        });

        // Nhóm các bản ghi theo từng siêu thị
        const recordsByStore = new Map<string, any[]>();
        (businessRecords || []).forEach(r => {
            if (!r.report_date) return;
            const rStore = (r.store_name || '').trim();
            if (rStore === 'Tổng' || /^(tổng|tong)/i.test(rStore)) return;

            const match = store === 'all' || isStoreMatch(rStore, store, storesList);
            if (!match) return;

            if (!recordsByStore.has(rStore)) {
                recordsByStore.set(rStore, []);
            }
            recordsByStore.get(rStore)!.push(r);
        });

        let storeMonthlyTargetFromRecords = 0;
        recordsByStore.forEach((sRecords) => {
            sRecords.sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime());

            // Lấy bản ghi mới nhất trong dải ngày [fromDate .. toDate] để trích xuất Target Tháng
            const inPeriodRecords = sRecords.filter(r => r.report_date >= fromDate && r.report_date <= toDate);
            const latestInPeriod = inPeriodRecords.length > 0 
                ? inPeriodRecords[inPeriodRecords.length - 1]
                : sRecords.filter(r => r.report_date <= toDate).slice(-1)[0];

            if (latestInPeriod) {
                const latestTarget = normalizeToMillion(Number(latestInPeriod.revenue_target) || 0);
                storeMonthlyTargetFromRecords += latestTarget;
            }
        });

        // 5. XỬ LÝ SỐ LIỆU TỪNG NHÂN VIÊN TỪ PHIÊN NHÂN VIÊN THEO DOANH THU QUY ĐỔI (DTQĐ)
        // Quy chuẩn tính doanh thu từng ngày: Phiên (ngày n) - Phiên (ngày n-1) theo DTQĐ, tuần tự từng ngày
        // Nhóm phiên mới nhất theo từng (siêu thị, ngày)
        const sessionsByStoreAndDate = new Map<string, Map<string, any>>();
        (sessions || []).forEach(sess => {
            if (!sess.report_date) return;
            if (sess.session_type !== 'REVENUE_CAMPAIGN' && sess.session_type !== 'FULL_SYNC') return;

            const match = store === 'all' || isStoreMatch(sess.store_name, store, storesList);
            if (!match) return;

            const storeKey = sess.store_name || store;
            if (!sessionsByStoreAndDate.has(storeKey)) {
                sessionsByStoreAndDate.set(storeKey, new Map<string, any>());
            }
            const dateMap = sessionsByStoreAndDate.get(storeKey)!;
            const existing = dateMap.get(sess.report_date);
            if (!existing || new Date(sess.created_at) >= new Date(existing.created_at)) {
                dateMap.set(sess.report_date, sess);
            }
        });

        // Bóc tách nhân viên xuất hiện trong các phiên
        const empMap = new Map<string, {
            employeeId: string;
            fullName: string;
            storeName: string;
            dailyRevenues: Record<string, number>;
            dailyQuantities: Record<string, number>;
            dailyInstallments: Record<string, number>;
            cumulativeRevenue: number;
            cumulativeQty: number;
            cumulativeInstallment: number;
            activeDaysCount: number;
        }>();

        // Thu thập thông tin nhân sự xuất hiện trong giai đoạn xem báo cáo
        sessionsByStoreAndDate.forEach((dateMap, storeName) => {
            dateMap.forEach((sess, reportDate) => {
                if (reportDate < fromDate || reportDate > toDate) return;
                const records = Array.isArray(sess.records) ? sess.records : [];
                records.forEach((rec: any) => {
                    const empId = String(rec.employee_id || '').trim();
                    if (!empId) return;

                    if (!empMap.has(empId)) {
                        empMap.set(empId, {
                            employeeId: empId,
                            fullName: rec.full_name || empId,
                            storeName: storeName,
                            dailyRevenues: {},
                            dailyQuantities: {},
                            dailyInstallments: {},
                            cumulativeRevenue: 0,
                            cumulativeQty: 0,
                            cumulativeInstallment: 0,
                            activeDaysCount: 0
                        });
                    }
                });
            });
        });

        // Tính doanh thu từng ngày cho nhân viên theo DOANH THU QUY ĐỔI (DTQĐ): Phiên (ngày n) - Phiên (ngày n-1)
        sessionsByStoreAndDate.forEach((dateMap, storeName) => {
            const allSessionDates = Array.from(dateMap.keys()).sort();

            dateList.forEach(d => {
                const sessD = dateMap.get(d);
                if (!sessD) return;

                const isDay1 = d.endsWith('-01');
                let prevSess: any = null;
                if (!isDay1) {
                    const priorDates = allSessionDates.filter(pDate => pDate < d && pDate.substring(0, 7) === d.substring(0, 7));
                    if (priorDates.length > 0) {
                        const latestPriorDate = priorDates[priorDates.length - 1];
                        prevSess = dateMap.get(latestPriorDate);
                    }
                }

                const prevRecordsMap = new Map<string, any>();
                if (prevSess && Array.isArray(prevSess.records)) {
                    prevSess.records.forEach((r: any) => {
                        const id = String(r.employee_id || '').trim();
                        if (id) prevRecordsMap.set(id, r);
                    });
                }

                const recordsD = Array.isArray(sessD.records) ? sessD.records : [];
                recordsD.forEach((rec: any) => {
                    const empId = String(rec.employee_id || '').trim();
                    if (!empId) return;

                    if (!empMap.has(empId)) {
                        empMap.set(empId, {
                            employeeId: empId,
                            fullName: rec.full_name || empId,
                            storeName: storeName,
                            dailyRevenues: {},
                            dailyQuantities: {},
                            dailyInstallments: {},
                            cumulativeRevenue: 0,
                            cumulativeQty: 0,
                            cumulativeInstallment: 0,
                            activeDaysCount: 0
                        });
                    }

                    const emp = empMap.get(empId)!;
                    const prevRec = prevRecordsMap.get(empId);

                    // TÍNH THEO DOANH THU QUY ĐỔI (DTQĐ): phiên (ngày n) - phiên (ngày n-1)
                    const curRev = extractEmployeeRevenueQd(rec);
                    const prevRev = prevRec ? extractEmployeeRevenueQd(prevRec) : 0;
                    const dayRev = Math.max(0, curRev - prevRev);

                    const curQty = Number(rec.quantity) || 0;
                    const prevQty = prevRec ? Number(prevRec.quantity) || 0 : 0;
                    const dayQty = Math.max(0, curQty - prevQty);

                    const curInst = normalizeToMillion(Number(rec.installment_revenue) || 0);
                    const prevInst = prevRec ? normalizeToMillion(Number(prevRec.installment_revenue) || 0) : 0;
                    const dayInst = Math.max(0, curInst - prevInst);

                    const cleanDayRev = Math.round(dayRev * 100) / 100;
                    emp.dailyRevenues[d] = (emp.dailyRevenues[d] || 0) + cleanDayRev;
                    emp.dailyQuantities[d] = (emp.dailyQuantities[d] || 0) + dayQty;
                    emp.dailyInstallments[d] = (emp.dailyInstallments[d] || 0) + dayInst;
                });
            });
        });

        // Tổng hợp lũy kế của từng nhân sự trong giai đoạn [fromDate .. toDate] theo DTQĐ
        empMap.forEach(emp => {
            let totalRev = 0;
            let totalQty = 0;
            let totalInst = 0;
            let activeDays = 0;

            dateList.forEach(d => {
                const dayRev = emp.dailyRevenues[d] || 0;
                const dayQty = emp.dailyQuantities[d] || 0;
                const dayInst = emp.dailyInstallments[d] || 0;

                totalRev += dayRev;
                totalQty += dayQty;
                totalInst += dayInst;
                if (dayRev > 0) activeDays += 1;
            });

            emp.cumulativeRevenue = Math.round(totalRev * 100) / 100;
            emp.cumulativeQty = totalQty;
            emp.cumulativeInstallment = Math.round(totalInst * 100) / 100;
            emp.activeDaysCount = activeDays;
        });

        const sumOfEmployees = Array.from(empMap.values()).reduce((sum, e) => sum + e.cumulativeRevenue, 0);

        // ĐỒNG BỘ SỐ TỔNG VÀ NHỊP NGÀY CỦA SIÊU THỊ THEO DTQĐ (THEO PHƯƠNG PHÁP RevenueTrendPage)
        // 1. Tính nhịp DTQĐ từng ngày của từng siêu thị: key = `${date}_${sName}` => dailyPace
        const paceByStoreDate = new Map<string, number>();

        sessionsByStoreAndDate.forEach((dateMap, sName) => {
            const sortedDates = Array.from(dateMap.keys()).sort();

            dateList.forEach(d => {
                const sessD = dateMap.get(d);
                if (!sessD) {
                    paceByStoreDate.set(`${d}_${sName}`, 0);
                    return;
                }

                const curQd = getSessionStoreTotalQd(sessD);
                const isDay1 = d.endsWith('-01');
                let prevQd = 0;

                if (!isDay1) {
                    const priorDates = sortedDates.filter(p => p < d && p.substring(0, 7) === d.substring(0, 7));
                    if (priorDates.length > 0) {
                        const latestPriorDate = priorDates[priorDates.length - 1];
                        const prevSess = dateMap.get(latestPriorDate);
                        prevQd = getSessionStoreTotalQd(prevSess);
                    }
                }

                const pace = Math.max(0, curQd - prevQd);
                paceByStoreDate.set(`${d}_${sName}`, Math.round(pace * 100) / 100);
            });
        });

        // 2. Doanh thu từng ngày của Siêu thị (storeDailyRevenue[d]): Được tính theo lũy kế DTQĐ của siêu thị từng ngày
        dateList.forEach(d => {
            let dayTotal = 0;
            sessionsByStoreAndDate.forEach((_, sName) => {
                dayTotal += paceByStoreDate.get(`${d}_${sName}`) || 0;
            });
            storeDailyRevenue[d] = Math.round(dayTotal * 100) / 100;
        });

        // 3. Lũy kế Siêu thị (storeCumulativeRevenue): Bằng tổng DTQĐ lũy kế từng ngày theo siêu thị
        let storeCumulativeRevenue = Math.round(
            dateList.reduce((sum, d) => sum + (storeDailyRevenue[d] || 0), 0) * 100
        ) / 100;

        // Fallback an toàn: nếu tổng nhịp siêu thị = 0 mà có nhân viên phát sinh DTQĐ
        if (storeCumulativeRevenue === 0 && sumOfEmployees > 0) {
            dateList.forEach(d => {
                let daySum = 0;
                empMap.forEach(e => {
                    daySum += e.dailyRevenues[d] || 0;
                });
                storeDailyRevenue[d] = Math.round(daySum * 100) / 100;
            });
            storeCumulativeRevenue = Math.round(sumOfEmployees * 100) / 100;
        }

        // 6. XÁC ĐỊNH BẢNG TARGET THEO TÙY CHỌN (AUTO / MONTH / PERIOD)
        const isFromFirstDayOfMonth = fromDate.endsWith('-01') || new Date(fromDate).getDate() === 1;
        const isThisMonth = isFromFirstDayOfMonth && monthsYears.length === 1;
        let useMonthTarget = false;

        if (targetMode === 'MONTH') {
            useMonthTarget = true;
        } else if (targetMode === 'PERIOD') {
            useMonthTarget = false;
        } else {
            // targetMode === 'AUTO' (Khuyến nghị)
            // Nếu chọn giai đoạn "Tháng này" -> Tự động chọn Target Tháng đã cấu hình từ trước
            if (isThisMonth) {
                useMonthTarget = true;
            } else if (hasPeriodTarget) {
                useMonthTarget = false;
            } else {
                useMonthTarget = true;
            }
        }

        const finalTargetMap: Record<string, number> = (!useMonthTarget && hasPeriodTarget)
            ? (periodTargetConfig.targets || {})
            : monthTargetMap;

        const targetSource: 'PERIOD' | 'MONTH' | 'NONE' = (!useMonthTarget && hasPeriodTarget)
            ? 'PERIOD'
            : (Object.keys(monthTargetMap).length > 0 ? 'MONTH' : 'NONE');

        let storeTargetTotal = 0;
        if (!useMonthTarget && hasPeriodTarget && periodTargetConfig.storeTarget > 0) {
            storeTargetTotal = periodTargetConfig.storeTarget;
        } else if (storeMonthlyTargetFromRecords > 0) {
            storeTargetTotal = storeMonthlyTargetFromRecords;
        }

        // 7. XÂY DỰNG DANH SÁCH DÒNG VÀ SẮP XẾP THEO %HT GIẢM DẦN
        const rows: EmployeeCumulativeRankingRow[] = Array.from(empMap.values()).map(e => {
            const target = finalTargetMap[e.employeeId] || 0;
            const completionRate = target > 0 ? (e.cumulativeRevenue / target) * 100 : 0;
            const storeShareRate = storeCumulativeRevenue > 0
                ? (e.cumulativeRevenue / storeCumulativeRevenue) * 100
                : 0;

            return {
                rank: 0, // sẽ gán sau khi sort theo %HT
                employeeId: e.employeeId,
                fullName: e.fullName,
                storeName: e.storeName,
                target,
                targetSource,
                dailyRevenues: e.dailyRevenues,
                dailyQuantities: e.dailyQuantities,
                cumulativeRevenue: e.cumulativeRevenue,
                cumulativeQty: e.cumulativeQty,
                cumulativeInstallment: e.cumulativeInstallment,
                completionRate,
                storeShareRate,
                activeDaysCount: e.activeDaysCount
            };
        });

        // QUY CHUẨN SẮP XẾP: Sắp xếp theo %HT GIẢM DẦN (nếu bằng nhau xếp theo Doanh thu lũy kế)
        rows.sort((a, b) => {
            if (b.completionRate !== a.completionRate) {
                return b.completionRate - a.completionRate;
            }
            return b.cumulativeRevenue - a.cumulativeRevenue;
        });
        rows.forEach((r, idx) => {
            r.rank = idx + 1;
        });

        // 8. XÂY DỰNG SUMMARY TỔNG KẾT
        const storeCompletionRate = storeTargetTotal > 0
            ? (storeCumulativeRevenue / storeTargetTotal) * 100
            : 0;
        
        const top1 = rows.length > 0 ? {
            id: rows[0].employeeId,
            name: rows[0].fullName,
            revenue: rows[0].cumulativeRevenue,
            shareRate: rows[0].storeShareRate
        } : null;

        const employeesWithSales = rows.filter(r => r.cumulativeRevenue > 0).length;
        const avgPerEmployee = employeesWithSales > 0 ? sumOfEmployees / employeesWithSales : 0;

        const summary: StoreCumulativeSummary = {
            storeName: store,
            fromDate,
            toDate,
            dateList,
            storeCumulativeRevenue,
            storeDailyRevenue,
            storeTarget: storeTargetTotal,
            storeCompletionRate,
            targetSource,
            activePeriodTitle: periodTargetConfig?.periodTitle,
            activePeriodConfig: periodTargetConfig || null,
            isPeriodTargetCloudStored: periodTargetConfig ? (periodTargetConfig.isCloudStored ?? false) : undefined,
            totalEmployeesWithSales: employeesWithSales,
            sumOfEmployeesCumulative: sumOfEmployees,
            unassignedOrOnlineDiff: storeCumulativeRevenue - sumOfEmployees,
            top1Employee: top1,
            avgRevenuePerEmployee: avgPerEmployee
        };

        return {
            success: true,
            rows,
            summary
        };
    } catch (err: any) {
        console.error('Lỗi fetchCumulativeRankingData:', err);
        return {
            success: false,
            rows: [],
            summary: {
                storeName: store,
                fromDate,
                toDate,
                dateList: [],
                storeCumulativeRevenue: 0,
                storeDailyRevenue: {},
                storeTarget: 0,
                storeCompletionRate: 0,
                totalEmployeesWithSales: 0,
                sumOfEmployeesCumulative: 0,
                unassignedOrOnlineDiff: 0,
                top1Employee: null,
                avgRevenuePerEmployee: 0
            },
            error: err.message || String(err)
        };
    }
}
