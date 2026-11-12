import React from 'react';
import {
    RefreshCw,
    SlidersHorizontal,
    Camera,
    Copy,
    FileSpreadsheet,
    MessageSquare,
    Search,
    X
} from 'lucide-react';
import type { StoreItem, CampaignDictItem } from '../../../core/lib/storage';
import type { EmployeeDataSession } from '../../employee-cumulative/utils/sessionStorage';
import type {
    CampaignWatchlist,
    QuickFilterEmployeeMode,
    TableViewMode
} from '../types';
import { useExcelExportPermission } from '../../../shared/hooks/useExcelExportPermission';
import CampaignKeyMultiSelect from './CampaignKeyMultiSelect';

interface Props {
    selectedStore: string;
    onSelectStore: (store: string) => void;
    stores: StoreItem[];
    canSelectAllStores: boolean;
    selectedMonth: number;
    onSelectMonth: (month: number) => void;
    selectedYear: number;
    onSelectYear: (year: number) => void;
    sessions: EmployeeDataSession[];
    selectedSessionId: string;
    onSelectSessionId: (id: string) => void;
    watchlists: CampaignWatchlist[];
    activeWatchlistId: string;
    onSelectWatchlist: (id: string) => void;
    selectedCampaignKeys: string[];
    onToggleCampaignKey: (key: string) => void;
    campaignDict: CampaignDictItem[];
    periodActiveCampaigns: CampaignDictItem[];
    filterEmployeeMode: QuickFilterEmployeeMode;
    onFilterEmployeeModeChange: (mode: QuickFilterEmployeeMode) => void;
    searchEmployeeText: string;
    onSearchEmployeeTextChange: (text: string) => void;
    tableViewMode: TableViewMode;
    onTableViewModeChange: (mode: TableViewMode) => void;
    onRefresh: () => void;
    onOpenWatchlistModal: () => void;
    onOpenRemarkModal: () => void;
    onExportImage: () => void;
    onCopyImage?: () => void;
    onExportExcel?: () => void;
    isRefreshing: boolean;
    isExporting?: boolean;
    isCopying?: boolean;
}

export default function FocusCampaignFilterBar({
    selectedStore,
    onSelectStore,
    stores,
    canSelectAllStores,
    selectedMonth,
    onSelectMonth,
    selectedYear,
    onSelectYear,
    sessions,
    selectedSessionId,
    onSelectSessionId,
    watchlists,
    activeWatchlistId,
    onSelectWatchlist,
    selectedCampaignKeys,
    onToggleCampaignKey,
    campaignDict,
    periodActiveCampaigns,
    filterEmployeeMode,
    onFilterEmployeeModeChange,
    searchEmployeeText,
    onSearchEmployeeTextChange,
    tableViewMode,
    onTableViewModeChange,
    onRefresh,
    onOpenWatchlistModal,
    onOpenRemarkModal,
    onExportImage,
    onCopyImage,
    onExportExcel,
    isRefreshing,
    isExporting = false,
    isCopying = false
}: Props) {
    const { canExportExcel } = useExcelExportPermission('/thi-dua-trong-tam');

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3 font-sans">
            {/* DÒNG 1: BỘ LỌC ST / CỤM RIÊNG BIỆT (QUY CHUẨN 10 & PHÂN QUYỀN ST) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-100 min-w-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <label
                        htmlFor="focus-store-select"
                        className="text-xs font-black text-slate-600 uppercase tracking-wider shrink-0"
                    >
                        Đơn Vị / ST:
                    </label>
                    <select
                        id="focus-store-select"
                        name="focus_store_select"
                        value={selectedStore}
                        onChange={(e) => onSelectStore(e.target.value)}
                        className="w-full sm:w-64 min-w-0 bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-500 transition cursor-pointer"
                    >
                        {canSelectAllStores && <option value="all">Toàn Cụm ST</option>}
                        {stores.map((s) => (
                            <option key={s.id || s.name} value={s.name}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Các nút hành động */}
                <div className="flex items-center gap-1.5 flex-wrap justify-start sm:justify-end">
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition cursor-pointer disabled:opacity-50"
                        title="Làm mới dữ liệu"
                        aria-label="Làm mới dữ liệu"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} aria-hidden="true" />
                        <span className="hidden sm:inline">Làm mới</span>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenWatchlistModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 active:scale-95 transition cursor-pointer"
                        title="Quản lý danh sách thi đua trọng tâm"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
                        <span>Danh Sách</span>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenRemarkModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 active:scale-95 transition cursor-pointer"
                        title="Xem nhận xét và đánh giá nhân sự X/total NH"
                    >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                        <span>Đánh Giá NV</span>
                    </button>

                    {onCopyImage && (
                        <button
                            type="button"
                            onClick={onCopyImage}
                            disabled={isCopying}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 active:scale-95 transition cursor-pointer disabled:opacity-50"
                            title="Sao chép toàn bộ ảnh báo cáo để dán vào Messaging App (Ctrl + V)"
                        >
                            <Copy className={`w-3.5 h-3.5 ${isCopying ? 'animate-spin' : ''}`} aria-hidden="true" />
                            <span>{isCopying ? 'Đang copy...' : 'Copy Ảnh'}</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onExportImage}
                        disabled={isExporting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm active:scale-95 transition cursor-pointer disabled:opacity-50"
                        title="Tải ảnh báo cáo PNG về máy"
                    >
                        <Camera className={`w-3.5 h-3.5 ${isExporting ? 'animate-spin' : ''}`} aria-hidden="true" />
                        <span>{isExporting ? 'Đang xuất...' : 'Xuất Ảnh'}</span>
                    </button>

                    {canExportExcel && onExportExcel && (
                        <button
                            type="button"
                            onClick={onExportExcel}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 active:scale-95 transition cursor-pointer"
                            title="Xuất file Excel"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                            <span className="hidden sm:inline">Excel</span>
                        </button>
                    )}
                </div>
            </div>

            {/* DÒNG 2: BỘ LỌC KỲ THỜI GIAN, DANH SÁCH THEO DÕI & TÙY CHỌN NHÓM HÀNG */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-slate-600 shrink-0">Kỳ:</span>
                    <select
                        aria-label="Chọn tháng báo cáo"
                        value={selectedMonth}
                        onChange={(e) => onSelectMonth(Number(e.target.value))}
                        className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 flex-1 min-w-0"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>Tháng {m}</option>
                        ))}
                    </select>
                    <select
                        aria-label="Chọn năm báo cáo"
                        value={selectedYear}
                        onChange={(e) => onSelectYear(Number(e.target.value))}
                        className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
                    >
                        {[2025, 2026, 2027].map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                {sessions.length > 1 && (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <label htmlFor="focus-session-select" className="text-xs font-bold text-slate-600 shrink-0">Phiên:</label>
                        <select
                            id="focus-session-select"
                            name="focus_session_select"
                            value={selectedSessionId}
                            onChange={(e) => onSelectSessionId(e.target.value)}
                            className="w-full min-w-0 bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 truncate"
                        >
                            {sessions.map((sess) => (
                                <option key={sess.id} value={sess.id}>
                                    {sess.session_title || sess.report_date} ({sess.employee_count} NV)
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex items-center gap-1.5 min-w-0">
                    <label htmlFor="focus-watchlist-select" className="text-xs font-bold text-slate-600 shrink-0">Bộ Trọng Tâm:</label>
                    <select
                        id="focus-watchlist-select"
                        name="focus_watchlist_select"
                        value={activeWatchlistId}
                        onChange={(e) => onSelectWatchlist(e.target.value)}
                        className="w-full min-w-0 bg-indigo-50/70 border border-indigo-200 text-indigo-900 text-xs font-black rounded-xl px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 truncate"
                    >
                        {watchlists.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.list_name} ({w.campaign_keys?.length || 0} NH)
                            </option>
                        ))}
                    </select>
                </div>

                {/* Multi-select Dropdown / Tùy chọn nhóm hàng (Lọc gọn gàng theo kỳ - Yêu cầu 5) */}
                <CampaignKeyMultiSelect
                    selectedKeys={selectedCampaignKeys}
                    onToggleKey={onToggleCampaignKey}
                    campaignDict={campaignDict}
                    periodActiveCampaigns={periodActiveCampaigns}
                    currentMonth={selectedMonth}
                />
            </div>

            {/* DÒNG 3: BỘ LỌC NHÂN VIÊN & TÌM KIẾM */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
                    <div className="relative w-full sm:max-w-xs min-w-0">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                        <input
                            type="text"
                            aria-label="Tìm nhân viên theo mã hoặc tên"
                            placeholder="Tìm nhân viên (mã, tên)..."
                            value={searchEmployeeText}
                            onChange={(e) => onSearchEmployeeTextChange(e.target.value)}
                            className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-xl focus:bg-white focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-500 transition outline-none"
                        />
                        {searchEmployeeText && (
                            <button
                                type="button"
                                onClick={() => onSearchEmployeeTextChange('')}
                                aria-label="Xóa từ khóa tìm kiếm"
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-0.5 rounded"
                            >
                                <X className="w-3 h-3" aria-hidden="true" />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => onFilterEmployeeModeChange('ALL')}
                            className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                                filterEmployeeMode === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Tất cả
                        </button>
                        <button
                            type="button"
                            onClick={() => onFilterEmployeeModeChange('ALL_PASS')}
                            className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                                filterEmployeeMode === 'ALL_PASS' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Đạt 100% tất cả các NH được chọn"
                        >
                            Đạt Trọn Vẹn
                        </button>
                        <button
                            type="button"
                            onClick={() => onFilterEmployeeModeChange('NOT_ACHIEVED')}
                            className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                                filterEmployeeMode === 'NOT_ACHIEVED' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Chưa đạt hết các NH"
                        >
                            Chưa Đạt Hết
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <span className="text-[11px] font-bold text-slate-600">Hiển thị:</span>
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold text-slate-600">
                        <button
                            type="button"
                            onClick={() => onTableViewModeChange('FULL')}
                            className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                                tableViewMode === 'FULL' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                            }`}
                        >
                            Đầy đủ
                        </button>
                        <button
                            type="button"
                            onClick={() => onTableViewModeChange('FORECAST_ONLY')}
                            className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                                tableViewMode === 'FORECAST_ONLY' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                            }`}
                        >
                            Chỉ %DK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
