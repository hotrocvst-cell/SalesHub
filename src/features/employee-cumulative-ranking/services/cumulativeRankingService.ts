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
 * Tải và tổng hợp dữ liệu Xếp hạng Doanh thu Lũy kế Nhân viên
 * SỐ TỔNG: Luôn là dữ liệu lũy kế của siêu thị từ daily_business_records
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
        const { data: sessions, error: sessError } = await supabase
            .from('employee_data_sessions')
            .select('*')
            .gte('report_date', fromDate)
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

        // 4. XỬ LÝ SỐ LIỆU LŨY KẾ THEO SIÊU THỊ TỪ CÁC PHIÊN CẬP NHẬT (BC THÁNG)
        // Trong daily_business_records (bc tháng), revenue_actual là lũy kế tháng đến ngày report_date
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

        let storeCumulativeRevenue = 0;
        let storeMonthlyTargetFromRecords = 0;
        const isFromFirstDayOfMonth = fromDate.endsWith('-01') || new Date(fromDate).getDate() === 1;

        // Tính lũy kế thực tế chuẩn cho từng siêu thị
        recordsByStore.forEach((sRecords) => {
            sRecords.sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime());

            // Lấy bản ghi mới nhất trong dải ngày [fromDate .. toDate]
            const inPeriodRecords = sRecords.filter(r => r.report_date >= fromDate && r.report_date <= toDate);
            const latestInPeriod = inPeriodRecords.length > 0 
                ? inPeriodRecords[inPeriodRecords.length - 1]
                : sRecords.filter(r => r.report_date <= toDate).slice(-1)[0];

            if (latestInPeriod) {
                const latestActual = normalizeToMillion(Number(latestInPeriod.revenue_actual) || 0);
                const latestTarget = normalizeToMillion(Number(latestInPeriod.revenue_target) || 0);
                storeMonthlyTargetFromRecords += latestTarget;

                if (isFromFirstDayOfMonth) {
                    // Nếu lấy từ đầu tháng: Lũy kế chính là số lũy kế ghi nhận ở ngày mới nhất
                    storeCumulativeRevenue += latestActual;
                } else {
                    // Nếu lấy từ giữa tháng: Lấy lũy kế ngày cuối trừ lũy kế ngày trước fromDate
                    const priorRecords = sRecords.filter(r => r.report_date < fromDate);
                    const priorRecord = priorRecords.length > 0 ? priorRecords[priorRecords.length - 1] : null;
                    const priorActual = priorRecord ? normalizeToMillion(Number(priorRecord.revenue_actual) || 0) : 0;
                    const delta = Math.max(0, latestActual - priorActual);
                    storeCumulativeRevenue += delta;
                }
            }

            // Tính nhịp doanh thu từng ngày cho siêu thị
            dateList.forEach(d => {
                const recD = sRecords.find(r => r.report_date === d);
                if (recD) {
                    const prevD = new Date(d);
                    prevD.setDate(prevD.getDate() - 1);
                    const prevDStr = prevD.toISOString().split('T')[0];
                    const recPrev = sRecords.find(r => r.report_date === prevDStr);

                    const curVal = normalizeToMillion(Number(recD.revenue_actual) || 0);
                    const prevVal = recPrev ? normalizeToMillion(Number(recPrev.revenue_actual) || 0) : 0;
                    const dayPace = recPrev ? Math.max(0, curVal - prevVal) : curVal;
                    storeDailyRevenue[d] = (storeDailyRevenue[d] || 0) + dayPace;
                }
            });
        });

        // 5. XỬ LÝ SỐ LIỆU TỪNG NHÂN VIÊN TỪ PHIÊN NHÂN VIÊN
        const latestSessionPerDay = new Map<string, any>();
        (sessions || []).forEach(sess => {
            if (!sess.report_date) return;
            if (sess.session_type !== 'REVENUE_CAMPAIGN' && sess.session_type !== 'FULL_SYNC') return;

            const match = store === 'all' || isStoreMatch(sess.store_name, store, storesList);
            if (!match) return;

            const key = `${sess.report_date}_${sess.store_name}`;
            const existing = latestSessionPerDay.get(key);
            if (!existing || new Date(sess.created_at) >= new Date(existing.created_at)) {
                latestSessionPerDay.set(key, sess);
            }
        });

        // Bóc tách số liệu từng nhân viên
        const empMap = new Map<string, {
            employeeId: string;
            fullName: string;
            storeName: string;
            dailyRevenues: Record<string, number>;
            dailyQuantities: Record<string, number>;
            cumulativeRevenue: number;
            cumulativeQty: number;
            cumulativeInstallment: number;
            activeDaysCount: number;
        }>();

        latestSessionPerDay.forEach(sess => {
            const date = sess.report_date;
            const records = Array.isArray(sess.records) ? sess.records : [];

            records.forEach((rec: any) => {
                const empId = String(rec.employee_id || '').trim();
                if (!empId) return;

                if (!empMap.has(empId)) {
                    empMap.set(empId, {
                        employeeId: empId,
                        fullName: rec.full_name || empId,
                        storeName: sess.store_name || store,
                        dailyRevenues: {},
                        dailyQuantities: {},
                        cumulativeRevenue: 0,
                        cumulativeQty: 0,
                        cumulativeInstallment: 0,
                        activeDaysCount: 0
                    });
                }

                const emp = empMap.get(empId)!;
                const rev = normalizeToMillion(Number(rec.revenue_actual) || 0);
                const qty = Number(rec.quantity) || 0;
                const inst = normalizeToMillion(Number(rec.installment_revenue) || 0);

                emp.dailyRevenues[date] = (emp.dailyRevenues[date] || 0) + rev;
                emp.dailyQuantities[date] = (emp.dailyQuantities[date] || 0) + qty;
                emp.cumulativeRevenue += rev;
                emp.cumulativeQty += qty;
                emp.cumulativeInstallment += inst;
                if (rev > 0) {
                    emp.activeDaysCount += 1;
                }
            });
        });

        const sumOfEmployees = Array.from(empMap.values()).reduce((sum, e) => sum + e.cumulativeRevenue, 0);

        // Fallback: Nếu chưa có dữ liệu bc tháng trong daily_business_records, lấy tổng từ phiên nhân sự
        if (storeCumulativeRevenue === 0 && sumOfEmployees > 0) {
            dateList.forEach(d => {
                let daySum = 0;
                empMap.forEach(e => {
                    daySum += e.dailyRevenues[d] || 0;
                });
                storeDailyRevenue[d] = daySum;
            });
            storeCumulativeRevenue = sumOfEmployees;
        }

        // 6. XÁC ĐỊNH BẢNG TARGET THEO TÙY CHỌN (AUTO / MONTH / PERIOD)
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
