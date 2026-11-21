import React from 'react';
import { formatDate, formatValue } from '../../../core/lib/formatters';
import { ArrowUpRight, ArrowDownRight, Sparkles, Flame } from 'lucide-react';
import type { DailyTrendPoint, RevenueTrendMetrics } from '../hooks/useRevenueTrendData';

interface RevenueTrendDailyTableProps {
    timelineData: DailyTrendPoint[];
    metrics: RevenueTrendMetrics;
    selectedStore: string;
}

export default function RevenueTrendDailyTable({ timelineData, metrics, selectedStore }: RevenueTrendDailyTableProps) {
    if (timelineData.length === 0) return null;

    const isCluster = selectedStore === 'Tổng' || selectedStore === 'all' || /^(tổng|tong|toàn cụm)/i.test(selectedStore);

    return (
        <div data-report-table="true" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs font-avo">
            <div className="p-3.5 sm:p-4 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h3 className="font-black text-xs sm:text-sm uppercase text-slate-800 tracking-wider flex items-center gap-2 flex-wrap">
                        <span>Nhịp Doanh Thu Chi Tiết Theo Ngày</span>
                        <span className="text-blue-700 font-black">
                            ({isCluster ? 'Toàn Cụm' : selectedStore})
                        </span>
                        <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-black px-1.5 py-0.5 rounded">
                            Mốc kỳ vọng: {metrics.targetRate}%
                        </span>
                    </h3>
                </div>
                <div className="text-[11px] font-mono text-slate-500 font-bold self-start sm:self-auto">
                    Tổng: <span className="text-blue-700">{timelineData.length}</span> ngày ghi nhận
                </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-xs text-left font-avo report-table">
                    <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-black border-b border-slate-200">
                        <tr>
                            <th className="py-2.5 px-2.5 sm:px-3">Ngày & Thứ</th>
                            <th className="py-2.5 px-2.5 sm:px-3 text-right text-blue-800">Nhịp Ngày (+DT)</th>
                            <th className="py-2.5 px-2 text-right">Biến Động (Δ)</th>
                            <th className="py-2.5 px-2.5 sm:px-3 text-right text-emerald-800">Lũy Kế DTQĐ</th>
                            <th className="py-2.5 px-2 text-right">Target Gốc</th>
                            <th className="py-2.5 px-2 text-right">% HT Gốc</th>
                            <th className="py-2.5 px-2.5 sm:px-3 text-right text-purple-700">Trả Chậm & %</th>
                            <th className="py-2.5 px-2.5 text-center">Đánh Giá Nhịp</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {timelineData.map((d) => {
                            const isPeak = metrics.peakDay && metrics.peakDay.date === d.reportDate;
                            const isAboveExpected = metrics.plannedExpectedDailyPace > 0 && d.dailyPace >= metrics.plannedExpectedDailyPace;
                            const isAboveBase = metrics.plannedBaseDailyPace > 0 && d.dailyPace >= metrics.plannedBaseDailyPace;

                            return (
                                <tr
                                    key={d.reportDate}
                                    className={`transition ${
                                        d.isWeekend
                                            ? 'bg-amber-50/40 hover:bg-amber-50/70'
                                            : 'hover:bg-slate-50'
                                    }`}
                                >
                                    {/* CỘT NGÀY & THỨ */}
                                    <td className="py-2 px-2.5 sm:px-3 font-semibold text-slate-800">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono font-bold text-slate-900">
                                                {formatDate(d.reportDate, 'dd/mm')}
                                            </span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                d.isWeekend
                                                    ? 'bg-amber-100 text-amber-800 font-black border border-amber-300/80'
                                                    : 'text-slate-500'
                                            }`}>
                                                {d.dayOfWeekLabel}
                                            </span>
                                            {isPeak && (
                                                <span className="text-[9px] bg-rose-100 text-rose-700 border border-rose-300 px-1 py-0.5 rounded font-black flex items-center gap-0.5" title="Ngày đạt doanh thu cao nhất">
                                                    <Flame className="w-2.5 h-2.5" /> Đỉnh
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* CỘT NHỊP NGÀY (+DT) */}
                                    <td className="py-2 px-2.5 sm:px-3 text-right font-mono font-black text-slate-900 text-xs sm:text-[13px] tabular-nums">
                                        +{formatValue(d.dailyPace)}
                                    </td>

                                    {/* CỘT BIẾN ĐỘNG (Δ) */}
                                    <td className="py-2 px-2 text-right font-mono text-[11px] tabular-nums">
                                        {d.paceDiff !== 0 ? (
                                            <span className={`inline-flex items-center font-bold ${
                                                d.paceDiff > 0 ? 'text-emerald-600' : 'text-rose-600'
                                            }`}>
                                                {d.paceDiff > 0 ? '+' : ''}{formatValue(d.paceDiff)}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">—</span>
                                        )}
                                    </td>

                                    {/* CỘT LŨY KẾ DTQĐ */}
                                    <td className="py-2 px-2.5 sm:px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                                        {formatValue(d.revenueActual)}
                                    </td>

                                    {/* CỘT TARGET GỐC */}
                                    <td className="py-2 px-2 text-right font-mono text-slate-500 tabular-nums">
                                        {formatValue(d.revenueTarget)}
                                    </td>

                                    {/* CỘT % HOÀN THÀNH GỐC */}
                                    <td className="py-2 px-2 text-right font-mono tabular-nums">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            d.completionRate >= 100
                                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                                : d.completionRate >= 80
                                                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                                    : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {d.completionRate.toFixed(1)}%
                                        </span>
                                    </td>

                                    {/* CỘT TRẢ CHẬM & % */}
                                    <td className="py-2 px-2.5 sm:px-3 text-right font-mono tabular-nums text-purple-700">
                                        <div className="font-bold">
                                            {formatValue(d.dailyInstallment)}
                                        </div>
                                        {d.installmentRate > 0 && (
                                            <div className="text-[9.5px] text-purple-500">
                                                ({d.installmentRate.toFixed(0)}%)
                                            </div>
                                        )}
                                    </td>

                                    {/* CỘT ĐÁNH GIÁ NHỊP */}
                                    <td className="py-2 px-2.5 text-center">
                                        {metrics.plannedExpectedDailyPace <= 0 ? (
                                            <span className="text-[10px] text-slate-400 font-bold">Bình thường</span>
                                        ) : isAboveExpected ? (
                                            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                                                🚀 Vượt kỳ vọng ({metrics.targetRate}%)
                                            </span>
                                        ) : isAboveBase ? (
                                            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                                                ⚡ Đạt chuẩn 100%
                                            </span>
                                        ) : (
                                            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                                ⚠️ Hụt chuẩn (&lt;100%)
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
