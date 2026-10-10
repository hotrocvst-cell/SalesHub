import React, { useState, useEffect, useMemo } from 'react';
import {
    Sparkles,
    Copy,
    CheckCircle2,
    X,
    Trophy,
    AlertTriangle,
    Target,
    Users,
    TrendingUp,
    MessageSquare,
    RotateCcw
} from 'lucide-react';
import type { CampaignProgressItem } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    item: CampaignProgressItem;
    reportDateDisplay: string;
    storeName?: string;
}

export default function CampaignProgressRemarkModal({
    isOpen,
    onClose,
    item,
    reportDateDisplay,
    storeName = 'Toàn Cụm'
}: Props) {
    const [editableText, setEditableText] = useState<string>('');
    const [copied, setCopied] = useState<boolean>(false);

    // Tính toán phân tích thông minh cho riêng bảng này
    const analysis = useMemo(() => {
        if (!item || !item.employees || item.employees.length === 0) {
            return {
                topEmployees: [],
                underperformingEmployees: [],
                defaultMessage: ''
            };
        }

        // Sắp xếp nhân viên theo %HT (DK) giảm dần
        const sorted = [...item.employees].sort((a, b) => b.forecastRate - a.forecastRate || b.actual - a.actual);
        const topEmployees = sorted.filter(e => e.isAchieved || e.forecastRate >= 100).slice(0, 3);
        // Lấy danh sách tất cả nhân viên cần tăng tốc có % dự kiến dưới 80% (xếp từ thấp nhất lên)
        const underperformingEmployees = [...item.employees]
            .filter(e => e.forecastRate < 80)
            .sort((a, b) => a.forecastRate - b.forecastRate || a.actual - b.actual);

        const storeDisplay = storeName === 'all' ? 'Toàn Cụm Siêu Thị' : storeName;

        // Sinh nội dung tin nhắn gợi ý
        const lines: string[] = [
            `📢 [THI ĐUA: ${item.displayName.toUpperCase()}]`,
            `📅 Luỹ kế đã tính: ${reportDateDisplay} • 🏢 ${storeDisplay}`,
            `----------------------------------------`,
            `🎯 SIÊU THỊ:`,
            `• Target: ${item.totalTarget.toLocaleString('vi-VN')} ${item.unit}`,
            `• Lũy kế: ${item.totalActual.toLocaleString('vi-VN')} ${item.unit}`,
            `• %DKHT: ${item.forecastRate}% [${item.isAchieved ? '🟢 ĐÃ ĐẠT TIẾN ĐỘ' : '🔴 KHÔNG ĐẠT - CẦN TĂNG TỐC'}]`,
            `• Tỷ lệ NV đạt: ${item.achievedEmployees}/${item.totalEmployees} bạn (${item.employeeAchieveRate}%)`,
            ``
        ];

        if (topEmployees.length > 0) {
            lines.push(`🌟 TOP NHÂN VIÊN XUẤT SẮC:`);
            topEmployees.forEach((emp, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                lines.push(`${medal} ${emp.displayName}: ${emp.actual}/${emp.target} (${emp.forecastRate}%)`);
            });
            lines.push(``);
        }

        if (underperformingEmployees.length > 0) {
            lines.push(`🚨 CÁC BẠN CẦN TĂNG TỐC:`);
            underperformingEmployees.forEach(emp => {
                lines.push(`⚠️ ${emp.displayName}: ${emp.actual}/${emp.target} (${emp.forecastRate}% • Thiếu ${emp.remaining} ${item.unit})`);
            });
            lines.push(``);
        }

        if (item.isAchieved) {
            lines.push(`💪 Toàn team duy trì nhịp độ bán hàng để bảo toàn thành tích xuất sắc tháng này!`);
        } else {
            lines.push(`🔥 Nhóm hàng này đang thiếu số! Đề nghị tất cả các bạn tập trung tư vấn, cải thiện số!`);
        }

        return {
            topEmployees,
            underperformingEmployees,
            defaultMessage: lines.join('\n')
        };
    }, [item, reportDateDisplay, storeName]);

    useEffect(() => {
        if (isOpen) {
            setEditableText(analysis.defaultMessage);
            setCopied(false);
        }
    }, [isOpen, analysis.defaultMessage]);

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

    const handleReset = () => {
        setEditableText(analysis.defaultMessage);
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200 font-avo">
            <div className="bg-white rounded-3xl max-w-2xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh]">
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-white/15 backdrop-blur-xs text-amber-300">
                            <Sparkles className="w-5 h-5" />
                        </span>
                        <div>
                            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                                Nhận Xét &amp; Đánh Giá: {item.displayName}
                            </h2>
                            <p className="text-xs text-emerald-200 mt-0.5">
                                Dữ liệu luỹ kế đến ngày {reportDateDisplay} • {storeName === 'all' ? 'Toàn Cụm' : storeName}
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

                <div className="p-5 overflow-y-auto space-y-4">
                    {/* 4 Thẻ KPI Tóm Tắt Nhanh */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-[10.5px] font-bold text-slate-500 flex items-center gap-1">
                                <Target className="w-3.5 h-3.5 text-blue-600" />
                                <span>Target Nhóm</span>
                            </span>
                            <div className="font-black text-sm text-slate-900 mt-1">
                                {item.totalTarget.toLocaleString('vi-VN')} {item.unit}
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-[10.5px] font-bold text-slate-500 flex items-center gap-1">
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Luỹ Kế Đạt</span>
                            </span>
                            <div className="font-black text-sm text-emerald-700 mt-1">
                                {item.totalActual.toLocaleString('vi-VN')} {item.unit}
                            </div>
                        </div>

                        <div className={`p-3 rounded-xl border ${item.isAchieved ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                            <span className={`text-[10.5px] font-bold flex items-center gap-1 ${item.isAchieved ? 'text-emerald-700' : 'text-rose-700'}`}>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>%HT Dự Kiến</span>
                            </span>
                            <div className={`font-black text-sm mt-1 ${item.isAchieved ? 'text-emerald-800' : 'text-rose-800'}`}>
                                {item.forecastRate}%
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-[10.5px] font-bold text-slate-500 flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Nhân Viên Đạt</span>
                            </span>
                            <div className="font-black text-sm text-slate-900 mt-1">
                                {item.achievedEmployees}/{item.totalEmployees} ({item.employeeAchieveRate}%)
                            </div>
                        </div>
                    </div>

                    {/* Khối Điểm Nhấn Top & Cần Kéo */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Top 1 */}
                        <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200">
                            <span className="font-bold text-amber-900 flex items-center gap-1.5">
                                <Trophy className="w-4 h-4 text-amber-600" />
                                <span>Top Xuất Sắc Nhất</span>
                            </span>
                            {analysis.topEmployees[0] ? (
                                <div className="mt-1.5 space-y-0.5">
                                    <div className="font-black text-slate-900 text-xs truncate">
                                        {analysis.topEmployees[0].displayName}
                                    </div>
                                    <div className="text-[11px] text-amber-800 font-mono">
                                        Đạt: <strong>{analysis.topEmployees[0].actual}/{analysis.topEmployees[0].target}</strong> ({analysis.topEmployees[0].forecastRate}%)
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-500 mt-1">Chưa có bạn nào đạt 100%</p>
                            )}
                        </div>

                        {/* Cần tăng tốc */}
                        <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200">
                            <span className="font-bold text-rose-900 flex items-center justify-between gap-1.5">
                                <span className="flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                                    <span>Cần Tăng Tốc (%DK &lt; 80%)</span>
                                </span>
                                {analysis.underperformingEmployees.length > 0 && (
                                    <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-rose-200 text-rose-900">
                                        {analysis.underperformingEmployees.length} bạn
                                    </span>
                                )}
                            </span>
                            {analysis.underperformingEmployees[0] ? (
                                <div className="mt-1.5 space-y-0.5">
                                    <div className="font-black text-rose-900 text-xs truncate">
                                        {analysis.underperformingEmployees[0].displayName}
                                        {analysis.underperformingEmployees.length > 1 && ` (và ${analysis.underperformingEmployees.length - 1} bạn khác)`}
                                    </div>
                                    <div className="text-[11px] text-rose-800 font-mono">
                                        Thấp nhất: <strong>{analysis.underperformingEmployees[0].actual}/{analysis.underperformingEmployees[0].target}</strong> ({analysis.underperformingEmployees[0].forecastRate}% • Thiếu {analysis.underperformingEmployees[0].remaining} {item.unit})
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[11px] text-emerald-700 font-bold mt-1">100% nhân sự đều đạt từ 80% trở lên!</p>
                            )}
                        </div>
                    </div>

                    {/* Khung Soạn Thảo Tin Nhắn Nhận Xét Messaging App */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Tin nhắn mẫu gửi nhóm Messaging App:</span>
                            </span>
                            <button
                                type="button"
                                onClick={handleReset}
                                className="text-[11px] font-semibold text-slate-500 hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition-colors"
                                title="Khôi phục lại nội dung nhận xét tự động mặc định"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span>Khôi phục mẫu</span>
                            </button>
                        </div>

                        <textarea
                            value={editableText}
                            onChange={(e) => setEditableText(e.target.value)}
                            rows={8}
                            className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-slate-800 leading-relaxed transition-all resize-y"
                            placeholder="Nhập nội dung nhận xét hoặc tinh chỉnh tin nhắn gửi nhóm..."
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                    >
                        Đóng
                    </button>

                    <button
                        type="button"
                        onClick={handleCopy}
                        className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer ${copied
                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/30'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white'
                            }`}
                    >
                        {copied ? (
                            <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                                <span>Đã Chép Tin Nhắn!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4 text-amber-300" />
                                <span>Copy Tin Nhắn Messaging App</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
