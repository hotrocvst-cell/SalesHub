import React from 'react';
import { Store, Calendar, RefreshCw, Layers, CheckSquare, Square } from 'lucide-react';
import type { StoreItem } from '../../../core/lib/storage';
import { getShortStoreName } from '../../../core/lib/formatters';

interface Props {
    stores: StoreItem[];
    selectedStore: string;
    onSelectStore: (store: string) => void;
    selectedDate: string;
    onSelectDate: (date: string) => void;
    selectedMonth: number;
    onSelectMonth: (month: number) => void;
    selectedYear: number;
    onSelectYear: (year: number) => void;
    checkedCount: number;
    totalCount: number;
    onToggleSelectAll: () => void;
    onBatchExport: () => void;
    isExporting: boolean;
    onRefresh: () => void;
    loading: boolean;
}

export default function BatchExportFilterBar({
    stores,
    selectedStore,
    onSelectStore,
    selectedDate,
    onSelectDate,
    selectedMonth,
    onSelectMonth,
    selectedYear,
    onSelectYear,
    checkedCount,
    totalCount,
    onToggleSelectAll,
    onBatchExport,
    isExporting,
    onRefresh,
    loading
}: Props) {
    const isAllChecked = checkedCount === totalCount && totalCount > 0;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 font-sans">
            {/* DÒNG 1 (RULE 10): BỘ LỌC ST ĐỘC LẬP + NÚT 1-CLICK HERO ACTION */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
                        <Store className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                        <label htmlFor="store-select" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                            Chọn ST Báo Cáo
                        </label>
                        <select
                            id="store-select"
                            value={selectedStore}
                            onChange={e => onSelectStore(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                        >
                            <option value="">-- Chọn một ST để xuất báo cáo --</option>
                            {stores.map(s => {
                                const sName = s.name || s.short_name || '';
                                return (
                                    <option key={s.id || s.code || sName} value={sName}>
                                        ST {getShortStoreName(sName)} {s.code ? `(${s.code})` : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>

                {/* Hero Button: 1-Click Xuất Hàng Loạt */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onBatchExport}
                        disabled={isExporting || checkedCount === 0 || !selectedStore}
                        className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white shadow-md transition cursor-pointer ${
                            isExporting || checkedCount === 0 || !selectedStore
                                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 active:scale-95 shadow-blue-200'
                        }`}
                        title={!selectedStore ? 'Vui lòng chọn một ST trước khi xuất' : 'Xuất toàn bộ báo cáo đã chọn'}
                    >
                        <Layers className={`w-4 h-4 ${isExporting ? 'animate-pulse' : ''}`} aria-hidden="true" />
                        <span>1-Click Xuất Báo Cáo</span>
                        {checkedCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-black">
                                {checkedCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* DÒNG 2: BỘ LỌC THỜI GIAN (NGÀY, THÁNG, NĂM) + SELECT ALL + LÀM MỚI */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Chọn ngày */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                        <span className="text-xs font-bold text-slate-600">Ngày:</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => onSelectDate(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                        />
                    </div>

                    {/* Chọn tháng */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                        <span className="text-xs font-bold text-slate-600">Tháng:</span>
                        <select
                            value={selectedMonth}
                            onChange={e => onSelectMonth(Number(e.target.value))}
                            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                    </div>

                    {/* Chọn năm */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                        <span className="text-xs font-bold text-slate-600">Năm:</span>
                        <select
                            value={selectedYear}
                            onChange={e => onSelectYear(Number(e.target.value))}
                            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                        >
                            {[2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Tiện ích chọn nhanh và nút Làm mới */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onToggleSelectAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                        title={isAllChecked ? 'Bỏ chọn toàn bộ' : 'Chọn toàn bộ 5 báo cáo'}
                    >
                        {isAllChecked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                        ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        )}
                        <span>{isAllChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loading}
                        className="p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition cursor-pointer"
                        title="Tải lại dữ liệu"
                        aria-label="Tải lại dữ liệu"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} aria-hidden="true" />
                    </button>
                </div>
            </div>
        </div>
    );
}
