import React from 'react';
import {
    Star,
    MessageSquare,
    Clock,
    MapPin,
    Shield,
    CheckCircle2
} from 'lucide-react';
import { cleanEmployeeName, getShortenedEmployeeName, getShortStoreName } from '../../../core/lib/formatters';
import type { SupportTicket } from '../types';
import { CATEGORY_METADATA, PRIORITY_METADATA, STATUS_METADATA } from '../types';

interface Props {
    ticket: SupportTicket;
    onClick: () => void;
    onToggleStar?: (e: React.MouseEvent) => void;
    canManage?: boolean;
    maxIdLength?: number;
}

export default function TicketCardItem({
    ticket,
    onClick,
    onToggleStar,
    canManage = false,
    maxIdLength = 6
}: Props) {
    const categoryMeta = CATEGORY_METADATA[ticket.category] || CATEGORY_METADATA.khac;
    const priorityMeta = PRIORITY_METADATA[ticket.priority] || PRIORITY_METADATA.trung_binh;
    const statusMeta = STATUS_METADATA[ticket.status] || STATUS_METADATA.open;

    // Định dạng thời gian tương đối
    const formatRelativeTime = (isoString: string) => {
        try {
            const diff = Date.now() - new Date(isoString).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 60) return `${Math.max(1, mins)} phút trước`;
            const hours = Math.floor(mins / 60);
            if (hours < 24) return `${hours} giờ trước`;
            const days = Math.floor(hours / 24);
            if (days < 7) return `${days} ngày trước`;
            return new Date(isoString).toLocaleDateString('vi-VN');
        } catch {
            return '';
        }
    };

    return (
        <div
            onClick={onClick}
            className={`group bg-white rounded-xl p-3 sm:p-4 border transition-all cursor-pointer relative hover:shadow-md ${
                ticket.is_starred
                    ? 'border-yellow-300 bg-amber-50/20 shadow-xs'
                    : 'border-slate-200/80 hover:border-blue-300'
            }`}
        >
            {/* Top row: Ticket Code, Badges & Star */}
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Mã phiếu */}
                    <span className="font-mono font-extrabold text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                        {ticket.ticket_code}
                    </span>

                    {/* Phân loại chủ đề */}
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${categoryMeta.bgClass} ${categoryMeta.colorClass} ${categoryMeta.borderClass}`}>
                        <span>{categoryMeta.icon}</span>
                        <span>{categoryMeta.label}</span>
                    </span>

                    {/* Mức độ ưu tiên */}
                    <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md ${priorityMeta.bgClass} ${priorityMeta.colorClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${priorityMeta.badgeDot}`}></span>
                        <span>{priorityMeta.label}</span>
                    </span>
                </div>

                {/* Right controls: Status & Star button */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Trạng thái */}
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${statusMeta.bgClass} ${statusMeta.colorClass} ${statusMeta.borderClass}`}>
                        <span>{statusMeta.icon}</span>
                        <span>{statusMeta.label}</span>
                    </span>

                    {/* Gắn sao theo dõi */}
                    {onToggleStar && (
                        <button
                            type="button"
                            onClick={onToggleStar}
                            title={ticket.is_starred ? 'Bỏ theo dõi ưu tiên' : 'Đánh dấu cần theo dõi đặc biệt'}
                            className={`p-1 rounded-md transition-colors ${
                                ticket.is_starred
                                    ? 'text-yellow-500 hover:text-yellow-600 bg-yellow-50'
                                    : 'text-slate-300 hover:text-yellow-500 hover:bg-slate-50'
                            }`}
                        >
                            <Star className={`w-4 h-4 ${ticket.is_starred ? 'fill-yellow-400' : ''}`} />
                        </button>
                    )}
                </div>
            </div>

            {/* Middle: Title & Content Preview */}
            <div className="mb-2.5">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 leading-snug">
                    {ticket.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                    {ticket.content}
                </p>
            </div>

            {/* Bottom Row: Rule 11 Employee Badge + Store + Relative Time + Comment count */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                {/* Creator info adhering to Rule 11 (Supports Anonymous Mode) */}
                {ticket.is_anonymous ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1 shrink-0">
                            <span>🎭</span>
                            <span>Ẩn danh</span>
                        </span>
                        <span className="font-semibold text-slate-500 text-xs italic">Thành viên</span>
                        {ticket.creator_store && (
                            <span className="hidden sm:inline-flex items-center gap-0.5 text-[11px] text-slate-400 truncate max-w-[150px]">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {getShortStoreName(ticket.creator_store)}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span
                            className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                            style={{ minWidth: `${maxIdLength + 2.2}ch`, width: `${maxIdLength + 2.2}ch` }}
                        >
                            {ticket.creator_id}
                        </span>
                        <span
                            className="font-bold text-slate-700 truncate"
                            title={`Mã NV: ${ticket.creator_id} - ${cleanEmployeeName(ticket.creator_name)}`}
                        >
                            {getShortenedEmployeeName(ticket.creator_name)}
                        </span>
                        {ticket.creator_store && (
                            <span className="hidden sm:inline-flex items-center gap-0.5 text-[11px] text-slate-400 truncate max-w-[150px]">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {getShortStoreName(ticket.creator_store)}
                            </span>
                        )}
                    </div>
                )}

                {/* Right meta: Time, Comments, Satisfaction */}
                <div className="flex items-center gap-2.5 shrink-0 text-slate-400">
                    {/* Đánh giá hài lòng nếu có */}
                    {ticket.rating && ticket.rating > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
                            ⭐ {ticket.rating}/5
                        </span>
                    )}

                    {/* Số bình luận */}
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        <MessageSquare className="w-3 h-3 text-slate-400" />
                        <span>{ticket.comment_count || 0}</span>
                    </span>

                    {/* Thời gian */}
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(ticket.created_at)}</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
