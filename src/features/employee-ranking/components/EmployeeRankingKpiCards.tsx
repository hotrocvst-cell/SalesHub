import type { EmployeeRankingSummary } from '../types';
import { Coins, Target, Award, ShieldCheck } from 'lucide-react';

interface Props {
    summary: EmployeeRankingSummary;
    displayUnit: 'BILLION' | 'MILLION';
}

export default function EmployeeRankingKpiCards({ summary, displayUnit }: Props) {
    const formatMoney = (millionVal: number) => {
        if (displayUnit === 'BILLION') {
            return `${(millionVal / 1000).toFixed(3)} tỷ`;
        }
        return `${Math.round(millionVal).toLocaleString('vi-VN')} tr`;
    };

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* THẺ 1: TỔNG DTQĐ TOÀN ST / CỤM */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-blue-200 shadow-sm flex flex-col justify-between gap-1.5">
                <div className="flex items-center justify-between gap-1.5">
                    <div className="text-[10px] sm:text-[10.5px] font-bold text-blue-800 uppercase tracking-wider">
                        Tổng DTQĐ
                    </div>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                        <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" aria-hidden="true" />
                    </div>
                </div>
                <div>
                    <div className="text-base sm:text-xl font-black text-slate-950 tracking-tight font-avo">
                        {formatMoney(summary.totalRevenueQd)}
                    </div>
                    <div className="text-[10.5px] text-slate-600 font-medium mt-0.5">
                        DT Thực: <b className="text-slate-800">{formatMoney(summary.totalRevenueActual)}</b>
                    </div>
                </div>
            </div>

            {/* THẺ 2: %DKHT DOANH THU TRUNG BÌNH */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between gap-1.5">
                <div className="flex items-center justify-between gap-1.5">
                    <div className="text-[10px] sm:text-[10.5px] font-bold text-amber-800 uppercase tracking-wider">
                        %DKHT Doanh Thu TB
                    </div>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                        <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" aria-hidden="true" />
                    </div>
                </div>
                <div>
                    <div className={`text-base sm:text-xl font-black tracking-tight font-avo ${summary.avgForecastRate >= 100
                        ? 'text-emerald-700'
                        : summary.avgForecastRate >= 90
                            ? 'text-amber-800'
                            : 'text-rose-600'
                        }`}>
                        {summary.avgForecastRate.toFixed(1)}%
                    </div>
                    <div className="text-[10.5px] text-slate-600 font-medium mt-0.5">
                        Mục tiêu: <b className="text-slate-800">{formatMoney(summary.totalRevenueTarget)}</b>
                    </div>
                </div>
            </div>

            {/* THẺ 3: TỶ LỆ HOÀN THÀNH THI ĐUA TB */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-1.5">
                <div className="flex items-center justify-between gap-1.5">
                    <div className="text-[10px] sm:text-[10.5px] font-bold text-slate-700 uppercase tracking-wider">
                        Tiến Độ Thi Đua TB
                    </div>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                        <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" aria-hidden="true" />
                    </div>
                </div>
                <div>
                    <div className={`text-base sm:text-xl font-black tracking-tight font-avo ${summary.avgEmulationRate >= 100
                        ? 'text-emerald-700'
                        : summary.avgEmulationRate >= 80
                            ? 'text-blue-700'
                            : 'text-rose-600'
                        }`}>
                        {summary.avgEmulationRate.toFixed(1)}%
                    </div>
                    <div className="text-[10.5px] text-slate-600 font-medium mt-0.5">
                        Chế độ: <b className="text-slate-800">{summary.scoringModeLabel}</b>
                    </div>
                </div>
            </div>

            {/* THẺ 4: SỨC KHỎE NHÂN SỰ & XÉT CỨU */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between gap-1.5">
                <div className="flex items-center justify-between gap-1.5">
                    <div className="text-[10px] sm:text-[10.5px] font-bold text-emerald-800 uppercase tracking-wider">
                        Sức Khỏe &amp; Cứu BOT
                    </div>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" aria-hidden="true" />
                    </div>
                </div>
                <div>
                    <div className="text-base sm:text-xl font-black text-slate-900 tracking-tight font-avo flex items-center gap-1.5 flex-wrap">
                        <span className="text-teal-700 font-black">{summary.rescuedCount ?? 0}</span>
                        <span className="text-xs text-slate-600 font-medium">cứu</span>
                        <span className="text-slate-500 font-normal">/</span>
                        <span className="text-rose-600 font-black">{summary.botWarningCount ?? 0}</span>
                        <span className="text-xs text-slate-600 font-medium">BOT</span>
                    </div>
                    <div className="text-[10.5px] text-slate-600 font-medium mt-0.5">
                        An toàn: <b className="text-emerald-800 font-bold">{summary.safeCount ?? (summary.totalEmployees - (summary.botWarningCount ?? 0))} NV</b>
                    </div>
                </div>
            </div>
        </div>
    );
}
