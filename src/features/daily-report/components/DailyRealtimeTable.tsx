import React from 'react';
import { formatValue } from '../../../core/lib/formatters';
import type { CampaignItem } from '../utils/dailyReportParsers';

interface DailyRealtimeTableProps {
    campaigns: CampaignItem[];
    isPointsEnabled?: boolean;
}

export default function DailyRealtimeTable({ campaigns, isPointsEnabled = false }: DailyRealtimeTableProps) {
    return (
        <div className="space-y-2.5">
            {/* Chú giải màu sắc phân loại hiệu quả thi đua */}
            <div
                className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs"
                data-html2canvas-ignore="true"
                data-export-ignore="true"
            >
                <span className="text-[11px] text-slate-500 font-medium">
                    * Bảng thi đua ngày tự động sắp xếp theo %HT giảm dần
                </span>

                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Đạt (≥100%)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span> Cận đích (80-99%)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 text-orange-900 border border-orange-300 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span> Tăng tốc (50-79%)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-rose-600"></span> Yếu/Chậm (&lt;50%)
                    </span>
                </div>
            </div>

            {/* BẢNG SỐ LIỆU CHI TIẾT */}
            <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-sm">
                <table className="w-full text-left border-collapse text-xs font-avo report-table">
                    {/* THEAD ĐỘ TƯƠNG PHẢN CAO */}
                    <thead>
                        <tr className="border-b-2 border-slate-300 text-white text-[11px]">
                            <th className="py-2.5 px-2 text-center w-8 bg-slate-900 border-r border-slate-700 font-black tracking-wider">
                                #
                            </th>
                            <th className="py-2.5 px-3 text-left bg-slate-900 border-r border-slate-700 font-black tracking-wide">
                                THI ĐUA
                            </th>
                            {isPointsEnabled && (
                                <th className="py-2.5 px-2 text-center w-12 bg-slate-800 border-r border-slate-700 font-black">
                                    ĐIỂM
                                </th>
                            )}
                            <th className="py-2.5 px-2.5 text-center bg-blue-700 font-black tracking-wider border-r border-blue-600">
                                TARGET
                            </th>
                            <th className="py-2.5 px-2.5 text-center bg-blue-700 font-black tracking-wider border-r border-slate-700">
                                REALTIME
                            </th>
                            <th className="py-2.5 px-2 text-center w-20 bg-indigo-800 font-black tracking-wider border-r border-indigo-700">
                                % HT
                            </th>
                            <th className="py-2.5 px-2.5 text-center bg-rose-700 font-black tracking-wider border-r border-slate-700">
                                CÒN LẠI
                            </th>
                            <th className="py-2.5 px-2 text-center w-12 bg-slate-900 font-black">
                                KẾT QUẢ
                            </th>
                        </tr>
                    </thead>

                    {/* TBODY: PHÂN BIỆT MÀU DÒNG RÕ NÉT */}
                    <tbody className="divide-y divide-slate-200/90 font-medium">
                        {campaigns.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={isPointsEnabled ? 8 : 7}
                                    className="py-8 text-center text-slate-400 font-medium italic bg-white"
                                >
                                    Chưa có mục thi đua nào có Target &gt; 0. Hãy dán dữ liệu và bấm "XỬ LÝ SỐ LIỆU".
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
                                        <td className="p-2 text-center text-slate-500 font-mono text-[10.5px] border-r border-slate-200/70 font-bold">
                                            {idx + 1}
                                        </td>

                                        {/* Tên Thi Đua & Badge Trạng Thái */}
                                        <td className="p-2 border-r border-slate-200/70">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-black text-slate-900 text-xs">
                                                    {d.label}
                                                </span>

                                                {isPassed ? (
                                                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1 py-0.2 rounded shadow-2xs">
                                                        ✓ Đạt ngày
                                                    </span>
                                                ) : isNear ? (
                                                    <span className="text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1 py-0.2 rounded shadow-2xs">
                                                        ⚡ Cận đích
                                                    </span>
                                                ) : isAlert ? (
                                                    <span className="text-[9px] font-bold bg-rose-600 text-white px-1 py-0.2 rounded shadow-2xs">
                                                        🚨 Chậm
                                                    </span>
                                                ) : null}
                                            </div>
                                        </td>

                                        {/* Điểm nếu bật */}
                                        {isPointsEnabled && (
                                            <td className="p-2 text-center text-slate-400 whitespace-nowrap border-r border-slate-200/70">
                                                -
                                            </td>
                                        )}

                                        {/* Target Ngày */}
                                        <td className="p-2 text-center font-mono font-bold text-blue-900 border-r border-slate-200/70">
                                            {formatValue(d.target)}
                                        </td>

                                        {/* Realtime Thực Hiện */}
                                        <td className="p-2 text-center font-mono font-black text-slate-900 text-xs border-r border-slate-200/70">
                                            {formatValue(d.actual)}
                                        </td>

                                        {/* % HT */}
                                        <td className="p-2 text-center font-mono border-r border-slate-200/70">
                                            <span
                                                className={`px-2 py-0.5 rounded-md text-[11px] font-black inline-block shadow-2xs ${
                                                    isPassed
                                                        ? 'bg-emerald-600 text-white ring-1 ring-emerald-700/40'
                                                        : isNear
                                                            ? 'bg-amber-500 text-white ring-1 ring-amber-600/40'
                                                            : isSpeed
                                                                ? 'bg-orange-500 text-white ring-1 ring-orange-600/40'
                                                                : 'bg-rose-600 text-white ring-1 ring-rose-700/40'
                                                }`}
                                            >
                                                {d.pctHT.toFixed(1)}%
                                            </span>
                                        </td>

                                        {/* Mục Tiêu Còn Lại */}
                                        <td className="p-2 text-center font-mono font-black border-r border-slate-200/70">
                                            {remain > 0 ? (
                                                <span className="text-rose-700 font-black">
                                                    {formatValue(remain)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 font-bold">0</span>
                                            )}
                                        </td>

                                        {/* Kết Quả */}
                                        <td className="p-2 text-center whitespace-nowrap align-middle">
                                            {isPassed ? (
                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-2xs">
                                                    ✓
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-bold shadow-2xs">
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
