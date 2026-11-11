import React, { useEffect, useRef } from 'react';
import { History, Plus, Trash2, MessageSquare, X } from 'lucide-react';
import {
    MAX_CHAT_SESSIONS_PER_USER,
    MAX_MESSAGE_PAIRS_PER_SESSION,
    MAX_SESSION_AGE_DAYS,
    type AiChatSession
} from '../types/aiAssistantTypes';
import { formatDate } from '../../../core/lib/formatters';

interface Props {
    sessions: AiChatSession[];
    activeSessionId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onSelectSession: (session: AiChatSession) => void;
    onNewChat: () => void;
    onDeleteSession: (sessionId: string) => void;
    onClearAll: () => void;
}

export default function ChatHistoryDrawer({
    sessions,
    activeSessionId,
    isOpen,
    onClose,
    onSelectSession,
    onNewChat,
    onDeleteSession,
    onClearAll
}: Props) {
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const prevFocused = document.activeElement as HTMLElement | null;
        closeBtnRef.current?.focus();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            prevFocused?.focus?.();
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex justify-end"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="chat-history-drawer-title"
                className="w-full max-w-xs sm:max-w-sm bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2 min-w-0">
                        <History className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                        <h2 id="chat-history-drawer-title" className="text-xs font-black text-slate-900 uppercase tabular-nums truncate">
                            Lịch sử trò chuyện ({sessions.length}/{MAX_CHAT_SESSIONS_PER_USER})
                        </h2>
                    </div>
                    <button
                        ref={closeBtnRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng lịch sử trò chuyện"
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>

                {/* Thông báo giới hạn lưu trữ */}
                <div className="px-3.5 py-2 bg-blue-50/70 border-b border-blue-100 text-[10.5px] text-blue-800 leading-relaxed">
                    Lưu tối đa <strong>{MAX_CHAT_SESSIONS_PER_USER} phiên</strong> gần nhất, mỗi phiên tối đa{' '}
                    <strong>{MAX_MESSAGE_PAIRS_PER_SESSION} lượt hỏi–đáp</strong> và tự động dọn sau{' '}
                    <strong>{MAX_SESSION_AGE_DAYS} ngày</strong>.
                </div>

                {/* Nút tạo mới */}
                <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            onNewChat();
                            onClose();
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                    >
                        <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Cuộc trò chuyện mới</span>
                    </button>

                    {sessions.length > 0 && (
                        <button
                            type="button"
                            onClick={onClearAll}
                            aria-label="Xóa toàn bộ lịch sử chat"
                            className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                            title="Xóa toàn bộ lịch sử chat"
                        >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                    )}
                </div>

                {/* Danh sách phiên */}
                <div className="flex-1 overflow-y-auto overscroll-contain p-2.5 space-y-1.5">
                    {sessions.length === 0 ? (
                        <div className="py-10 text-center text-xs text-slate-500 px-4">
                            Chưa có lịch sử cuộc trò chuyện nào được lưu.
                        </div>
                    ) : (
                        sessions.map((sess) => {
                            const isActive = sess.id === activeSessionId;
                            return (
                                <div
                                    key={sess.id}
                                    className={`group flex items-center justify-between gap-1.5 p-1.5 rounded-xl border transition ${
                                        isActive
                                            ? 'bg-blue-50 border-blue-300 text-blue-900'
                                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSelectSession(sess);
                                            onClose();
                                        }}
                                        className="flex items-start gap-2 min-w-0 flex-1 p-1 rounded-lg text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    >
                                        <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} aria-hidden="true" />
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold truncate">{sess.title}</div>
                                            <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                                                {sess.message_count || sess.messages?.length || 0} tin nhắn • {formatDate(sess.updated_at)}
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onDeleteSession(sess.id)}
                                        aria-label={`Xóa phiên trò chuyện: ${sess.title}`}
                                        className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                                        title="Xóa phiên này"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

