import React, { useState } from 'react';
import {
    Bot,
    User,
    Copy,
    Check,
    BookOpen,
    Image as ImageIcon,
    Zap,
    Search,
    ZoomIn,
    AlertTriangle,
    Sparkles,
    HelpCircle,
    ArrowRight
} from 'lucide-react';
import type { ChatAttachmentImage, ChatMessage } from '../types/aiAssistantTypes';

interface Props {
    message: ChatMessage;
    onOpenImage: (image: ChatAttachmentImage) => void;
    onSelectClarification?: (query: string, mode?: 'AI' | 'SEARCH') => void;
    onAskAiSynthesis?: (question: string) => void;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g);
    return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
                <strong key={idx} className="font-bold text-slate-900">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return (
                <code key={idx} className="px-1 py-0.5 bg-slate-100 text-indigo-700 rounded text-[11px] font-mono">
                    {part.slice(1, -1)}
                </code>
            );
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return (
                <em key={idx} className="italic text-slate-700">
                    {part.slice(1, -1)}
                </em>
            );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
}

function SimpleMarkdownContent({ content }: { content: string }) {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const nodes: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            i++;
            continue;
        }

        // Bảng Markdown
        if (trimmed.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|') && lines[i + 1].includes('---')) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }
            const parseRow = (rowStr: string) =>
                rowStr
                    .replace(/^\|/, '')
                    .replace(/\|$/, '')
                    .split('|')
                    .map((c) => c.trim());

            const headers = parseRow(tableLines[0]);
            const bodyRows = tableLines.slice(2).map(parseRow);

            nodes.push(
                <div key={`tbl_${i}`} className="my-2 max-w-full overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-[11.5px] border-collapse text-left">
                        <thead className="bg-slate-100 text-slate-800 font-bold">
                            <tr>
                                {headers.map((h, hIdx) => (
                                    <th key={hIdx} className="px-2 py-1.5 border-b border-r last:border-r-0 border-slate-200 whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {bodyRows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-50">
                                    {headers.map((_, cIdx) => (
                                        <td key={cIdx} className="px-2 py-1.5 border-r last:border-r-0 border-slate-100">
                                            {renderInlineFormatting(row[cIdx] || '')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            continue;
        }

        if (trimmed === '---') {
            nodes.push(<hr key={`hr_${i}`} className="my-2 border-slate-200" />);
            i++;
            continue;
        }

        // Tiêu đề
        const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (headingMatch) {
            nodes.push(
                <div key={`h_${i}`} className="font-bold text-slate-900 text-xs sm:text-[13px] mt-2 mb-1">
                    {renderInlineFormatting(headingMatch[2])}
                </div>
            );
            i++;
            continue;
        }

        // Gạch đầu dòng
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            nodes.push(
                <div key={`li_${i}`} className="flex items-start gap-1.5 pl-1 my-0.5">
                    <span className="text-blue-600 font-bold mt-0.5 shrink-0">•</span>
                    <span className="flex-1">{renderInlineFormatting(trimmed.slice(2))}</span>
                </div>
            );
            i++;
            continue;
        }

        nodes.push(
            <p key={`p_${i}`} className="my-1 leading-relaxed">
                {renderInlineFormatting(line)}
            </p>
        );
        i++;
    }

    return <div className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">{nodes}</div>;
}

export default function ChatMessageBubble({
    message,
    onOpenImage,
    onSelectClarification,
    onAskAiSynthesis
}: Props) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === 'user';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch { }
    };

    if (isUser) {
        return (
            <div className="flex justify-end gap-2 items-start">
                <div className="min-w-0 max-w-[88%] sm:max-w-[78%] bg-blue-600 text-white px-3.5 py-2.5 rounded-2xl rounded-tr-sm shadow-sm text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                </div>
                <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
                    <User className="w-4 h-4" />
                </div>
            </div>
        );
    }

    const isError = Boolean(message.isError);
    const displayContent = isError ? message.content.replace(/^⚠️\s*/u, '') : message.content;
    const uniqueSources = React.useMemo(() => {
        if (!message.sources || message.sources.length === 0) return [];
        const seen = new Set<string>();
        return message.sources.filter((src) => {
            const key = src.documentId || src.documentTitle;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [message.sources]);

    return (
        <div className="flex justify-start gap-2 items-start">
            <div
                className={`w-7 h-7 rounded-xl text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${
                    isError ? 'bg-rose-600' : 'bg-blue-600'
                }`}
                aria-hidden="true"
            >
                {isError ? <AlertTriangle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
                className={`min-w-0 max-w-[92%] sm:max-w-[85%] rounded-2xl rounded-tl-sm p-3 sm:p-3.5 shadow-sm space-y-2.5 break-words border ${
                    isError ? 'bg-rose-50/75 border-rose-200' : 'bg-white border-slate-200/90'
                }`}
            >
                {/* Header nhỏ của bot */}
                <div className={`flex items-center justify-between gap-2 flex-wrap border-b pb-1.5 ${isError ? 'border-rose-200/80' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[11px] font-bold ${isError ? 'text-rose-900' : 'text-slate-800'}`}>
                            {isError ? 'Thông báo hệ thống' : 'Trợ Lý SalesHub'}
                        </span>
                        {message.fromCache && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                <Zap className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                                Cache Nhanh
                            </span>
                        )}
                        {message.mode === 'SEARCH' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                <Search className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                                Tài liệu gốc
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleCopy}
                        className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        title="Sao chép câu trả lời"
                        aria-label={copied ? 'Đã sao chép nội dung' : 'Sao chép câu trả lời'}
                    >
                        {copied ? <Check className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" /> : <Copy className="w-3 h-3 shrink-0" aria-hidden="true" />}
                        <span>{copied ? 'Đã copy' : 'Copy'}</span>
                    </button>
                </div>

                {/* Nội dung phản hồi */}
                <SimpleMarkdownContent content={displayContent} />

                {/* Danh sách lựa chọn làm rõ khi có nhiều tài liệu tương đồng (VD: "QR MÁY LỌC NƯỚC", "QR Nồi cơm"...) */}
                {message.clarificationOptions && message.clarificationOptions.length > 0 && (
                    <div className="pt-1.5 space-y-2 border-t border-amber-200/70 bg-amber-50/70 p-2.5 rounded-2xl border">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                            <span>Chạm chọn tài liệu cụ thể bạn muốn xem nguyên văn:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {message.clarificationOptions.map((opt, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => onSelectClarification?.(opt.query, 'SEARCH')}
                                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100/80 border border-amber-300 hover:border-amber-400 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                                >
                                    <Search className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                                    <span>{opt.label}</span>
                                    <ArrowRight className="w-3 h-3 text-amber-500 shrink-0 opacity-60" aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Hình ảnh gốc đính kèm (tối đa 3 ảnh) */}
                {message.images && message.images.length > 0 && (
                    <div className="pt-1 space-y-1.5">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                            <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                            <span className="tabular-nums">Hình ảnh tài liệu gốc đính kèm ({message.images.length}):</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {message.images.map((img, idx) => (
                                <button
                                    key={img.storagePath + idx}
                                    type="button"
                                    onClick={() => onOpenImage(img)}
                                    aria-label={`Xem phóng to ảnh tài liệu: ${img.documentTitle}`}
                                    className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 hover:border-blue-400 transition text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    title="Bấm để phóng to và tải ảnh gốc"
                                >
                                    <div className="h-32 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                                        <img
                                            src={img.signedUrl}
                                            alt={img.caption || img.documentTitle}
                                            loading="lazy"
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        />
                                    </div>
                                    <div className="p-1.5 bg-white flex items-center justify-between gap-1">
                                        <span className="text-[10px] font-bold text-slate-700 truncate">{img.documentTitle}</span>
                                        <ZoomIn className="w-3 h-3 text-blue-600 shrink-0" aria-hidden="true" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Trích dẫn tài liệu nguồn */}
                {uniqueSources.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                            <BookOpen className="w-3 h-3 shrink-0" aria-hidden="true" />
                            Nguồn:
                        </span>
                        {uniqueSources.slice(0, 4).map((src, idx) => (
                            <span
                                key={`${src.documentId}_${idx}`}
                                title={src.sectionTitle ? `${src.documentTitle} — ${src.sectionTitle}` : src.documentTitle}
                                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200/80"
                            >
                                {src.documentTitle}
                            </span>
                        ))}
                    </div>
                )}

                {/* Tùy chọn chuyển sang AI tổng hợp nếu muốn tóm tắt / kịch bản */}
                {message.mode === 'SEARCH' && !isError && onAskAiSynthesis && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10.5px] text-slate-500 italic">
                            💡 Cần AI tóm tắt ngắn hoặc viết kịch bản tư vấn?
                        </span>
                        <button
                            type="button"
                            onClick={() => onAskAiSynthesis(message.originalQuestion || displayContent)}
                            className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            title="Chuyển câu hỏi này sang chế độ AI Tổng Hợp"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                            <span>Nhờ AI Tổng Hợp Lại</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

