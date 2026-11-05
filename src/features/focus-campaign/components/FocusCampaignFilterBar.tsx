import React from 'react';
import {
    RefreshCw,
    SlidersHorizontal,
    Camera,
    FileSpreadsheet,
    MessageSquare,
    Search
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
    onExportExcel?: () => void;
    isRefreshing: boolean;
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
    onExportExcel,
    isRefreshing
}: Props) {
    const { canExportExcel } = useExcelExportPermission('/thi-dua-trong-tam');

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3 font-sans">
            {/* DÒNG 1: BỘ LỌC ST / CỤM RIÊNG BIỆT (QUY CHUẨN 10 & PHÂN QUYỀN ST) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-wider shrink-0">
                        Đơn Vị / ST:
                    </span>
                    <select
                        value={selectedStore}
                        onChange={(e) => onSelectStore(e.target.value)}
                        className="w-full sm:w-64 bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition cursor-pointer"
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
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition cursor-pointer disabled:opacity-50"
                        title="Làm mới dữ liệu"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                        <span className="hidden sm:inline">Làm mới</span>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenWatchlistModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 active:scale-95 transition cursor-pointer"
                        title="Quản lý danh sách thi đua trọng tâm"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Danh Sách</span>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenRemarkModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 active:scale-95 transition cursor-pointer"
                        title="Xem nhận xét và đánh giá nhân sự X/total NH"
                    >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đánh Giá NV</span>
                    </button>

                    <button
                        type="button"
                        onClick={onExportImage}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs active:scale-95 transition cursor-pointer"
                        title="Xuất ảnh báo cáo gửi Messaging App"
                    >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Xuất Ảnh</span>
                    </button>

                    {canExportExcel && onExportExcel && (
                        <button
                            type="button"
                            onClick={onExportExcel}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 active:scale-95 transition cursor-pointer"
                            title="Xuất file Excel"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="hidden sm:inline">Excel</span>
                        </button>
                    )}
                </div>
            </div>

            {/* DÒNG 2: BỘ LỌC KỲ THỜI GIAN, DANH SÁCH THEO DÕI & TÙY CHỌN NHÓM HÀNG */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-500 shrink-0">Kỳ:</span>
                    <select
                        value={selectedMonth}
                        onChange={(e) => onSelectMonth(Number(e.target.value))}
                        className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-hidden"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>Tháng {m}</option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={(e) => onSelectYear(Number(e.target.value))}
                        className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-hidden"
                    >
                        {[2025, 2026, 2027].map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                {sessions.length > 1 && (
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-500 shrink-0">Phiên:</span>
                        <select
                            value={selectedSessionId}
                            onChange={(e) => onSelectSessionId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-hidden truncate"
                        >
                            {sessions.map((sess) => (
                                <option key={sess.id} value={sess.id}>
                                    {sess.session_title || sess.report_date} ({sess.employee_count} NV)
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-500 shrink-0">Bộ Trọng Tâm:</span>
                    <select
                        value={activeWatchlistId}
                        onChange={(e) => onSelectWatchlist(e.target.value)}
                        className="w-full bg-indigo-50/60 border border-indigo-200 text-indigo-900 text-xs font-black rounded-xl px-2.5 py-1.5 outline-hidden focus:ring-2 focus:ring-indigo-400"
                    >
                        {watchlists.map((w) => (
                            <option key={w.id} value={w.id}>
                                🎯 {w.list_name} ({w.campaign_keys?.length || 0} NH)
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
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Tìm nhân viên (mã, tên)..."
                            value={searchEmployeeText}
                            onChange={(e) => onSearchEmployeeTextChange(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition outline-hidden"
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
                        <button
                            type="button"
                            onClick={() => onFilterEmployeeModeChange('ALL')}
                            className={`px-2 py-1 rounded-lg transition ${
                                filterEmployeeMode === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Tất cả
                        </button>
                        <button
                            type="button"
                            onClick={() => onFilterEmployeeModeChange('ALL_PASS')}
                            className={`px-2 py-1 rounded-lg transition ${
                                filterEmployeeMode === 'ALL_PASS' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Đạt 100% tất cả các NH được chọn"
                        >
                            Đạt Trọn Vẹn
                        </button>
                        <button
                            type="button"
                            onClick={() => onFilterEmployeeModeChange('NOT_ACHIEVED')}
                            className={`px-2 py-1 rounded-lg transition ${
                                filterEmployeeMode === 'NOT_ACHIEVED' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Chưa đạt hết các NH"
                        >
                            Chưa Đạt Hết
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <span className="text-[11px] font-bold text-slate-400">Hiển thị:</span>
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold text-slate-600">
                        <button
                            type="button"
                            onClick={() => onTableViewModeChange('FULL')}
                            className={`px-2 py-1 rounded-lg transition ${
                                tableViewMode === 'FULL' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                            }`}
                        >
                            Đầy đủ
                        </button>
                        <button
                            type="button"
                            onClick={() => onTableViewModeChange('FORECAST_ONLY')}
                            className={`px-2 py-1 rounded-lg transition ${
                                tableViewMode === 'FORECAST_ONLY' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
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
