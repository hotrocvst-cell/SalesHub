import React from 'react';
import type { CampaignSummaryData } from '../../../campaign-summary/types';
import type { CampaignDictItem } from '../../../../core/lib/storage';
import CampaignSummaryTable from '../../../campaign-summary/components/CampaignSummaryTable';
import { getShortStoreName } from '../../../../core/lib/formatters';
import { Trophy } from 'lucide-react';

interface Props {
    campaignSummary: CampaignSummaryData | null;
    campaignDict?: CampaignDictItem[];
    selectedStore: string;
    selectedMonth: number;
    selectedYear: number;
    scoringMode?: 'COUNT' | 'POINTS';
}

export default function CampaignSummaryExportCard({
    campaignSummary,
    campaignDict = [],
    selectedStore,
    selectedMonth,
    selectedYear,
    scoringMode = 'COUNT'
}: Props) {
    const storeLabel = getShortStoreName(selectedStore);

    const rows = campaignSummary?.rows || [];
    const categories = campaignSummary?.categories || [];

    if (!campaignSummary || rows.length === 0) {
        return (
            <div className="w-[880px] bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2 font-avo">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <Trophy className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-800 uppercase">
                    Tiến Độ Thi Đua Trọng Tâm • ST {storeLabel}
                </h3>
                <p className="text-xs text-slate-500">
                    Chưa có phiên dữ liệu thi đua trọng tâm trong tháng {selectedMonth}/{selectedYear}.
                </p>
            </div>
        );
    }

    const avgRate = Number((rows.reduce((sum, r) => sum + r.achievement_rate, 0) / (rows.length || 1)).toFixed(1));
    const topPerformer = [...rows].sort((a, b) => b.achievement_rate - a.achievement_rate)[0];

    // Cập nhật scoringMode vào rows nếu có ghi đè
    const processedRows = rows.map(r => ({
        ...r,
        scoring_mode: scoringMode
    }));

    return (
        <div
            data-report-table="true"
            className="w-[880px] bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 font-avo text-slate-800"
        >
            {/* Header Báo Cáo Chuẩn CampaignSummary */}
            <div className="text-center pb-3 border-b-2 border-amber-500">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black uppercase tracking-wider">
                        TIẾN ĐỘ THI ĐUA TRỌNG TÂM
                    </div>
                </div>
                <h2 className="text-xl font-black text-amber-700 uppercase tracking-wide">
                    ST: {storeLabel}
                </h2>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Kỳ số liệu: Tháng {selectedMonth}/{selectedYear} • {campaignSummary.mode_label || 'DỰ KIẾN'}
                    {scoringMode === 'POINTS' ? ' • Chế độ tính theo ĐIỂM SỐ' : ' • Chế độ tính theo SỐ NGÀNH ĐẠT'}
                </p>
            </div>

            {/* Khối KPI Thi Đua */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-amber-50/80 rounded-xl p-3 border border-amber-200/90 text-center">
                    <div className="text-[11px] font-bold text-amber-700 uppercase">Nhân Sự Tham Gia</div>
                    <div className="text-lg font-black text-amber-900 tabular-nums mt-0.5">
                        {rows.length} <span className="text-xs font-normal">nhân sự</span>
                    </div>
                </div>

                <div className="bg-blue-50/80 rounded-xl p-3 border border-blue-200/90 text-center">
                    <div className="text-[11px] font-bold text-blue-700 uppercase">Ngành Hàng Thi Đua</div>
                    <div className="text-lg font-black text-blue-900 tabular-nums mt-0.5">
                        {categories.length} <span className="text-xs font-normal">ngành</span>
                    </div>
                </div>

                <div className="bg-emerald-50/80 rounded-xl p-3 border border-emerald-200/90 text-center">
                    <div className="text-[11px] font-bold text-emerald-700 uppercase">% Đạt Bình Quân</div>
                    <div className="text-lg font-black text-emerald-900 tabular-nums mt-0.5">
                        {avgRate}%
                    </div>
                </div>

                <div className="bg-purple-50/80 rounded-xl p-3 border border-purple-200/90 text-center">
                    <div className="text-[11px] font-bold text-purple-700 uppercase">Dẫn Đầu Thi Đua</div>
                    <div className="text-sm font-black text-purple-900 truncate mt-1">
                        {topPerformer ? topPerformer.display_name?.split('-')[1]?.trim() || topPerformer.full_name : '---'}
                    </div>
                    {topPerformer && (
                        <span className="text-[10px] font-bold text-purple-600 tabular-nums">
                            {topPerformer.achievement_rate}%
                        </span>
                    )}
                </div>
            </div>

            {/* Bảng Ma Trận Tiến Độ (Tái sử dụng trực tiếp CampaignSummaryTable của phân hệ thi đua) */}
            <div className="font-avo">
                <CampaignSummaryTable
                    rows={processedRows}
                    categories={categories}
                    selectedCategoryFilter="ALL"
                    campaignDict={campaignDict}
                />
            </div>
        </div>
    );
}
