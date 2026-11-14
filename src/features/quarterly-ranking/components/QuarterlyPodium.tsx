import React from 'react';
import type { QuarterlyEmployeeRow, QuarterlyTab } from '../types';
import { Trophy, Medal, Award, Flame } from 'lucide-react';
import { getShortStoreName } from '../../../core/lib/formatters';

interface Props {
    rows: QuarterlyEmployeeRow[];
    tab: QuarterlyTab;
}

export default function QuarterlyPodium({ rows, tab }: Props) {
    if (!rows || rows.length < 3) return null;

    // Sắp xếp top 3 theo tab
    const sorted = [...rows].sort((a, b) => {
        if (tab === 'REVENUE') {
            return b.total_revenue_qd - a.total_revenue_qd;
        }
        return b.emulation_rate - a.emulation_rate || b.emulation_campaigns_achieved - a.emulation_campaigns_achieved;
    });

    const top1 = sorted[0];
    const top2 = sorted[1];
    const top3 = sorted[2];

    const renderCard = (
        emp: QuarterlyEmployeeRow,
        rank: 1 | 2 | 3,
        badgeText: string,
        badgeBg: string,
        borderColor: string,
        textColor: string
    ) => {
        const isRev = tab === 'REVENUE';
        const mainVal = isRev
            ? `${Math.round(emp.total_revenue_qd).toLocaleString('vi-VN')} tr`
            : `${emp.emulation_rate}%`;
        const subVal = isRev
            ? `${emp.completion_rate}% (${emp.consistency_label})`
            : `${emp.total_emulation_achieved}/${emp.total_emulation_target} đạt (${emp.emulation_consistency_label})`;

        return (
            <div
                className={`relative flex flex-col items-center justify-between p-3 rounded-2xl bg-white border-2 ${borderColor} shadow-sm transition-transform hover:-translate-y-0.5`}
            >
                {/* Badge Hạng */}
                <div className={`absolute -top-3 px-2.5 py-0.5 rounded-full text-[11px] font-black text-white shadow-sm flex items-center gap-1 ${badgeBg}`}>
                    {rank === 1 && <Trophy className="w-3 h-3" aria-hidden="true" />}
                    {rank === 2 && <Medal className="w-3 h-3" aria-hidden="true" />}
                    {rank === 3 && <Award className="w-3 h-3" aria-hidden="true" />}
                    <span>{badgeText}</span>
                </div>

                <div className="mt-2 text-center w-full min-w-0">
                    <span className="text-[10px] font-mono font-bold text-slate-400 block">
                        #{emp.employee_id}
                    </span>
                    <h3 className="text-sm font-black text-slate-800 truncate" title={emp.full_name}>
                        {emp.short_name}
                    </h3>
                    <span className="text-[10.5px] font-bold text-slate-500 truncate block">
                        {getShortStoreName(emp.store_name)}
                    </span>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 w-full text-center">
                    <div className={`text-base font-black font-mono ${textColor}`}>
                        {mainVal}
                    </div>
                    <div className="text-[10.5px] font-bold text-slate-500 mt-0.5">
                        {subVal}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-gradient-to-b from-slate-50 to-white/50 rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
                    <Flame className="w-4 h-4 text-amber-500" aria-hidden="true" />
                    <span>Vinh Danh Top 3 Xuất Sắc Nhất Kỳ</span>
                </div>
                <span className="text-[10.5px] font-bold text-slate-500">
                    {tab === 'REVENUE' ? 'Theo Doanh Thu Quy Đổi' : 'Theo Hoàn Thành Thi Đua'}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
                {/* Hạng 2 */}
                <div className="order-1">
                    {renderCard(top2, 2, 'Á Quân #2', 'bg-slate-400', 'border-slate-300', 'text-slate-700')}
                </div>
                {/* Hạng 1 */}
                <div className="order-2 scale-105 sm:scale-105 z-10">
                    {renderCard(top1, 1, 'Quán Quân #1', 'bg-amber-500', 'border-amber-400 shadow-md ring-2 ring-amber-100', 'text-amber-800')}
                </div>
                {/* Hạng 3 */}
                <div className="order-3">
                    {renderCard(top3, 3, 'Quý Quân #3', 'bg-amber-700', 'border-amber-200', 'text-amber-900')}
                </div>
            </div>
        </div>
    );
}

