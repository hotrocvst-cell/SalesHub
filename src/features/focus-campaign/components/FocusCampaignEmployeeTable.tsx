import React, { useMemo } from 'react';
import type {
    FocusEmployeeRow,
    FocusStoreCampaignMetric,
    TableViewMode
} from '../types';
import { Award, Trophy, Check, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
    employeeRows: FocusEmployeeRow[];
    storeMetrics: FocusStoreCampaignMetric[];
    storeName: string;
    tableViewMode: TableViewMode;
}

export default function FocusCampaignEmployeeTable({
    employeeRows,
    storeMetrics,
    storeName,
    tableViewMode
}: Props) {
    const totalNH = storeMetrics.length;

    // Tính độ dài mã NV lớn nhất để đồng bộ chiều rộng badge theo Quy chuẩn 11
    const maxIdLength = useMemo(() => {
        if (!employeeRows || employeeRows.length === 0) return 6;
        return Math.max(6, ...employeeRows.map(r => String(r.employeeId || '').trim().length));
    }, [employeeRows]);

    if (!employeeRows || employeeRows.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 font-sans">
                Không có dữ liệu nhân sự phù hợp với bộ lọc hiện tại.
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden font-sans" data-report-table="true">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse report-table text-xs font-avo" data-report-table="true">
                    <thead>
                        <tr className="bg-slate-100/90 text-slate-700 font-black border-b border-slate-200">
                            <th className="px-2.5 py-2.5 text-center w-10 shrink-0">STT</th>
                            {/* CỘT 1 DUY NHẤT: NHÂN VIÊN (QUY CHUẨN 11) */}
                            <th className="px-2.5 py-2.5 text-left min-w-[190px]">Nhân Viên</th>
                            {/* CỘT ĐÁNH GIÁ: SỐ NH ĐẠT (X / TOTAL NH) */}
                            <th className="px-2.5 py-2.5 text-center min-w-[110px] bg-indigo-50/60 text-indigo-950">
                                Số NH Đạt (X/{totalNH})
                            </th>
                            {/* CÁC CỘT NHÓM HÀNG THI ĐUA ĐÃ CHỌN */}
                            {storeMetrics.map((m) => (
                                <th key={m.campaignKey} className="px-2 py-2 text-right min-w-[115px]">
                                    <div className="font-black text-slate-900 truncate" title={m.displayName}>
                                        {m.displayName}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-normal">
                                        ({m.unit})
                                    </div>
                                </th>
                            ))}
                        </tr>

                        {/* HÀNG TỔNG KẾT ST: LẤY SỐ LIỆU LŨY KẾ CỦA CHÍNH ST (KHÔNG SUM NV) */}
                        <tr className="bg-blue-50/70 border-b-2 border-blue-200 font-black text-slate-900">
                            <td className="px-2.5 py-2 text-center text-blue-700">★</td>
                            <td className="px-2.5 py-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] uppercase font-bold shrink-0">
                                        ST
                                    </span>
                                    <span className="text-blue-900 font-black truncate">
                                        Lũy Kế {storeName}
                                    </span>
                                </div>
                            </td>
                            <td className="px-2.5 py-2 text-center bg-blue-100/50 text-blue-900 font-mono text-[11px]">
                                {storeMetrics.filter(m => m.forecastRate >= 100).length}/{totalNH} NH Đạt
                            </td>
                            {storeMetrics.map((m) => (
                                <td key={`store-${m.campaignKey}`} className="px-2 py-2 text-right">
                                    <div className="font-mono text-slate-900 font-extrabold">
                                        {m.storeActual.toLocaleString('vi-VN')}
                                        <span className="text-slate-400 font-normal">/{m.storeTarget.toLocaleString('vi-VN')}</span>
                                    </div>
                                    <div className={`text-[10.5px] font-mono font-bold ${
                                        m.forecastRate >= 100 ? 'text-emerald-700' : m.forecastRate >= 80 ? 'text-amber-700' : 'text-rose-700'
                                    }`}>
                                        %DK: {m.forecastRate}%
                                    </div>
                                </td>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                        {employeeRows.map((row, idx) => {
                            const isAllPassed = row.forecastAchievedCount === totalNH && totalNH > 0;
                            const isMajority = row.forecastAchievedCount >= Math.ceil(totalNH / 2);

                            // Màu sắc badge đánh giá X / total NH
                            const badgeStyle = isAllPassed
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black'
                                : isMajority
                                    ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold'
                                    : row.forecastAchievedCount > 0
                                        ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                                        : 'bg-rose-100 text-rose-800 border-rose-300 font-bold';

                            return (
                                <tr
                                    key={row.employeeId}
                                    className={`hover:bg-slate-50/80 transition-colors ${
                                        isAllPassed ? 'bg-emerald-50/20' : ''
                                    }`}
                                >
                                    {/* STT */}
                                    <td className="px-2.5 py-2 text-center text-slate-400 font-medium text-[11px]">
                                        {idx + 1}
                                    </td>

                                    {/* CỘT NHÂN VIÊN: GỘP MÃ VÀ TÊN RÚT GỌN (QUY CHUẨN 11) */}
                                    <td className="px-2.5 py-2">
                                        <div
                                            className="flex items-center gap-1.5"
                                            title={`Mã NV: ${row.employeeId} - ${row.fullName}`}
                                        >
                                            <span
                                                className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                                                style={{ minWidth: `${maxIdLength + 2.2}ch`, width: `${maxIdLength + 2.2}ch` }}
                                            >
                                                {row.employeeId}
                                            </span>
                                            <span className="font-bold text-slate-800 truncate">
                                                {row.shortName}
                                            </span>
                                        </div>
                                    </td>

                                    {/* SỐ NH ĐẠT (X / TOTAL NH) */}
                                    <td className="px-2.5 py-2 text-center bg-indigo-50/30">
                                        <div className="inline-flex items-center gap-1">
                                            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md border ${badgeStyle}`}>
                                                {row.forecastAchievedCount}/{totalNH} NH
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-semibold pt-0.5">
                                            {row.achievementRate}% đạt
                                        </div>
                                    </td>

                                    {/* CÁC CỘT NHÓM HÀNG */}
                                    {storeMetrics.map((m) => {
                                        const metric = row.campaignMetrics[m.campaignKey];
                                        if (!metric || (!metric.hasTarget && metric.actual === 0)) {
                                            return (
                                                <td key={m.campaignKey} className="px-2 py-2 text-right text-slate-300">
                                                    -
                                                </td>
                                            );
                                        }

                                        // Trường hợp nhân viên có phát sinh thực tế nhưng không giao target
                                        if (!metric.hasTarget) {
                                            return (
                                                <td key={m.campaignKey} className="px-2 py-2 text-right font-mono">
                                                    <div className="font-extrabold text-blue-800 text-xs">
                                                        {metric.actual}
                                                    </div>
                                                    <div className="text-[10px] text-blue-600/80 font-bold">
                                                        (+bán thêm)
                                                    </div>
                                                </td>
                                            );
                                        }

                                        const pass = metric.isAchieved;
                                        const rateColor = pass
                                            ? 'text-emerald-700'
                                            : metric.forecastRate >= 80
                                                ? 'text-amber-700'
                                                : 'text-rose-700';

                                        return (
                                            <td key={m.campaignKey} className="px-2 py-2 text-right font-mono">
                                                {tableViewMode === 'FULL' ? (
                                                    <div>
                                                        <div className="font-extrabold text-slate-800 text-xs">
                                                            {metric.actual}
                                                            <span className="text-slate-400 font-normal">/{metric.target}</span>
                                                        </div>
                                                        <div className={`text-[10.5px] font-bold ${rateColor}`}>
                                                            %DK: {metric.forecastRate}%
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className={`font-extrabold text-xs ${rateColor}`}>
                                                        {metric.forecastRate}%
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

