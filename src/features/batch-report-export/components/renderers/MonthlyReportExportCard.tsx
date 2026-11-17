import React, { useMemo } from 'react';
import type { BusinessDayRecord } from '../../../../core/lib/storage';
import { formatValue, getShortStoreName } from '../../../../core/lib/formatters';
import { CalendarDays } from 'lucide-react';

interface Props {
    records: BusinessDayRecord[];
    selectedStore: string;
    selectedMonth: number;
    selectedYear: number;
    viewMode?: 'categories' | 'daily_pace';
}

export default function MonthlyReportExportCard({
    records,
    selectedStore,
    selectedMonth,
    selectedYear,
    viewMode = 'categories'
}: Props) {
    const storeLabel = getShortStoreName(selectedStore);

    // Lấy bản ghi mới nhất của tháng làm mốc lũy kế
    const latestRecord = useMemo(() => {
        if (!records || records.length === 0) return null;
        return [...records].sort((a, b) => (b.reportDate || '').localeCompare(a.reportDate || ''))[0];
    }, [records]);

    if (!latestRecord) {
        return (
            <div className="w-[880px] bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2 font-avo">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <CalendarDays className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-800 uppercase">
                    Báo Cáo Doanh Thu Tháng • ST {storeLabel}
                </h3>
                <p className="text-xs text-slate-500">
                    Chưa có số liệu kinh doanh lũy kế cho ST này trong tháng {selectedMonth}/{selectedYear}.
                </p>
            </div>
        );
    }

    const targetMonth = latestRecord.revenueTarget || 0;
    const revRealMonth = latestRecord.revenueActual || 0;
    const revQdMonth = latestRecord.revenueActual || 0;
    const pctMonth = targetMonth > 0 ? Number(((revQdMonth / targetMonth) * 100).toFixed(1)) : 0;
    const remainingTarget = Math.max(0, targetMonth - revQdMonth);

    // Tính số ngày đã qua trong tháng dựa trên ngày của bản ghi
    const recordDay = latestRecord.reportDate ? Number(latestRecord.reportDate.split('-')[2]) : 1;
    const totalDaysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const remainingDays = Math.max(1, totalDaysInMonth - recordDay);
    const requiredDailyPace = remainingTarget > 0 ? Number((remainingTarget / remainingDays).toFixed(1)) : 0;
    const currentDailyPace = recordDay > 0 ? Number((revQdMonth / recordDay).toFixed(1)) : 0;

    const emulationEntries = Object.entries(latestRecord.emulationSummary || {});

    // Sắp xếp ngày tăng dần cho viewMode daily_pace
    const sortedRecords = useMemo(() => {
        return [...records].sort((a, b) => (a.reportDate || '').localeCompare(b.reportDate || ''));
    }, [records]);

    return (
        <div
            data-report-table="true"
            className="w-[880px] bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 font-avo text-slate-800"
        >
            {/* Header Báo Cáo Chuẩn MonthlyReportPage */}
            <div className="text-center pb-3 border-b-2 border-emerald-600">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
                        BÁO CÁO DOANH THU THÁNG (LŨY KẾ)
                    </div>
                </div>
                <h2 className="text-xl font-black text-emerald-800 uppercase tracking-wide">
                    ST: {storeLabel}
                </h2>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Kỳ tháng: Tháng {selectedMonth}/{selectedYear} • Lũy kế đến ngày {latestRecord.reportDate ? latestRecord.reportDate.split('-').reverse().join('/') : ''}
                    {viewMode === 'daily_pace' ? ' • Xem theo nhịp ngày' : ' • Xem theo ngành hàng thi đua'}
                </p>
            </div>

            {/* KPI Thống Kê Tổng Quan Chuẩn Tháng */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-blue-50/80 rounded-xl p-3 border border-blue-200/90 text-center">
                    <div className="text-[11px] font-bold text-blue-700 uppercase">Target Tháng</div>
                    <div className="text-lg font-black text-blue-900 tabular-nums mt-0.5">
                        {formatValue(targetMonth)} <span className="text-xs font-normal">tr</span>
                    </div>
                </div>

                <div className="bg-emerald-50/80 rounded-xl p-3 border border-emerald-200/90 text-center">
                    <div className="text-[11px] font-bold text-emerald-700 uppercase">DTQĐ Lũy Kế</div>
                    <div className="text-lg font-black text-emerald-900 tabular-nums mt-0.5">
                        {formatValue(revQdMonth)} <span className="text-xs font-normal">tr</span>
                    </div>
                </div>

                <div className={`rounded-xl p-3 border text-center ${
                    pctMonth >= 100 ? 'bg-emerald-100/80 border-emerald-300' : 'bg-amber-50/80 border-amber-200/90'
                }`}>
                    <div className="text-[11px] font-bold text-slate-700 uppercase">% Hoàn Thành</div>
                    <div className={`text-lg font-black tabular-nums mt-0.5 ${
                        pctMonth >= 100 ? 'text-emerald-800' : 'text-amber-800'
                    }`}>
                        {pctMonth}%
                    </div>
                </div>

                <div className="bg-purple-50/80 rounded-xl p-3 border border-purple-200/90 text-center">
                    <div className="text-[11px] font-bold text-purple-700 uppercase">Nhịp Cần Đạt</div>
                    <div className="text-lg font-black text-purple-900 tabular-nums mt-0.5">
                        {formatValue(requiredDailyPace)} <span className="text-xs font-normal">tr/ngày</span>
                    </div>
                    <div className="text-[10.5px] font-semibold text-slate-500 mt-0.5">
                        Hiện tại: {formatValue(currentDailyPace)} tr/ngày
                    </div>
                </div>
            </div>

            {/* BẢNG DỮ LIỆU TÙY THEO CHẾ ĐỘ XEM */}
            {viewMode === 'categories' ? (
                /* Bảng Chi Tiết Ngành Hàng Thi Đua */
                emulationEntries.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800 text-white font-bold">
                                    <th className="px-2.5 py-2 text-center w-12">STT</th>
                                    <th className="px-3 py-2">Ngành Hàng Thi Đua</th>
                                    <th className="px-2.5 py-2 text-right">Target</th>
                                    <th className="px-2.5 py-2 text-right">Thực Hiện</th>
                                    <th className="px-2.5 py-2 text-right">%DK</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {emulationEntries.map(([catName, val], idx) => {
                                    const cPct = val.pctDK || 0;
                                    return (
                                        <tr key={catName} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                            <td className="px-2.5 py-1.5 text-center font-bold text-slate-500 tabular-nums">
                                                {idx + 1}
                                            </td>
                                            <td className="px-3 py-1.5 font-bold text-slate-800">
                                                {catName}
                                            </td>
                                            <td className="px-2.5 py-1.5 text-right font-semibold text-slate-600 tabular-nums">
                                                {formatValue(val.target)}
                                            </td>
                                            <td className="px-2.5 py-1.5 text-right font-semibold text-slate-700 tabular-nums">
                                                {formatValue(val.actual)}
                                            </td>
                                            <td className="px-2.5 py-1.5 text-right font-bold tabular-nums">
                                                <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                                                    cPct >= 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {cPct}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            ) : (
                /* Bảng Nhịp Ngày Lũy Kế */
                <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800 text-white font-bold">
                                <th className="px-2.5 py-2 text-center w-12">Ngày</th>
                                <th className="px-3 py-2 text-right">Mục Tiêu</th>
                                <th className="px-3 py-2 text-right">DTQĐ Ngày</th>
                                <th className="px-2.5 py-2 text-right w-24">% Hoàn Thành</th>
                                <th className="px-3 py-2 text-right">Trả Góp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedRecords.map((r, idx) => {
                                const qd = r.revenueActual || 0;
                                const target = r.revenueTarget || 0;
                                const rate = target > 0 ? Number(((qd / target) * 100).toFixed(1)) : 0;
                                const inst = r.revenueInstallment || 0;
                                return (
                                    <tr key={r.reportDate || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                        <td className="px-2.5 py-1.5 text-center font-bold text-slate-700 tabular-nums">
                                            {r.reportDate ? r.reportDate.split('-').reverse().join('/') : `Ngày ${idx + 1}`}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-medium text-slate-600 tabular-nums">
                                            {formatValue(target)}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-black text-blue-900 tabular-nums">
                                            {formatValue(qd)}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-black tabular-nums">
                                            <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                                                rate >= 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                            }`}>
                                                {rate}%
                                            </span>
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-medium text-purple-900 tabular-nums">
                                            {formatValue(inst)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
