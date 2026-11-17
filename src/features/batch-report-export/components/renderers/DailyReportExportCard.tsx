import React, { useMemo } from 'react';
import type { BusinessDayRecord } from '../../../../core/lib/storage';
import { formatValue, getShortStoreName, formatDate } from '../../../../core/lib/formatters';
import DailyRealtimeTable from '../../../daily-report/components/DailyRealtimeTable';
import type { CampaignItem } from '../../../daily-report/utils/dailyReportParsers';
import { Zap } from 'lucide-react';

interface Props {
    record: BusinessDayRecord | null;
    selectedStore: string;
    selectedDate: string;
    mode?: 'realtime' | 'remaining';
    showTable?: boolean;
}

export default function DailyReportExportCard({
    record,
    selectedStore,
    selectedDate,
    mode = 'realtime',
    showTable = true
}: Props) {
    const storeLabel = getShortStoreName(selectedStore);

    if (!record) {
        return (
            <div className="w-[880px] bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2 font-avo">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-800 uppercase">
                    Báo Cáo Doanh Thu Ngày • ST {storeLabel}
                </h3>
                <p className="text-xs text-slate-500">
                    Chưa có số liệu kinh doanh được nạp cho ngày {selectedDate.split('-').reverse().join('/')}.
                </p>
            </div>
        );
    }

    const revReal = record.revenueActual || 0;
    const revQd = record.revenueActual || 0;
    const target = record.revenueTarget || 0;
    const inst = record.revenueInstallment || 0;
    const instRate = record.installmentRate || (revReal > 0 ? Number(((inst / revReal) * 100).toFixed(1)) : 0);

    const emulationEntries = Object.entries(record.emulationSummary || {});
    const passedCount = emulationEntries.filter(([_, v]) => (v.pctDK || 0) >= 100).length;
    const totalCount = emulationEntries.length;
    const passRate = totalCount > 0 ? Number(((passedCount / totalCount) * 100).toFixed(1)) : 0;

    // Chuyển emulationSummary thành danh sách CampaignItem cho DailyRealtimeTable
    const campaignsList: CampaignItem[] = useMemo(() => {
        return emulationEntries.map(([label, val]) => ({
            label,
            store: selectedStore,
            shortName: storeLabel,
            target: val.target,
            actual: val.actual,
            pctHT: val.pctHT ?? val.pctDK ?? 0,
            pctDK: val.pctDK ?? 0
        })).sort((a, b) => b.pctHT - a.pctHT);
    }, [emulationEntries, selectedStore, storeLabel]);

    return (
        <div
            data-report-table="true"
            className="w-[880px] bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 font-avo text-slate-800"
        >
            {/* Header Báo Cáo Chuẩn DailyReportPage */}
            <div className="text-center pb-3 border-b-2 border-blue-600">
                <h2 className="text-xl font-black text-blue-700 uppercase tracking-wide">
                    {selectedStore === 'Tổng' ? 'TỔNG TOÀN CỤM' : `ST: ${storeLabel}`}
                </h2>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-0.5">
                    {mode === 'remaining'
                        ? `🎯 BÁO CÁO REALTIME - MỤC TIÊU CÒN LẠI • NGÀY ${selectedDate.split('-').reverse().join('/')}`
                        : `⚡ BÁO CÁO DOANH THU & THI ĐUA REALTIME • NGÀY ${selectedDate.split('-').reverse().join('/')}`
                    }
                </p>
            </div>

            {/* THẺ CHỈ SỐ KPI TỔNG HỢP CHUẨN DAILY REPORT */}
            <div data-kpi-grid="true" className="grid grid-cols-4 gap-2.5 text-center">
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 shadow-sm">
                    <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">DOANH THU QĐ</span>
                    <span className="text-lg font-black text-slate-900 font-mono tabular-nums">
                        {formatValue(revQd)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-bold">
                        Target: {formatValue(target)} tr
                    </span>
                </div>

                <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-2.5 shadow-sm">
                    <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">DT TRẢ GÓP</span>
                    <span className="text-lg font-black text-slate-900 font-mono tabular-nums">
                        {formatValue(inst)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-bold">
                        triệu đồng
                    </span>
                </div>

                <div className="bg-slate-50 border border-slate-300 rounded-xl p-2.5 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">% TRẢ GÓP</span>
                    <span className="text-lg font-black text-slate-900 font-mono tabular-nums">
                        {instRate}%
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-bold">
                        trên DT thực
                    </span>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 shadow-sm">
                    <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">MỤC ĐẠT THI ĐUA</span>
                    <span className="text-lg font-black text-emerald-800 font-mono tabular-nums">
                        {passedCount} / {totalCount}
                    </span>
                    <span className="text-[10px] text-slate-600 font-bold block mt-0.5 tabular-nums">
                        %HT: {passRate}%
                    </span>
                </div>
            </div>

            {/* BẢNG THI ĐUA REALTIME (Tái sử dụng trực tiếp DailyRealtimeTable) */}
            {showTable && campaignsList.length > 0 && (
                <div className="font-avo">
                    <DailyRealtimeTable
                        campaigns={campaignsList}
                        isPointsEnabled={false}
                        isLoading={false}
                    />
                </div>
            )}
        </div>
    );
}
