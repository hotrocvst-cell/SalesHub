import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Palette, Sparkles } from 'lucide-react';

interface Props {
    onInsertTag?: (prefix: string, suffix: string) => void;
    showHelpDefault?: boolean;
}

export default function TextFormatHelperToolbar({
    onInsertTag,
    showHelpDefault = false
}: Props) {
    const [isHelpOpen, setIsHelpOpen] = useState(showHelpDefault);

    const handleInsert = (prefix: string, suffix: string) => {
        if (onInsertTag) {
            onInsertTag(prefix, suffix);
        }
    };

    return (
        <div className="space-y-1.5 font-avo">
            {/* Toolbar nhanh */}
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mr-0.5">
                        Chèn nhanh:
                    </span>

                    <button
                        type="button"
                        onClick={() => handleInsert('**', '**')}
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-[10.5px] border border-slate-300 transition cursor-pointer"
                        title="Chữ in đậm: **nội dung**"
                    >
                        B (Đậm)
                    </button>

                    <button
                        type="button"
                        onClick={() => handleInsert('*', '*')}
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 italic font-bold text-[10.5px] border border-slate-300 transition cursor-pointer"
                        title="Chữ in nghiêng: *nội dung*"
                    >
                        I (Nghiêng)
                    </button>

                    <button
                        type="button"
                        onClick={() => handleInsert('[red]', '[/red]')}
                        className="px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[10.5px] border border-rose-200 transition cursor-pointer"
                        title="Chữ màu đỏ: [red]nội dung[/red]"
                    >
                        Đỏ
                    </button>

                    <button
                        type="button"
                        onClick={() => handleInsert('[blue]', '[/blue]')}
                        className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-[10.5px] border border-blue-200 transition cursor-pointer"
                        title="Chữ màu xanh dương: [blue]nội dung[/blue]"
                    >
                        Xanh
                    </button>

                    <button
                        type="button"
                        onClick={() => handleInsert('[green]', '[/green]')}
                        className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[10.5px] border border-emerald-200 transition cursor-pointer"
                        title="Chữ màu xanh lá: [green]nội dung[/green]"
                    >
                        Xanh lá
                    </button>

                    <button
                        type="button"
                        onClick={() => handleInsert('[amber]', '[/amber]')}
                        className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 font-extrabold text-[10.5px] border border-amber-200 transition cursor-pointer"
                        title="Chữ màu vàng cam: [amber]nội dung[/amber]"
                    >
                        Vàng
                    </button>

                    <button
                        type="button"
                        onClick={() => handleInsert('[purple]', '[/purple]')}
                        className="px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-800 font-extrabold text-[10.5px] border border-purple-200 transition cursor-pointer"
                        title="Chữ màu tím: [purple]nội dung[/purple]"
                    >
                        Tím
                    </button>

                    <button
                        type="button"
                        onClick={() => handleInsert('[hl]', '[/hl]')}
                        className="px-2 py-0.5 rounded-md bg-yellow-100 hover:bg-yellow-200 text-amber-950 font-bold text-[10.5px] border border-yellow-300 transition cursor-pointer"
                        title="Tô nền highlight vàng: [hl]nội dung[/hl]"
                    >
                        Highlight
                    </button>

                    <button
                        type="button"
                        onClick={() => handleInsert('- ', '')}
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10.5px] border border-slate-300 transition cursor-pointer"
                        title="Đầu dòng gạch đầu: - nội dung"
                    >
                        • Gạch đầu dòng
                    </button>
                </div>

                {/* Nút bấm xem hướng dẫn chi tiết */}
                <button
                    type="button"
                    onClick={() => setIsHelpOpen(!isHelpOpen)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition select-none"
                >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{isHelpOpen ? 'Ẩn cú pháp' : 'Xem cú pháp định dạng'}</span>
                    {isHelpOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
            </div>

            {/* Bảng hướng dẫn chi tiết khi mở rộng */}
            {isHelpOpen && (
                <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200 rounded-2xl p-3 text-xs space-y-2 text-slate-800 animate-in fade-in duration-150 shadow-2xs">
                    <div className="font-black uppercase tracking-wider text-[11px] text-blue-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>HƯỚNG DẪN ĐỊNH DẠNG VĂN BẢN (TRONG EXCEL & NHẬP LIỆU TRỰC TIẾP):</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-white/90 p-2 rounded-xl border border-blue-100 space-y-1">
                            <div className="font-extrabold text-blue-800">1. Xuống dòng trong ô Excel & Web:</div>
                            <p className="text-slate-600 leading-snug">
                                • Trong ô Excel: Nhấn tổ hợp phím <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono font-bold">Alt + Enter</kbd>.
                            </p>
                            <p className="text-slate-600 leading-snug">
                                • Trong ô nhập web: Nhấn phím <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono font-bold">Enter</kbd> bình thường.
                            </p>
                        </div>

                        <div className="bg-white/90 p-2 rounded-xl border border-blue-100 space-y-1">
                            <div className="font-extrabold text-blue-800">2. Chữ Đậm & Nghiêng:</div>
                            <p className="text-slate-600 leading-snug">
                                • Chữ đậm: Gõ <code className="bg-slate-100 px-1 rounded font-bold text-slate-800">**Nội dung đậm**</code>
                            </p>
                            <p className="text-slate-600 leading-snug">
                                • Chữ nghiêng: Gõ <code className="bg-slate-100 px-1 rounded italic text-slate-800">*Nội dung nghiêng*</code>
                            </p>
                        </div>

                        <div className="bg-white/90 p-2 rounded-xl border border-blue-100 space-y-1">
                            <div className="font-extrabold text-blue-800">3. Chữ Có Màu Sắc Riêng:</div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10.5px] text-slate-700">
                                <div><code className="text-rose-600 font-bold">[red]Đỏ[/red]</code></div>
                                <div><code className="text-blue-600 font-bold">[blue]Xanh dương[/blue]</code></div>
                                <div><code className="text-emerald-600 font-bold">[green]Xanh lá[/green]</code></div>
                                <div><code className="text-amber-600 font-bold">[amber]Vàng cam[/amber]</code></div>
                                <div><code className="text-purple-600 font-bold">[purple]Tím[/purple]</code></div>
                                <div><code className="bg-amber-100 text-amber-900 px-1 rounded font-bold">[hl]Highlight[/hl]</code></div>
                            </div>
                        </div>

                        <div className="bg-white/90 p-2 rounded-xl border border-blue-100 space-y-1">
                            <div className="font-extrabold text-blue-800">4. Gạch đầu dòng danh sách:</div>
                            <p className="text-slate-600 leading-snug">
                                Đầu dòng gõ <code className="bg-slate-100 px-1 rounded font-bold text-slate-800">- </code> hoặc <code className="bg-slate-100 px-1 rounded font-bold text-slate-800">• </code> để tự động căn lề thụt đầu dòng đẹp mắt.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
