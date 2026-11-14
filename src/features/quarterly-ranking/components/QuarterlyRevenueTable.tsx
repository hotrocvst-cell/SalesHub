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

export default function QuarterlyRevenueTable({
    rows,
    months,
    sortField,
    sortAsc,
    onSort,
    showStoreColumn = true
}: Props) {
    // Chiều rộng badge mã nhân viên tự động thích ứng (Rule 11)
    const maxIdLength = useMemo(() => {
        if (!rows || rows.length === 0) return 6;
        return Math.max(6, ...rows.map(r => String(r.employee_id || '').trim().length));
    }, [rows]);

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 inline ml-1 opacity-70" aria-hidden="true" />;
        }
        return sortAsc ? (
            <ArrowUp className="w-3 h-3 text-blue-700 inline ml-1 font-bold" aria-hidden="true" />
        ) : (
            <ArrowDown className="w-3 h-3 text-blue-700 inline ml-1 font-bold" aria-hidden="true" />
        );
    };

    return (
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
            <div
                data-html2canvas-ignore="true"
                data-export-ignore="true"
                className="sm:hidden px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 flex items-center justify-between"
            >
                <span>Bảng xếp hạng Doanh thu Quý</span>
                <span className="text-blue-700">Vuốt ngang →</span>
            </div>

            <div className="overflow-x-auto no-scrollbar">
                <table
                    data-report-table="true"
                    className="w-full text-xs text-left border-collapse font-avo report-table"
                    style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
                >
                    <thead>
                        {/* HÀNG HEADER */}
                        <tr className="text-[10.5px] font-black uppercase tracking-wider border-b border-slate-200 bg-slate-50 text-slate-700">
                            <th
                                onClick={() => onSort('REVENUE_RANK')}
                                className="py-2.5 px-2 text-center w-12 cursor-pointer hover:bg-slate-100 select-none"
                            >
                                Hạng {renderSortIcon('REVENUE_RANK')}
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
                                onClick={() => onSort('REVENUE_QD')}
                                className="py-2.5 px-2 text-right cursor-pointer hover:bg-slate-100 select-none min-w-[90px]"
                            >
                                Tổng DTQĐ {renderSortIcon('REVENUE_QD')}
                            </th>
                            <th
                                onClick={() => onSort('TARGET')}
                                className="py-2.5 px-2 text-right cursor-pointer hover:bg-slate-100 select-none min-w-[85px]"
                            >
                                Target Quý {renderSortIcon('TARGET')}
                            </th>
                            <th
                                onClick={() => onSort('COMPLETION_RATE')}
                                className="py-2.5 px-2 text-center cursor-pointer hover:bg-slate-100 select-none min-w-[90px]"
                            >
                                %HT Quý {renderSortIcon('COMPLETION_RATE')}
                            </th>
                            <th
                                onClick={() => onSort('CONSISTENCY')}
                                className="py-2.5 px-2 text-center cursor-pointer hover:bg-slate-100 select-none min-w-[75px]"
                                title="Số tháng đạt target trong kỳ"
                            >
                                Phong độ {renderSortIcon('CONSISTENCY')}
                            </th>

                            {/* CÁC THÁNG CHI TIẾT */}
                            {months.map(m => (
                                <th key={m} className="py-2.5 px-2 text-center border-l border-slate-200/60 min-w-[70px]">
                                    T{m}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={(showStoreColumn ? 7 : 6) + months.length} className="text-center py-8 text-slate-400 font-bold">
                                    Không tìm thấy dữ liệu nhân viên trong kỳ đánh giá
                                </td>
                            </tr>
                        ) : (
                            rows.map(r => {
                                const isTop = r.top_bot_status === 'TOP';
                                const isBot = r.top_bot_status === 'BOT';

                                return (
                                    <tr
                                        key={r.employee_id}
                                        className={`hover:bg-blue-50/40 transition-colors ${
                                            r.revenue_rank === 1
                                                ? 'bg-amber-50/40 font-semibold'
                                                : r.revenue_rank === 2
                                                ? 'bg-slate-50/60'
                                                : r.revenue_rank === 3
                                                ? 'bg-amber-50/20'
                                                : ''
                                        }`}
                                    >
                                        {/* HẠNG */}
                                        <td className="py-2 px-2 text-center whitespace-nowrap">
                                            {r.revenue_rank === 1 ? (
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-black text-xs shadow-sm">
                                                    🥇
                                                </span>
                                            ) : r.revenue_rank === 2 ? (
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-800 font-black text-xs shadow-sm">
                                                    🥈
                                                </span>
                                            ) : r.revenue_rank === 3 ? (
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white font-black text-xs shadow-sm">
                                                    🥉
                                                </span>
                                            ) : (
                                                <span className={`inline-block font-mono font-bold text-xs ${isTop ? 'text-blue-700' : isBot ? 'text-rose-600' : 'text-slate-600'}`}>
                                                    #{r.revenue_rank}
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
                                                    className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
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

                                        {/* TỔNG DTQĐ */}
                                        <td className="py-2 px-2 text-right whitespace-nowrap font-mono font-black text-slate-900 text-xs">
                                            {Math.round(r.total_revenue_qd).toLocaleString('vi-VN')} <span className="text-[10px] text-slate-400 font-normal">tr</span>
                                        </td>

                                        {/* TARGET QUÝ */}
                                        <td className="py-2 px-2 text-right whitespace-nowrap font-mono font-bold text-slate-600 text-[11.5px]">
                                            {r.total_target_revenue > 0 ? (
                                                <>
                                                    {Math.round(r.total_target_revenue).toLocaleString('vi-VN')} <span className="text-[10px] text-slate-400 font-normal">tr</span>
                                                </>
                                            ) : (
                                                <span className="text-slate-400">---</span>
                                            )}
                                        </td>

                                        {/* %HT QUÝ KÈM THANH TIẾN ĐỘ */}
                                        <td className="py-2 px-2 text-center whitespace-nowrap">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[10.5px] font-black font-mono ${
                                                        r.completion_rate >= 100
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : r.completion_rate >= 80
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-rose-100 text-rose-800'
                                                    }`}
                                                >
                                                    {r.completion_rate}%
                                                </span>
                                                <div className="w-14 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${
                                                            r.completion_rate >= 100
                                                                ? 'bg-emerald-500'
                                                                : r.completion_rate >= 80
                                                                ? 'bg-blue-500'
                                                                : 'bg-rose-500'
                                                        }`}
                                                        style={{ width: `${Math.min(100, r.completion_rate)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>

                                        {/* PHONG ĐỘ (SỐ THÁNG ĐẠT TARGET) */}
                                        <td className="py-2 px-2 text-center whitespace-nowrap">
                                            <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-black font-mono ${
                                                    r.months_achieved_count === r.total_months_count
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : r.months_achieved_count > 0
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}
                                            >
                                                {r.consistency_label}
                                            </span>
                                        </td>

                                        {/* CHI TIẾT TỪNG THÁNG */}
                                        {r.month_details.map(m => (
                                            <td key={m.month} className="py-2 px-2 text-center whitespace-nowrap border-l border-slate-100">
                                                <div className="font-mono text-[11px] font-bold text-slate-800">
                                                    {m.revenueQd > 0 ? `${Math.round(m.revenueQd)}tr` : '0'}
                                                </div>
                                                <div className={`text-[9.5px] font-extrabold ${m.isAchieved ? 'text-emerald-700' : 'text-slate-400'}`}>
                                                    {m.completionRate > 0 ? `${m.completionRate}%` : '---'}
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
