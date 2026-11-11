import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Flame,
    ArrowRight,
    Layers,
    Search,
    X,
    TrendingUp
} from 'lucide-react';
import { usePermissions } from '../../../shared/contexts/PermissionContext';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { getLocalPageVisits, syncPageVisitsFromCloud } from '../../../core/lib/pageVisitService';
import { QUICK_NAV_CARDS, GROUP_CONFIGS, type QuickCard } from '../data/quickNavCards';

export default function QuickNavigationGrid() {
    const { canAccessPage } = usePermissions();
    const { currentUser } = useAuth();

    // 1. Quản lý số lượt truy cập trang của người dùng
    const [pageVisits, setPageVisits] = useState<Record<string, number>>(() => {
        return getLocalPageVisits(currentUser?.employee_id || '');
    });

    const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // 2. Lắng nghe cập nhật realtime và đồng bộ từ Supabase Cloud
    useEffect(() => {
        const empId = currentUser?.employee_id || '';
        // Đọc từ cache ban đầu
        setPageVisits(getLocalPageVisits(empId));

        // Lắng nghe sự kiện click trang trong cùng phiên
        const handlePageVisited = (event: any) => {
            const detail = event?.detail;
            if (detail?.pagePath && typeof detail?.count === 'number') {
                setPageVisits(prev => ({
                    ...prev,
                    [detail.pagePath]: detail.count
                }));
            }
        };

        window.addEventListener('saleshub_page_visited', handlePageVisited);

        // Đồng bộ từ Cloud trong nền
        if (empId) {
            syncPageVisitsFromCloud(empId).then(cloudData => {
                if (cloudData) {
                    setPageVisits(cloudData);
                }
            });
        }

        return () => {
            window.removeEventListener('saleshub_page_visited', handlePageVisited);
        };
    }, [currentUser?.employee_id]);

    // 3. Lọc tất cả các thẻ mà người dùng được phân quyền truy cập
    const visibleCards = useMemo(() => {
        return QUICK_NAV_CARDS.filter(card => canAccessPage(card.path).allowed);
    }, [canAccessPage]);

    // 4. Danh sách Top 6 trang có lượt truy cập cao nhất của user
    const top6Cards = useMemo(() => {
        if (visibleCards.length === 0) return [];
        return [...visibleCards]
            .sort((a, b) => {
                const countA = pageVisits[a.path] || 0;
                const countB = pageVisits[b.path] || 0;
                return countB - countA;
            })
            .slice(0, 6);
    }, [visibleCards, pageVisits]);

    // 5. Danh sách các nhóm chuyên mục hợp lệ (người dùng có ít nhất 1 trang được phân quyền)
    const availableGroups = useMemo(() => {
        const groupsWithCounts = new Map<string, number>();
        visibleCards.forEach(card => {
            const current = groupsWithCounts.get(card.groupTitle) || 0;
            groupsWithCounts.set(card.groupTitle, current + 1);
        });

        return Array.from(groupsWithCounts.entries()).map(([groupTitle, count]) => ({
            groupTitle,
            count,
            config: GROUP_CONFIGS[groupTitle] || {
                label: groupTitle,
                icon: Layers,
                colorClass: 'text-slate-700',
                bgClass: 'bg-slate-50 text-slate-700 border-slate-200'
            }
        }));
    }, [visibleCards]);

    // 6. Lọc danh sách thẻ theo Tab nhóm và từ khóa tìm kiếm
    const filteredCards = useMemo(() => {
        let list = visibleCards;

        if (selectedGroup !== 'ALL') {
            list = list.filter(card => card.groupTitle === selectedGroup);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(card =>
                card.title.toLowerCase().includes(q) ||
                card.description.toLowerCase().includes(q) ||
                card.badge?.toLowerCase().includes(q)
            );
        }

        return list;
    }, [visibleCards, selectedGroup, searchQuery]);

    if (visibleCards.length === 0) {
        return null;
    }

    // Huy hiệu thứ hạng Top
    const getRankBadge = (index: number) => {
        if (index === 0) return { label: '#1 Top', bg: 'bg-amber-500 text-white shadow-amber-200 shadow-sm' };
        if (index === 1) return { label: '#2 Top', bg: 'bg-slate-700 text-white shadow-slate-200 shadow-sm' };
        if (index === 2) return { label: '#3 Top', bg: 'bg-amber-700 text-white shadow-amber-900/10 shadow-sm' };
        return { label: `#${index + 1}`, bg: 'bg-slate-100 text-slate-600 border border-slate-200/80' };
    };

    return (
        <div className="space-y-6">
            {/* ============================================================== */}
            {/* KHU VỰC 1: TOP 6 LỐI TẮT THƯỜNG DÙNG NHẤT (CÁ NHÂN HÓA)         */}
            {/* ============================================================== */}
            {top6Cards.length > 0 && (
                <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-transparent border border-amber-200/70 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2.5">
                            <span className="p-1.5 rounded-xl bg-amber-500 text-white shadow-sm shrink-0" aria-hidden="true">
                                <Flame className="w-4 h-4 fill-white" />
                            </span>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                        Top Thường Dùng
                                    </h2>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200/80">
                                        Top 6 Cá nhân hóa
                                    </span>
                                </div>
                                <p className="text-[11px] font-medium text-slate-600">
                                    Tự động xếp hạng theo tần suất truy cập thực tế của bạn
                                </p>
                            </div>
                        </div>

                        <span className="text-[11px] font-bold text-slate-500 self-start sm:self-auto">
                            Tự động cập nhật tức thì
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {top6Cards.map((card, idx) => {
                            const IconComponent = card.icon;
                            const visits = pageVisits[card.path] || 0;
                            const rank = getRankBadge(idx);

                            return (
                                <Link
                                    key={`top-${card.path}`}
                                    to={card.path}
                                    className={`group relative p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-amber-400 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden bg-gradient-to-br ${card.gradient} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black shrink-0 transition group-hover:scale-105 ${card.iconBg}`} aria-hidden="true">
                                                    <IconComponent className="w-4 h-4" />
                                                </div>
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums ${rank.bg}`}>
                                                    {rank.label}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {visits > 0 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 tabular-nums" title={`Đã mở ${visits} lần`}>
                                                        {visits} lượt
                                                    </span>
                                                )}
                                                {card.badge && (
                                                    <span className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-tight border ${card.badgeColor}`}>
                                                        {card.badge}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-blue-600 transition leading-snug line-clamp-1">
                                            {card.title}
                                        </h3>

                                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                            {card.description}
                                        </p>
                                    </div>

                                    <div className="pt-2 mt-2.5 border-t border-slate-100/90 flex items-center justify-between text-[11px] font-bold text-slate-500 group-hover:text-blue-600 transition">
                                        <span className="flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3 text-amber-500 shrink-0" aria-hidden="true" />
                                            <span>Mở nhanh</span>
                                        </span>
                                        <ArrowRight className="w-3.5 h-3.5 transition group-hover:translate-x-1 shrink-0" aria-hidden="true" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* KHU VỰC 2: DANH MỤC LỐI TẮT THEO NHÓM CHUYÊN MỤC               */}
            {/* ============================================================== */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                            Lối Tắt Theo Chuyên Mục
                        </h2>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 tabular-nums">
                            {visibleCards.length} lối tắt
                        </span>
                    </div>

                    {/* Ô tìm kiếm nhanh */}
                    <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                        <input
                            id="home-quicknav-search"
                            name="quickNavSearch"
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Tìm kiếm màn hình chức năng"
                            placeholder="Tìm kiếm màn hình..."
                            className="w-full pl-8 pr-8 py-1.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-medium"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                aria-label="Xóa từ khóa tìm kiếm màn hình"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Thanh chọn Tabs nhóm chuyên mục */}
                <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap pb-1 no-scrollbar select-none" role="tablist" aria-label="Nhóm màn hình chức năng">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={selectedGroup === 'ALL'}
                        onClick={() => setSelectedGroup('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            selectedGroup === 'ALL'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                        }`}
                    >
                        <span>Tất cả</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${selectedGroup === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                            {visibleCards.length}
                        </span>
                    </button>

                    {availableGroups.map(grp => {
                        const Icon = grp.config.icon;
                        const isSelected = selectedGroup === grp.groupTitle;

                        return (
                            <button
                                key={grp.groupTitle}
                                type="button"
                                role="tab"
                                aria-selected={isSelected}
                                onClick={() => setSelectedGroup(grp.groupTitle)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                    isSelected
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                <span>{grp.config.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                    {grp.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Danh sách thẻ theo nhóm */}
                {filteredCards.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2.5">
                        <p className="text-xs font-bold text-slate-600">
                            Không tìm thấy màn hình nào phù hợp với từ khóa &quot;{searchQuery}&quot;
                        </p>
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setSelectedGroup('ALL');
                                }}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
                            >
                                Xóa bộ lọc tìm kiếm
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {filteredCards.map((card) => {
                            const IconComponent = card.icon;
                            const visits = pageVisits[card.path] || 0;

                            return (
                                <Link
                                    key={card.path}
                                    to={card.path}
                                    className={`group relative p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden bg-gradient-to-br ${card.gradient} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2.5">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black shrink-0 transition group-hover:scale-105 ${card.iconBg}`} aria-hidden="true">
                                                <IconComponent className="w-4 h-4" />
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {visits > 0 && (
                                                    <span className="text-[10px] font-semibold text-slate-600 px-1.5 py-0.5 rounded bg-slate-100 tabular-nums">
                                                        {visits} lượt
                                                    </span>
                                                )}
                                                {card.badge && (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${card.badgeColor}`}>
                                                        {card.badge}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-blue-600 transition leading-snug line-clamp-1">
                                            {card.title}
                                        </h3>

                                        <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                            {card.description}
                                        </p>
                                    </div>

                                    <div className="pt-2.5 mt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-blue-600 transition">
                                        <span>Truy cập</span>
                                        <ArrowRight className="w-3.5 h-3.5 transition group-hover:translate-x-1 shrink-0" aria-hidden="true" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
