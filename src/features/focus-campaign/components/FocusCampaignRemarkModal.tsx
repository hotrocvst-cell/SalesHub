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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900">
                                Đánh Giá & Nhận Xét Nhân Sự (X / Total NH)
                            </h3>
                            <p className="text-xs text-slate-400">
                                Báo cáo mức độ hoàn thành các nhóm hàng trọng tâm - ST: {storeName}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    {/* Thống kê 4 phân khúc nhân sự */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-2xl text-center">
                            <span className="text-[10px] font-black uppercase text-emerald-800 block">Top Xuất Sắc</span>
                            <span className="text-lg font-black font-mono text-emerald-700">
                                {remarks.topPerformers.length}
                            </span>
                            <span className="text-[10px] text-emerald-600 block">Đạt full/sát nút</span>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-2xl text-center">
                            <span className="text-[10px] font-black uppercase text-blue-800 block">Bám Sát Tốt</span>
                            <span className="text-lg font-black font-mono text-blue-700">
                                {remarks.moderatePerformers.length}
                            </span>
                            <span className="text-[10px] text-blue-600 block">≥ 50% số NH</span>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-2xl text-center">
                            <span className="text-[10px] font-black uppercase text-amber-800 block">Cần Bứt Phá</span>
                            <span className="text-lg font-black font-mono text-amber-700">
                                {remarks.needSupportPerformers.length}
                            </span>
                            <span className="text-[10px] text-amber-600 block">&lt; 50% số NH</span>
                        </div>
                        <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-2xl text-center">
                            <span className="text-[10px] font-black uppercase text-rose-800 block">Chưa Đạt NH</span>
                            <span className="text-lg font-black font-mono text-rose-700">
                                {remarks.zeroPerformers.length}
                            </span>
                            <span className="text-[10px] text-rose-600 block">0 NH hoàn thành</span>
                        </div>
                    </div>

                    {/* Vùng văn bản tin nhắn soạn sẵn */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Văn bản mẫu gửi Messaging App:</span>
                            </label>
                            <span className="text-[11px] text-slate-400">Có thể chỉnh sửa trước khi copy</span>
                        </div>
                        <textarea
                            rows={10}
                            value={editableText}
                            onChange={(e) => setEditableText(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3 text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden leading-relaxed"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                        {copied ? '✓ Đã sao chép vào bộ nhớ tạm' : ''}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            <span>{copied ? 'Đã Sao Chép' : 'Sao Chép Tin Nhắn'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

