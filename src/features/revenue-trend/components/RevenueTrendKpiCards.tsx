import React from 'react';
import {
    Coins,
    TrendingUp,
    Target,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    Sparkles,
    Flame
} from 'lucide-react';
import { formatValue, formatDate } from '../../../core/lib/formatters';
import type { RevenueTrendMetrics } from '../hooks/useRevenueTrendData';

interface RevenueTrendKpiCardsProps {
    metrics: RevenueTrendMetrics;
    selectedStore: string;
}

export default function RevenueTrendKpiCards({ metrics, selectedStore }: RevenueTrendKpiCardsProps) {
    const isCluster = selectedStore === 'Tổng';

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* THẺ 1: LŨY KẾ & MỤC TIÊU KỲ VỌNG */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500">
                        {isCluster ? 'Lũy Kế Cụm & Kỳ Vọng' : 'Lũy Kế & Kỳ Vọng'}
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Coins className="w-4 h-4" />
                    </div>
                </div>

                <div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl sm:text-2xl font-black font-mono text-emerald-700 tracking-tight">
                            {formatValue(metrics.totalActual)}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-400">
                            / Gốc: {formatValue(metrics.totalTarget)}
                        </span>
                    </div>

                    <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[10.5px]">
                            <span className="text-slate-500 font-medium">Tiến độ gốc (100%):</span>
                            <span className={`font-mono font-black px-1.5 py-0.2 rounded ${
                                metrics.completionRate >= 100
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-800'
                            }`}>
                                {metrics.completionRate.toFixed(1)}%
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-[10.5px]">
                            <span className="text-amber-800 font-bold flex items-center gap-1">
                                🎯 Mục tiêu {metrics.targetRate}%:
                            </span>
                            <span className={`font-mono font-black px-1.5 py-0.2 rounded ${
                                metrics.expectedCompletionRate >= 100
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-900'
                            }`}>
                                {formatValue(metrics.expectedTarget)} ({metrics.expectedCompletionRate.toFixed(1)}%)
                            </span>
                        </div>
                    </div>
                </div>

                {/* Thanh tiến độ */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2.5">
                    <div
                        className={`h-full rounded-full transition-all ${
                            metrics.expectedCompletionRate >= 100 ? 'bg-emerald-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, metrics.expectedCompletionRate))}%` }}
                    />
                </div>
            </div>

            {/* THẺ 2: NHỊP NGÀY GẦN NHẤT */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500">
                        Nhịp Ngày Gần Nhất
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4" />
                    </div>
                </div>

                <div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 tracking-tight">
                            +{formatValue(metrics.latestDailyPace)}
                        </span>
                        {metrics.latestPaceDiff !== 0 && (
                            <span className={`inline-flex items-center text-[10.5px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                                metrics.latestPaceDiff > 0
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                            }`}>
                                {metrics.latestPaceDiff > 0 ? (
                                    <ArrowUpRight className="w-3 h-3 mr-0.5 inline" />
                                ) : (
                                    <ArrowDownRight className="w-3 h-3 mr-0.5 inline" />
                                )}
                                {metrics.latestPaceDiff > 0 ? '+' : ''}{formatValue(metrics.latestPaceDiff)}
                            </span>
                        )}
                    </div>

                    <div className="mt-2 space-y-1 text-[10.5px]">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500">So nhịp kỳ vọng ({metrics.targetRate}%):</span>
                            <span className={`font-mono font-bold ${
                                metrics.paceGap >= 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}>
                                {metrics.paceGap >= 0 ? `+${formatValue(metrics.paceGap)} (Đạt)` : `${formatValue(metrics.paceGap)} (Thiếu)`}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400 text-[10px]">
                            <span>So nhịp gốc (100%):</span>
                            <span className={`font-mono font-bold ${
                                metrics.basePaceGap >= 0 ? 'text-blue-700' : 'text-slate-500'
                            }`}>
                                {metrics.basePaceGap >= 0 ? `+${formatValue(metrics.basePaceGap)}` : formatValue(metrics.basePaceGap)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="text-[10px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span>Mốc ghi nhận:</span>
                    <span className="font-mono font-bold text-slate-600">
                        {metrics.latestDate ? formatDate(metrics.latestDate) : 'Chưa có'}
                    </span>
                </div>
            </div>

            {/* THẺ 3: NHỊP CẦN ĐẠT MỖI NGÀY CÒN LẠI */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500">
                        Nhịp Cần Đạt Mỗi Ngày
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                        <Target className="w-4 h-4" />
                    </div>
                </div>

                <div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl sm:text-2xl font-black font-mono text-amber-800 tracking-tight">
                            {formatValue(metrics.requiredDailyPace)}
                        </span>
                        <span className="text-[11px] font-bold text-amber-700/90">
                            / ngày (đạt {metrics.targetRate}%)
                        </span>
                    </div>

                    <div className="mt-2 space-y-1 text-[10.5px]">
                        <div className="flex items-center justify-between text-slate-500">
                            <span>Mốc cơ sở (100%):</span>
                            <span className="font-mono font-bold text-slate-700">
                                {formatValue(metrics.requiredBaseDailyPace)} / ngày
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400 text-[10px]">
                            <span>Bình quân đã qua:</span>
                            <span className="font-mono font-bold text-slate-600">
                                {formatValue(metrics.currentAvgPace)} / ngày
                            </span>
                        </div>
                    </div>
                </div>

                <div className="text-[10px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span>Thời gian còn lại:</span>
                    <span className="font-mono font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80">
                        {metrics.remainingDays} ngày / {metrics.totalDays} ngày
                    </span>
                </div>
            </div>

            {/* THẺ 4: SỨC KHỎE NHỊP & ĐỈNH THÁNG */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500">
                        Sức Khỏe Nhịp & Đỉnh
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
                        <Activity className="w-4 h-4" />
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-1.5">
                        {metrics.paceHealth === 'completed' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <Sparkles className="w-3.5 h-3.5" />
                                ĐÃ CÁN ĐÍCH VƯỢT TRỘI
                            </span>
                        )}
                        {metrics.paceHealth === 'leading' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300">
                                🚀 VƯỢT NHỊP KỲ VỌNG ({metrics.targetRate}%)
                            </span>
                        )}
                        {metrics.paceHealth === 'on_track' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200">
                                ⚡ ĐẠT NHỊP 100% (CẦN BỨT PHÁ)
                            </span>
                        )}
                        {metrics.paceHealth === 'lagging' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200">
                                ⚠️ HỤT NHỊP CƠ SỞ (&lt;100%)
                            </span>
                        )}
                    </div>

                    <div className="mt-2 text-[10.5px] text-slate-600 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-slate-500">
                            <Flame className="w-3.5 h-3.5 text-rose-500" />
                            Đỉnh tháng:
                        </span>
                        <span className="font-mono font-bold text-slate-800 truncate max-w-[140px]" title={metrics.peakDay?.label}>
                            {metrics.peakDay ? `+${formatValue(metrics.peakDay.pace)} (${metrics.peakDay.label})` : '—'}
                        </span>
                    </div>
                </div>

                <div className="text-[10px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span>Sức bật T7/CN:</span>
                    <span className="font-mono font-bold text-sky-800">
                        {metrics.weekendAvgPace > 0 ? `${formatValue(metrics.weekendAvgPace)}/ngày` : '—'}
                    </span>
                </div>
            </div>
        </div>
    );
}
