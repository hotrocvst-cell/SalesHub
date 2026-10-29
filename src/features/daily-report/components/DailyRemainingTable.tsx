import React from 'react';
import { formatValue } from '../../../core/lib/formatters';
import type { RemainingCampaignItem, RemainingSortMode } from '../utils/dailyRemainingUtils';

interface DailyRemainingTableProps {
    campaigns: RemainingCampaignItem[];
    showCompletedCampaigns: boolean;
    onToggleShowCompleted: (checked: boolean) => void;
    completedCount: number;
    sortMode: RemainingSortMode;
    onSortModeChange: (mode: RemainingSortMode) => void;
}

export default function DailyRemainingTable({
    campaigns,
    showCompletedCampaigns,
    onToggleShowCompleted,
    completedCount,
    sortMode,
    onSortModeChange
}: DailyRemainingTableProps) {
    return (
        <div className="space-y-2.5">
            {/* Thanh tùy chọn & Chú giải màu sắc phân loại hiệu quả */}
            <div
                className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 px-1 text-xs"
                data-html2canvas-ignore="true"
                data-export-ignore="true"
            >
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Toggle Sắp xếp 2 lựa chọn: Lũy kế vs Realtime */}
                    <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[11px] font-black text-slate-500 uppercase px-1.5 hidden sm:inline">
                            Sắp xếp:
                        </span>
                        <button
                            type="button"
                            onClick={() => onSortModeChange('CUMULATIVE')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                                sortMode === 'CUMULATIVE'
                                    ? 'bg-amber-600 text-white shadow-xs font-black ring-1 ring-amber-700/50'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-bold'
                            }`}
                            title="Sắp xếp danh sách theo % Hoàn thành Lũy Kế Tháng giảm dần"
                        >
                            <span>📊 % HT Lũy kế</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onSortModeChange('REALTIME')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                                sortMode === 'REALTIME'
                                    ? 'bg-blue-600 text-white shadow-xs font-black ring-1 ring-blue-700/50'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-bold'
                            }`}
                            title="Sắp xếp danh sách theo % Hoàn thành Realtime Ngày giảm dần"
                        >
                            <span>⚡ % HT Realtime</span>
                        </button>
                    </div>

                    {/* Checkbox hiện cả thi đua đã đạt tháng */}
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium">
                        <input
                            type="checkbox"
                            checked={showCompletedCampaigns}
                            onChange={(e) => onToggleShowCompleted(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs">
                            Hiện đã đạt tháng{' '}
                            {completedCount > 0 && (
                                <span className="font-bold text-emerald-700">({completedCount} mục)</span>
                            )}
                        </span>
                    </label>
                </div>

                {/* Chú giải màu sắc trạng thái hiệu quả */}
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
                    {/* THEAD 2 TẦNG ĐỘ TƯƠNG PHẢN CAO */}
                    <thead>
                        {/* HÀNG 1: TIÊU ĐỀ GOM NHÓM ĐẬM NÉT */}
                        <tr className="border-b border-slate-300 text-white">
                            <th
                                rowSpan={2}
                                className="py-2 px-1.5 text-center w-8 align-middle bg-slate-900 border-r border-slate-700 font-black tracking-wider"
                            >
                                #
                            </th>
                            <th
                                rowSpan={2}
                                className="py-2 px-2.5 text-left align-middle bg-slate-900 border-r border-slate-700 font-black tracking-wide"
                            >
                                THI ĐUA
                            </th>

                            {/* Gom nhóm Lũy Kế Tháng */}
                            <th
                                colSpan={4}
                                className="py-1.5 px-2 text-center bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white font-black uppercase tracking-wider border-r border-amber-900/60 shadow-xs text-[11px]"
                            >
                                📊 LŨY KẾ THÁNG {sortMode === 'CUMULATIVE' && (
                                    <span className="ml-1 text-[9px] bg-amber-950/80 text-amber-200 px-1.5 py-0.5 rounded font-black tracking-normal">
                                        ĐANG SẮP XẾP ↓
                                    </span>
                                )}
                            </th>

                            {/* Gom nhóm Realtime */}
                            <th
                                colSpan={4}
                                className="py-1.5 px-2 text-center bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white font-black uppercase tracking-wider shadow-xs text-[11px]"
                            >
                                ⚡ THỰC HIỆN REALTIME {sortMode === 'REALTIME' && (
                                    <span className="ml-1 text-[9px] bg-blue-950/80 text-blue-200 px-1.5 py-0.5 rounded font-black tracking-normal">
                                        ĐANG SẮP XẾP ↓
                                    </span>
                                )}
                            </th>
                        </tr>

                        {/* HÀNG 2: CÁC CỘT CHI TIẾT CÓ NỀN TƯƠNG PHẢN */}
                        <tr className="text-[10.5px] border-b-2 border-slate-300">
                            {/* Cột con nhóm Lũy Kế Tháng */}
                            <th className="py-1.5 px-2 text-center bg-amber-100 text-amber-950 font-black">
                                TARGET
                            </th>
                            <th className={`py-1.5 px-2 text-center font-black ${
                                sortMode === 'CUMULATIVE'
                                    ? 'bg-amber-200 text-amber-950 ring-2 ring-inset ring-amber-600/60'
                                    : 'bg-amber-100 text-amber-950'
                            }`}>
                                LŨY KẾ (% HT) {sortMode === 'CUMULATIVE' && '↓'}
                            </th>
                            <th className="py-1.5 px-2 text-center bg-amber-100 text-rose-800 font-black">
                                CÒN LẠI
                            </th>
                            <th className="py-1.5 px-2 text-center bg-amber-100 text-amber-950 font-black border-r-2 border-slate-300">
                                TB/NGÀY
                            </th>

                            {/* Cột con nhóm Realtime */}
                            <th className="py-1.5 px-2 text-center bg-blue-100 text-blue-950 font-black">
                                TARGET NGÀY
                            </th>
                            <th className="py-1.5 px-2 text-center bg-blue-100 text-blue-950 font-black">
                                REALTIME
                            </th>
                            <th className={`py-1.5 px-2 text-center font-black w-20 ${
                                sortMode === 'REALTIME'
                                    ? 'bg-blue-200 text-blue-950 ring-2 ring-inset ring-blue-600/60'
                                    : 'bg-blue-100 text-indigo-950'
                            }`}>
                                % HT NGÀY {sortMode === 'REALTIME' && '↓'}
                            </th>
                            <th className="py-1.5 px-2 text-center bg-blue-100 text-rose-800 font-black">
                                THIẾU
                            </th>
                        </tr>
                    </thead>

                    {/* TBODY: MÀU DÒNG PHÂN BIỆT THEO TIẾN ĐỘ THI ĐUA */}
                    <tbody className="divide-y divide-slate-200/90 font-medium">
                        {campaigns.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="p-8 text-center text-slate-400 font-medium italic bg-white">
                                    Không có số liệu thi đua phù hợp. Hãy dán dữ liệu hoặc tích chọn "Hiện cả thi đua đã đạt tháng".
                                </td>
                            </tr>
                        ) : (
                            campaigns.map((c, idx) => {
                                const isPassed = c.appliedPctHT >= 100;
                                const isNear = c.appliedPctHT >= 80 && c.appliedPctHT < 100;
                                const isSpeed = c.appliedPctHT >= 50 && c.appliedPctHT < 80;
                                const isAlert = c.appliedPctHT < 50;

                                // Màu nền dòng dựa trên mức độ hoàn thành
                                const rowBg = isPassed
                                    ? 'bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-950'
                                    : isNear
                                        ? 'bg-amber-50/70 hover:bg-amber-100/80 text-amber-950'
                                        : isSpeed
                                            ? 'bg-orange-50/50 hover:bg-orange-100/70 text-orange-950'
                                            : 'bg-rose-50/80 hover:bg-rose-100/90 text-rose-950';

                                return (
                                    <tr
                                        key={c.label + idx}
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
                                                    {c.label}
                                                </span>

                                                {c.isMonthCompleted ? (
                                                    <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.2 rounded shadow-2xs">
                                                        🏆 Đạt tháng
                                                    </span>
                                                ) : isPassed ? (
                                                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1 py-0.2 rounded">
                                                        ✓ Đạt ngày
                                                    </span>
                                                ) : isNear ? (
                                                    <span className="text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1 py-0.2 rounded">
                                                        ⚡ Cận đích
                                                    </span>
                                                ) : isAlert ? (
                                                    <span className="text-[9px] font-bold bg-rose-600 text-white px-1 py-0.2 rounded shadow-2xs">
                                                        🚨 Chậm
                                                    </span>
                                                ) : null}
                                            </div>
                                        </td>

                                        {/* Target Tháng */}
                                        <td className="p-2 text-center font-mono font-bold text-slate-700">
                                            {c.monthTarget > 0 ? formatValue(c.monthTarget) : '-'}
                                        </td>

                                        {/* Lũy kế đã đạt (A) kèm % HT Tháng */}
                                        <td className={`p-2 text-center font-mono ${sortMode === 'CUMULATIVE' ? 'bg-amber-100/40' : ''}`}>
                                            <div className="font-black text-slate-900">
                                                {c.cumulativeActual > 0 ? formatValue(c.cumulativeActual) : '-'}
                                            </div>
                                            {c.monthTarget > 0 ? (
                                                <div className={`text-[10px] font-black leading-tight mt-0.5 ${
                                                    c.monthPctHT >= 100
                                                        ? 'text-emerald-700 font-bold'
                                                        : c.monthPctHT >= 80
                                                            ? 'text-amber-700 font-bold'
                                                            : 'text-slate-500 font-bold'
                                                }`}>
                                                    ({c.monthPctHT.toFixed(0)}%)
                                                </div>
                                            ) : null}
                                        </td>

                                        {/* Còn thiếu tháng (B) */}
                                        <td className="p-2 text-center font-mono font-black text-rose-700">
                                            {c.remainingTarget > 0 ? formatValue(c.remainingTarget) : (
                                                <span className="text-emerald-700 font-bold">0</span>
                                            )}
                                        </td>

                                        {/* Trung bình ngày cần (C) */}
                                        <td className="p-2 text-center font-mono font-bold text-amber-800 border-r-2 border-slate-300">
                                            {c.requiredDailyAverage > 0 ? c.requiredDailyAverage : '0'}
                                        </td>

                                        {/* Target Ngày Áp Dụng */}
                                        <td className="p-2 text-center font-mono">
                                            <div className="font-black text-blue-800 text-xs">
                                                {formatValue(c.appliedDailyTarget)}
                                            </div>
                                        </td>

                                        {/* Thực hiện RT */}
                                        <td className="p-2 text-center font-mono font-black text-slate-900 text-xs">
                                            {formatValue(c.actual)}
                                        </td>

                                        {/* % HT Ngày */}
                                        <td className={`p-2 text-center font-mono ${sortMode === 'REALTIME' ? 'bg-blue-100/40' : ''}`}>
                                            <span
                                                className={`px-2 py-0.5 rounded-md text-[11px] font-black inline-block shadow-2xs ${isPassed
                                                    ? 'bg-emerald-600 text-white ring-1 ring-emerald-700/40'
                                                    : isNear
                                                        ? 'bg-amber-500 text-white ring-1 ring-amber-600/40'
                                                        : isSpeed
                                                            ? 'bg-orange-500 text-white ring-1 ring-orange-600/40'
                                                            : 'bg-rose-600 text-white ring-1 ring-rose-700/40'
                                                    }`}
                                            >
                                                {c.appliedPctHT.toFixed(0)}%
                                            </span>
                                        </td>

                                        {/* Thiếu ngày / Còn lại */}
                                        <td className="p-2 text-center font-mono font-black">
                                            {c.appliedShortage > 0 ? (
                                                <span className="text-rose-700 font-black">
                                                    {formatValue(c.appliedShortage)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 font-bold">0</span>
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
