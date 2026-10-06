import { useState, useEffect, useMemo } from 'react';
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
import { getStoreOperatingConfig, getShortenedEmployeeName } from '../../employee-performance/utils/performanceConfig';
import { resolveCanonicalCampaign, isEmployeeInStore, normalizeCampaignToken } from '../../campaign-summary/utils/campaignSummaryStorage';
import { formatDate, getYesterdayDateString, isStoreMatch } from '../../../core/lib/formatters';
import type {
    CampaignProgressItem,
    EmployeeCampaignProgressDetail,
    QuickFilterMode,
    SortMode,
    CampaignOverallMetrics
} from '../types';

export function useCampaignProgressData() {
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedStore, setSelectedStore] = useState<string>('all');

    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [campaignDict, setCampaignDict] = useState<CampaignDictItem[]>([]);
    const [targetsMap, setTargetsMap] = useState<Record<string, Record<string, number>>>({});

    const [sessions, setSessions] = useState<EmployeeDataSession[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string>('');
    const [businessRecords, setBusinessRecords] = useState<BusinessDayRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Multi-select and Filter states
    const [selectedCampaignKeys, setSelectedCampaignKeys] = useState<string[]>([]);
    const [quickFilter, setQuickFilter] = useState<QuickFilterMode>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortMode, setSortMode] = useState<SortMode>('FORECAST_ASC');

    // 1. Tải dữ liệu hệ thống
    const loadData = async () => {
        setLoading(true);
        const [storesRes, dictRes, targetsRes, empsRes, bRecsRes] = await Promise.all([
            fetchStores(),
            fetchCampaignDictionary(),
            fetchEmployeeCampaignTargets(selectedMonth, selectedYear),
            fetchEmployees(),
            fetchBusinessRecords(selectedMonth, selectedYear)
        ]);

        if (storesRes.success && storesRes.data) setStores(storesRes.data);
        if (dictRes.success && dictRes.data) setCampaignDict(dictRes.data);
        if (empsRes.success && empsRes.data) setEmployees(empsRes.data);
        if (bRecsRes.success && bRecsRes.data) setBusinessRecords(bRecsRes.data);

        const tMap: Record<string, Record<string, number>> = {};
        if (targetsRes.success && targetsRes.data) {
            targetsRes.data.forEach((row: any) => {
                const empId = String(row.employee_id || '').trim();
                const rawKey = String(row.raw_key || '').trim();
                if (empId && rawKey) {
                    if (!tMap[empId]) tMap[empId] = {};
                    tMap[empId][rawKey] = Number(row.target_value) || 0;
                }
            });
        }
        setTargetsMap(tMap);

        const allSessions = await syncAndFetchEmployeeDataSessions({
            month: selectedMonth,
            year: selectedYear
        });

        const validSessions = allSessions.filter(s =>
            (s.session_type === 'REVENUE_CAMPAIGN' || s.session_type === 'FULL_SYNC') &&
            s.records.length > 0 &&
            s.records.some(r => r.campaigns && Object.keys(r.campaigns).length > 0)
        );

        setSessions(validSessions);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [selectedMonth, selectedYear]);

    // 2. Danh sách phiên phù hợp theo siêu thị
    const availableSessions = useMemo<EmployeeDataSession[]>(() => {
        if (selectedStore === 'all') {
            const storeMap = new Map<string, EmployeeDataSession>();
            sessions.forEach(s => {
                const st = s.store_name || '';
                if (st && st !== 'Toàn Cụm Siêu Thị' && !storeMap.has(st)) {
                    storeMap.set(st, s);
                }
            });

            if (storeMap.size > 1) {
                const combinedRecords: any[] = [];
                let latestReportDate = '';
                storeMap.forEach((sess) => {
                    if (sess.report_date && (!latestReportDate || sess.report_date > latestReportDate)) {
                        latestReportDate = sess.report_date;
                    }
                    combinedRecords.push(...(sess.records || []));
                });

                const clusterSession: EmployeeDataSession = {
                    id: 'all_cluster_latest',
                    session_type: 'REVENUE_CAMPAIGN',
                    session_title: '✨ Toàn cụm: Tổng hợp phiên mới nhất',
                    store_name: 'Toàn Cụm Siêu Thị',
                    month: selectedMonth,
                    year: selectedYear,
                    report_date: latestReportDate || getYesterdayDateString(),
                    created_at: new Date().toISOString(),
                    created_by: 'Hệ thống SalesHub',
                    employee_count: combinedRecords.length,
                    total_revenue_actual: combinedRecords.reduce((sum, r) => sum + (r.revenue_actual || 0), 0),
                    total_revenue_qd: combinedRecords.reduce((sum, r) => sum + (r.revenue_qd || 0), 0),
                    total_work_hours: 0,
                    source_type: 'PASTE_TEXT',
                    records: combinedRecords
                };

                return [clusterSession, ...sessions];
            }
        }
        return sessions.filter(s => selectedStore === 'all' || s.store_name === selectedStore);
    }, [sessions, selectedStore, selectedMonth, selectedYear]);

    // Phiên đang chọn (mặc định lấy phiên đầu tiên nếu chưa chọn hoặc phiên cũ không còn)
    const activeSession = useMemo<EmployeeDataSession | undefined>(() => {
        if (!availableSessions.length) return undefined;
        if (selectedSessionId) {
            const found = availableSessions.find(s => s.id === selectedSessionId);
            if (found) return found;
        }
        return availableSessions[0];
    }, [availableSessions, selectedSessionId]);

    // 3. Cấu hình ngày hoạt động và ngày đã qua
    const operatingConfig = useMemo(() => {
        const storeName = selectedStore === 'all' ? 'ALL' : selectedStore;
        const config = getStoreOperatingConfig(storeName, selectedMonth, selectedYear);
        let passedDays = config.passedDays;
        if (activeSession?.report_date) {
            const d = new Date(activeSession.report_date);
            if (!isNaN(d.getTime())) {
                passedDays = Math.min(d.getDate(), config.operatingDays);
            }
        }
        return {
            ...config,
            passedDays: Math.max(1, passedDays)
        };
    }, [selectedStore, selectedMonth, selectedYear, activeSession]);

    // Bản đồ nhân viên: empId -> Store Name & Full Name
    const empInfoMap = useMemo(() => {
        const map: Record<string, { storeName: string; fullName: string }> = {};
        employees.forEach(e => {
            const id = e.employee_id.trim();
            if (id) {
                map[id] = { storeName: e.store_name || '', fullName: e.full_name || '' };
            }
        });
        return map;
    }, [employees]);

    // 4. Tổng hợp tiến độ theo từng chương trình thi đua
    const allCampaignProgressItems = useMemo<CampaignProgressItem[]>(() => {
        if (!activeSession) return [];

        const records = activeSession.records || [];
        const passedDays = operatingConfig.passedDays;
        const operatingDays = operatingConfig.operatingDays;

        const reportDateStr = activeSession.report_date || '';

        // Lấy các bản ghi kinh doanh (daily_business_records) phù hợp cho siêu thị / cụm
        let matchedBusinessRecords: BusinessDayRecord[] = [];
        if (businessRecords.length > 0) {
            if (selectedStore === 'all') {
                let onDate = businessRecords.filter(r => r.reportDate === reportDateStr);
                if (!onDate.length && businessRecords.length > 0) {
                    const latestDate = businessRecords[businessRecords.length - 1].reportDate;
                    onDate = businessRecords.filter(r => r.reportDate === latestDate);
                }
                matchedBusinessRecords = onDate.filter(r => !/^(tổng|tong)/i.test(r.storeName));
            } else {
                const storeRecs = businessRecords.filter(r => isStoreMatch(r.storeName, selectedStore, stores));
                const exactDate = storeRecs.find(r => r.reportDate === reportDateStr);
                if (exactDate) {
                    matchedBusinessRecords = [exactDate];
                } else if (storeRecs.length > 0) {
                    matchedBusinessRecords = [storeRecs[storeRecs.length - 1]];
                }
            }
        }

        // Lọc các bản ghi theo siêu thị
        const filteredRecords = records.filter(r => {
            const empId = (r.employee_id || '').trim();
            if (!empId) return false;
            if (selectedStore !== 'all') {
                const empStoreMap: Record<string, string> = {};
                Object.entries(empInfoMap).forEach(([k, v]) => { empStoreMap[k] = v.storeName; });
                return isEmployeeInStore(empId, selectedStore, empStoreMap, activeSession.store_name, stores);
            }
            return true;
        });

        // Gom các chỉ tiêu theo canonicalKey
        const campaignMap = new Map<string, {
            canonicalKey: string;
            displayName: string;
            unit: string;
            orderIndex: number;
            rawKeys: Set<string>;
        }>();

        // Tìm tất cả các chương trình thi đua mà nhân viên trong phạm vi có target > 0
        filteredRecords.forEach(r => {
            const empId = (r.employee_id || '').trim();
            const empTargets = targetsMap[empId] || {};
            Object.entries(empTargets).forEach(([rawKey, val]) => {
                if (Number(val) > 0 && rawKey.trim()) {
                    const resolved = resolveCanonicalCampaign(rawKey.trim(), campaignDict);
                    const cKey = resolved.canonicalKey;
                    const dictItem = resolved.dictItem;
                    if (!campaignMap.has(cKey)) {
                        campaignMap.set(cKey, {
                            canonicalKey: cKey,
                            displayName: dictItem?.display_name || cKey,
                            unit: dictItem?.unit || 'Cái',
                            orderIndex: dictItem?.order_index ?? dictItem?.sort_order ?? 999,
                            rawKeys: new Set<string>()
                        });
                    }
                    campaignMap.get(cKey)!.rawKeys.add(rawKey.trim());
                }
            });
        });

        // Với mỗi chương trình, thu thập danh sách nhân viên có target và tính chỉ số
        const items: CampaignProgressItem[] = [];

        campaignMap.forEach((campInfo, cKey) => {
            const aliasKeys = Array.from(campInfo.rawKeys);
            const employeeDetails: EmployeeCampaignProgressDetail[] = [];

            filteredRecords.forEach(r => {
                const empId = (r.employee_id || '').trim();
                const empTargets = targetsMap[empId] || {};

                // Tìm target của nhân viên cho chương trình này
                let empTarget = Number(empTargets[cKey]) || 0;
                if (empTarget <= 0) {
                    for (const alias of aliasKeys) {
                        const val = Number(empTargets[alias]) || 0;
                        if (val > 0) {
                            empTarget = val;
                            break;
                        }
                    }
                }

                // CHỈ XÉT NHÂN VIÊN CÓ GIAO TARGET (> 0)
                if (empTarget > 0) {
                    let empActual = 0;
                    if (r.campaigns) {
                        if (r.campaigns[cKey] !== undefined) {
                            empActual = Number(r.campaigns[cKey]) || 0;
                        } else {
                            for (const alias of aliasKeys) {
                                if (r.campaigns[alias] !== undefined) {
                                    empActual = Number(r.campaigns[alias]) || 0;
                                    break;
                                }
                            }
                        }

                        if (empActual === 0) {
                            for (const [sKey, sVal] of Object.entries(r.campaigns)) {
                                const sResolved = resolveCanonicalCampaign(sKey, campaignDict);
                                if (sResolved.canonicalKey === cKey) {
                                    empActual = Number(sVal) || 0;
                                    break;
                                }
                            }
                        }
                    }

                    // Còn lại = Lũy kế - Target (âm nếu còn thiếu, dương nếu đã vượt, theo mẫu tham khảo)
                    const remaining = Number((empActual - empTarget).toFixed(1));
                    const completionRate = Number(((empActual / empTarget) * 100).toFixed(1));
                    const forecast = (empActual / passedDays) * operatingDays;
                    const forecastRate = Math.round((forecast / empTarget) * 100);
                    const isAchieved = forecastRate >= 100;
                    const isTargetMet = empActual >= empTarget;

                    const fullName = (r.full_name || empInfoMap[empId]?.fullName || empId).trim();
                    const storeName = empInfoMap[empId]?.storeName || activeSession.store_name || '';

                    employeeDetails.push({
                        employeeId: empId,
                        fullName,
                        displayName: `${empId} - ${fullName.toUpperCase()}`,
                        storeName,
                        target: empTarget,
                        actual: empActual,
                        remaining,
                        completionRate,
                        forecastRate,
                        isAchieved,
                        isTargetMet
                    });
                }
            });

            // Nếu chương trình có ít nhất 1 nhân viên được giao target
            if (employeeDetails.length > 0) {
                // Sắp xếp danh sách nhân viên giảm dần theo %HT (DK) theo chuẩn ảnh mẫu tham khảo
                employeeDetails.sort((a, b) => b.forecastRate - a.forecastRate || b.actual - a.actual);

                // =========================================================================
                // DỮ LIỆU TỔNG: Lấy dữ liệu lũy kế của chính thi đua đó (không tính tổng NV)
                // =========================================================================
                let storeCampaignTarget: number | null = null;
                let storeCampaignActual: number | null = null;
                let storeCampaignPctDK: number | null = null;

                if (matchedBusinessRecords.length > 0) {
                    let sumTarget = 0;
                    let sumActual = 0;
                    let hasFound = false;

                    matchedBusinessRecords.forEach(br => {
                        if (br.emulationSummary) {
                            for (const [rawKey, emu] of Object.entries(br.emulationSummary)) {
                                const res = resolveCanonicalCampaign(rawKey, campaignDict);
                                const isMatch = res.canonicalKey === cKey ||
                                    aliasKeys.includes(rawKey) ||
                                    normalizeCampaignToken(rawKey) === normalizeCampaignToken(cKey);
                                if (isMatch) {
                                    sumTarget += Number(emu.target) || 0;
                                    sumActual += Number(emu.actual) || 0;
                                    hasFound = true;
                                    break;
                                }
                            }
                        }
                    });

                    if (hasFound) {
                        storeCampaignTarget = sumTarget;
                        storeCampaignActual = sumActual;
                        if (sumTarget > 0 && passedDays > 0) {
                            storeCampaignPctDK = Math.round(((sumActual / passedDays) * operatingDays) / sumTarget * 100);
                        }
                    }
                }

                // Thiết lập số liệu tổng: Ưu tiên dữ liệu lũy kế của thi đua đó từ siêu thị
                let totalTarget = 0;
                let totalActual = 0;
                let forecastRate = 0;

                if (storeCampaignTarget !== null && storeCampaignActual !== null) {
                    totalTarget = Number(storeCampaignTarget.toFixed(1));
                    totalActual = Number(storeCampaignActual.toFixed(1));
                    forecastRate = storeCampaignPctDK ?? (totalTarget > 0 ? Math.round(((totalActual / passedDays) * operatingDays) / totalTarget * 100) : 0);
                } else {
                    // Fallback: Lấy tổng toàn bộ nhân sự trong phiên của siêu thị (kể cả nhân viên không có target)
                    const allStoreActual = filteredRecords.reduce((sum, r) => {
                        let act = 0;
                        if (r.campaigns) {
                            if (r.campaigns[cKey] !== undefined) act = Number(r.campaigns[cKey]) || 0;
                            else {
                                for (const alias of aliasKeys) {
                                    if (r.campaigns[alias] !== undefined) {
                                        act = Number(r.campaigns[alias]) || 0;
                                        break;
                                    }
                                }
                            }
                        }
                        return sum + act;
                    }, 0);

                    totalActual = Number(allStoreActual.toFixed(1));
                    totalTarget = Number(employeeDetails.reduce((sum, e) => sum + e.target, 0).toFixed(1));
                    const totalForecast = (totalActual / passedDays) * operatingDays;
                    forecastRate = totalTarget > 0 ? Math.round((totalForecast / totalTarget) * 100) : 0;
                }

                const totalRemaining = Number((totalActual - totalTarget).toFixed(1));
                const completionRate = totalTarget > 0 ? Number(((totalActual / totalTarget) * 100).toFixed(1)) : 0;
                const isAchieved = forecastRate >= 100;

                const achievedEmployees = employeeDetails.filter(e => e.isAchieved).length;
                const unachievedEmployees = employeeDetails.length - achievedEmployees;
                const employeeAchieveRate = Number(((achievedEmployees / employeeDetails.length) * 100).toFixed(1));

                items.push({
                    campaignKey: cKey,
                    displayName: campInfo.displayName,
                    unit: campInfo.unit,
                    orderIndex: campInfo.orderIndex,
                    totalTarget,
                    totalActual,
                    totalRemaining,
                    completionRate,
                    forecastRate,
                    isAchieved,
                    totalEmployees: employeeDetails.length,
                    achievedEmployees,
                    unachievedEmployees,
                    employeeAchieveRate,
                    employees: employeeDetails
                });
            }
        });

        // Sắp xếp mặc định theo order_index trong từ điển thi đua
        return items.sort((a, b) => a.orderIndex - b.orderIndex || a.displayName.localeCompare(b.displayName));
    }, [activeSession, targetsMap, campaignDict, selectedStore, empInfoMap, operatingConfig, stores, businessRecords]);

    // Tự động đồng bộ selectedCampaignKeys khi danh sách thi đua tải xong
    useEffect(() => {
        if (allCampaignProgressItems.length > 0) {
            setSelectedCampaignKeys(prev => {
                // Nếu chưa chọn gì hoặc các key cũ không còn trong danh sách -> chọn tất cả
                if (!prev.length) {
                    return allCampaignProgressItems.map(c => c.campaignKey);
                }
                const currentValidKeys = new Set(allCampaignProgressItems.map(c => c.campaignKey));
                const retained = prev.filter(k => currentValidKeys.has(k));
                return retained.length > 0 ? retained : allCampaignProgressItems.map(c => c.campaignKey);
            });
        } else {
            setSelectedCampaignKeys([]);
        }
    }, [allCampaignProgressItems]);

    // 5. Thống kê tổng quan (Overall metrics)
    const metrics = useMemo<CampaignOverallMetrics>(() => {
        const total = allCampaignProgressItems.length;
        const achieved = allCampaignProgressItems.filter(c => c.isAchieved).length;
        const notAchieved = total - achieved;
        const avgForecast = total > 0
            ? Math.round(allCampaignProgressItems.reduce((sum, c) => sum + c.forecastRate, 0) / total)
            : 0;

        const uniqueEmpSet = new Set<string>();
        allCampaignProgressItems.forEach(c => {
            c.employees.forEach(e => uniqueEmpSet.add(e.employeeId));
        });

        return {
            totalCampaigns: total,
            achievedCampaigns: achieved,
            notAchievedCampaigns: notAchieved,
            avgForecastRate: avgForecast,
            totalAssignedEmployees: uniqueEmpSet.size
        };
    }, [allCampaignProgressItems]);

    // 6. Danh sách hiển thị sau khi áp dụng multi-select, quickFilter, tìm kiếm và sắp xếp
    const displayedCampaigns = useMemo<CampaignProgressItem[]>(() => {
        const selectedSet = new Set(selectedCampaignKeys);
        let list = allCampaignProgressItems.filter(c => selectedSet.has(c.campaignKey));

        // Lọc nhanh theo trạng thái đạt / không đạt
        if (quickFilter === 'NOT_ACHIEVED') {
            list = list.filter(c => !c.isAchieved);
        } else if (quickFilter === 'ACHIEVED') {
            list = list.filter(c => c.isAchieved);
        }

        // Lọc tìm kiếm theo tên chương trình
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(c =>
                c.displayName.toLowerCase().includes(q) ||
                c.campaignKey.toLowerCase().includes(q) ||
                c.employees.some(e => e.fullName.toLowerCase().includes(q) || e.employeeId.includes(q))
            );
        }

        // Sắp xếp
        return [...list].sort((a, b) => {
            switch (sortMode) {
                case 'FORECAST_ASC':
                    return a.forecastRate - b.forecastRate;
                case 'FORECAST_DESC':
                    return b.forecastRate - a.forecastRate;
                case 'NAME_ASC':
                    return a.displayName.localeCompare(b.displayName);
                case 'TARGET_DESC':
                    return b.totalTarget - a.totalTarget;
                case 'GAP_DESC':
                    return b.totalRemaining - a.totalRemaining;
                default:
                    return a.orderIndex - b.orderIndex;
            }
        });
    }, [allCampaignProgressItems, selectedCampaignKeys, quickFilter, searchQuery, sortMode]);

    // Các hàm tương tác Multi-select
    const toggleCampaignKey = (key: string) => {
        setSelectedCampaignKeys(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const selectAllCampaigns = () => {
        setSelectedCampaignKeys(allCampaignProgressItems.map(c => c.campaignKey));
    };

    const deselectAllCampaigns = () => {
        setSelectedCampaignKeys([]);
    };

    return {
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear,
        selectedStore,
        setSelectedStore,
        stores,
        sessions: availableSessions,
        selectedSessionId,
        setSelectedSessionId,
        activeSession,
        operatingConfig,
        loading,
        loadData,
        allCampaignProgressItems,
        displayedCampaigns,
        metrics,
        selectedCampaignKeys,
        toggleCampaignKey,
        selectAllCampaigns,
        deselectAllCampaigns,
        quickFilter,
        setQuickFilter,
        searchQuery,
        setSearchQuery,
        sortMode,
        setSortMode
    };
}
