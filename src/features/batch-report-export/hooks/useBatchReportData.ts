import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    fetchStores,
    fetchEmployees,
    fetchBusinessRecords,
    fetchEmployeeRevenueTargets,
    fetchCampaignDictionary,
    fetchEmployeeCampaignTargets,
    fetchMonthlyRecordsForChart,
    type StoreItem,
    type EmployeeItem,
    type BusinessDayRecord,
    type CampaignDictItem
} from '../../../core/lib/storage';
import {
    syncAndFetchEmployeeDataSessions,
    type EmployeeDataSession
} from '../../employee-cumulative/utils/sessionStorage';
import {
    getStoreOperatingConfig,
    getTopBotConfig,
    applyTopBotEvaluation,
    getShortenedEmployeeName,
    cleanEmployeeName
} from '../../employee-performance/utils/performanceConfig';
import { buildCampaignSummaryFromSession } from '../../campaign-summary/utils/campaignSummaryStorage';
import { fetchCampaignOffsets, type CampaignOffsetItem } from '../../campaign-offset/services/campaignOffsetService';
import { isStoreMatch, getYesterdayDateString, getShortStoreName } from '../../../core/lib/formatters';
import type { EmployeePerformanceRow, StorePerformanceSummary } from '../../employee-performance/types';
import type { CampaignSummaryData } from '../../campaign-summary/types';

export function useBatchReportData(selectedStore: string, selectedDate: string, selectedMonth: number, selectedYear: number) {
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [businessRecords, setBusinessRecords] = useState<BusinessDayRecord[]>([]);
    const [sessions, setSessions] = useState<EmployeeDataSession[]>([]);
    const [revenueTargets, setRevenueTargets] = useState<Record<string, number>>({});
    const [campaignDict, setCampaignDict] = useState<CampaignDictItem[]>([]);
    const [campaignTargetsMap, setCampaignTargetsMap] = useState<Record<string, Record<string, number>>>({});
    const [campaignOffsets, setCampaignOffsets] = useState<CampaignOffsetItem[]>([]);
    const [trendRecords, setTrendRecords] = useState<BusinessDayRecord[]>([]);

    const [loading, setLoading] = useState<boolean>(true);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [
                storesRes,
                empRes,
                bRecordsRes,
                sessionsRes,
                revTargetsRes,
                campDictRes,
                campTargetsRes,
                campOffsetsRes,
                trendRes
            ] = await Promise.all([
                fetchStores(),
                fetchEmployees(),
                fetchBusinessRecords(selectedMonth, selectedYear),
                syncAndFetchEmployeeDataSessions({ month: selectedMonth, year: selectedYear }),
                fetchEmployeeRevenueTargets(selectedMonth, selectedYear),
                fetchCampaignDictionary(),
                fetchEmployeeCampaignTargets(selectedMonth, selectedYear),
                fetchCampaignOffsets(selectedStore || 'ALL', selectedMonth, selectedYear),
                fetchMonthlyRecordsForChart(selectedMonth, selectedYear)
            ]);

            if (storesRes.success && storesRes.data) setStores(storesRes.data);
            if (empRes.success && empRes.data) setEmployees(empRes.data);
            if (bRecordsRes && bRecordsRes.success && bRecordsRes.data) setBusinessRecords(bRecordsRes.data);
            setSessions(sessionsRes || []);

            // Map target doanh thu cá nhân
            const rMap: Record<string, number> = {};
            if (revTargetsRes && revTargetsRes.success && Array.isArray(revTargetsRes.data)) {
                revTargetsRes.data.forEach((row: any) => {
                    const id = String(row.employee_id || '').trim();
                    if (id) rMap[id] = Number(row.target_revenue) || 0;
                });
            }
            setRevenueTargets(rMap);

            if (campDictRes && campDictRes.success && Array.isArray(campDictRes.data)) {
                setCampaignDict(campDictRes.data);
            }

            // Map campaign targets
            const campMap: Record<string, Record<string, number>> = {};
            if (campTargetsRes && campTargetsRes.success && Array.isArray(campTargetsRes.data)) {
                campTargetsRes.data.forEach((row: any) => {
                    const empId = String(row.employee_id || '').trim();
                    const rawKey = String(row.raw_key || '').trim();
                    const val = Number(row.target_value) || 0;
                    if (empId && rawKey) {
                        if (!campMap[empId]) campMap[empId] = {};
                        campMap[empId][rawKey] = val;
                    }
                });
            }
            setCampaignTargetsMap(campMap);

            if (campOffsetsRes && campOffsetsRes.success && campOffsetsRes.data) {
                setCampaignOffsets(campOffsetsRes.data);
            }
            if (trendRes && trendRes.success && trendRes.data) {
                setTrendRecords(trendRes.data);
            }
        } catch (err) {
            console.error('Lỗi nạp dữ liệu trung tâm xuất báo cáo:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedStore, selectedMonth, selectedYear]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // 1. Dữ liệu Báo Cáo Ngày
    const dailyRecord = useMemo<BusinessDayRecord | null>(() => {
        if (!selectedStore || selectedStore === 'all' || !selectedDate) return null;
        return businessRecords.find(r =>
            isStoreMatch(r.storeName, selectedStore, stores) &&
            r.reportDate === selectedDate
        ) || null;
    }, [businessRecords, selectedStore, selectedDate, stores]);

    // 2. Dữ liệu Báo Cáo Tháng (Lũy kế các ngày trong tháng của ST)
    const monthlyRecords = useMemo<BusinessDayRecord[]>(() => {
        if (!selectedStore || selectedStore === 'all') return [];
        return businessRecords.filter(r => {
            if (!isStoreMatch(r.storeName, selectedStore, stores)) return false;
            if (!r.reportDate) return false;
            const [y, m] = r.reportDate.split('-').map(Number);
            return y === selectedYear && m === selectedMonth;
        });
    }, [businessRecords, selectedStore, selectedMonth, selectedYear, stores]);

    // 3. Dữ liệu Hiệu Quả Nhân Viên
    const { performanceRows, performanceSummary } = useMemo<{
        performanceRows: EmployeePerformanceRow[];
        performanceSummary: StorePerformanceSummary | null;
    }>(() => {
        if (!selectedStore || selectedStore === 'all') {
            return { performanceRows: [], performanceSummary: null };
        }

        const storeSessions = sessions.filter(s => isStoreMatch(s.store_name, selectedStore, stores));
        const activeSession = storeSessions[0] || null;

        if (!activeSession) {
            return { performanceRows: [], performanceSummary: null };
        }

        const opConfig = getStoreOperatingConfig(selectedStore, selectedMonth, selectedYear);
        const topBotConfig = getTopBotConfig(selectedStore);
        const passedDays = opConfig.passedDays || 1;
        const totalDays = opConfig.operatingDays || 30;

        const targetEmployees = employees.filter(emp =>
            isStoreMatch(emp.store_name, selectedStore, stores)
        );

        const revMap: Record<string, { revenue_actual: number; revenue_qd: number; installment_revenue: number }> = {};
        const hoursMap: Record<string, number> = {};

        (activeSession.records || []).forEach(r => {
            const id = (r.employee_id || '').trim();
            if (id) {
                revMap[id] = {
                    revenue_actual: r.revenue_actual || 0,
                    revenue_qd: r.revenue_qd || 0,
                    installment_revenue: r.installment_revenue || 0
                };
                hoursMap[id] = r.work_hours || 0;
            }
        });

        const rawRows = targetEmployees.map(emp => {
            const empId = (emp.employee_id || '').trim();
            const rev = revMap[empId];
            const target = revenueTargets[empId] || 0;
            const hours = hoursMap[empId] || 0;

            const revActual = rev ? rev.revenue_actual : 0;
            const revQd = rev ? rev.revenue_qd : 0;
            const completionRate = target > 0 ? Number(((revQd / target) * 100).toFixed(1)) : 0;
            const revForecast = passedDays > 0 ? (revQd / passedDays) * totalDays : revQd;
            const forecastRate = target > 0 ? Number(((revForecast / target) * 100).toFixed(1)) : 0;
            const exchangeRate = revActual > 0 ? Number((((revQd - revActual) / revActual) * 100).toFixed(1)) : 0;
            const prodQd = hours > 0 ? Number((revQd / hours).toFixed(2)) : 0;
            const prodActual = hours > 0 ? Number((revActual / hours).toFixed(2)) : 0;
            const instRev = rev ? rev.installment_revenue : 0;
            const instRate = revActual > 0 && instRev > 0 ? Number(((instRev / revActual) * 100).toFixed(1)) : 0;

            let paceStatus: EmployeePerformanceRow['pace_status'] = 'ON_TRACK';
            if (completionRate >= 100) paceStatus = 'EXCEED';
            else if (completionRate >= 80) paceStatus = 'ON_TRACK';
            else if (completionRate >= 50) paceStatus = 'SLOW';
            else paceStatus = 'CRITICAL';

            return {
                employee_id: emp.employee_id,
                full_name: emp.full_name,
                short_name: getShortenedEmployeeName(emp.full_name),
                store_name: emp.store_name,
                job_title: emp.job_title || 'Tư vấn bán hàng',
                revenue_target: target,
                revenue_actual: revActual,
                revenue_qd: revQd,
                completion_rate: completionRate,
                forecast_completion_rate: forecastRate,
                exchange_rate: exchangeRate,
                work_hours: hours,
                productivity_qd_per_hour: prodQd,
                productivity_actual_per_hour: prodActual,
                installment_revenue: instRev,
                installment_rate: instRate,
                order_quantity: 0,
                pace_status: paceStatus
            };
        });

        const evaluatedRows = applyTopBotEvaluation(rawRows, topBotConfig);

        // Sắp xếp theo thứ hạng rank
        const sortedRows = [...evaluatedRows].sort((a, b) => b.revenue_qd - a.revenue_qd);
        sortedRows.forEach((r, idx) => {
            r.rank = idx + 1;
        });

        // Tính StorePerformanceSummary chuẩn theo interface
        const sortedByProd = [...sortedRows].sort((a, b) => b.productivity_qd_per_hour - a.productivity_qd_per_hour);
        const topProd = sortedByProd.length > 0 && sortedByProd[0].productivity_qd_per_hour > 0 ? sortedByProd[0] : null;

        const sortedByForecast = [...sortedRows].sort((a, b) => b.forecast_completion_rate - a.forecast_completion_rate);
        const topForecast = sortedByForecast.length > 0 && sortedByForecast[0].forecast_completion_rate > 0 ? sortedByForecast[0] : null;

        const sortedByInst = [...sortedRows].sort((a, b) => b.installment_revenue - a.installment_revenue);
        const topInst = sortedByInst.length > 0 && sortedByInst[0].installment_revenue > 0 ? sortedByInst[0] : null;

        const summary: StorePerformanceSummary = {
            topRevenueEmp: sortedRows[0] || null,
            topProductivityEmp: topProd,
            topForecastEmp: topForecast,
            topInstallmentEmp: topInst,
            topCount: sortedRows.filter(r => r.top_bot_status === 'TOP').length,
            botCount: sortedRows.filter(r => r.top_bot_status === 'BOT').length,
            midCount: sortedRows.filter(r => r.top_bot_status === 'MID').length,
            totalEmployees: sortedRows.length
        };

        return { performanceRows: sortedRows, performanceSummary: summary };
    }, [selectedStore, sessions, employees, revenueTargets, selectedMonth, selectedYear, stores]);

    // 4. Dữ liệu Thi Đua Trọng Tâm (Campaign Summary)
    const campaignSummary = useMemo<CampaignSummaryData | null>(() => {
        if (!selectedStore || selectedStore === 'all') return null;
        const storeSessions = sessions.filter(s => isStoreMatch(s.store_name, selectedStore, stores));
        const activeSession = storeSessions[0] || null;
        if (!activeSession) return null;

        const opConfig = getStoreOperatingConfig(selectedStore, selectedMonth, selectedYear);
        const empStoreMap: Record<string, string> = {};
        employees.forEach(e => {
            empStoreMap[e.employee_id] = e.store_name;
        });

        return buildCampaignSummaryFromSession(
            activeSession,
            campaignTargetsMap,
            campaignDict,
            opConfig.passedDays || 26,
            opConfig.operatingDays || 30,
            {
                selectedStore,
                empStoreMap,
                storesList: stores,
                offsets: campaignOffsets
            }
        );
    }, [selectedStore, sessions, employees, campaignTargetsMap, campaignDict, selectedMonth, selectedYear, stores, campaignOffsets]);

    // 5. Dữ liệu Nhịp Doanh Thu (Trend records lọc theo ST)
    const storeTrendRecords = useMemo<BusinessDayRecord[]>(() => {
        if (!selectedStore || selectedStore === 'all') return [];
        return trendRecords.filter(r => isStoreMatch(r.storeName, selectedStore, stores));
    }, [trendRecords, selectedStore, stores]);

    return {
        stores,
        loading,
        dailyRecord,
        monthlyRecords,
        performanceRows,
        performanceSummary,
        campaignSummary,
        campaignDict,
        trendRecords: storeTrendRecords,
        refreshAll: loadAll
    };
}
