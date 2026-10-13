import React from 'react';
import { formatValue } from '../../../core/lib/formatters';
import type { StoreCumulativeSummary } from '../types';
import {
    Store,
    Trophy,
    TrendingUp,
    Users,
    CheckCircle2,
    ShieldAlert
} from 'lucide-react';

interface CumulativeRankingKpiCardsProps {
    summary: StoreCumulativeSummary;
    showTarget: boolean;
}

export default function CumulativeRankingKpiCards({
    summary,
    showTarget
}: CumulativeRankingKpiCardsProps) {
    const {
        storeCumulativeRevenue,
        storeTarget,
        storeCompletionRate,
        top1Employee,
        avgRevenuePerEmployee,
        totalEmployeesWithSales,
        sumOfEmployeesCumulative,
        unassignedOrOnlineDiff
    } = summary;

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
            {/* THẺ 1: DOANH THU LŨY KẾ SIÊU THỊ (SỐ TỔNG CHUẨN) */}
            <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-2xl p-3 sm:p-3.5 text-white shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute right-0 top-0 translate-x-2 -translate-y-2 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] sm:text-[11px] font-bold text-indigo-200 uppercase tracking-wider">
                        Lũy Kế Siêu Thị
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                        <Store className="w-3.5 h-3.5" />
                    </div>
                </div>

                <div>
                    <div className="text-base sm:text-xl font-black text-amber-300 tracking-tight">
                        {formatValue(storeCumulativeRevenue)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] text-indigo-200/80 font-medium">
                            🏢 Dữ liệu chốt siêu thị
                        </span>
                        {showTarget && storeTarget > 0 && (
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30">
                                Đạt {storeCompletionRate.toFixed(1)}% {summary.targetSource === 'PERIOD' ? '(Target đợt)' : ''}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* THẺ 2: QUÁN QUÂN TOP 1 */}
            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Quán Quân (Top 1)
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                        <Trophy className="w-3.5 h-3.5" />
                    </div>
                </div>

                <div>
                    <div className="text-sm sm:text-base font-black text-slate-900 truncate tracking-tight">
                        {top1Employee ? top1Employee.name : 'Chưa có'}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] sm:text-[11px] text-slate-600 font-semibold">
                        {top1Employee ? (
                            <>
                                <span className="text-indigo-600 font-bold">{formatValue(top1Employee.revenue)}</span>
                                <span className="text-slate-400">•</span>
                                <span className="text-amber-600 font-bold">({top1Employee.shareRate.toFixed(1)}% shop)</span>
                            </>
                        ) : (
                            <span className="text-slate-400">Không có phát sinh</span>
                        )}
                    </div>
                </div>
            </div>

            {/* THẺ 3: DOANH THU TRUNG BÌNH / NHÂN SỰ */}
            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        DT Trung Bình / NV
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                        <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                </div>

                <div>
                    <div className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                        {formatValue(avgRevenuePerEmployee)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] sm:text-[11px] text-slate-500 font-medium">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>{totalEmployeesWithSales} nhân sự phát sinh DT</span>
                    </div>
                </div>
            </div>

            {/* THẺ 4: ĐỐI CHIẾU DOANH THU & CHÊNH LỆCH */}
            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Tổng Dòng NV vs Chênh Lệch
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                </div>

                <div>
                    <div className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                        {formatValue(sumOfEmployeesCumulative)}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
                        <span>Chênh lệch shop:</span>
                        <span className={`font-bold ${unassignedOrOnlineDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {unassignedOrOnlineDiff > 0 ? '+' : ''}{formatValue(unassignedOrOnlineDiff)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
