import type { EmployeePerformanceRow } from '../types';
import { cleanEmployeeName } from '../utils/performanceConfig';

interface Props {
    rows: EmployeePerformanceRow[];
    showStoreName?: boolean;
    onSelectEmployee?: (emp: EmployeePerformanceRow) => void;
}

export default function PerformanceTable({
    rows,
    onSelectEmployee
}: Props) {
    if (rows.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
                <p className="font-bold text-sm text-slate-600">Không tìm thấy dữ liệu nhân viên nào theo điều kiện lọc.</p>
                <p className="text-xs text-slate-400">Vui lòng kiểm tra lại siêu thị, tháng báo cáo hoặc từ khóa tìm kiếm.</p>
            </div>
        );
    }

    const getRankBadge = (rank: number) => {
        if (rank === 1) return <span className="inline-block w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-mono font-bold text-xs text-center leading-6 border border-amber-500 shadow-2xs select-none">1</span>;
        if (rank === 2) return <span className="inline-block w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-mono font-bold text-xs text-center leading-6 border border-slate-300 shadow-2xs select-none">2</span>;
        if (rank === 3) return <span className="inline-block w-6 h-6 rounded-full bg-amber-700/20 text-amber-900 font-mono font-bold text-xs text-center leading-6 border border-amber-600/40 shadow-2xs select-none">3</span>;
        return <span className="font-mono text-slate-500 font-bold text-xs">#{rank}</span>;
    };

    const getTopBotBadge = (status: EmployeePerformanceRow['top_bot_status'], label: string) => {
        if (status === 'TOP') {
            return (
                <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300 text-center whitespace-nowrap shadow-2xs">
                    🏆 {label}
                </span>
            );
        }
        if (status === 'BOT') {
            return (
                <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300 text-center whitespace-nowrap shadow-2xs">
                    ⚠️ {label}
                </span>
            );
        }
        return (
            <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 text-center whitespace-nowrap">
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
            <span className={`inline-block px-2.5 py-0.5 rounded-md font-mono font-bold text-xs border text-center whitespace-nowrap shadow-2xs leading-normal ${style}`}>
                {pct}%
            </span>
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden font-avo">
            <div className="overflow-x-auto max-h-[750px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-avo report-table min-w-[1380px]">
                    {/* Header chuẩn 1 dòng duy nhất, không thông tin diễn giải, tối ưu viết tắt */}
                    <thead className="bg-slate-900 text-white font-extrabold uppercase tracking-normal text-[11px] sticky top-0 z-20 shadow-xs whitespace-nowrap">
                        <tr>
                            {/* 1. Hạng */}
                            <th className="py-3 px-3 text-center align-middle w-12 border-r border-slate-800">Hạng</th>

                            {/* 2. Nhân viên (Mã + Tên rút gọn) */}
                            <th className="py-3 px-3 text-left align-middle min-w-[180px] border-r border-slate-800">Nhân viên</th>

                            {/* 3. DT Thực */}
                            <th className="py-3 px-3 text-right align-middle min-w-[95px] border-r border-slate-800">DT Thực</th>

                            {/* 4. DTQĐ */}
                            <th className="py-3 px-3 text-center align-middle min-w-[100px] bg-blue-950/90 text-blue-200 border-r border-blue-900">DTQĐ</th>

                            {/* 5. Target */}
                            <th className="py-3 px-3 text-right align-middle min-w-[90px] border-r border-slate-800">Target</th>

                            {/* 6. %HT Real */}
                            <th className="py-3 px-3 text-center align-middle min-w-[95px] border-r border-slate-800">%HT Real</th>

                            {/* 7. %DKHT */}
                            <th className="py-3 px-3 text-center align-middle min-w-[100px] bg-amber-950/80 text-amber-200 border-r border-amber-900">%DKHT</th>

                            {/* 8. %QĐ */}
                            <th className="py-3 px-3 text-center align-middle min-w-[85px] border-r border-slate-800" title="Tỷ lệ quy đổi: ((DTQĐ - DT Thực) / DT Thực) * 100">%QĐ</th>

                            {/* 9. Giờ công */}
                            <th className="py-3 px-3 text-right align-middle min-w-[85px] border-r border-slate-800">Giờ công</th>

                            {/* 10. DTQĐ/GC */}
                            <th className="py-3 px-3 text-center align-middle min-w-[95px] bg-purple-950/80 text-purple-200 border-r border-purple-900" title="Năng suất lao động: Lũy kế DTQĐ / Giờ công">DTQĐ/GC</th>

                            {/* 11. % Trả chậm */}
                            <th className="py-3 px-3 text-center align-middle min-w-[100px] border-r border-slate-800" title="Tỷ lệ doanh thu trả chậm: DT Trả chậm / DT Thực">% Trả chậm</th>

                            {/* 12. Đánh giá TOP/BOT */}
                            <th className="py-3 px-3 text-center align-middle min-w-[120px]">Đánh giá</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 font-medium">
                        {rows.map(row => {
                            const isExceed = row.completion_rate >= 100;
                            const isLowExchange = row.exchange_rate < 35; // Tô đỏ nếu %QĐ dưới 35%
                            const isLowInstallment = row.installment_rate < 35; // Highlight đỏ nếu dưới 35%

                            return (
                                <tr
                                    key={row.employee_id}
                                    className="hover:bg-slate-50/80 transition cursor-pointer group whitespace-nowrap"
                                    onClick={() => onSelectEmployee?.(row)}
                                >
                                    {/* 1. Hạng */}
                                    <td className="py-2.5 px-3 text-center align-middle border-r border-slate-100 whitespace-nowrap">
                                        {getRankBadge(row.rank)}
                                    </td>

                                    {/* 2. Mã NV + Tên NV (1 dòng duy nhất đồng nhất, không kèm bộ phận) */}
                                    <td className="py-2.5 px-3 text-left align-middle border-r border-slate-100 whitespace-nowrap">
                                        <div className="flex items-center gap-2 whitespace-nowrap">
                                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal">
                                                {row.employee_id}
                                            </span>
                                            <span
                                                className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition"
                                                title={`Mã NV: ${row.employee_id} - ${cleanEmployeeName(row.full_name)}`}
                                            >
                                                {cleanEmployeeName(row.full_name)}
                                            </span>
                                        </div>
                                    </td>

                                    {/* 3. DT Thực (triệu) */}
                                    <td className="py-2.5 px-3 text-right align-middle font-mono font-bold text-xs text-slate-800 border-r border-slate-100 whitespace-nowrap">
                                        {row.revenue_actual > 0 ? row.revenue_actual.toLocaleString('vi-VN') : '0'}
                                    </td>

                                    {/* 4. DTQĐ (triệu) */}
                                    <td className="py-2.5 px-3 text-center align-middle font-mono border-r border-slate-100 bg-blue-50/20 whitespace-nowrap">
                                        <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-950 font-mono font-bold text-xs text-center border border-blue-200/80 shadow-2xs leading-normal">
                                            {row.revenue_qd > 0 ? row.revenue_qd.toLocaleString('vi-VN') : '0'}
                                        </span>
                                    </td>

                                    {/* 5. Target (triệu) */}
                                    <td className="py-2.5 px-3 text-right align-middle font-mono font-bold text-xs text-slate-600 border-r border-slate-100 whitespace-nowrap">
                                        {row.revenue_target > 0 ? row.revenue_target.toLocaleString('vi-VN') : '—'}
                                    </td>

                                    {/* 6. %HT Real (1 dòng số liệu duy nhất, loại bỏ thanh tiến trình) */}
                                    <td className="py-2.5 px-3 text-center align-middle font-mono border-r border-slate-100 whitespace-nowrap">
                                        <span className={`font-mono font-bold text-xs leading-normal ${isExceed ? 'text-emerald-700 font-extrabold' : 'text-slate-800'}`}>
                                            {row.completion_rate}%
                                        </span>
                                    </td>

                                    {/* 7. %DKHT */}
                                    <td className="py-2.5 px-3 text-center align-middle border-r border-slate-100 bg-amber-50/20 whitespace-nowrap">
                                        {getForecastBadge(row.forecast_completion_rate)}
                                    </td>

                                    {/* 8. %QĐ (TÔ ĐỎ NẾU DƯỚI 35%) */}
                                    <td className={`py-2.5 px-3 text-center align-middle font-mono border-r border-slate-100 whitespace-nowrap ${
                                        isLowExchange ? 'bg-rose-50/60' : ''
                                    }`}>
                                        <span className={`inline-block px-2.5 py-0.5 rounded-md font-mono font-bold text-xs text-center border whitespace-nowrap shadow-2xs leading-normal ${
                                            isLowExchange
                                                ? 'text-rose-900 bg-rose-100 border-rose-300'
                                                : 'text-emerald-900 bg-emerald-50 border-emerald-300'
                                        }`}>
                                            {row.exchange_rate > 0 ? `+${row.exchange_rate}%` : `${row.exchange_rate}%`}
                                        </span>
                                    </td>

                                    {/* 9. Giờ công */}
                                    <td className="py-2.5 px-3 text-right align-middle font-mono font-bold text-xs text-slate-700 border-r border-slate-100 whitespace-nowrap">
                                        {row.work_hours > 0 ? `${row.work_hours.toLocaleString('vi-VN')}h` : '—'}
                                    </td>

                                    {/* 10. DTQĐ/GC */}
                                    <td className="py-2.5 px-3 text-center align-middle font-mono border-r border-slate-100 bg-purple-50/20 whitespace-nowrap">
                                        <span className="inline-block px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-950 font-mono font-bold text-xs text-center border border-purple-200/80 shadow-2xs leading-normal">
                                            {row.productivity_qd_per_hour > 0
                                                ? `${row.productivity_qd_per_hour.toFixed(2)}`
                                                : '—'}
                                        </span>
                                    </td>

                                    {/* 11. % Trả chậm (HIGHLIGHT ĐỎ NẾU DƯỚI 35%) */}
                                    <td className={`py-2.5 px-3 text-center align-middle font-mono border-r border-slate-100 whitespace-nowrap ${
                                        isLowInstallment ? 'bg-rose-50/60' : ''
                                    }`}>
                                        {isLowInstallment ? (
                                            <span className="inline-block px-2.5 py-0.5 rounded-md font-mono font-bold text-xs text-rose-900 bg-rose-100 border border-rose-300 text-center whitespace-nowrap shadow-2xs leading-normal">
                                                {row.installment_rate}%
                                            </span>
                                        ) : (
                                            <span className="font-mono font-bold text-xs text-slate-800 leading-normal">
                                                {row.installment_rate}%
                                            </span>
                                        )}
                                    </td>

                                    {/* 12. Đánh giá TOP/BOT */}
                                    <td className="py-2.5 px-3 text-center align-middle whitespace-nowrap">
                                        <div className="flex justify-center whitespace-nowrap">
                                            {getTopBotBadge(row.top_bot_status, row.top_bot_label)}
                                        </div>
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
