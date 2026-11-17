import React, { useState, useEffect } from 'react';
import {
    Flame,
    Trophy,
    Calendar,
    ChevronDown,
    ChevronUp,
    Sparkles,
    MessageSquare,
    Loader2
} from 'lucide-react';
import {
    fetchTopHotDocuments,
    isDocumentExpired
} from '../services/knowledgeService';
import type {
    KnowledgeTimeframe,
    TopHotDocumentItem
} from '../types/aiAssistantTypes';

interface Props {
    onAskFromDoc: (docTitle: string) => void;
}

export default function TopHotDocumentsWidget({ onAskFromDoc }: Props) {
    const [timeframe, setTimeframe] = useState<KnowledgeTimeframe>('WEEK');
    const [hotDocs, setHotDocs] = useState<TopHotDocumentItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isExpanded, setIsExpanded] = useState<boolean>(true);

    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
        fetchTopHotDocuments({ timeframe, limit: 5 }).then((res) => {
            if (isMounted) {
                if (res.success) {
                    setHotDocs(res.data);
                } else {
                    setHotDocs([]);
                }
                setIsLoading(false);
            }
        });
        return () => {
            isMounted = false;
        };
    }, [timeframe]);

    const getMedalBadge = (rank: number) => {
        if (rank === 1) return '🥇 Top 1';
        if (rank === 2) return '🥈 Top 2';
        if (rank === 3) return '🥉 Top 3';
        return `#${rank}`;
    };

    const getRankStyle = (rank: number) => {
        if (rank === 1) return 'bg-amber-500 text-white font-black shadow-xs';
        if (rank === 2) return 'bg-slate-400 text-white font-black shadow-xs';
        if (rank === 3) return 'bg-amber-700 text-white font-black shadow-xs';
        return 'bg-slate-100 text-slate-700 font-bold';
    };

    return (
        <div className="bg-gradient-to-r from-amber-50/70 via-orange-50/50 to-white rounded-2xl border border-amber-200/90 p-3 sm:p-4 shadow-xs space-y-3">
            {/* Header Widget */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                        <Flame className="w-4 h-4 fill-white" aria-hidden="true" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <h2 className="text-xs sm:text-[13px] font-black text-slate-900 uppercase tracking-wide">
                                Top Tài Liệu Tra Cứu Nhiều Nhất
                            </h2>
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-200/80 text-amber-900">
                                HOT
                            </span>
                        </div>
                        <p className="text-[10.5px] text-slate-600">
                            Xếp hạng tài liệu và kịch bản nghiệp vụ được nhân viên quan tâm nhất
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {/* Tab Bộ Lọc Thời Gian */}
                    <div className="flex items-center bg-white/90 p-0.5 rounded-xl border border-amber-200 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setTimeframe('WEEK')}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                                timeframe === 'WEEK'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Tuần này
                        </button>
                        <button
                            type="button"
                            onClick={() => setTimeframe('MONTH')}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                                timeframe === 'MONTH'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Tháng này
                        </button>
                        <button
                            type="button"
                            onClick={() => setTimeframe('ALL_TIME')}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                                timeframe === 'ALL_TIME'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Toàn thời gian
                        </button>
                    </div>

                    {/* Nút Thu gọn / Mở rộng */}
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 rounded-lg bg-white/80 hover:bg-white border border-amber-200 text-slate-600 transition cursor-pointer"
                        title={isExpanded ? 'Thu gọn bảng xếp hạng' : 'Mở rộng bảng xếp hạng'}
                        aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                    >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Nội dung danh sách Top tài liệu */}
            {isExpanded && (
                <div className="pt-1">
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500 font-medium">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                            <span>Đang tổng hợp dữ liệu lượt tra cứu...</span>
                        </div>
                    ) : hotDocs.length === 0 ? (
                        <div className="bg-white/80 rounded-xl p-4 text-center border border-dashed border-amber-200 space-y-1">
                            <Trophy className="w-6 h-6 text-amber-400 mx-auto" />
                            <p className="text-xs font-bold text-slate-700">
                                Chưa có lượt tra cứu nào trong kỳ này
                            </p>
                            <p className="text-[10.5px] text-slate-500">
                                Khi nhân viên tìm kiếm hoặc hỏi AI, tài liệu được trích dẫn sẽ tự động xuất hiện tại đây.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {hotDocs.map((item) => {
                                const isExpired = isDocumentExpired(item.valid_until);
                                return (
                                    <div
                                        key={item.document_id}
                                        className="bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-2xs hover:border-amber-300 transition flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            {/* Huy hiệu thứ hạng */}
                                            <span
                                                className={`px-2 py-0.5 rounded-md text-[10px] shrink-0 text-center ${getRankStyle(
                                                    item.rank
                                                )}`}
                                            >
                                                {getMedalBadge(item.rank)}
                                            </span>

                                            <div className="min-w-0 flex-1 space-y-0.5">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                                        {item.category}
                                                    </span>
                                                    {item.valid_until && (
                                                        <span
                                                            className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded ${
                                                                isExpired
                                                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                                            }`}
                                                        >
                                                            {isExpired ? '🚨 Hết hạn' : `HSD: ${item.valid_until.split('-').reverse().join('/')}`}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3
                                                    onClick={() => onAskFromDoc(item.title)}
                                                    className="text-xs font-black text-slate-900 truncate hover:text-blue-600 cursor-pointer"
                                                    title={item.title}
                                                >
                                                    {item.title}
                                                </h3>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Số lượt tra cứu */}
                                            <div className="text-right">
                                                <div className="text-xs sm:text-[13px] font-black text-amber-600 tabular-nums">
                                                    {item.view_count.toLocaleString('vi-VN')}
                                                    <span className="text-[10px] font-normal text-slate-500 ml-0.5">lượt</span>
                                                </div>
                                                <div className="text-[9.5px] text-slate-400 font-medium">
                                                    {timeframe === 'WEEK'
                                                        ? 'trong tuần'
                                                        : timeframe === 'MONTH'
                                                        ? 'trong tháng'
                                                        : 'tích lũy'}
                                                </div>
                                            </div>

                                            {/* Nút bấm hỏi nhanh */}
                                            <button
                                                type="button"
                                                onClick={() => onAskFromDoc(item.title)}
                                                className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                            >
                                                <MessageSquare className="w-3 h-3 shrink-0" />
                                                <span className="hidden sm:inline">Hỏi ngay</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
