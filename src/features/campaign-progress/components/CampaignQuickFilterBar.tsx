import { AlertTriangle, CheckCircle2, LayoutGrid, Table, ArrowUpDown, Flame } from 'lucide-react';
import type { QuickFilterMode, SortMode, CampaignOverallMetrics } from '../types';

interface Props {
    quickFilter: QuickFilterMode;
    onQuickFilterChange: (mode: QuickFilterMode) => void;
    metrics: CampaignOverallMetrics;
    sortMode: SortMode;
    onSortChange: (sort: SortMode) => void;
    viewMode: 'CARDS' | 'TABLE';
    onViewModeChange: (view: 'CARDS' | 'TABLE') => void;
}

export default function CampaignQuickFilterBar({
    quickFilter,
    onQuickFilterChange,
    metrics,
    sortMode,
    onSortChange,
    viewMode,
    onViewModeChange
}: Props) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-1">
            {/* Bộ nút Lọc Nhanh */}
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-0.5 hidden xs:inline">
                    Lọc nhanh:
                </span>

                {/* Nút lọc: DỰ KIẾN KHÔNG HOÀN THÀNH (Đặc biệt nổi bật theo yêu cầu người dùng) */}
                <button
                    type="button"
                    onClick={() => onQuickFilterChange(quickFilter === 'NOT_ACHIEVED' ? 'ALL' : 'NOT_ACHIEVED')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                        quickFilter === 'NOT_ACHIEVED'
                            ? 'bg-rose-600 text-white shadow-rose-200 ring-2 ring-rose-600/30 font-black'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    }`}
                >
                    <AlertTriangle className={`w-3.5 h-3.5 ${quickFilter === 'NOT_ACHIEVED' ? 'text-white' : 'text-rose-600'}`} />
                    <span>Dự kiến KHÔNG đạt</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        quickFilter === 'NOT_ACHIEVED'
                            ? 'bg-white/20 text-white font-black'
                            : 'bg-rose-200/80 text-rose-900 font-extrabold'
                    }`}>
                        {metrics.notAchievedCampaigns}
                    </span>
                </button>

                {/* Nút lọc: DỰ KIẾN HOÀN THÀNH */}
                <button
                    type="button"
                    onClick={() => onQuickFilterChange(quickFilter === 'ACHIEVED' ? 'ALL' : 'ACHIEVED')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-2xs ${
                        quickFilter === 'ACHIEVED'
                            ? 'bg-emerald-600 text-white shadow-emerald-200 ring-2 ring-emerald-600/30 font-bold'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${quickFilter === 'ACHIEVED' ? 'text-white' : 'text-emerald-600'}`} />
                    <span>Dự kiến Đạt</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        quickFilter === 'ACHIEVED'
                            ? 'bg-white/20 text-white font-black'
                            : 'bg-emerald-200/80 text-emerald-900 font-extrabold'
                    }`}>
                        {metrics.achievedCampaigns}
                    </span>
                </button>

                {/* Nút lọc: TẤT CẢ */}
                <button
                    type="button"
                    onClick={() => onQuickFilterChange('ALL')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shadow-2xs ${
                        quickFilter === 'ALL'
                            ? 'bg-slate-800 text-white font-bold ring-2 ring-slate-800/20'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    <span>Tất cả</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        quickFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                        {metrics.totalCampaigns}
                    </span>
                </button>
            </div>

            {/* Sắp xếp & Chế độ xem */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
                {/* Sắp xếp */}
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs shadow-2xs">
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <select
                        value={sortMode}
                        onChange={(e) => onSortChange(e.target.value as SortMode)}
                        className="bg-transparent text-slate-700 font-medium focus:outline-none text-xs cursor-pointer"
                    >
                        <option value="FORECAST_ASC">⚡ % Dự kiến tăng dần (Yếu nhất trước)</option>
                        <option value="FORECAST_DESC">⭐ % Dự kiến giảm dần (Tốt nhất trước)</option>
                        <option value="TARGET_DESC">🎯 Target lớn nhất</option>
                        <option value="GAP_DESC">📉 Còn lại nhiều nhất</option>
                        <option value="NAME_ASC">🔤 Tên chương trình A-Z</option>
                    </select>
                </div>

                {/* Nút chuyển chế độ xem: Cards vs Table */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                        type="button"
                        onClick={() => onViewModeChange('CARDS')}
                        title="Dạng thẻ tiến độ"
                        className={`p-1.5 rounded-md text-xs font-semibold transition-all ${
                            viewMode === 'CARDS'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewModeChange('TABLE')}
                        title="Dạng bảng chi tiết"
                        className={`p-1.5 rounded-md text-xs font-semibold transition-all ${
                            viewMode === 'TABLE'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Table className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
