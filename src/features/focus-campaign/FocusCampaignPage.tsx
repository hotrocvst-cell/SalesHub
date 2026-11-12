import React, { useRef, useState, useEffect } from 'react';
import { Target, CheckCircle2, AlertTriangle } from 'lucide-react';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import { CAMPAIGN_WATCHLIST_DDL_SQL } from './services/campaignWatchlistService';
import { useFocusCampaignData } from './hooks/useFocusCampaignData';
import FocusCampaignFilterBar from './components/FocusCampaignFilterBar';
import FocusCampaignStoreCards from './components/FocusCampaignStoreCards';
import FocusCampaignEmployeeTable from './components/FocusCampaignEmployeeTable';
import FocusWatchlistModal from './components/FocusWatchlistModal';
import FocusCampaignRemarkModal from './components/FocusCampaignRemarkModal';
import { exportFocusCampaignImage, copyFocusCampaignImage } from './utils/exportFocusImage';

export default function FocusCampaignPage() {
    const reportRef = useRef<HTMLDivElement>(null);
    const toastTimerRef = useRef<number | null>(null);
    const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false);
    const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        };
    }, []);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => setToast(null), 3500);
    };

    const {
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
        stores,
        canSelectAllStores,
        campaignDict,
        periodActiveCampaigns,
        availableSessions,
        storeMetrics,
        employeeRows,
        smartRemarks,
        isLoading,
        isCloudReady,
        lastSyncTime,
        reloadData
    } = useFocusCampaignData();

    const handleToggleCampaignKey = (key: string) => {
        setSelectedCampaignKeys(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleExportImage = async () => {
        if (!reportRef.current) return;
        setIsExporting(true);
        try {
            const storeLabel = selectedStore === 'all' ? 'Toan_Cum' : selectedStore.replace(/\s+/g, '_');
            const prefix = `Thi_Dua_Trong_Tam_${storeLabel}_T${selectedMonth}_${selectedYear}`;
            const success = await exportFocusCampaignImage(reportRef.current, prefix);
            if (success) {
                showToast('Đã tải file ảnh toàn bộ bảng thi đua trọng tâm thành công!');
            } else {
                showToast('Không thể tạo file ảnh báo cáo!', 'error');
            }
        } finally {
            setIsExporting(false);
        }
    };

    const handleCopyImage = async () => {
        if (!reportRef.current) return;
        setIsCopying(true);
        try {
            const success = await copyFocusCampaignImage(reportRef.current);
            if (success) {
                showToast('Đã sao chép toàn bộ bảng thi đua trọng tâm vào Clipboard! Nhấn Ctrl + V để dán ngay.');
            } else {
                showToast('Không thể sao chép ảnh báo cáo!', 'error');
            }
        } finally {
            setIsCopying(false);
        }
    };

    const storeDisplay = selectedStore === 'all' ? 'Toàn Cụm ST' : selectedStore;

    return (
        <div className="space-y-4 pb-12 font-sans max-w-7xl mx-auto px-2 sm:px-4 pt-3">
            {/* 1. BANNER TRẠNG THÁI CLOUD SUPABASE (QUY CHUẨN 8 & 12) */}
            <CloudDataSyncStatusBanner
                storageType={isCloudReady ? 'cloud' : 'local'}
                syncStatus="synced"
                tableReady={isCloudReady}
                tableName="campaign_watchlists"
                sqlDdl={CAMPAIGN_WATCHLIST_DDL_SQL}
                lastSyncTime={lastSyncTime}
                onSyncNow={reloadData}
            />

            {/* 2. BỘ LỌC ĐA NĂNG (DÒNG 1: ST/CỤM RIÊNG BIỆT - QUY CHUẨN 10) */}
            <div data-export-ignore="true" data-html2canvas-ignore="true">
                <FocusCampaignFilterBar
                    selectedStore={selectedStore}
                    onSelectStore={setSelectedStore}
                    stores={stores}
                    canSelectAllStores={canSelectAllStores}
                    selectedMonth={selectedMonth}
                    onSelectMonth={setSelectedMonth}
                    selectedYear={selectedYear}
                    onSelectYear={setSelectedYear}
                    sessions={availableSessions}
                    selectedSessionId={selectedSessionId}
                    onSelectSessionId={setSelectedSessionId}
                    watchlists={watchlists}
                    activeWatchlistId={activeWatchlistId}
                    onSelectWatchlist={handleSelectWatchlist}
                    selectedCampaignKeys={selectedCampaignKeys}
                    onToggleCampaignKey={handleToggleCampaignKey}
                    campaignDict={campaignDict}
                    periodActiveCampaigns={periodActiveCampaigns}
                    filterEmployeeMode={filterEmployeeMode}
                    onFilterEmployeeModeChange={setFilterEmployeeMode}
                    searchEmployeeText={searchEmployeeText}
                    onSearchEmployeeTextChange={setSearchEmployeeText}
                    tableViewMode={tableViewMode}
                    onTableViewModeChange={setTableViewMode}
                    onRefresh={reloadData}
                    onOpenWatchlistModal={() => setIsWatchlistModalOpen(true)}
                    onOpenRemarkModal={() => setIsRemarkModalOpen(true)}
                    onExportImage={handleExportImage}
                    onCopyImage={handleCopyImage}
                    isRefreshing={isLoading}
                    isExporting={isExporting}
                    isCopying={isCopying}
                />
            </div>

            {/* 3. VÙNG BÁO CÁO CHÍNH (CAPTURE AREA / REPORT CONTAINER) */}
            {isLoading && storeMetrics.length === 0 && employeeRows.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 animate-pulse" aria-busy="true" aria-label="Đang tải dữ liệu thi đua trọng tâm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="space-y-2">
                            <div className="h-5 w-64 bg-slate-200 rounded-lg" />
                            <div className="h-3.5 w-48 bg-slate-100 rounded-lg" />
                        </div>
                        <div className="flex gap-2">
                            <div className="h-6 w-20 bg-slate-100 rounded-xl" />
                            <div className="h-6 w-24 bg-slate-100 rounded-xl" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-24 bg-slate-100 rounded-xl border border-slate-200/70" />
                        ))}
                    </div>
                    <div className="space-y-2 pt-2">
                        <div className="h-10 bg-slate-100 rounded-xl" />
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-11 bg-slate-50 rounded-lg border border-slate-100" />
                        ))}
                    </div>
                </div>
            ) : (
                <div
                    ref={reportRef}
                    className="bg-white border border-slate-200 rounded-3xl p-3 sm:p-5 shadow-sm space-y-4 font-avo"
                >
                    {/* Header Báo Cáo */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-xl bg-blue-600 text-white shadow-sm shrink-0">
                                    <Target className="w-4 h-4" aria-hidden="true" />
                                </span>
                                <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide">
                                    Báo Cáo Thi Đua Trọng Tâm - {storeDisplay}
                                </h2>
                            </div>
                            <p className="text-xs text-slate-600 pt-0.5 font-medium">
                                Kỳ: Tháng {selectedMonth}/{selectedYear} • Bộ theo dõi: <span className="font-bold text-indigo-700">{activeWatchlist?.list_name || 'Tùy chọn'}</span> ({selectedCampaignKeys.length} nhóm hàng)
                            </p>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                            <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 tabular-nums">
                                {employeeRows.length} Nhân Sự
                            </span>
                            <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 tabular-nums">
                                {storeMetrics.length} Nhóm Hàng
                            </span>
                        </div>
                    </div>

                    {/* 4. KHỐI THẺ TIẾN ĐỘ LŨY KẾ CỦA ST (KHÔNG SUM NV) */}
                    <FocusCampaignStoreCards
                        storeMetrics={storeMetrics}
                        storeName={storeDisplay}
                    />

                    {/* 5. BẢNG CHI TIẾT SỐ LIỆU NHÂN VIÊN (CỘT DUY NHẤT "NHÂN VIÊN" & ĐÁNH GIÁ X/TOTAL NH) */}
                    <div className="space-y-2 pt-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-1">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" aria-hidden="true" />
                                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide">
                                    Chi Tiết Tiến Độ Nhân Sự ({employeeRows.length} NV)
                                </h3>
                            </div>
                            <span className="text-[11px] font-bold text-slate-600">
                                Đạt = %DK ≥ 100% hoặc Thực tế ≥ Target
                            </span>
                        </div>

                        <FocusCampaignEmployeeTable
                            employeeRows={employeeRows}
                            storeMetrics={storeMetrics}
                            storeName={storeDisplay}
                            tableViewMode={tableViewMode}
                        />
                    </div>
                </div>
            )}

            {/* 6. MODAL QUẢN LÝ WATCHLISTS */}
            <FocusWatchlistModal
                isOpen={isWatchlistModalOpen}
                onClose={() => setIsWatchlistModalOpen(false)}
                watchlists={watchlists}
                onWatchlistsChanged={reloadData}
                stores={stores}
                campaignDict={campaignDict}
                periodActiveCampaigns={periodActiveCampaigns}
                currentStore={selectedStore}
                currentMonth={selectedMonth}
                currentYear={selectedYear}
            />

            {/* 7. MODAL NHẬN XÉT & ĐÁNH GIÁ X/TOTAL NH */}
            <FocusCampaignRemarkModal
                isOpen={isRemarkModalOpen}
                onClose={() => setIsRemarkModalOpen(false)}
                remarks={smartRemarks}
                storeName={storeDisplay}
            />

            {/* 8. TOAST THÔNG BÁO TÁC VỤ */}
            {toast && (
                <div
                    role="status"
                    aria-live="polite"
                    data-export-ignore="true"
                    data-html2canvas-ignore="true"
                    className="fixed top-5 right-5 z-50 max-w-sm"
                >
                    <div className="px-4 py-3 rounded-2xl shadow-xl text-xs font-bold text-white bg-slate-900 border border-slate-700 flex items-center gap-2.5">
                        {toast.type === 'error' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                        )}
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

