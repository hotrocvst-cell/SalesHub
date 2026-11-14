import React from 'react';
import type { QuarterPreset, QuarterlyTab, FilterCategory } from '../types';
import type { StoreItem } from '../../../core/lib/storage';
import {
    Store,
    Calendar,
    Search,
    RefreshCw,
    Camera,
    Download,
    Trophy,
    TrendingUp,
    Filter
} from 'lucide-react';

interface Props {
    stores: StoreItem[];
    selectedStore: string;
    onSelectStore: (store: string) => void;
    isLockedToSingleStore: boolean;
    allowedStores: StoreItem[];
    canViewAllStores: boolean;

    selectedYear: number;
    onSelectYear: (year: number) => void;

    preset: QuarterPreset;
    onSelectPreset: (preset: QuarterPreset) => void;
    presetLabel: string;

    customStartMonth: number;
    onChangeCustomStart: (m: number) => void;
    customEndMonth: number;
    onChangeCustomEnd: (m: number) => void;

    tab: QuarterlyTab;
    onSelectTab: (tab: QuarterlyTab) => void;

    searchQuery: string;
    onSearchChange: (q: string) => void;

    filterCategory: FilterCategory;
    onSelectFilterCategory: (cat: FilterCategory) => void;

    onRefresh: () => void;
    onExportImage: () => void;
    onExportExcel?: () => void;
    canExportExcel: boolean;
    isExportingImage: boolean;
    loading: boolean;
}

const PRESETS: Array<{ id: QuarterPreset; label: string }> = [
    { id: 'Q1', label: 'Quý 1 (T1-T3)' },
    { id: 'Q2', label: 'Quý 2 (T4-T6)' },
    { id: 'Q3', label: 'Quý 3 (T7-T9)' },
    { id: 'Q4', label: 'Quý 4 (T10-T12)' },
    { id: 'H1', label: '6T Đầu' },
    { id: 'H2', label: '6T Cuối' },
    { id: 'YEAR', label: 'Cả năm' },
    { id: 'CUSTOM', label: 'Tùy chọn' },
];

export default function QuarterlyFilterBar({
    stores,
    selectedStore,
    onSelectStore,
    isLockedToSingleStore,
    allowedStores,
    canViewAllStores,
    selectedYear,
    onSelectYear,
    preset,
    onSelectPreset,
    presetLabel,
    customStartMonth,
    onChangeCustomStart,
    customEndMonth,
    onChangeCustomEnd,
    tab,
    onSelectTab,
    searchQuery,
    onSearchChange,
    filterCategory,
    onSelectFilterCategory,
    onRefresh,
    onExportImage,
    onExportExcel,
    canExportExcel,
    isExportingImage,
    loading
}: Props) {
    const storeListToRender = isLockedToSingleStore ? allowedStores : stores;

    return (
        <div
            data-html2canvas-ignore="true"
            data-export-ignore="true"
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-3"
        >
            {/* DÒNG 1 (RULE 10): BỘ LỌC ST / CỤM RIÊNG LẺ DÒNG ĐẦU TIÊN KÈM CÁC NÚT THAO TÁC */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <label htmlFor="quarterly-store-filter" className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                            Phạm vi ST / Cụm
                        </label>
                        <select
                            id="quarterly-store-filter"
                            value={selectedStore}
                            onChange={e => onSelectStore(e.target.value)}
                            disabled={isLockedToSingleStore}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                        >
                            {canViewAllStores && (
                                <option value="all">🌟 Toàn cụm / Tất cả ST</option>
                            )}
                            {storeListToRender.map(s => (
                                <option key={s.id || s.name} value={s.name}>
                                    🏪 {s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Các nút hành động */}
                <div className="flex items-center justify-end gap-1.5 shrink-0 pt-1 sm:pt-0">
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        title="Tải lại dữ liệu mới nhất"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} aria-hidden="true" />
                        <span className="hidden sm:inline">Làm mới</span>
                    </button>

                    <button
                        onClick={onExportImage}
                        disabled={isExportingImage || loading}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                        title="Xuất ảnh báo cáo gửi Messaging App (Chuẩn dọc Mobile, không footer watermark)"
                    >
                        <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{isExportingImage ? 'Đang tạo ảnh...' : 'Xuất ảnh'}</span>
                    </button>

                    {canExportExcel && onExportExcel && (
                        <button
                            onClick={onExportExcel}
                            disabled={loading}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                            title="Xuất file Excel số liệu xếp hạng Quý"
                        >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">Xuất Excel</span>
                        </button>
                    )}
                </div>
            </div>

            {/* DÒNG 2: NĂM & CÁC PRESET KỲ / QUÝ ĐÁNH GIÁ */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span className="text-[11px] font-bold text-slate-500">Năm:</span>
                    <select
                        value={selectedYear}
                        onChange={e => onSelectYear(Number(e.target.value))}
                        className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                    >
                        {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                {/* Preset Chips */}
                <div className="flex items-center gap-1 flex-wrap flex-1">
                    {PRESETS.map(p => {
                        const active = preset === p.id;
                        return (
                            <button
                                key={p.id}
                                onClick={() => onSelectPreset(p.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                    active
                                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-200'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                            >
                                {p.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tùy chọn tháng khi chọn CUSTOM */}
                {preset === 'CUSTOM' && (
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 text-xs">
                        <span className="font-bold text-amber-800">Từ T:</span>
                        <select
                            value={customStartMonth}
                            onChange={e => onChangeCustomStart(Number(e.target.value))}
                            className="bg-white border border-amber-300 rounded px-1.5 py-0.5 text-xs font-bold text-amber-900 focus:outline-none"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                        <span className="font-bold text-amber-800">Đến T:</span>
                        <select
                            value={customEndMonth}
                            onChange={e => onChangeCustomEnd(Number(e.target.value))}
                            className="bg-white border border-amber-300 rounded px-1.5 py-0.5 text-xs font-bold text-amber-900 focus:outline-none"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m} disabled={m < customStartMonth}>Tháng {m}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* DÒNG 3: TAB DOANH THU / THI ĐUA + Ô TÌM KIẾM + LỌC TOP/BOT */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                {/* Switch Tab */}
                <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
                    <button
                        onClick={() => onSelectTab('REVENUE')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            tab === 'REVENUE'
                                ? 'bg-white text-blue-800 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                        <span>📊 Xếp Hạng Doanh Thu</span>
                    </button>
                    <button
                        onClick={() => onSelectTab('EMULATION')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            tab === 'EMULATION'
                                ? 'bg-white text-amber-800 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Trophy className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                        <span>🏆 Xếp Hạng Thi Đua</span>
                    </button>
                </div>

                {/* Tìm kiếm & Phân loại nhanh */}
                <div className="flex items-center gap-2 flex-1 max-w-md sm:justify-end">
                    <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => onSearchChange(e.target.value)}
                            placeholder="Tìm nhân viên, mã NV..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        />
                    </div>

                    <select
                        value={filterCategory}
                        onChange={e => onSelectFilterCategory(e.target.value as FilterCategory)}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shrink-0"
                    >
                        <option value="ALL">Tất cả nhân sự</option>
                        <option value="TOP">Top 20% Xuất sắc</option>
                        <option value="BOT">Cần tăng tốc (Bot)</option>
                        <option value="ACHIEVED">Đạt 100% Target</option>
                        <option value="UNACHIEVED">Chưa đạt Target</option>
                    </select>
                </div>
            </div>
        </div>
    );
}

