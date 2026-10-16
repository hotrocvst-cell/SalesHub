import React, { useMemo } from 'react';
import type { EmployeeRankingRow, EmployeeRankingSummary } from '../types';
import { ArrowUpDown, ArrowUp, ArrowDown, Trophy, Target, Award } from 'lucide-react';
import { cleanEmployeeName, getShortenedEmployeeName } from '../../../core/lib/formatters';

export type SortField =
    | 'REVENUE_RANK'
    | 'EMULATION_RANK'
    | 'NAME'
    | 'REVENUE_QD'
    | 'TARGET'
    | 'FORECAST_RATE'
    | 'EMULATION_RATE';

interface Props {
    rows: EmployeeRankingRow[];
    summary: EmployeeRankingSummary;
    sortField: SortField;
    sortAsc: boolean;
    onSort: (field: SortField) => void;
    displayUnit: 'BILLION' | 'MILLION';
}

export default function EmployeeRankingTable({
    rows,
    summary,
    sortField,
    sortAsc,
    onSort,
    displayUnit
}: Props) {
    // Chiều rộng badge mã nhân viên tự động thích ứng theo mã dài nhất trong bảng để thẳng cột thẳng lề
    const maxIdLength = useMemo(() => {
        if (!rows || rows.length === 0) return 6;
        return Math.max(6, ...rows.map(r => String(r.employee_id || '').trim().length));
    }, [rows]);

    const formatMoney = (millionVal: number) => {
        if (displayUnit === 'BILLION') {
            return (millionVal / 1000).toFixed(3);
        }
        return Math.round(millionVal).toLocaleString('vi-VN');
    };

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 inline ml-1 opacity-60" />;
        }
        return sortAsc ? (
            <ArrowUp className="w-3 h-3 text-indigo-600 inline ml-1 font-bold" />
        ) : (
            <ArrowDown className="w-3 h-3 text-indigo-600 inline ml-1 font-bold" />
        );
    };

    return (
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs bg-white">
            <div className="overflow-x-auto no-scrollbar">
                <table
                    data-report-table="true"
                    className="w-full text-xs text-left border-collapse font-avo report-table"
                    style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
                >
                    <thead>
                        {/* Hàng 1: Khối nhóm Header chuyên nghiệp */}
                        <tr className="text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                            <th
                                rowSpan={2}
                                className="py-3 px-2 text-center bg-slate-800 text-white w-10 border-r border-slate-700"
                            >
                                STT
                            </th>
                            <th
                                rowSpan={2}
                                onClick={() => onSort('NAME')}
                                className="py-3 px-2.5 bg-slate-800 text-white border-r border-slate-700 min-w-[130px] sm:w-56 cursor-pointer hover:bg-slate-700 transition select-none group"
                            >
                                <div className="flex items-center justify-between">
                                    <span>NHÂN VIÊN</span>
                                    {renderSortIcon('NAME')}
                                </div>
                            </th>
                            <th
                                colSpan={4}
                                className="py-2 px-2 bg-blue-700 text-white text-center border-r border-blue-600"
                            >
                                HIỆU QUẢ DOANH THU
                            </th>
                            <th
                                colSpan={2}
                                className="py-2 px-2 bg-purple-700 text-white text-center"
                            >
                                HIỆU QUẢ THI ĐUA
                            </th>
                        </tr>

                        {/* Hàng 2: Chi tiết 6 cột con */}
                        <tr className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-tight border-b border-slate-200">
                            {/* DTQĐ */}
                            <th
                                onClick={() => onSort('REVENUE_QD')}
                                className="py-2 px-2 text-right bg-blue-50 text-blue-900 border-r border-blue-100 w-20 cursor-pointer hover:bg-blue-100 transition select-none group"
                            >
                                <span>DTQĐ</span>
                                {renderSortIcon('REVENUE_QD')}
                            </th>

                            {/* TARGET */}
                            <th
                                onClick={() => onSort('TARGET')}
                                className="py-2 px-2 text-right bg-blue-50 text-blue-900 border-r border-blue-100 w-20 cursor-pointer hover:bg-blue-100 transition select-none group"
                            >
                                <span>TARGET</span>
                                {renderSortIcon('TARGET')}
                            </th>

                            {/* %DKHT */}
                            <th
                                onClick={() => onSort('FORECAST_RATE')}
                                className="py-2 px-1 text-center bg-blue-50 text-blue-900 border-r border-blue-100 w-16 cursor-pointer hover:bg-blue-100 transition select-none group"
                            >
                                <span>%DKHT</span>
                                {renderSortIcon('FORECAST_RATE')}
                            </th>

                            {/* XẾP HẠNG DT */}
                            <th
                                onClick={() => onSort('REVENUE_RANK')}
                                className="py-2 px-2 text-center bg-blue-100/80 text-blue-950 font-black border-r border-blue-200 w-24 cursor-pointer hover:bg-blue-200 transition select-none group"
                                title="Thứ hạng và phân loại TOP / BOT theo Doanh thu"
                            >
                                <span>XẾP HẠNG DT</span>
                                {renderSortIcon('REVENUE_RANK')}
                            </th>

                            {/* DỰ KIẾN THI ĐUA */}
                            <th
                                onClick={() => onSort('EMULATION_RATE')}
                                className="py-2 px-2 text-center bg-purple-50 text-purple-900 border-r border-purple-100 w-28 cursor-pointer hover:bg-purple-100 transition select-none group"
                                title="Tiến độ dự kiến thi đua (theo điểm số hoặc số nhóm đạt, tùy cấu hình siêu thị)"
                            >
                                <span>DỰ KIẾN</span>
                                {renderSortIcon('EMULATION_RATE')}
                            </th>

                            {/* XẾP HẠNG THI ĐUA */}
                            <th
                                onClick={() => onSort('EMULATION_RANK')}
                                className="py-2 px-2 text-center bg-purple-100/80 text-purple-950 font-black w-24 cursor-pointer hover:bg-purple-200 transition select-none group"
                                title="Thứ hạng và phân loại TOP / BOT theo tiến độ Thi đua"
                            >
                                <span>XẾP HẠNG</span>
                                {renderSortIcon('EMULATION_RANK')}
                            </th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800 text-[11px] sm:text-xs">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-8 text-center text-slate-400 italic font-medium">
                                    Chưa có dữ liệu xếp hạng nhân sự trong kỳ báo cáo này.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => {
                                const isTopRevenue = row.revenue_top_bot_status === 'TOP';
                                const isBotRevenue = row.revenue_top_bot_status === 'BOT';
                                const isTopEmulation = row.emulation_top_bot_status === 'TOP';
                                const isBotEmulation = row.emulation_top_bot_status === 'BOT';

                                return (
                                    <tr
                                        key={row.employee_id}
                                        className={`hover:bg-indigo-50/20 transition group ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                                            }`}
                                    >
                                        {/* STT */}
                                        <td className="py-2 px-1.5 text-center border-r border-slate-100">
                                            <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-black text-[10px] inline-flex items-center justify-center shrink-0 shadow-2xs">
                                                {idx + 1}
                                            </span>
                                        </td>

                                        {/* TÊN NHÂN VIÊN */}
                                        <td className="py-2.5 px-3 border-r border-slate-100 whitespace-nowrap">
                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                <span
                                                    style={{ minWidth: `${maxIdLength + 2.2}ch`, width: `${maxIdLength + 2.2}ch` }}
                                                    className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                                                >
                                                    {row.employee_id}
                                                </span>
                                                <span
                                                    className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition"
                                                    title={`Mã NV: ${row.employee_id} - ${cleanEmployeeName(row.full_name)}${row.job_title ? ` (${row.job_title})` : ''}`}
                                                >
                                                    {getShortenedEmployeeName(row.full_name)}
                                                </span>
                                            </div>
                                        </td>

                                        {/* DTQĐ */}
                                        <td className="py-2 px-2 text-right font-black text-blue-700 border-r border-slate-100 font-mono">
                                            {formatMoney(row.revenue_qd)}
                                        </td>

                                        {/* TARGET */}
                                        <td className="py-2 px-2 text-right font-black text-slate-800 border-r border-slate-100 font-mono">
                                            {formatMoney(row.revenue_target)}
                                        </td>

                                        {/* %DKHT */}
                                        <td className={`py-2 px-1 text-center font-black border-r border-slate-100 font-mono ${row.forecast_completion_rate >= 100
                                            ? 'text-emerald-600'
                                            : row.forecast_completion_rate >= 90
                                                ? 'text-amber-600'
                                                : 'text-rose-600'
                                            }`}>
                                            {row.forecast_completion_rate.toFixed(1)}%
                                        </td>

                                        {/* XẾP HẠNG DT (TOP / BOT) */}
                                        <td className="py-2 px-2 text-center border-r border-slate-100">
                                            <div className="flex items-center justify-center">
                                                {isTopRevenue ? (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs whitespace-nowrap">
                                                        Top #{row.revenue_rank}
                                                    </span>
                                                ) : isBotRevenue ? (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs whitespace-nowrap">
                                                        Bot #{row.revenue_rank}
                                                    </span>
                                                ) : (
                                                    <span className="font-black text-[11px] text-slate-700 font-mono">
                                                        #{row.revenue_rank}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* DỰ KIẾN THI ĐUA (Theo điểm hoặc theo nhóm) */}
                                        <td className="py-2 px-2 text-center border-r border-slate-100">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <span className="font-black text-purple-950 text-xs font-mono">
                                                    {row.emulation_display}
                                                </span>
                                                <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-black ${row.emulation_rate >= 100
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : row.emulation_rate >= 80
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                    {row.emulation_rate.toFixed(0)}%
                                                </span>
                                            </div>
                                        </td>

                                        {/* XẾP HẠNG THI ĐUA (TOP / BOT) */}
                                        <td className="py-2 px-2 text-center">
                                            <div className="flex items-center justify-center">
                                                {isTopEmulation ? (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs whitespace-nowrap">
                                                        Top #{row.emulation_rank}
                                                    </span>
                                                ) : isBotEmulation ? (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs whitespace-nowrap">
                                                        Bot #{row.emulation_rank}
                                                    </span>
                                                ) : (
                                                    <span className="font-black text-[11px] text-purple-950 font-mono">
                                                        #{row.emulation_rank}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>

                    {/* DÒNG TỔNG CỘNG / TỔNG SHOP - EXECUTIVE DARK STYLE */}
                    {rows.length > 0 && (
                        <tfoot>
                            <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-700">
                                <td colSpan={2} className="py-3 px-3 text-center uppercase tracking-wider border-r border-slate-800 text-slate-200">
                                    TỔNG ({summary.totalEmployees} NV)
                                </td>

                                {/* DTQĐ */}
                                <td className="py-3 px-2 text-right font-black text-blue-300 border-r border-slate-800 font-mono">
                                    {formatMoney(summary.totalRevenueQd)}
                                </td>

                                {/* TARGET */}
                                <td className="py-3 px-2 text-right font-black text-amber-200 border-r border-slate-800 font-mono">
                                    {formatMoney(summary.totalRevenueTarget)}
                                </td>

                                {/* %DKHT TB */}
                                <td className="py-3 px-1 text-center font-black text-emerald-400 border-r border-slate-800 font-mono">
                                    {summary.avgForecastRate.toFixed(1)}%
                                </td>

                                {/* Phân loại DT */}
                                <td className="py-3 px-2 text-center text-slate-300 border-r border-slate-800 text-[10.5px]">
                                    <span className="text-emerald-400 font-bold">{summary.topRevenueCount} TOP</span>
                                    <span className="text-slate-500 mx-1">•</span>
                                    <span className="text-rose-400 font-bold">{summary.botRevenueCount} BOT</span>
                                </td>

                                {/* % THI ĐUA TB */}
                                <td className="py-3 px-2 text-center font-black text-purple-300 border-r border-slate-800 font-mono">
                                    {summary.avgEmulationRate.toFixed(1)}%<br />({summary.scoringModeLabel})
                                </td>

                                {/* Phân loại Thi đua */}
                                <td className="py-3 px-2 text-center text-slate-300 text-[10.5px]">
                                    <span className="text-purple-300 font-bold">{summary.topEmulationCount} TOP</span>
                                    <span className="text-slate-500 mx-1">•</span>
                                    <span className="text-rose-400 font-bold">{summary.botEmulationCount} BOT</span>
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}
