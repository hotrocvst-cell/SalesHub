import React, { useState } from 'react';
import {
    X,
    Sparkles,
    FileCode,
    Check,
    Copy,
    Tag,
    Coins,
    Target,
    HelpCircle,
    Info,
    Layers,
    ChevronRight
} from 'lucide-react';
import {
    RED_KEYWORDS,
    BLUE_KEYWORDS,
    GREEN_KEYWORDS,
    AMBER_KEYWORDS,
    PURPLE_KEYWORDS,
    HIGHLIGHT_KEYWORDS
} from '../utils/campaignTextBeautifier';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function BeautifierConfigGuideModal({ isOpen, onClose }: Props) {
    const [copiedPath, setCopiedPath] = useState(false);
    const [copiedSnippet, setCopiedSnippet] = useState(false);

    if (!isOpen) return null;

    const filePath = 'src/features/campaign-directory/utils/campaignTextBeautifier.ts';

    const sampleSnippet = `// Mở file: src/features/campaign-directory/utils/campaignTextBeautifier.ts
// Thêm từ khóa mới của bạn vào mảng tương ứng:

export const RED_KEYWORDS: string[] = [
    ...RED_KEYWORDS,
    'từ khóa thưởng nóng mới',
    'nhân 3 điểm'
];

export const BLUE_KEYWORDS: string[] = [
    ...BLUE_KEYWORDS,
    'đối tác ngân hàng mới',
    'thương hiệu mới'
];`;

    const handleCopyPath = () => {
        navigator.clipboard.writeText(filePath);
        setCopiedPath(true);
        setTimeout(() => setCopiedPath(false), 2000);
    };

    const handleCopySnippet = () => {
        navigator.clipboard.writeText(sampleSnippet);
        setCopiedSnippet(true);
        setTimeout(() => setCopiedSnippet(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-avo animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                                HƯỚNG DẪN CÁCH TỰ THAY ĐỔI & CẬP NHẬT CƠ CHẾ NHẬN DIỆN
                            </h3>
                            <p className="text-[11px] text-purple-700 mt-0.5">
                                Dành riêng cho Quản trị viên (Admin) tùy biến bộ từ khóa định dạng tự động thông minh
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                    {/* Thông báo tổng quan */}
                    <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-slate-700 leading-relaxed">
                            <p className="font-bold text-purple-950">
                                Cơ chế hoạt động của bộ nhận diện thông minh (Smart Beautifier):
                            </p>
                            <p className="text-[11px] text-purple-900">
                                Khi bật tùy chọn <strong>"Tự động định dạng thông minh"</strong> lúc tải file Excel hoặc dán dữ liệu, hệ thống sẽ tự động quét văn bản thô, nhận diện các từ khóa kinh doanh và tự động bọc thẻ in đậm, màu sắc, highlight và gạch đầu dòng bullet.
                            </p>
                        </div>
                    </div>

                    {/* Vị trí file cấu hình */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-black text-slate-900 uppercase tracking-wide text-xs">
                                <FileCode className="w-4 h-4 text-blue-600" />
                                <span>1. Vị trí file mã nguồn chứa bộ từ khóa:</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyPath}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer bg-white px-2 py-0.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                            >
                                {copiedPath ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedPath ? 'Đã copy!' : 'Sao chép đường dẫn'}</span>
                            </button>
                        </div>

                        <div className="bg-slate-900 text-slate-200 p-2.5 rounded-xl font-mono text-xs select-all break-all">
                            {filePath}
                        </div>
                        <p className="text-[11px] text-slate-500">
                            * Bạn chỉ cần mở file này trong trình soạn thảo mã nguồn và bổ sung thêm từ khóa vào các mảng có sẵn.
                        </p>
                    </div>

                    {/* Các nhóm từ khóa hiện tại */}
                    <div className="space-y-2">
                        <div className="font-black text-slate-900 uppercase tracking-wide text-xs flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-purple-600" />
                            <span>2. Các mảng từ khóa nhận diện tương ứng với từng màu:</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* 1. Đỏ */}
                            <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-rose-900 flex items-center gap-1 text-xs">
                                        <span className="w-2 h-2 rounded-full bg-rose-600" />
                                        Màu Đỏ [red] (Thưởng nóng, nhân đôi)
                                    </span>
                                    <span className="text-[10px] font-mono text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded font-bold">
                                        RED_KEYWORDS
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {RED_KEYWORDS.map(k => (
                                        <span key={k} className="px-1.5 py-0.5 rounded-md bg-white border border-rose-200 text-rose-800 text-[10.5px] font-bold">
                                            {k}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 2. Xanh Dương */}
                            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-blue-900 flex items-center gap-1 text-xs">
                                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                                        Màu Xanh [blue] (Đối tác, ngân hàng, hãng)
                                    </span>
                                    <span className="text-[10px] font-mono text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded font-bold">
                                        BLUE_KEYWORDS
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {BLUE_KEYWORDS.map(k => (
                                        <span key={k} className="px-1.5 py-0.5 rounded-md bg-white border border-blue-200 text-blue-800 text-[10.5px] font-bold">
                                            {k}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 3. Xanh Lá */}
                            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-emerald-900 flex items-center gap-1 text-xs">
                                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                        Màu Xanh Lá [green] (Quà tặng, trợ giá)
                                    </span>
                                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">
                                        GREEN_KEYWORDS
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {GREEN_KEYWORDS.map(k => (
                                        <span key={k} className="px-1.5 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-800 text-[10.5px] font-bold">
                                            {k}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 4. Vàng Cam */}
                            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-amber-900 flex items-center gap-1 text-xs">
                                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                                        Màu Vàng [amber] (Giải thưởng, Top 1)
                                    </span>
                                    <span className="text-[10px] font-mono text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-bold">
                                        AMBER_KEYWORDS
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {AMBER_KEYWORDS.map(k => (
                                        <span key={k} className="px-1.5 py-0.5 rounded-md bg-white border border-amber-200 text-amber-800 text-[10.5px] font-bold">
                                            {k}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 5. Tím */}
                            <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-purple-900 flex items-center gap-1 text-xs">
                                        <span className="w-2 h-2 rounded-full bg-purple-600" />
                                        Màu Tím [purple] (Bảo hiểm, SIM, tiện ích)
                                    </span>
                                    <span className="text-[10px] font-mono text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded font-bold">
                                        PURPLE_KEYWORDS
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {PURPLE_KEYWORDS.map(k => (
                                        <span key={k} className="px-1.5 py-0.5 rounded-md bg-white border border-purple-200 text-purple-800 text-[10.5px] font-bold">
                                            {k}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 6. Highlight */}
                            <div className="p-3 bg-yellow-50/70 border border-yellow-200 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-amber-950 flex items-center gap-1 text-xs">
                                        <span className="w-2 h-2 rounded-full bg-yellow-400" />
                                        Tô Nền [hl] (Vượt mốc, ưu tiên)
                                    </span>
                                    <span className="text-[10px] font-mono text-amber-900 bg-yellow-200/80 px-1.5 py-0.2 rounded font-bold">
                                        HIGHLIGHT_KEYWORDS
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {HIGHLIGHT_KEYWORDS.map(k => (
                                        <span key={k} className="px-1.5 py-0.5 rounded-md bg-white border border-yellow-300 text-amber-900 text-[10.5px] font-bold">
                                            {k}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cơ chế tự động Regex cho Tiền & Target */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                        <div className="font-black text-slate-900 uppercase tracking-wide text-xs flex items-center gap-1.5">
                            <Coins className="w-4 h-4 text-emerald-600" />
                            <span>3. Cơ chế tự động nhận diện Số tiền & Mốc Target (Không cần khai báo từ khóa):</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                                <div className="font-bold text-slate-800 flex items-center gap-1">
                                    <Coins className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Tự động in đậm số tiền thưởng & giảm giá:</span>
                                </div>
                                <p className="text-slate-600 leading-snug">
                                    Hệ thống tự động phát hiện số tiền như <code className="bg-slate-100 px-1 font-bold">150.000đ</code>, <code className="bg-slate-100 px-1 font-bold">2.500.000đ</code>, <code className="bg-slate-100 px-1 font-bold">500k</code>, <code className="bg-slate-100 px-1 font-bold">2.5tr</code> để in đậm <strong>**...**</strong>.
                                </p>
                            </div>

                            <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                                <div className="font-bold text-slate-800 flex items-center gap-1">
                                    <Target className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Tự động in đậm mốc Target & tỷ lệ:</span>
                                </div>
                                <p className="text-slate-600 leading-snug">
                                    Hệ thống tự động phát hiện <code className="bg-slate-100 px-1 font-bold">100% target</code>, <code className="bg-slate-100 px-1 font-bold">&gt;= 45%</code> để in đậm <strong>**...**</strong>.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Mẫu code thao tác nhanh */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-slate-900 uppercase tracking-wide text-xs">
                                4. Đoạn mã mẫu để thêm từ khóa mới:
                            </span>
                            <button
                                type="button"
                                onClick={handleCopySnippet}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 cursor-pointer bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200 transition"
                            >
                                {copiedSnippet ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedSnippet ? 'Đã copy!' : 'Sao chép đoạn mã'}</span>
                            </button>
                        </div>

                        <pre className="p-3 bg-slate-900 text-slate-200 rounded-2xl font-mono text-[11px] overflow-x-auto leading-relaxed">
                            {sampleSnippet}
                        </pre>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs active:scale-95"
                    >
                        Đã hiểu &amp; Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}

