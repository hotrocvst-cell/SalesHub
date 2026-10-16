import React from 'react';
import {
    Calendar,
    Store as StoreIcon,
    Search,
    RefreshCw,
    Download,
    Camera,
    Copy,
    SlidersHorizontal,
    Table,
    ListFilter,
    Target as TargetIcon,
    Settings
} from 'lucide-react';
import type { CumulativeRankingViewMode, TargetSelectionMode } from '../types';
import MondayFirstDatePicker from '../../../shared/components/common/MondayFirstDatePicker';
import ReportActionButtons from '../../../shared/components/report/ReportActionButtons';

interface StoreOption {
    name: string;
    short_name?: string;
}

export type RankingDatePreset = 'THIS_MONTH' | 'THIS_WEEK' | 'LAST_7_DAYS' | 'YESTERDAY' | 'LAST_MONTH' | 'CUSTOM';

interface CumulativeRankingFilterBarProps {
    fromDate: string;
    toDate: string;
    onFromDateChange: (val: string) => void;
    onToDateChange: (val: string) => void;
    
    // Quick presets
    activePreset?: RankingDatePreset;
    onSelectPreset: (preset: 'THIS_MONTH' | 'THIS_WEEK' | 'LAST_7_DAYS' | 'YESTERDAY' | 'LAST_MONTH') => void;
    
    // Store
    selectedStore: string;
    onStoreChange: (store: string) => void;
    storesList: StoreOption[];
    isLockedToSingleStore: boolean;
    
    // View mode
    viewMode: CumulativeRankingViewMode;
    onViewModeChange: (mode: CumulativeRankingViewMode) => void;
    
    // Target mode & options
    showTarget: boolean;
    onShowTargetChange: (val: boolean) => void;
    targetMode: TargetSelectionMode;
    onTargetModeChange: (mode: TargetSelectionMode) => void;
    onOpenPeriodTargetModal: () => void;
    onOpenSessionManager?: () => void;
    activePeriodTitle?: string;
    targetSource?: 'PERIOD' | 'MONTH' | 'NONE';
    isPeriodTargetCloudStored?: boolean;
    
    // Search
    searchQuery: string;
    onSearchChange: (q: string) => void;
    
    // Actions & Permissions
    loading: boolean;
    canExportExcel: boolean;
    onRefresh: () => void;
    onExportExcel: () => void;
    onExportImage: (mode: 'DOWNLOAD' | 'COPY') => void;
    isExporting: boolean;
}

export default function CumulativeRankingFilterBar({
    fromDate,
    toDate,
    onFromDateChange,
    onToDateChange,
    activePreset = 'THIS_MONTH',
    onSelectPreset,
    selectedStore,
    onStoreChange,
    storesList,
    isLockedToSingleStore,
    viewMode,
    onViewModeChange,
    showTarget,
    onShowTargetChange,
    targetMode,
    onTargetModeChange,
    onOpenPeriodTargetModal,
    onOpenSessionManager,
    activePeriodTitle,
    targetSource,
    isPeriodTargetCloudStored,
    searchQuery,
    onSearchChange,
    loading,
    canExportExcel = false,
    onRefresh,
    onExportExcel,
    onExportImage,
    isExporting
}: CumulativeRankingFilterBarProps) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 sm:p-4 mb-4">
            {/* HÀNG 1: BỘ LỌC SIÊU THỊ / CỤM ĐẶT ĐẦU TIÊN RIÊNG LẺ 1 DÒNG (RULE 10 CONVENTION) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                {/* BỘ LỌC SIÊU THỊ / CỤM Ở VỊ TRÍ ĐẦU TIÊN */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:border-blue-400 px-3 py-2 rounded-xl text-xs transition-all shadow-2xs">
                        <StoreIcon className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Siêu thị:</span>
                        <select
                            value={selectedStore}
                            disabled={isLockedToSingleStore}
                            onChange={(e) => onStoreChange(e.target.value)}
                            className="bg-transparent font-black text-slate-900 text-xs focus:outline-hidden cursor-pointer disabled:cursor-not-allowed min-w-[180px] sm:min-w-[240px]"
                        >
                            <option value="all">🏢 Tất cả siêu thị</option>
                            {storesList.map((s, idx) => (
                                <option key={idx} value={s.name}>
                                    🏪 {s.short_name || s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* KHỐI NÚT THAO TÁC (XUẤT EXCEL / ẢNH / LÀM MỚI) */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loading}
                        className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Làm mới dữ liệu từ Cloud"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                        <span className="hidden sm:inline">Làm mới</span>
                    </button>

                    {/* CỤM NÚT BÁO CÁO CHUNG: XUẤT ẢNH, COPY ẢNH, NHẬN XÉT, EXCEL */}
                    <ReportActionButtons
                        onExportImage={() => onExportImage('DOWNLOAD')}
                        onCopyImage={() => onExportImage('COPY')}
                        isExporting={isExporting}
                        hasAssessment={true}
                        reportTitle="Bảng Xếp Hạng Lũy Kế Nhân Viên"
                        onExportExcel={onExportExcel}
                        canExportExcel={canExportExcel}
                    />
                </div>
            </div>

            {/* HÀNG 2: BỘ LỌC THỜI GIAN (TỪ NGÀY -> ĐẾN NGÀY & PRESETS XEM NHANH) */}
            <div className="flex flex-wrap items-center gap-2 py-3 border-b border-slate-100">
                {/* TỪ NGÀY (LỊCH BẮT ĐẦU TỪ THỨ HAI) */}
                <MondayFirstDatePicker
                    label="Từ:"
                    value={fromDate}
                    onChange={onFromDateChange}
                />

                {/* ĐẾN NGÀY (LỊCH BẮT ĐẦU TỪ THỨ HAI) */}
                <MondayFirstDatePicker
                    label="Đến:"
                    value={toDate}
                    onChange={onToDateChange}
                />

                {/* PRESETS NHANH (Bắt đầu từ Thứ Hai) */}
                <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl">
                    <span className="text-[10.5px] font-bold text-slate-500 pl-1.5 pr-0.5 whitespace-nowrap">
                        Xem nhanh theo:
                    </span>
                    {[
                        { id: 'THIS_MONTH', label: 'Tháng này' },
                        { id: 'THIS_WEEK', label: 'Tuần này', title: 'Tuần này (Tính từ Thứ Hai)' },
                        { id: 'LAST_7_DAYS', label: '7 ngày' },
                        { id: 'YESTERDAY', label: 'Hôm qua' },
                    ].map((p) => {
                        const isActive = activePreset === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => onSelectPreset(p.id as any)}
                                title={p.title}
                                className={`px-2 sm:px-2.5 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                                    isActive
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'text-slate-700 hover:bg-white rounded-lg'
                                }`}
                            >
                                {p.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* HÀNG 2: TÙY CHỌN CHẾ ĐỘ XEM & TARGET & TÌM KIẾM */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3">
                <div className="flex flex-wrap items-center gap-3">
                    {/* CHUYỂN CHẾ ĐỘ XEM: CHỈ LŨY KẾ VS KÈM CHI TIẾT TỪNG NGÀY */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => onViewModeChange('CUMULATIVE_ONLY')}
                            className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${
                                viewMode === 'CUMULATIVE_ONLY'
                                    ? 'bg-white text-indigo-700 shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <ListFilter className="w-3.5 h-3.5" />
                            <span>Chỉ lũy kế</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onViewModeChange('WITH_DAILY')}
                            className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${
                                viewMode === 'WITH_DAILY'
                                    ? 'bg-white text-indigo-700 shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Table className="w-3.5 h-3.5" />
                            <span>Kèm chi tiết từng ngày</span>
                        </button>
                    </div>

                    {/* TOGGLE TARGET & %HT */}
                    <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 transition-all">
                        <input
                            type="checkbox"
                            checked={showTarget}
                            onChange={(e) => onShowTargetChange(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="flex items-center gap-1">
                            <TargetIcon className="w-3.5 h-3.5 text-rose-500" />
                            <span className="text-xs font-bold text-slate-700">Kèm Target & %HT</span>
                        </div>
                    </label>

                    {/* LỰA CHỌN NGUỒN TARGET: TỰ ĐỘNG (KHUYẾN NGHỊ) / TARGET THÁNG / TARGET GIAI ĐOẠN */}
                    {showTarget && (
                        <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/80">
                            <button
                                type="button"
                                onClick={() => onTargetModeChange('AUTO')}
                                className={`px-2 py-1 text-[11px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                                    targetMode === 'AUTO'
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                }`}
                                title="Tự động chọn Target Tháng nếu chọn 'Tháng này', hoặc Target Giai đoạn nếu có phiên trùng khớp"
                            >
                                <span>⚡ Tự động</span>
                                <span className={`text-[9px] px-1 py-0.2 rounded-full font-bold ${
                                    targetMode === 'AUTO' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                    Khuyến nghị
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => onTargetModeChange('MONTH')}
                                className={`px-2 py-1 text-[11px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                                    targetMode === 'MONTH'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                }`}
                                title="Sử dụng Target tháng đã cài đặt cấu hình từ trước"
                            >
                                <span>📅 Target Tháng</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => onTargetModeChange('PERIOD')}
                                className={`px-2 py-1 text-[11px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                                    targetMode === 'PERIOD'
                                        ? 'bg-amber-600 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                }`}
                                title="Sử dụng Target giai đoạn thi đua riêng"
                            >
                                <span>🎯 Target Giai Đoạn</span>
                            </button>
                        </div>
                    )}

                    {/* NÚT CẤU HÌNH TARGET GIAI ĐOẠN */}
                    <button
                        type="button"
                        onClick={onOpenPeriodTargetModal}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            targetSource === 'PERIOD'
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                        title="Thiết lập Target riêng cho từng nhân sự trong giai đoạn này"
                    >
                        <Settings className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                            {targetSource === 'PERIOD' ? (
                                <span className="flex items-center gap-1">
                                    <span>🎯 Target giai đoạn:</span>
                                    <strong className="text-amber-800">{activePeriodTitle || 'Đang áp dụng'}</strong>
                                    {isPeriodTargetCloudStored ? (
                                        <span className="text-[9.5px] px-1 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                            ☁️ Cloud
                                        </span>
                                    ) : (
                                        <span className="text-[9.5px] px-1 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold">
                                            💾 Local
                                        </span>
                                    )}
                                </span>
                            ) : (
                                '⚙️ Cài Target Giai Đoạn'
                            )}
                        </span>
                    </button>

                    {/* NÚT QUẢN LÝ TẤT CẢ CÁC PHIÊN TARGET */}
                    {onOpenSessionManager && (
                        <button
                            type="button"
                            onClick={onOpenSessionManager}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            title="Xem tất cả các đợt thi đua đã lưu, kiểm tra lưu trữ Cloud và áp dụng nhanh"
                        >
                            <span>📑 Quản lý phiên</span>
                        </button>
                    )}
                </div>

                {/* TÌM KIẾM NHÂN VIÊN */}
                <div className="relative min-w-[180px] sm:min-w-[220px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Tìm theo tên hoặc mã NV..."
                        className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-1.5 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-400 transition-all"
                    />
                </div>
            </div>
        </div>
    );
}
