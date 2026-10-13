import { supabase } from '../../../core/lib/supabase';
import { isStoreMatch } from '../../../core/lib/formatters';
import { fetchEmployeeRevenueTargets } from '../../../core/lib/storage';
import { syncAndFetchEmployeeDataSessions } from '../../employee-cumulative/utils/sessionStorage';
import { fetchPeriodTarget } from './periodTargetStorage';
import type { EmployeeCumulativeRankingRow, StoreCumulativeSummary } from '../types';

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
}): Promise<{
    success: boolean;
    rows: EmployeeCumulativeRankingRow[];
    summary: StoreCumulativeSummary;
    error?: string;
}> {
    const { fromDate, toDate, store, storesList = [] } = params;
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

        // 1. TẢI DỮ LIỆU KINH DOANH CHỐT CỦA SIÊU THỊ (daily_business_records)
        const { data: businessRecords, error: busError } = await supabase
            .from('daily_business_records')
            .select('*')
            .gte('report_date', fromDate)
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

        // 3. TẢI CẤU HÌNH TARGET THEO GIAI ĐOẠN RIÊNG BIỆT (ƯU TIÊN SỐ 1 NẾU ĐÃ CẤU HÌNH)
        const periodTargetConfig = await fetchPeriodTarget(store, fromDate, toDate, storesList);
        const hasPeriodTarget = !!periodTargetConfig;

        // 3b. TẢI TARGET THÁNG (DỰ PHÒNG NẾU CHƯA CẤU HÌNH TARGET GIAI ĐOẠN)
        const monthTargetMap: Record<string, number> = {};
        if (!hasPeriodTarget) {
            for (const my of monthsYears) {
                const tRes = await fetchEmployeeRevenueTargets(my.month, my.year);
                if (tRes.success && tRes.data) {
                    if (Array.isArray(tRes.data)) {
                        tRes.data.forEach((r: any) => {
                            if (r && r.employee_id) {
                                const empId = String(r.employee_id).trim();
                                const val = Number(r.target_revenue) || 0;
                                const fullVal = val < 100_000 ? val * 1_000_000 : val;
                                monthTargetMap[empId] = (monthTargetMap[empId] || 0) + fullVal;
                            }
                        });
                    } else if (typeof tRes.data === 'object') {
                        Object.entries(tRes.data).forEach(([empId, val]) => {
                            const num = Number(val) || 0;
                            const fullVal = num < 100_000 ? num * 1_000_000 : num;
                            monthTargetMap[empId.trim()] = (monthTargetMap[empId.trim()] || 0) + fullVal;
                        });
                    }
                }
            }
        }

        // 4. XỬ LÝ SỐ LIỆU CHỐT CỦA SIÊU THỊ (STORE CUMULATIVE TOTAL)
        // Mỗi ngày d, tính doanh thu thực tế của siêu thị
        const storeDailyRevenue: Record<string, number> = {};
        let storeTargetTotal = 0;

        dateList.forEach(d => {
            storeDailyRevenue[d] = 0;
        });

        const storeDateRecordMap = new Map<string, any>();
        (businessRecords || []).forEach(r => {
            if (!r.report_date) return;
            const rStore = r.store_name || '';
            const match = store === 'all' || isStoreMatch(rStore, store, storesList);
            if (!match) return;

            const key = `${r.report_date}_${rStore}`;
            // Lấy bản ghi có doanh thu lớn nhất nếu trùng ngày
            const prev = storeDateRecordMap.get(key);
            if (!prev || (Number(r.revenue_actual) || 0) > (Number(prev.revenue_actual) || 0)) {
                storeDateRecordMap.set(key, r);
            }
        });

        // Tính tổng doanh thu siêu thị theo từng ngày
        storeDateRecordMap.forEach(r => {
            const date = r.report_date;
            const rev = Number(r.revenue_actual) || 0;
            const target = Number(r.revenue_target) || 0;
            if (storeDailyRevenue[date] !== undefined) {
                storeDailyRevenue[date] += rev;
            }
            storeTargetTotal += target;
        });

        // Doanh thu Lũy Kế CỦA SIÊU THỊ trong kỳ = Tổng doanh thu các ngày chốt của siêu thị
        let storeCumulativeRevenue = Object.values(storeDailyRevenue).reduce((acc, v) => acc + v, 0);

        // 5. XỬ LÝ SỐ LIỆU TỪNG NHÂN VIÊN
        // Nhóm session theo ngày và theo siêu thị để lấy phiên mới nhất cho mỗi ngày
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
                const rev = Number(rec.revenue_actual) || 0;
                const qty = Number(rec.quantity) || 0;
                const inst = Number(rec.installment_revenue) || 0;

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

        // Nếu storeCumulativeRevenue = 0 (chưa có bản ghi daily_business_records chốt),
        // fallback lấy tổng từ phiên nhân viên
        const sumOfEmployees = Array.from(empMap.values()).reduce((sum, e) => sum + e.cumulativeRevenue, 0);
        if (storeCumulativeRevenue === 0 && sumOfEmployees > 0) {
            // Tính lại storeDailyRevenue từ các phiên nhân viên
            dateList.forEach(d => {
                let daySum = 0;
                empMap.forEach(e => {
                    daySum += e.dailyRevenues[d] || 0;
                });
                storeDailyRevenue[d] = daySum;
            });
            storeCumulativeRevenue = sumOfEmployees;
        }

        // 6. XÁC ĐỊNH BẢNG TARGET VÀ NGUỒN TARGET
        const finalTargetMap: Record<string, number> = hasPeriodTarget
            ? (periodTargetConfig.targets || {})
            : monthTargetMap;
        const targetSource: 'PERIOD' | 'MONTH' | 'NONE' = hasPeriodTarget
            ? 'PERIOD'
            : (Object.keys(monthTargetMap).length > 0 ? 'MONTH' : 'NONE');

        if (hasPeriodTarget && periodTargetConfig.storeTarget > 0) {
            storeTargetTotal = periodTargetConfig.storeTarget;
        }

        // 7. XÂY DỰNG DANH SÁCH DÒNG VÀ TÍNH THỨ HẠNG
        const rows: EmployeeCumulativeRankingRow[] = Array.from(empMap.values()).map(e => {
            const target = finalTargetMap[e.employeeId] || 0;
            const completionRate = target > 0 ? (e.cumulativeRevenue / target) * 100 : 0;
            const storeShareRate = storeCumulativeRevenue > 0
                ? (e.cumulativeRevenue / storeCumulativeRevenue) * 100
                : 0;

            return {
                rank: 0, // sẽ gán sau khi sort
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

        // Sắp xếp thứ hạng theo doanh thu lũy kế giảm dần
        rows.sort((a, b) => b.cumulativeRevenue - a.cumulativeRevenue);
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
