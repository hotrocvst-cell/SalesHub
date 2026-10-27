import React, { useState, useMemo, useEffect } from 'react';
import {
    Search,
    Filter,
    CheckSquare,
    Square,
    Save,
    ArrowRight,
    Tag,
    Layers,
    SlidersHorizontal,
    Sparkles,
    AlertTriangle,
    Plus,
    Minus,
    ChevronDown,
    ChevronUp,
    Check,
    X,
    Flame
} from 'lucide-react';
import type { ShortageProductItem, ProductSalesVelocity } from '../types';
import { getProductSalesVelocity } from '../utils/inventoryExcelHelper';

interface ShortageSelectionStepProps {
    targetStore: string;
    items: ShortageProductItem[];
    selectedCategories: string[];
    onSelectedCategoriesChange: (categories: string[]) => void;
    selectedSubCategories: string[];
    onSelectedSubCategoriesChange: (subCategories: string[]) => void;
    excludeKeywords?: string;
    onExcludeKeywordsChange?: (keywords: string) => void;
    onToggleSelect: (id: string) => void;
    onSelectAll: (select: boolean) => void;
    onUpdateQuantity: (id: string, qty: number) => void;
    onSaveConfig: () => void;
    onNextStep: () => void;
    isSaving?: boolean;
    salesVelocityMap?: Record<string, ProductSalesVelocity>;
}

const SUGGESTED_EXCLUDE_CHIPS = ['Apple', 'iPhone', 'iPad', 'MacBook', 'AirPods', 'Apple Watch', 'Samsung', 'Oppo', 'Xiaomi', 'Nubia', 'Tecno'];

export default function ShortageSelectionStep({
    targetStore,
    items,
    selectedCategories,
    onSelectedCategoriesChange,
    selectedSubCategories,
    onSelectedSubCategoriesChange,
    excludeKeywords = '',
    onExcludeKeywordsChange,
    onToggleSelect,
    onSelectAll,
    onUpdateQuantity,
    onSaveConfig,
    onNextStep,
    isSaving = false,
    salesVelocityMap
}: ShortageSelectionStepProps) {
    // Bộ lọc nội bộ
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
    const [filterOnlyHasSales, setFilterOnlyHasSales] = useState<boolean>(false);
    const [showCheckboxFilter, setShowCheckboxFilter] = useState<boolean>(true);

    // Danh sách ngành hàng và số lượng mã mỗi ngành
    const categoryStats = useMemo(() => {
        const map = new Map<string, number>();
        items.forEach(i => {
            const cat = i.category || 'Khác';
            map.set(cat, (map.get(cat) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [items]);

    const allCategoryNames = useMemo(() => categoryStats.map(c => c.name), [categoryStats]);

    // Danh sách nhóm hàng tương ứng với ngành hàng đã chọn
    const subCategoryStats = useMemo(() => {
        const map = new Map<string, number>();
        items.forEach(i => {
            const cat = i.category || 'Khác';
            // Chỉ hiển thị nhóm hàng nếu ngành hàng của nó đang được chọn
            if (selectedCategories.includes(cat)) {
                const sub = i.sub_category || 'Khác';
                map.set(sub, (map.get(sub) || 0) + 1);
            }
        });
        return Array.from(map.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [items, selectedCategories]);

    const allSubCategoryNames = useMemo(() => subCategoryStats.map(s => s.name), [subCategoryStats]);

    const statuses = useMemo(() => {
        const set = new Set<string>();
        items.forEach(i => { if (i.product_status) set.add(i.product_status); });
        return Array.from(set).sort();
    }, [items]);

    // Toggle ngành hàng
    const handleToggleCategory = (catName: string) => {
        if (selectedCategories.includes(catName)) {
            onSelectedCategoriesChange(selectedCategories.filter(c => c !== catName));
        } else {
            onSelectedCategoriesChange([...selectedCategories, catName]);
        }
    };

    const handleSelectAllCategories = (select: boolean) => {
        onSelectedCategoriesChange(select ? allCategoryNames : []);
    };

    // Toggle nhóm hàng
    const handleToggleSubCategory = (subName: string) => {
        if (selectedSubCategories.includes(subName)) {
            onSelectedSubCategoriesChange(selectedSubCategories.filter(s => s !== subName));
        } else {
            onSelectedSubCategoriesChange([...selectedSubCategories, subName]);
        }
    };

    const handleSelectAllSubCategories = (select: boolean) => {
        onSelectedSubCategoriesChange(select ? allSubCategoryNames : []);
    };

    // Danh sách các từ khóa loại trừ đang hoạt động
    const activeExcludeTokens = useMemo(() => {
        return (excludeKeywords || '')
            .split(/[,;]+/)
            .map(t => t.trim().toLowerCase())
            .filter(Boolean);
    }, [excludeKeywords]);

    // Thao tác click chọn nhanh từ khóa gợi ý
    const handleToggleSuggestionChip = (chipText: string) => {
        const currentTokens = (excludeKeywords || '')
            .split(/[,;]+/)
            .map(t => t.trim())
            .filter(Boolean);
        const lowerChip = chipText.toLowerCase();
        const exists = currentTokens.some(t => t.toLowerCase() === lowerChip);
        let nextTokens: string[];
        if (exists) {
            nextTokens = currentTokens.filter(t => t.toLowerCase() !== lowerChip);
        } else {
            nextTokens = [...currentTokens, chipText];
        }
        onExcludeKeywordsChange?.(nextTokens.join(', '));
    };

    // Số lượng sản phẩm bị loại trừ bởi từ khóa
    const excludedByKeywordsCount = useMemo(() => {
        if (activeExcludeTokens.length === 0) return 0;
        return items.filter(item => {
            const nameLower = (item.product_name || '').toLowerCase();
            const codeLower = (item.product_code || '').toLowerCase();
            return activeExcludeTokens.some(token => nameLower.includes(token) || codeLower.includes(token));
        }).length;
    }, [items, activeExcludeTokens]);

    // Dữ liệu sau lọc
    const filteredItems = useMemo(() => {
        const kw = searchKeyword.toLowerCase().trim();
        return items.filter(item => {
            const cat = item.category || 'Khác';
            const sub = item.sub_category || 'Khác';

            // Chỉ hiển thị sản phẩm thuộc ngành hàng & nhóm hàng đang được chọn
            if (!selectedCategories.includes(cat)) return false;
            if (!selectedSubCategories.includes(sub)) return false;

            // Loại trừ sản phẩm nếu khớp từ khóa loại trừ
            if (activeExcludeTokens.length > 0) {
                const nameLower = (item.product_name || '').toLowerCase();
                const codeLower = (item.product_code || '').toLowerCase();
                const isExcluded = activeExcludeTokens.some(token =>
                    nameLower.includes(token) || codeLower.includes(token)
                );
                if (isExcluded) return false;
            }

            // Lọc theo trạng thái
            if (selectedStatus !== 'ALL' && item.product_status !== selectedStatus) {
                return false;
            }

            // Lọc chỉ mã có sức bán (> 0)
            if (filterOnlyHasSales && salesVelocityMap) {
                const vel = getProductSalesVelocity(salesVelocityMap, item.product_code);
                if (!vel || vel.sales_qty <= 0) return false;
            }

            // Lọc theo từ khóa tìm kiếm
            if (kw) {
                const matchCode = item.product_code.toLowerCase().includes(kw);
                const matchName = item.product_name.toLowerCase().includes(kw);
                if (!matchCode && !matchName) return false;
            }

            return true;
        });
    }, [items, searchKeyword, activeExcludeTokens, selectedCategories, selectedSubCategories, selectedStatus, filterOnlyHasSales, salesVelocityMap]);

    // Thống kê
    const selectedCount = useMemo(() => items.filter(i => i.isSelected).length, [items]);
    const totalRequestQty = useMemo(() => {
        return items.filter(i => i.isSelected).reduce((sum, i) => sum + (i.request_qty || 1), 0);
    }, [items]);

    const isAllFilteredSelected = useMemo(() => {
        if (filteredItems.length === 0) return false;
        return filteredItems.every(i => i.isSelected);
    }, [filteredItems]);

    const handleSelectAllFiltered = (checked: boolean) => {
        filteredItems.forEach(i => {
            if (i.isSelected !== checked) {
                onToggleSelect(i.id);
            }
        });
    };

    return (
        <div className="space-y-4">
            {/* THẺ TỔNG QUAN KPI BƯỚC 1 */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-200 rounded-xl p-3 sm:p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider">
                                Bước 1 / 3
                            </span>
                            <h2 className="text-sm sm:text-base font-extrabold text-slate-800">
                                Lọc Hàng Thiếu Tồn Kho (&lt; 1)
                            </h2>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                            Siêu thị: <span className="font-bold text-blue-800">{targetStore || 'Chưa chọn'}</span> • Cần bổ sung <b className="text-blue-700">{selectedCount}</b>/{items.length} mã ({selectedCategories.length} ngành, {selectedSubCategories.length} nhóm đang chọn)
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onSaveConfig}
                            disabled={isSaving || selectedCount === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                            title="Lưu danh sách hàng thiếu đã chọn lên hệ thống"
                        >
                            <Save className="w-4 h-4 text-emerald-600" />
                            <span>{isSaving ? 'Đang lưu...' : 'Lưu danh sách'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={onNextStep}
                            disabled={selectedCount === 0}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                        >
                            <span>Sang Bước 2</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* KPI CHỈ SỐ NHANH */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-blue-100">
                    <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Tổng mã thiếu</div>
                        <div className="text-lg font-black text-slate-800">{items.length} <span className="text-xs font-normal text-slate-500">mã</span></div>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                        <div className="text-[10px] uppercase font-bold text-blue-600">Cần bổ sung (Đã chọn)</div>
                        <div className="text-lg font-black text-blue-700">{selectedCount} <span className="text-xs font-normal text-slate-500">mã</span></div>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                        <div className="text-[10px] uppercase font-bold text-indigo-600">Tổng SL cần xin</div>
                        <div className="text-lg font-black text-indigo-700">{totalRequestQty} <span className="text-xs font-normal text-slate-500">máy</span></div>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                        <div className="text-[10px] uppercase font-bold text-emerald-600">Khớp bộ lọc</div>
                        <div className="text-lg font-black text-emerald-700">{filteredItems.length} <span className="text-xs font-normal text-slate-500">mã</span></div>
                    </div>
                </div>
            </div>

            {/* BỘ LỌC TÌM KIẾM NHANH, LOẠI TRỪ TỪ KHÓA & TRẠNG THÁI */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row gap-2 items-stretch lg:items-center justify-between">
                    <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2 w-full">
                        {/* Tìm kiếm */}
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                placeholder="Tìm theo tên hoặc mã sản phẩm..."
                                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            />
                            {searchKeyword && (
                                <button
                                    type="button"
                                    onClick={() => setSearchKeyword('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                    title="Xóa tìm kiếm"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Ô input loại trừ sản phẩm theo từ khóa (Apple, iPhone, iPad...) */}
                        <div className="relative flex-1">
                            <Filter className="w-4 h-4 text-rose-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={excludeKeywords}
                                onChange={(e) => onExcludeKeywordsChange?.(e.target.value)}
                                placeholder="Loại trừ từ khóa (Apple, iPhone, iPad...)"
                                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-rose-300 bg-rose-50/40 text-rose-900 placeholder:text-rose-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
                            />
                            {excludeKeywords && (
                                <button
                                    type="button"
                                    onClick={() => onExcludeKeywordsChange?.('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-rose-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                    title="Xóa từ khóa loại trừ"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Lọc Trạng thái */}
                        <div className="w-full sm:w-36 shrink-0">
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ALL">Tất cả trạng thái ({statuses.length})</option>
                                {statuses.map(st => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Nút bật/tắt bảng checkbox */}
                    <button
                        type="button"
                        onClick={() => setShowCheckboxFilter(!showCheckboxFilter)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition-colors cursor-pointer shrink-0"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                        <span>Bộ lọc Checkbox ({selectedCategories.length}/{allCategoryNames.length} ngành, {selectedSubCategories.length}/{allSubCategoryNames.length} nhóm)</span>
                        {showCheckboxFilter ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                </div>

                {/* HÀNG GỢI Ý CHỌN NHANH TỪ KHÓA LOẠI TRỪ */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 text-xs">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 shrink-0">
                        <Tag className="w-3 h-3 text-rose-500" />
                        <span>Gợi ý loại trừ nhanh:</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                        {SUGGESTED_EXCLUDE_CHIPS.map(chip => {
                            const isSelected = activeExcludeTokens.includes(chip.toLowerCase());
                            return (
                                <button
                                    key={chip}
                                    type="button"
                                    onClick={() => handleToggleSuggestionChip(chip)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${isSelected
                                            ? 'bg-rose-600 text-white shadow-2xs'
                                            : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 hover:border-rose-300'
                                        }`}
                                    title={isSelected ? `Bỏ loại trừ "${chip}"` : `Bấm để loại trừ nhanh các sản phẩm "${chip}"`}
                                >
                                    <span>{chip}</span>
                                    {isSelected ? <X className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5 opacity-60" />}
                                </button>
                            );
                        })}
                    </div>
                    {excludedByKeywordsCount > 0 && (
                        <span className="text-[11px] text-rose-700 bg-rose-100/80 border border-rose-200 px-2 py-0.5 rounded-md font-bold ml-auto shrink-0 flex items-center gap-1">
                            <span>Đã loại trừ <b>{excludedByKeywordsCount}</b> mã</span>
                            <button
                                type="button"
                                onClick={() => onExcludeKeywordsChange?.('')}
                                className="underline hover:text-rose-900 ml-1 cursor-pointer"
                                title="Bỏ tất cả loại trừ"
                            >
                                (Bỏ lọc)
                            </button>
                        </span>
                    )}
                </div>

                {/* BẢNG LỌC CHECKBOX LIST: NGÀNH HÀNG & NHÓM HÀNG */}
                {showCheckboxFilter && (
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* CỘT 1: CHECKBOX LIST NGÀNH HÀNG */}
                        <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Ngành Hàng ({selectedCategories.length}/{allCategoryNames.length})</span>
                                </span>
                                <div className="flex items-center gap-1 text-[11px]">
                                    <button
                                        type="button"
                                        onClick={() => handleSelectAllCategories(true)}
                                        className="text-blue-700 hover:underline font-semibold"
                                    >
                                        Tất cả
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                        type="button"
                                        onClick={() => handleSelectAllCategories(false)}
                                        className="text-slate-500 hover:text-rose-600"
                                    >
                                        Bỏ chọn
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                {categoryStats.map(cat => {
                                    const isChecked = selectedCategories.includes(cat.name);
                                    return (
                                        <label
                                            key={cat.name}
                                            className={`flex items-center justify-between p-1.5 rounded-md text-xs cursor-pointer select-none transition-colors ${isChecked ? 'bg-blue-50 text-blue-900 font-medium' : 'hover:bg-slate-100 text-slate-600'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => handleToggleCategory(cat.name)}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="truncate" title={cat.name}>{cat.name}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                                                {cat.count} mã
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* CỘT 2: CHECKBOX LIST NHÓM HÀNG */}
                        <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Nhóm Hàng ({selectedSubCategories.length}/{allSubCategoryNames.length})</span>
                                </span>
                                <div className="flex items-center gap-1 text-[11px]">
                                    <button
                                        type="button"
                                        onClick={() => handleSelectAllSubCategories(true)}
                                        className="text-indigo-700 hover:underline font-semibold"
                                    >
                                        Tất cả
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                        type="button"
                                        onClick={() => handleSelectAllSubCategories(false)}
                                        className="text-slate-500 hover:text-rose-600"
                                    >
                                        Bỏ chọn
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                {subCategoryStats.length === 0 ? (
                                    <div className="text-[11px] text-slate-400 p-2 text-center">
                                        Vui lòng chọn ít nhất 1 Ngành hàng ở bên trái.
                                    </div>
                                ) : (
                                    subCategoryStats.map(sub => {
                                        const isChecked = selectedSubCategories.includes(sub.name);
                                        return (
                                            <label
                                                key={sub.name}
                                                className={`flex items-center justify-between p-1.5 rounded-md text-xs cursor-pointer select-none transition-colors ${isChecked ? 'bg-indigo-50 text-indigo-900 font-medium' : 'hover:bg-slate-100 text-slate-600'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => handleToggleSubCategory(sub.name)}
                                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="truncate" title={sub.name}>{sub.name}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                                                    {sub.count} mã
                                                </span>
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* THAO TÁC NHANH VỚI HÀNG LOẠT */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleSelectAllFiltered(!isAllFilteredSelected)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 font-semibold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        >
                            {isAllFilteredSelected ? (
                                <>
                                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Bỏ chọn các mã đang lọc</span>
                                </>
                            ) : (
                                <>
                                    <Square className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Chọn tất cả các mã đang lọc</span>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => onSelectAll(true)}
                            className="px-2 py-1 font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                        >
                            Chọn tất cả ({items.length})
                        </button>

                        <button
                            type="button"
                            onClick={() => onSelectAll(false)}
                            className="px-2 py-1 font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                            Bỏ chọn hết
                        </button>

                        {/* Nút lọc nhanh chỉ mã có sức bán */}
                        {salesVelocityMap && Object.keys(salesVelocityMap).length > 0 && (
                            <button
                                type="button"
                                onClick={() => setFilterOnlyHasSales(!filterOnlyHasSales)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-bold rounded-md text-xs transition-colors cursor-pointer border ${
                                    filterOnlyHasSales
                                        ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                                        : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                }`}
                                title="Chỉ hiển thị các sản phẩm có dữ liệu bán ra (> 0 máy)"
                            >
                                <Flame className="w-3.5 h-3.5" />
                                <span>{filterOnlyHasSales ? 'Đang lọc: Có sức bán (>0)' : 'Chỉ mã có sức bán (>0)'}</span>
                            </button>
                        )}
                    </div>

                    <div className="text-[11px] text-slate-500">
                        Hiển thị <b>{filteredItems.length}</b> / {items.length} sản phẩm thiếu
                    </div>
                </div>
            </div>

            {/* BẢNG DỮ LIỆU SẢN PHẨM THIẾU TỒN KHO - TỐI ƯU SMARTPHONE COMPACT */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200 shadow-xs">
                            <tr>
                                <th className="p-2 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllFilteredSelected}
                                        onChange={(e) => handleSelectAllFiltered(e.target.checked)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                </th>
                                <th className="p-2 w-10 text-center">STT</th>
                                <th className="p-2 w-32">Mã Sản Phẩm</th>
                                <th className="p-2 min-w-[200px]">Tên Sản Phẩm</th>
                                {salesVelocityMap && Object.keys(salesVelocityMap).length > 0 && (
                                    <th className="p-2 w-20 text-center text-amber-900 bg-amber-50/80">
                                        <span className="inline-flex items-center gap-1 font-bold">
                                            <Flame className="w-3 h-3 text-amber-600 fill-amber-500" />
                                            Sức Bán
                                        </span>
                                    </th>
                                )}
                                <th className="p-2 w-28 hidden sm:table-cell">Ngành / Nhóm</th>
                                <th className="p-2 w-20 text-center">Trạng Thái</th>
                                <th className="p-2 w-16 text-right">Tồn Kho</th>
                                <th className="p-2 w-28 text-center">SL Xin</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={salesVelocityMap && Object.keys(salesVelocityMap).length > 0 ? 9 : 8} className="p-8 text-center text-slate-400">
                                        Không tìm thấy sản phẩm thiếu hàng nào phù hợp với bộ lọc Checkbox đã chọn.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, idx) => {
                                    const vel = salesVelocityMap ? getProductSalesVelocity(salesVelocityMap, item.product_code) : null;
                                    return (
                                        <tr
                                            key={item.id}
                                            className={`hover:bg-blue-50/50 transition-colors ${item.isSelected ? 'bg-blue-50/30' : ''
                                                }`}
                                        >
                                            <td className="p-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={item.isSelected}
                                                    onChange={() => onToggleSelect(item.id)}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-2 text-center text-slate-500 font-mono">
                                                {idx + 1}
                                            </td>
                                            <td className="p-2 font-mono font-bold text-blue-800 text-[11px]">
                                                {item.product_code}
                                            </td>
                                            <td className="p-2">
                                                <div className="font-semibold text-slate-800 line-clamp-2" title={item.product_name}>
                                                    {item.product_name}
                                                </div>
                                                <div className="text-[10px] text-slate-500 sm:hidden mt-0.5">
                                                    {item.category} • {item.sub_category}
                                                </div>
                                            </td>
                                            {salesVelocityMap && Object.keys(salesVelocityMap).length > 0 && (
                                                <td className="p-2 text-center">
                                                    {vel && vel.sales_qty > 0 ? (
                                                        <span
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-amber-900 border border-amber-300 font-mono shadow-2xs"
                                                            title={`Đã bán ${vel.sales_qty} máy trong kỳ`}
                                                        >
                                                            <Flame className="w-3 h-3 text-amber-600 fill-amber-500" />
                                                            {vel.sales_qty}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-slate-400 font-mono font-medium">0</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="p-2 hidden sm:table-cell">
                                                <div className="text-[11px] font-medium text-slate-700 truncate" title={item.category}>
                                                    {item.category}
                                                </div>
                                                <div className="text-[10px] text-slate-500 truncate" title={item.sub_category}>
                                                    {item.sub_category}
                                                </div>
                                            </td>
                                            <td className="p-2 text-center">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${item.product_status === 'Mới'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                                    }`}>
                                                    {item.product_status || 'Mới'}
                                                </span>
                                            </td>
                                            <td className="p-2 text-right font-black text-rose-600 font-mono">
                                                {item.available_qty}
                                            </td>
                                            <td className="p-2 text-center">
                                                <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                                                <button
                                                    type="button"
                                                    onClick={() => onUpdateQuantity(item.id, Math.max(1, (item.request_qty || 1) - 1))}
                                                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="w-7 text-center font-bold text-xs font-mono text-blue-700">
                                                    {item.request_qty || 1}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => onUpdateQuantity(item.id, (item.request_qty || 1) + 1)}
                                                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
