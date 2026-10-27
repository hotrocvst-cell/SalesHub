import React, { useMemo } from 'react';
import {
    Filter,
    Store,
    CheckCircle2,
    SlidersHorizontal,
    ArrowRight,
    ArrowLeft,
    Sparkles,
    AlertCircle,
    Info,
    Building2,
    Tag,
    Trash2,
    RotateCcw,
    X,
    UserX,
    Ban
} from 'lucide-react';
import type { InventoryRawRecord } from '../types';
import { normalizeSearchStr } from '../utils/inventoryExcelHelper';

interface SourceSupplyStepProps {
    targetStore: string;
    rawRecords: InventoryRawRecord[];
    sourceStoreFilter: string;
    onSourceStoreFilterChange: (filter: string) => void;
    minSourceQty: number;
    onMinSourceQtyChange: (qty: number) => void;
    requestPercent?: number;
    onRequestPercentChange?: (pct: number) => void;
    excludedStores: string[];
    onToggleExcludeStore: (storeName: string) => void;
    onResetExcludedStores: () => void;
    onPrevStep: () => void;
    onNextStep: () => void;
}

export default function SourceSupplyStep({
    targetStore,
    rawRecords,
    sourceStoreFilter,
    onSourceStoreFilterChange,
    minSourceQty,
    onMinSourceQtyChange,
    requestPercent = 30,
    onRequestPercentChange,
    excludedStores = [],
    onToggleExcludeStore,
    onResetExcludedStores,
    onPrevStep,
    onNextStep
}: SourceSupplyStepProps) {
    // 1. Danh sách tất cả các siêu thị khác (trừ siêu thị đang phụ trách)
    const allOtherStores = useMemo(() => {
        const set = new Set<string>();
        rawRecords.forEach(r => {
            if (r.store_name && r.store_name !== targetStore) {
                set.add(r.store_name);
            }
        });
        return Array.from(set).sort();
    }, [rawRecords, targetStore]);

    // 2. Trích xuất các tag mã khu vực thường gặp từ tên siêu thị (ví dụ: XMO, LDI, PMY, CDU, BRI, VTA, ĐMSU, ĐMM...)
    const suggestedTags = useMemo(() => {
        const tagSet = new Set<string>();
        allOtherStores.forEach(st => {
            const parts = st.split(/[-_]/).map(p => p.trim());
            parts.forEach(p => {
                if (p.length >= 3 && p.length <= 6 && !/^\d+$/.test(p)) {
                    tagSet.add(p);
                }
            });
        });
        return Array.from(tagSet).slice(0, 15);
    }, [allOtherStores]);

    // 3. Phân tách bộ lọc thành mảng các từ khóa
    const filterTokens = useMemo(() => {
        return sourceStoreFilter
            .split(/[,;\s]+/)
            .map(t => normalizeSearchStr(t))
            .filter(t => t.length > 0);
    }, [sourceStoreFilter]);

    // 4. Lọc danh sách siêu thị nguồn thỏa điều kiện lọc text
    const matchingStores = useMemo(() => {
        if (filterTokens.length === 0) {
            return allOtherStores;
        }
        return allOtherStores.filter(st => {
            const normStore = normalizeSearchStr(st);
            return filterTokens.some(token => normStore.includes(token));
        });
    }, [allOtherStores, filterTokens]);

    // 5. Phân chia siêu thị còn hiệu lực (chưa bị xóa) vs siêu thị đã bị xóa/loại trừ
    const activeMatchingStores = useMemo(() => {
        return matchingStores.filter(st => !excludedStores.includes(st));
    }, [matchingStores, excludedStores]);

    const excludedInMatching = useMemo(() => {
        return matchingStores.filter(st => excludedStores.includes(st));
    }, [matchingStores, excludedStores]);

    // 6. Thống kê tổng số lượng sản phẩm có tồn >= minSourceQty tại các siêu thị nguồn CÒN HIỆU LỰC
    const sourceStats = useMemo(() => {
        const activeSet = new Set(activeMatchingStores);
        let itemsCount = 0;
        let totalQty = 0;

        rawRecords.forEach(r => {
            if (activeSet.has(r.store_name) && r.available_qty >= minSourceQty) {
                itemsCount++;
                totalQty += r.available_qty;
            }
        });

        return { itemsCount, totalQty };
    }, [rawRecords, activeMatchingStores, minSourceQty]);

    // Xử lý click tag gợi ý
    const handleToggleTag = (tag: string) => {
        const currentTokens = sourceStoreFilter.split(/[,;\s]+/).map(t => t.trim()).filter(Boolean);
        const exists = currentTokens.some(t => t.toLowerCase() === tag.toLowerCase());
        let newFilter = '';
        if (exists) {
            newFilter = currentTokens.filter(t => t.toLowerCase() !== tag.toLowerCase()).join(', ');
        } else {
            newFilter = currentTokens.length > 0 ? `${sourceStoreFilter}, ${tag}` : tag;
        }
        onSourceStoreFilterChange(newFilter);
    };

    return (
        <div className="space-y-4">
            {/* THẺ TỔNG QUAN KPI BƯỚC 2 */}
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200 rounded-xl p-3 sm:p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider">
                                Bước 2 / 3
                            </span>
                            <h2 className="text-sm sm:text-base font-extrabold text-slate-800">
                                Lọc Siêu Thị Nguồn Có Tồn Khả Dụng (≥ {minSourceQty})
                            </h2>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                            Lọc chỉ lấy dữ liệu Số lượng có thể bán ≥ {minSourceQty} (đã loại trừ siêu thị <span className="font-bold text-slate-800">{targetStore}</span>)
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onPrevStep}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Về Bước 1</span>
                        </button>

                        <button
                            type="button"
                            onClick={onNextStep}
                            disabled={activeMatchingStores.length === 0}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                        >
                            <span>Xem Gợi Ý Xin Hàng</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* KPI CHỈ SỐ NHANH BƯỚC 2 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-emerald-100">
                    <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Khớp bộ lọc</div>
                        <div className="text-lg font-black text-slate-800">{matchingStores.length} <span className="text-xs font-normal text-slate-500">ST</span></div>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <div className="text-[10px] uppercase font-bold text-emerald-600">Được chọn xin</div>
                        <div className="text-lg font-black text-emerald-700">{activeMatchingStores.length} <span className="text-xs font-normal text-slate-500">ST</span></div>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <div className="text-[10px] uppercase font-bold text-teal-600">Mặt hàng có sẵn (≥{minSourceQty})</div>
                        <div className="text-lg font-black text-teal-700">{sourceStats.itemsCount.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">dòng</span></div>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <div className="text-[10px] uppercase font-bold text-rose-600">Đã xóa bớt</div>
                        <div className="text-lg font-black text-rose-700">{excludedInMatching.length} <span className="text-xs font-normal text-slate-500">ST</span></div>
                    </div>
                </div>
            </div>

            {/* BỘ LỌC ĐIỀU KIỆN SIÊU THỊ NGUỒN */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* NGƯỠNG TỒN TỐI THIỂU CỦA SIÊU THỊ NGUỒN */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Ngưỡng tồn tối thiểu kho nguồn:
                        </label>
                        <select
                            value={minSourceQty}
                            onChange={(e) => onMinSourceQtyChange(Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value={1}>≥ 1 máy (Có hàng là xin)</option>
                            <option value={2}>≥ 2 máy (Chuẩn: Để lại 1 cho bạn bán)</option>
                            <option value={3}>≥ 3 máy (Chỉ xin siêu thị có dư nhiều)</option>
                            <option value={4}>≥ 4 máy</option>
                            <option value={5}>≥ 5 máy</option>
                        </select>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                            * Chuẩn là ≥ 2 máy để ST đối tác còn hàng bán.
                        </span>
                    </div>

                    {/* TỶ LỆ % SỐ LƯỢNG CẦN XIN THEO TỒN KHO NGUỒN */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-slate-700">
                                % Số lượng cần xin theo tồn:
                            </label>
                            <span className="text-xs font-black text-emerald-700 font-mono bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                {requestPercent}%
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <select
                                value={requestPercent}
                                onChange={(e) => onRequestPercentChange?.(Number(e.target.value))}
                                className="w-full px-3 py-2 text-xs font-bold text-emerald-800 rounded-lg border border-emerald-300 bg-emerald-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value={10}>10% tồn kho</option>
                                <option value={20}>20% tồn kho</option>
                                <option value={30}>30% tồn kho (Mặc định)</option>
                                <option value={40}>40% tồn kho</option>
                                <option value={50}>50% tồn kho</option>
                                <option value={60}>60% tồn kho</option>
                                <option value={70}>70% tồn kho</option>
                                <option value={80}>80% tồn kho</option>
                                <option value={100}>100% tồn khả dụng</option>
                            </select>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                            * Ví dụ: Kho đối tác tồn 10 máy → xin 3 máy (30%).
                        </span>
                    </div>

                    {/* Ô NHẬP ĐIỀU KIỆN TÊN SIÊU THỊ (ABC, XYA, 123...) */}
                    <div className="sm:col-span-2 lg:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Lọc tên siêu thị chứa điều kiện (ABC, XYA, 123...):
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={sourceStoreFilter}
                                onChange={(e) => onSourceStoreFilterChange(e.target.value)}
                                placeholder="Nhập từ khóa, ví dụ: XMO, BRV, Vũng Tàu, 8957..."
                                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                            />
                            {sourceStoreFilter && (
                                <button
                                    type="button"
                                    onClick={() => onSourceStoreFilterChange('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 font-bold"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                            * Hỗ trợ tìm theo mã siêu thị, huyện/tỉnh, đường. Để trống để lấy toàn bộ.
                        </span>
                    </div>
                </div>

                {/* GỢI Ý CHIP TỪ KHÓA NHANH */}
                {suggestedTags.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                            <Tag className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Gợi ý từ khóa khu vực tìm thấy:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {suggestedTags.map(tag => {
                                const isSelected = filterTokens.includes(normalizeSearchStr(tag));
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => handleToggleTag(tag)}
                                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                                            isSelected
                                                ? 'bg-emerald-600 text-white border-emerald-700 font-bold'
                                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                        }`}
                                    >
                                        +{tag}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* DANH SÁCH CÁC SIÊU THỊ NGUỒN KHỚP ĐIỀU KIỆN (CÓ NÚT XÓA BỚT) */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                            Danh sách siêu thị nguồn sẵn sàng xin hàng ({activeMatchingStores.length})
                        </h3>
                    </div>
                    <span className="text-[11px] text-slate-500">
                        Bạn có thể bấm nút <b className="text-rose-600">"Xóa bớt"</b> ở từng dòng để loại bỏ siêu thị không muốn qua xin
                    </span>
                </div>

                {/* DANH SÁCH SIÊU THỊ ĐANG CHỌN */}
                <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {activeMatchingStores.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                            {matchingStores.length === 0
                                ? `Không có siêu thị nào khớp với điều kiện lọc "${sourceStoreFilter}". Vui lòng thử từ khóa khác.`
                                : `Bạn đã xóa hết tất cả ${matchingStores.length} siêu thị khớp bộ lọc. Bấm "Khôi phục lại" bên dưới để sử dụng lại.`
                            }
                        </div>
                    ) : (
                        activeMatchingStores.map((st, idx) => (
                            <div key={st} className="p-2 sm:px-3 flex items-center justify-between hover:bg-emerald-50/40 transition-colors text-xs gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-6 text-center text-[11px] text-slate-400 font-mono shrink-0">
                                        {idx + 1}
                                    </span>
                                    <span className="font-semibold text-slate-800 truncate" title={st}>
                                        {st}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="hidden sm:inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        Sẵn sàng đối chiếu
                                    </span>
                                    {/* Nút xóa bớt siêu thị */}
                                    <button
                                        type="button"
                                        onClick={() => onToggleExcludeStore(st)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
                                        title="Xóa siêu thị này khỏi danh sách xin hàng"
                                    >
                                        <Trash2 className="w-3 h-3 text-rose-600" />
                                        <span>Xóa bớt</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* KHỐI HIỂN THỊ CÁC SIÊU THỊ ĐÃ BỊ XÓA BỚT (CHO PHÉP KHÔI PHỤC) */}
                {excludedInMatching.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 bg-amber-50/50 rounded-lg p-2.5 border border-amber-200">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                <Ban className="w-3.5 h-3.5 text-amber-700" />
                                <span>Đã xóa bớt ({excludedInMatching.length} siêu thị không xin hàng):</span>
                            </span>
                            <button
                                type="button"
                                onClick={onResetExcludedStores}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span>Khôi phục tất cả</span>
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {excludedInMatching.map(st => (
                                <div
                                    key={st}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white text-slate-600 border border-amber-200 text-xs shadow-2xs"
                                >
                                    <span className="line-through text-slate-400 truncate max-w-[220px]" title={st}>
                                        {st}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => onToggleExcludeStore(st)}
                                        className="text-emerald-700 hover:text-emerald-900 font-bold hover:bg-emerald-50 rounded px-1 cursor-pointer"
                                        title="Khôi phục siêu thị này"
                                    >
                                        + Khôi phục
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
