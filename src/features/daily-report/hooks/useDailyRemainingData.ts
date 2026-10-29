import { useState, useEffect, useMemo } from 'react';
import {
    fetchStores,
    fetchEmployees,
    fetchEmployeeCampaignTargets,
    fetchBusinessRecords,
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
    getShortStoreName,
    getCampaignLabel,
    formatDate,
    formatValue,
    isStoreMatch
} from '../../../core/lib/formatters';
import {
    isEmployeeInStore,
    resolveCanonicalCampaign,
    normalizeCampaignToken
} from '../../campaign-summary/utils/campaignSummaryStorage';
import type { CampaignItem, RevenueItem } from '../utils/dailyReportParsers';
import {
    getCampaignTokens,
    type RemainingCampaignItem,
    type RemainingSortMode
} from '../utils/dailyRemainingUtils';
import type { AssessmentTemplate } from '../../../shared/components/report/ReportAssessmentModal';

interface UseDailyRemainingDataProps {
    selectedStore: string;
    allData: CampaignItem[];
    campaignsDict: CampaignDictItem[];
    currentRevenue?: RevenueItem;
}

export function useDailyRemainingData({
    selectedStore,
    allData,
    campaignsDict,
    currentRevenue
}: UseDailyRemainingDataProps) {
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

    // Tính số ngày còn lại trong tháng
    const totalDaysInMonth = useMemo(() => {
        return new Date(selectedYear, selectedMonth, 0).getDate();
    }, [selectedMonth, selectedYear]);

    const initialCurrentDay = useMemo(() => {
        if (now.getMonth() + 1 === selectedMonth && now.getFullYear() === selectedYear) {
            return now.getDate();
        }
        return 1;
    }, [selectedMonth, selectedYear]);

    const [remainingDays, setRemainingDays] = useState<number>(() => {
        return Math.max(1, totalDaysInMonth - initialCurrentDay + 1);
    });

    useEffect(() => {
        setRemainingDays(Math.max(1, totalDaysInMonth - initialCurrentDay + 1));
    }, [totalDaysInMonth, initialCurrentDay]);

    const [showCompletedCampaigns, setShowCompletedCampaigns] = useState<boolean>(false);
    const [sortMode, setSortMode] = useState<RemainingSortMode>(() => {
        try {
            return (localStorage.getItem('saleshub_remaining_sort_mode') as RemainingSortMode) || 'REALTIME';
        } catch {
            return 'REALTIME';
        }
    });

    const handleSetSortMode = (mode: RemainingSortMode) => {
        setSortMode(mode);
        try {
            localStorage.setItem('saleshub_remaining_sort_mode', mode);
        } catch {
            // ignore
        }
    };
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [sessions, setSessions] = useState<EmployeeDataSession[]>([]);
    const [businessRecords, setBusinessRecords] = useState<BusinessDayRecord[]>([]);
    const [targetsMap, setTargetsMap] = useState<Record<string, Record<string, number>>>({});
    const [isLoadingSystem, setIsLoadingSystem] = useState<boolean>(false);

    // Tải dữ liệu nền từ Supabase
    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            setIsLoadingSystem(true);
            try {
                const [storesRes, targetsRes, empsRes, sessionsRes, bRecsRes] = await Promise.all([
                    fetchStores(),
                    fetchEmployeeCampaignTargets(selectedMonth, selectedYear),
                    fetchEmployees(),
                    syncAndFetchEmployeeDataSessions({ month: selectedMonth, year: selectedYear }),
                    fetchBusinessRecords(selectedMonth, selectedYear)
                ]);

                if (!isMounted) return;
                if (storesRes.success && storesRes.data) setStores(storesRes.data);
                if (empsRes.success && empsRes.data) setEmployees(empsRes.data);
                if (bRecsRes && bRecsRes.success && bRecsRes.data) setBusinessRecords(bRecsRes.data);

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

                const validSessions = (sessionsRes || []).filter(s =>
                    (s.session_type === 'REVENUE_CAMPAIGN' || s.session_type === 'FULL_SYNC') &&
                    s.records && s.records.length > 0
                );
                setSessions(validSessions);
            } catch (err) {
                console.error('Lỗi tải dữ liệu hệ thống lũy kế:', err);
            } finally {
                if (isMounted) setIsLoadingSystem(false);
            }
        };

        load();
        return () => {
            isMounted = false;
        };
    }, [selectedMonth, selectedYear]);

    // Bản đồ nhân viên -> siêu thị
    const empStoreMap = useMemo(() => {
        const map: Record<string, string> = {};
        employees.forEach(e => {
            if (e.employee_id) map[e.employee_id.trim()] = e.store_name || '';
        });
        return map;
    }, [employees]);

    // Lọc các bản ghi kinh doanh mới nhất theo từng siêu thị
    const matchedBusinessRecords = useMemo<BusinessDayRecord[]>(() => {
        if (!businessRecords || businessRecords.length === 0) return [];
        const sorted = [...businessRecords].sort((a, b) => b.reportDate.localeCompare(a.reportDate));

        if (selectedStore === 'Tổng') {
            const storeLatestMap = new Map<string, BusinessDayRecord>();
            sorted.forEach(r => {
                const sName = (r.storeName || '').trim();
                if (!sName || /^(tổng|tong)/i.test(sName)) return;
                const short = getShortStoreName(sName);
                if (!storeLatestMap.has(short)) storeLatestMap.set(short, r);
            });
            return Array.from(storeLatestMap.values());
        } else {
            const storeRecs = sorted.filter(r => isStoreMatch(r.storeName, selectedStore, stores));
            return storeRecs.length > 0 ? [storeRecs[0]] : [];
        }
    }, [businessRecords, selectedStore, stores]);

    // Lọc phiên nhân viên mới nhất của từng siêu thị
    const activeSessions = useMemo<EmployeeDataSession[]>(() => {
        const sorted = [...sessions].sort((a, b) => {
            const dateA = a.report_date || a.created_at || '';
            const dateB = b.report_date || b.created_at || '';
            return dateB.localeCompare(dateA);
        });

        const storeLatestMap = new Map<string, EmployeeDataSession>();
        if (selectedStore === 'Tổng') {
            sorted.forEach(s => {
                const st = s.store_name?.trim() || '';
                if (st && st !== 'Toàn Cụm Siêu Thị' && !storeLatestMap.has(st)) {
                    storeLatestMap.set(st, s);
                }
            });
        } else {
            sorted.forEach(s => {
                const st = s.store_name?.trim() || '';
                if (st && isStoreMatch(st, selectedStore, stores) && !storeLatestMap.has(st)) {
                    storeLatestMap.set(st, s);
                }
            });
        }
        return Array.from(storeLatestMap.values());
    }, [sessions, selectedStore, stores]);

    // Thông tin tóm tắt kết nối Cloud
    const sessionSummaryInfo = useMemo(() => {
        const bRecDates = Array.from(new Set(matchedBusinessRecords.map(r => r.reportDate).filter(Boolean)));
        const bRecDateStr = bRecDates.length > 0 ? bRecDates.map(d => formatDate(d)).join(', ') : '';

        if (matchedBusinessRecords.length === 0 && activeSessions.length === 0) {
            return {
                title: 'Chưa có dữ liệu lũy kế',
                detail: `Chưa tìm thấy dữ liệu lũy kế cho kỳ Tháng ${selectedMonth}/${selectedYear} (${selectedStore === 'Tổng' ? 'Toàn Cụm' : selectedStore}). Target ngày sẽ tạm thời dùng số chuẩn Realtime.`,
                isReady: false
            };
        }
        const dates = bRecDateStr || Array.from(new Set(activeSessions.map(s => s.report_date).filter(Boolean))).join(', ');
        const totalEmps = activeSessions.reduce((sum, s) => sum + (s.employee_count || (s.records ? s.records.length : 0)), 0);
        const storeNames = selectedStore === 'Tổng' ? 'Toàn Cụm Siêu Thị' : selectedStore;
        return {
            title: matchedBusinessRecords.length > 0
                ? `Đã kết nối số liệu lũy kế siêu thị (${matchedBusinessRecords.length} đơn vị)`
                : `Đã kết nối ${activeSessions.length} phiên lũy kế`,
            detail: `Chốt ngày: ${dates || 'Gần nhất'} • ${storeNames}${totalEmps > 0 ? ` (${totalEmps} nhân sự)` : ''}`,
            isReady: true
        };
    }, [matchedBusinessRecords, activeSessions, selectedMonth, selectedYear, selectedStore]);

    // Helper trích xuất canonicalKey chuẩn cho từng hạng mục thi đua
    const getCanonicalId = (rawKey: string): string => {
        if (!rawKey) return '';
        const resolved = resolveCanonicalCampaign(rawKey, campaignsDict);
        if (resolved?.canonicalKey) return resolved.canonicalKey;
        const label = getCampaignLabel(rawKey, campaignsDict);
        if (label) return label;
        return rawKey.trim();
    };

    // Tổng hợp [canonicalKey] -> { monthTarget, cumulativeActual }
    const storeCumulativeMap = useMemo(() => {
        const canonicalBuckets = new Map<string, {
            monthTarget: number;
            cumulativeActual: number;
            allTokens: Set<string>;
            source: 'BUSINESS_RECORD' | 'EMPLOYEE_SESSIONS';
        }>();

        // 1. ƯU TIÊN SỐ 1: daily_business_records của siêu thị
        if (matchedBusinessRecords.length > 0) {
            matchedBusinessRecords.forEach(br => {
                if (!br.emulationSummary) return;
                Object.entries(br.emulationSummary).forEach(([rawKey, emu]: [string, any]) => {
                    if (rawKey.startsWith('__')) return;
                    const tVal = Number(emu?.target) || 0;
                    const aVal = Number(emu?.actual) || 0;
                    if (tVal <= 0 && aVal <= 0) return;

                    const canonicalId = getCanonicalId(rawKey);
                    const tokens = getCampaignTokens(rawKey, campaignsDict);
                    let matchedKey: string | null = null;
                    if (canonicalBuckets.has(canonicalId)) {
                        matchedKey = canonicalId;
                    } else {
                        for (const [bKey, b] of canonicalBuckets.entries()) {
                            if (tokens.some(t => b.allTokens.has(t))) {
                                matchedKey = bKey;
                                break;
                            }
                        }
                    }

                    if (!matchedKey) {
                        matchedKey = canonicalId;
                        canonicalBuckets.set(matchedKey, {
                            monthTarget: 0,
                            cumulativeActual: 0,
                            allTokens: new Set(tokens),
                            source: 'BUSINESS_RECORD'
                        });
                    }

                    const b = canonicalBuckets.get(matchedKey)!;
                    tokens.forEach(t => b.allTokens.add(t));
                    b.allTokens.add(normalizeCampaignToken(matchedKey));
                    b.monthTarget += tVal;
                    b.cumulativeActual += aVal;
                    b.source = 'BUSINESS_RECORD';
                });
            });
        }

        // 2. DỰ PHÒNG (Fallback): Chỉ đối với các thi đua KHÔNG CÓ trong daily_business_records
        activeSessions.forEach(sess => {
            (sess.records || []).forEach(r => {
                if (!r.campaigns) return;
                Object.entries(r.campaigns).forEach(([rawKey, val]) => {
                    const valNum = Number(val) || 0;
                    if (valNum <= 0) return;

                    const canonicalId = getCanonicalId(rawKey);
                    const tokens = getCampaignTokens(rawKey, campaignsDict);
                    let matchedKey: string | null = null;
                    if (canonicalBuckets.has(canonicalId)) {
                        matchedKey = canonicalId;
                    } else {
                        for (const [bKey, b] of canonicalBuckets.entries()) {
                            if (tokens.some(t => b.allTokens.has(t))) {
                                matchedKey = bKey;
                                break;
                            }
                        }
                    }

                    if (matchedKey && canonicalBuckets.get(matchedKey)?.source === 'BUSINESS_RECORD') {
                        return;
                    }

                    if (!matchedKey) {
                        matchedKey = canonicalId;
                        canonicalBuckets.set(matchedKey, {
                            monthTarget: 0,
                            cumulativeActual: 0,
                            allTokens: new Set(tokens),
                            source: 'EMPLOYEE_SESSIONS'
                        });
                    }

                    const b = canonicalBuckets.get(matchedKey)!;
                    tokens.forEach(t => b.allTokens.add(t));
                    b.allTokens.add(normalizeCampaignToken(matchedKey));
                    b.cumulativeActual += valNum;
                });
            });
        });

        // Tính Target Tháng từ targetsMap cho các bucket fallback
        Object.entries(targetsMap).forEach(([empId, empTargets]) => {
            let isEmpMatch = true;
            if (selectedStore !== 'Tổng') {
                isEmpMatch = isEmployeeInStore(empId, selectedStore, empStoreMap, undefined, stores) ||
                    activeSessions.some(s => (s.records || []).some(r => r.employee_id === empId));
            }

            if (isEmpMatch) {
                Object.entries(empTargets).forEach(([rawKey, targetVal]) => {
                    const tVal = Number(targetVal) || 0;
                    if (tVal <= 0) return;

                    const canonicalId = getCanonicalId(rawKey);
                    const tokens = getCampaignTokens(rawKey, campaignsDict);
                    let matchedKey: string | null = null;
                    if (canonicalBuckets.has(canonicalId)) {
                        matchedKey = canonicalId;
                    } else {
                        for (const [bKey, b] of canonicalBuckets.entries()) {
                            if (tokens.some(t => b.allTokens.has(t))) {
                                matchedKey = bKey;
                                break;
                            }
                        }
                    }

                    if (matchedKey && canonicalBuckets.get(matchedKey)?.source === 'BUSINESS_RECORD') {
                        return;
                    }

                    if (!matchedKey) {
                        matchedKey = canonicalId;
                        canonicalBuckets.set(matchedKey, {
                            monthTarget: 0,
                            cumulativeActual: 0,
                            allTokens: new Set(tokens),
                            source: 'EMPLOYEE_SESSIONS'
                        });
                    }

                    const b = canonicalBuckets.get(matchedKey)!;
                    tokens.forEach(t => b.allTokens.add(t));
                    b.allTokens.add(normalizeCampaignToken(matchedKey));
                    b.monthTarget += tVal;
                });
            }
        });

        // Token lookup map
        const tokenMap = new Map<string, { monthTarget: number; cumulativeActual: number; canonicalKey: string }>();
        for (const [bKey, bucket] of canonicalBuckets.entries()) {
            const data = {
                monthTarget: Number(bucket.monthTarget.toFixed(2)),
                cumulativeActual: Number(bucket.cumulativeActual.toFixed(2)),
                canonicalKey: bKey
            };
            tokenMap.set(bKey, data);
            const normKey = normalizeCampaignToken(bKey);
            if (normKey) tokenMap.set(normKey, data);
            for (const t of bucket.allTokens) {
                tokenMap.set(t, data);
            }
        }

        return { tokenMap, canonicalBuckets };
    }, [matchedBusinessRecords, activeSessions, targetsMap, campaignsDict, selectedStore, empStoreMap, stores]);

    // Ghép nối dữ liệu Realtime và tính toán Target Ngày theo 3 quy tắc
    const processedCampaigns = useMemo<RemainingCampaignItem[]>(() => {
        const { tokenMap, canonicalBuckets } = storeCumulativeMap;

        const filtered = allData.filter(d => {
            if (selectedStore === 'Tổng') return d.shortName === 'Tổng';
            return isStoreMatch(d.shortName, selectedStore, stores) ||
                isStoreMatch(d.store, selectedStore, stores) ||
                d.shortName.toLowerCase() === selectedStore.toLowerCase() ||
                d.store.toLowerCase().includes(selectedStore.toLowerCase());
        });

        return filtered.map(camp => {
            let cumData: { monthTarget: number; cumulativeActual: number } | undefined;

            // 1. Kiểm tra trực tiếp theo canonical key trong canonicalBuckets
            const campCanonical = getCanonicalId(camp.rawHeader || '') || getCanonicalId(camp.label) || camp.label;
            if (canonicalBuckets.has(campCanonical)) {
                const b = canonicalBuckets.get(campCanonical)!;
                cumData = { monthTarget: b.monthTarget, cumulativeActual: b.cumulativeActual };
            }

            // 2. Tìm theo các token chính xác trong tokenMap (không dùng fuzzy substring includes)
            if (!cumData) {
                const searchTokens = new Set<string>();
                if (campCanonical) {
                    const norm = normalizeCampaignToken(campCanonical);
                    if (norm) searchTokens.add(norm);
                }
                getCampaignTokens(camp.label, campaignsDict).forEach(t => searchTokens.add(t));
                if (camp.rawHeader) {
                    getCampaignTokens(camp.rawHeader, campaignsDict).forEach(t => searchTokens.add(t));
                }

                for (const t of searchTokens) {
                    if (tokenMap.has(t)) {
                        cumData = tokenMap.get(t);
                        break;
                    }
                }
            }

            const D = camp.target;
            const actual = camp.actual;

            let monthTarget = 0;
            let cumulativeActual = 0;
            let remainingTarget = 0;
            let isMonthCompleted = false;
            let requiredDailyAverage = 0;
            let appliedDailyTarget = D;
            let appliedRuleReason: RemainingCampaignItem['appliedRuleReason'] = 'NO_CUMULATIVE';

            if (cumData && cumData.monthTarget > 0) {
                monthTarget = cumData.monthTarget;
                cumulativeActual = cumData.cumulativeActual;
                remainingTarget = Math.max(0, monthTarget - cumulativeActual);
                isMonthCompleted = cumulativeActual >= monthTarget;
                requiredDailyAverage = Number((remainingTarget / Math.max(1, remainingDays)).toFixed(1));

                // 3 Quy tắc xác định Target ngày
                if (requiredDailyAverage > 2 * D && D > 0) {
                    appliedDailyTarget = D;
                    appliedRuleReason = 'RULE_1_CAP_200';
                } else if (remainingTarget < D) {
                    appliedDailyTarget = remainingTarget;
                    appliedRuleReason = 'RULE_2_REMAINING_LESS';
                } else {
                    appliedDailyTarget = requiredDailyAverage;
                    appliedRuleReason = 'RULE_3_DAILY_AVERAGE';
                }
            }

            const safeTarget = Math.max(1, appliedDailyTarget);
            const appliedPctHT = Number(((actual / safeTarget) * 100).toFixed(1));
            const appliedShortage = Math.max(0, safeTarget - actual);
            const monthPctHT = monthTarget > 0 ? Number(((cumulativeActual / monthTarget) * 100).toFixed(1)) : 0;

            return {
                ...camp,
                monthTarget,
                cumulativeActual,
                monthPctHT,
                remainingTarget,
                isMonthCompleted,
                requiredDailyAverage,
                appliedDailyTarget,
                appliedRuleReason,
                appliedPctHT,
                appliedShortage
            };
        });
    }, [allData, selectedStore, stores, storeCumulativeMap, campaignsDict, remainingDays]);

    // Danh sách hiển thị: Lọc thi đua đạt tháng & sắp xếp theo toggle (Lũy kế vs Realtime)
    const displayedCampaigns = useMemo(() => {
        const list = showCompletedCampaigns
            ? [...processedCampaigns]
            : processedCampaigns.filter(c => !c.isMonthCompleted);

        return list.sort((a, b) => {
            if (sortMode === 'CUMULATIVE') {
                // 1. SẮP XẾP THEO % HOÀN THÀNH LŨY KẾ THÁNG GIẢM DẦN
                if (b.monthPctHT !== a.monthPctHT) {
                    return b.monthPctHT - a.monthPctHT;
                }
                // Tie-breaker: Lũy kế thực tế lớn hơn
                if (b.cumulativeActual !== a.cumulativeActual) {
                    return b.cumulativeActual - a.cumulativeActual;
                }
                // Tie-breaker 2: % HT Realtime
                return b.appliedPctHT - a.appliedPctHT;
            } else {
                // 2. SẮP XẾP THEO % HOÀN THÀNH REALTIME NGÀY GIẢM DẦN
                if (b.appliedPctHT !== a.appliedPctHT) {
                    return b.appliedPctHT - a.appliedPctHT;
                }
                // Tie-breaker: Realtime thực tế lớn hơn
                if (b.actual !== a.actual) {
                    return b.actual - a.actual;
                }
                // Tie-breaker 2: % HT Lũy kế
                return b.monthPctHT - a.monthPctHT;
            }
        });
    }, [processedCampaigns, showCompletedCampaigns, sortMode]);

    const completedCount = useMemo(() => {
        return processedCampaigns.filter(c => c.isMonthCompleted).length;
    }, [processedCampaigns]);

    const stats = useMemo(() => {
        const pass = displayedCampaigns.filter(c => c.appliedPctHT >= 100);
        const near = displayedCampaigns.filter(c => c.appliedPctHT >= 80 && c.appliedPctHT < 100);
        const speed = displayedCampaigns.filter(c => c.appliedPctHT >= 50 && c.appliedPctHT < 80);
        const alert = displayedCampaigns.filter(c => c.appliedPctHT < 50);

        return {
            total: displayedCampaigns.length,
            pass,
            near,
            speed,
            alert,
            passRate: displayedCampaigns.length > 0 ? (pass.length / displayedCampaigns.length) * 100 : 0
        };
    }, [displayedCampaigns]);

    // Mẫu nhận xét Zalo / Messaging App cho Mục Tiêu Còn Lại
    const remainingAssessmentTemplates = useMemo<AssessmentTemplate[]>(() => {
        const storeLabel = selectedStore === 'Tổng' ? 'TOÀN CỤM' : selectedStore;
        const rev = currentRevenue ? currentRevenue.rev : 0;
        const revTarget = currentRevenue ? currentRevenue.target : 0;
        const revPct = revTarget > 0 ? ((rev / revTarget) * 100).toFixed(1) : '0';

        const genText = (type: number) => {
            let t = `⚡ [BC REALTIME - MỤC TIÊU CÒN LẠI] ${storeLabel}\n`;
            t += `📅 Ngày: ${formatDate(new Date())} (Còn lại ${remainingDays} ngày)\n`;
            t += `💰 DTQĐ: ${formatValue(rev)} / ${formatValue(revTarget)} (${revPct}%)\n`;
            if (currentRevenue?.dtTraGop) {
                t += `💳 DT Trả góp: ${formatValue(currentRevenue.dtTraGop)} (${currentRevenue.pctTraGop}%)\n`;
            }
            t += `🎯 ĐẠT TARGET NGÀY: ${stats.pass.length} / ${stats.total} ngành hàng (${stats.passRate.toFixed(0)}%)\n`;

            if (type === 1) {
                // MẪU 1: VỪA TỔNG QUÁT VỪA CHI TIẾT 3 NHÓM
                const totalFails = stats.near.length + stats.speed.length + stats.alert.length;
                if (totalFails === 0) {
                    t += `\n🎉 Toàn bộ các chỉ tiêu thi đua đều đạt target ngày!`;
                } else {
                    t += `\n📊 TỔNG HỢP CHƯA ĐẠT (${totalFails} NH):`;
                    if (stats.near.length > 0) t += `\n- ⚡ CẬN ĐÍCH (>80%): ${stats.near.length} NH`;
                    if (stats.speed.length > 0) t += `\n- 🔥 CẦN TĂNG TỐC (50% - 80%): ${stats.speed.length} NH`;
                    if (stats.alert.length > 0) t += `\n- 🚨 NGUY HIỂM (<50%): ${stats.alert.length} NH`;

                    t += `\n\n📋 CHI TIẾT THEO TỪNG NHÓM:`;
                    if (stats.near.length > 0) {
                        t += `\n\n⚡ CẬN ĐÍCH (>80%):`;
                        stats.near.forEach(c => {
                            t += `\n• ${c.label}: thiếu ${c.appliedShortage} (RT: ${c.actual}/${c.appliedDailyTarget}, ${c.appliedPctHT.toFixed(0)}%)`;
                        });
                    }
                    if (stats.speed.length > 0) {
                        t += `\n\n🔥 CẦN TĂNG TỐC (50% - 80%):`;
                        stats.speed.forEach(c => {
                            t += `\n• ${c.label}: thiếu ${c.appliedShortage} (RT: ${c.actual}/${c.appliedDailyTarget}, ${c.appliedPctHT.toFixed(0)}%)`;
                        });
                    }
                    if (stats.alert.length > 0) {
                        t += `\n\n🚨 NGUY HIỂM (<50%):`;
                        stats.alert.forEach(c => {
                            t += `\n• ${c.label}: thiếu ${c.appliedShortage} (RT: ${c.actual}/${c.appliedDailyTarget}, ${c.appliedPctHT.toFixed(0)}%)`;
                        });
                    }
                }
            } else if (type === 2) {
                // MẪU 2: CHI TIẾT 3 NHÓM
                const totalFails = stats.near.length + stats.speed.length + stats.alert.length;
                if (totalFails === 0) {
                    t += `\n🎉 Toàn bộ các chỉ tiêu thi đua đều đạt target ngày!`;
                } else {
                    t += `\n📊 CHI TIẾT CHƯA ĐẠT THEO 3 NHÓM (${totalFails} NH):`;
                    if (stats.near.length > 0) {
                        t += `\n\n⚡ CẬN ĐÍCH (>80%): ${stats.near.length} NH`;
                        stats.near.forEach(c => {
                            t += `\n- ${c.label}: thiếu ${c.appliedShortage} (${c.appliedPctHT.toFixed(0)}%)`;
                        });
                    }
                    if (stats.speed.length > 0) {
                        t += `\n\n🔥 CẦN TĂNG TỐC (50% - 80%): ${stats.speed.length} NH`;
                        stats.speed.forEach(c => {
                            t += `\n- ${c.label}: thiếu ${c.appliedShortage} (${c.appliedPctHT.toFixed(0)}%)`;
                        });
                    }
                    if (stats.alert.length > 0) {
                        t += `\n\n🚨 NGUY HIỂM (<50%): ${stats.alert.length} NH`;
                        stats.alert.forEach(c => {
                            t += `\n- ${c.label}: thiếu ${c.appliedShortage} (${c.appliedPctHT.toFixed(0)}%)`;
                        });
                    }
                }
            } else if (type === 3) {
                // MẪU 3: TỔNG QUÁT SÚC TÍCH
                const totalFails = stats.near.length + stats.speed.length + stats.alert.length;
                if (totalFails === 0) {
                    t += `\n🎉 Toàn bộ các chỉ tiêu thi đua đều đạt target ngày!`;
                } else {
                    t += `\n📊 TỔNG HỢP CHƯA ĐẠT (${totalFails} NH):`;
                    if (stats.near.length > 0) t += `\n- ⚡ CẬN ĐÍCH (>80%): ${stats.near.length} NH`;
                    if (stats.speed.length > 0) t += `\n- 🔥 CẦN TĂNG TỐC (50% - 80%): ${stats.speed.length} NH`;
                    if (stats.alert.length > 0) t += `\n- 🚨 NGUY HIỂM (<50%): ${stats.alert.length} NH`;
                }
            } else {
                // MẪU 4: CHI TIẾT TOÀN BỘ
                t += `\n📋 TIẾN ĐỘ CHI TIẾT TOÀN BỘ:\n`;
                displayedCampaigns.forEach(c => {
                    const status = c.appliedPctHT >= 100 ? '✅' : c.appliedPctHT >= 80 ? '⚡' : '⚠️';
                    t += `${status} ${c.label}: ${c.actual}/${c.appliedDailyTarget} (${c.appliedPctHT.toFixed(0)}%)\n`;
                });
            }
            return t;
        };

        return [
            {
                id: 1,
                title: 'Mẫu 1: Tổng Quát & Chi Tiết 3 Nhóm',
                badge: 'Khuyên Dùng',
                content: genText(1),
                description: 'Vừa tổng quát 3 nhóm vừa liệt kê chi tiết từng ngành hàng chưa đạt theo nhóm'
            },
            {
                id: 2,
                title: 'Mẫu 2: Chi Tiết 3 Nhóm',
                badge: '3 Nhóm',
                content: genText(2),
                description: 'Liệt kê chi tiết các ngành hàng theo từng nhóm phân loại tiến độ'
            },
            {
                id: 3,
                title: 'Mẫu 3: Tổng Quát Súc Tích',
                badge: 'Súc Tích',
                content: genText(3),
                description: 'Tóm tắt nhanh số lượng ngành hàng theo 3 mức tiến độ'
            },
            {
                id: 4,
                title: 'Mẫu 4: Chi Tiết Toàn Bộ',
                badge: 'Đầy Đủ',
                content: genText(4),
                description: 'Báo cáo toàn diện kết quả ngày theo Target thông minh'
            }
        ];
    }, [selectedStore, currentRevenue, remainingDays, stats, displayedCampaigns]);

    return {
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear,
        remainingDays,
        setRemainingDays,
        showCompletedCampaigns,
        setShowCompletedCampaigns,
        sortMode,
        setSortMode: handleSetSortMode,
        stores,
        isLoadingSystem,
        sessionSummaryInfo,
        displayedCampaigns,
        completedCount,
        stats,
        remainingAssessmentTemplates
    };
}
