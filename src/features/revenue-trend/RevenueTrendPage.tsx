import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    generateStandardReportCanvas,
    downloadReportCanvas,
    copyReportCanvasToClipboard,
    buildReportImageFileName
} from '../../shared/utils/exportImage';
import { formatValue, getShortStoreName, formatDate } from '../../core/lib/formatters';
import { GUEST_DEMO_STORE } from '../../core/lib/guestDemoStoreService';
import { useAuth } from '../../shared/contexts/AuthContext';
import {
    TrendingUp,
    Store,
    RefreshCw,
    Lock,
    BarChart2,
    Building2,
    Calendar,
    Layers,
    Target
} from 'lucide-react';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import ReportDataFreshnessBar from '../../shared/components/report/ReportDataFreshnessBar';
import ReportActionButtons from '../../shared/components/report/ReportActionButtons';

import { useRevenueTrendData } from './hooks/useRevenueTrendData';
import RevenueTrendKpiCards from './components/RevenueTrendKpiCards';
import RevenueTrendChart from './components/RevenueTrendChart';
import RevenueTrendDailyTable from './components/RevenueTrendDailyTable';
import RevenueTrendStoreComparisonTable from './components/RevenueTrendStoreComparisonTable';

export default function RevenueTrendPage() {
    const navigate = useNavigate();
    const chartRef = useRef<HTMLDivElement | null>(null);
    const { currentUser, isAdmin, canAccessStore } = useAuth();
    const isGuest = Boolean(currentUser?.is_guest);
    const isStaff = currentUser?.role === 'NHAN_VIEN';

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(() => isGuest ? 10 : today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(() => isGuest ? 2026 : today.getFullYear());
    const [selectedStore, setSelectedStore] = useState<string>(() => isGuest ? getShortStoreName(GUEST_DEMO_STORE) : 'Tổng');
    const [activeTab, setActiveTab] = useState<'overview' | 'stores'>('overview');
    const [isCapturing, setIsCapturing] = useState<boolean>(false);

    // Cố định tháng 10/2026 cho tài khoản trải nghiệm
    useEffect(() => {
        if (isGuest) {
            if (selectedMonth !== 10) setSelectedMonth(10);
            if (selectedYear !== 2026) setSelectedYear(2026);
        }
    }, [isGuest, selectedMonth, selectedYear]);

    // Sử dụng custom hook quản lý dữ liệu và thuật toán nhịp độ
    const {
        rawRecords,
        loading,
        storeList,
        timelineData,
        metrics,
        storePaceRankings,
        loadData
    } = useRevenueTrendData(
        selectedMonth,
        selectedYear,
        selectedStore,
        currentUser,
        isAdmin,
        canAccessStore
    );

    const isLockedToSingleStore = (!isAdmin && isStaff) || isGuest || storeList.length === 1;
    const canViewAllStores = !isGuest && (isAdmin || (!isStaff && storeList.length > 1));

    // Tự động điều chỉnh selectedStore theo phân quyền
    useEffect(() => {
        if (isGuest) {
            const guestShort = getShortStoreName(GUEST_DEMO_STORE);
            if (selectedStore !== guestShort) {
                setSelectedStore(guestShort);
            }
            return;
        }

        if (isLockedToSingleStore && storeList.length > 0) {
            if (selectedStore !== storeList[0]) {
                setSelectedStore(storeList[0]);
            }
            return;
        }

        if (selectedStore !== 'Tổng' && !storeList.includes(selectedStore) && storeList.length > 0) {
            setSelectedStore(canViewAllStores ? 'Tổng' : storeList[0]);
        }
    }, [isGuest, isLockedToSingleStore, storeList, selectedStore, canViewAllStores]);

    // CHỤP BÁO CÁO CHUẨN 8K VỚI AUTO-SAFETY CLAMP (KHUNG XUẤT 960px KHÔNG CẮT CỘT MOBILE)
    const handleCapture = async () => {
        if (!chartRef.current || isCapturing) return;
        setIsCapturing(true);
        try {
            const fileName = buildReportImageFileName(
                'Nhip_Doanh_Thu',
                selectedStore,
                `T${selectedMonth}_${selectedYear}`
            );
            const canvas = await generateStandardReportCanvas(chartRef.current, {
                targetWidth: 960,
                containerSelector: '[data-report-container="true"]',
                onCustomClone: (_doc, clonedReport) => {
                    // 1. Cố định kích thước & bố cục vùng biểu đồ nhịp để không bị co lùn
                    clonedReport.querySelectorAll<HTMLElement>('[data-chart-scroll-container="true"]').forEach(el => {
                        el.style.overflow = 'visible';
                        el.style.overflowX = 'visible';
                        el.style.overflowY = 'visible';
                        el.style.width = '100%';
                        el.style.minWidth = '100%';
                        el.style.height = '270px';
                        el.style.minHeight = '270px';
                        el.style.maxHeight = '270px';
                        el.style.paddingTop = '16px';
                        el.style.paddingBottom = '8px';
                        el.style.display = 'flex';
                        el.style.alignItems = 'flex-end';
                        el.style.boxSizing = 'border-box';
                        el.style.position = 'relative';
                    });

                    // 2. Vùng vạch tham chiếu khớp hoàn hảo 100% với bar track
                    clonedReport.querySelectorAll<HTMLElement>('[data-reference-overlay="true"]').forEach(overlay => {
                        overlay.style.position = 'absolute';
                        overlay.style.left = '0';
                        overlay.style.right = '0';
                        overlay.style.bottom = '46px';
                        overlay.style.height = '176px';
                        overlay.style.width = '100%';
                        overlay.style.display = 'block';
                    });

                    // 3. Định hình từng cột ngày dàn đều 100% chiều cao
                    clonedReport.querySelectorAll<HTMLElement>('[data-chart-bar="true"]').forEach(bar => {
                        bar.style.minWidth = '0';
                        bar.style.flex = '1 1 0%';
                        bar.style.width = 'auto';
                        bar.style.height = '100%';
                        bar.style.minHeight = '100%';
                        bar.style.maxHeight = '100%';
                        bar.style.display = 'flex';
                        bar.style.flexDirection = 'column';
                        bar.style.justifyContent = 'flex-end';
                        bar.style.alignItems = 'center';
                        bar.style.overflow = 'visible';
                    });

                    // 4. Khóa chiều cao thanh bar track 176px
                    clonedReport.querySelectorAll<HTMLElement>('[data-bar-track="true"]').forEach(track => {
                        track.style.height = '176px';
                        track.style.minHeight = '176px';
                        track.style.maxHeight = '176px';
                        track.style.width = '100%';
                        track.style.display = 'flex';
                        track.style.alignItems = 'flex-end';
                    });

                    // 5. Tắt animation nhấp nháy để html2canvas render icon ngọn lửa sắc nét
                    clonedReport.querySelectorAll<HTMLElement>('.animate-pulse').forEach(el => {
                        el.style.animation = 'none';
                        el.style.opacity = '1';
                    });

                    // 6. Cố định 4 thẻ KPI dàn 4 cột đẹp mắt
                    const kpiGrid = clonedReport.querySelector('[data-kpi-grid="true"]') as HTMLElement;
                    if (kpiGrid) {
                        kpiGrid.style.display = 'grid';
                        kpiGrid.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
                        kpiGrid.style.gap = '10px';
                    }

                    // 7. Bảng chi tiết mở rộng 100%
                    clonedReport.querySelectorAll<HTMLElement>('table').forEach(table => {
                        table.style.width = '100%';
                        table.style.minWidth = '100%';
                        table.style.tableLayout = 'auto';
                    });
                }
            });

            if (canvas) {
                downloadReportCanvas(canvas, fileName);
            }
        } catch (err) {
            console.error('Lỗi chụp ảnh:', err);
        } finally {
            setIsCapturing(false);
        }
    };

    const handleCopyImage = async () => {
        if (!chartRef.current || isCapturing) return;
        setIsCapturing(true);
        try {
            const canvas = await generateStandardReportCanvas(chartRef.current, {
                targetWidth: 960,
                containerSelector: '[data-report-container="true"]',
                onCustomClone: (_doc, clonedReport) => {
                    // 1. Cố định kích thước & bố cục vùng biểu đồ nhịp để không bị co lùn
                    clonedReport.querySelectorAll<HTMLElement>('[data-chart-scroll-container="true"]').forEach(el => {
                        el.style.overflow = 'visible';
                        el.style.overflowX = 'visible';
                        el.style.overflowY = 'visible';
                        el.style.width = '100%';
                        el.style.minWidth = '100%';
                        el.style.height = '270px';
                        el.style.minHeight = '270px';
                        el.style.maxHeight = '270px';
                        el.style.paddingTop = '16px';
                        el.style.paddingBottom = '8px';
                        el.style.display = 'flex';
                        el.style.alignItems = 'flex-end';
                        el.style.boxSizing = 'border-box';
                        el.style.position = 'relative';
                    });

                    // 2. Vùng vạch tham chiếu khớp hoàn hảo 100% với bar track
                    clonedReport.querySelectorAll<HTMLElement>('[data-reference-overlay="true"]').forEach(overlay => {
                        overlay.style.position = 'absolute';
                        overlay.style.left = '0';
                        overlay.style.right = '0';
                        overlay.style.bottom = '46px';
                        overlay.style.height = '176px';
                        overlay.style.width = '100%';
                        overlay.style.display = 'block';
                    });

                    // 3. Định hình từng cột ngày dàn đều 100% chiều cao
                    clonedReport.querySelectorAll<HTMLElement>('[data-chart-bar="true"]').forEach(bar => {
                        bar.style.minWidth = '0';
                        bar.style.flex = '1 1 0%';
                        bar.style.width = 'auto';
                        bar.style.height = '100%';
                        bar.style.minHeight = '100%';
                        bar.style.maxHeight = '100%';
                        bar.style.display = 'flex';
                        bar.style.flexDirection = 'column';
                        bar.style.justifyContent = 'flex-end';
                        bar.style.alignItems = 'center';
                        bar.style.overflow = 'visible';
                    });

                    // 4. Khóa chiều cao thanh bar track 176px
                    clonedReport.querySelectorAll<HTMLElement>('[data-bar-track="true"]').forEach(track => {
                        track.style.height = '176px';
                        track.style.minHeight = '176px';
                        track.style.maxHeight = '176px';
                        track.style.width = '100%';
                        track.style.display = 'flex';
                        track.style.alignItems = 'flex-end';
                    });

                    // 5. Tắt animation nhấp nháy để html2canvas render icon ngọn lửa sắc nét
                    clonedReport.querySelectorAll<HTMLElement>('.animate-pulse').forEach(el => {
                        el.style.animation = 'none';
                        el.style.opacity = '1';
                    });

                    // 6. Cố định 4 thẻ KPI dàn 4 cột đẹp mắt
                    const kpiGrid = clonedReport.querySelector('[data-kpi-grid="true"]') as HTMLElement;
                    if (kpiGrid) {
                        kpiGrid.style.display = 'grid';
                        kpiGrid.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
                        kpiGrid.style.gap = '10px';
                    }

                    // 7. Bảng chi tiết mở rộng 100%
                    clonedReport.querySelectorAll<HTMLElement>('table').forEach(table => {
                        table.style.width = '100%';
                        table.style.minWidth = '100%';
                        table.style.tableLayout = 'auto';
                    });
                }
            });

            if (canvas) {
                await copyReportCanvasToClipboard(canvas);
            }
        } catch (err) {
            console.error('Lỗi copy ảnh:', err);
        } finally {
            setIsCapturing(false);
        }
    };

    return (
        <div className="p-3.5 sm:p-5 md:p-6 space-y-3.5 max-w-full mx-auto w-full">
            {/* TẦNG 1: BANNER TRẠNG THÁI CLOUD */}
            <CloudDataSyncStatusBanner
                compact={true}
                storageType="cloud"
                syncStatus={loading ? 'syncing' : rawRecords.length > 0 ? 'synced' : 'unsynced'}
                tableReady={true}
                tableName="daily_business_records"
            />

            {/* TẦNG 2: THANH ĐỘ MỚI DỮ LIỆU & PHIÊN CHỐT SỐ */}
            <ReportDataFreshnessBar
                latestDataDate={metrics.latestDate}
                sessionTitle={
                    metrics.latestDate
                        ? `Nhịp lũy kế T${selectedMonth}/${selectedYear} • Mốc ngày ${formatDate(metrics.latestDate)} (${timelineData.length} ngày ghi nhận)`
                        : `Chưa có phiên dữ liệu tháng ${selectedMonth}/${selectedYear}`
                }
                storeName={selectedStore === 'Tổng' ? 'Toàn Cụm ST' : selectedStore}
                compact={true}
            />

            {/* TẦNG 3: CARD TIÊU ĐỀ H1 & CHUYỂN ĐỔI CHẾ ĐỘ XEM */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-wide">
                                Nhịp Doanh Thu & Tốc Độ Về Đích
                            </h1>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                                T{selectedMonth}/{selectedYear}
                            </span>
                            <span
                                title="Mục tiêu kỳ vọng (vượt trội) được đồng bộ từ Báo Cáo Cụm ST"
                                className="text-xs font-mono font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs"
                            >
                                🎯 Kỳ Vọng: {metrics.targetRate}%
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Phân tích nhịp thực thu từng ngày theo mục tiêu kỳ vọng {metrics.targetRate}%, kiểm soát tốc độ run-rate cần đạt và dự báo về đích
                        </p>
                    </div>
                </div>

                {/* Sub-tabs chuyển chế độ xem */}
                {selectedStore === 'Tổng' && (
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold shrink-0 self-start md:self-auto">
                        <button
                            type="button"
                            onClick={() => setActiveTab('overview')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                activeTab === 'overview'
                                    ? 'bg-white text-blue-700 shadow-2xs font-black'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <BarChart2 className="w-3.5 h-3.5" />
                            <span>Tổng Quan & Biểu Đồ</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('stores')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                activeTab === 'stores'
                                    ? 'bg-white text-blue-700 shadow-2xs font-black'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>So Sánh Các ST ({storePaceRankings.length})</span>
                        </button>
                    </div>
                )}
            </div>

            {/* TẦNG 4: THANH BỘ LỌC 2 DÒNG CHUẨN SMARTPHONE */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                {/* DÒNG 1: BỘ LỌC ST / CỤM (BẮT BUỘC ĐẦU TIÊN & NẰM RIÊNG LẺ 1 DÒNG) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-600 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                            <Store className="w-4 h-4 text-blue-700" />
                            ST / Cụm:
                        </span>
                        <div className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-xl min-w-[200px] sm:min-w-[280px] ${
                            isLockedToSingleStore ? 'bg-amber-50/90 border-amber-200 text-amber-900 shadow-2xs' : 'bg-slate-50 border-slate-300'
                        }`}>
                            {isLockedToSingleStore ? (
                                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                            ) : (
                                <Store className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                            <select
                                value={selectedStore}
                                onChange={(e) => {
                                    setSelectedStore(e.target.value);
                                    if (e.target.value !== 'Tổng') {
                                        setActiveTab('overview');
                                    }
                                }}
                                disabled={isLockedToSingleStore}
                                title={isLockedToSingleStore ? (isGuest ? 'Tài khoản trải nghiệm sử dụng dữ liệu ST 838679 - Demo Store' : 'Tài khoản nhân viên được cố định theo ST đã đăng ký') : undefined}
                                className={`bg-transparent outline-none font-bold text-xs w-full ${isLockedToSingleStore ? 'cursor-not-allowed text-amber-900 font-black' : 'cursor-pointer text-slate-700'}`}
                            >
                                {canViewAllStores && (
                                    <option value="Tổng">
                                        {isAdmin 
                                            ? `🏢 TỔNG TOÀN CỤM (${storeList.length} ST)`
                                            : `🏢 TỔNG CỤM PHỤ TRÁCH (${storeList.length} ST)`
                                        }
                                    </option>
                                )}
                                {storeList.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            {isLockedToSingleStore && (
                                <span className="text-[10px] bg-amber-200/80 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                                    {isGuest ? 'Trải nghiệm' : 'Đã khóa'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Nút tác nghiệp theo ST / Cụm: Điều hướng sang trang Báo Cáo Cụm để xem / sửa cấu hình nhịp kỳ vọng */}
                    <button
                        type="button"
                        onClick={() => navigate('/bao-cao-cum-sieu-thi')}
                        className="px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 self-start sm:self-auto"
                        title="Chuyển đến trang Báo Cáo Cụm ST để cấu hình mục tiêu kỳ vọng & tỷ lệ nhịp vượt trội"
                    >
                        <Target className="w-3.5 h-3.5 text-amber-700" />
                        <span>Cấu hình nhịp tại Báo Cáo Cụm ({metrics.targetRate}%)</span>
                    </button>
                </div>

                {/* DÒNG 2: TIÊU CHÍ THỜI GIAN & CỤM NÚT HÀNH ĐỘNG XUẤT */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> Kỳ tháng:
                        </span>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}/{selectedYear}</option>
                            ))}
                        </select>

                        <button
                            onClick={loadData}
                            disabled={loading}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                            title="Làm mới số liệu"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {timelineData.length > 0 && (
                        <ReportActionButtons
                            onExportImage={handleCapture}
                            onCopyImage={handleCopyImage}
                            isExporting={isCapturing}
                            exportButtonLabel="TẢI ẢNH"
                            copyImageButtonLabel="COPY ẢNH"
                            hasAssessment={true}
                            reportTitle={`Nhịp Doanh Thu & Diễn Biến Tăng Trưởng T${selectedMonth}/${selectedYear} - ${selectedStore}`}
                            periodLabel={`Tháng ${selectedMonth}/${selectedYear}`}
                        />
                    )}
                </div>
            </div>

            {/* KHU VỰC NỘI DUNG DASHBOARD */}
            {loading ? (
                <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                    <p className="text-xs font-bold text-slate-500">Đang tổng hợp số liệu nhịp độ tháng {selectedMonth}/{selectedYear}...</p>
                </div>
            ) : timelineData.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 space-y-2">
                    <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                    <h3 className="font-bold text-sm text-slate-700">Chưa có bản ghi nào cho tháng {selectedMonth}/{selectedYear}</h3>
                    <p className="text-xs text-slate-400">Vui lòng kiểm tra lại bảng daily_business_records hoặc nạp dữ liệu mới.</p>
                </div>
            ) : (
                <div ref={chartRef} data-report-container="true" data-report-table="true" className="space-y-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs font-avo">
                    {/* KHỐI 4 THẺ KPI NHỊP ĐỘ THÔNG MINH */}
                    <RevenueTrendKpiCards metrics={metrics} selectedStore={selectedStore} />

                    {/* KHỐI BIỂU ĐỒ NHỊP ĐỘ TRỰC QUAN CÓ ĐƯỜNG BENCHMARK */}
                    <RevenueTrendChart
                        timelineData={timelineData}
                        metrics={metrics}
                        selectedStore={selectedStore}
                    />

                    {/* KHỐI BẢNG CHI TIẾT THEO CHẾ ĐỘ TAB */}
                    {activeTab === 'overview' ? (
                        <div className="space-y-4">
                            <RevenueTrendDailyTable
                                timelineData={timelineData}
                                metrics={metrics}
                                selectedStore={selectedStore}
                            />

                            {/* Bảng so sánh phụ trợ khi xem cụm */}
                            {selectedStore === 'Tổng' && storePaceRankings.length > 0 && (
                                <RevenueTrendStoreComparisonTable
                                    storePaceRankings={storePaceRankings}
                                    metrics={metrics}
                                    onSelectStore={(s) => setSelectedStore(s)}
                                />
                            )}
                        </div>
                    ) : (
                        <RevenueTrendStoreComparisonTable
                            storePaceRankings={storePaceRankings}
                            metrics={metrics}
                            onSelectStore={(s) => setSelectedStore(s)}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
