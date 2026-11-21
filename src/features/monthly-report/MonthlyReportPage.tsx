import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    formatDate,
    getShortStoreName,
    getYesterdayDateString,
    isStoreMatch
} from '../../core/lib/formatters';
import {
    fetchBusinessRecords,
    fetchCampaignDictionary,
    type BusinessDayRecord,
    type CampaignDictItem
} from '../../core/lib/storage';
import {
    GUEST_DEMO_STORE,
    isGuestDemoStore,
    isDemoDateAllowed
} from '../../core/lib/guestDemoStoreService';
import { useAuth } from '../../shared/contexts/AuthContext';
import {
    fetchClusterTargetConfigPackage,
    fetchClusterAssessment
} from '../cluster-report/services/clusterTargetService';
import type {
    ClusterTargetConfigItem,
    ClusterAssessmentData
} from '../cluster-report/types';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import ReportDataFreshnessBar from '../../shared/components/report/ReportDataFreshnessBar';
import ReportActionButtons from '../../shared/components/report/ReportActionButtons';
import type { AssessmentTemplate } from '../../shared/components/report/ReportAssessmentModal';

import MonthlyEmulationTab from './tabs/MonthlyEmulationTab';
import ClusterHealthTab, { getCompactStoreName } from './tabs/ClusterHealthTab';
import RevenueTrendTab from './tabs/RevenueTrendTab';

import {
    BarChart3,
    Store,
    TrendingUp,
    RefreshCw,
    Lock,
    Camera,
    Target,
    Calendar,
    Layers,
    Check
} from 'lucide-react';

export type MonthlyHubTab = 'thidua' | 'suc-khoe' | 'nhip';

export default function MonthlyReportPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { currentUser, isAdmin, canAccessStore } = useAuth();
    const isGuest = Boolean(currentUser?.is_guest);
    const isStaff = currentUser?.role === 'NHAN_VIEN';

    // 1. Quản lý Tab từ URL query: ?tab=thidua | ?tab=suc-khoe | ?tab=nhip
    const tabParam = searchParams.get('tab');
    const initialTab: MonthlyHubTab = useMemo(() => {
        if (tabParam === 'suc-khoe' || tabParam === 'cum') return 'suc-khoe';
        if (tabParam === 'nhip' || tabParam === 'trend') return 'nhip';
        return 'thidua';
    }, [tabParam]);

    const [activeTab, setActiveTab] = useState<MonthlyHubTab>(initialTab);

    // Đồng bộ lại activeTab khi URL thay đổi
    useEffect(() => {
        if (tabParam === 'suc-khoe' || tabParam === 'cum') {
            if (activeTab !== 'suc-khoe') setActiveTab('suc-khoe');
        } else if (tabParam === 'nhip' || tabParam === 'trend') {
            if (activeTab !== 'nhip') setActiveTab('nhip');
        } else if (!tabParam || tabParam === 'thidua') {
            if (activeTab !== 'thidua') setActiveTab('thidua');
        }
    }, [tabParam]);

    const handleTabChange = (newTab: MonthlyHubTab) => {
        setActiveTab(newTab);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', newTab);
            return next;
        }, { replace: true });
    };

    // 2. Bộ lọc thời gian & phạm vi ST
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(() => isGuest ? 10 : today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(() => isGuest ? 2026 : today.getFullYear());
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [selectedDate, setSelectedDate] = useState<string>('latest');

    // Cố định tháng 10/2026 cho tài khoản trải nghiệm
    useEffect(() => {
        if (isGuest) {
            if (selectedMonth !== 10) setSelectedMonth(10);
            if (selectedYear !== 2026) setSelectedYear(2026);
        }
    }, [isGuest, selectedMonth, selectedYear]);

    // 3. Dữ liệu tập trung
    const [records, setRecords] = useState<BusinessDayRecord[]>([]);
    const [campaigns, setCampaigns] = useState<CampaignDictItem[]>([]);
    const [targetConfigs, setTargetConfigs] = useState<ClusterTargetConfigItem[]>([]);
    const [globalPaceRate, setGlobalPaceRate] = useState<number>(100);
    const [assessmentData, setAssessmentData] = useState<ClusterAssessmentData | null>(null);

    const [loading, setLoading] = useState<boolean>(true);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [isCopying, setIsCopying] = useState<boolean>(false);
    const [toastState, setToastState] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
    const toastTimerRef = useRef<number | null>(null);

    const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
        setToastState({ message, tone });
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => setToastState(null), 3000);
    };

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        };
    }, []);

    // 4. Tải toàn bộ dữ liệu kỳ tháng song song
    const loadAllMonthlyData = async () => {
        setLoading(true);
        try {
            const [recordsRes, campRes, targetPkg, assessment] = await Promise.all([
                fetchBusinessRecords(selectedMonth, selectedYear),
                fetchCampaignDictionary(),
                fetchClusterTargetConfigPackage(selectedMonth, selectedYear),
                fetchClusterAssessment(selectedMonth, selectedYear)
            ]);

            if (recordsRes.success && recordsRes.data) {
                setRecords(recordsRes.data);
            } else {
                setRecords([]);
            }

            if (campRes.success && campRes.data) {
                setCampaigns(campRes.data);
            }

            setTargetConfigs(targetPkg.items || []);
            setGlobalPaceRate(targetPkg.globalPaceRate || 100);
            setAssessmentData(assessment);
        } catch (err: any) {
            console.error('Lỗi nạp dữ liệu trung tâm báo cáo tháng:', err);
            showToast('Lỗi khi đồng bộ dữ liệu từ Cloud!', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllMonthlyData();
        setSelectedDate('latest');
    }, [selectedMonth, selectedYear]);

    // 5. Danh sách ST phân quyền
    const allStoreList = useMemo(() => {
        const s = new Set<string>();
        records.forEach(r => {
            const sName = getShortStoreName(r.storeName);
            if (sName && sName !== 'Tổng' && !/^(tổng|tong)/i.test(r.storeName)) {
                s.add(sName);
            }
        });
        return Array.from(s).sort();
    }, [records]);

    const storeList = useMemo(() => {
        if (isGuest) return [getShortStoreName(GUEST_DEMO_STORE)];
        if (isAdmin) return allStoreList;

        const matched = allStoreList.filter(sName => {
            if (canAccessStore(sName)) return true;
            const originalRecord = records.find(r => getShortStoreName(r.storeName) === sName);
            if (originalRecord && canAccessStore(originalRecord.storeName)) return true;
            return false;
        });
        if (matched.length > 0) return matched;

        const accessible = currentUser?.accessible_stores && currentUser.accessible_stores.length > 0
            ? currentUser.accessible_stores
            : (currentUser?.store_name ? [currentUser.store_name] : []);
        return Array.from(new Set(accessible.map(s => getShortStoreName(s))));
    }, [allStoreList, isAdmin, canAccessStore, records, currentUser, isGuest]);

    const isLockedToSingleStore = (!isAdmin && isStaff) || isGuest;
    const canViewAllStores = !isGuest && (isAdmin || (!isStaff && storeList.length > 1));

    useEffect(() => {
        if (isAdmin) return;
        if (isGuest) {
            const guestShort = getShortStoreName(GUEST_DEMO_STORE);
            if (selectedStore !== guestShort) setSelectedStore(guestShort);
            return;
        }

        if (currentUser?.role === 'NHAN_VIEN') {
            const myStore = storeList[0] || (currentUser.store_name ? getShortStoreName(currentUser.store_name) : '');
            if (myStore && selectedStore !== myStore) setSelectedStore(myStore);
            return;
        }

        if (storeList.length === 1 && selectedStore === 'all' && !canViewAllStores) {
            setSelectedStore(storeList[0]);
            return;
        }

        if (selectedStore !== 'all' && !storeList.includes(selectedStore) && storeList.length > 0) {
            setSelectedStore(canViewAllStores ? 'all' : storeList[0]);
        }
    }, [currentUser, isAdmin, isGuest, storeList, selectedStore, canViewAllStores]);

    // 6. Danh sách ngày báo cáo
    const availableDates = useMemo(() => {
        let storeRecords = records;
        if (isGuest) {
            storeRecords = records.filter(r => isStoreMatch(r.storeName, GUEST_DEMO_STORE) || isStoreMatch(r.storeName, '838679'));
        } else if (selectedStore !== 'all') {
            storeRecords = records.filter(r => getShortStoreName(r.storeName) === selectedStore || isStoreMatch(r.storeName, selectedStore));
        } else if (!isAdmin) {
            storeRecords = records.filter(r => canAccessStore(r.storeName) || canAccessStore(getShortStoreName(r.storeName)));
        }
        return Array.from(new Set(storeRecords.map(r => r.reportDate))).filter(Boolean).sort().reverse();
    }, [records, selectedStore, isGuest, isAdmin, canAccessStore]);

    const activeReportDate = useMemo(() => {
        if (availableDates.length === 0) return '';
        if (selectedDate === 'latest' || !selectedDate || !availableDates.includes(selectedDate)) {
            return availableDates[0];
        }
        return selectedDate;
    }, [availableDates, selectedDate]);

    // 7. Bản ghi tổng quan cho Tab Thi Đua
    const recordsInActiveDay = useMemo(() => {
        if (!activeReportDate) return [];
        return records.filter(r => r.reportDate === activeReportDate);
    }, [records, activeReportDate]);

    const currentRecord = useMemo<BusinessDayRecord | null>(() => {
        if (!activeReportDate || recordsInActiveDay.length === 0) return null;
        const isAll = selectedStore === 'all' || selectedStore === 'Tổng';

        if (isAll) {
            const memberStores = recordsInActiveDay.filter(r => {
                const sName = getShortStoreName(r.storeName);
                if (sName === 'Tổng' || /^(tổng|tong)/i.test(r.storeName)) return false;
                if (isAdmin) return true;
                return canAccessStore(r.storeName) || canAccessStore(sName);
            });
            const targetList = memberStores.length > 0 ? memberStores : recordsInActiveDay.filter(r => {
                const sName = getShortStoreName(r.storeName);
                if (sName === 'Tổng' || /^(tổng|tong)/i.test(r.storeName)) return false;
                return isAdmin || canAccessStore(r.storeName) || canAccessStore(sName);
            });

            const totalActual = targetList.reduce((sum, r) => sum + (Number(r.revenueActual) || 0), 0);
            const totalTarget = targetList.reduce((sum, r) => sum + (Number(r.revenueTarget) || 0), 0);
            const totalInstallment = targetList.reduce((sum, r) => sum + (Number(r.revenueInstallment) || 0), 0);
            const passedDays = targetList[0]?.passedDays || new Date(activeReportDate).getDate();
            const totalDays = targetList[0]?.totalDays || 30;

            const forecastCompletionRate = (totalTarget > 0 && passedDays > 0)
                ? ((totalActual / passedDays * totalDays) / totalTarget * 100)
                : (totalTarget > 0 ? (totalActual / totalTarget * 100) : 0);

            const storesWithRate = targetList.filter(r => (Number(r.installmentRate) || 0) > 0);
            const totalRateWeight = storesWithRate.reduce((sum, r) => sum + ((Number(r.revenueActual) || 0) > 0 ? Number(r.revenueActual) : 1), 0);
            const installmentRate = (storesWithRate.length > 0 && totalRateWeight > 0)
                ? storesWithRate.reduce((sum, r) => sum + Number(r.installmentRate) * ((Number(r.revenueActual) || 0) > 0 ? Number(r.revenueActual) : 1), 0) / totalRateWeight
                : (totalActual > 0 ? (totalInstallment / totalActual * 100) : 0);

            const clusterLabel = isAdmin
                ? `TỔNG TOÀN CỤM (${targetList.length} ST)`
                : `TỔNG CỤM PHỤ TRÁCH (${targetList.length} ST)`;

            return {
                storeName: clusterLabel,
                reportDate: activeReportDate,
                month: targetList[0]?.month || selectedMonth,
                year: targetList[0]?.year || selectedYear,
                passedDays,
                totalDays,
                revenueActual: totalActual,
                revenueTarget: totalTarget,
                revenueInstallment: totalInstallment,
                installmentRate,
                forecastCompletionRate,
                emulationSummary: {},
                rawEmulation: '',
                rawRevenue: '',
                dataType: 'monthly'
            };
        }

        const singleStore = recordsInActiveDay.find(r =>
            getShortStoreName(r.storeName) === selectedStore ||
            isStoreMatch(r.storeName, selectedStore) ||
            (isGuest && (isStoreMatch(r.storeName, GUEST_DEMO_STORE) || isStoreMatch(r.storeName, '838679')))
        );
        return singleStore || null;
    }, [recordsInActiveDay, activeReportDate, selectedStore, selectedMonth, selectedYear, isAdmin, canAccessStore, isGuest]);

    // 8. Đăng ký & điều phối xuất ảnh độc lập theo từng Tab
    const tabExportHandlersRef = useRef<Record<MonthlyHubTab, ((action: 'DOWNLOAD' | 'COPY') => Promise<void>) | null>>({
        thidua: null,
        'suc-khoe': null,
        nhip: null
    });

    const [activeAssessmentTemplates, setActiveAssessmentTemplates] = useState<AssessmentTemplate[]>([]);

    const handleExportAction = async (action: 'DOWNLOAD' | 'COPY') => {
        const handler = tabExportHandlersRef.current[activeTab];
        if (handler) {
            if (action === 'DOWNLOAD') setIsExporting(true);
            else setIsCopying(true);

            try {
                await handler(action);
            } finally {
                setIsExporting(false);
                setIsCopying(false);
            }
        } else {
            showToast('Chức năng xuất ảnh cho tab này đang sẵn sàng...', 'error');
        }
    };

    const isAllMode = selectedStore === 'all' || selectedStore === 'Tổng';

    return (
        <div className="p-3 sm:p-5 space-y-3.5 max-w-full mx-auto w-full">
            {/* Toast Thông Báo */}
            {toastState && (
                <div
                    role="status"
                    aria-live="polite"
                    className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-xl z-50 flex items-center gap-2 border ${toastState.tone === 'error'
                        ? 'bg-rose-950 text-white border-rose-500'
                        : 'bg-slate-900 text-white border-slate-700'
                        }`}
                >
                    <Check className={`w-4 h-4 ${toastState.tone === 'error' ? 'text-rose-400' : 'text-emerald-400'}`} aria-hidden="true" />
                    <span>{toastState.message}</span>
                </div>
            )}

            {/* TẦNG 1: BANNER BÁO CÁO TRẠNG THÁI LƯU TRỮ CLOUD (RULE 8) */}
            <div data-html2canvas-ignore="true" data-export-ignore="true">
                <CloudDataSyncStatusBanner
                    compact={true}
                    storageType="cloud"
                    syncStatus={loading ? 'syncing' : records.length > 0 ? 'synced' : 'unsynced'}
                    tableReady={true}
                    tableName="daily_business_records"
                    lastSyncTime={records[0]?.updatedAt}
                    onSyncNow={loadAllMonthlyData}
                />
            </div>

            {/* TẦNG 2: CHI TIẾT PHIÊN DỮ LIỆU & ĐỘ MỚI CLOUD */}
            <ReportDataFreshnessBar
                latestDataDate={activeReportDate || (availableDates.length > 0 ? availableDates[0] : null)}
                expectedDate={getYesterdayDateString()}
                lastUpdatedAt={records[0]?.updatedAt}
                lastUpdatedBy={records[0]?.updatedBy}
                storeName={selectedStore === 'all' ? 'Toàn cụm ST phụ trách' : selectedStore}
                actionUrl="/cap-nhat-ocr"
                actionLabel="Cập nhật số liệu LK"
                canUpdate={!isGuest && (isAdmin || ['ADMIN', 'QUAN_LY', 'TRUONG_CA'].includes(currentUser?.role || ''))}
                compact={true}
            />

            {/* TẦNG 3: TIÊU ĐỀ BÁO CÁO & SUB-TABS SEGMENTED CHUYỂN ĐỔI 3 CHẾ ĐỘ */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 font-bold shrink-0">
                            <Layers className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                                    BC Lũy Kế (Tổng Hợp)
                                </h1>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-100 text-amber-900 border-amber-300">
                                    Kỳ T{selectedMonth}/{selectedYear}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Trung tâm phân tích lũy kế: Tiến độ thi đua, Sức khỏe cụm ST và Nhịp bán hàng theo ngày
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        aria-label="Tải lại số liệu"
                        onClick={loadAllMonthlyData}
                        disabled={loading}
                        className="self-end sm:self-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border border-slate-300 disabled:opacity-50"
                        title="Tải lại số liệu từ Cloud"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-700' : ''}`} aria-hidden="true" />
                        <span>Tải Lại</span>
                    </button>
                </div>

                {/* THANH SEGMENTED SUB-TABS: DOANH THU & THI ĐUA ➔ SỨC KHỎE VƯỢT TRỘI ➔ NHỊP DOANH THU */}
                <div
                    role="tablist"
                    aria-label="Chế độ xem báo cáo lũy kế"
                    className="grid grid-cols-3 p-1 rounded-xl bg-slate-100/90 border border-slate-200 text-xs font-bold gap-1"
                >
                    {/* Tab 1: Doanh thu & Thi Đua */}
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'thidua'}
                        onClick={() => handleTabChange('thidua')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-lg transition-all cursor-pointer text-center ${activeTab === 'thidua'
                            ? 'bg-white text-slate-900 shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <BarChart3 className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                        <span className="truncate">Doanh thu &amp; Thi Đua</span>
                        <span className="hidden sm:inline text-[9.5px] px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                            24 Ngành
                        </span>
                    </button>

                    {/* Tab 2: Sức khỏe Vượt trội */}
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'suc-khoe'}
                        onClick={() => handleTabChange('suc-khoe')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-lg transition-all cursor-pointer text-center ${activeTab === 'suc-khoe'
                            ? 'bg-white text-slate-900 shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <Store className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                        <span className="truncate">Sức khỏe Vượt trội</span>
                        <span className="hidden sm:inline text-[9.5px] px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                            Cụm ST
                        </span>
                    </button>

                    {/* Tab 3: Nhịp Doanh Thu */}
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'nhip'}
                        onClick={() => handleTabChange('nhip')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-lg transition-all cursor-pointer text-center ${activeTab === 'nhip'
                            ? 'bg-white text-slate-900 shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                        <span className="truncate">Nhịp Doanh Thu</span>
                        <span className="hidden sm:inline text-[9.5px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            31 Ngày
                        </span>
                    </button>
                </div>
            </div>

            {/* TẦNG 4: THANH ĐIỀU KHIỂN & BỘ LỌC CHUẨN RULE 10 (2 DÒNG ĐỘC LẬP) */}
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 space-y-2.5">
                {/* DÒNG 1: BỘ LỌC ST / CỤM (BẮT BUỘC ĐẦU TIÊN & NẰM RIÊNG LẺ 1 DÒNG) */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1 flex-wrap gap-1.5">
                            <label
                                htmlFor="hub-store-select"
                                className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5"
                            >
                                <Store className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                                <span>ST / Cụm</span>
                            </label>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {!isGuest && (isAdmin || ['ADMIN', 'QUAN_LY', 'TRUONG_CA'].includes(currentUser?.role || '')) && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/cap-nhat-ocr')}
                                            className="text-[11px] font-bold text-blue-800 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-300 px-2.5 py-1 min-h-[30px] rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                                            title="Cập nhật số liệu lũy kế qua AI OCR hoặc nạp thủ công"
                                        >
                                            <Camera className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
                                            <span>Nạp Số Liệu LK</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/cau-hinh-st')}
                                            className="text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1 min-h-[30px] rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                                            title="Cấu hình chỉ tiêu và tham số ST"
                                        >
                                            <Target className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                                            <span>Cấu Hình ST</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border text-xs font-bold transition-all w-full ${isLockedToSingleStore
                            ? 'bg-amber-50/90 border-amber-300 text-amber-900 shadow-sm'
                            : 'bg-white border-slate-300 text-slate-800 hover:border-amber-400'
                            }`}>
                            {isLockedToSingleStore && (
                                <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                            )}
                            <select
                                id="hub-store-select"
                                name="store"
                                value={selectedStore}
                                onChange={(e) => {
                                    setSelectedStore(e.target.value);
                                    setSelectedDate('latest');
                                }}
                                disabled={isLockedToSingleStore}
                                className={`bg-transparent outline-none font-bold w-full ${isLockedToSingleStore ? 'cursor-not-allowed text-amber-900 font-black' : 'cursor-pointer text-slate-800'}`}
                            >
                                {canViewAllStores && (
                                    <option value="all">
                                        {isAdmin
                                            ? `TỔNG TOÀN CỤM (${allStoreList.length} ST)`
                                            : `TỔNG CỤM PHỤ TRÁCH (${storeList.length} ST)`
                                        }
                                    </option>
                                )}
                                {storeList.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            {isLockedToSingleStore && (
                                <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider hidden sm:inline shrink-0">
                                    Đã khóa
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* DÒNG 2: TIÊU CHÍ THỜI GIAN, NGÀY CHỐT & CỤM NÚT XUẤT ẢNH BÁO CÁO */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-2 border-t border-slate-200/80">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        {/* Kỳ tháng */}
                        <div className="flex items-center gap-1.5">
                            <label htmlFor="hub-month-select" className="font-bold text-slate-600 whitespace-nowrap">
                                Kỳ tháng:
                            </label>
                            <select
                                id="hub-month-select"
                                name="month"
                                aria-label="Chọn tháng báo cáo"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 min-h-[34px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>Tháng {m}/{selectedYear}</option>
                                ))}
                            </select>
                        </div>

                        {/* Ngày chốt số */}
                        {activeTab !== 'nhip' && availableDates.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <label htmlFor="hub-date-select" className="font-bold text-slate-600 whitespace-nowrap">
                                    Ngày chốt:
                                </label>
                                <select
                                    id="hub-date-select"
                                    name="reportDate"
                                    aria-label="Chọn ngày chốt số liệu"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 min-h-[34px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                                >
                                    <option value="latest">Mới nhất ({availableDates[0] ? formatDate(availableDates[0]) : 'Chưa có'})</option>
                                    {availableDates.map(d => (
                                        <option key={d} value={d}>Ngày {formatDate(d)}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* CỤM NÚT THAO TÁC XUẤT ẢNH & NHẬN XÉT CỦA TAB HIỆN TẠI */}
                    <div className="flex items-center gap-2 self-end lg:self-auto">
                        <ReportActionButtons
                            onExportImage={() => handleExportAction('DOWNLOAD')}
                            onCopyImage={() => handleExportAction('COPY')}
                            isExporting={isExporting}
                            isCopying={isCopying}
                            exportButtonLabel="TẢI ẢNH"
                            copyImageButtonLabel="COPY ẢNH"
                            hasAssessment={activeTab !== 'nhip'}
                            assessmentTemplates={activeAssessmentTemplates}
                            reportTitle={`Báo Cáo Lũy Kế T${selectedMonth}/${selectedYear} - ${selectedStore}`}
                            periodLabel={`Tháng ${selectedMonth}/${selectedYear}`}
                        />
                    </div>
                </div>
            </div>

            {/* KHU VỰC HIỂN THỊ NỘI DUNG TỪNG TAB */}
            {loading ? (
                <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-600" aria-hidden="true" />
                    <p className="text-xs font-bold text-slate-600">Đang tổng hợp số liệu kỳ tháng từ Cloud...</p>
                </div>
            ) : (
                <div className="mt-2">
                    {/* TAB 1: DOANH THU & THI ĐUA */}
                    {activeTab === 'thidua' && (
                        <MonthlyEmulationTab
                            records={records}
                            campaigns={campaigns}
                            currentRecord={currentRecord}
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                            selectedStore={selectedStore}
                            activeReportDate={activeReportDate}
                            isAllMode={isAllMode}
                            isAdmin={isAdmin}
                            isGuest={isGuest}
                            canAccessStore={canAccessStore}
                            showToast={showToast}
                            onRegisterExportHandler={(handler) => {
                                tabExportHandlersRef.current.thidua = handler;
                            }}
                            onUpdateAssessmentTemplates={setActiveAssessmentTemplates}
                        />
                    )}

                    {/* TAB 2: SỨC KHỎE VƯỢT TRỘI */}
                    {activeTab === 'suc-khoe' && (
                        <ClusterHealthTab
                            records={records}
                            targetConfigs={targetConfigs}
                            globalPaceRate={globalPaceRate}
                            assessmentData={assessmentData}
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                            selectedStore={selectedStore}
                            effectiveDate={activeReportDate}
                            availableDates={availableDates}
                            isAdmin={isAdmin}
                            isGuest={isGuest}
                            canAccessStore={canAccessStore}
                            showToast={showToast}
                            onRefreshData={loadAllMonthlyData}
                            onRegisterExportHandler={(handler) => {
                                tabExportHandlersRef.current['suc-khoe'] = handler;
                            }}
                            onUpdateAssessmentTemplates={setActiveAssessmentTemplates}
                        />
                    )}

                    {/* TAB 3: NHỊP DOANH THU */}
                    {activeTab === 'nhip' && (
                        <RevenueTrendTab
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                            selectedStore={selectedStore}
                            currentUser={currentUser}
                            isAdmin={isAdmin}
                            canAccessStore={canAccessStore}
                            showToast={showToast}
                            onRegisterExportHandler={(handler) => {
                                tabExportHandlersRef.current.nhip = handler;
                            }}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
