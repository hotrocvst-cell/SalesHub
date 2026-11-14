import { useState, useEffect, useCallback, useMemo } from 'react';
import type { QuarterPreset, QuarterlyEmployeeRow, QuarterlySummary } from '../types';
import {
    fetchStores,
    fetchEmployees,
    fetchCampaignDictionary,
    fetchEmployeeRevenueTargets,
    fetchEmployeeCampaignTargets,
    type StoreItem,
    type EmployeeItem,
    type CampaignDictItem
} from '../../../core/lib/storage';
import {
    syncAndFetchEmployeeDataSessions,
    checkSupabaseSessionTable,
    type EmployeeDataSession
} from '../../employee-cumulative/utils/sessionStorage';
import { getPresetMonths, aggregateQuarterlyRankingData } from '../utils/quarterlyAggregator';

interface UseQuarterlyRankingDataProps {
    selectedStore: string;
    selectedYear: number;
    preset: QuarterPreset;
    customStartMonth: number;
    customEndMonth: number;
    isGuest?: boolean;
}

export function useQuarterlyRankingData({
    selectedStore,
    selectedYear,
    preset,
    customStartMonth,
    customEndMonth,
    isGuest = false
}: UseQuarterlyRankingDataProps) {
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [campaignDict, setCampaignDict] = useState<CampaignDictItem[]>([]);

    const [rows, setRows] = useState<QuarterlyEmployeeRow[]>([]);
    const [summary, setSummary] = useState<QuarterlySummary | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [hasTable, setHasTable] = useState<boolean>(true);
    const [cloudCount, setCloudCount] = useState<number>(0);

    const presetInfo = useMemo(() => {
        return getPresetMonths(preset, selectedYear, customStartMonth, customEndMonth);
    }, [preset, selectedYear, customStartMonth, customEndMonth]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Kiểm tra trạng thái bảng Supabase
            const tableCheck = await checkSupabaseSessionTable();
            setHasTable(tableCheck.exists);
            setCloudCount(tableCheck.count);

            // 2. Tải danh mục cửa hàng, nhân sự & chiến dịch thi đua
            const [storesRes, empsRes, dictRes] = await Promise.all([
                fetchStores(),
                fetchEmployees(),
                fetchCampaignDictionary()
            ]);

            const currentStores = storesRes.success && storesRes.data ? storesRes.data : [];
            const currentEmps = empsRes.success && empsRes.data ? empsRes.data : [];
            const currentDict = dictRes.success && dictRes.data ? dictRes.data : [];

            setStores(currentStores);
            setEmployees(currentEmps);
            setCampaignDict(currentDict);

            const months = presetInfo.months;
            const monthlySessions: Record<number, EmployeeDataSession[]> = {};
            const monthlyRevTargets: Record<number, Record<string, number>> = {};
            const monthlyCampTargets: Record<number, Record<string, Record<string, number>>> = {};

            // 3. Tải song song dữ liệu doanh thu, thi đua và phiên cho từng tháng trong kỳ
            const monthPromises = months.map(async m => {
                const [revRes, campRes, sessions] = await Promise.all([
                    fetchEmployeeRevenueTargets(m, selectedYear),
                    fetchEmployeeCampaignTargets(m, selectedYear),
                    syncAndFetchEmployeeDataSessions({
                        month: m,
                        year: selectedYear,
                        storeName: selectedStore === 'all' ? undefined : selectedStore
                    })
                ]);

                // Chuẩn hóa target doanh thu về triệu đồng (Rule 6)
                const rMap: Record<string, number> = {};
                if (revRes.success && revRes.data) {
                    if (Array.isArray(revRes.data)) {
                        revRes.data.forEach((r: any) => {
                            if (r && r.employee_id != null) {
                                const rawTarget = Number(r.target_revenue) || 0;
                                const key = String(r.employee_id).trim();
                                rMap[key] = rawTarget >= 100_000 ? Math.round(rawTarget / 1_000_000) : rawTarget;
                            }
                        });
                    } else if (typeof revRes.data === 'object') {
                        Object.entries(revRes.data).forEach(([k, v]) => {
                            const rawTarget = Number(v) || 0;
                            rMap[k.trim()] = rawTarget >= 100_000 ? Math.round(rawTarget / 1_000_000) : rawTarget;
                        });
                    }
                }

                // Map target thi đua theo empId -> rawKey -> targetVal
                const cMap: Record<string, Record<string, number>> = {};
                if (campRes.success && campRes.data) {
                    campRes.data.forEach((row: any) => {
                        const empId = String(row.employee_id || row.employeeId || '').trim();
                        const rawKey = String(row.raw_key || row.rawKey || '').trim();
                        const targetVal = Number(row.target_value ?? row.targetValue) || 0;
                        if (empId && rawKey) {
                            if (!cMap[empId]) cMap[empId] = {};
                            cMap[empId][rawKey] = targetVal;
                        }
                    });
                }

                return {
                    month: m,
                    sessions: sessions || [],
                    revTargets: rMap,
                    campTargets: cMap
                };
            });

            const monthResults = await Promise.all(monthPromises);
            monthResults.forEach(res => {
                monthlySessions[res.month] = res.sessions;
                monthlyRevTargets[res.month] = res.revTargets;
                monthlyCampTargets[res.month] = res.campTargets;
            });

            // 4. Tổng hợp & Xếp hạng Quý
            const { rows: calculatedRows, summary: calculatedSummary } = aggregateQuarterlyRankingData({
                months,
                year: selectedYear,
                monthlySessions,
                monthlyRevTargets,
                monthlyCampTargets,
                employees: currentEmps,
                campaignDict: currentDict,
                selectedStore,
                storesList: currentStores,
                isGuest
            });

            setRows(calculatedRows);
            setSummary(calculatedSummary);
        } catch (err: any) {
            console.error('Lỗi tải dữ liệu xếp hạng Quý:', err);
            setError(err?.message || 'Không thể tải dữ liệu xếp hạng Quý');
        } finally {
            setLoading(false);
        }
    }, [presetInfo, selectedStore, selectedYear, isGuest]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    return {
        stores,
        employees,
        campaignDict,
        rows,
        summary,
        loading,
        error,
        hasTable,
        cloudCount,
        presetInfo,
        refresh: loadData
    };
}

