import { useMemo } from 'react';
import type { EmployeePerformanceRow } from '../types';
import { cleanEmployeeName, getShortenedEmployeeName } from '../utils/performanceConfig';

interface Props {
    rows: EmployeePerformanceRow[];
    showStoreName?: boolean;
    onSelectEmployee?: (emp: EmployeePerformanceRow) => void;
    showWorkHours?: boolean;
}

export default function PerformanceTable({
    rows,
    showStoreName = false,
    onSelectEmployee,
    showWorkHours = false
}: Props) {
    // Chiều rộng badge mã nhân viên tự động thích ứng theo mã dài nhất trong bảng để thẳng cột thẳng lề
    const maxIdLength = useMemo(() => {
        if (!rows || rows.length === 0) return 6;
        return Math.max(6, ...rows.map(r => String(r.employee_id || '').trim().length));
    }, [rows]);

    const totals = useMemo(() => {
        const count = rows.length;
        const actual = rows.reduce((s, r) => s + (r.revenue_actual || 0), 0);
        const qd = rows.reduce((s, r) => s + (r.revenue_qd || 0), 0);
        const target = rows.reduce((s, r) => s + (r.revenue_target || 0), 0);
        const hours = rows.reduce((s, r) => s + (r.work_hours || 0), 0);
        const instRev = rows.reduce((s, r) => s + (r.installment_revenue || 0), 0);
        const topCount = rows.filter(r => r.top_bot_status === 'TOP').length;
        const botCount = rows.filter(r => r.top_bot_status === 'BOT').length;

        const completion = target > 0 ? Number(((qd / target) * 100).toFixed(1)) : 0;
        const forecast = count > 0
            ? Number((rows.reduce((s, r) => s + (r.forecast_completion_rate || 0), 0) / count).toFixed(1))
            : 0;
        const exchange = actual > 0 ? Number((((qd - actual) / actual) * 100).toFixed(1)) : 0;
        const prodQd = hours > 0 ? Number((qd / hours).toFixed(2)) : 0;
        const instRate = actual > 0 ? Number(((instRev / actual) * 100).toFixed(1)) : 0;

        return {
            actual: Math.round(actual),
            qd: Math.round(qd),
            target: Math.round(target),
            hours: Number(hours.toFixed(1)),
            completion,
            forecast,
            exchange,
            prodQd,
            instRate,
            topCount,
            botCount
        };
    }, [rows]);

    const getShortStoreTag = (storeName: string) => {
        if (!storeName) return '';
        const head = storeName.split(' - ')[0]?.trim() || storeName.trim();
        return head.length > 14 ? `${head.slice(0, 12)}…` : head;
    };

    if (rows.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2 shadow-sm">
                <p className="font-bold text-sm text-slate-700">Không tìm thấy dữ liệu nhân viên nào theo điều kiện lọc.</p>
                <p className="text-xs text-slate-600">Vui lòng kiểm tra lại ST, tháng báo cáo hoặc từ khóa tìm kiếm.</p>
            </div>
        );
    }

    const getRankBadge = (rank: number) => {
        if (rank === 1) return <span className="inline-block w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-mono font-bold text-xs text-center leading-6 border border-amber-500 select-none">1</span>;
        if (rank === 2) return <span className="inline-block w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-mono font-bold text-xs text-center leading-6 border border-slate-300 select-none">2</span>;
        if (rank === 3) return <span className="inline-block w-6 h-6 rounded-full bg-amber-700/20 text-amber-950 font-mono font-bold text-xs text-center leading-6 border border-amber-600/40 select-none">3</span>;
        return <span className="font-mono text-slate-600 font-bold text-xs tabular-nums">#{rank}</span>;
    };

    const getTopBotBadge = (status: EmployeePerformanceRow['top_bot_status'], label: string) => {
        if (status === 'TOP') {
            return (
                <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-300 text-center whitespace-nowrap">
                    🏆 {label}
                </span>
            );
        }
        if (status === 'BOT') {
            return (
                <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300 text-center whitespace-nowrap">
                    ⚠️ {label}
                </span>
            );
        }
        return (
            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 text-center whitespace-nowrap">
                ⭐️ Ổn định
            </span>
        );
    };

    const getForecastBadge = (pct: number) => {
        let style = 'bg-rose-100 text-rose-900 border-rose-300';
        if (pct >= 100) style = 'bg-emerald-100 text-emerald-900 border-emerald-300';
        else if (pct >= 80) style = 'bg-blue-100 text-blue-900 border-blue-300';
        else if (pct >= 50) style = 'bg-amber-100 text-amber-950 border-amber-300';

        return (
            <span className={`inline-block px-2 py-0.5 rounded-md font-mono font-bold text-xs tabular-nums border text-center whitespace-nowrap leading-normal ${style}`}>
                {pct}%
            </span>
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden font-avo">
            {/* Gợi ý vuốt ngang trên Mobile (tự ẩn khi xuất ảnh) */}
            <div
                data-html2canvas-ignore="true"
                data-export-ignore="true"
                className="sm:hidden flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 font-sans"
            >
                <span>Bảng chi tiết hiệu quả ({rows.length} NV)</span>
                <span className="text-blue-700 font-bold">Vuốt ngang →</span>
            </div>

            <div className="overflow-x-auto max-h-[750px] overflow-y-auto">
                <table className={`w-full text-left text-xs border-collapse font-avo report-table ${showWorkHours ? 'min-w-[980px]' : 'min-w-[820px]'}`}>
                    {/* Header chuẩn 1 dòng duy nhất, tối ưu viết tắt & độ rộng gọn gàng */}
                    <thead className="bg-slate-900 text-white font-extrabold uppercase tracking-normal text-[11px] sticky top-0 z-20 shadow-sm whitespace-nowrap">
                        <tr>
                            {/* 1. Hạng */}
                            <th className="py-2.5 px-2 text-center align-middle w-11 min-w-[44px] border-r border-slate-800 bg-slate-900">Hạng</th>

                            {/* 2. Nhân viên (Mã + Tên rút gọn, giữ cố định bên trái khi vuốt ngang trên mobile) */}
                            <th className="py-2.5 px-2 text-left align-middle min-w-[144px] max-w-[168px] md:max-w-none border-r border-slate-800 sticky left-0 z-30 md:static bg-slate-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.25)] md:shadow-none">Nhân viên</th>

                            {/* 3. DT Thực */}
                            <th className="py-2.5 px-1.5 text-right align-middle border-r border-slate-800">DT Thực</th>

                            {/* 4. DTQĐ */}
                            <th className="py-2.5 px-1.5 text-center align-middle bg-blue-950/90 text-blue-200 border-r border-blue-900">DTQĐ</th>

                            {/* 5. Target */}
                            <th className="py-2.5 px-1.5 text-right align-middle border-r border-slate-800">Target</th>

                            {/* 6. %HT Real */}
                            <th className="py-2.5 px-1.5 text-center align-middle border-r border-slate-800">%HT Real</th>

                            {/* 7. %DKHT */}
                            <th className="py-2.5 px-1.5 text-center align-middle bg-amber-950/80 text-amber-200 border-r border-amber-900">%DKHT</th>

                            {/* 8. %QĐ */}
                            <th className="py-2.5 px-1.5 text-center align-middle border-r border-slate-800" title="Tỷ lệ quy đổi: ((DTQĐ - DT Thực) / DT Thực) * 100">%QĐ</th>

                            {/* 9. Giờ công - Ẩn/hiện theo toggle */}
                            {showWorkHours && (
                                <th className="py-2.5 px-1.5 text-right align-middle border-r border-slate-800">Giờ công</th>
                            )}

                            {/* 10. DTQĐ/GC - Ẩn/hiện theo toggle */}
                            {showWorkHours && (
                                <th className="py-2.5 px-1.5 text-center align-middle bg-teal-950/90 text-teal-200 border-r border-teal-900" title="Năng suất lao động: Lũy kế DTQĐ / Giờ công">DTQĐ/GC</th>
                            )}

                            {/* 11. % Trả chậm */}
                            <th className="py-2.5 px-1.5 text-center align-middle border-r border-slate-800" title="Tỷ lệ doanh thu trả chậm: DT Trả chậm / DT Thực">% Trả chậm</th>

                            {/* 12. Đánh giá TOP/BOT */}
                            <th className="py-2.5 px-2 text-center align-middle">Đánh giá</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 font-medium">
                        {rows.map(row => {
                            const isExceed = row.completion_rate >= 100;
                            const isLowExchange = row.exchange_rate < 35;
                            const isLowInstallment = row.installment_rate < 35;

                            return (
                                <tr
                                    key={row.employee_id}
                                    tabIndex={onSelectEmployee ? 0 : undefined}
                                    role={onSelectEmployee ? 'button' : undefined}
                                    className="bg-white hover:bg-slate-50 focus-visible:outline-none focus-visible:bg-blue-50 transition cursor-pointer group whitespace-nowrap"
                                    onClick={() => onSelectEmployee?.(row)}
                                    onKeyDown={(e) => {
                                        if (onSelectEmployee && (e.key === 'Enter' || e.key === ' ')) {
                                            e.preventDefault();
                                            onSelectEmployee(row);
                                        }
                                    }}
                                    title={`Nhấp để xem báo cáo chi tiết nhân viên: ${row.employee_id} - ${cleanEmployeeName(row.full_name)}`}
                                >
                                    {/* 1. Hạng */}
                                    <td className="py-2 px-2 w-11 min-w-[44px] text-center align-middle border-r border-slate-100 whitespace-nowrap bg-inherit">
                                        {getRankBadge(row.rank)}
                                    </td>

                                    {/* 2. Mã NV + Tên NV (Mã NV badge cố định chiều rộng + Tên rút gọn, ghim bên trái khi vuốt ngang trên mobile) */}
                                    <td className="py-2 px-2 text-left align-middle border-r border-slate-100 whitespace-nowrap sticky left-0 z-10 md:static bg-inherit shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)] md:shadow-none">
                                        <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-1.5 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                <span
                                                    style={{ minWidth: `${maxIdLength + 1.8}ch`, width: `${maxIdLength + 1.8}ch` }}
                                                    className="font-mono font-bold text-[11px] px-1 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                                                >
                                                    {row.employee_id}
                                                </span>
                                                <span
                                                    className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition"
                                                    title={`Mã NV: ${row.employee_id} - ${cleanEmployeeName(row.full_name)}`}
                                                >
                                                    {getShortenedEmployeeName(row.full_name)}
                                                </span>
                                            </div>
                                            {showStoreName && row.store_name && (
                                                <span
                                                    className="text-[9.5px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded w-fit shrink-0"
                                                    title={row.store_name}
                                                >
                                                    {getShortStoreTag(row.store_name)}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* 3. DT Thực (triệu) */}
                                    <td className="py-2 px-1.5 text-right align-middle font-mono tabular-nums font-bold text-xs text-slate-800 border-r border-slate-100 whitespace-nowrap">
                                        {row.revenue_actual > 0 ? row.revenue_actual.toLocaleString('vi-VN') : '0'}
                                    </td>

                                    {/* 4. DTQĐ (triệu) */}
                                    <td className="py-2 px-1.5 text-center align-middle font-mono tabular-nums border-r border-slate-100 bg-blue-50/20 whitespace-nowrap">
                                        <span className="inline-block px-2 py-0.5 rounded-md bg-blue-100 text-blue-950 font-mono font-bold text-xs text-center border border-blue-200 leading-normal">
                                            {row.revenue_qd > 0 ? row.revenue_qd.toLocaleString('vi-VN') : '0'}
                                        </span>
                                    </td>

                                    {/* 5. Target (triệu) */}
                                    <td className="py-2 px-1.5 text-right align-middle font-mono tabular-nums font-bold text-xs text-slate-700 border-r border-slate-100 whitespace-nowrap">
                                        {row.revenue_target > 0 ? row.revenue_target.toLocaleString('vi-VN') : '—'}
                                    </td>

                                    {/* 6. %HT Real */}
                                    <td className="py-2 px-1.5 text-center align-middle font-mono tabular-nums border-r border-slate-100 whitespace-nowrap">
                                        <span className={`font-mono font-bold text-xs leading-normal ${isExceed ? 'text-emerald-700 font-extrabold' : 'text-slate-800'}`}>
                                            {row.completion_rate}%
                                        </span>
                                    </td>

                                    {/* 7. %DKHT */}
                                    <td className="py-2 px-1.5 text-center align-middle border-r border-slate-100 bg-amber-50/20 whitespace-nowrap">
                                        {getForecastBadge(row.forecast_completion_rate)}
                                    </td>

                                    {/* 8. %QĐ (TÔ ĐỎ NẾU DƯỚI 35%) */}
                                    <td className={`py-2 px-1.5 text-center align-middle font-mono tabular-nums border-r border-slate-100 whitespace-nowrap ${
                                        isLowExchange ? 'bg-rose-50/60' : ''
                                    }`}>
                                        <span className={`inline-block px-2 py-0.5 rounded-md font-mono font-bold text-xs text-center border whitespace-nowrap leading-normal ${
                                            isLowExchange
                                                ? 'text-rose-900 bg-rose-100 border-rose-300'
                                                : 'text-emerald-900 bg-emerald-50 border-emerald-300'
                                        }`}>
                                            {row.exchange_rate > 0 ? `+${row.exchange_rate}%` : `${row.exchange_rate}%`}
                                        </span>
                                    </td>

                                    {/* 9. Giờ công - Ẩn/hiện theo toggle */}
                                    {showWorkHours && (
                                        <td className="py-2 px-1.5 text-right align-middle font-mono tabular-nums font-bold text-xs text-slate-700 border-r border-slate-100 whitespace-nowrap">
                                            {row.work_hours > 0 ? `${row.work_hours.toLocaleString('vi-VN')}h` : '—'}
                                        </td>
                                    )}

                                    {/* 10. DTQĐ/GC - Ẩn/hiện theo toggle */}
                                    {showWorkHours && (
                                        <td className="py-2 px-1.5 text-center align-middle font-mono tabular-nums border-r border-slate-100 bg-teal-50/25 whitespace-nowrap">
                                            <span className="inline-block px-2 py-0.5 rounded-md bg-teal-100 text-teal-950 font-mono font-bold text-xs text-center border border-teal-200 leading-normal">
                                                {row.productivity_qd_per_hour > 0
                                                    ? `${row.productivity_qd_per_hour.toFixed(2)}`
                                                    : '—'}
                                            </span>
                                        </td>
                                    )}

                                    {/* 11. % Trả chậm (HIGHLIGHT ĐỎ NẾU DƯỚI 35%) */}
                                    <td className={`py-2 px-1.5 text-center align-middle font-mono tabular-nums border-r border-slate-100 whitespace-nowrap ${
                                        isLowInstallment ? 'bg-rose-50/60' : ''
                                    }`}>
                                        {isLowInstallment ? (
                                            <span className="inline-block px-2 py-0.5 rounded-md font-mono font-bold text-xs text-rose-900 bg-rose-100 border border-rose-300 text-center whitespace-nowrap leading-normal">
                                                {row.installment_rate}%
                                            </span>
                                        ) : (
                                            <span className="font-mono font-bold text-xs text-slate-800 leading-normal">
                                                {row.installment_rate}%
                                            </span>
                                        )}
                                    </td>

                                    {/* 12. Đánh giá TOP/BOT */}
                                    <td className="py-2 px-2 text-center align-middle whitespace-nowrap">
                                        <div className="flex justify-center whitespace-nowrap">
                                            {getTopBotBadge(row.top_bot_status, row.top_bot_label)}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>

                    {/* Tổng hợp đáy bảng */}
                    <tfoot className="bg-slate-900 text-white font-bold text-xs whitespace-nowrap">
                        <tr>
                            <td className="py-2.5 px-2 text-center align-middle border-r border-slate-800 bg-slate-900" aria-hidden="true">
                                Σ
                            </td>
                            <td className="py-2.5 px-2 text-left align-middle border-r border-slate-800 sticky left-0 z-20 md:static bg-slate-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.25)] md:shadow-none">
                                TỔNG / TB ({rows.length} NV)
                            </td>
                            <td className="py-2.5 px-1.5 text-right align-middle font-mono tabular-nums text-slate-100 border-r border-slate-800">
                                {totals.actual.toLocaleString('vi-VN')}
                            </td>
                            <td className="py-2.5 px-1.5 text-center align-middle font-mono tabular-nums text-blue-300 border-r border-slate-800">
                                {totals.qd.toLocaleString('vi-VN')}
                            </td>
                            <td className="py-2.5 px-1.5 text-right align-middle font-mono tabular-nums text-slate-200 border-r border-slate-800">
                                {totals.target.toLocaleString('vi-VN')}
                            </td>
                            <td className="py-2.5 px-1.5 text-center align-middle font-mono tabular-nums text-emerald-300 border-r border-slate-800">
                                {totals.completion}%
                            </td>
                            <td className="py-2.5 px-1.5 text-center align-middle font-mono tabular-nums text-amber-300 border-r border-slate-800">
                                {totals.forecast}%
                            </td>
                            <td className="py-2.5 px-1.5 text-center align-middle font-mono tabular-nums text-slate-200 border-r border-slate-800">
                                {totals.exchange > 0 ? `+${totals.exchange}%` : `${totals.exchange}%`}
                            </td>
                            {showWorkHours && (
                                <td className="py-2.5 px-1.5 text-right align-middle font-mono tabular-nums text-slate-200 border-r border-slate-800">
                                    {totals.hours > 0 ? `${totals.hours.toLocaleString('vi-VN')}h` : '—'}
                                </td>
                            )}
                            {showWorkHours && (
                                <td className="py-2.5 px-1.5 text-center align-middle font-mono tabular-nums text-teal-300 border-r border-slate-800">
                                    {totals.prodQd > 0 ? totals.prodQd.toFixed(2) : '—'}
                                </td>
                            )}
                            <td className="py-2.5 px-1.5 text-center align-middle font-mono tabular-nums text-slate-200 border-r border-slate-800">
                                {totals.instRate}%
                            </td>
                            <td className="py-2.5 px-2 text-center align-middle font-mono text-[11px]">
                                <span className="text-amber-300 font-extrabold">{totals.topCount} TOP</span>
                                <span className="text-slate-400 mx-1">•</span>
                                <span className="text-rose-300 font-extrabold">{totals.botCount} BOT</span>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
