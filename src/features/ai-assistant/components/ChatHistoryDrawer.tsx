import React from 'react';
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
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-2xs flex justify-end animate-in fade-in" onClick={onClose}>
            <div
                className="w-full max-w-xs sm:max-w-sm bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-black text-slate-900 uppercase">
                            Lịch sử trò chuyện ({sessions.length}/{MAX_CHAT_SESSIONS_PER_USER})
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
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
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Cuộc trò chuyện mới</span>
                    </button>

                    {sessions.length > 0 && (
                        <button
                            type="button"
                            onClick={onClearAll}
                            className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                            title="Xóa toàn bộ lịch sử chat"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Danh sách phiên */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                    {sessions.length === 0 ? (
                        <div className="py-10 text-center text-xs text-slate-400">
                            Chưa có lịch sử cuộc trò chuyện nào được lưu.
                        </div>
                    ) : (
                        sessions.map((sess) => {
                            const isActive = sess.id === activeSessionId;
                            return (
                                <div
                                    key={sess.id}
                                    className={`group flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                        isActive
                                            ? 'bg-blue-50 border-blue-300 text-blue-900'
                                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                    }`}
                                    onClick={() => {
                                        onSelectSession(sess);
                                        onClose();
                                    }}
                                >
                                    <div className="flex items-start gap-2 min-w-0 flex-1">
                                        <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold truncate">{sess.title}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {sess.message_count || sess.messages?.length || 0} tin nhắn • {formatDate(sess.updated_at)}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteSession(sess.id);
                                        }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                                        title="Xóa phiên này"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
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

