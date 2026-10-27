import React from 'react';
import {
    Inbox,
    AlertCircle,
    Star,
    CheckCircle2,
    Smile,
    BarChart3
} from 'lucide-react';
import { useAuth } from '../../../shared/contexts/AuthContext';
import type { SupportTicket, TicketSummaryStats } from '../types';
import { CATEGORY_METADATA } from '../types';

interface Props {
    tickets: SupportTicket[];
    onFilterCategory?: (cat: string) => void;
    activeCategory?: string;
    isAdmin?: boolean;
}

export default function TicketStatsOverview({ tickets, onFilterCategory, activeCategory, isAdmin }: Props) {
    const { isAdmin: authIsAdmin } = useAuth();
    const effectiveIsAdmin = isAdmin !== undefined ? isAdmin : authIsAdmin;
    const stats: TicketSummaryStats = React.useMemo(() => {
        let openCount = 0;
        let inProgressCount = 0;
        let starredCount = 0;
        let closedCount = 0;
        let resolvedCount = 0;
        let ratedCount = 0;
        let totalRatingSum = 0;
        let positiveCount = 0;

        const catCounts: Record<string, number> = {
            huong_dan: 0,
            gop_y_giao_dien: 0,
            tinh_nang_moi: 0,
            bao_loi: 0,
            khac: 0
        };

        tickets.forEach(t => {
            if (t.status === 'open') openCount++;
            if (t.status === 'in_progress') inProgressCount++;
            if (t.status === 'resolved') resolvedCount++;
            if (t.status === 'closed') closedCount++;
            if (t.is_starred) starredCount++;

            if (catCounts[t.category] !== undefined) {
                catCounts[t.category]++;
            }

            if (t.rating && t.rating > 0) {
                ratedCount++;
                totalRatingSum += t.rating;
                if (t.rating >= 4) positiveCount++;
            }
        });

        const avgRating = ratedCount > 0 ? Number((totalRatingSum / ratedCount).toFixed(1)) : 5.0;
        const satRate = ratedCount > 0 ? Math.round((positiveCount / ratedCount) * 100) : 100;

        return {
            totalTickets: tickets.length,
            openTickets: openCount,
            inProgressTickets: inProgressCount,
            needsActionCount: openCount + inProgressCount,
            starredCount,
            closedCount,
            resolvedCount,
            totalRated: ratedCount,
            averageRating: avgRating,
            satisfiedRate: satRate,
            categoryCounts: catCounts as any
        };
    }, [tickets]);

    return (
        <div className="space-y-3">
            {/* KPI Cards Grid - Chỉ hiển thị đối với tài khoản Admin */}
            {effectiveIsAdmin && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                    {/* 1. Tổng số phiếu */}
                    <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500">Tổng phiếu</span>
                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Inbox className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-slate-900 tracking-tight">{stats.totalTickets}</span>
                            <span className="text-[11px] font-medium text-slate-400">chủ đề</span>
                        </div>
                    </div>

                    {/* 2. Cần xử lý */}
                    <div className="bg-white rounded-xl p-3 border border-amber-200/80 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-amber-700">Cần xử lý</span>
                            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                <AlertCircle className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-amber-600 tracking-tight">{stats.needsActionCount}</span>
                            <span className="text-[10px] text-amber-600/80 font-medium">({stats.openTickets} mới, {stats.inProgressTickets} đang xử lý)</span>
                        </div>
                    </div>

                    {/* 3. Cần theo dõi */}
                    <div className="bg-white rounded-xl p-3 border border-yellow-200/80 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-yellow-800">Cần theo dõi</span>
                            <div className="w-7 h-7 rounded-lg bg-yellow-50 text-yellow-600 flex items-center justify-center">
                                <Star className="w-4 h-4 fill-yellow-400" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-yellow-600 tracking-tight">{stats.starredCount}</span>
                            <span className="text-[11px] font-medium text-slate-400">phiếu ưu tiên</span>
                        </div>
                    </div>

                    {/* 4. Đã hoàn tất */}
                    <div className="bg-white rounded-xl p-3 border border-emerald-200/80 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-700">Đã giải quyết / Đóng</span>
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-emerald-600 tracking-tight">{stats.resolvedCount + stats.closedCount}</span>
                            <span className="text-[11px] font-medium text-slate-400">({Math.round(((stats.resolvedCount + stats.closedCount) / (stats.totalTickets || 1)) * 100)}%)</span>
                        </div>
                    </div>

                    {/* 5. Mức độ hài lòng chung */}
                    <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-indigo-50 to-blue-50/50 rounded-xl p-3 border border-indigo-200/80 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-900">Mức độ hài lòng</span>
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                                <Smile className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-indigo-700 tracking-tight">
                                {stats.totalRated > 0 ? `${stats.averageRating}⭐` : '100%'}
                            </span>
                            <span className="text-[10px] text-indigo-700/80 font-bold">
                                {stats.totalRated > 0 ? `(${stats.satisfiedRate}% tích cực • ${stats.totalRated} đánh giá)` : '(Chưa có đánh giá)'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Quick Chips / Breakdown */}
            <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mr-1 shrink-0">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    <span>Phân bố chủ đề:</span>
                </div>
                {(Object.keys(CATEGORY_METADATA) as (keyof typeof CATEGORY_METADATA)[]).map(cat => {
                    const meta = CATEGORY_METADATA[cat];
                    const count = stats.categoryCounts[cat] || 0;
                    const isSelected = activeCategory === cat;
                    return (
                        <button
                            key={cat}
                            onClick={() => onFilterCategory?.(isSelected ? 'ALL' : cat)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                isSelected
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : `${meta.bgClass} ${meta.colorClass} border ${meta.borderClass} hover:opacity-90`
                            }`}
                        >
                            <span>{meta.icon}</span>
                            <span>{meta.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-white/80 text-slate-700'
                            }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
