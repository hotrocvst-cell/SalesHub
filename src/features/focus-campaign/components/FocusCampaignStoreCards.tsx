import React from 'react';
import type { FocusStoreCampaignMetric } from '../types';
import { Users, CheckCircle2 } from 'lucide-react';

interface Props {
    storeMetrics: FocusStoreCampaignMetric[];
    storeName: string;
}

export default function FocusCampaignStoreCards({ storeMetrics, storeName }: Props) {
    if (!storeMetrics || storeMetrics.length === 0) {
        return (
            <div className="bg-slate-50/70 border border-dashed border-slate-300 rounded-2xl p-6 text-center text-xs font-medium text-slate-600 font-sans">
                Chưa có nhóm hàng thi đua nào được chọn trong bộ trọng tâm. Vui lòng chọn hoặc thêm nhóm hàng.
            </div>
        );
    }

    return (
        <div className="space-y-2 font-sans" data-report-cards="true">
            <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0" aria-hidden="true" />
                    <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide truncate">
                        Tiến Độ Lũy Kế ST ({storeName}) - {storeMetrics.length} Nhóm Hàng Trọng Tâm
                    </h3>
                </div>
                <span className="text-[10.5px] font-semibold text-slate-600 italic hidden sm:inline shrink-0">
                    *Số liệu lấy theo cập nhật lũy kế của ST
                </span>
            </div>

            {/* Grid Thẻ KPI - Tối ưu Compact Mobile-First */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {storeMetrics.map((item) => {
                    const isPassed = item.forecastRate >= 100;
                    const isWarning = item.forecastRate >= 80 && item.forecastRate < 100;

                    const statusBg = isPassed
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : isWarning
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200';

                    const barColor = isPassed
                        ? 'bg-emerald-500'
                        : isWarning
                            ? 'bg-amber-500'
                            : 'bg-rose-500';

                    return (
                        <div
                            key={item.campaignKey}
                            className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-2.5 shadow-sm flex flex-col justify-between transition gap-1.5"
                        >
                            {/* Hàng 1: Tên nhóm hàng + Badge %DK */}
                            <div className="flex items-center justify-between gap-1.5">
                                <h4
                                    className="text-xs font-black text-slate-900 truncate flex-1"
                                    title={item.displayName}
                                >
                                    {item.displayName}
                                </h4>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 font-mono tabular-nums ${statusBg}`}>
                                    %DK: {item.forecastRate}%
                                </span>
                            </div>

                            {/* Hàng 2: Số liệu Thực tế / Target & Còn thiếu (Tự xuống dòng gọn khi số lớn) */}
                            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 pt-0.5">
                                <div className="flex items-baseline gap-1 min-w-0 whitespace-nowrap">
                                    <span className="font-mono tabular-nums font-black text-sm text-slate-900">
                                        {item.storeActual.toLocaleString('vi-VN')}
                                    </span>
                                    <span className="font-mono tabular-nums text-[11px] text-slate-600 font-bold">
                                        /{item.storeTarget.toLocaleString('vi-VN')}
                                    </span>
                                    <span className="text-[10px] text-slate-600 font-semibold">
                                        {item.unit}
                                    </span>
                                </div>

                                {item.storeRemaining > 0 ? (
                                    <span className="text-[10.5px] font-bold text-rose-700 font-mono tabular-nums bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md shrink-0">
                                        Thiếu {item.storeRemaining.toLocaleString('vi-VN')}
                                    </span>
                                ) : (
                                    <span className="text-[10.5px] font-bold text-emerald-700 font-mono tabular-nums bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md shrink-0 inline-flex items-center gap-0.5">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" aria-hidden="true" /> Đạt
                                    </span>
                                )}
                            </div>

                            {/* Hàng 3: Thanh tiến độ %DK */}
                            <div className="space-y-1 pt-0.5">
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                        style={{ width: `${Math.min(100, item.forecastRate)}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-600 font-medium">
                                    <span>
                                        %HT: <strong className="font-mono tabular-nums text-slate-800">{item.completionRate}%</strong>
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <Users className="w-3 h-3 text-blue-600 shrink-0" aria-hidden="true" />
                                        <span>NV đạt:</span>
                                        <strong className="font-mono tabular-nums text-slate-800">{item.achievedEmployees}/{item.totalEmployeesWithTarget}</strong>
                                        <span className="font-mono tabular-nums text-blue-700 font-bold">({item.employeeAchieveRate}%)</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

