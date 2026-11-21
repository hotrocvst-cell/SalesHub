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
    AlertTriangle,
    Activity
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

    const maxPace = Math.max(metrics.maxDailyPace, metrics.plannedExpectedDailyPace, metrics.plannedBaseDailyPace, metrics.currentAvgPace, 1);
    const maxCumulative = Math.max(metrics.expectedTarget, metrics.totalTarget, metrics.totalActual, 1);

    // Vị trí % của các đường tham chiếu theo Kế hoạch bình quân ngày chuẩn
    const expectedLinePercent = Math.min(100, Math.max(0, Math.round((metrics.plannedExpectedDailyPace / maxPace) * 100)));
    const baseLinePercent = Math.min(100, Math.max(0, Math.round((metrics.plannedBaseDailyPace / maxPace) * 100)));

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
                                ({(selectedStore === 'Tổng' || selectedStore === 'all' || /^(tổng|tong|toàn cụm)/i.test(selectedStore)) ? 'Toàn Cụm' : selectedStore})
                            </span>
                            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-black px-1.5 py-0.5 rounded">
                                Kỳ vọng: {metrics.targetRate}%
                            </span>
                        </h3>
                        <p className="text-[11px] text-slate-500">
                            {chartMode === 'daily'
                                ? `Nhịp doanh thu từng ngày với vạch kỳ vọng ${formatValue(metrics.plannedExpectedDailyPace)}/ngày và mốc chuẩn ${formatValue(metrics.plannedBaseDailyPace)}/ngày`
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
                                <span>Đạt chuẩn (100%)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                                <span>Hụt chuẩn (&lt;100%)</span>
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
                        {metrics.plannedExpectedDailyPace > 0 && (
                            <div className="flex items-center gap-1 text-amber-800">
                                <span className="w-4 h-0.5 bg-amber-500 inline-block" />
                                <span>Kế hoạch {metrics.targetRate}%: {formatValue(metrics.plannedExpectedDailyPace)}/ngày</span>
                            </div>
                        )}
                        {metrics.plannedBaseDailyPace > 0 && (
                            <div className="flex items-center gap-1 text-blue-700">
                                <span className="w-4 h-0.5 border-b border-dashed border-blue-500 inline-block" />
                                <span>Kế hoạch 100%: {formatValue(metrics.plannedBaseDailyPace)}/ngày</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* THANH THÔNG TIN CHI TIẾT KHI RÊ CHUỘT / CHẠM (ACTIVE DAY INSPECTOR BAR) */}
            <div className={`p-2.5 sm:p-3 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 flex-wrap text-xs ${
                activePoint
                    ? 'bg-blue-50/90 border-blue-200 shadow-xs'
                    : 'bg-slate-50 border-slate-200/90 text-slate-700'
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
                            {/* Chip đánh giá nhịp theo Kế hoạch ngày chuẩn của tháng */}
                            {chartMode === 'daily' ? (
                                activePoint.dailyPace >= metrics.plannedExpectedDailyPace ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[10px] inline-flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-emerald-600" /> Vượt kỳ vọng (+{formatValue(activePoint.dailyPace - metrics.plannedExpectedDailyPace)})
                                    </span>
                                ) : activePoint.dailyPace >= metrics.plannedBaseDailyPace ? (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 font-black text-[10px] inline-flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-blue-600" /> Đạt chuẩn 100%
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-black text-[10px] inline-flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Hụt chuẩn ({formatValue(activePoint.dailyPace - metrics.plannedBaseDailyPace)})
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
                    <div className="flex items-center justify-between w-full text-[11px] gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap text-slate-700">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-blue-600" />
                                <span>Nhịp bình quân thực thu:</span>
                            </span>
                            <span className="font-mono font-black text-emerald-700 text-xs">
                                +{formatValue(metrics.currentAvgPace)}/ngày
                            </span>
                            {/* Chip trạng thái tiến độ nhịp bình quân so với kế hoạch chuẩn */}
                            {metrics.plannedBaseDailyPace > 0 && (
                                metrics.currentAvgPace >= metrics.plannedExpectedDailyPace ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[9.5px] inline-flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-emerald-600" /> Vượt kỳ vọng ({metrics.targetRate}%)
                                    </span>
                                ) : metrics.currentAvgPace >= metrics.plannedBaseDailyPace ? (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 font-bold text-[9.5px] inline-flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-blue-600" /> Giữ vững chuẩn 100%
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[9.5px] inline-flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Cần bứt phá thêm
                                    </span>
                                )
                            )}
                            {/* Hướng dẫn thao tác: chỉ hiển thị trên màn hình thao tác trực tiếp, tự động ẩn 100% khi xuất ảnh báo cáo */}
                            <span
                                data-html2canvas-ignore="true"
                                data-export-ignore="true"
                                className="text-[10px] text-slate-400 font-normal italic hidden lg:inline"
                            >
                                • Chạm/rê chuột vào cột để soi chi tiết ngày
                            </span>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4 font-mono text-[11px] font-bold text-slate-600">
                            <div>
                                <span className="text-slate-400 font-sans font-normal text-[10px] mr-1">Tích lũy:</span>
                                <span>{timelineData.length}/{metrics.totalDays} ngày</span>
                            </div>
                            {metrics.peakDay && (
                                <div className="text-amber-900 flex items-center gap-1">
                                    <Flame className="w-3.5 h-3.5 text-rose-500" />
                                    <span className="text-slate-400 font-sans font-normal text-[10px]">Đỉnh tháng:</span>
                                    <span>{formatDate(metrics.peakDay.date, 'dd/mm')} (+{formatValue(metrics.peakDay.pace)})</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* KHU VỰC VẼ BIỂU ĐỒ */}
            {chartMode === 'daily' ? (
                <div className="relative pt-1 pb-1">
                    {/* Các cột dữ liệu - Tự động co giãn theo màn hình hoặc mở rộng mượt mà */}
                    <div 
                        data-chart-scroll-container="true"
                        className="h-64 sm:h-72 flex items-end gap-1 sm:gap-1.5 md:gap-2 overflow-x-auto no-scrollbar px-1.5 sm:px-2 pt-3 sm:pt-4 pb-2 relative"
                        onMouseLeave={() => setActivePoint(null)}
                    >
                        {/* VÙNG VẠCH THAM CHIẾU: KHỚP 100% VỚI CHIỀU CAO VÀ VỊ TRÍ CỦA BAR TRACK */}
                        <div 
                            data-reference-overlay="true"
                            className="absolute left-0 right-0 pointer-events-none z-10 px-1.5 sm:px-2"
                            style={{ bottom: '46px', height: '176px' }}
                        >
                            {/* Đường tham chiếu: Nhịp kế hoạch kỳ vọng vượt trội */}
                            {metrics.plannedExpectedDailyPace > 0 && expectedLinePercent > 0 && expectedLinePercent <= 100 && (
                                <div
                                    className="absolute left-1.5 right-1.5 flex items-center"
                                    style={{ bottom: `${expectedLinePercent}%` }}
                                >
                                    <div className="w-full border-b-2 border-dashed border-amber-500 opacity-80" />
                                    <span className="absolute right-0 -top-3.5 font-mono font-black text-[9px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap">
                                        Kỳ vọng {metrics.targetRate}%: {formatValue(metrics.plannedExpectedDailyPace)}
                                    </span>
                                </div>
                            )}

                            {/* Đường tham chiếu: Nhịp kế hoạch chuẩn 100% */}
                            {metrics.plannedBaseDailyPace > 0 && baseLinePercent > 0 && baseLinePercent <= 100 && (
                                <div
                                    className="absolute left-1.5 right-1.5 flex items-center"
                                    style={{ bottom: `${baseLinePercent}%` }}
                                >
                                    <div className="w-full border-b border-dashed border-blue-400 opacity-70" />
                                    <span className="absolute left-0 -top-3.5 font-mono font-bold text-[8.5px] bg-blue-50 text-blue-700 border border-blue-200 px-1 rounded whitespace-nowrap">
                                        Gốc 100%: {formatValue(metrics.plannedBaseDailyPace)}
                                    </span>
                                </div>
                            )}
                        </div>

                        {timelineData.map((d, index) => {
                            const heightPercent = Math.max(6, Math.min(100, Math.round((d.dailyPace / maxPace) * 100)));
                            const isPeak = metrics.peakDay && metrics.peakDay.date === d.reportDate;
                            const isCurrentActive = activePoint?.reportDate === d.reportDate;

                            let barColor = 'bg-blue-600';
                            let barTextColor = 'text-blue-700';

                            if (metrics.plannedExpectedDailyPace > 0 && d.dailyPace >= metrics.plannedExpectedDailyPace) {
                                barColor = 'bg-emerald-600';
                                barTextColor = 'text-emerald-700';
                            } else if (metrics.plannedBaseDailyPace > 0 && d.dailyPace >= metrics.plannedBaseDailyPace) {
                                barColor = 'bg-blue-600';
                                barTextColor = 'text-blue-700';
                            } else if (metrics.plannedBaseDailyPace > 0) {
                                barColor = 'bg-rose-500';
                                barTextColor = 'text-rose-600';
                            }

                            return (
                                <div
                                    key={d.reportDate}
                                    data-chart-bar="true"
                                    className="flex-1 min-w-[28px] sm:min-w-[34px] md:min-w-[40px] flex flex-col items-center gap-1 group relative h-full justify-end cursor-pointer transition-transform"
                                    onMouseEnter={() => setActivePoint(d)}
                                    onClick={() => setActivePoint(d)}
                                >
                                    {/* Badge số trên đỉnh cột */}
                                    <div className={`font-mono text-[8px] sm:text-[9px] font-bold ${barTextColor} mb-0.5 whitespace-nowrap text-center leading-none transition-transform ${isCurrentActive ? 'scale-115 font-black text-blue-800' : ''}`}>
                                        {d.dailyPace > 0 ? (d.dailyPace >= 100 ? `+${d.dailyPace.toFixed(0)}` : `+${formatValue(d.dailyPace)}`) : '0'}
                                    </div>

                                    {/* Thanh Bar Track - Chiều cao cố định 176px tương thích 100% vạch tham chiếu */}
                                    <div
                                        data-bar-track="true"
                                        className={`w-full rounded-t-lg flex items-end overflow-hidden transition-all ${
                                            isCurrentActive ? 'ring-2 ring-blue-500 shadow-md brightness-105' : ''
                                        } ${
                                            d.isWeekend ? 'bg-amber-100/70 ring-1 ring-amber-300/60' : 'bg-slate-200/70'
                                        }`}
                                        style={{ height: '176px' }}
                                    >
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
                                    <div className="flex flex-col items-center mt-1 h-9 justify-center">
                                        <span className={`text-[8px] sm:text-[9px] font-mono font-bold whitespace-nowrap text-center tracking-tighter leading-tight ${
                                            d.isWeekend ? 'text-amber-800 font-black' : 'text-slate-700'
                                        } ${isCurrentActive ? 'text-blue-700 underline font-black' : ''}`}>
                                            {formatDate(d.reportDate, 'dd/mm')}
                                        </span>
                                        <span className={`text-[7.5px] sm:text-[8px] uppercase font-bold whitespace-nowrap text-center tracking-tighter leading-tight ${
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
                <div className="relative pt-1 pb-1">
                    <div 
                        data-chart-scroll-container="true"
                        className="h-64 sm:h-72 flex items-end gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar px-1.5 sm:px-2 pt-3 sm:pt-4 pb-2 relative"
                        onMouseLeave={() => setActivePoint(null)}
                    >
                        {timelineData.map((d, index) => {
                            const actualPercent = Math.min(100, Math.max(5, Math.round((d.revenueActual / maxCumulative) * 100)));
                            const baseTargetPercent = Math.min(100, Math.max(5, Math.round((d.revenueTarget / maxCumulative) * 100)));
                            const expectedTargetPercent = Math.min(100, Math.max(5, Math.round((metrics.expectedTarget / maxCumulative) * 100)));
                            const isCurrentActive = activePoint?.reportDate === d.reportDate;

                            return (
                                <div
                                    key={d.reportDate}
                                    data-chart-bar="true"
                                    className="flex-1 min-w-[28px] sm:min-w-[34px] md:min-w-[40px] flex flex-col items-center gap-1 group relative h-full justify-end cursor-pointer transition-transform"
                                    onMouseEnter={() => setActivePoint(d)}
                                    onClick={() => setActivePoint(d)}
                                >
                                    <div className={`font-mono text-[8px] sm:text-[9px] font-bold text-slate-600 mb-0.5 whitespace-nowrap text-center leading-none ${isCurrentActive ? 'text-blue-700 font-black scale-115' : ''}`}>
                                        {d.completionRate.toFixed(0)}%
                                    </div>

                                    <div
                                        data-bar-track="true"
                                        className={`w-full bg-slate-200/70 rounded-t-lg flex items-end justify-center relative overflow-hidden transition-all ${
                                            isCurrentActive ? 'ring-2 ring-blue-500 shadow-md brightness-105' : ''
                                        }`}
                                        style={{ height: '176px' }}
                                    >
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

                                    <div className="flex flex-col items-center mt-1 h-9 justify-center">
                                        <span className={`text-[8px] sm:text-[9px] font-mono font-bold whitespace-nowrap text-center tracking-tighter leading-tight text-slate-700 ${isCurrentActive ? 'text-blue-700 underline font-black' : ''}`}>
                                            {formatDate(d.reportDate, 'dd/mm')}
                                        </span>
                                        <span className="text-[7.5px] sm:text-[8px] font-mono text-emerald-600 font-bold whitespace-nowrap text-center tracking-tighter leading-tight">
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
