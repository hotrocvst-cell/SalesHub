import React, { useMemo } from 'react';
import type { BusinessDayRecord } from '../../../../core/lib/storage';
import { formatValue, getShortStoreName, formatDate } from '../../../../core/lib/formatters';
import { TrendingUp, Coins, Target, ArrowUpRight } from 'lucide-react';

interface Props {
    records: BusinessDayRecord[];
    selectedStore: string;
    selectedMonth: number;
    selectedYear: number;
    showBarChart?: boolean;
    showDetailTable?: boolean;
}

export default function RevenueTrendExportCard({
    records,
    selectedStore,
    selectedMonth,
    selectedYear,
    showBarChart = true,
    showDetailTable = true
}: Props) {
    const storeLabel = getShortStoreName(selectedStore);

    // Sắp xếp ngày tăng dần
    const sortedRecords = useMemo(() => {
        return [...records].sort((a, b) => {
            const dateA = a.reportDate || '';
            const dateB = b.reportDate || '';
            return dateA.localeCompare(dateB);
        });
    }, [records]);

    if (sortedRecords.length === 0) {
        return (
            <div className="w-[880px] bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2 font-avo">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-800 uppercase">
                    Nhịp Doanh Thu & Diễn Biến • ST {storeLabel}
                </h3>
                <p className="text-xs text-slate-500">
                    Chưa có chuỗi dữ liệu kinh doanh ghi nhận trong tháng {selectedMonth}/{selectedYear}.
                </p>
            </div>
        );
    }

    // Bản ghi mới nhất
    const latestRecord = sortedRecords[sortedRecords.length - 1];

    // Tính tổng kết
    const totalQd = sortedRecords.reduce((sum, r) => sum + (r.revenueActual || 0), 0);
    const totalReal = sortedRecords.reduce((sum, r) => sum + (r.revenueActual || 0), 0);
    const totalTarget = latestRecord.revenueTarget || sortedRecords.reduce((sum, r) => sum + (r.revenueTarget || 0), 0);
    const totalInst = sortedRecords.reduce((sum, r) => sum + (r.revenueInstallment || 0), 0);
    const overallRate = totalTarget > 0 ? Number(((totalQd / totalTarget) * 100).toFixed(1)) : 0;
    const avgDailyQd = Number((totalQd / (sortedRecords.length || 1)).toFixed(2));

    // Tính maxPace cho biểu đồ cột
    const maxPace = useMemo(() => {
        const paces = sortedRecords.map(r => r.revenueActual || 0);
        return Math.max(1, ...paces);
    }, [sortedRecords]);

    return (
        <div
            data-report-table="true"
            className="w-[880px] bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 font-avo text-slate-800"
        >
            {/* Header Báo Cáo Chuẩn RevenueTrendPage */}
            <div className="text-center pb-3 border-b-2 border-indigo-600">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-black uppercase tracking-wider">
                        NHỊP DOANH THU & DIỄN BIẾN
                    </div>
                </div>
                <h2 className="text-xl font-black text-indigo-800 uppercase tracking-wide">
                    ST: {storeLabel}
                </h2>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Kỳ số liệu: Tháng {selectedMonth}/{selectedYear} • {sortedRecords.length} ngày ghi nhận
                </p>
            </div>

            {/* 3 CARD CHỈ SỐ MỐC GẦN NHẤT (Chuẩn RevenueTrendPage) */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                            LŨY KẾ DTQĐ
                        </span>
                        <Coins className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-xl font-black font-mono text-emerald-700">
                        {formatValue(totalQd)} <span className="text-xs font-normal">tr</span>
                    </p>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 font-medium">
                        Lũy kế {sortedRecords.length} ngày trong tháng
                    </p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                            TARGET THÁNG
                        </span>
                        <Target className="w-4 h-4 text-indigo-600" />
                    </div>
                    <p className="text-xl font-black font-mono text-slate-800">
                        {formatValue(totalTarget)} <span className="text-xs font-normal">tr</span>
                    </p>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 font-medium">
                        Tiến độ hoàn thành: <b className="font-mono text-indigo-600 font-bold">{overallRate}%</b>
                    </p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                            DTQĐ NGÀY GẦN NHẤT
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-xl font-black font-mono text-amber-600">
                        {formatValue(latestRecord.revenueActual || 0)} <span className="text-xs font-normal">tr</span>
                    </p>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 font-medium">
                        Tính riêng ngày {latestRecord.reportDate ? latestRecord.reportDate.split('-').reverse().join('/') : ''}
                    </p>
                </div>
            </div>

            {/* BIỂU ĐỒ CỘT MINI DIỄN BIẾN NHỊP NGÀY (Chuẩn RevenueTrendPage) */}
            {showBarChart && (
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 className="font-black text-xs text-slate-800 uppercase tracking-wide flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-indigo-600" />
                            <span>Biểu Đồ Nhịp DTQĐ Hàng Ngày</span>
                        </h3>
                        <span className="text-[11px] font-mono font-bold text-slate-500">
                            Nhịp TB: {formatValue(avgDailyQd)} tr/ngày
                        </span>
                    </div>

                    {/* Container vẽ cột */}
                    <div className="h-40 flex items-end gap-1.5 sm:gap-2 pt-4 pb-1">
                        {sortedRecords.map((d) => {
                            const val = d.revenueActual || 0;
                            const heightPercent = Math.max(10, Math.round((val / maxPace) * 100));
                            const dayNum = d.reportDate ? d.reportDate.split('-')[2] : '';

                            return (
                                <div key={d.reportDate} className="flex-1 min-w-[20px] flex flex-col items-center gap-1">
                                    <span className="text-[9.5px] font-bold text-slate-700 font-mono">
                                        {formatValue(val)}
                                    </span>
                                    <div className="w-full flex items-end justify-center h-28 bg-slate-200/50 rounded-t-md p-0.5">
                                        <div
                                            className="w-full rounded-t-sm transition-all duration-300 bg-gradient-to-t from-indigo-600 to-blue-500"
                                            style={{ height: `${heightPercent}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500 font-mono">
                                        {dayNum}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Bảng Chi Tiết Từng Ngày */}
            {showDetailTable && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800 text-white font-bold">
                                <th className="px-2.5 py-2 text-center w-12">STT</th>
                                <th className="px-3 py-2 text-left w-32">Ngày</th>
                                <th className="px-3 py-2 text-right">Target</th>
                                <th className="px-3 py-2 text-right">DT Thực</th>
                                <th className="px-3 py-2 text-right">DTQĐ</th>
                                <th className="px-2.5 py-2 text-right w-24">% Hoàn Thành</th>
                                <th className="px-3 py-2 text-right">Trả Góp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedRecords.map((r, idx) => {
                                const dateStr = r.reportDate || '';
                                const target = r.revenueTarget || 0;
                                const real = r.revenueActual || 0;
                                const qd = r.revenueActual || 0;
                                const rate = target > 0 ? Number(((qd / target) * 100).toFixed(1)) : 0;
                                const inst = r.revenueInstallment || 0;
                                const instPct = r.installmentRate || (real > 0 ? Number(((inst / real) * 100).toFixed(1)) : 0);

                                return (
                                    <tr key={dateStr || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                        <td className="px-2.5 py-1.5 text-center font-bold text-slate-500 tabular-nums">
                                            {idx + 1}
                                        </td>
                                        <td className="px-3 py-1.5 font-bold text-slate-700">
                                            {dateStr ? dateStr.split('-').reverse().join('/') : `Ngày ${idx + 1}`}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-medium text-slate-600 tabular-nums">
                                            {formatValue(target)}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-medium text-slate-700 tabular-nums">
                                            {formatValue(real)}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-black text-blue-900 tabular-nums">
                                            {formatValue(qd)}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-black tabular-nums">
                                            <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                                                rate >= 100
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : rate >= 80
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-amber-100 text-amber-800'
                                            }`}>
                                                {rate}%
                                            </span>
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-medium text-purple-900 tabular-nums">
                                            {formatValue(inst)} <span className="text-[10px] text-purple-600 font-bold">({instPct}%)</span>
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
