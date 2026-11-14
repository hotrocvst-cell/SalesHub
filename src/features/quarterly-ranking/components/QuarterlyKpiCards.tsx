import React from 'react';
import type { QuarterlySummary, QuarterlyTab } from '../types';
import {
    TrendingUp,
    Target,
    Award,
    Trophy,
    CheckCircle2,
    Users,
    Zap,
    Flame
} from 'lucide-react';

interface Props {
    summary: QuarterlySummary | null;
    tab: QuarterlyTab;
    dateLabel: string;
}

export default function QuarterlyKpiCards({ summary, tab, dateLabel }: Props) {
    if (!summary) return null;

    if (tab === 'REVENUE') {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {/* CARD 1: TỔNG DOANH THU QUÝ */}
                <div className="bg-gradient-to-br from-blue-50/70 to-white rounded-xl border border-blue-200/80 p-3 shadow-sm hover:shadow transition-shadow">
                    <div className="flex items-center justify-between gap-1 text-slate-500 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
                            Doanh thu Quý
                        </span>
                        <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1 text-slate-900">
                        <span className="text-lg sm:text-xl font-extrabold font-mono text-blue-800">
                            {Math.round(summary.totalRevenueQd).toLocaleString('vi-VN')}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">tr</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600 flex items-center justify-between gap-1">
                        <span>Target: <strong className="font-mono">{Math.round(summary.totalTargetRevenue).toLocaleString('vi-VN')}</strong> tr</span>
                        <span className={`font-black ${summary.avgCompletionRate >= 100 ? 'text-emerald-700' : 'text-blue-700'}`}>
                            {summary.avgCompletionRate}%
                        </span>
                    </div>
                </div>

                {/* CARD 2: TỶ LỆ NHÂN SỰ ĐẠT TARGET */}
                <div className="bg-gradient-to-br from-emerald-50/70 to-white rounded-xl border border-emerald-200/80 p-3 shadow-sm hover:shadow transition-shadow">
                    <div className="flex items-center justify-between gap-1 text-slate-500 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                            Nhân sự đạt Target
                        </span>
                        <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <Target className="w-3.5 h-3.5" aria-hidden="true" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1 text-slate-900">
                        <span className="text-lg sm:text-xl font-extrabold font-mono text-emerald-800">
                            {summary.achievedTargetCount}
                        </span>
                        <span className="text-xs font-bold text-slate-500">/ {summary.totalEmployees} NV</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600 flex items-center justify-between gap-1">
                        <span>Tỷ lệ hoàn thành:</span>
                        <span className="font-black text-emerald-700 font-mono">
                            {summary.achievedTargetPercent}%
                        </span>
                    </div>
                </div>

                {/* CARD 3: PHONG ĐỘ GIỮ CHUẨN */}
                <div className="bg-gradient-to-br from-indigo-50/70 to-white rounded-xl border border-indigo-200/80 p-3 shadow-sm hover:shadow transition-shadow">
                    <div className="flex items-center justify-between gap-1 text-slate-500 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                            Phong độ giữ chuẩn
                        </span>
                        <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1 text-slate-900">
                        <span className="text-lg sm:text-xl font-extrabold font-mono text-indigo-800">
                            {summary.consistentAchieverCount}
                        </span>
                        <span className="text-xs font-bold text-slate-500">NV đạt 100% các tháng</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600 flex items-center justify-between gap-1">
                        <span>Duy trì liên tục trong {dateLabel.split(' ')[0]}</span>
                    </div>
                </div>

                {/* CARD 4: QUÁN QUÂN DOANH THU */}
                <div className="bg-gradient-to-br from-amber-50/70 to-white rounded-xl border border-amber-200/80 p-3 shadow-sm hover:shadow transition-shadow">
                    <div className="flex items-center justify-between gap-1 text-slate-500 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                            🥇 Top 1 Doanh thu
                        </span>
                        <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                        </div>
                    </div>
                    <div className="truncate">
                        <span className="text-base sm:text-lg font-black text-amber-900">
                            {summary.top1RevenueEmployee?.name || '---'}
                        </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600 flex items-center justify-between gap-1">
                        <span className="font-mono font-bold text-amber-800">
                            {summary.top1RevenueEmployee ? `${Math.round(summary.top1RevenueEmployee.revenue).toLocaleString('vi-VN')} tr` : '0 tr'}
                        </span>
                        <span className="font-bold text-emerald-700">
                            {summary.top1RevenueEmployee ? `${summary.top1RevenueEmployee.rate}%` : ''}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // TAB EMULATION (THI ĐUA)
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* CARD 1: TỶ LỆ HOÀN THÀNH THI ĐUA TB */}
            <div className="bg-gradient-to-br from-amber-50/70 to-white rounded-xl border border-amber-200/80 p-3 shadow-sm hover:shadow transition-shadow">
                <div className="flex items-center justify-between gap-1 text-slate-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                        Thi đua trung bình
                    </span>
                    <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                    </div>
                </div>
                <div className="flex items-baseline gap-1 text-slate-900">
                    <span className="text-lg sm:text-xl font-extrabold font-mono text-amber-800">
                        {summary.avgEmulationRate}%
                    </span>
                    <span className="text-xs font-bold text-slate-500">hoàn thành</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-600 flex items-center justify-between gap-1">
                    <span>Đánh giá chung toàn cụm/ST</span>
                </div>
            </div>

            {/* CARD 2: TỔNG LƯỢT ĐẠT MỤC TIÊU THI ĐUA */}
            <div className="bg-gradient-to-br from-rose-50/70 to-white rounded-xl border border-rose-200/80 p-3 shadow-sm hover:shadow transition-shadow">
                <div className="flex items-center justify-between gap-1 text-slate-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-900">
                        Lượt đạt mục tiêu
                    </span>
                    <div className="w-6 h-6 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <Flame className="w-3.5 h-3.5" aria-hidden="true" />
                    </div>
                </div>
                <div className="flex items-baseline gap-1 text-slate-900">
                    <span className="text-lg sm:text-xl font-extrabold font-mono text-rose-800">
                        {summary.totalCampaignsAchieved}
                    </span>
                    <span className="text-xs font-bold text-slate-500">/ {summary.totalCampaignsTracked} lượt</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-600 flex items-center justify-between gap-1">
                    <span>Tổng thi đua giao toàn kỳ</span>
                </div>
            </div>

            {/* CARD 3: PHONG ĐỘ GIỮ CHUẨN THI ĐUA */}
            <div className="bg-gradient-to-br from-emerald-50/70 to-white rounded-xl border border-emerald-200/80 p-3 shadow-sm hover:shadow transition-shadow">
                <div className="flex items-center justify-between gap-1 text-slate-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                        Phong độ giữ chuẩn
                    </span>
                    <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </div>
                </div>
                <div className="flex items-baseline gap-1 text-slate-900">
                    <span className="text-lg sm:text-xl font-extrabold font-mono text-emerald-800">
                        {summary.consistentEmulationCount ?? summary.fullyAchievedEmulationCount}
                    </span>
                    <span className="text-xs font-bold text-slate-500">NV đạt chuẩn ≥60%</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-600 flex items-center justify-between gap-1">
                    <span>Duy trì ≥60% tất cả các tháng</span>
                </div>
            </div>

            {/* CARD 4: QUÁN QUÂN THI ĐUA */}
            <div className="bg-gradient-to-br from-purple-50/70 to-white rounded-xl border border-purple-200/80 p-3 shadow-sm hover:shadow transition-shadow">
                <div className="flex items-center justify-between gap-1 text-slate-500 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900">
                        🥇 Top 1 Thi Đua
                    </span>
                    <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                        <Award className="w-3.5 h-3.5" aria-hidden="true" />
                    </div>
                </div>
                <div className="truncate">
                    <span className="text-base sm:text-lg font-black text-purple-900">
                        {summary.top1EmulationEmployee?.name || '---'}
                    </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-600 flex items-center justify-between gap-1">
                    <span className="font-bold text-purple-800">
                        {summary.top1EmulationEmployee ? `${summary.top1EmulationEmployee.points}${summary.top1EmulationEmployee.target ? `/${summary.top1EmulationEmployee.target}` : ''} đạt` : ''}
                    </span>
                    <span className="font-bold text-emerald-700">
                        {summary.top1EmulationEmployee ? `${summary.top1EmulationEmployee.rate}%` : ''}
                    </span>
                </div>
            </div>
        </div>
    );
}

