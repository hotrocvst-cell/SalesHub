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
import type { CumulativeRankingViewMode } from '../types';

interface StoreOption {
    name: string;
    short_name?: string;
}

interface CumulativeRankingFilterBarProps {
    fromDate: string;
    toDate: string;
    onFromDateChange: (val: string) => void;
    onToDateChange: (val: string) => void;
    
    // Quick presets
    onSelectPreset: (preset: 'THIS_MONTH' | 'LAST_7_DAYS' | 'YESTERDAY' | 'LAST_MONTH') => void;
    
    // Store
    selectedStore: string;
    onStoreChange: (store: string) => void;
    storesList: StoreOption[];
    isLockedToSingleStore: boolean;
    
    // View mode
    viewMode: CumulativeRankingViewMode;
    onViewModeChange: (mode: CumulativeRankingViewMode) => void;
    
    // Target
    showTarget: boolean;
    onShowTargetChange: (val: boolean) => void;
    onOpenPeriodTargetModal: () => void;
    activePeriodTitle?: string;
    targetSource?: 'PERIOD' | 'MONTH' | 'NONE';
    
    // Search
    searchQuery: string;
    onSearchChange: (q: string) => void;
    
    // Actions
    loading: boolean;
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
    onSelectPreset,
    selectedStore,
    onStoreChange,
    storesList,
    isLockedToSingleStore,
    viewMode,
    onViewModeChange,
    showTarget,
    onShowTargetChange,
    onOpenPeriodTargetModal,
    activePeriodTitle,
    targetSource,
    searchQuery,
    onSearchChange,
    loading,
    onRefresh,
    onExportExcel,
    onExportImage,
    isExporting
}: CumulativeRankingFilterBarProps) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 sm:p-4 mb-4">
            {/* HÀNG 1: BỘ LỌC THỜI GIAN & SIÊU THỊ & NÚT THAO TÁC */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                {/* KHỐI CHỌN NGÀY TỪ A -> B & SIÊU THỊ */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* TỪ NGÀY */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-500">Từ:</span>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => onFromDateChange(e.target.value)}
                            className="bg-transparent font-semibold text-slate-800 text-xs focus:outline-hidden cursor-pointer"
                        />
                    </div>

                    {/* ĐẾN NGÀY */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-500">Đến:</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => onToDateChange(e.target.value)}
                            className="bg-transparent font-semibold text-slate-800 text-xs focus:outline-hidden cursor-pointer"
                        />
                    </div>

                    {/* PRESETS NHANH */}
                    <div className="hidden sm:flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl">
                        <button
                            type="button"
                            onClick={() => onSelectPreset('THIS_MONTH')}
                            className="px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-white rounded-lg transition-all"
                        >
                            Tháng này
                        </button>
                        <button
                            type="button"
                            onClick={() => onSelectPreset('LAST_7_DAYS')}
                            className="px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-white rounded-lg transition-all"
                        >
                            7 ngày
                        </button>
                        <button
                            type="button"
                            onClick={() => onSelectPreset('YESTERDAY')}
                            className="px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-white rounded-lg transition-all"
                        >
                            Hôm qua
                        </button>
                    </div>

                    {/* CHỌN SIÊU THỊ */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
                        <StoreIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <select
                            value={selectedStore}
                            disabled={isLockedToSingleStore}
                            onChange={(e) => onStoreChange(e.target.value)}
                            className="bg-transparent font-semibold text-slate-800 text-xs focus:outline-hidden cursor-pointer disabled:cursor-not-allowed max-w-[150px] sm:max-w-[200px]"
                        >
                            <option value="all">Tất cả siêu thị</option>
                            {storesList.map((s, idx) => (
                                <option key={idx} value={s.name}>
                                    {s.short_name || s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* KHỐI NÚT THAO TÁC (XUẤT EXCEL / ẢNH) */}
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

                    <button
                        type="button"
                        onClick={onExportExcel}
                        disabled={loading}
                        className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Xuất file Excel"
                    >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Excel</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onExportImage('DOWNLOAD')}
                        disabled={isExporting}
                        className="px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Tải ảnh báo cáo chuẩn dọc smartphone"
                    >
                        <Camera className="w-3.5 h-3.5 text-blue-600" />
                        <span>Tải ảnh</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onExportImage('COPY')}
                        disabled={isExporting}
                        className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Sao chép ảnh vào Clipboard gửi Zalo"
                    >
                        <Copy className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="hidden sm:inline">Copy ảnh</span>
                    </button>
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
                                </span>
                            ) : (
                                '⚙️ Cài Target Giai Đoạn'
                            )}
                        </span>
                    </button>
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
