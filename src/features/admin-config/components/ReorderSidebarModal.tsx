import { useState, useMemo, useEffect } from 'react';
import { type SystemPagePermission } from '../../../core/lib/permissions';
import {
    X,
    ArrowUp,
    ArrowDown,
    ChevronsUp,
    ChevronsDown,
    Check,
    RotateCcw,
    Layers,
    MoveVertical,
    BarChart3,
    HeartPulse,
    Database,
    Ticket,
    Settings,
    FolderKanban,
    FileText,
    Sparkles
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    pageList: SystemPagePermission[];
    onSaveOrder: (reorderedPages: SystemPagePermission[]) => void;
    initialTab?: 'GROUPS' | 'PAGES';
}

function getGroupIcon(groupTitle: string) {
    const upper = groupTitle.toUpperCase();
    if (upper.includes('BÁO CÁO') || upper.includes('KINH DOANH')) return BarChart3;
    if (upper.includes('SỨC KHỎE') || upper.includes('NHÂN VIÊN') || upper.includes('THI ĐUA')) return HeartPulse;
    if (upper.includes('DỮ LIỆU') || upper.includes('PHIÊN')) return Database;
    if (upper.includes('TIỆN ÍCH') || upper.includes('VOUCHER')) return Ticket;
    if (upper.includes('HỆ THỐNG') || upper.includes('CẤU HÌNH')) return Settings;
    return FolderKanban;
}

export default function ReorderSidebarModal({
    isOpen,
    onClose,
    pageList,
    onSaveOrder,
    initialTab = 'GROUPS'
}: Props) {
    // Chế độ sắp xếp: 'GROUPS' (Nhóm chức năng) hoặc 'PAGES' (Từng phân hệ/trang)
    const [activeTab, setActiveTab] = useState<'GROUPS' | 'PAGES'>(initialTab);

    // Bộ lọc nhóm khi ở tab PAGES
    const [selectedGroup, setSelectedGroup] = useState<string>('ALL');

    // Bản sao danh sách các trang để thao tác
    const [localList, setLocalList] = useState<SystemPagePermission[]>(() => {
        return [...pageList].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    });

    // Thứ tự các nhóm hiện tại
    const [orderedGroups, setOrderedGroups] = useState<string[]>([]);

    // Khởi tạo và đồng bộ danh sách nhóm mỗi khi mở modal hoặc pageList thay đổi
    useEffect(() => {
        if (isOpen) {
            const sorted = [...pageList].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
            setLocalList(sorted);

            const order: string[] = [];
            const seen = new Set<string>();
            sorted.forEach(p => {
                if (p.path === '/') return; // Trang chủ độc lập
                const g = p.group_title?.trim();
                if (g && !seen.has(g)) {
                    seen.add(g);
                    order.push(g);
                }
            });
            setOrderedGroups(order);
            setActiveTab(initialTab);
        }
    }, [isOpen, pageList, initialTab]);

    // Danh sách trang theo từng nhóm
    const pagesByGroupMap = useMemo(() => {
        const map = new Map<string, SystemPagePermission[]>();
        localList.forEach(p => {
            if (p.path === '/') return;
            const g = p.group_title || 'HỆ THỐNG & CẤU HÌNH';
            const list = map.get(g) || [];
            list.push(p);
            map.set(g, list);
        });
        return map;
    }, [localList]);

    if (!isOpen) return null;

    // ==========================================
    // 1. LOGIC SẮP XẾP NHÓM CHỨC NĂNG (GROUPS)
    // ==========================================
    const reorderPagesByNewGroupOrder = (newGroups: string[]) => {
        const homePages = localList.filter(p => p.path === '/');
        const otherPages = localList.filter(p => p.path !== '/');

        const reorderedList: SystemPagePermission[] = [];
        newGroups.forEach(grp => {
            const pagesInThisGroup = otherPages.filter(p => p.group_title === grp);
            reorderedList.push(...pagesInThisGroup);
        });

        // Bổ sung các trang thuộc nhóm chưa nằm trong newGroups nếu có
        const remaining = otherPages.filter(p => !newGroups.includes(p.group_title));
        const combined = [...homePages, ...reorderedList, ...remaining];

        // Chuẩn hóa order_index từ 1..N
        const normalized = combined.map((it, idx) => ({
            ...it,
            order_index: idx + 1
        }));

        setLocalList(normalized);
        setOrderedGroups(newGroups);
    };

    const moveGroup = (groupTitle: string, direction: 'UP' | 'DOWN') => {
        const currentIndex = orderedGroups.indexOf(groupTitle);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= orderedGroups.length) return;

        const updated = [...orderedGroups];
        const temp = updated[currentIndex];
        updated[currentIndex] = updated[targetIndex];
        updated[targetIndex] = temp;

        reorderPagesByNewGroupOrder(updated);
    };

    const moveGroupToExtreme = (groupTitle: string, to: 'TOP' | 'BOTTOM') => {
        const currentIndex = orderedGroups.indexOf(groupTitle);
        if (currentIndex === -1) return;

        const updated = [...orderedGroups];
        const [item] = updated.splice(currentIndex, 1);
        if (to === 'TOP') {
            updated.unshift(item);
        } else {
            updated.push(item);
        }

        reorderPagesByNewGroupOrder(updated);
    };

    // ==========================================
    // 2. LOGIC SẮP XẾP TỪNG TRANG (PAGES)
    // ==========================================
    const displayedItems = selectedGroup === 'ALL'
        ? localList
        : localList.filter(p => p.group_title === selectedGroup);

    const moveItem = (itemPath: string, direction: 'UP' | 'DOWN') => {
        const listToWork = selectedGroup === 'ALL'
            ? [...localList]
            : [...localList.filter(p => p.group_title === selectedGroup)];

        const currentIndex = listToWork.findIndex(p => p.path === itemPath);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= listToWork.length) return;

        const temp = listToWork[currentIndex];
        listToWork[currentIndex] = listToWork[targetIndex];
        listToWork[targetIndex] = temp;

        if (selectedGroup === 'ALL') {
            const updated = listToWork.map((item, idx) => ({ ...item, order_index: idx + 1 }));
            setLocalList(updated);
        } else {
            const remaining = localList.filter(p => p.group_title !== selectedGroup);
            const combined = [...remaining, ...listToWork];
            const updated = combined.map((item, idx) => ({ ...item, order_index: idx + 1 }));
            setLocalList(updated);
        }
    };

    const moveItemToExtreme = (itemPath: string, to: 'TOP' | 'BOTTOM') => {
        const listToWork = selectedGroup === 'ALL'
            ? [...localList]
            : [...localList.filter(p => p.group_title === selectedGroup)];

        const currentIndex = listToWork.findIndex(p => p.path === itemPath);
        if (currentIndex === -1) return;

        const [item] = listToWork.splice(currentIndex, 1);
        if (to === 'TOP') {
            listToWork.unshift(item);
        } else {
            listToWork.push(item);
        }

        if (selectedGroup === 'ALL') {
            const updated = listToWork.map((it, idx) => ({ ...it, order_index: idx + 1 }));
            setLocalList(updated);
        } else {
            const remaining = localList.filter(p => p.group_title !== selectedGroup);
            const combined = [...remaining, ...listToWork];
            const updated = combined.map((it, idx) => ({ ...it, order_index: idx + 1 }));
            setLocalList(updated);
        }
    };

    // Khôi phục về thứ tự ban đầu khi mở modal
    const handleReset = () => {
        const sorted = [...pageList].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        setLocalList(sorted);

        const order: string[] = [];
        const seen = new Set<string>();
        sorted.forEach(p => {
            if (p.path === '/') return;
            const g = p.group_title?.trim();
            if (g && !seen.has(g)) {
                seen.add(g);
                order.push(g);
            }
        });
        setOrderedGroups(order);
    };

    // Áp dụng thứ tự mới
    const handleApply = () => {
        const finalNormalized = localList.map((item, idx) => ({
            ...item,
            order_index: idx + 1
        }));
        onSaveOrder(finalNormalized);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header Modal */}
                <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                        <span className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
                            <MoveVertical className="w-5 h-5 text-amber-300" />
                        </span>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                Sắp Xếp Thứ Tự Hiển Thị Sidebar
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Điều chỉnh thứ tự các nhóm chức năng và từng phân hệ trên thanh điều hướng
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs Chuyển Đổi: Sắp Xếp Nhóm vs Sắp Xếp Từng Trang */}
                <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-slate-200 bg-white flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('GROUPS')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                            activeTab === 'GROUPS'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <Layers className="w-4 h-4" />
                        <span>1. Sắp Xếp Nhóm Chức Năng ({orderedGroups.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('PAGES')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                            activeTab === 'PAGES'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <FileText className="w-4 h-4" />
                        <span>2. Sắp Xếp Từng Phân Hệ / Trang ({localList.length})</span>
                    </button>
                </div>

                {/* ========================================================= */}
                {/* VIEW 1: SẮP XẾP NHÓM CHỨC NĂNG                           */}
                {/* ========================================================= */}
                {activeTab === 'GROUPS' && (
                    <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 no-scrollbar bg-slate-50/50">
                        <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3 text-xs text-indigo-900 flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-extrabold block">Thứ tự hiển thị các nhóm trên Sidebar:</span>
                                <span className="text-[11px] text-indigo-800">
                                    Di chuyển vị trí nhóm lên hoặc xuống. Toàn bộ các phân hệ bên trong nhóm sẽ tự động di chuyển theo khối tương ứng.
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {orderedGroups.map((grpTitle, idx) => {
                                const isFirst = idx === 0;
                                const isLast = idx === orderedGroups.length - 1;
                                const IconComponent = getGroupIcon(grpTitle);
                                const pagesInGroup = pagesByGroupMap.get(grpTitle) || [];

                                return (
                                    <div
                                        key={grpTitle}
                                        className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-xs transition"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {/* Badge Thứ Tự */}
                                            <span className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                                #{idx + 1}
                                            </span>

                                            {/* Icon Nhóm */}
                                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                                                <IconComponent className="w-4 h-4 text-indigo-600" />
                                            </div>

                                            {/* Thông tin nhóm */}
                                            <div className="min-w-0">
                                                <div className="font-black text-xs sm:text-sm text-slate-800 flex items-center gap-2">
                                                    <span>{grpTitle}</span>
                                                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200">
                                                        {pagesInGroup.length} trang
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-400 truncate max-w-sm sm:max-w-md mt-0.5">
                                                    {pagesInGroup.map(p => p.page_name).join(' • ') || 'Chưa có trang'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Nút điều hướng nhóm */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                disabled={isFirst}
                                                onClick={() => moveGroupToExtreme(grpTitle, 'TOP')}
                                                title="Đưa nhóm lên đầu tiên"
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                                            >
                                                <ChevronsUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isFirst}
                                                onClick={() => moveGroup(grpTitle, 'UP')}
                                                title="Di chuyển nhóm lên trên 1 bậc"
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                                            >
                                                <ArrowUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isLast}
                                                onClick={() => moveGroup(grpTitle, 'DOWN')}
                                                title="Di chuyển nhóm xuống dưới 1 bậc"
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                                            >
                                                <ArrowDown className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isLast}
                                                onClick={() => moveGroupToExtreme(grpTitle, 'BOTTOM')}
                                                title="Đưa nhóm xuống cuối cùng"
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                                            >
                                                <ChevronsDown className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ========================================================= */}
                {/* VIEW 2: SẮP XẾP TỪNG PHÂN HỆ / TRANG (PAGES)              */}
                {/* ========================================================= */}
                {activeTab === 'PAGES' && (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        {/* Thanh lọc nhóm */}
                        <div className="p-3 border-b border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                            <button
                                type="button"
                                onClick={() => setSelectedGroup('ALL')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                                    selectedGroup === 'ALL'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Tất cả ({localList.length})
                            </button>
                            {orderedGroups.map(grp => (
                                <button
                                    key={grp}
                                    type="button"
                                    onClick={() => setSelectedGroup(grp)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                                        selectedGroup === grp
                                            ? 'bg-indigo-600 text-white shadow-2xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {grp}
                                </button>
                            ))}
                        </div>

                        {/* Danh sách các trang với nút di chuyển */}
                        <div className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1 no-scrollbar">
                            {displayedItems.map((item, idx) => {
                                const isFirst = idx === 0;
                                const isLast = idx === displayedItems.length - 1;

                                return (
                                    <div
                                        key={item.path}
                                        className="flex items-center justify-between gap-2.5 p-3 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-xs transition"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-mono font-extrabold text-xs flex items-center justify-center shrink-0">
                                                {idx + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <div className="font-extrabold text-xs sm:text-sm text-slate-800 truncate">
                                                    {item.page_name}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="font-mono text-[10px] text-indigo-600 truncate">
                                                        {item.path}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-medium">
                                                        {item.group_title}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Nút thao tác di chuyển */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                disabled={isFirst}
                                                onClick={() => moveItemToExtreme(item.path, 'TOP')}
                                                title="Lên đầu danh sách"
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                                            >
                                                <ChevronsUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isFirst}
                                                onClick={() => moveItem(item.path, 'UP')}
                                                title="Di chuyển lên 1 bậc"
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                                            >
                                                <ArrowUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isLast}
                                                onClick={() => moveItem(item.path, 'DOWN')}
                                                title="Di chuyển xuống 1 bậc"
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                                            >
                                                <ArrowDown className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isLast}
                                                onClick={() => moveItemToExtreme(item.path, 'BOTTOM')}
                                                title="Xuống cuối danh sách"
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                                            >
                                                <ChevronsDown className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Footer Modal */}
                <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition flex items-center gap-1.5 cursor-pointer"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Đặt lại</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md shadow-indigo-200 transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <Check className="w-4 h-4" />
                            <span>Áp Dụng Thứ Tự Mới</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
