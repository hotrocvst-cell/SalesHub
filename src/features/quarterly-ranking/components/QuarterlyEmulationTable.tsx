import React, { useMemo } from 'react';
import type { QuarterlyEmployeeRow, SortField } from '../types';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getShortStoreName, cleanEmployeeName } from '../../../core/lib/formatters';

interface Props {
    rows: QuarterlyEmployeeRow[];
    months: number[];
    sortField: SortField;
    sortAsc: boolean;
    onSort: (field: SortField) => void;
    showStoreColumn?: boolean;
}

export default function QuarterlyEmulationTable({
    rows,
    months,
    sortField,
    sortAsc,
    onSort,
    showStoreColumn = true
}: Props) {
    const maxIdLength = useMemo(() => {
        if (!rows || rows.length === 0) return 6;
        return Math.max(6, ...rows.map(r => String(r.employee_id || '').trim().length));
    }, [rows]);

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 inline ml-1 opacity-70" aria-hidden="true" />;
        }
        return sortAsc ? (
            <ArrowUp className="w-3 h-3 text-amber-700 inline ml-1 font-bold" aria-hidden="true" />
        ) : (
            <ArrowDown className="w-3 h-3 text-amber-700 inline ml-1 font-bold" aria-hidden="true" />
        );
    };

    return (
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
            <div
                data-html2canvas-ignore="true"
                data-export-ignore="true"
                className="sm:hidden px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 flex items-center justify-between"
            >
                <span>Bảng xếp hạng Thi đua Quý (Tổng Đã Đạt / Tổng Mục Tiêu)</span>
                <span className="text-amber-700">Vuốt ngang →</span>
            </div>

            <div className="overflow-x-auto no-scrollbar">
                <table
                    data-report-table="true"
                    className="w-full text-xs text-left border-collapse font-avo report-table"
                    style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
                >
                    <thead>
                        <tr className="text-[10.5px] font-black uppercase tracking-wider border-b border-slate-200 bg-slate-50 text-slate-700">
                            <th
                                onClick={() => onSort('EMULATION_RANK')}
                                className="py-2.5 px-2 text-center w-12 cursor-pointer hover:bg-slate-100 select-none"
                            >
                                Hạng {renderSortIcon('EMULATION_RANK')}
                            </th>
                            <th
                                onClick={() => onSort('NAME')}
                                className="py-2.5 px-2.5 text-left cursor-pointer hover:bg-slate-100 select-none min-w-[160px]"
                            >
                                Nhân viên {renderSortIcon('NAME')}
                            </th>
                            {showStoreColumn && (
                                <th
                                    onClick={() => onSort('STORE')}
                                    className="py-2.5 px-2 text-left cursor-pointer hover:bg-slate-100 select-none min-w-[100px]"
                                >
                                    ST {renderSortIcon('STORE')}
                                </th>
                            )}
                            <th
                                onClick={() => onSort('TARGET')}
                                className="py-2.5 px-2 text-center cursor-pointer hover:bg-slate-100 select-none min-w-[105px]"
                                title="Tổng mục tiêu đã đạt / Tổng mục tiêu giao trong toàn kỳ"
                            >
                                Tổng Đạt / Giao {renderSortIcon('TARGET')}
                            </th>
                            <th
                                onClick={() => onSort('COMPLETION_RATE')}
                                className="py-2.5 px-2 text-center cursor-pointer hover:bg-slate-100 select-none min-w-[90px]"
                            >
                                % Hoàn thành {renderSortIcon('COMPLETION_RATE')}
                            </th>
                            <th
                                onClick={() => onSort('CONSISTENCY')}
                                className="py-2.5 px-2 text-center cursor-pointer hover:bg-slate-100 select-none min-w-[85px]"
                                title="Phong độ: Số tháng đạt chuẩn thi đua (hoàn thành ≥ 60% mục tiêu giao) trong kỳ"
                            >
                                Phong độ (≥60%) {renderSortIcon('CONSISTENCY')}
                            </th>

                            {/* CÁC THÁNG CHI TIẾT (TỔNG ĐÃ ĐẠT / MỤC TIÊU TỪNG THÁNG) */}
                            {months.map(m => (
                                <th key={m} className="py-2.5 px-2 text-center border-l border-slate-200/60 min-w-[75px]">
                                    T{m}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={(showStoreColumn ? 6 : 5) + months.length} className="text-center py-8 text-slate-400 font-bold">
                                    Không tìm thấy dữ liệu thi đua trong kỳ đánh giá
                                </td>
                            </tr>
                        ) : (
                            rows.map(r => {
                                const isTop = r.emulation_top_bot_status === 'TOP';
                                const isBot = r.emulation_top_bot_status === 'BOT';

                                return (
                                    <tr
                                        key={r.employee_id}
                                        className={`hover:bg-amber-50/40 transition-colors ${
                                            r.emulation_rank === 1
                                                ? 'bg-amber-50/40 font-semibold'
                                                : r.emulation_rank === 2
                                                ? 'bg-slate-50/60'
                                                : r.emulation_rank === 3
                                                ? 'bg-amber-50/20'
                                                : ''
                                        }`}
                                    >
                                        {/* HẠNG */}
                                        <td className="py-2 px-2 text-center whitespace-nowrap">
                                            {r.emulation_rank === 1 ? (
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-black text-xs shadow-sm">
                                                    🥇
                                                </span>
                                            ) : r.emulation_rank === 2 ? (
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-800 font-black text-xs shadow-sm">
                                                    🥈
                                                </span>
                                            ) : r.emulation_rank === 3 ? (
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white font-black text-xs shadow-sm">
                                                    🥉
                                                </span>
                                            ) : (
                                                <span className={`inline-block font-mono font-bold text-xs ${isTop ? 'text-amber-700' : isBot ? 'text-rose-600' : 'text-slate-600'}`}>
                                                    #{r.emulation_rank}
                                                </span>
                                            )}
                                        </td>

                                        {/* NHÂN VIÊN GỘP 1 CỘT (RULE 11) */}
                                        <td className="py-2 px-2.5 whitespace-nowrap">
                                            <div
                                                className="flex items-center gap-1.5"
                                                title={`Mã NV: ${r.employee_id} - ${cleanEmployeeName(r.full_name)}`}
                                            >
                                                <span
                                                    className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 inline-block text-center leading-normal shrink-0"
                                                    style={{ minWidth: `${maxIdLength + 2.2}ch`, width: `${maxIdLength + 2.2}ch` }}
                                                >
                                                    {r.employee_id}
                                                </span>
                                                <span className="font-bold text-slate-800 text-xs truncate max-w-[120px] sm:max-w-[150px]">
                                                    {r.short_name}
                                                </span>
                                            </div>
                                        </td>

                                        {/* ST (ẨN NẾU ĐÃ CHỌN 1 ST CỤ THỂ) */}
                                        {showStoreColumn && (
                                            <td className="py-2 px-2 whitespace-nowrap text-slate-600 font-semibold text-[11px]">
                                                {getShortStoreName(r.store_name)}
                                            </td>
                                        )}

                                        {/* TỔNG ĐÃ ĐẠT / TỔNG MỤC TIÊU QUÝ */}
                                        <td className="py-2 px-2 text-center whitespace-nowrap font-mono font-bold text-slate-700 text-xs">
                                            <span className="text-emerald-700 font-extrabold text-xs">
                                                {r.total_emulation_achieved}
                                            </span>
                                            <span className="text-slate-400 font-normal"> / </span>
                                            <span className="text-slate-800 font-bold">
                                                {r.total_emulation_target}
                                            </span>
                                        </td>

                                        {/* % HOÀN THÀNH */}
                                        <td className="py-2 px-2 text-center whitespace-nowrap">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[10.5px] font-black font-mono ${
                                                        r.emulation_rate >= 100
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : r.emulation_rate >= 70
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-rose-100 text-rose-800'
                                                    }`}
                                                >
                                                    {r.emulation_rate}%
                                                </span>
                                                <div className="w-14 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${
                                                            r.emulation_rate >= 100
                                                                ? 'bg-emerald-500'
                                                                : r.emulation_rate >= 70
                                                                ? 'bg-amber-500'
                                                                : 'bg-rose-500'
                                                        }`}
                                                        style={{ width: `${Math.min(100, r.emulation_rate)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>

                                        {/* PHONG ĐỘ THI ĐUA (CHUẨN >= 60%) */}
                                        <td className="py-2 px-2 text-center whitespace-nowrap">
                                            <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-black font-mono ${
                                                    r.emulation_months_achieved_count === r.total_months_count
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : r.emulation_months_achieved_count > 0
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}
                                                title={`Đạt chuẩn ≥60% ở ${r.emulation_months_achieved_count}/${r.total_months_count} tháng`}
                                            >
                                                {r.emulation_consistency_label}
                                            </span>
                                        </td>

                                        {/* CHI TIẾT TỪNG THÁNG: ĐÃ ĐẠT / MỤC TIÊU VÀ %HT */}
                                        {r.emulation_month_details.map(m => (
                                            <td key={m.month} className="py-2 px-2 text-center whitespace-nowrap border-l border-slate-100">
                                                <div className="font-mono text-[11px] font-bold text-slate-800">
                                                    <span className={m.isAchieved ? 'text-emerald-700 font-extrabold' : 'text-slate-800'}>
                                                        {m.achievedCount}
                                                    </span>
                                                    {m.targetCount > 0 && (
                                                        <span className="text-slate-400 font-normal text-[10px]">/{m.targetCount}</span>
                                                    )}
                                                </div>
                                                <div
                                                    className={`text-[9.5px] font-extrabold ${
                                                        m.isAchieved ? 'text-emerald-700' : m.completionRate > 0 ? 'text-amber-700' : 'text-slate-400'
                                                    }`}
                                                    title={`T${m.month}: Đạt ${m.achievedCount}/${m.targetCount} (${m.completionRate}%) ${m.isAchieved ? '✓ Đạt chuẩn ≥60%' : 'Chưa đạt chuẩn ≥60%'}`}
                                                >
                                                    {m.targetCount > 0 ? `${m.completionRate}%` : '---'}
                                                </div>
                                            </td>
                                        ))}
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
