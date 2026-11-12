import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Sparkles, Trophy, AlertTriangle, MessageSquare } from 'lucide-react';
import type { SmartRemarkAnalysis } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    remarks: SmartRemarkAnalysis;
    storeName: string;
}

export default function FocusCampaignRemarkModal({
    isOpen,
    onClose,
    remarks,
    storeName
}: Props) {
    const [editableText, setEditableText] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen && remarks) {
            setEditableText(remarks.recommendedSummaryText);
            setCopied(false);
        }
    }, [isOpen, remarks]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(editableText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            const el = document.createElement('textarea');
            el.value = editableText;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="focus-remark-modal-title"
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans"
        >
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                            <Sparkles className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div>
                            <h3 id="focus-remark-modal-title" className="text-base font-black text-slate-900">
                                Đánh Giá &amp; Nhận Xét Nhân Sự (X / Total NH)
                            </h3>
                            <p className="text-xs text-slate-600">
                                Báo cáo mức độ hoàn thành các nhóm hàng trọng tâm - ST: {storeName}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng cửa sổ nhận xét"
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    {/* Thống kê 4 phân khúc nhân sự */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-2xl text-center">
                            <span className="text-[10px] font-black uppercase text-emerald-800 block">Top Xuất Sắc</span>
                            <span className="text-lg font-black font-mono tabular-nums text-emerald-700">
                                {remarks.topPerformers.length}
                            </span>
                            <span className="text-[10px] text-emerald-700 block">Đạt full/sát nút</span>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-2xl text-center">
                            <span className="text-[10px] font-black uppercase text-blue-800 block">Bám Sát Tốt</span>
                            <span className="text-lg font-black font-mono tabular-nums text-blue-700">
                                {remarks.moderatePerformers.length}
                            </span>
                            <span className="text-[10px] text-blue-700 block">≥ 50% số NH</span>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-2xl text-center">
                            <span className="text-[10px] font-black uppercase text-amber-800 block">Cần Bứt Phá</span>
                            <span className="text-lg font-black font-mono tabular-nums text-amber-700">
                                {remarks.needSupportPerformers.length}
                            </span>
                            <span className="text-[10px] text-amber-700 block">&lt; 50% số NH</span>
                        </div>
                        <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-2xl text-center">
                            <span className="text-[10px] font-black uppercase text-rose-800 block">Chưa Đạt NH</span>
                            <span className="text-lg font-black font-mono tabular-nums text-rose-700">
                                {remarks.zeroPerformers.length}
                            </span>
                            <span className="text-[10px] text-rose-700 block">0 NH hoàn thành</span>
                        </div>
                    </div>

                    {/* Vùng văn bản tin nhắn soạn sẵn */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <label htmlFor="focus-remark-textarea" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
                                <span>Văn bản mẫu gửi Messaging App:</span>
                            </label>
                            <span className="text-[11px] text-slate-600">Có thể chỉnh sửa trước khi copy</span>
                        </div>
                        <textarea
                            id="focus-remark-textarea"
                            rows={10}
                            value={editableText}
                            onChange={(e) => setEditableText(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3 text-xs font-mono text-slate-800 focus:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none leading-relaxed"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-xs text-emerald-700 font-semibold">
                        {copied ? '✓ Đã sao chép vào bộ nhớ tạm' : ''}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                        >
                            {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                            <span>{copied ? 'Đã Sao Chép' : 'Sao Chép Tin Nhắn'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

