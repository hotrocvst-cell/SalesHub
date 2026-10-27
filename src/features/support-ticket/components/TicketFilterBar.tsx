import { Search, Plus, RefreshCw, Download, Star, Filter } from 'lucide-react';
import { useExcelExportPermission } from '../../../shared/hooks/useExcelExportPermission';
import { getShortStoreName } from '../../../core/lib/formatters';
import type { TicketCategory, TicketPriority } from '../types';
import { CATEGORY_METADATA, PRIORITY_METADATA } from '../types';

export type StatusTab = 'ALL' | 'NEEDS_ACTION' | 'STARRED' | 'MY_TICKETS' | 'CLOSED';

interface Props {
    // Row 1 Store & Action controls
    selectedStore: string;
    onSelectStore: (store: string) => void;
    storeOptions: string[];
    onOpenCreateModal: () => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    onExportExcel?: () => void;

    // Row 2 Filters
    activeTab: StatusTab;
    onSelectTab: (tab: StatusTab) => void;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    selectedCategory: string;
    onSelectCategory: (cat: string) => void;
    selectedPriority: string;
    onSelectPriority: (p: string) => void;

    // Badge counts
    needsActionCount: number;
    starredCount: number;
    myTicketsCount: number;
}

export default function TicketFilterBar({
    selectedStore,
    onSelectStore,
    storeOptions,
    onOpenCreateModal,
    onRefresh,
    isRefreshing,
    onExportExcel,
    activeTab,
    onSelectTab,
    searchQuery,
    onSearchChange,
    selectedCategory,
    onSelectCategory,
    selectedPriority,
    onSelectPriority,
    needsActionCount,
    starredCount,
    myTicketsCount
}: Props) {
    const { canExportExcel } = useExcelExportPermission('/ho-tro-gop-y');

    const statusTabs: { id: StatusTab; label: string; count?: number; icon?: string }[] = [
        { id: 'ALL', label: 'Tất cả' },
        { id: 'NEEDS_ACTION', label: 'Cần xử lý', count: needsActionCount, icon: '⚡' },
        { id: 'STARRED', label: 'Cần theo dõi', count: starredCount, icon: '⭐' },
        { id: 'MY_TICKETS', label: 'Phiếu của tôi', count: myTicketsCount, icon: '👤' },
        { id: 'CLOSED', label: 'Đã hoàn tất / Đóng' }
    ];

    return (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3 space-y-2.5">
            {/* DÒNG 1: QUY CHUẨN 10 - BỘ LỌC SIÊU THỊ / CỤM RIÊNG LẺ Ở VỊ TRÍ ĐẦU TIÊN KẾT HỢP NÚT HÀNH ĐỘNG */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                {/* Store / Cluster Selector */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-500 shrink-0">📍 Siêu thị / Đơn vị:</span>
                    <select
                        value={selectedStore}
                        onChange={(e) => onSelectStore(e.target.value)}
                        className="w-full sm:max-w-xs text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer truncate"
                    >
                        <option value="ALL">🏢 Toàn hệ thống (Tất cả siêu thị)</option>
                        {storeOptions.map(store => (
                            <option key={store} value={store}>
                                {getShortStoreName(store)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Main Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    {/* Nút Tạo phiếu mới */}
                    <button
                        onClick={onOpenCreateModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow-sm transition-all"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tạo Phiếu Mới</span>
                    </button>

                    {/* Nút Làm mới */}
                    <button
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        title="Làm mới dữ liệu phiếu"
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                    </button>

                    {/* Nút Xuất Excel (Quy chuẩn 9: Khóa & Ẩn mặc định, chỉ hiển thị khi có quyền) */}
                    {canExportExcel && onExportExcel && (
                        <button
                            onClick={onExportExcel}
                            title="Xuất dữ liệu Excel phiếu hỗ trợ"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Excel</span>
                        </button>
                    )}
                </div>
            </div>

            {/* DÒNG 2: TABS TRẠNG THÁI & BỘ LỌC CHI TIẾT */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                {/* Status Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                    {statusTabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => onSelectTab(tab.id)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                                    isActive
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {tab.icon && <span>{tab.icon}</span>}
                                <span>{tab.label}</span>
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                        isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Filter selects & Search */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {/* Category Dropdown */}
                    <select
                        value={selectedCategory}
                        onChange={(e) => onSelectCategory(e.target.value)}
                        className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="ALL">📁 Tất cả chủ đề</option>
                        {(Object.keys(CATEGORY_METADATA) as TicketCategory[]).map(cat => (
                            <option key={cat} value={cat}>
                                {CATEGORY_METADATA[cat].icon} {CATEGORY_METADATA[cat].label}
                            </option>
                        ))}
                    </select>

                    {/* Priority Dropdown */}
                    <select
                        value={selectedPriority}
                        onChange={(e) => onSelectPriority(e.target.value)}
                        className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="ALL">🎯 Mức ưu tiên</option>
                        {(Object.keys(PRIORITY_METADATA) as TicketPriority[]).map(pri => (
                            <option key={pri} value={pri}>
                                {PRIORITY_METADATA[pri].label}
                            </option>
                        ))}
                    </select>

                    {/* Search Input */}
                    <div className="relative flex-1 sm:w-48">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Tìm kiếm phiếu..."
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
