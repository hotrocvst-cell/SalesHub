import React from 'react';
import type { CampaignProgressItem } from '../types';
import { formatRemainingTarget } from '../../../core/lib/formatters';

interface Props {
    items: CampaignProgressItem[];
}

export default function CampaignProgressTableView({ items }: Props) {
    if (items.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                Không có dữ liệu chương trình thi đua phù hợp với bộ lọc.
            </div>
        );
    }

    // Tính tổng số liệu toàn bộ
    const totalTargetSum = items.reduce((sum, i) => sum + i.totalTarget, 0);
    const totalActualSum = items.reduce((sum, i) => sum + i.totalActual, 0);
    const totalRemainingSum = items.reduce((sum, i) => sum + i.totalRemaining, 0);
    const avgCompletionRate = items.length > 0
        ? Number((items.reduce((sum, i) => sum + i.completionRate, 0) / items.length).toFixed(1))
        : 0;
    const avgForecastRate = items.length > 0
        ? Math.round(items.reduce((sum, i) => sum + i.forecastRate, 0) / items.length)
        : 0;
    const totalEmpsAssigned = items.reduce((sum, i) => sum + i.totalEmployees, 0);
    const totalEmpsAchieved = items.reduce((sum, i) => sum + i.achievedEmployees, 0);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-800 text-white uppercase text-[10px] font-black border-b border-slate-900 select-none">
                            <th className="px-2 py-2 text-center w-8">STT</th>
                            <th className="px-2 py-2 min-w-[130px]">Chương trình thi đua</th>
                            <th className="px-1.5 py-2 text-center w-12">ĐVT</th>
                            <th className="px-2 py-2 text-right">Target</th>
                            <th className="px-2 py-2 text-right">Lũy kế</th>
                            <th className="px-2 py-2 text-right">Còn lại</th>
                            <th className="px-2 py-2 text-right">%HT</th>
                            <th className="px-2.5 py-2 text-right font-black">%DKHT</th>
                            <th className="px-2 py-2 text-center">NV Đạt / Giao</th>
                            <th className="px-2 py-2 text-center">Đánh giá</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {items.map((item, idx) => {
                            const isGood = item.forecastRate >= 100;
                            return (
                                <tr
                                    key={item.campaignKey}
                                    className={`transition-colors ${
                                        isGood ? 'hover:bg-slate-50' : 'bg-rose-50/20 hover:bg-rose-50/50'
                                    }`}
                                >
                                    <td className="px-2 py-2 text-center text-slate-400 font-mono text-[11px]">
                                        {idx + 1}
                                    </td>
                                    <td className="px-2 py-2">
                                        <div className="font-bold text-slate-800 truncate" title={item.displayName}>
                                            {item.displayName}
                                        </div>
                                    </td>
                                    <td className="px-1.5 py-2 text-center text-[10px] font-semibold text-slate-500">
                                        <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                                            {item.unit}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono font-semibold text-slate-700">
                                        {item.totalTarget.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono font-bold text-blue-700">
                                        {item.totalActual.toLocaleString()}
                                    </td>
                                    <td className={`px-2 py-2 text-right font-mono font-bold ${
                                        item.totalRemaining === 0 ? 'text-emerald-700 font-extrabold' : 'text-amber-700'
                                    }`}>
                                        {formatRemainingTarget(item.totalRemaining, false)}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono font-semibold text-slate-700">
                                        {item.completionRate}%
                                    </td>
                                    <td className={`px-2.5 py-2 text-right font-mono font-black text-[13px] ${
                                        isGood ? 'text-emerald-700' : 'text-rose-600'
                                    }`}>
                                        {item.forecastRate}%
                                    </td>
                                    <td className="px-2 py-2 text-center font-mono text-slate-600 text-[11px]">
                                        <span className={`font-bold ${
                                            item.achievedEmployees === item.totalEmployees
                                                ? 'text-emerald-700'
                                                : item.achievedEmployees === 0
                                                ? 'text-rose-600 font-black'
                                                : 'text-amber-700'
                                        }`}>
                                            {item.achievedEmployees}
                                        </span>
                                        <span>/{item.totalEmployees}</span>
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                                            isGood
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                : 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                                        }`}>
                                            {isGood ? 'ĐẠT' : 'CHƯA ĐẠT'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-300 select-none">
                            <td colSpan={3} className="px-2 py-2.5 text-center text-[11px] uppercase tracking-wider">
                                TỔNG CỘNG ({items.length} THI ĐUA)
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono text-slate-800">
                                {totalTargetSum.toLocaleString()}
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono text-blue-800">
                                {totalActualSum.toLocaleString()}
                            </td>
                            <td className={`px-2 py-2.5 text-right font-mono font-bold ${
                                totalRemainingSum === 0 ? 'text-emerald-800' : 'text-amber-800'
                            }`}>
                                {formatRemainingTarget(totalRemainingSum, false)}
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono text-slate-800">
                                {avgCompletionRate}%
                            </td>
                            <td className={`px-2.5 py-2.5 text-right font-mono text-sm ${
                                avgForecastRate >= 100 ? 'text-emerald-800' : 'text-rose-700'
                            }`}>
                                {avgForecastRate}%
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono text-slate-700">
                                {totalEmpsAchieved}/{totalEmpsAssigned}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                                    avgForecastRate >= 100 ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                                }`}>
                                    {avgForecastRate >= 100 ? 'ĐẠT TB' : 'CHƯA ĐẠT TB'}
                                </span>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
