import { useState, useEffect, useMemo } from 'react';
import {
    fetchMonthlyRecordsForChart,
    type BusinessDayRecord
} from '../../../core/lib/storage';
import { getShortStoreName, formatDate, isStoreMatch } from '../../../core/lib/formatters';
import { GUEST_DEMO_STORE, isDemoDateAllowed } from '../../../core/lib/guestDemoStoreService';
import type { CurrentUser } from '../../../shared/contexts/AuthContext';
import { fetchClusterTargetConfigPackage } from '../../cluster-report/services/clusterTargetService';
import type { ClusterTargetConfigItem } from '../../cluster-report/types';

export interface DailyTrendPoint {
    reportDate: string;
    dayNumber: number;
    dayLabel: string;
    dayOfWeekLabel: string;
    isWeekend: boolean;
    revenueActual: number;
    revenueTarget: number;
    revenueInstallment: number;
    dailyPace: number;
    dailyInstallment: number;
    paceDiff: number; // Chênh lệch so với ngày hôm trước
    completionRate: number;
    installmentRate: number;
    storesCount: number;
    paceStatus: 'above_expected' | 'above_base' | 'below_base';
}

export interface StorePaceItem {
    storeName: string;
    actual: number;
    target: number; // Target gốc
    targetRate: number; // % kỳ vọng vượt trội
    expectedTarget: number; // Target kỳ vọng
    completionRate: number; // % HT target gốc
    expectedCompletionRate: number; // % HT target kỳ vọng
    latestPace: number;
    avgDailyPace: number;
    plannedDailyPace: number; // Kế hoạch bình quân ngày chuẩn 100%
    plannedExpectedDailyPace: number; // Kế hoạch bình quân ngày chuẩn kỳ vọng
    requiredDailyPace: number; // Nhịp cần chạy / ngày để đạt mốc kỳ vọng
    requiredBaseDailyPace: number; // Nhịp cần chạy / ngày để đạt mốc gốc
    remainingRevenue: number;
    status: 'leading' | 'on_track' | 'lagging';
    installment: number;
    installmentRate: number;
}

export interface RevenueTrendMetrics {
    totalDays: number;
    passedDays: number;
    remainingDays: number;
    latestDate: string | null;
    totalActual: number;
    totalTarget: number; // Target gốc 100%
    targetRate: number; // Tỷ lệ kỳ vọng vượt trội (ví dụ 119%)
    expectedTarget: number; // Target kỳ vọng (Target gốc * targetRate%)
    expectedCompletionRate: number; // % Hoàn thành so với Target kỳ vọng
    totalInstallment: number;
    completionRate: number; // % Hoàn thành so với Target gốc
    installmentRate: number;
    currentAvgPace: number;
    // MỐC KẾ HOẠCH BÌNH QUÂN NGÀY CỦA THÁNG (CHUẨN ĐO LƯỜNG TỪNG NGÀY TRÊN BIỂU ĐỒ & BẢNG)
    plannedBaseDailyPace: number; // Target gốc / totalDays
    plannedExpectedDailyPace: number; // Target kỳ vọng / totalDays
    // MỐC NHỊP CẦN ĐẠT MỖI NGÀY CÒN LẠI (ÁP LỰC CHẠY CHO CÁC NGÀY TỚI)
    requiredDailyPace: number; // (expectedTarget - totalActual) / remainingDays
    requiredBaseDailyPace: number; // (totalTarget - totalActual) / remainingDays
    latestDailyPace: number;
    latestPaceDiff: number;
    paceGap: number; // So với kế hoạch ngày kỳ vọng (latestDailyPace - plannedExpectedDailyPace)
    basePaceGap: number; // So với kế hoạch ngày gốc (latestDailyPace - plannedBaseDailyPace)
    requiredPaceGap: number; // So với nhịp cần chạy còn lại (latestDailyPace - requiredDailyPace)
    paceHealth: 'leading' | 'on_track' | 'lagging' | 'completed';
    projectedRevenue: number;
    projectedCompletionRate: number;
    peakDay: { date: string; pace: number; label: string } | null;
    lowDay: { date: string; pace: number; label: string } | null;
    weekendAvgPace: number;
    weekdayAvgPace: number;
    maxDailyPace: number;
}

export function useRevenueTrendData(
    selectedMonth: number,
    selectedYear: number,
    selectedStore: string,
    currentUser: CurrentUser | null,
    isAdmin: boolean,
    canAccessStore: (storeName?: string) => boolean
) {
    const isGuest = Boolean(currentUser?.is_guest);
    const [rawRecords, setRawRecords] = useState<BusinessDayRecord[]>([]);
    const [targetPkg, setTargetPkg] = useState<{
        items: ClusterTargetConfigItem[];
        globalPaceRate: number;
        updatedAt?: string;
    }>({
        items: [],
        globalPaceRate: 100
    });
    const [loading, setLoading] = useState<boolean>(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const [recordsRes, pkgRes] = await Promise.all([
                fetchMonthlyRecordsForChart(selectedMonth, selectedYear),
                fetchClusterTargetConfigPackage(selectedMonth, selectedYear)
            ]);

            if (recordsRes.success && recordsRes.data) {
                setRawRecords(recordsRes.data);
            } else {
                setRawRecords([]);
            }

            if (pkgRes) {
                setTargetPkg(pkgRes);
            }
        } catch (err) {
            console.error('Lỗi nạp dữ liệu nhịp doanh thu & target package:', err);
            setRawRecords([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedMonth, selectedYear]);

    const isClusterScope = selectedStore === 'Tổng' || selectedStore === 'all' || /^(tổng|tong|toàn cụm)/i.test(selectedStore);

    // Tỷ lệ kỳ vọng (vượt trội) áp dụng cho phạm vi đang xem
    const effectiveTargetRate = useMemo<number>(() => {
        if (isClusterScope) {
            return targetPkg.globalPaceRate || 100;
        }
        const cfg = targetPkg.items.find(it =>
            getShortStoreName(it.storeName) === selectedStore ||
            isStoreMatch(it.storeName, selectedStore)
        );
        return (cfg?.targetRate && cfg.targetRate > 0) ? cfg.targetRate : (targetPkg.globalPaceRate || 100);
    }, [selectedStore, targetPkg, isClusterScope]);

    // Danh sách ST có quyền xem
    const storeList = useMemo<string[]>(() => {
        if (isGuest) {
            return [getShortStoreName(GUEST_DEMO_STORE)];
        }
        const set = new Set<string>();
        rawRecords.forEach(r => {
            const sName = getShortStoreName(r.storeName);
            if (sName && sName !== 'Tổng' && !/^(tổng|tong)/i.test(r.storeName)) {
                if (isAdmin || canAccessStore(r.storeName) || canAccessStore(sName)) {
                    set.add(sName);
                }
            }
        });
        const list = Array.from(set).sort();
        if (list.length > 0) return list;

        const accessible: string[] = currentUser?.accessible_stores && currentUser.accessible_stores.length > 0
            ? currentUser.accessible_stores
            : (currentUser?.store_name ? [currentUser.store_name] : []);
        return Array.from(new Set<string>(accessible.map(s => getShortStoreName(s))));
    }, [rawRecords, isGuest, isAdmin, canAccessStore, currentUser]);

    // Chuẩn hóa và làm sạch bản ghi theo ST và ngày
    const { cleanedRecords, recordsByStore, paceByStoreDate, installmentPaceByStoreDate } = useMemo(() => {
        const storeDateMap = new Map<string, BusinessDayRecord>();

        rawRecords.forEach(r => {
            if (!r.reportDate) return;
            const sName = getShortStoreName(r.storeName);

            if (isGuest) {
                if (!isStoreMatch(r.storeName, GUEST_DEMO_STORE) && !isStoreMatch(r.storeName, '838679')) return;
                if (!isDemoDateAllowed(r.reportDate)) return;
            } else if (!isAdmin) {
                const isTong = sName === 'Tổng' || /^(tổng|tong)/i.test(r.storeName);
                if (!isTong && !canAccessStore(r.storeName) && !canAccessStore(sName)) return;
            }

            const key = `${r.reportDate}_${sName}`;
            const existing = storeDateMap.get(key);
            if (!existing || (Number(r.revenueActual) || 0) > (Number(existing.revenueActual) || 0)) {
                storeDateMap.set(key, r);
            }
        });

        const cleaned: BusinessDayRecord[] = Array.from(storeDateMap.values());

        const byStore: Record<string, BusinessDayRecord[]> = {};
        cleaned.forEach(r => {
            const sName = getShortStoreName(r.storeName);
            if (!byStore[sName]) byStore[sName] = [];
            byStore[sName].push(r);
        });

        const paceMap = new Map<string, number>();
        const instPaceMap = new Map<string, number>();

        Object.entries(byStore).forEach(([sName, sRecords]) => {
            sRecords.sort((a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime());

            sRecords.forEach((rec, idx) => {
                const curRev = Number(rec.revenueActual) || 0;
                const curInst = Number(rec.revenueInstallment) || 0;
                let pace = 0;
                let instPace = 0;

                if (idx === 0) {
                    const dayNum = new Date(rec.reportDate).getDate();
                    const passed = Number(rec.passedDays) || dayNum || 1;
                    if (dayNum === 1 || passed <= 1) {
                        pace = curRev;
                        instPace = curInst;
                    } else {
                        pace = Math.round(curRev / passed);
                        instPace = Math.round(curInst / passed);
                    }
                } else {
                    const prevRev = Number(sRecords[idx - 1].revenueActual) || 0;
                    const prevInst = Number(sRecords[idx - 1].revenueInstallment) || 0;
                    const prevDate = new Date(sRecords[idx - 1].reportDate);
                    const curDate = new Date(rec.reportDate);
                    const diffDays = Math.max(1, Math.round((curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)));

                    const diffRev = Math.max(0, curRev - prevRev);
                    const diffInst = Math.max(0, curInst - prevInst);
                    pace = diffDays === 1 ? diffRev : Math.round(diffRev / diffDays);
                    instPace = diffDays === 1 ? diffInst : Math.round(diffInst / diffDays);
                }

                paceMap.set(`${rec.reportDate}_${sName}`, pace);
                instPaceMap.set(`${rec.reportDate}_${sName}`, instPace);
            });
        });

        return {
            cleanedRecords: cleaned,
            recordsByStore: byStore,
            paceByStoreDate: paceMap,
            installmentPaceByStoreDate: instPaceMap
        };
    }, [rawRecords, isGuest, isAdmin, canAccessStore]);

    // Tổng số ngày trong tháng
    const totalDaysInMonth = useMemo(() => {
        return new Date(selectedYear, selectedMonth, 0).getDate();
    }, [selectedMonth, selectedYear]);

    // Chuỗi thời gian dữ liệu từng ngày
    const timelineData = useMemo<DailyTrendPoint[]>(() => {
        if (cleanedRecords.length === 0) return [];

        const groupedByDate: Record<string, BusinessDayRecord[]> = {};
        cleanedRecords.forEach(r => {
            if (!groupedByDate[r.reportDate]) groupedByDate[r.reportDate] = [];
            groupedByDate[r.reportDate].push(r);
        });

        const dates = Object.keys(groupedByDate).sort().filter(d => {
            if (isGuest) return isDemoDateAllowed(d);
            return true;
        });

        const result: DailyTrendPoint[] = [];
        let prevPace = 0;

        dates.forEach(date => {
            const recordsInDate = groupedByDate[date];
            const dObj = new Date(date);
            const dayNumber = dObj.getDate();
            const dayOfWeek = dObj.getDay();
            const dayOfWeekNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
            const dayOfWeekLabel = dayOfWeekNames[dayOfWeek];
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            if (isClusterScope) {
                let memberStores = recordsInDate.filter(r => {
                    const sName = getShortStoreName(r.storeName);
                    if (sName === 'Tổng' || /^(tổng|tong)/i.test(r.storeName)) return false;
                    return isAdmin || canAccessStore(r.storeName) || canAccessStore(sName);
                });
                if (memberStores.length === 0) {
                    memberStores = recordsInDate.filter(r => {
                        const sName = getShortStoreName(r.storeName);
                        return sName !== 'Tổng' && !/^(tổng|tong)/i.test(r.storeName);
                    });
                }
                const targetRecords = memberStores.length > 0 ? memberStores : recordsInDate.filter(r => {
                    const sName = getShortStoreName(r.storeName);
                    return sName === 'Tổng' || /^(tổng|tong)/i.test(r.storeName);
                });

                const totalActual = targetRecords.reduce((sum, r) => sum + (Number(r.revenueActual) || 0), 0);
                const totalTarget = targetRecords.reduce((sum, r) => sum + (Number(r.revenueTarget) || 0), 0);
                const totalInstallment = targetRecords.reduce((sum, r) => sum + (Number(r.revenueInstallment) || 0), 0);
                const completionRate = totalTarget > 0 ? (totalActual / totalTarget * 100) : 0;

                const dailyPace = targetRecords.reduce((sum, r) => {
                    const sName = getShortStoreName(r.storeName);
                    return sum + (paceByStoreDate.get(`${date}_${sName}`) || 0);
                }, 0);

                const dailyInstallment = targetRecords.reduce((sum, r) => {
                    const sName = getShortStoreName(r.storeName);
                    return sum + (installmentPaceByStoreDate.get(`${date}_${sName}`) || 0);
                }, 0);

                const installmentRate = dailyPace > 0 ? (dailyInstallment / dailyPace * 100) : 0;
                const paceDiff = dailyPace - prevPace;
                prevPace = dailyPace;

                result.push({
                    reportDate: date,
                    dayNumber,
                    dayLabel: `Ngày ${formatDate(date, 'dd/mm')}`,
                    dayOfWeekLabel,
                    isWeekend,
                    revenueActual: totalActual,
                    revenueTarget: totalTarget,
                    revenueInstallment: totalInstallment,
                    dailyPace,
                    dailyInstallment,
                    paceDiff,
                    completionRate,
                    installmentRate,
                    storesCount: targetRecords.length,
                    paceStatus: 'above_base'
                });
            } else {
                const shopRecord = recordsInDate.find(r =>
                    getShortStoreName(r.storeName) === selectedStore ||
                    isStoreMatch(r.storeName, selectedStore) ||
                    (isGuest && (isStoreMatch(r.storeName, GUEST_DEMO_STORE) || isStoreMatch(r.storeName, '838679')))
                );

                if (shopRecord) {
                    const actual = Number(shopRecord.revenueActual) || 0;
                    const target = Number(shopRecord.revenueTarget) || 0;
                    const installment = Number(shopRecord.revenueInstallment) || 0;
                    const completionRate = target > 0 ? (actual / target * 100) : 0;
                    const pace = paceByStoreDate.get(`${date}_${getShortStoreName(shopRecord.storeName)}`) ||
                        paceByStoreDate.get(`${date}_${selectedStore}`) || 0;
                    const instPace = installmentPaceByStoreDate.get(`${date}_${getShortStoreName(shopRecord.storeName)}`) ||
                        installmentPaceByStoreDate.get(`${date}_${selectedStore}`) || 0;
                    const installmentRate = pace > 0 ? (instPace / pace * 100) : 0;
                    const paceDiff = pace - prevPace;
                    prevPace = pace;

                    result.push({
                        reportDate: date,
                        dayNumber,
                        dayLabel: `Ngày ${formatDate(date, 'dd/mm')}`,
                        dayOfWeekLabel,
                        isWeekend,
                        revenueActual: actual,
                        revenueTarget: target,
                        revenueInstallment: installment,
                        dailyPace: pace,
                        dailyInstallment: instPace,
                        paceDiff,
                        completionRate,
                        installmentRate,
                        storesCount: 1,
                        paceStatus: 'above_base'
                    });
                }
            }
        });

        return result;
    }, [cleanedRecords, selectedStore, isAdmin, canAccessStore, isGuest, paceByStoreDate, installmentPaceByStoreDate]);

    // Tổng hợp các chỉ số nhịp độ (Metrics) tích hợp mục tiêu kỳ vọng
    const metrics = useMemo<RevenueTrendMetrics>(() => {
        const targetRate = effectiveTargetRate;

        if (timelineData.length === 0) {
            return {
                totalDays: totalDaysInMonth,
                passedDays: 0,
                remainingDays: totalDaysInMonth,
                latestDate: null,
                totalActual: 0,
                totalTarget: 0,
                targetRate,
                expectedTarget: 0,
                expectedCompletionRate: 0,
                totalInstallment: 0,
                completionRate: 0,
                installmentRate: 0,
                currentAvgPace: 0,
                plannedBaseDailyPace: 0,
                plannedExpectedDailyPace: 0,
                requiredDailyPace: 0,
                requiredBaseDailyPace: 0,
                latestDailyPace: 0,
                latestPaceDiff: 0,
                paceGap: 0,
                basePaceGap: 0,
                requiredPaceGap: 0,
                paceHealth: 'on_track',
                projectedRevenue: 0,
                projectedCompletionRate: 0,
                peakDay: null,
                lowDay: null,
                weekendAvgPace: 0,
                weekdayAvgPace: 0,
                maxDailyPace: 1
            };
        }

        const latest = timelineData[timelineData.length - 1];
        const passedDays = latest.dayNumber || timelineData.length;
        const remainingDays = Math.max(0, totalDaysInMonth - passedDays);

        const totalActual = latest.revenueActual;
        const totalTarget = latest.revenueTarget; // Target gốc 100%
        const expectedTarget = Math.round((totalTarget * targetRate) / 100); // Target kỳ vọng vượt trội
        const totalInstallment = latest.revenueInstallment;
        const completionRate = latest.completionRate; // % hoàn thành target gốc
        const expectedCompletionRate = expectedTarget > 0 ? (totalActual / expectedTarget * 100) : 0;
        const installmentRate = totalActual > 0 ? (totalInstallment / totalActual * 100) : 0;

        const currentAvgPace = passedDays > 0 ? Math.round((totalActual / passedDays) * 10) / 10 : 0;

        // 1. MỐC KẾ HOẠCH BÌNH QUÂN NGÀY CỦA THÁNG (CHUẨN SO SÁNH TỪNG NGÀY BẤT BIẾN)
        const plannedBaseDailyPace = totalDaysInMonth > 0 ? Math.round((totalTarget / totalDaysInMonth) * 10) / 10 : 0;
        const plannedExpectedDailyPace = totalDaysInMonth > 0 ? Math.round((expectedTarget / totalDaysInMonth) * 10) / 10 : 0;

        // 2. MỐC NHỊP CẦN ĐẠT MỖI NGÀY CÒN LẠI (ÁP LỰC CHẠY CHO CÁC NGÀY TỚI)
        const remainingBaseGap = Math.max(0, totalTarget - totalActual);
        const requiredBaseDailyPace = remainingDays > 0 ? Math.round((remainingBaseGap / remainingDays) * 10) / 10 : 0;

        const remainingExpectedGap = Math.max(0, expectedTarget - totalActual);
        const requiredDailyPace = remainingDays > 0 ? Math.round((remainingExpectedGap / remainingDays) * 10) / 10 : 0;

        const latestDailyPace = latest.dailyPace;
        const latestPaceDiff = latest.paceDiff;
        // Chênh lệch so với Kế hoạch ngày chuẩn của tháng:
        const paceGap = Math.round((latestDailyPace - plannedExpectedDailyPace) * 10) / 10;
        const basePaceGap = Math.round((latestDailyPace - plannedBaseDailyPace) * 10) / 10;
        // Chênh lệch so với Nhịp cần chạy mỗi ngày còn lại:
        const requiredPaceGap = Math.round((latestDailyPace - requiredDailyPace) * 10) / 10;

        // ĐÁNH GIÁ TRẠNG THÁI SỨC KHỎE TIẾN ĐỘ DỰA TRÊN TỐC ĐỘ BÌNH QUÂN ĐÃ QUA (currentAvgPace) SO VỚI NHỊP CẦN CHẠY CÒN LẠI (requiredDailyPace)
        let paceHealth: 'leading' | 'on_track' | 'lagging' | 'completed' = 'on_track';

        if (totalActual >= expectedTarget) {
            paceHealth = 'completed';
        } else if (remainingDays === 0) {
            paceHealth = totalActual >= totalTarget ? 'leading' : 'lagging';
        } else if (requiredDailyPace <= 0) {
            paceHealth = 'completed';
        } else if (currentAvgPace >= requiredDailyPace) {
            // Tốc độ bình quân thực tế đã qua >= Nhịp cần đạt mỗi ngày còn lại để đạt mốc kỳ vọng
            paceHealth = 'leading';
        } else if (currentAvgPace >= requiredBaseDailyPace) {
            // Tốc độ bình quân thực tế >= Nhịp cần đạt mỗi ngày còn lại để đạt mốc cơ sở 100%
            paceHealth = 'on_track';
        } else {
            // Tốc độ bình quân thực tế không đủ gánh nhịp cần đạt 100% còn lại -> cảnh báo hụt nhịp
            paceHealth = 'lagging';
        }

        // Dự báo về đích
        const projectedRevenue = Math.round(totalActual + (currentAvgPace * remainingDays));
        const projectedCompletionRate = totalTarget > 0 ? (projectedRevenue / totalTarget * 100) : 0;

        // Peak day & Low day
        let peak: { date: string; pace: number; label: string } | null = null;
        let low: { date: string; pace: number; label: string } | null = null;
        let maxPace = 1;

        let weekendPaceSum = 0;
        let weekendCount = 0;
        let weekdayPaceSum = 0;
        let weekdayCount = 0;

        timelineData.forEach(p => {
            if (p.dailyPace > maxPace) maxPace = p.dailyPace;
            if (!peak || p.dailyPace > peak.pace) {
                peak = { date: p.reportDate, pace: p.dailyPace, label: `${p.dayLabel} (${p.dayOfWeekLabel})` };
            }
            if (p.dailyPace > 0 && (!low || p.dailyPace < low.pace)) {
                low = { date: p.reportDate, pace: p.dailyPace, label: `${p.dayLabel} (${p.dayOfWeekLabel})` };
            }

            if (p.isWeekend) {
                weekendPaceSum += p.dailyPace;
                weekendCount++;
            } else {
                weekdayPaceSum += p.dailyPace;
                weekdayCount++;
            }
        });

        const weekendAvgPace = weekendCount > 0 ? Math.round((weekendPaceSum / weekendCount) * 10) / 10 : 0;
        const weekdayAvgPace = weekdayCount > 0 ? Math.round((weekdayPaceSum / weekdayCount) * 10) / 10 : 0;

        return {
            totalDays: totalDaysInMonth,
            passedDays,
            remainingDays,
            latestDate: latest.reportDate,
            totalActual,
            totalTarget,
            targetRate,
            expectedTarget,
            expectedCompletionRate,
            totalInstallment,
            completionRate,
            installmentRate,
            currentAvgPace,
            plannedBaseDailyPace,
            plannedExpectedDailyPace,
            requiredDailyPace,
            requiredBaseDailyPace,
            latestDailyPace,
            latestPaceDiff,
            paceGap,
            basePaceGap,
            requiredPaceGap,
            paceHealth,
            projectedRevenue,
            projectedCompletionRate,
            peakDay: peak,
            lowDay: low,
            weekendAvgPace,
            weekdayAvgPace,
            maxDailyPace: Math.max(maxPace, plannedExpectedDailyPace, plannedBaseDailyPace, requiredDailyPace, 1)
        };
    }, [timelineData, totalDaysInMonth, effectiveTargetRate]);

    // Chuẩn hóa paceStatus cho từng ngày trong timelineData theo MỐC KẾ HOẠCH BÌNH QUÂN NGÀY CỦA THÁNG
    const normalizedTimeline = useMemo<DailyTrendPoint[]>(() => {
        const plannedExp = metrics.plannedExpectedDailyPace;
        const plannedBase = metrics.plannedBaseDailyPace;

        return timelineData.map(p => {
            let status: 'above_expected' | 'above_base' | 'below_base' = 'above_base';
            if (plannedExp > 0 && p.dailyPace >= plannedExp) {
                status = 'above_expected';
            } else if (plannedBase > 0 && p.dailyPace >= plannedBase) {
                status = 'above_base';
            } else {
                status = 'below_base';
            }
            return {
                ...p,
                paceStatus: status
            };
        });
    }, [timelineData, metrics.plannedExpectedDailyPace, metrics.plannedBaseDailyPace]);

    // Bảng xếp hạng nhịp các ST khi xem Tổng Cụm (kèm theo targetRate của từng ST)
    const storePaceRankings = useMemo<StorePaceItem[]>(() => {
        if (storeList.length === 0 || !metrics.latestDate) return [];

        const list: StorePaceItem[] = [];
        const passedDays = metrics.passedDays || 1;
        const remainingDays = metrics.remainingDays;

        storeList.forEach(sName => {
            const sRecords = recordsByStore[sName];
            if (!sRecords || sRecords.length === 0) return;

            const latestRecord = sRecords.find(r => r.reportDate === metrics.latestDate) || sRecords[sRecords.length - 1];
            const actual = Number(latestRecord?.revenueActual) || 0;
            const target = Number(latestRecord?.revenueTarget) || 0;
            const installment = Number(latestRecord?.revenueInstallment) || 0;
            const completionRate = target > 0 ? (actual / target * 100) : 0;
            const installmentRate = actual > 0 ? (installment / actual * 100) : 0;

            const cfg = targetPkg.items.find(it =>
                getShortStoreName(it.storeName) === sName ||
                isStoreMatch(it.storeName, sName)
            );
            const storeTargetRate = (cfg?.targetRate && cfg.targetRate > 0) ? cfg.targetRate : (targetPkg.globalPaceRate || 100);
            const storeExpectedTarget = Math.round((target * storeTargetRate) / 100);
            const expectedCompletionRate = storeExpectedTarget > 0 ? (actual / storeExpectedTarget * 100) : 0;

            const latestPace = paceByStoreDate.get(`${latestRecord.reportDate}_${sName}`) || 0;
            const avgDailyPace = passedDays > 0 ? Math.round((actual / passedDays) * 10) / 10 : 0;

            const plannedDailyPace = totalDaysInMonth > 0 ? Math.round((target / totalDaysInMonth) * 10) / 10 : 0;
            const plannedExpectedDailyPace = totalDaysInMonth > 0 ? Math.round((storeExpectedTarget / totalDaysInMonth) * 10) / 10 : 0;

            const remainingExpectedRevenue = Math.max(0, storeExpectedTarget - actual);
            const requiredDailyPace = remainingDays > 0 ? Math.round((remainingExpectedRevenue / remainingDays) * 10) / 10 : 0;

            const remainingBaseRevenue = Math.max(0, target - actual);
            const requiredBaseDailyPace = remainingDays > 0 ? Math.round((remainingBaseRevenue / remainingDays) * 10) / 10 : 0;

            let status: 'leading' | 'on_track' | 'lagging' = 'on_track';
            if (actual >= storeExpectedTarget) {
                status = 'leading';
            } else if (remainingDays === 0) {
                status = actual >= target ? 'leading' : 'lagging';
            } else if (avgDailyPace >= requiredDailyPace) {
                // Nhịp bình quân thực tế của ST >= Nhịp cần chạy mỗi ngày còn lại
                status = 'leading';
            } else if (avgDailyPace >= requiredBaseDailyPace) {
                // Nhịp bình quân thực tế >= Nhịp cần chạy mốc 100%
                status = 'on_track';
            } else {
                status = 'lagging';
            }

            list.push({
                storeName: sName,
                actual,
                target,
                targetRate: storeTargetRate,
                expectedTarget: storeExpectedTarget,
                completionRate,
                expectedCompletionRate,
                latestPace,
                avgDailyPace,
                plannedDailyPace,
                plannedExpectedDailyPace,
                requiredDailyPace,
                requiredBaseDailyPace,
                remainingRevenue: remainingExpectedRevenue,
                status,
                installment,
                installmentRate
            });
        });

        // Xếp hạng ưu tiên theo % Hoàn thành mục tiêu kỳ vọng giảm dần
        return list.sort((a, b) => b.expectedCompletionRate - a.expectedCompletionRate);
    }, [storeList, metrics.latestDate, metrics.passedDays, metrics.remainingDays, recordsByStore, paceByStoreDate, targetPkg, totalDaysInMonth]);

    return {
        rawRecords,
        targetPkg,
        loading,
        storeList,
        timelineData: normalizedTimeline,
        metrics,
        storePaceRankings,
        loadData
    };
}
