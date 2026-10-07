import React from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, Sparkles, Layers } from 'lucide-react';
import type { OverallReadinessSummary } from '../types';
import { formatDate } from '../../../core/lib/formatters';

interface DataReadinessScoreCardProps {
    summary: OverallReadinessSummary;
}

export default function DataReadinessScoreCard({ summary }: DataReadinessScoreCardProps) {
    const {
        readinessPercent,
        okStreams,
        warningStreams,
        totalStreams,
        todayDate,
        expectedDate,
        totalStores,
        fullyReadyStores
    } = summary;

    const isAllOk = readinessPercent === 100;
    const isModerate = readinessPercent >= 60;

    return (
        <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white shadow-xl relative overflow-hidden">
            {/* Background pattern decor */}
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-40 h-40 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Hàng 1: Tiêu đề & Badge trạng thái tổng thể */}
            <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300">
                            Hệ Thống Kiểm Soát Dữ Liệu
                        </span>
                        <h2 className="text-base sm:text-lg font-extrabold text-white">
                            Đảm bảo dữ liệu được cập nhật mới nhất
                        </h2>
                    </div>
                </div>

                <div className="shrink-0">
                    {isAllOk ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/30">
                            <Sparkles className="w-3.5 h-3.5 fill-current" />
                            <span>100% HOÀN HẢO</span>
                        </span>
                    ) : isModerate ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/90 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20">
                            <AlertTriangle className="w-3.5 h-3.5 text-slate-950" />
                            <span>CẦN BỔ SUNG PHIÊN n-1</span>
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-600 text-white font-bold text-xs shadow-lg shadow-amber-600/30">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>CHẬM ĐỒNG BỘ</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Hàng 2: Điểm số tiến độ & Thống kê nhanh */}
            <div className="relative z-10 mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Cột 1: Phần trăm tổng quát */}
                <div className="sm:col-span-1 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm flex flex-col justify-center">
                    <span className="text-[11px] text-slate-300 font-medium">Tỷ lệ cập nhật mới</span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                            {readinessPercent}%
                        </span>
                        <span className="text-xs text-slate-400">
                            ({okStreams}/{totalStreams})
                        </span>
                    </div>

                    {/* Thanh tiến độ */}
                    <div className="w-full bg-white/10 rounded-full h-2 mt-2 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${isAllOk ? 'bg-emerald-400' : isModerate ? 'bg-amber-400' : 'bg-amber-500'
                                }`}
                            style={{ width: `${readinessPercent}%` }}
                        />
                    </div>
                </div>

                {/* Cột 2: Mốc thời gian n và n-1 */}
                <div className="sm:col-span-1 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm flex flex-col justify-center text-xs">
                    <span className="text-[11px] text-slate-300 font-medium">Mốc đối chiếu phiên</span>
                    <div className="mt-1 space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Hôm nay (Ngày n):</span>
                            <span className="font-bold text-slate-200 font-mono">{formatDate(todayDate)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-emerald-300 font-medium">Phiên chuẩn (n-1):</span>
                            <span className="font-extrabold text-emerald-400 font-mono">{formatDate(expectedDate)}</span>
                        </div>
                    </div>
                </div>

                {/* Cột 3: Trạng thái chi tiết siêu thị */}
                <div className="sm:col-span-1 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm flex flex-col justify-center text-xs">
                    <span className="text-[11px] text-slate-300 font-medium">Độ phủ siêu thị</span>
                    <div className="mt-1 flex items-center justify-between">
                        <span className="text-slate-400">Siêu thị đạt 100% OK:</span>
                        <span className="font-bold text-white font-mono">
                            {fullyReadyStores}/{totalStores} ST
                        </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> {okStreams} Đạt
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                            <AlertTriangle className="w-3 h-3" /> {warningStreams} Cần bổ sung
                        </span>
                    </div>
                </div>
            </div>

            {/* Chú thích nguyên tắc n-1 */}
            <div className="relative z-10 mt-3 text-[11px] text-slate-400 bg-black/20 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                <span>
                    <strong>Nguyên tắc:</strong> Dữ liệu <span className="text-emerald-300 font-bold">OK</span> khi đã có phiên ngày <strong>{formatDate(expectedDate)} (n-1)</strong>. Ngược lại hệ thống sẽ cảnh báo để quản lý nắm bắt và kịp thời cập nhật.
                </span>
            </div>
        </div>
    );
}
