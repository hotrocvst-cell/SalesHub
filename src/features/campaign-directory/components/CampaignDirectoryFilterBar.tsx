import React from 'react';
import {
    Search,
    Filter,
    CheckSquare,
    Square,
    Layers,
    X,
    Store,
    Target,
    Sparkles,
    CheckCircle2,
    Calendar,
    ChevronDown,
    Gift,
    Eye,
    EyeOff
} from 'lucide-react';
import type { CampaignOrientation, CampaignCalculationMethod } from '../types';

interface Props {
    // Siêu thị & Mục tiêu (Mục 10 - GEMINI.md)
    selectedStore: string;
    onSelectStore: (store: string) => void;
    storeOptions: string[];
    isStoreSelectable: boolean;
    storeTargetsCount: number;
    matchedTargetsCount: number;
    onlyShowStoreTargets: boolean;
    onToggleOnlyShowStoreTargets: (val: boolean) => void;
    onAutoSelectStoreTargets: () => void;
    loadingTargets: boolean;
    reportMonthDisplay: string;
    userStoreLabel: string;

    // Nhóm thi đua
    groups: string[];
    selectedGroup: string;
    onSelectGroup: (group: string) => void;

    // Tìm kiếm & Lọc
    searchQuery: string;
    onSearchChange: (q: string) => void;
    orientationFilter: string;
    onOrientationChange: (val: string) => void;
    calcFilter: string;
    onCalcChange: (val: string) => void;

    // Tùy chọn hiển thị
    showOpportunity: boolean;
    onToggleShowOpportunity: (show: boolean) => void;

    // Thao tác chọn checkbox
    selectedCount: number;
    totalCount: number;
    filteredCount: number;
    isAllSelected: boolean;
    onToggleSelectAll: () => void;
    onSelectAllFiltered: () => void;
    onClearSelection: () => void;
}

export default function CampaignDirectoryFilterBar({
    selectedStore,
    onSelectStore,
    storeOptions,
    isStoreSelectable,
    storeTargetsCount,
    matchedTargetsCount,
    onlyShowStoreTargets,
    onToggleOnlyShowStoreTargets,
    onAutoSelectStoreTargets,
    loadingTargets,
    reportMonthDisplay,
    userStoreLabel,
    groups,
    selectedGroup,
    onSelectGroup,
    searchQuery,
    onSearchChange,
    orientationFilter,
    onOrientationChange,
    calcFilter,
    onCalcChange,
    showOpportunity,
    onToggleShowOpportunity,
    selectedCount,
    totalCount,
    filteredCount,
    isAllSelected,
    onToggleSelectAll,
    onSelectAllFiltered,
    onClearSelection
}: Props) {
    return (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-3 font-avo">
            {/* DÒNG 1 (QUY CHUẨN MỤC 10 - GEMINI.MD): BỘ LỌC SIÊU THỊ / CỤM NẰM RIÊNG LẺ 1 DÒNG ĐẦU TIÊN KÈM CÔNG CỤ TỰ ĐỘNG CHỌN THEO MỤC TIÊU */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Biểu tượng & Nhãn Siêu thị */}
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 shrink-0">
                        <Store className="w-4 h-4 text-blue-600" />
                        <span className="uppercase tracking-wider text-[11px] font-extrabold text-slate-600">
                            Siêu thị / Cụm:
                        </span>
                    </div>

                    {/* Selector hoặc Badge Siêu Thị */}
                    {isStoreSelectable ? (
                        <div className="relative">
                            <select
                                value={selectedStore}
                                onChange={e => onSelectStore(e.target.value)}
                                className="appearance-none pl-3 pr-8 py-1.5 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 rounded-xl text-xs font-black text-blue-900 cursor-pointer focus:bg-white focus:outline-hidden transition shadow-2xs"
                                title="Chọn siêu thị để xem và tự động lấy các chương trình có khai báo mục tiêu"
                            >
                                <option value="all">🌐 Toàn Cụm Siêu Thị</option>
                                {storeOptions.map(st => (
                                    <option key={st} value={st}>
                                        🏪 {st}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-blue-700 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    ) : (
                        <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-black flex items-center gap-1">
                            <span>🏪 {userStoreLabel}</span>
                        </span>
                    )}

                    {/* Badge Trạng Thái Báo Cáo Lũy Kế Tháng */}
                    {reportMonthDisplay && (
                        <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                            title={`Dữ liệu mục tiêu được truy vấn từ Báo cáo Lũy Kế ${reportMonthDisplay}`}
                        >
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>{reportMonthDisplay}</span>
                            {storeTargetsCount > 0 ? (
                                <span className="text-emerald-700 font-extrabold">({storeTargetsCount} mục tiêu)</span>
                            ) : (
                                <span className="text-slate-400 italic">(Chưa có target)</span>
                            )}
                        </span>
                    )}
                </div>

                {/* Khối Công Cụ Tự Động Chọn Theo Mục Tiêu Shop */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Checkbox: Chỉ lọc xem các chương trình có mục tiêu */}
                    <label
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer select-none border ${
                            onlyShowStoreTargets
                                ? 'bg-amber-50 text-amber-900 border-amber-300 font-black shadow-2xs'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                        title="Bật để chỉ hiển thị các chương trình thi đua mà siêu thị này có khai báo chỉ tiêu mục tiêu"
                    >
                        <input
                            type="checkbox"
                            checked={onlyShowStoreTargets}
                            onChange={e => onToggleOnlyShowStoreTargets(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                        />
                        <span>Chỉ xem CT có mục tiêu</span>
                        {matchedTargetsCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md bg-amber-200/80 text-amber-900 text-[10px] font-black">
                                {matchedTargetsCount}
                            </span>
                        )}
                    </label>

                    {/* Button: Tự Động Tick Chọn Tất Cả CT Có Mục Tiêu */}
                    <button
                        type="button"
                        onClick={onAutoSelectStoreTargets}
                        disabled={loadingTargets || matchedTargetsCount === 0}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                            matchedTargetsCount > 0
                                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white'
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}
                        title={`Tự động tick chọn ${matchedTargetsCount} chương trình thi đua có khai báo mục tiêu của ${userStoreLabel}`}
                    >
                        <Target className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span>Tự động chọn theo mục tiêu ({matchedTargetsCount})</span>
                    </button>
                </div>
            </div>

            {/* HÀNG 2: TABS NHÓM THI ĐUA */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                <span className="text-slate-400 font-bold flex items-center gap-1 text-[11px] uppercase tracking-wider shrink-0 pr-1">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>Nhóm:</span>
                </span>

                <button
                    type="button"
                    onClick={() => onSelectGroup('ALL')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer ${
                        selectedGroup === 'ALL'
                            ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                >
                    Tất cả nhóm ({totalCount})
                </button>

                {groups.map(g => (
                    <button
                        key={g}
                        type="button"
                        onClick={() => onSelectGroup(g)}
                        className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer ${
                            selectedGroup === g
                                ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                    >
                        {g}
                    </button>
                ))}
            </div>

            {/* HÀNG 3: TÌM KIẾM & LỌC BỔ SUNG (ĐỊNH HƯỚNG, CÁCH TÍNH) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
                {/* Ô tìm kiếm */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Tìm theo tên CT, thể lệ, cơ hội CTKM..."
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium transition"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => onSearchChange('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Các dropdown lọc */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                    {/* Định hướng */}
                    <div className="flex items-center gap-1">
                        <select
                            value={orientationFilter}
                            onChange={e => onOrientationChange(e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 cursor-pointer focus:bg-white focus:outline-hidden"
                            title="Lọc theo định hướng"
                        >
                            <option value="ALL">🎯 Định hướng: Tất cả</option>
                            <option value="Chính">Chính</option>
                            <option value="Bán kèm">Bán kèm</option>
                            <option value="Phụ">Phụ</option>
                            <option value="Trọng tâm">Trọng tâm</option>
                        </select>
                    </div>

                    {/* Cách tính */}
                    <div className="flex items-center gap-1">
                        <select
                            value={calcFilter}
                            onChange={e => onCalcChange(e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 cursor-pointer focus:bg-white focus:outline-hidden"
                            title="Lọc theo cách tính"
                        >
                            <option value="ALL">📊 Cách tính: Tất cả</option>
                            <option value="Doanh thu">Doanh thu</option>
                            <option value="DTQĐ">DTQĐ</option>
                            <option value="Số lượng">Số lượng</option>
                            <option value="SLQĐ">SLQĐ</option>
                        </select>
                    </div>

                    {/* Tùy chọn Ẩn / Hiển thị Cơ hội & CTKM */}
                    <button
                        type="button"
                        onClick={() => onToggleShowOpportunity(!showOpportunity)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border shadow-2xs select-none active:scale-95 shrink-0 ${
                            showOpportunity
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 font-black'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200'
                        }`}
                        title={showOpportunity ? 'Đang hiển thị Cơ hội & CTKM (bấm để ẩn đi)' : 'Đang ẩn Cơ hội & CTKM (bấm để hiển thị)'}
                    >
                        {showOpportunity ? (
                            <>
                                <Eye className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>Cơ hội & CTKM: Hiện</span>
                            </>
                        ) : (
                            <>
                                <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>Cơ hội & CTKM: Ẩn</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* HÀNG 4: THANH CÔNG CỤ CHỌN & CHECKBOX NHANH */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-500 font-medium">
                        Đang hiển thị <strong>{filteredCount}</strong> / {totalCount} chương trình
                    </span>

                    {selectedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-black text-[11px]">
                            <CheckSquare className="w-3 h-3 text-blue-700" />
                            <span>Đã chọn {selectedCount} CT</span>
                        </span>
                    ) : (
                        <span className="text-[11px] text-slate-400 italic">
                            (Chưa chọn CT nào để xuất ảnh tổng hợp)
                        </span>
                    )}

                    {onlyShowStoreTargets && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[10.5px]">
                            <span>Lọc theo mục tiêu: {userStoreLabel}</span>
                        </span>
                    )}

                    {!showOpportunity && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10.5px] border border-slate-200">
                            <EyeOff className="w-3 h-3 text-slate-400" />
                            <span>Đã ẩn CTKM</span>
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={onSelectAllFiltered}
                        className="text-blue-700 hover:text-blue-900 font-bold hover:underline cursor-pointer text-xs"
                    >
                        Chọn tất cả ({filteredCount})
                    </button>
                    {selectedCount > 0 && (
                        <>
                            <span className="text-slate-300">•</span>
                            <button
                                type="button"
                                onClick={onClearSelection}
                                className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer text-xs"
                            >
                                Bỏ chọn tất cả
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
