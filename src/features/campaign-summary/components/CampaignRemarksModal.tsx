import { useState, useEffect, useMemo } from 'react';
import type { CampaignSummaryData } from '../types';
import { generateSmartRemarks } from '../utils/campaignSummaryStorage';
import {
    Sparkles,
    Copy,
    Save,
    X,
    CheckCircle2,
    Trophy,
    TrendingUp,
    AlertTriangle,
    MessageSquare,
    Edit3
} from 'lucide-react';

import type { CampaignDictItem } from '../../../core/lib/storage';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    data: CampaignSummaryData;
    onSaveNotes?: (updatedNotes: string) => void;
    campaignDict?: CampaignDictItem[];
}

export default function CampaignRemarksModal({
    isOpen,
    onClose,
    data,
    onSaveNotes,
    campaignDict = []
}: Props) {
    const [editableText, setEditableText] = useState<string>('');
    const [copied, setCopied] = useState<boolean>(false);
    const [saved, setSaved] = useState<boolean>(false);

    // Tính toán phân tích thông minh an toàn
    const analysis = useMemo(() => {
        if (!data || !data.rows || !Array.isArray(data.rows) || data.rows.length === 0) {
            return {
                topEmployees: [],
                bottomEmployees: [],
                bestCategories: [],
                weakCategories: [],
                recommendedZaloText: ''
            };
        }
        return generateSmartRemarks(data, campaignDict);
    }, [data, campaignDict]);

    useEffect(() => {
        if (isOpen) {
            setEditableText(data.notes || analysis.recommendedZaloText);
            setCopied(false);
            setSaved(false);
        }
    }, [isOpen, data, analysis]);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(editableText);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch {
            const el = document.createElement('textarea');
            el.value = editableText;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        }
    };

    const handleSave = () => {
        onSaveNotes?.(editableText);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const handleResetDefault = () => {
        const fresh = generateSmartRemarks(data);
        setEditableText(fresh.recommendedZaloText);
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-3xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh]">
                {/* Header */}
                <div className="px-6 py-4.5 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-white/20 backdrop-blur-xs text-amber-300">
                            <Sparkles className="w-5 h-5" />
                        </span>
                        <div>
                            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                                Nhận Xét &amp; Đánh Giá Thi Đua Ngành Hàng
                            </h2>
                            <p className="text-xs text-purple-200 mt-0.5">
                                Phân tích tự động số liệu ngày {data.date_display} • {data.store_name}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    {/* Thẻ tóm tắt thông số nhanh */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        {/* 1. Top 1 */}
                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-1">
                            <span className="font-bold text-amber-900 flex items-center gap-1.5">
                                <Trophy className="w-4 h-4 text-amber-600" />
                                <span>Quán Quân Thi Đua</span>
                            </span>
                            <div className="font-extrabold text-sm text-slate-900 line-clamp-1">
                                {analysis.topEmployees[0]?.name || '—'}
                            </div>
                            <div className="text-[11px] text-amber-800 font-mono">
                                Đạt <strong>{analysis.topEmployees[0]?.achieved}</strong> ({analysis.topEmployees[0]?.rate}%)
                            </div>
                        </div>

                        {/* 2. Ngành hàng mạnh nhất */}
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 space-y-1">
                            <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                                <TrendingUp className="w-4 h-4 text-emerald-600" />
                                <span>Ngành Hàng Dẫn Đầu</span>
                            </span>
                            <div className="font-extrabold text-xs text-slate-900 line-clamp-1">
                                {analysis.bestCategories[0]?.name || '—'}
                            </div>
                            <div className="text-[11px] text-emerald-800 font-mono">
                                <strong>{analysis.bestCategories[0]?.passedCount} bạn đạt ≥100%</strong> ({analysis.bestCategories[0]?.passRate}%)
                            </div>
                        </div>

                        {/* 3. Ngành hàng cần kéo */}
                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 space-y-1">
                            <span className="font-bold text-rose-900 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-rose-600" />
                                <span>Trọng Tâm Tăng Tốc</span>
                            </span>
                            <div className="font-extrabold text-xs text-slate-900 line-clamp-1">
                                {analysis.weakCategories[0]?.name || '—'}
                            </div>
                            <div className="text-[11px] text-rose-800 font-mono">
                                <strong>{analysis.weakCategories[0]?.under50Count} bạn</strong> còn dưới 50%
                            </div>
                        </div>
                    </div>

                    {/* Khung Soạn Thảo / Tùy Chỉnh Nội Dung Nhận Xét */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Edit3 className="w-4 h-4 text-purple-600" />
                                <span>Nội dung nhận xét &amp; tin nhắn mẫu Messaging App (Boss có thể chỉnh sửa trực tiếp):</span>
                            </label>

                            <button
                                type="button"
                                onClick={handleResetDefault}
                                className="text-[11px] text-purple-600 hover:text-purple-800 hover:underline font-semibold cursor-pointer"
                            >
                                ↺ Khôi phục gợi ý mẫu
                            </button>
                        </div>

                        <textarea
                            rows={12}
                            value={editableText}
                            onChange={e => setEditableText(e.target.value)}
                            className="w-full p-4 text-xs font-mono bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-800 leading-relaxed shadow-inner"
                            placeholder="Nhập nội dung nhận xét hoặc tinh chỉnh tin nhắn gửi nhóm..."
                        />
                    </div>
                </div>

                {/* Footer Hành Động */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        Đã sẵn sàng để gửi trực tiếp vào Messaging App Siêu thị / Quản lý cụm.
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                            <Save className="w-4 h-4 text-slate-600" />
                            <span>{saved ? 'Đã lưu nhận xét!' : 'Lưu Nhận Xét'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCopy}
                            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                            {copied ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                                    <span>Đã Copy! Dán ngay vào Messaging App</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4 text-white" />
                                    <span>Sao Chép Gửi Messaging App</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
