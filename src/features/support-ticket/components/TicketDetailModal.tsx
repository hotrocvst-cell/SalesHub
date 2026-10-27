import React, { useState, useEffect } from 'react';
import {
    X,
    Send,
    Star,
    CheckCircle2,
    Clock,
    AlertCircle,
    Shield,
    Smile,
    MessageSquare,
    Check,
    CornerDownRight
} from 'lucide-react';
import { cleanEmployeeName, getShortenedEmployeeName, getShortStoreName } from '../../../core/lib/formatters';
import type { SupportTicket, TicketComment, TicketStatus } from '../types';
import {
    CATEGORY_METADATA,
    PRIORITY_METADATA,
    STATUS_METADATA,
    SATISFACTION_LEVELS
} from '../types';

interface Props {
    ticket: SupportTicket;
    comments: TicketComment[];
    onClose: () => void;
    onAddComment: (content: string, isAnonymous?: boolean) => Promise<void>;
    onUpdateStatus: (status: TicketStatus, resolutionNote?: string) => Promise<void>;
    onToggleStar: (isStarred: boolean) => Promise<void>;
    onSubmitRating: (rating: number, comment?: string) => Promise<void>;
    currentUserId: string;
    currentUserName: string;
    isAdmin: boolean;
}

export default function TicketDetailModal({
    ticket,
    comments,
    onClose,
    onAddComment,
    onUpdateStatus,
    onToggleStar,
    onSubmitRating,
    currentUserId,
    isAdmin
}: Props) {
    const [newComment, setNewComment] = useState('');
    const [isCommentAnonymous, setIsCommentAnonymous] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [resolutionNoteInput, setResolutionNoteInput] = useState(ticket.resolution_note || '');
    const [showClosePrompt, setShowClosePrompt] = useState(false);

    // Rating state
    const [selectedStars, setSelectedStars] = useState<number>(ticket.rating || 5);
    const [ratingCommentInput, setRatingCommentInput] = useState(ticket.rating_comment || '');
    const [isSubmittingRating, setIsSubmittingRating] = useState(false);
    const [hasRated, setHasRated] = useState(Boolean(ticket.rating && ticket.rating > 0));

    const categoryMeta = CATEGORY_METADATA[ticket.category] || CATEGORY_METADATA.khac;
    const priorityMeta = PRIORITY_METADATA[ticket.priority] || PRIORITY_METADATA.trung_binh;
    const statusMeta = STATUS_METADATA[ticket.status] || STATUS_METADATA.open;

    const isCreator = ticket.creator_id === currentUserId;
    const isClosedOrResolved = ticket.status === 'closed' || ticket.status === 'resolved';

    // Quick Admin Replies
    const QUICK_ADMIN_REPLIES = [
        'Hệ thống đã tiếp nhận yêu cầu và đang tiến hành xử lý.',
        'Đã cập nhật bản sửa lỗi trên hệ thống, bạn vui lòng tải lại trang (F5) để kiểm tra nhé.',
        'Đã chuyển thông tin đến đội ngũ phụ trách nghiệp vụ.',
        'Cảm ơn bạn đã đóng góp ý kiến quý báu giúp nâng cấp SalesHub!'
    ];

    const handleSendComment = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = newComment.trim();
        if (!trimmed || isSubmittingComment) return;

        setIsSubmittingComment(true);
        try {
            await onAddComment(trimmed, isCommentAnonymous);
            setNewComment('');
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleRatingSubmit = async () => {
        if (isSubmittingRating) return;
        setIsSubmittingRating(true);
        try {
            await onSubmitRating(selectedStars, ratingCommentInput.trim());
            setHasRated(true);
        } finally {
            setIsSubmittingRating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/80">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                            {ticket.ticket_code}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${categoryMeta.bgClass} ${categoryMeta.colorClass} ${categoryMeta.borderClass} shrink-0`}>
                            {categoryMeta.icon} {categoryMeta.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusMeta.bgClass} ${statusMeta.colorClass} ${statusMeta.borderClass} shrink-0`}>
                            {statusMeta.icon} {statusMeta.label}
                        </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {/* Toggle Star */}
                        {(isAdmin || isCreator) && (
                            <button
                                onClick={() => onToggleStar(!ticket.is_starred)}
                                title={ticket.is_starred ? 'Bỏ theo dõi' : 'Đánh dấu cần theo dõi'}
                                className={`p-1.5 rounded-lg transition-colors ${
                                    ticket.is_starred ? 'text-yellow-500 bg-yellow-50' : 'text-slate-400 hover:bg-slate-200'
                                }`}
                            >
                                <Star className={`w-4 h-4 ${ticket.is_starred ? 'fill-yellow-400' : ''}`} />
                            </button>
                        )}
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
                    {/* Ticket Title & Creator Info */}
                    <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                            {ticket.title}
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 flex-wrap">
                            {ticket.is_anonymous ? (
                                <>
                                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1">
                                        <span>🎭</span>
                                        <span>Ẩn danh</span>
                                    </span>
                                    <span className="font-bold text-slate-600 italic">Thành viên ẩn danh</span>
                                </>
                            ) : (
                                <>
                                    <span className="font-mono font-bold text-xs px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200">
                                        {ticket.creator_id}
                                    </span>
                                    <span className="font-bold text-slate-700">
                                        {cleanEmployeeName(ticket.creator_name)}
                                    </span>
                                </>
                            )}
                            {ticket.creator_store && (
                                <span className="text-slate-400">• {getShortStoreName(ticket.creator_store)}</span>
                            )}
                            <span className="text-slate-400">• {new Date(ticket.created_at).toLocaleString('vi-VN')}</span>
                        </div>
                    </div>

                    {/* Detailed Content Box */}
                    <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-200/80 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {ticket.content}
                    </div>

                    {/* Resolution Note if resolved or closed */}
                    {ticket.resolution_note && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900">
                            <div className="flex items-center gap-1.5 font-bold mb-1 text-emerald-800">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Kết quả xử lý từ Quản trị viên:</span>
                            </div>
                            <p className="whitespace-pre-wrap">{ticket.resolution_note}</p>
                            {ticket.closed_by && (
                                <p className="text-[11px] text-emerald-700 mt-1">Đóng bởi: <strong>{ticket.closed_by}</strong></p>
                            )}
                        </div>
                    )}

                    {/* ADMIN ACTION PANEL: Chuyển trạng thái & Đóng phiếu */}
                    {isAdmin && (
                        <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                                    <Shield className="w-4 h-4 text-purple-600" />
                                    <span>Tác vụ Quản trị viên:</span>
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {ticket.status !== 'in_progress' && ticket.status !== 'closed' && (
                                    <button
                                        onClick={() => onUpdateStatus('in_progress')}
                                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all"
                                    >
                                        Chuyển sang Đang xử lý
                                    </button>
                                )}
                                {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                                    <button
                                        onClick={() => setShowClosePrompt(true)}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all"
                                    >
                                        Đánh dấu Đã giải quyết
                                    </button>
                                )}
                                {ticket.status !== 'closed' && (
                                    <button
                                        onClick={() => setShowClosePrompt(true)}
                                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all"
                                    >
                                        Đóng phiếu hoàn tất
                                    </button>
                                )}
                                {ticket.status === 'closed' && (
                                    <button
                                        onClick={() => onUpdateStatus('open')}
                                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all"
                                    >
                                        Mở lại phiếu
                                    </button>
                                )}
                            </div>

                            {/* Prompt nhập ghi chú giải quyết khi bấm đóng/giải quyết */}
                            {showClosePrompt && (
                                <div className="mt-2 pt-2 border-t border-purple-200/80 space-y-2">
                                    <label className="block text-xs font-semibold text-purple-900">
                                        Ghi chú kết quả xử lý (tùy chọn):
                                    </label>
                                    <textarea
                                        value={resolutionNoteInput}
                                        onChange={(e) => setResolutionNoteInput(e.target.value)}
                                        placeholder="Ví dụ: Đã sửa lỗi font chữ trên mobile, đã hướng dẫn quy trình..."
                                        rows={2}
                                        className="w-full text-xs p-2 bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    />
                                    <div className="flex justify-end gap-1.5">
                                        <button
                                            onClick={() => setShowClosePrompt(false)}
                                            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            onClick={async () => {
                                                await onUpdateStatus('closed', resolutionNoteInput.trim());
                                                setShowClosePrompt(false);
                                            }}
                                            className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold"
                                        >
                                            Xác nhận Đóng Phiếu
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SATISFACTION RATING SECTION */}
                    {isClosedOrResolved && (
                        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 sm:p-4">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-2">
                                <Smile className="w-4 h-4 text-amber-600" />
                                <span>Đánh giá mức độ hài lòng về chất lượng hỗ trợ:</span>
                            </div>

                            {hasRated ? (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1 text-sm font-bold text-amber-700">
                                        {Array.from({ length: ticket.rating || selectedStars }).map((_, i) => (
                                            <span key={i}>⭐</span>
                                        ))}
                                        <span className="ml-1 text-xs">({ticket.rating || selectedStars}/5 sao)</span>
                                    </div>
                                    {(ticket.rating_comment || ratingCommentInput) && (
                                        <p className="text-xs text-slate-600 italic mt-1">"{ticket.rating_comment || ratingCommentInput}"</p>
                                    )}
                                </div>
                            ) : (isCreator || isAdmin) ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setSelectedStars(star)}
                                                className={`text-xl transition-transform hover:scale-110 ${star <= selectedStars ? 'opacity-100' : 'opacity-30'}`}
                                            >
                                                ⭐
                                            </button>
                                        ))}
                                        <span className="text-xs font-bold text-amber-800 ml-2">
                                            {SATISFACTION_LEVELS.find(s => s.rating === selectedStars)?.label}
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        value={ratingCommentInput}
                                        onChange={(e) => setRatingCommentInput(e.target.value)}
                                        placeholder="Để lại nhận xét hoặc cảm nhận của bạn (tùy chọn)..."
                                        className="w-full text-xs p-2 bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                    <button
                                        onClick={handleRatingSubmit}
                                        disabled={isSubmittingRating}
                                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                    >
                                        {isSubmittingRating ? 'Đang gửi...' : 'Gửi Đánh Giá'}
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">Người tạo phiếu chưa gửi đánh giá.</p>
                            )}
                        </div>
                    )}

                    {/* COMMENTS / DISCUSSION THREAD */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <MessageSquare className="w-4 h-4 text-blue-600" />
                                <span>Trao đổi & Bình luận ({comments.length})</span>
                            </h4>
                        </div>

                        {/* List of comments */}
                        <div className="space-y-2.5">
                            {comments.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-2 text-center">Chưa có bình luận nào. Hãy bắt đầu cuộc trò chuyện bên dưới.</p>
                            ) : (
                                comments.map(c => (
                                    <div
                                        key={c.id}
                                        className={`rounded-xl p-3 text-xs transition-all ${
                                            c.is_admin_reply
                                                ? 'bg-blue-50/70 border border-blue-200 text-blue-950 ml-2 sm:ml-4'
                                                : 'bg-slate-50 border border-slate-200/80 text-slate-800'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-1.5">
                                                {c.is_anonymous ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                                        <span>🎭</span>
                                                        <span>Thành viên ẩn danh</span>
                                                    </span>
                                                ) : (
                                                    <>
                                                        <span className="font-bold text-slate-900">{c.author_name}</span>
                                                        {c.is_admin_reply && (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-600 text-white">
                                                                <Shield className="w-2.5 h-2.5" /> Admin
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                                {c.author_store && (
                                                    <span className="text-[10px] text-slate-400">({getShortStoreName(c.author_store)})</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(c.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(c.created_at).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                        <p className="whitespace-pre-wrap leading-relaxed mt-0.5">{c.content}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Quick Reply Chips for Admin */}
                        {isAdmin && (
                            <div className="pt-2">
                                <span className="text-[11px] font-semibold text-slate-500 block mb-1">Phản hồi nhanh mẫu:</span>
                                <div className="flex flex-wrap gap-1">
                                    {QUICK_ADMIN_REPLIES.map((reply, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setNewComment(reply)}
                                            className="text-[10.5px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors text-left truncate max-w-full"
                                        >
                                            {reply}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer: Comment Input Form with Anonymous Toggle */}
                <form onSubmit={handleSendComment} className="p-3 border-t border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors">
                            <input
                                type="checkbox"
                                checked={isCommentAnonymous}
                                onChange={(e) => setIsCommentAnonymous(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span>🎭 Bình luận ẩn danh (Không hiện tên/mã NV)</span>
                        </label>
                        {isCommentAnonymous && (
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
                                Đang bật ẩn danh
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder={isCommentAnonymous ? "Nhập bình luận ẩn danh..." : "Nhập nội dung trao đổi..."}
                            className="flex-1 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={!newComment.trim() || isSubmittingComment}
                            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all disabled:opacity-50"
                        >
                            <Send className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Gửi</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
