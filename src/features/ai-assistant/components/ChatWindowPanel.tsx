import React, { useRef, useEffect } from 'react';
import { Sparkles, Search, Send, Loader2 } from 'lucide-react';
import {
    MAX_MESSAGE_PAIRS_PER_SESSION,
    MAX_USER_INPUT_CHARS,
    type ChatAttachmentImage,
    type ChatMessage
} from '../types/aiAssistantTypes';
import ChatMessageBubble from './ChatMessageBubble';

interface Props {
    userName: string;
    effectiveRole: string;
    messages: ChatMessage[];
    quickPrompts: string[];
    inputText: string;
    queryMode: 'AI' | 'SEARCH';
    isThinking: boolean;
    isSyncingDocs: boolean;
    onChangeInput: (val: string) => void;
    onChangeMode: (mode: 'AI' | 'SEARCH') => void;
    onSend: (overrideQuestion?: string) => void;
    onOpenImage: (image: ChatAttachmentImage) => void;
}

export default function ChatWindowPanel({
    userName,
    effectiveRole,
    messages,
    quickPrompts,
    inputText,
    queryMode,
    isThinking,
    isSyncingDocs,
    onChangeInput,
    onChangeMode,
    onSend,
    onOpenImage
}: Props) {
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const isAtSessionTurnCap = messages.length >= MAX_MESSAGE_PAIRS_PER_SESSION * 2;

    useEffect(() => {
        if (messages.length === 0 && !isThinking) return;
        const el = messagesContainerRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, [messages, isThinking]);

    return (
        <div className="bg-slate-50/90 border border-slate-200 rounded-3xl flex flex-col min-h-[300px] max-h-[56dvh] sm:min-h-[420px] sm:max-h-[62dvh] overflow-hidden shadow-sm">
            {/* Luồng tin nhắn cuộn dọc */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-6 px-2 space-y-4">
                        <div className="w-14 h-14 rounded-3xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                            <Sparkles className="w-7 h-7" aria-hidden="true" />
                        </div>
                        <div className="space-y-1 max-w-md">
                            <h2 className="text-sm sm:text-base font-black text-slate-900">
                                Xin chào {userName || 'bạn'}! Cần tra cứu gì hôm nay?
                            </h2>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Đặt câu hỏi về quy trình ST, chính sách thi đua hoặc hướng dẫn nghiệp vụ. Tài liệu và ảnh gốc được lọc chuẩn theo vai trò <strong>{effectiveRole}</strong>.
                            </p>
                        </div>

                        {isSyncingDocs && quickPrompts.length === 0 ? (
                            <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2" aria-label="Đang tải gợi ý tra cứu">
                                {[0, 1, 2, 3].map((idx) => (
                                    <div key={idx} className="h-11 rounded-2xl bg-white/80 border border-slate-200 animate-pulse" />
                                ))}
                            </div>
                        ) : quickPrompts.length > 0 ? (
                            <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                                {quickPrompts.map((q, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        disabled={isThinking}
                                        onClick={() => onSend(q)}
                                        className="p-2.5 rounded-2xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-left text-xs font-semibold text-slate-700 hover:text-blue-800 transition cursor-pointer shadow-sm flex items-start gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
                                        <span className="line-clamp-2">{q}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-600 max-w-md pt-1">
                                Hiện chưa có tài liệu gợi ý nhanh cho vai trò của bạn. Bạn có thể nhập câu hỏi trực tiếp ở khung bên dưới.
                            </p>
                        )}
                    </div>
                ) : (
                    <>
                        {isAtSessionTurnCap && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 text-center font-semibold">
                                Phiên này đã đạt giới hạn {MAX_MESSAGE_PAIRS_PER_SESSION} lượt hỏi–đáp lưu Cloud. Các câu mới sẽ tiếp tục hiển thị và giữ {MAX_MESSAGE_PAIRS_PER_SESSION} lượt gần nhất.
                            </div>
                        )}
                        {messages.map((msg) => (
                            <ChatMessageBubble key={msg.id} message={msg} onOpenImage={onOpenImage} />
                        ))}
                        {isThinking && (
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 pl-2" role="status" aria-live="polite">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" aria-hidden="true" />
                                <span>Đang tra cứu kho tài liệu &amp; tổng hợp câu trả lời...</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Khung nhập câu hỏi cố định đáy */}
            <div className="bg-white border-t border-slate-200 p-2.5 sm:p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg" role="group" aria-label="Chế độ tra cứu">
                        <button
                            type="button"
                            aria-pressed={queryMode === 'AI'}
                            onClick={() => onChangeMode('AI')}
                            className={`px-2 py-1 rounded-md text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                queryMode === 'AI' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                            }`}
                        >
                            <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>AI Tổng Hợp</span>
                        </button>
                        <button
                            type="button"
                            aria-pressed={queryMode === 'SEARCH'}
                            onClick={() => onChangeMode('SEARCH')}
                            className={`px-2 py-1 rounded-md text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                                queryMode === 'SEARCH' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                            }`}
                            title="Tìm thẳng đoạn tài liệu & ảnh gốc (không tốn lượt AI)"
                        >
                            <Search className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>Tìm Tài Liệu Gốc</span>
                        </button>
                    </div>

                    <span className="text-[10.5px] font-mono tabular-nums text-slate-500">
                        {inputText.length}/{MAX_USER_INPUT_CHARS} ký tự {isSyncingDocs ? '• Đang đồng bộ...' : ''}
                    </span>
                </div>

                <div className="flex items-end gap-2">
                    <textarea
                        id="chat-question-input"
                        name="chatQuestion"
                        rows={2}
                        maxLength={MAX_USER_INPUT_CHARS}
                        value={inputText}
                        onChange={(e) => onChangeInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                                e.preventDefault();
                                onSend();
                            }
                        }}
                        aria-label="Nhập câu hỏi cho Trợ lý AI"
                        placeholder="Nhập câu hỏi tra cứu quy trình, thưởng thi đua, cách xử lý nghiệp vụ..."
                        className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white resize-none"
                    />
                    <button
                        type="button"
                        disabled={!inputText.trim() || isThinking}
                        onClick={() => onSend()}
                        aria-label="Gửi câu hỏi"
                        className="h-11 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 disabled:active:scale-100 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                    >
                        <Send className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline">Gửi</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

