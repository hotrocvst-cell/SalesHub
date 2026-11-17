import React, { useEffect, useRef } from 'react';
import type { BatchReportKey, BatchReportCustomOptions } from '../types';
import { BATCH_REPORT_OPTIONS } from '../constants';
import DailyReportExportCard from './renderers/DailyReportExportCard';
import EmployeePerformanceExportCard from './renderers/EmployeePerformanceExportCard';
import MonthlyReportExportCard from './renderers/MonthlyReportExportCard';
import CampaignSummaryExportCard from './renderers/CampaignSummaryExportCard';
import RevenueTrendExportCard from './renderers/RevenueTrendExportCard';
import type { BusinessDayRecord, CampaignDictItem } from '../../../core/lib/storage';
import type { EmployeePerformanceRow, StorePerformanceSummary } from '../../employee-performance/types';
import type { CampaignSummaryData } from '../../campaign-summary/types';
import { X, Download, Copy, Loader2, Check, MessageSquareText } from 'lucide-react';

interface Props {
    reportKey: BatchReportKey | null;
    onClose: () => void;
    selectedStore: string;
    selectedDate: string;
    selectedMonth: number;
    selectedYear: number;
    dailyRecord: BusinessDayRecord | null;
    performanceRows: EmployeePerformanceRow[];
    performanceSummary: StorePerformanceSummary | null;
    monthlyRecords: BusinessDayRecord[];
    campaignSummary: CampaignSummaryData | null;
    campaignDict?: CampaignDictItem[];
    trendRecords: BusinessDayRecord[];
    customOptions: BatchReportCustomOptions;
    onExportSingle: (key: BatchReportKey) => void;
    onCopySingle: (key: BatchReportKey) => void;
    onCopyRemarksSingle: (key: BatchReportKey) => void;
    isLoading: boolean;
    isCopied: boolean;
    isRemarksCopied: boolean;
}

export default function BatchExportPreviewModal({
    reportKey,
    onClose,
    selectedStore,
    selectedDate,
    selectedMonth,
    selectedYear,
    dailyRecord,
    performanceRows,
    performanceSummary,
    monthlyRecords,
    campaignSummary,
    campaignDict = [],
    trendRecords,
    customOptions,
    onExportSingle,
    onCopySingle,
    onCopyRemarksSingle,
    isLoading,
    isCopied,
    isRemarksCopied
}: Props) {
    const modalRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!reportKey) return null;

    const reportConfig = BATCH_REPORT_OPTIONS.find(item => item.key === reportKey);

    const renderCard = () => {
        switch (reportKey) {
            case 'DAILY_REPORT':
                return (
                    <DailyReportExportCard
                        record={dailyRecord}
                        selectedStore={selectedStore}
                        selectedDate={selectedDate}
                        mode={customOptions.daily.mode}
                        showTable={customOptions.daily.showTable}
                    />
                );
            case 'EMPLOYEE_PERFORMANCE':
                return (
                    <EmployeePerformanceExportCard
                        rows={performanceRows}
                        summary={performanceSummary}
                        selectedStore={selectedStore}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        showWorkHours={customOptions.employeePerformance.showWorkHours}
                        sortBy={customOptions.employeePerformance.sortBy}
                    />
                );
            case 'MONTHLY_REPORT':
                return (
                    <MonthlyReportExportCard
                        records={monthlyRecords}
                        selectedStore={selectedStore}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        viewMode={customOptions.monthly.viewMode}
                    />
                );
            case 'CAMPAIGN_SUMMARY':
                return (
                    <CampaignSummaryExportCard
                        campaignSummary={campaignSummary}
                        campaignDict={campaignDict}
                        selectedStore={selectedStore}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        scoringMode={customOptions.campaign.scoringMode}
                    />
                );
            case 'REVENUE_TREND':
                return (
                    <RevenueTrendExportCard
                        records={trendRecords}
                        selectedStore={selectedStore}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        showBarChart={customOptions.revenueTrend.showBarChart}
                        showDetailTable={customOptions.revenueTrend.showDetailTable}
                    />
                );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div
                ref={modalRef}
                className="bg-slate-100 rounded-3xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden font-sans"
            >
                {/* Header Modal */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 bg-white border-b border-slate-200">
                    <div>
                        <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                            Xem Trước Mẫu Ảnh Báo Cáo
                        </span>
                        <h3 className="text-base font-black text-slate-900">
                            {reportConfig?.name}
                        </h3>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Nút Sao Chép Nhận Xét trong Modal */}
                        <button
                            type="button"
                            onClick={() => onCopyRemarksSingle(reportKey)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
                            title="Sao chép nhận xét của báo cáo này"
                        >
                            {isRemarksCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                            ) : (
                                <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            <span>{isRemarksCopied ? 'Đã chép nhận xét' : 'Chép nhận xét'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onExportSingle(reportKey)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition cursor-pointer shadow-sm disabled:opacity-50"
                        >
                            {isLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            <span>Tải ảnh</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onCopySingle(reportKey)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition cursor-pointer"
                        >
                            {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                            ) : (
                                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            <span>{isCopied ? 'Đã sao chép' : 'Sao chép ảnh'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ml-1"
                            title="Đóng (ESC)"
                            aria-label="Đóng"
                        >
                            <X className="w-5 h-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {/* Vùng Render Nội Dung Báo Cáo (Khổ portrait dọc cuộn) */}
                <div className="flex-1 overflow-y-auto p-6 flex justify-center bg-slate-100">
                    <div className="shadow-lg rounded-2xl overflow-hidden bg-white">
                        {renderCard()}
                    </div>
                </div>
            </div>
        </div>
    );
}
