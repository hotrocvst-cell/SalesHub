import React from 'react';
import { formatValue } from '../../../core/lib/formatters';
import type { CampaignItem } from '../utils/dailyReportParsers';

interface DailyRealtimeTableProps {
    campaigns: CampaignItem[];
    isPointsEnabled?: boolean;
    isLoading?: boolean;
}

export default function DailyRealtimeTable({
    campaigns,
    isPointsEnabled = false,
    isLoading = false
}: DailyRealtimeTableProps) {
    return (
        <div className="space-y-2.5">
            {/* Chú giải màu sắc phân loại hiệu quả thi đua */}
            <div
                className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs"
                data-html2canvas-ignore="true"
                data-export-ignore="true"
            >
                <span className="text-[11px] text-slate-600 font-medium">
                    * Bảng thi đua ngày tự động sắp xếp theo %HT giảm dần
                </span>

                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-700" aria-hidden="true"></span> Đạt (≥100%)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 border border-amber-300 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-amber-700" aria-hidden="true"></span> Cận đích (80-99%)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 text-orange-950 border border-orange-300 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-orange-700" aria-hidden="true"></span> Tăng tốc (50-79%)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-950 border border-rose-300 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-rose-700" aria-hidden="true"></span> Yếu/Chậm (&lt;50%)
                    </span>
                </div>
            </div>

            {/* BẢNG SỐ LIỆU CHI TIẾT */}
            <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-sm">
                <table className="w-full text-left border-collapse text-xs font-avo report-table">
                    {/* THEAD ĐỘ TƯƠNG PHẢN CAO */}
                    <thead>
                        <tr className="border-b-2 border-slate-300 text-white text-[11px]">
                            <th className="py-2 sm:py-2.5 px-1.5 sm:px-2 text-center w-8 bg-slate-900 border-r border-slate-700 font-black tracking-wider">
                                #
                            </th>
                            <th className="py-2 sm:py-2.5 px-2 sm:px-3 text-left bg-slate-900 border-r border-slate-700 font-black tracking-wide">
                                THI ĐUA
                            </th>
                            {isPointsEnabled && (
                                <th className="py-2 sm:py-2.5 px-1.5 sm:px-2 text-center w-12 bg-slate-800 border-r border-slate-700 font-black">
                                    ĐIỂM
                                </th>
                            )}
                            <th className="py-2 sm:py-2.5 px-1.5 sm:px-2.5 text-center bg-blue-700 font-black tracking-wider border-r border-blue-600">
                                TARGET
                            </th>
                            <th className="py-2 sm:py-2.5 px-1.5 sm:px-2.5 text-center bg-blue-700 font-black tracking-wider border-r border-slate-700">
                                REALTIME
                            </th>
                            <th className="py-2 sm:py-2.5 px-1.5 sm:px-2 text-center w-20 bg-blue-900 font-black tracking-wider border-r border-blue-800">
                                % HT
                            </th>
                            <th className="py-2 sm:py-2.5 px-1.5 sm:px-2.5 text-center bg-rose-700 font-black tracking-wider border-r border-slate-700">
                                CÒN LẠI
                            </th>
                            <th className="py-2 sm:py-2.5 px-1.5 sm:px-2 text-center w-12 bg-slate-900 font-black">
                                KẾT QUẢ
                            </th>
                        </tr>
                    </thead>

                    {/* TBODY: PHÂN BIỆT MÀU DÒNG RÕ NÉT */}
                    <tbody className="divide-y divide-slate-200/90 font-medium">
                        {isLoading && campaigns.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={isPointsEnabled ? 8 : 7}
                                    className="py-8 text-center text-slate-600 font-semibold bg-white"
                                >
                                    Đang tải số liệu Realtime từ Cloud...
                                </td>
                            </tr>
                        ) : campaigns.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={isPointsEnabled ? 8 : 7}
                                    className="py-8 text-center text-slate-600 font-medium italic bg-white"
                                >
                                    Chưa có mục thi đua nào có Target &gt; 0. Hãy bấm &ldquo;Nạp Doanh Thu &amp; Thi Đua&rdquo; để cập nhật số liệu.
                                </td>
                            </tr>
                        ) : (
                            campaigns.map((d, idx) => {
                                const isPassed = d.pctHT >= 100;
                                const isNear = d.pctHT >= 80 && d.pctHT < 100;
                                const isSpeed = d.pctHT >= 50 && d.pctHT < 80;
                                const isAlert = d.pctHT < 50;
                                const remain = Math.max(0, d.target - d.actual);

                                // Màu nền dòng dựa trên hiệu quả thi đua
                                const rowBg = isPassed
                                    ? 'bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-950'
                                    : isNear
                                        ? 'bg-amber-50/70 hover:bg-amber-100/80 text-amber-950'
                                        : isSpeed
                                            ? 'bg-orange-50/50 hover:bg-orange-100/70 text-orange-950'
                                            : 'bg-rose-50/80 hover:bg-rose-100/90 text-rose-950';

                                return (
                                    <tr
                                        key={d.label + idx}
                                        className={`border-b border-slate-200 transition-colors ${rowBg}`}
                                    >
                                        {/* STT */}
                                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center text-slate-700 font-mono tabular-nums text-[10.5px] border-r border-slate-200/70 font-bold">
                                            {idx + 1}
                                        </td>

                                        {/* Tên Thi Đua & Badge Trạng Thái */}
                                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 border-r border-slate-200/70">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-black text-slate-900 text-xs">
                                                    {d.label}
                                                </span>

                                                {isPassed ? (
                                                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded shadow-sm">
                                                        ✓ Đạt ngày
                                                    </span>
                                                ) : isNear ? (
                                                    <span className="text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded shadow-sm">
                                                        ⚡ Cận đích
                                                    </span>
                                                ) : isAlert ? (
                                                    <span className="text-[9px] font-bold bg-rose-700 text-white px-1.5 py-0.5 rounded shadow-sm">
                                                        🚨 Chậm
                                                    </span>
                                                ) : null}
                                            </div>
                                        </td>

                                        {/* Điểm nếu bật */}
                                        {isPointsEnabled && (
                                            <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center text-slate-600 tabular-nums whitespace-nowrap border-r border-slate-200/70">
                                                -
                                            </td>
                                        )}

                                        {/* Target Ngày */}
                                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center font-mono tabular-nums font-bold text-blue-900 border-r border-slate-200/70">
                                            {formatValue(d.target)}
                                        </td>

                                        {/* Realtime Thực Hiện */}
                                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center font-mono tabular-nums font-black text-slate-900 text-xs border-r border-slate-200/70">
                                            {formatValue(d.actual)}
                                        </td>

                                        {/* % HT */}
                                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center font-mono tabular-nums border-r border-slate-200/70">
                                            <span
                                                className={`px-2 py-0.5 rounded-md text-[11px] font-black inline-block shadow-sm ${
                                                    isPassed
                                                        ? 'bg-emerald-700 text-white ring-1 ring-emerald-800/40'
                                                        : isNear
                                                            ? 'bg-amber-700 text-white ring-1 ring-amber-800/40'
                                                            : isSpeed
                                                                ? 'bg-orange-700 text-white ring-1 ring-orange-800/40'
                                                                : 'bg-rose-700 text-white ring-1 ring-rose-800/40'
                                                }`}
                                            >
                                                {d.pctHT.toFixed(1)}%
                                            </span>
                                        </td>

                                        {/* Mục Tiêu Còn Lại */}
                                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center font-mono tabular-nums font-black border-r border-slate-200/70">
                                            {remain > 0 ? (
                                                <span className="text-rose-700 font-black">
                                                    {formatValue(remain)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-600 font-bold">0</span>
                                            )}
                                        </td>

                                        {/* Kết Quả */}
                                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center whitespace-nowrap align-middle">
                                            {isPassed ? (
                                                <span
                                                    aria-label="Đạt"
                                                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-700 text-white text-[11px] font-bold shadow-sm"
                                                >
                                                    ✓
                                                </span>
                                            ) : (
                                                <span
                                                    aria-label="Chưa đạt"
                                                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-700 text-white text-[11px] font-bold shadow-sm"
                                                >
                                                    ✕
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
