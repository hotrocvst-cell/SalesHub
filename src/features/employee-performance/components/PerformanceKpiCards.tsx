import type { StorePerformanceSummary } from '../types';
import { cleanEmployeeName } from '../utils/performanceConfig';
import { Trophy, Flame, Target, CreditCard, Crown, Zap, TrendingUp, Wallet } from 'lucide-react';

interface Props {
    summary: StorePerformanceSummary;
    showWorkHours?: boolean;
}

export default function PerformanceKpiCards({ summary, showWorkHours = false }: Props) {
    const { topRevenueEmp, topProductivityEmp, topForecastEmp, topInstallmentEmp } = summary;

    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${showWorkHours ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3.5`}>
            {/* 1. TOP 1 Doanh Thu Quy Đổi (DTQĐ) */}
            <div className="bg-amber-50/40 rounded-2xl p-4 border border-amber-200 shadow-sm hover:shadow-md transition relative">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-normal flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                        <span>Top 1 DTQĐ</span>
                    </span>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-100 text-amber-800 shadow-sm shrink-0" aria-hidden="true">
                        <Crown className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                </div>

                <div className="mt-2.5">
                    <div className="text-base font-bold text-slate-900 leading-normal overflow-visible min-h-[26px] flex items-center" title={topRevenueEmp ? cleanEmployeeName(topRevenueEmp.full_name) : ''}>
                        {topRevenueEmp ? cleanEmployeeName(topRevenueEmp.full_name) : '—'}
                    </div>
                    <div className="text-xs text-slate-600 font-mono tabular-nums font-medium mt-0.5 leading-normal">
                        {topRevenueEmp ? `Mã NV: ${topRevenueEmp.employee_id}` : 'Chưa có số liệu'}
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-amber-200/70 leading-normal">
                    <span className="text-amber-950 font-medium">Lũy kế DTQĐ:</span>
                    <strong className="font-mono tabular-nums text-blue-700 font-bold text-sm">
                        {topRevenueEmp ? `${topRevenueEmp.revenue_qd.toLocaleString('vi-VN')} tr` : '0 tr'}
                    </strong>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1 leading-normal">
                    <span>%HT thực tế:</span>
                    <span className="font-mono tabular-nums font-bold text-emerald-700">
                        {topRevenueEmp ? `${topRevenueEmp.completion_rate}%` : '0%'}
                    </span>
                </div>
            </div>

            {/* 2. TOP 1 Năng Suất Giờ Công (DTQĐ/GC) - Chỉ hiển thị khi bật toggle Giờ công & Năng suất */}
            {showWorkHours && (
                <div className="bg-teal-50/40 rounded-2xl p-4 border border-teal-200 shadow-sm hover:shadow-md transition relative">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-teal-950 uppercase tracking-normal flex items-center gap-1.5">
                            <Flame className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                            <span>Top 1 Năng Suất (DTQĐ/GC)</span>
                        </span>
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-teal-100 text-teal-800 shadow-sm shrink-0" aria-hidden="true">
                            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                        </span>
                    </div>

                    <div className="mt-2.5">
                        <div className="text-base font-bold text-slate-900 leading-normal overflow-visible min-h-[26px] flex items-center" title={topProductivityEmp ? cleanEmployeeName(topProductivityEmp.full_name) : ''}>
                            {topProductivityEmp ? cleanEmployeeName(topProductivityEmp.full_name) : '—'}
                        </div>
                        <div className="text-xs text-slate-600 font-mono tabular-nums font-medium mt-0.5 leading-normal">
                            {topProductivityEmp ? `Mã NV: ${topProductivityEmp.employee_id}` : 'Chưa có số liệu'}
                        </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-teal-200/70 leading-normal">
                        <span className="text-teal-950 font-medium">Năng suất DTQĐ:</span>
                        <strong className="font-mono tabular-nums text-teal-800 font-bold text-sm">
                            {topProductivityEmp ? `${topProductivityEmp.productivity_qd_per_hour.toFixed(2)} tr/h` : '0 tr/h'}
                        </strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1 leading-normal">
                        <span>Tổng giờ công:</span>
                        <span className="font-mono tabular-nums font-bold text-slate-800">
                            {topProductivityEmp ? `${topProductivityEmp.work_hours} giờ` : '0 giờ'}
                        </span>
                    </div>
                </div>
            )}

            {/* 3. TOP 1 Dự Báo Hoàn Thành (%DKHT) */}
            <div className="bg-emerald-50/40 rounded-2xl p-4 border border-emerald-200 shadow-sm hover:shadow-md transition relative">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-normal flex items-center gap-1.5">
                        <Target className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                        <span>Top 1 %DKHT</span>
                    </span>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 shadow-sm shrink-0" aria-hidden="true">
                        <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                </div>

                <div className="mt-2.5">
                    <div className="text-base font-bold text-slate-900 leading-normal overflow-visible min-h-[26px] flex items-center" title={topForecastEmp ? cleanEmployeeName(topForecastEmp.full_name) : ''}>
                        {topForecastEmp ? cleanEmployeeName(topForecastEmp.full_name) : '—'}
                    </div>
                    <div className="text-xs text-slate-600 font-mono tabular-nums font-medium mt-0.5 leading-normal">
                        {topForecastEmp ? `Mã NV: ${topForecastEmp.employee_id}` : 'Chưa có số liệu'}
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-emerald-200/70 leading-normal">
                    <span className="text-emerald-950 font-medium">Dự kiến hoàn thành:</span>
                    <strong className="font-mono tabular-nums text-emerald-700 font-bold text-sm">
                        {topForecastEmp ? `${topForecastEmp.forecast_completion_rate}%` : '0%'}
                    </strong>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1 leading-normal">
                    <span>Target:</span>
                    <span className="font-mono tabular-nums font-bold text-slate-800">
                        {topForecastEmp ? `${topForecastEmp.revenue_target.toLocaleString('vi-VN')} tr` : '—'}
                    </span>
                </div>
            </div>

            {/* 4. TOP 1 Doanh Thu Trả Chậm / Trả Góp */}
            <div className="bg-blue-50/40 rounded-2xl p-4 border border-blue-200 shadow-sm hover:shadow-md transition relative">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-950 uppercase tracking-normal flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
                        <span>Top 1 Trả Chậm</span>
                    </span>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-blue-100 text-blue-800 shadow-sm shrink-0" aria-hidden="true">
                        <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                </div>

                <div className="mt-2.5">
                    <div className="text-base font-bold text-slate-900 leading-normal overflow-visible min-h-[26px] flex items-center" title={topInstallmentEmp ? cleanEmployeeName(topInstallmentEmp.full_name) : ''}>
                        {topInstallmentEmp ? cleanEmployeeName(topInstallmentEmp.full_name) : '—'}
                    </div>
                    <div className="text-xs text-slate-600 font-mono tabular-nums font-medium mt-0.5 leading-normal">
                        {topInstallmentEmp ? `Mã NV: ${topInstallmentEmp.employee_id}` : 'Chưa có số liệu'}
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-blue-200/70 leading-normal">
                    <span className="text-blue-950 font-medium">Doanh thu trả chậm:</span>
                    <strong className="font-mono tabular-nums text-blue-700 font-bold text-sm">
                        {topInstallmentEmp ? `${topInstallmentEmp.installment_revenue.toLocaleString('vi-VN')} tr` : '0 tr'}
                    </strong>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1 leading-normal">
                    <span>Tỷ lệ trả chậm:</span>
                    <span className={`font-mono tabular-nums font-extrabold ${topInstallmentEmp && topInstallmentEmp.installment_rate < 35 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {topInstallmentEmp ? `${topInstallmentEmp.installment_rate}%` : '0%'}
                    </span>
                </div>
            </div>
        </div>
    );
}
