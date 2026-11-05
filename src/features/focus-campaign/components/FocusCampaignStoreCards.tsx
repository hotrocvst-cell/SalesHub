import React from 'react';
import type { FocusStoreCampaignMetric } from '../types';
import { Target, Users, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
    storeMetrics: FocusStoreCampaignMetric[];
    storeName: string;
}

export default function FocusCampaignStoreCards({ storeMetrics, storeName }: Props) {
    if (!storeMetrics || storeMetrics.length === 0) {
        return (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-6 text-center text-slate-400 font-sans">
                Chưa có nhóm hàng thi đua nào được chọn trong bộ trọng tâm. Vui lòng chọn hoặc thêm nhóm hàng.
            </div>
        );
    }

    return (
        <div className="space-y-2.5 font-sans">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                    <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide">
                        Tiến Độ Lũy Kế ST ({storeName}) - {storeMetrics.length} Nhóm Hàng Trọng Tâm
                    </h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 italic">
                    *Số liệu lấy theo cập nhật lũy kế của ST
                </span>
            </div>

            {/* Grid Thẻ KPI - Tối ưu 1-2-3 cột mượt mà */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {storeMetrics.map((item) => {
                    const isPassed = item.forecastRate >= 100;
                    const isWarning = item.forecastRate >= 80 && item.forecastRate < 100;

                    const statusBg = isPassed
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                        : isWarning
                            ? 'bg-amber-50/70 border-amber-200 text-amber-800'
                            : 'bg-rose-50/70 border-rose-200 text-rose-800';

                    const barColor = isPassed
                        ? 'bg-emerald-500'
                        : isWarning
                            ? 'bg-amber-500'
                            : 'bg-rose-500';

                    return (
                        <div
                            key={item.campaignKey}
                            className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between hover:shadow-md transition"
                        >
                            {/* Header Thẻ */}
                            <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                                <div>
                                    <h4 className="text-xs sm:text-sm font-black text-slate-900 line-clamp-1" title={item.displayName}>
                                        {item.displayName}
                                    </h4>
                                    <span className="text-[10.5px] font-bold text-slate-400">
                                        Đơn vị: {item.unit}
                                    </span>
                                </div>
                                <span className={`text-[10.5px] font-black px-2 py-0.5 rounded-full border shrink-0 ${statusBg}`}>
                                    %DK: {item.forecastRate}%
                                </span>
                            </div>

                            {/* Số liệu ST (Target vs Lũy Kế) */}
                            <div className="py-2.5 space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Lũy kế ST:</span>
                                    <span className="font-mono font-black text-slate-900 text-sm">
                                        {item.storeActual.toLocaleString('vi-VN')}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Target ST:</span>
                                    <span className="font-mono font-bold text-slate-600">
                                        {item.storeTarget.toLocaleString('vi-VN')}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Còn thiếu:</span>
                                    <span className="font-mono font-bold text-rose-600">
                                        {item.storeRemaining.toLocaleString('vi-VN')}
                                    </span>
                                </div>

                                {/* Thanh Tiến Độ %DK */}
                                <div className="pt-1">
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                            style={{ width: `${Math.min(100, item.forecastRate)}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-semibold">
                                        <span>%HT: {item.completionRate}%</span>
                                        <span>{isPassed ? 'Đã đạt chỉ tiêu' : `Thiếu ${item.storeRemaining}`}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Thẻ: Tỷ lệ nhân sự đạt */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                                <div className="flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5 text-blue-500" />
                                    <span>NV đạt:</span>
                                    <span className="font-bold text-slate-800">
                                        {item.achievedEmployees}/{item.totalEmployeesWithTarget} NV
                                    </span>
                                </div>
                                <span className="font-black text-blue-600">
                                    {item.employeeAchieveRate}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

