import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    fetchAllBusinessRecords,
    fetchStores,
    fetchEmployees,
    fetchEmployeeRevenueTargets,
    fetchEmployeeCampaignTargets,
    type BusinessDayRecord,
    type StoreItem,
    type EmployeeItem
} from '../../../core/lib/storage';
import {
    syncAndFetchEmployeeDataSessions,
    type EmployeeDataSession
} from '../../employee-cumulative/utils/sessionStorage';
import { getYesterdayDateString } from '../../../core/lib/formatters';
import { calculateDataStatus } from '../utils/statusCalculator';
import type { DataStreamStatus, StoreMatrixRow, OverallReadinessSummary } from '../types';

export function useDataStatus() {
    const today = useMemo(() => new Date(), []);
    const [selectedMonth, setSelectedMonth] = useState<number>(() => today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(() => today.getFullYear());
    const [selectedStore, setSelectedStore] = useState<string>('all');

    // Mặc định ngày n là hôm nay, ngày n-1 là hôm qua
    const todayDateStr = useMemo(() => {
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }, [today]);

    const [expectedDate, setExpectedDate] = useState<string>(() => getYesterdayDateString());

    const [records, setRecords] = useState<BusinessDayRecord[]>([]);
    const [sessions, setSessions] = useState<EmployeeDataSession[]>([]);
    const [empRevenueTargets, setEmpRevenueTargets] = useState<{ employee_id: string; target_revenue: number }[]>([]);
    const [empCampaignTargets, setEmpCampaignTargets] = useState<any[]>([]);
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);

    const [loading, setLoading] = useState<boolean>(true);
    const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
    const [error, setError] = useState<string | null>(null);

    const loadAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [
                recordsRes,
                sessionsData,
                revTargetsRes,
                campTargetsRes,
                storesRes,
                empsRes
            ] = await Promise.all([
                fetchAllBusinessRecords(),
                syncAndFetchEmployeeDataSessions({ month: selectedMonth, year: selectedYear }),
                fetchEmployeeRevenueTargets(selectedMonth, selectedYear),
                fetchEmployeeCampaignTargets(selectedMonth, selectedYear),
                fetchStores(),
                fetchEmployees()
            ]);

            if (recordsRes.success && recordsRes.data) {
                setRecords(recordsRes.data);
            }
            if (sessionsData) {
                setSessions(sessionsData);
            }
            if (revTargetsRes.success && revTargetsRes.data) {
                setEmpRevenueTargets(revTargetsRes.data);
            }
            if (campTargetsRes.success && campTargetsRes.data) {
                setEmpCampaignTargets(campTargetsRes.data);
            }
            if (storesRes.success && storesRes.data) {
                setStores(storesRes.data);
            }
            if (empsRes.success && empsRes.data) {
                setEmployees(empsRes.data);
            }

            setLastRefreshedAt(new Date());
        } catch (err: any) {
            console.error('Lỗi khi nạp trạng thái dữ liệu:', err);
            setError(err?.message || 'Không thể đồng bộ dữ liệu trạng thái');
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    // Tính toán kết quả trạng thái
    const calculated = useMemo(() => {
        return calculateDataStatus({
            records,
            sessions,
            empRevenueTargets,
            empCampaignTargets,
            stores,
            employees,
            targetStore: selectedStore,
            expectedDate,
            todayDate: todayDateStr,
            selectedMonth,
            selectedYear
        });
    }, [
        records,
        sessions,
        empRevenueTargets,
        empCampaignTargets,
        stores,
        employees,
        selectedStore,
        expectedDate,
        todayDateStr,
        selectedMonth,
        selectedYear
    ]);

    return {
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear,
        selectedStore,
        setSelectedStore,
        expectedDate,
        setExpectedDate,
        todayDateStr,
        loading,
        lastRefreshedAt,
        error,
        refresh: loadAllData,
        stores,
        streams: calculated.streams,
        matrix: calculated.matrix,
        summary: calculated.summary
    };
}
