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
    const chatEndRef = useRef<HTMLDivElement>(null);
    const isAtSessionTurnCap = messages.length >= MAX_MESSAGE_PAIRS_PER_SESSION * 2;

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    return (
        <div className="bg-slate-50/90 border border-slate-200 rounded-3xl flex flex-col min-h-[62vh] max-h-[75vh] overflow-hidden shadow-2xs">
            {/* Luồng tin nhắn cuộn dọc */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-6 px-2 space-y-4">
                        <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
                            <Sparkles className="w-7 h-7" />
                        </div>
                        <div className="space-y-1 max-w-md">
                            <h2 className="text-sm sm:text-base font-black text-slate-900">
                                Xin chào {userName || 'bạn'}! Cần tra cứu gì hôm nay?
                            </h2>
                            <p className="text-xs text-slate-500">
                                Đặt câu hỏi về quy trình ST, chính sách thi đua hoặc hướng dẫn nghiệp vụ. Tài liệu và ảnh gốc được lọc chuẩn theo vai trò <strong>{effectiveRole}</strong>.
                            </p>
                        </div>

                        {quickPrompts.length > 0 && (
                            <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                                {quickPrompts.map((q, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => onSend(q)}
                                        className="p-2.5 rounded-2xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-left text-xs font-semibold text-slate-700 hover:text-blue-800 transition cursor-pointer shadow-2xs"
                                    >
                                        ✨ {q}
                                    </button>
                                ))}
                            </div>
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
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 pl-2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                <span>Đang tra cứu kho tài liệu &amp; tổng hợp câu trả lời...</span>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </>
                )}
            </div>

            {/* Khung nhập câu hỏi cố định đáy */}
            <div className="bg-white border-t border-slate-200 p-2.5 sm:p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                        <button
                            type="button"
                            onClick={() => onChangeMode('AI')}
                            className={`px-2 py-1 rounded-md text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer ${
                                queryMode === 'AI' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600'
                            }`}
                        >
                            <Sparkles className="w-3 h-3" />
                            <span>AI Tổng Hợp</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onChangeMode('SEARCH')}
                            className={`px-2 py-1 rounded-md text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer ${
                                queryMode === 'SEARCH' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600'
                            }`}
                            title="Tìm thẳng đoạn tài liệu & ảnh gốc (không tốn lượt AI)"
                        >
                            <Search className="w-3 h-3" />
                            <span>Tìm Tài Liệu Gốc</span>
                        </button>
                    </div>

                    <span className="text-[10.5px] font-mono text-slate-400">
                        {inputText.length}/{MAX_USER_INPUT_CHARS} ký tự {isSyncingDocs ? '• Đang đồng bộ...' : ''}
                    </span>
                </div>

                <div className="flex items-end gap-2">
                    <textarea
                        rows={2}
                        maxLength={MAX_USER_INPUT_CHARS}
                        value={inputText}
                        onChange={(e) => onChangeInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                onSend();
                            }
                        }}
                        placeholder="Nhập câu hỏi tra cứu quy trình, thưởng thi đua, cách xử lý nghiệp vụ..."
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-[13px] text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                    />
                    <button
                        type="button"
                        disabled={!inputText.trim() || isThinking}
                        onClick={() => onSend()}
                        className="h-11 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-40 active:scale-95 shrink-0"
                    >
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">Gửi</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

