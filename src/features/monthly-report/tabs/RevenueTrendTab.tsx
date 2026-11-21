import React, { useState, useRef, useEffect } from 'react';
import {
    generateStandardReportCanvas,
    downloadReportCanvas,
    copyReportCanvasToClipboard,
    buildReportImageFileName
} from '../../../shared/utils/exportImage';
import { formatDate } from '../../../core/lib/formatters';
import type { CurrentUser } from '../../../shared/contexts/AuthContext';
import { useRevenueTrendData } from '../../revenue-trend/hooks/useRevenueTrendData';
import RevenueTrendKpiCards from '../../revenue-trend/components/RevenueTrendKpiCards';
import RevenueTrendChart from '../../revenue-trend/components/RevenueTrendChart';
import RevenueTrendDailyTable from '../../revenue-trend/components/RevenueTrendDailyTable';
import RevenueTrendStoreComparisonTable from '../../revenue-trend/components/RevenueTrendStoreComparisonTable';
import {
    BarChart2,
    Building2,
    Calendar,
    Layers,
    Target,
    AlertCircle,
    Store
} from 'lucide-react';

interface RevenueTrendTabProps {
    selectedMonth: number;
    selectedYear: number;
    selectedStore: string;
    currentUser: CurrentUser | null;
    isAdmin: boolean;
    canAccessStore: (store: string) => boolean;
    showToast: (msg: string, tone?: 'success' | 'error') => void;
    onRegisterExportHandler?: (handler: (action: 'DOWNLOAD' | 'COPY') => Promise<void>) => void;
}

export default function RevenueTrendTab({
    selectedMonth,
    selectedYear,
    selectedStore,
    currentUser,
    isAdmin,
    canAccessStore,
    showToast,
    onRegisterExportHandler
}: RevenueTrendTabProps) {
    const chartRef = useRef<HTMLDivElement | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<'overview' | 'stores'>('overview');
    const [isCapturing, setIsCapturing] = useState<boolean>(false);

    const {
        loading,
        storeList,
        timelineData,
        metrics,
        storePaceRankings
    } = useRevenueTrendData(
        selectedMonth,
        selectedYear,
        selectedStore,
        currentUser,
        isAdmin,
        canAccessStore
    );

    // XUẤT ẢNH BÁO CÁO NHỊP DOANH THU (960px PORTRAIT, NO WATERMARK)
    const handleCapture = async (action: 'DOWNLOAD' | 'COPY') => {
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
                    const kpiGrid = clonedReport.querySelector<HTMLElement>('[data-kpi-grid="true"]');
                    if (kpiGrid) {
                        kpiGrid.style.display = 'grid';
                        kpiGrid.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
                        kpiGrid.style.gap = '10px';
                    }

                    // 7. Bảng chi tiết mở rộng 100%
                    clonedReport.querySelectorAll<HTMLElement>('table').forEach(tbl => {
                        tbl.style.width = '100%';
                        tbl.style.minWidth = '100%';
                        tbl.style.tableLayout = 'auto';
                    });
                }
            });

            if (!canvas) throw new Error('Không thể khởi tạo canvas');

            if (action === 'DOWNLOAD') {
                const fileName = buildReportImageFileName(
                    'Nhip_Doanh_Thu',
                    selectedStore,
                    `T${selectedMonth}_${selectedYear}`
                );
                const success = await downloadReportCanvas(canvas, fileName);
                if (success) {
                    showToast('Đã tải ảnh báo cáo nhịp doanh thu về thiết bị!');
                } else {
                    throw new Error('Không thể lưu file ảnh');
                }
            } else {
                const success = await copyReportCanvasToClipboard(canvas);
                if (success) {
                    showToast('Đã copy ảnh báo cáo nhịp doanh thu vào clipboard! (Ctrl + V)');
                } else {
                    showToast('Trình duyệt chặn copy ảnh, vui lòng dùng TẢI ẢNH!', 'error');
                }
            }
        } catch (err: any) {
            console.error('Lỗi khi xuất ảnh Tab Nhịp Doanh Thu:', err);
            showToast('Có lỗi xảy ra khi tạo ảnh báo cáo!', 'error');
        } finally {
            setIsCapturing(false);
        }
    };

    // Đăng ký hàm xuất ảnh với parent page
    useEffect(() => {
        if (onRegisterExportHandler) {
            onRegisterExportHandler(handleCapture);
        }
    }, [onRegisterExportHandler, handleCapture]);

    if (timelineData.length === 0) {
        return (
            <div className="bg-white p-12 sm:p-16 rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
                    <AlertCircle className="w-7 h-7" aria-hidden="true" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">
                        Chưa có dữ liệu nhịp doanh thu tháng {selectedMonth}/{selectedYear}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Phạm vi {selectedStore !== 'all' ? `ST ${selectedStore}` : 'toàn cụm'} chưa có dữ liệu bán hàng theo ngày trong tháng này.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* THANH ĐIỀU KHIỂN SUB-TAB: TỔNG QUAN NHỊP / SO SÁNH ST */}
            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs flex items-center justify-between gap-3 text-xs">
                <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                    <button
                        type="button"
                        onClick={() => setActiveSubTab('overview')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${activeSubTab === 'overview'
                            ? 'bg-white text-indigo-700 shadow-2xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <BarChart2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Biểu Đồ &amp; Tiến Độ</span>
                    </button>
                    {storePaceRankings.length > 1 && (
                        <button
                            type="button"
                            onClick={() => setActiveSubTab('stores')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${activeSubTab === 'stores'
                                ? 'bg-white text-indigo-700 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>So Sánh Các ST ({storePaceRankings.length})</span>
                        </button>
                    )}
                </div>

                <div className="text-slate-500 font-bold text-[11px] hidden sm:flex items-center gap-2">
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                        <span>Vượt nhịp</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                        <span>Cận nhịp</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                        <span>Dưới nhịp</span>
                    </span>
                </div>
            </div>

            {/* VÙNG CHỤP ẢNH BÁO CÁO NHỊP DOANH THU 960px PORTRAIT */}
            <div
                ref={chartRef}
                data-report-container="true"
                className="space-y-4 bg-white p-3.5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm font-avo report-table"
            >
                {/* 1. BANNER TIÊU ĐỀ BÁO CÁO NHỊP DOANH THU */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Store className="w-5 h-5 text-indigo-400 shrink-0" aria-hidden="true" />
                            <h2 className="font-black text-sm sm:text-base tracking-wide uppercase">
                                {selectedStore === 'all' || selectedStore === 'Tổng'
                                    ? `TOÀN CỤM ST (${metrics.passedDays}/${metrics.totalDays} NGÀY)`
                                    : `ST ${selectedStore} (${metrics.passedDays}/${metrics.totalDays} NGÀY)`
                                }
                            </h2>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span>Kỳ báo cáo: <b className="text-amber-300 tabular-nums">Tháng {selectedMonth}/{selectedYear}</b></span>
                            <span className="hidden sm:inline text-slate-500" aria-hidden="true">•</span>
                            <span>Số liệu ngày gần nhất: <b className="text-white tabular-nums">{metrics.latestDate ? formatDate(metrics.latestDate) : 'Chưa có'}</b></span>
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-white/10 px-3 py-1.5 rounded-xl text-xs font-black border border-white/15 text-indigo-300 inline-flex items-center gap-1.5 whitespace-nowrap">
                            <Target className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
                            <span>Mục Tiêu Vượt Trội: <b className="tabular-nums">{metrics.targetRate}%</b></span>
                        </span>
                    </div>
                </div>

                {/* 2. KHỐI 4 THẺ KPI NHỊP ĐỘ DOANH THU */}
                <RevenueTrendKpiCards metrics={metrics} selectedStore={selectedStore} />

                {/* 3. BIỂU ĐỒ 31 NGÀY VÀ BẢNG SỐ LIỆU */}
                {activeSubTab === 'overview' ? (
                    <div className="space-y-4">
                        <RevenueTrendChart
                            timelineData={timelineData}
                            metrics={metrics}
                            selectedStore={selectedStore}
                        />
                        <RevenueTrendDailyTable
                            timelineData={timelineData}
                            metrics={metrics}
                            selectedStore={selectedStore}
                        />
                    </div>
                ) : (
                    <RevenueTrendStoreComparisonTable
                        storePaceRankings={storePaceRankings}
                        metrics={metrics}
                    />
                )}
            </div>
        </div>
    );
}
