import React from 'react';
import { formatValue } from '../../../core/lib/formatters';
import { Store, TrendingUp, AlertTriangle, CheckCircle2, Target } from 'lucide-react';
import type { StorePaceItem, RevenueTrendMetrics } from '../hooks/useRevenueTrendData';

interface RevenueTrendStoreComparisonTableProps {
    storePaceRankings: StorePaceItem[];
    metrics: RevenueTrendMetrics;
    onSelectStore?: (storeName: string) => void;
}

export default function RevenueTrendStoreComparisonTable({
    storePaceRankings,
    metrics,
    onSelectStore
}: RevenueTrendStoreComparisonTableProps) {
    if (storePaceRankings.length === 0) return null;

    return (
        <div data-report-table="true" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs font-avo">
            <div className="p-3.5 sm:p-4 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h3 className="font-black text-xs sm:text-sm uppercase text-slate-800 tracking-wider flex items-center gap-2 flex-wrap">
                        <Store className="w-4 h-4 text-blue-700" />
                        <span>Bảng So Sánh & Xếp Hạng Tốc Độ Các ST Trong Cụm</span>
                        <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-black px-1.5 py-0.5 rounded">
                            Chung cụm: {metrics.targetRate}%
                        </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                        Xếp hạng năng lực về đích theo mục tiêu kỳ vọng vượt trội của từng ST, phát hiện ngay nhóm tăng tốc và nhóm cần kéo nhịp
                    </p>
                </div>
                <div className="text-[11px] font-mono text-slate-500 font-bold self-start sm:self-auto">
                    Quy mô: <span className="text-blue-700">{storePaceRankings.length}</span> ST
                </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-xs text-left font-avo report-table">
                    <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-black border-b border-slate-200">
                        <tr>
                            <th className="py-2.5 px-2 text-center w-10">Hạng</th>
                            <th className="py-2.5 px-3">ST</th>
                            <th className="py-2.5 px-2 text-right">Target Gốc</th>
                            <th className="py-2.5 px-2.5 text-right text-amber-900">Mục Tiêu Kỳ Vọng</th>
                            <th className="py-2.5 px-2.5 text-right text-emerald-800">Lũy Kế DTQĐ</th>
                            <th className="py-2.5 px-2 text-right">% HT Gốc</th>
                            <th className="py-2.5 px-2 text-right text-amber-800 font-black">% HT Kỳ Vọng</th>
                            <th className="py-2.5 px-2.5 text-right text-slate-900">Nhịp Gần Nhất</th>
                            <th className="py-2.5 px-2 text-right text-amber-700">Cần Chạy / Ngày</th>
                            <th className="py-2.5 px-2.5 text-center">Đánh Giá</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {storePaceRankings.map((s, idx) => {
                            const rank = idx + 1;
                            const isTop1 = rank === 1;

                            return (
                                <tr
                                    key={s.storeName}
                                    onClick={() => onSelectStore && onSelectStore(s.storeName)}
                                    className="hover:bg-blue-50/40 transition cursor-pointer"
                                    title="Nhấp để xem chi tiết nhịp của ST này"
                                >
                                    {/* HẠNG */}
                                    <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600">
                                        {isTop1 ? (
                                            <span className="text-sm">🥇</span>
                                        ) : rank === 2 ? (
                                            <span className="text-sm">🥈</span>
                                        ) : rank === 3 ? (
                                            <span className="text-sm">🥉</span>
                                        ) : (
                                            `#${rank}`
                                        )}
                                    </td>

                                    {/* TÊN ST */}
                                    <td className="py-2.5 px-3 font-bold text-slate-900">
                                        <div className="flex items-center gap-1.5">
                                            <span className="hover:text-blue-700 transition">
                                                {s.storeName}
                                            </span>
                                            {isTop1 && (
                                                <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-1 rounded border border-amber-300">
                                                    Dẫn đầu
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* TARGET GỐC */}
                                    <td className="py-2.5 px-2 text-right font-mono text-slate-500 tabular-nums">
                                        {formatValue(s.target)}
                                    </td>

                                    {/* MỤC TIÊU KỲ VỌNG */}
                                    <td className="py-2.5 px-2.5 text-right font-mono font-bold text-amber-900 tabular-nums">
                                        <span>{formatValue(s.expectedTarget)}</span>
                                        <span className="text-[9.5px] text-amber-700 block font-normal">
                                            ({s.targetRate}%)
                                        </span>
                                    </td>

                                    {/* LŨY KẾ DTQĐ */}
                                    <td className="py-2.5 px-2.5 text-right font-mono font-black text-emerald-700 tabular-nums">
                                        {formatValue(s.actual)}
                                    </td>

                                    {/* % HOÀN THÀNH GỐC */}
                                    <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            s.completionRate >= 100
                                                ? 'bg-emerald-50 text-emerald-800'
                                                : 'text-slate-700'
                                        }`}>
                                            {s.completionRate.toFixed(1)}%
                                        </span>
                                    </td>

                                    {/* % HOÀN THÀNH KỲ VỌNG */}
                                    <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                                        <span className={`px-2 py-0.5 rounded text-[10.5px] font-black ${
                                            s.expectedCompletionRate >= 100
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                : s.expectedCompletionRate >= 80
                                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                                        }`}>
                                            {s.expectedCompletionRate.toFixed(1)}%
                                        </span>
                                    </td>

                                    {/* NHỊP GẦN NHẤT */}
                                    <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                                        +{formatValue(s.latestPace)}
                                    </td>

                                    {/* NHỊP CẦN CHẠY / NGÀY */}
                                    <td className="py-2.5 px-2 text-right font-mono font-bold text-amber-800 tabular-nums">
                                        {formatValue(s.requiredDailyPace)}
                                    </td>

                                    {/* ĐÁNH GIÁ TỐC ĐỘ */}
                                    <td className="py-2.5 px-2.5 text-center">
                                        {s.status === 'leading' ? (
                                            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                                                🚀 Vượt kỳ vọng
                                            </span>
                                        ) : s.status === 'on_track' ? (
                                            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap">
                                                ⚡ Đạt mốc 100%
                                            </span>
                                        ) : (
                                            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 whitespace-nowrap">
                                                ⚠️ Cần kéo nhịp
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
