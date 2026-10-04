import type { StorePerformanceSummary } from '../types';
import { cleanEmployeeName } from '../utils/performanceConfig';
import { Trophy, Flame, Target, CreditCard } from 'lucide-react';

interface Props {
    summary: StorePerformanceSummary;
}

export default function PerformanceKpiCards({ summary }: Props) {
    const { topRevenueEmp, topProductivityEmp, topForecastEmp, topInstallmentEmp } = summary;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. TOP 1 Doanh Thu Quy Đổi (DTQĐ) */}
            <div className="bg-white rounded-2xl p-4 border border-amber-200/80 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 shadow-2xs hover:shadow-xs transition relative">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-normal flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Top 1 Lũy Kế DTQĐ</span>
                    </span>
                    <span className="inline-block w-7 h-7 rounded-xl bg-amber-100 text-amber-800 text-center leading-7 text-xs font-bold shadow-2xs">
                        👑
                    </span>
                </div>

                <div className="mt-2.5">
                    <div className="text-base font-bold text-slate-900 leading-normal overflow-visible min-h-[26px] flex items-center" title={topRevenueEmp ? cleanEmployeeName(topRevenueEmp.full_name) : ''}>
                        {topRevenueEmp ? cleanEmployeeName(topRevenueEmp.full_name) : '—'}
                    </div>
                    <div className="text-xs text-slate-500 font-mono font-medium mt-0.5 leading-normal">
                        {topRevenueEmp ? `Mã NV: ${topRevenueEmp.employee_id}` : 'Chưa có số liệu'}
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-amber-100/80 leading-normal">
                    <span className="text-amber-900/80 font-medium">Lũy kế DTQĐ:</span>
                    <strong className="font-mono text-blue-700 font-bold text-sm">
                        {topRevenueEmp ? `${topRevenueEmp.revenue_qd.toLocaleString('vi-VN')} tr` : '0 tr'}
                    </strong>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 leading-normal">
                    <span>% Tiến độ thực tế:</span>
                    <span className="font-mono font-bold text-emerald-700">
                        {topRevenueEmp ? `${topRevenueEmp.completion_rate}%` : '0%'}
                    </span>
                </div>
            </div>

            {/* 2. TOP 1 Năng Suất Giờ Công (DTQĐ/GC) */}
            <div className="bg-white rounded-2xl p-4 border border-purple-200/80 bg-gradient-to-br from-purple-50/50 via-white to-purple-50/20 shadow-2xs hover:shadow-xs transition relative">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 uppercase tracking-normal flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>Top 1 Năng Suất (DTQĐ/GC)</span>
                    </span>
                    <span className="inline-block w-7 h-7 rounded-xl bg-purple-100 text-purple-800 text-center leading-7 text-xs font-bold shadow-2xs">
                        ⚡
                    </span>
                </div>

                <div className="mt-2.5">
                    <div className="text-base font-bold text-slate-900 leading-normal overflow-visible min-h-[26px] flex items-center" title={topProductivityEmp ? cleanEmployeeName(topProductivityEmp.full_name) : ''}>
                        {topProductivityEmp ? cleanEmployeeName(topProductivityEmp.full_name) : '—'}
                    </div>
                    <div className="text-xs text-slate-500 font-mono font-medium mt-0.5 leading-normal">
                        {topProductivityEmp ? `Mã NV: ${topProductivityEmp.employee_id}` : 'Chưa có số liệu'}
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-purple-100/80 leading-normal">
                    <span className="text-purple-900/80 font-medium">Năng suất mỗi giờ:</span>
                    <strong className="font-mono text-purple-700 font-bold text-sm">
                        {topProductivityEmp ? `${topProductivityEmp.productivity_qd_per_hour.toFixed(2)} tr/h` : '0 tr/h'}
                    </strong>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 leading-normal">
                    <span>Tổng giờ công:</span>
                    <span className="font-mono font-bold text-slate-700">
                        {topProductivityEmp ? `${topProductivityEmp.work_hours} giờ` : '0 giờ'}
                    </span>
                </div>
            </div>

            {/* 3. TOP 1 Dự Báo Hoành Thành (%DKHT) */}
            <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 shadow-2xs hover:shadow-xs transition relative">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-normal flex items-center gap-1.5">
                        <Target className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Top 1 Nhịp Độ (%DKHT)</span>
                    </span>
                    <span className="inline-block w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 text-center leading-7 text-xs font-bold shadow-2xs">
                        🎯
                    </span>
                </div>

                <div className="mt-2.5">
                    <div className="text-base font-bold text-slate-900 leading-normal overflow-visible min-h-[26px] flex items-center" title={topForecastEmp ? cleanEmployeeName(topForecastEmp.full_name) : ''}>
                        {topForecastEmp ? cleanEmployeeName(topForecastEmp.full_name) : '—'}
                    </div>
                    <div className="text-xs text-slate-500 font-mono font-medium mt-0.5 leading-normal">
                        {topForecastEmp ? `Mã NV: ${topForecastEmp.employee_id}` : 'Chưa có số liệu'}
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-emerald-100/80 leading-normal">
                    <span className="text-emerald-900/80 font-medium">Dự báo về đích:</span>
                    <strong className="font-mono text-emerald-700 font-bold text-sm">
                        {topForecastEmp ? `${topForecastEmp.forecast_completion_rate}%` : '0%'}
                    </strong>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 leading-normal">
                    <span>Target giao:</span>
                    <span className="font-mono font-bold text-slate-700">
                        {topForecastEmp ? `${topForecastEmp.revenue_target.toLocaleString('vi-VN')} tr` : '—'}
                    </span>
                </div>
            </div>

            {/* 4. TOP 1 Doanh Thu Trả Chậm / Trả Góp */}
            <div className="bg-white rounded-2xl p-4 border border-blue-200/80 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/20 shadow-2xs hover:shadow-xs transition relative">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-normal flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Top 1 Doanh Thu Trả Chậm</span>
                    </span>
                    <span className="inline-block w-7 h-7 rounded-xl bg-blue-100 text-blue-800 text-center leading-7 text-xs font-bold shadow-2xs">
                        💳
                    </span>
                </div>

                <div className="mt-2.5">
                    <div className="text-base font-bold text-slate-900 leading-normal overflow-visible min-h-[26px] flex items-center" title={topInstallmentEmp ? cleanEmployeeName(topInstallmentEmp.full_name) : ''}>
                        {topInstallmentEmp ? cleanEmployeeName(topInstallmentEmp.full_name) : '—'}
                    </div>
                    <div className="text-xs text-slate-500 font-mono font-medium mt-0.5 leading-normal">
                        {topInstallmentEmp ? `Mã NV: ${topInstallmentEmp.employee_id}` : 'Chưa có số liệu'}
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-blue-100/80 leading-normal">
                    <span className="text-blue-900/80 font-medium">Doanh thu trả chậm:</span>
                    <strong className="font-mono text-blue-700 font-bold text-sm">
                        {topInstallmentEmp ? `${topInstallmentEmp.installment_revenue.toLocaleString('vi-VN')} tr` : '0 tr'}
                    </strong>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 leading-normal">
                    <span>Tỷ lệ trả chậm:</span>
                    <span className={`font-mono font-extrabold ${topInstallmentEmp && topInstallmentEmp.installment_rate < 35 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {topInstallmentEmp ? `${topInstallmentEmp.installment_rate}%` : '0%'}
                    </span>
                </div>
            </div>
        </div>
    );
}
