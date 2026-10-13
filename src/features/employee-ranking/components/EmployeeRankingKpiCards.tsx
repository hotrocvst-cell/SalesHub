import type { EmployeeRankingSummary } from '../types';
import { Coins, Target, Award, Users } from 'lucide-react';

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* THẺ 1: TỔNG DTQĐ TOÀN SHOP / CỤM */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-indigo-100 shadow-2xs border-l-4 border-l-indigo-600 flex items-center justify-between">
                <div className="min-w-0">
                    <div className="text-[10.5px] font-bold text-indigo-700 uppercase tracking-wider truncate">
                        Tổng DTQĐ
                    </div>
                    <div className="text-lg sm:text-xl font-black text-indigo-950 mt-0.5 tracking-tight font-avo">
                        {formatMoney(summary.totalRevenueQd)}
                    </div>
                    <div className="text-[10.5px] text-slate-500 font-medium mt-0.5 truncate">
                        DT Thực: <b className="text-slate-700">{formatMoney(summary.totalRevenueActual)}</b>
                    </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
                    <Coins className="w-5 h-5 stroke-[2.2]" />
                </div>
            </div>

            {/* THẺ 2: %DKHT DOANH THU TRUNG BÌNH */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-amber-100 shadow-2xs border-l-4 border-l-amber-500 flex items-center justify-between">
                <div className="min-w-0">
                    <div className="text-[10.5px] font-bold text-amber-800 uppercase tracking-wider truncate">
                        %DKHT Doanh Thu TB
                    </div>
                    <div className={`text-lg sm:text-xl font-black mt-0.5 tracking-tight font-avo ${summary.avgForecastRate >= 100
                        ? 'text-emerald-600'
                        : summary.avgForecastRate >= 90
                            ? 'text-amber-700'
                            : 'text-rose-600'
                        }`}>
                        {summary.avgForecastRate.toFixed(1)}%
                    </div>
                    <div className="text-[10.5px] text-slate-500 font-medium mt-0.5 truncate">
                        Mục tiêu: <b className="text-slate-700">{formatMoney(summary.totalRevenueTarget)}</b>
                    </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-2xs">
                    <Target className="w-5 h-5 stroke-[2.2]" />
                </div>
            </div>

            {/* THẺ 3: TỶ LỆ HOÀN THÀNH THI ĐUA TB */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-purple-100 shadow-2xs border-l-4 border-l-purple-500 flex items-center justify-between">
                <div className="min-w-0">
                    <div className="text-[10.5px] font-bold text-purple-800 uppercase tracking-wider truncate">
                        Tiến Độ Thi Đua TB
                    </div>
                    <div className={`text-lg sm:text-xl font-black mt-0.5 tracking-tight font-avo ${summary.avgEmulationRate >= 100
                        ? 'text-emerald-600'
                        : summary.avgEmulationRate >= 80
                            ? 'text-purple-700'
                            : 'text-rose-600'
                        }`}>
                        {summary.avgEmulationRate.toFixed(1)}%
                    </div>
                    <div className="text-[10.5px] text-slate-500 font-medium mt-0.5 truncate">
                        Chế độ: <b className="text-slate-700">{summary.scoringModeLabel}</b>
                    </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 shadow-2xs">
                    <Award className="w-5 h-5 stroke-[2.2]" />
                </div>
            </div>

            {/* THẺ 4: QUAN SÁT TOP / BOT */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-emerald-100 shadow-2xs border-l-4 border-l-emerald-600 flex items-center justify-between">
                <div className="min-w-0">
                    <div className="text-[10.5px] font-bold text-emerald-800 uppercase tracking-wider truncate">
                        Tổng Nhân Sự
                    </div>
                    <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 tracking-tight font-avo">
                        {summary.totalEmployees} <span className="text-xs font-bold text-slate-500">nhân sự</span>
                    </div>
                    <div className="text-[10.5px] text-slate-500 font-medium mt-0.5 truncate">
                        Phân loại: <b className="text-emerald-700">{summary.topRevenueCount} TOP</b> • <b className="text-rose-600">{summary.botRevenueCount} BOT</b>
                    </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
                    <Users className="w-5 h-5 stroke-[2.2]" />
                </div>
            </div>
        </div>
    );
}
