import React, { useState } from 'react';
import {
    BarChart3,
    TrendingUp,
    Calendar,
    Target,
    Layers,
    Sparkles,
    Flame,
    Info,
    CheckCircle2,
    AlertTriangle
} from 'lucide-react';
import { formatValue, formatDate } from '../../../core/lib/formatters';
import type { DailyTrendPoint, RevenueTrendMetrics } from '../hooks/useRevenueTrendData';

interface RevenueTrendChartProps {
    timelineData: DailyTrendPoint[];
    metrics: RevenueTrendMetrics;
    selectedStore: string;
}

export default function RevenueTrendChart({ timelineData, metrics, selectedStore }: RevenueTrendChartProps) {
    const [chartMode, setChartMode] = useState<'daily' | 'cumulative'>('daily');
    const [activePoint, setActivePoint] = useState<DailyTrendPoint | null>(null);

    if (timelineData.length === 0) return null;

    const maxPace = Math.max(metrics.maxDailyPace, metrics.requiredDailyPace, metrics.requiredBaseDailyPace, metrics.currentAvgPace, 1);
    const maxCumulative = Math.max(metrics.expectedTarget, metrics.totalTarget, metrics.totalActual, 1);

    // Vị trí % của các đường tham chiếu
    const expectedLinePercent = Math.min(100, Math.max(0, Math.round((metrics.requiredDailyPace / maxPace) * 100)));
    const baseLinePercent = Math.min(100, Math.max(0, Math.round((metrics.requiredBaseDailyPace / maxPace) * 100)));

    const handleModeChange = (mode: 'daily' | 'cumulative') => {
        setChartMode(mode);
        setActivePoint(null);
    };

    return (
        <div className="bg-slate-50/80 p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5 sm:space-y-4">
            {/* TIÊU ĐỀ BIỂU ĐỒ & BỘ CHUYỂN ĐỔI CHẾ ĐỘ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 pb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                        {chartMode === 'daily' ? <BarChart3 className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                    </div>
                    <div>
                        <h3 className="font-black text-xs sm:text-sm text-slate-800 uppercase tracking-wide flex items-center gap-1.5 flex-wrap">
                            <span>
                                {chartMode === 'daily' ? 'Biểu Đồ Nhịp Doanh Thu Hàng Ngày' : 'Biểu Đồ Tích Lũy Tiến Độ Tháng'}
                            </span>
                            <span className="text-blue-700 font-black">
                                ({selectedStore === 'Tổng' ? 'Toàn Cụm' : selectedStore})
                            </span>
                            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-black px-1.5 py-0.5 rounded">
                                Kỳ vọng: {metrics.targetRate}%
                            </span>
                        </h3>
                        <p className="text-[11px] text-slate-500">
                            {chartMode === 'daily'
                                ? `Đối chiếu nhịp thực thu từng ngày với vạch mục tiêu kỳ vọng ${formatValue(metrics.requiredDailyPace)}/ngày và mốc cơ sở ${formatValue(metrics.requiredBaseDailyPace)}/ngày`
                                : `Đường tăng trưởng doanh thu so với mốc kỳ vọng ${formatValue(metrics.expectedTarget)} (${metrics.targetRate}%)`
                            }
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <div className="inline-flex rounded-xl bg-slate-200/80 p-0.5 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => handleModeChange('daily')}
                            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                chartMode === 'daily'
                                    ? 'bg-white text-blue-700 shadow-2xs font-black'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Nhịp Ngày (+DT)
                        </button>
                        <button
                            type="button"
                            onClick={() => handleModeChange('cumulative')}
                            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                chartMode === 'cumulative'
                                    ? 'bg-white text-blue-700 shadow-2xs font-black'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Lũy Kế Tịnh Tiến
                        </button>
                    </div>
                </div>
            </div>

            {/* CHÚ GIẢI THAM CHIẾU (LEGEND) */}
            <div className="flex items-center justify-between gap-3 flex-wrap text-[10.5px] font-bold text-slate-600 bg-white/70 px-3 py-2 rounded-xl border border-slate-200/70">
                <div className="flex items-center gap-3.5 flex-wrap">
                    {chartMode === 'daily' ? (
                        <>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" />
                                <span>Vượt kỳ vọng ({metrics.targetRate}%)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
                                <span>Đạt cơ sở (100%)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                                <span>Hụt cơ sở (&lt;100%)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full border border-amber-400 bg-amber-100 text-amber-700 text-[8px] px-1 font-mono font-black">
                                    ★
                                </span>
                                <span>Cuối tuần (T7, CN)</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-blue-700 inline-block" />
                                <span>Lũy kế thực thu</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                                <span>Mục tiêu {metrics.targetRate}% ({formatValue(metrics.expectedTarget)})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" />
                                <span>Target gốc 100% ({formatValue(metrics.totalTarget)})</span>
                            </div>
                        </>
                    )}
                </div>

                {chartMode === 'daily' && (
                    <div className="flex items-center gap-3 flex-wrap font-mono">
                        {metrics.requiredDailyPace > 0 && (
                            <div className="flex items-center gap-1 text-amber-800">
                                <span className="w-4 h-0.5 bg-amber-500 inline-block" />
                                <span>Vạch {metrics.targetRate}%: {formatValue(metrics.requiredDailyPace)}/ngày</span>
                            </div>
                        )}
                        {metrics.requiredBaseDailyPace > 0 && (
                            <div className="flex items-center gap-1 text-blue-700">
                                <span className="w-4 h-0.5 border-b border-dashed border-blue-500 inline-block" />
                                <span>Vạch 100%: {formatValue(metrics.requiredBaseDailyPace)}/ngày</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* THANH THÔNG TIN CHI TIẾT KHI RÊ CHUỘT / CHẠM (ACTIVE DAY INSPECTOR BAR) */}
            <div className={`p-2.5 sm:p-3 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 flex-wrap text-xs ${
                activePoint
                    ? 'bg-blue-50/90 border-blue-200 shadow-xs'
                    : 'bg-slate-100/70 border-slate-200/80 text-slate-500'
            }`}>
                {activePoint ? (
                    <>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-blue-600" />
                                <span>{formatDate(activePoint.reportDate, 'dd/mm/yyyy')} ({activePoint.dayOfWeekLabel})</span>
                            </span>
                            {activePoint.isWeekend && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px]">
                                    ★ Cuối tuần
                                </span>
                            )}
                            {/* Chip đánh giá nhịp */}
                            {chartMode === 'daily' ? (
                                activePoint.dailyPace >= metrics.requiredDailyPace ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[10px] inline-flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-emerald-600" /> Vượt kỳ vọng (+{formatValue(activePoint.dailyPace - metrics.requiredDailyPace)})
                                    </span>
                                ) : activePoint.dailyPace >= metrics.requiredBaseDailyPace ? (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 font-black text-[10px] inline-flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-blue-600" /> Đạt cơ sở
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-black text-[10px] inline-flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Hụt cơ sở ({formatValue(activePoint.dailyPace - metrics.requiredBaseDailyPace)})
                                    </span>
                                )
                            ) : (
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 font-black text-[10px]">
                                    Đạt {activePoint.completionRate.toFixed(1)}% Target gốc
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4 flex-wrap font-mono text-[11px] font-bold">
                            <div className="text-emerald-700">
                                <span className="text-slate-500 font-sans font-normal text-[10px] mr-1">Doanh thu ngày:</span>
                                <span>+{formatValue(activePoint.dailyPace)}</span>
                            </div>
                            <div className="text-blue-800">
                                <span className="text-slate-500 font-sans font-normal text-[10px] mr-1">Lũy kế:</span>
                                <span>{formatValue(activePoint.revenueActual)} ({activePoint.completionRate.toFixed(1)}%)</span>
                            </div>
                            {activePoint.dailyInstallment > 0 && (
                                <div className="text-sky-700">
                                    <span className="text-slate-500 font-sans font-normal text-[10px] mr-1">Trả chậm:</span>
                                    <span>{formatValue(activePoint.dailyInstallment)} ({activePoint.installmentRate.toFixed(0)}%)</span>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-between w-full text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span>Rê chuột hoặc chạm vào từng cột để xem chi tiết nhịp doanh thu &amp; tỷ lệ lũy kế</span>
                        </div>
                        {metrics.peakDay && (
                            <div className="flex items-center gap-1 font-mono text-amber-800 font-bold hidden sm:flex">
                                <Flame className="w-3.5 h-3.5 text-amber-500" />
                                <span>Đỉnh điểm: {formatDate(metrics.peakDay.date, 'dd/mm')} (+{formatValue(metrics.peakDay.pace)})</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* KHU VỰC VẼ BIỂU ĐỒ */}
            {chartMode === 'daily' ? (
                <div className="relative pt-2 pb-1">
                    {/* Đường tham chiếu: Nhịp kỳ vọng vượt trội */}
                    {metrics.requiredDailyPace > 0 && expectedLinePercent > 0 && expectedLinePercent <= 100 && (
                        <div
                            className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                            style={{ bottom: `calc(${expectedLinePercent * 0.62}% + 38px)` }}
                        >
                            <div className="w-full border-b-2 border-dashed border-amber-500 opacity-80" />
                            <span className="absolute right-1 -top-4 font-mono font-black text-[9px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded shadow-xs">
                                Kỳ vọng {metrics.targetRate}%: {formatValue(metrics.requiredDailyPace)}
                            </span>
                        </div>
                    )}

                    {/* Đường tham chiếu: Nhịp cơ sở 100% */}
                    {metrics.requiredBaseDailyPace > 0 && baseLinePercent > 0 && baseLinePercent <= 100 && (
                        <div
                            className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                            style={{ bottom: `calc(${baseLinePercent * 0.62}% + 38px)` }}
                        >
                            <div className="w-full border-b border-dashed border-blue-400 opacity-60" />
                            <span className="absolute left-1 -top-4 font-mono font-bold text-[8.5px] bg-blue-50 text-blue-700 border border-blue-200 px-1 rounded">
                                Gốc 100%: {formatValue(metrics.requiredBaseDailyPace)}
                            </span>
                        </div>
                    )}

                    {/* Các cột dữ liệu - Tăng padding top để tooltip nổi bên trong container, không bị cắt viền */}
                    <div 
                        className="h-64 sm:h-72 flex items-end gap-1 sm:gap-2 overflow-x-auto no-scrollbar px-2 pt-16 sm:pt-20 pb-2 relative"
                        onMouseLeave={() => setActivePoint(null)}
                    >
                        {timelineData.map((d, index) => {
                            const heightPercent = Math.max(6, Math.min(100, Math.round((d.dailyPace / maxPace) * 100)));
                            const isPeak = metrics.peakDay && metrics.peakDay.date === d.reportDate;
                            const isCurrentActive = activePoint?.reportDate === d.reportDate;

                            let barColor = 'bg-blue-600';
                            let barTextColor = 'text-blue-700';

                            if (metrics.requiredDailyPace > 0 && d.dailyPace >= metrics.requiredDailyPace) {
                                barColor = 'bg-emerald-600';
                                barTextColor = 'text-emerald-700';
                            } else if (metrics.requiredBaseDailyPace > 0 && d.dailyPace >= metrics.requiredBaseDailyPace) {
                                barColor = 'bg-blue-600';
                                barTextColor = 'text-blue-700';
                            } else if (metrics.requiredBaseDailyPace > 0) {
                                barColor = 'bg-rose-500';
                                barTextColor = 'text-rose-600';
                            }

                            // Căn chỉnh vị trí tooltip thông minh để không tràn viền trái/phải
                            const tooltipAlignClass = index < 3
                                ? 'left-0'
                                : index >= timelineData.length - 3
                                    ? 'right-0'
                                    : 'left-1/2 -translate-x-1/2';

                            return (
                                <div
                                    key={d.reportDate}
                                    className="flex-1 min-w-[34px] sm:min-w-[42px] flex flex-col items-center gap-1 group relative h-full justify-end cursor-pointer"
                                    onMouseEnter={() => setActivePoint(d)}
                                    onClick={() => setActivePoint(d)}
                                >
                                    {/* Tooltip hover: Đặt ở top-1 bên trong vùng padding-top, đảm bảo không bao giờ bị cắt viền */}
                                    <div 
                                        className={`absolute top-1 ${tooltipAlignClass} opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none bg-slate-950/95 text-white text-[9.5px] p-2 rounded-xl shadow-2xl z-40 whitespace-nowrap font-mono flex flex-col gap-0.5 border border-slate-700 backdrop-blur-xs ${
                                            isCurrentActive ? '!opacity-100 ring-2 ring-blue-400' : ''
                                        }`}
                                    >
                                        <div className="font-bold flex items-center justify-between gap-2 border-b border-slate-700/80 pb-0.5">
                                            <span>{d.dayLabel} ({d.dayOfWeekLabel})</span>
                                            {d.isWeekend && <span className="text-amber-300 font-black text-[8.5px]">★ Cuối tuần</span>}
                                        </div>
                                        <div className="text-emerald-300 font-bold flex items-center justify-between gap-2">
                                            <span>Doanh thu ngày:</span>
                                            <span>+{formatValue(d.dailyPace)}</span>
                                        </div>
                                        <div className="text-slate-300 text-[8.5px] flex items-center justify-between gap-2">
                                            <span>Lũy kế:</span>
                                            <span>{formatValue(d.revenueActual)} ({d.completionRate.toFixed(1)}%)</span>
                                        </div>
                                        {d.dailyInstallment > 0 && (
                                            <div className="text-sky-300 text-[8.5px] flex items-center justify-between gap-2">
                                                <span>Trả chậm:</span>
                                                <span>{formatValue(d.dailyInstallment)} ({d.installmentRate.toFixed(0)}%)</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Badge số trên đỉnh cột */}
                                    <div className={`font-mono text-[9px] font-bold ${barTextColor} mb-0.5 truncate transition-transform ${isCurrentActive ? 'scale-110 font-black' : ''}`}>
                                        {d.dailyPace > 0 ? `+${formatValue(d.dailyPace)}` : '0'}
                                    </div>

                                    {/* Thanh Bar */}
                                    <div className={`w-full rounded-t-lg flex items-end overflow-hidden transition-all ${
                                        isCurrentActive ? 'ring-2 ring-blue-500 shadow-md' : ''
                                    } ${
                                        d.isWeekend ? 'bg-amber-100/70 ring-1 ring-amber-300/60' : 'bg-slate-200/70'
                                    }`} style={{ height: '62%' }}>
                                        <div
                                            className={`w-full ${barColor} rounded-t-lg transition-all relative flex flex-col justify-start items-center pt-1 group-hover:brightness-110`}
                                            style={{ height: `${heightPercent}%` }}
                                        >
                                            {isPeak && (
                                                <Flame className="w-3 h-3 text-amber-200 animate-pulse shrink-0" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Nhãn trục X: Ngày & Thứ */}
                                    <div className="flex flex-col items-center mt-1">
                                        <span className={`text-[9.5px] font-mono font-bold truncate ${
                                            d.isWeekend ? 'text-amber-800 font-black' : 'text-slate-700'
                                        } ${isCurrentActive ? 'text-blue-700 underline font-black' : ''}`}>
                                            {formatDate(d.reportDate, 'dd/mm')}
                                        </span>
                                        <span className={`text-[8.5px] uppercase font-bold ${
                                            d.isWeekend ? 'text-amber-600 font-black' : 'text-slate-400'
                                        }`}>
                                            {d.isWeekend ? 'T7/CN' : d.dayOfWeekLabel.replace('Thứ ', 'T')}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* CHẾ ĐỘ LŨY KẾ TỊNH TIẾN */
                <div className="relative pt-2 pb-1">
                    <div 
                        className="h-64 sm:h-72 flex items-end gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar px-2 pt-16 sm:pt-20 pb-2 relative"
                        onMouseLeave={() => setActivePoint(null)}
                    >
                        {timelineData.map((d, index) => {
                            const actualPercent = Math.min(100, Math.max(5, Math.round((d.revenueActual / maxCumulative) * 100)));
                            const baseTargetPercent = Math.min(100, Math.max(5, Math.round((d.revenueTarget / maxCumulative) * 100)));
                            const expectedTargetPercent = Math.min(100, Math.max(5, Math.round((metrics.expectedTarget / maxCumulative) * 100)));
                            const isCurrentActive = activePoint?.reportDate === d.reportDate;

                            const tooltipAlignClass = index < 3
                                ? 'left-0'
                                : index >= timelineData.length - 3
                                    ? 'right-0'
                                    : 'left-1/2 -translate-x-1/2';

                            return (
                                <div
                                    key={d.reportDate}
                                    className="flex-1 min-w-[34px] sm:min-w-[42px] flex flex-col items-center gap-1 group relative h-full justify-end cursor-pointer"
                                    onMouseEnter={() => setActivePoint(d)}
                                    onClick={() => setActivePoint(d)}
                                >
                                    {/* Tooltip hover chế độ lũy kế */}
                                    <div 
                                        className={`absolute top-1 ${tooltipAlignClass} opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none bg-slate-950/95 text-white text-[9.5px] p-2 rounded-xl shadow-2xl z-40 whitespace-nowrap font-mono flex flex-col gap-0.5 border border-slate-700 backdrop-blur-xs ${
                                            isCurrentActive ? '!opacity-100 ring-2 ring-blue-400' : ''
                                        }`}
                                    >
                                        <div className="font-bold flex items-center justify-between gap-2 border-b border-slate-700/80 pb-0.5">
                                            <span>{d.dayLabel} ({d.dayOfWeekLabel})</span>
                                            <span className="text-blue-300 font-black">{d.completionRate.toFixed(1)}%</span>
                                        </div>
                                        <div className="text-emerald-300 font-bold flex items-center justify-between gap-2">
                                            <span>Lũy kế thực thu:</span>
                                            <span>{formatValue(d.revenueActual)}</span>
                                        </div>
                                        <div className="text-amber-300 text-[8.5px] flex items-center justify-between gap-2">
                                            <span>Mục tiêu {metrics.targetRate}%:</span>
                                            <span>{formatValue(metrics.expectedTarget)}</span>
                                        </div>
                                        <div className="text-slate-300 text-[8.5px] flex items-center justify-between gap-2">
                                            <span>Target gốc 100%:</span>
                                            <span>{formatValue(metrics.totalTarget)}</span>
                                        </div>
                                    </div>

                                    <div className={`font-mono text-[9px] font-bold text-slate-600 mb-0.5 truncate ${isCurrentActive ? 'text-blue-700 font-black scale-110' : ''}`}>
                                        {d.completionRate.toFixed(0)}%
                                    </div>

                                    <div className={`w-full bg-slate-200/70 rounded-t-lg flex items-end justify-center relative overflow-hidden transition-all ${
                                        isCurrentActive ? 'ring-2 ring-blue-500 shadow-md' : ''
                                    }`} style={{ height: '62%' }}>
                                        {/* Cột lũy kế */}
                                        <div
                                            className="w-full bg-blue-700 rounded-t-lg transition-all group-hover:brightness-110"
                                            style={{ height: `${actualPercent}%` }}
                                        />
                                        {/* Vạch Target mốc 100% */}
                                        <div
                                            className="absolute w-full border-t border-emerald-500 z-10"
                                            style={{ bottom: `${baseTargetPercent}%` }}
                                        />
                                        {/* Vạch Target mốc kỳ vọng */}
                                        <div
                                            className="absolute w-full border-t-2 border-dashed border-amber-500 z-20"
                                            style={{ bottom: `${expectedTargetPercent}%` }}
                                        />
                                    </div>

                                    <div className="flex flex-col items-center mt-1">
                                        <span className={`text-[9.5px] font-mono font-bold text-slate-700 ${isCurrentActive ? 'text-blue-700 underline font-black' : ''}`}>
                                            {formatDate(d.reportDate, 'dd/mm')}
                                        </span>
                                        <span className="text-[8.5px] font-mono text-emerald-600 font-bold">
                                            {formatValue(d.revenueActual)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
