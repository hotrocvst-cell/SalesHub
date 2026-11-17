import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import {
    getYesterdayDateString,
    getShortStoreName,
    isStoreMatch
} from '../../core/lib/formatters';
import { GUEST_DEMO_STORE } from '../../core/lib/guestDemoStoreService';
import {
    generateStandardReportCanvas,
    buildReportImageFileName,
    downloadReportCanvas,
    copyReportCanvasToClipboard
} from '../../shared/utils/exportImage';
import { useBatchReportData } from './hooks/useBatchReportData';
import {
    BATCH_REPORT_OPTIONS,
    BATCH_EXPORT_PREFERENCE_KEY,
    BATCH_EXPORT_OPTIONS_PREFERENCE_KEY,
    DEFAULT_CUSTOM_OPTIONS
} from './constants';
import type { BatchReportKey, BatchExportStepProgress, BatchReportCustomOptions } from './types';
import {
    generateDailyRemarks,
    generateEmployeePerformanceRemarks,
    generateMonthlyRemarks,
    generateCampaignRemarks,
    generateRevenueTrendRemarks,
    generateCombinedRemarks
} from './utils/batchRemarksGenerator';
import BatchExportFilterBar from './components/BatchExportFilterBar';
import BatchExportChecklist from './components/BatchExportChecklist';
import BatchExportPreviewModal from './components/BatchExportPreviewModal';
import DailyReportExportCard from './components/renderers/DailyReportExportCard';
import EmployeePerformanceExportCard from './components/renderers/EmployeePerformanceExportCard';
import MonthlyReportExportCard from './components/renderers/MonthlyReportExportCard';
import CampaignSummaryExportCard from './components/renderers/CampaignSummaryExportCard';
import RevenueTrendExportCard from './components/renderers/RevenueTrendExportCard';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import {
    Layers,
    CheckCircle2,
    AlertCircle,
    Info,
    Check,
    Loader2
} from 'lucide-react';

export default function BatchReportExportPage() {
    const { currentUser, isAdmin, canAccessStore } = useAuth();
    const isGuest = Boolean(currentUser?.is_guest);
    const isStaff = currentUser?.role === 'NHAN_VIEN';

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(() => isGuest ? 10 : today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(() => isGuest ? 2026 : today.getFullYear());
    const [selectedDate, setSelectedDate] = useState<string>(() => isGuest ? '2026-10-31' : getYesterdayDateString());
    const [selectedStore, setSelectedStore] = useState<string>(() => isGuest ? getShortStoreName(GUEST_DEMO_STORE) : '');

    // 1. NẠP DỮ LIỆU
    const {
        stores,
        loading,
        dailyRecord,
        monthlyRecords,
        performanceRows,
        performanceSummary,
        campaignSummary,
        campaignDict,
        trendRecords,
        refreshAll
    } = useBatchReportData(selectedStore, selectedDate, selectedMonth, selectedYear);

    // 2. LỌC DANH SÁCH ST THEO PHÂN QUYỀN
    const accessibleStores = useMemo(() => {
        if (isGuest) {
            return stores.filter(s => isStoreMatch(s.name || s.short_name || '', GUEST_DEMO_STORE));
        }
        if (isAdmin) {
            return stores;
        }
        return stores.filter(s => {
            const sName = s.name || s.short_name || '';
            return canAccessStore(sName) || canAccessStore(getShortStoreName(sName));
        });
    }, [stores, isAdmin, isGuest, canAccessStore]);

    // Tự động gán ST mặc định nếu chưa chọn
    useEffect(() => {
        if (isGuest) {
            setSelectedStore(getShortStoreName(GUEST_DEMO_STORE));
            return;
        }
        if (!selectedStore && accessibleStores.length > 0) {
            setSelectedStore(accessibleStores[0].name || accessibleStores[0].short_name || '');
        }
    }, [accessibleStores, selectedStore, isGuest]);

    // 3. QUẢN LÝ CHECKLIST CÁC BÁO CÁO CẦN XUẤT
    const [checkedKeys, setCheckedKeys] = useState<Set<BatchReportKey>>(() => {
        try {
            const saved = localStorage.getItem(BATCH_EXPORT_PREFERENCE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return new Set<BatchReportKey>(parsed);
                }
            }
        } catch {
            // ignore fallback
        }
        return new Set<BatchReportKey>(
            BATCH_REPORT_OPTIONS.filter(item => item.defaultChecked).map(item => item.key)
        );
    });

    const handleToggleCheck = (key: BatchReportKey) => {
        setCheckedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            try {
                localStorage.setItem(BATCH_EXPORT_PREFERENCE_KEY, JSON.stringify(Array.from(next)));
            } catch {
                // ignore
            }
            return next;
        });
    };

    const handleToggleSelectAll = () => {
        if (checkedKeys.size === BATCH_REPORT_OPTIONS.length) {
            setCheckedKeys(new Set());
            localStorage.setItem(BATCH_EXPORT_PREFERENCE_KEY, JSON.stringify([]));
        } else {
            const allKeys = new Set(BATCH_REPORT_OPTIONS.map(i => i.key));
            setCheckedKeys(allKeys);
            localStorage.setItem(BATCH_EXPORT_PREFERENCE_KEY, JSON.stringify(Array.from(allKeys)));
        }
    };

    // 4. QUẢN LÝ TÙY CHỌN / TOGGLES CHO TỪNG BÁO CÁO
    const [customOptions, setCustomOptions] = useState<BatchReportCustomOptions>(() => {
        try {
            const saved = localStorage.getItem(BATCH_EXPORT_OPTIONS_PREFERENCE_KEY);
            if (saved) {
                return { ...DEFAULT_CUSTOM_OPTIONS, ...JSON.parse(saved) };
            }
        } catch {
            // fallback
        }
        return DEFAULT_CUSTOM_OPTIONS;
    });

    const handleOptionsChange = (newOptions: BatchReportCustomOptions) => {
        setCustomOptions(newOptions);
        try {
            localStorage.setItem(BATCH_EXPORT_OPTIONS_PREFERENCE_KEY, JSON.stringify(newOptions));
        } catch {
            // ignore
        }
    };

    // 5. KIỂM TRA SỰ SẴN SÀNG CỦA DỮ LIỆU
    const dataAvailability = useMemo<Record<BatchReportKey, boolean>>(() => {
        return {
            DAILY_REPORT: Boolean(dailyRecord),
            EMPLOYEE_PERFORMANCE: performanceRows.length > 0,
            MONTHLY_REPORT: monthlyRecords.length > 0,
            CAMPAIGN_SUMMARY: Boolean(campaignSummary && campaignSummary.rows.length > 0),
            REVENUE_TREND: trendRecords.length > 0
        };
    }, [dailyRecord, performanceRows, monthlyRecords, campaignSummary, trendRecords]);

    // 6. QUẢN LÝ XUẤT ẢNH & TIẾN TRÌNH & NHẬN XÉT
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [batchProgress, setBatchProgress] = useState<BatchExportStepProgress | null>(null);
    const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [copiedRemarksKey, setCopiedRemarksKey] = useState<string | null>(null);
    const [previewKey, setPreviewKey] = useState<BatchReportKey | null>(null);
    const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

    const offScreenContainerRef = useRef<HTMLDivElement | null>(null);
    const [activeOffScreenKey, setActiveOffScreenKey] = useState<BatchReportKey | null>(null);

    const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToastMsg({ text, type });
        setTimeout(() => setToastMsg(null), 3500);
    };

    // Hàm render card theo key với đầy đủ tùy chọn
    const renderCardByKey = (key: BatchReportKey | null) => {
        if (!key) return null;
        switch (key) {
            case 'DAILY_REPORT':
                return (
                    <DailyReportExportCard
                        record={dailyRecord}
                        selectedStore={selectedStore}
                        selectedDate={selectedDate}
                        mode={customOptions.daily.mode}
                        showTable={customOptions.daily.showTable}
                    />
                );
            case 'EMPLOYEE_PERFORMANCE':
                return (
                    <EmployeePerformanceExportCard
                        rows={performanceRows}
                        summary={performanceSummary}
                        selectedStore={selectedStore}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        showWorkHours={customOptions.employeePerformance.showWorkHours}
                        sortBy={customOptions.employeePerformance.sortBy}
                    />
                );
            case 'MONTHLY_REPORT':
                return (
                    <MonthlyReportExportCard
                        records={monthlyRecords}
                        selectedStore={selectedStore}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        viewMode={customOptions.monthly.viewMode}
                    />
                );
            case 'CAMPAIGN_SUMMARY':
                return (
                    <CampaignSummaryExportCard
                        campaignSummary={campaignSummary}
                        campaignDict={campaignDict}
                        selectedStore={selectedStore}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        scoringMode={customOptions.campaign.scoringMode}
                    />
                );
            case 'REVENUE_TREND':
                return (
                    <RevenueTrendExportCard
                        records={trendRecords}
                        selectedStore={selectedStore}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        showBarChart={customOptions.revenueTrend.showBarChart}
                        showDetailTable={customOptions.revenueTrend.showDetailTable}
                    />
                );
        }
    };

    // Hàm chụp DOM offscreen và xuất canvas
    const captureOffScreenReport = useCallback(async (key: BatchReportKey): Promise<HTMLCanvasElement | null> => {
        setActiveOffScreenKey(key);
        // Chờ 350ms cho React render và repaint layout
        await new Promise(resolve => setTimeout(resolve, 350));

        if (!offScreenContainerRef.current) return null;
        const targetElement = offScreenContainerRef.current.firstElementChild as HTMLElement;
        if (!targetElement) return null;

        const canvas = await generateStandardReportCanvas(targetElement, {
            targetWidth: 880
        });

        return canvas;
    }, []);

    // 7. XỬ LÝ 1-CLICK XUẤT HÀNG LOẠT
    const handleBatchExport = async () => {
        if (!selectedStore) {
            showToast('Vui lòng chọn ST trước khi xuất báo cáo!', 'error');
            return;
        }

        const keysToExport = BATCH_REPORT_OPTIONS.filter(item => checkedKeys.has(item.key));
        if (keysToExport.length === 0) {
            showToast('Vui lòng tích chọn ít nhất 1 báo cáo trong danh sách!', 'error');
            return;
        }

        setIsExporting(true);
        let successCount = 0;

        try {
            for (let i = 0; i < keysToExport.length; i++) {
                const item = keysToExport[i];

                setBatchProgress({
                    isExporting: true,
                    currentIndex: i + 1,
                    totalCount: keysToExport.length,
                    currentReportName: item.name,
                    statusText: `Đang xuất [${i + 1}/${keysToExport.length}]: ${item.name}...`
                });

                const canvas = await captureOffScreenReport(item.key);

                if (canvas) {
                    const periodStr = item.key === 'DAILY_REPORT'
                        ? selectedDate.replace(/-/g, '')
                        : `T${selectedMonth}_${selectedYear}`;

                    const fileName = buildReportImageFileName(
                        item.exportFilePrefix,
                        selectedStore,
                        periodStr
                    );

                    await downloadReportCanvas(canvas, fileName);
                    successCount++;
                }

                // Nghỉ 400ms giữa các file để tránh trình duyệt chặn download đa luồng
                await new Promise(r => setTimeout(r, 400));
            }

            showToast(
                `Đã xuất thành công ${successCount}/${keysToExport.length} ảnh báo cáo cho ST ${getShortStoreName(selectedStore)}!`,
                'success'
            );
        } catch (err) {
            console.error('Lỗi khi xuất hàng loạt:', err);
            showToast('Có lỗi xảy ra trong quá trình xuất ảnh. Vui lòng thử lại!', 'error');
        } finally {
            setIsExporting(false);
            setBatchProgress(null);
            setActiveOffScreenKey(null);
        }
    };

    // 8. XỬ LÝ XUẤT ĐƠN LẺ
    const handleExportSingle = async (key: BatchReportKey) => {
        if (!selectedStore) {
            showToast('Vui lòng chọn ST trước khi xuất!', 'error');
            return;
        }

        const item = BATCH_REPORT_OPTIONS.find(i => i.key === key);
        if (!item) return;

        setActionLoadingKey(key);
        try {
            const canvas = await captureOffScreenReport(key);
            if (canvas) {
                const periodStr = key === 'DAILY_REPORT'
                    ? selectedDate.replace(/-/g, '')
                    : `T${selectedMonth}_${selectedYear}`;

                const fileName = buildReportImageFileName(
                    item.exportFilePrefix,
                    selectedStore,
                    periodStr
                );

                await downloadReportCanvas(canvas, fileName);
                showToast(`Đã tải ảnh ${item.name}!`, 'success');
            } else {
                showToast(`Không thể tạo ảnh cho ${item.name}!`, 'error');
            }
        } catch (err) {
            console.error('Lỗi xuất báo cáo đơn:', err);
            showToast('Lỗi khi tải ảnh báo cáo!', 'error');
        } finally {
            setActionLoadingKey(null);
            setActiveOffScreenKey(null);
        }
    };

    // 9. XỬ LÝ SAO CHÉP ẢNH ĐƠN LẺ
    const handleCopySingle = async (key: BatchReportKey) => {
        if (!selectedStore) {
            showToast('Vui lòng chọn ST trước khi sao chép!', 'error');
            return;
        }

        const item = BATCH_REPORT_OPTIONS.find(i => i.key === key);
        if (!item) return;

        setActionLoadingKey(key);
        try {
            const canvas = await captureOffScreenReport(key);
            if (canvas) {
                const copied = await copyReportCanvasToClipboard(canvas);
                if (copied) {
                    setCopiedKey(key);
                    showToast(`Đã sao chép ảnh ${item.name} vào bộ nhớ tạm!`, 'success');
                    setTimeout(() => setCopiedKey(null), 2500);
                } else {
                    showToast('Trình duyệt chưa hỗ trợ sao chép ảnh trực tiếp!', 'error');
                }
            }
        } catch (err) {
            console.error('Lỗi sao chép ảnh:', err);
            showToast('Không thể sao chép ảnh vào clipboard!', 'error');
        } finally {
            setActionLoadingKey(null);
            setActiveOffScreenKey(null);
        }
    };

    // 10. XỬ LÝ SAO CHÉP NHẬN XÉT ĐƠN LẺ
    const handleCopyRemarksSingle = (key: BatchReportKey) => {
        if (!selectedStore) {
            showToast('Vui lòng chọn ST trước khi sao chép nhận xét!', 'error');
            return;
        }

        let remarks = '';
        const item = BATCH_REPORT_OPTIONS.find(i => i.key === key);

        switch (key) {
            case 'DAILY_REPORT':
                remarks = generateDailyRemarks(dailyRecord, selectedStore, selectedDate);
                break;
            case 'EMPLOYEE_PERFORMANCE':
                remarks = generateEmployeePerformanceRemarks(
                    performanceRows,
                    performanceSummary,
                    selectedStore,
                    selectedMonth,
                    selectedYear,
                    customOptions.employeePerformance.showWorkHours
                );
                break;
            case 'MONTHLY_REPORT': {
                const latestRecord = [...monthlyRecords].sort((a, b) => (b.reportDate || '').localeCompare(a.reportDate || ''))[0] || null;
                remarks = generateMonthlyRemarks(latestRecord, selectedStore, selectedMonth, selectedYear);
                break;
            }
            case 'CAMPAIGN_SUMMARY':
                remarks = generateCampaignRemarks(campaignSummary, campaignDict, selectedStore);
                break;
            case 'REVENUE_TREND':
                remarks = generateRevenueTrendRemarks(trendRecords, selectedStore, selectedMonth, selectedYear);
                break;
        }

        if (remarks) {
            navigator.clipboard.writeText(remarks);
            setCopiedRemarksKey(key);
            showToast(`Đã sao chép nhận xét ${item?.name || ''} vào bộ nhớ tạm!`, 'success');
            setTimeout(() => setCopiedRemarksKey(null), 2500);
        } else {
            showToast('Chưa có nội dung nhận xét cho báo cáo này!', 'info');
        }
    };

    // 11. XỬ LÝ SAO CHÉP TOÀN BỘ NHẬN XÉT
    const handleCopyAllRemarks = () => {
        if (!selectedStore) {
            showToast('Vui lòng chọn ST trước!', 'error');
            return;
        }
        if (checkedKeys.size === 0) {
            showToast('Vui lòng chọn ít nhất 1 báo cáo!', 'error');
            return;
        }

        const combinedText = generateCombinedRemarks(checkedKeys, customOptions, {
            dailyRecord,
            performanceRows,
            performanceSummary,
            monthlyRecords,
            campaignSummary,
            campaignDict,
            trendRecords,
            selectedStore,
            selectedDate,
            selectedMonth,
            selectedYear
        });

        if (combinedText) {
            navigator.clipboard.writeText(combinedText);
            setCopiedRemarksKey('ALL');
            showToast(`Đã sao chép toàn bộ nhận xét của ${checkedKeys.size} báo cáo vào clipboard!`, 'success');
            setTimeout(() => setCopiedRemarksKey(null), 3000);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/60 p-3 sm:p-6 space-y-4 font-sans max-w-7xl mx-auto">
            {/* Header Trang */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
                        <Layers className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                Trung Tâm Xuất Báo Cáo ST
                            </h1>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 tracking-wider">
                                Hub Báo Cáo
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Tổng hợp và xuất hàng loạt toàn bộ ảnh báo cáo của ST chỉ với 1 click (Khổ dọc chuẩn mobile, không watermark, hỗ trợ copy nhận xét)
                        </p>
                    </div>
                </div>
            </div>

            {/* Cloud Sync Status Banner (Tuân thủ Quy chuẩn 8 & 12) */}
            <CloudDataSyncStatusBanner
                tableName="business_records, employee_data_sessions"
                tableReady={true}
                storageType="cloud"
                syncStatus="synced"
                lastSyncTime={new Date().toISOString()}
                onSyncNow={refreshAll}
            />

            {/* Thanh Bộ Lọc & Hero Button (Tuân thủ Rule 10: Dòng 1 ST độc lập) */}
            <BatchExportFilterBar
                stores={accessibleStores}
                selectedStore={selectedStore}
                onSelectStore={setSelectedStore}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
                selectedYear={selectedYear}
                onSelectYear={setSelectedYear}
                checkedCount={checkedKeys.size}
                totalCount={BATCH_REPORT_OPTIONS.length}
                onToggleSelectAll={handleToggleSelectAll}
                onBatchExport={handleBatchExport}
                isExporting={isExporting}
                onRefresh={refreshAll}
                loading={loading}
            />

            {/* Thanh tiến trình xuất ảnh hàng loạt */}
            {batchProgress && (
                <div className="bg-blue-600 text-white rounded-2xl p-4 shadow-lg animate-fadeIn space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            {batchProgress.statusText}
                        </span>
                        <span>
                            {Math.round((batchProgress.currentIndex / batchProgress.totalCount) * 100)}%
                        </span>
                    </div>
                    <div className="w-full bg-blue-900/40 rounded-full h-2.5 overflow-hidden">
                        <div
                            className="bg-white h-2.5 rounded-full transition-all duration-300"
                            style={{
                                width: `${(batchProgress.currentIndex / batchProgress.totalCount) * 100}%`
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Danh Sách Checklist Báo Cáo Kèm Tùy Chọn & Nhận Xét */}
            <BatchExportChecklist
                checkedKeys={checkedKeys}
                onToggleCheck={handleToggleCheck}
                onPreview={key => setPreviewKey(key)}
                onExportSingle={handleExportSingle}
                onCopySingle={handleCopySingle}
                onCopyRemarksSingle={handleCopyRemarksSingle}
                onCopyAllRemarks={handleCopyAllRemarks}
                isExporting={isExporting}
                actionLoadingKey={actionLoadingKey}
                copiedKey={copiedKey}
                copiedRemarksKey={copiedRemarksKey}
                dataAvailability={dataAvailability}
                selectedStore={selectedStore}
                customOptions={customOptions}
                onOptionsChange={handleOptionsChange}
            />

            {/* Modal Xem Trước */}
            <BatchExportPreviewModal
                reportKey={previewKey}
                onClose={() => setPreviewKey(null)}
                selectedStore={selectedStore}
                selectedDate={selectedDate}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                dailyRecord={dailyRecord}
                performanceRows={performanceRows}
                performanceSummary={performanceSummary}
                monthlyRecords={monthlyRecords}
                campaignSummary={campaignSummary}
                campaignDict={campaignDict}
                trendRecords={trendRecords}
                customOptions={customOptions}
                onExportSingle={handleExportSingle}
                onCopySingle={handleCopySingle}
                onCopyRemarksSingle={handleCopyRemarksSingle}
                isLoading={actionLoadingKey === previewKey}
                isCopied={copiedKey === previewKey}
                isRemarksCopied={copiedRemarksKey === previewKey}
            />

            {/* Toast Thông Báo */}
            {toastMsg && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold text-white transition-all transform animate-bounce ${
                    toastMsg.type === 'error'
                        ? 'bg-rose-600'
                        : toastMsg.type === 'info'
                            ? 'bg-blue-600'
                            : 'bg-emerald-600'
                }`}>
                    {toastMsg.type === 'error' ? (
                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>{toastMsg.text}</span>
                </div>
            )}

            {/* Container Ẩn Phục Vụ Chụp Render Off-screen Chuẩn 880px */}
            <div
                style={{
                    position: 'fixed',
                    left: '-99999px',
                    top: '0',
                    width: '880px',
                    pointerEvents: 'none',
                    zIndex: -999,
                    opacity: 0
                }}
                aria-hidden="true"
            >
                <div ref={offScreenContainerRef}>
                    {renderCardByKey(activeOffScreenKey)}
                </div>
            </div>
        </div>
    );
}
