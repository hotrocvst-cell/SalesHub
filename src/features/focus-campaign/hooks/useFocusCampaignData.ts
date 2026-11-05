import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    fetchStores,
    fetchCampaignDictionary,
    fetchEmployeeCampaignTargets,
    fetchEmployees,
    fetchBusinessRecords,
    type StoreItem,
    type CampaignDictItem,
    type EmployeeItem,
    type BusinessDayRecord
} from '../../../core/lib/storage';
import {
    syncAndFetchEmployeeDataSessions,
    type EmployeeDataSession
} from '../../employee-cumulative/utils/sessionStorage';
import { getStoreOperatingConfig } from '../../employee-performance/utils/performanceConfig';
import { isStoreMatch } from '../../../core/lib/formatters';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { GUEST_DEMO_STORE } from '../../../core/lib/guestDemoStoreService';
import { fetchCampaignOffsets, type CampaignOffsetItem } from '../../campaign-offset/services/campaignOffsetService';
import {
    fetchWatchlists,
    checkWatchlistTableReady
} from '../services/campaignWatchlistService';
import type {
    CampaignWatchlist,
    QuickFilterEmployeeMode,
    TableViewMode
} from '../types';
import {
    calculateStoreCampaignMetrics,
    buildFocusEmployeeRows,
    generateFocusSmartRemarks
} from '../utils/focusCampaignCalculations';
import { extractPeriodActiveCampaigns } from '../utils/periodCampaignExtractor';
import {
    getAvailableSessions,
    getMatchedBusinessRecords,
    getFilteredSessionRecords
} from '../utils/focusSessionFilter';

export function useFocusCampaignData() {
    const { currentUser, isAdmin } = useAuth();
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [selectedSessionId, setSelectedSessionId] = useState<string>('');

    const [watchlists, setWatchlists] = useState<CampaignWatchlist[]>([]);
    const [activeWatchlistId, setActiveWatchlistId] = useState<string>('');
    const [selectedCampaignKeys, setSelectedCampaignKeys] = useState<string[]>([]);

    const [filterEmployeeMode, setFilterEmployeeMode] = useState<QuickFilterEmployeeMode>('ALL');
    const [searchEmployeeText, setSearchEmployeeText] = useState<string>('');
    const [tableViewMode, setTableViewMode] = useState<TableViewMode>('FULL');

    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [campaignDict, setCampaignDict] = useState<CampaignDictItem[]>([]);
    const [businessRecords, setBusinessRecords] = useState<BusinessDayRecord[]>([]);
    const [sessions, setSessions] = useState<EmployeeDataSession[]>([]);
    const [targetsMap, setTargetsMap] = useState<Record<string, Record<string, number>>>({});
    const [campaignOffsets, setCampaignOffsets] = useState<CampaignOffsetItem[]>([]);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isCloudReady, setIsCloudReady] = useState<boolean>(true);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(new Date());

    // 1. Phân quyền ST (Quy chuẩn 4 & Yêu cầu 4)
    const permittedStores = useMemo<StoreItem[]>(() => {
        if (!stores || stores.length === 0) return [];
        if (isAdmin) return stores;
        if (currentUser?.accessible_stores && currentUser.accessible_stores.length > 0) {
            return stores.filter(s => currentUser.accessible_stores!.some(acc => isStoreMatch(s.name, acc, stores)));
        }
        if (currentUser?.store_name) {
            return stores.filter(s => isStoreMatch(s.name, currentUser.store_name, stores));
        }
        return stores;
    }, [stores, currentUser, isAdmin]);

    const canSelectAllStores = useMemo(() => {
        if (isAdmin) return true;
        if (currentUser?.accessible_stores && currentUser.accessible_stores.length >= stores.length && stores.length > 0) return true;
        return false;
    }, [isAdmin, currentUser, stores]);

    useEffect(() => {
        if (currentUser?.is_guest) {
            setSelectedStore(GUEST_DEMO_STORE);
        } else if (!isAdmin) {
            if (currentUser?.accessible_stores && currentUser.accessible_stores.length > 0) {
                const isValid = currentUser.accessible_stores.some(acc => isStoreMatch(selectedStore, acc, stores));
                if (!isValid && selectedStore !== 'all') setSelectedStore(currentUser.accessible_stores[0]);
            } else if (currentUser?.store_name) {
                setSelectedStore(currentUser.store_name);
            }
        }
    }, [currentUser, isAdmin, stores]);

    useEffect(() => {
        let isMounted = true;
        async function loadInitData() {
            try {
                const [sRes, eRes, dRes] = await Promise.all([fetchStores(), fetchEmployees(), fetchCampaignDictionary()]);
                if (isMounted) {
                    if (sRes.success && sRes.data) setStores(sRes.data);
                    if (eRes.success && eRes.data) setEmployees(eRes.data);
                    if (dRes.success && dRes.data) setCampaignDict(dRes.data.filter(d => d.is_active));
                }
            } catch (e) {
                console.error('Lỗi loadInitData:', e);
            }
        }
        loadInitData();
        return () => { isMounted = false; };
    }, []);

    const reloadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [bRecsRes, sessData, tgRes, offRes, wlRes, ready] = await Promise.all([
                fetchBusinessRecords(selectedMonth, selectedYear),
                syncAndFetchEmployeeDataSessions({ month: selectedMonth, year: selectedYear }),
                fetchEmployeeCampaignTargets(selectedMonth, selectedYear),
                fetchCampaignOffsets(selectedStore, selectedMonth, selectedYear),
                fetchWatchlists(selectedStore, selectedMonth, selectedYear),
                checkWatchlistTableReady()
            ]);

            if (bRecsRes.success && bRecsRes.data) setBusinessRecords(bRecsRes.data);
            if (Array.isArray(sessData)) setSessions(sessData);

            const tMap: Record<string, Record<string, number>> = {};
            if (tgRes.success && tgRes.data) {
                tgRes.data.forEach((row: any) => {
                    const empId = String(row.employee_id || '').trim();
                    const rawKey = String(row.raw_key || '').trim();
                    const target = Number(row.target ?? row.target_value ?? 0);
                    if (empId && rawKey) {
                        if (!tMap[empId]) tMap[empId] = {};
                        tMap[empId][rawKey] = target;
                    }
                });
            }
            setTargetsMap(tMap);

            if (offRes.success && offRes.data) setCampaignOffsets(offRes.data);
            if (wlRes.success && wlRes.data) {
                setWatchlists(wlRes.data);
                const defaultWl = wlRes.data.find(w => w.is_default) || wlRes.data[0];
                if (defaultWl && !activeWatchlistId) {
                    setActiveWatchlistId(defaultWl.id);
                    setSelectedCampaignKeys(defaultWl.campaign_keys);
                }
            }
            setIsCloudReady(ready);
            setLastSyncTime(new Date());
        } catch (err) {
            console.error('Lỗi reloadData FocusCampaign:', err);
        } finally {
            setIsLoading(false);
        }
    }, [selectedMonth, selectedYear, selectedStore, activeWatchlistId]);

    useEffect(() => { reloadData(); }, [reloadData]);

    const handleSelectWatchlist = useCallback((wlId: string) => {
        setActiveWatchlistId(wlId);
        const wl = watchlists.find(w => w.id === wlId);
        if (wl && Array.isArray(wl.campaign_keys)) setSelectedCampaignKeys(wl.campaign_keys);
    }, [watchlists]);

    const availableSessions = useMemo(() => getAvailableSessions(sessions, selectedStore, stores), [sessions, selectedStore, stores]);

    const activeSession = useMemo(() => {
        if (!availableSessions.length) return undefined;
        if (selectedSessionId) {
            const found = availableSessions.find(s => s.id === selectedSessionId);
            if (found) return found;
        }
        return availableSessions[0];
    }, [availableSessions, selectedSessionId]);

    const operatingConfig = useMemo(() => {
        const storeKey = selectedStore === 'all' ? 'ALL' : selectedStore;
        const config = getStoreOperatingConfig(storeKey, selectedMonth, selectedYear);
        let passedDays = config.passedDays;
        if (activeSession?.report_date) {
            const d = new Date(activeSession.report_date);
            if (!isNaN(d.getTime())) passedDays = Math.min(d.getDate(), config.operatingDays);
        }
        return { ...config, passedDays: Math.max(1, passedDays) };
    }, [selectedStore, selectedMonth, selectedYear, activeSession]);

    const matchedBusinessRecords = useMemo(
        () => getMatchedBusinessRecords(businessRecords, activeSession, selectedStore, stores),
        [businessRecords, activeSession, selectedStore, stores]
    );

    const sessionRecords = useMemo(
        () => getFilteredSessionRecords(activeSession, selectedStore, employees, stores),
        [activeSession, selectedStore, employees, stores]
    );

    const periodActiveCampaigns = useMemo(
        () => extractPeriodActiveCampaigns(campaignDict, businessRecords, targetsMap, sessions, selectedCampaignKeys, selectedMonth),
        [campaignDict, businessRecords, targetsMap, sessions, selectedCampaignKeys, selectedMonth]
    );

    const employeeRows = useMemo(() => {
        return buildFocusEmployeeRows(
            sessionRecords,
            targetsMap,
            selectedCampaignKeys,
            campaignDict,
            operatingConfig.passedDays,
            operatingConfig.operatingDays,
            campaignOffsets
        );
    }, [sessionRecords, targetsMap, selectedCampaignKeys, campaignDict, operatingConfig, campaignOffsets]);

    const storeMetrics = useMemo(() => {
        return calculateStoreCampaignMetrics(
            selectedCampaignKeys,
            campaignDict,
            matchedBusinessRecords,
            operatingConfig.passedDays,
            operatingConfig.operatingDays,
            employeeRows
        );
    }, [selectedCampaignKeys, campaignDict, matchedBusinessRecords, operatingConfig, employeeRows]);

    const smartRemarks = useMemo(() => {
        const storeName = selectedStore === 'all' ? 'Toàn Cụm ST' : selectedStore;
        const periodDisplay = `Tháng ${selectedMonth}/${selectedYear}`;
        const activeWl = watchlists.find(w => w.id === activeWatchlistId);
        const wlName = activeWl?.list_name || 'Tùy chọn';
        return generateFocusSmartRemarks(storeName, periodDisplay, wlName, storeMetrics, employeeRows);
    }, [selectedStore, selectedMonth, selectedYear, watchlists, activeWatchlistId, storeMetrics, employeeRows]);

    const filteredEmployeeRows = useMemo(() => {
        let result = employeeRows;
        if (searchEmployeeText.trim()) {
            const q = searchEmployeeText.trim().toLowerCase();
            result = result.filter(r =>
                r.employeeId.toLowerCase().includes(q) ||
                r.fullName.toLowerCase().includes(q) ||
                r.shortName.toLowerCase().includes(q)
            );
        }
        const totalNH = selectedCampaignKeys.length;
        if (filterEmployeeMode === 'ACHIEVED') result = result.filter(r => r.forecastAchievedCount > 0);
        else if (filterEmployeeMode === 'NOT_ACHIEVED') result = result.filter(r => r.forecastAchievedCount < totalNH);
        else if (filterEmployeeMode === 'ALL_PASS') result = result.filter(r => r.forecastAchievedCount === totalNH && totalNH > 0);
        return result;
    }, [employeeRows, searchEmployeeText, filterEmployeeMode, selectedCampaignKeys]);

    const activeWatchlist = useMemo(() => watchlists.find(w => w.id === activeWatchlistId), [watchlists, activeWatchlistId]);

    return {
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear,
        selectedStore,
        setSelectedStore,
        selectedSessionId,
        setSelectedSessionId,
        watchlists,
        activeWatchlistId,
        activeWatchlist,
        handleSelectWatchlist,
        selectedCampaignKeys,
        setSelectedCampaignKeys,
        filterEmployeeMode,
        setFilterEmployeeMode,
        searchEmployeeText,
        setSearchEmployeeText,
        tableViewMode,
        setTableViewMode,
        stores: permittedStores,
        canSelectAllStores,
        campaignDict,
        periodActiveCampaigns,
        availableSessions,
        storeMetrics,
        employeeRows: filteredEmployeeRows,
        smartRemarks,
        isLoading,
        isCloudReady,
        lastSyncTime,
        reloadData
    };
}
