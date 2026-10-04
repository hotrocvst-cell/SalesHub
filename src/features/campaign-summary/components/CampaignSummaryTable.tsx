import { useState } from 'react';
import type { CampaignSummaryRow } from '../types';
import { getCampaignLabel } from '../../../core/lib/formatters';
import type { CampaignDictItem } from '../../../core/lib/storage';
import { ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';

interface Props {
    rows: CampaignSummaryRow[];
    categories: string[];
    selectedCategoryFilter: string; // 'ALL' hoặc categoryName
    campaignDict?: CampaignDictItem[];
}

export default function CampaignSummaryTable({
    rows,
    categories,
    selectedCategoryFilter,
    campaignDict = []
}: Props) {
    const [sortField, setSortField] = useState<'stt' | 'achieved' | 'rate' | 'name'>('achieved');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Lọc danh sách cột ngành hàng hiển thị
    const displayedCategories = selectedCategoryFilter === 'ALL'
        ? categories
        : categories.filter(c => c === selectedCategoryFilter);

    // Xử lý sắp xếp khi click header
    const handleSort = (field: 'stt' | 'achieved' | 'rate' | 'name') => {
        if (sortField === field) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection(field === 'stt' ? 'asc' : 'desc');
        }
    };

    const sortedRows = [...rows].sort((a, b) => {
        let diff = 0;
        if (sortField === 'stt') diff = a.stt - b.stt;
        else if (sortField === 'achieved') diff = a.achieved_count - b.achieved_count;
        else if (sortField === 'rate') diff = a.achievement_rate - b.achievement_rate;
        else if (sortField === 'name') diff = a.full_name.localeCompare(b.full_name);
        return sortDirection === 'asc' ? diff : -diff;
    });

    return (
        <div data-report-table="true" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden font-avo">
            <div className="overflow-x-auto max-h-[750px] overflow-y-auto relative scrollbar-thin scrollbar-thumb-slate-300">
                <table className="w-full text-left text-xs border-collapse font-avo report-table">
                    {/* HÀNG TIÊU ĐỀ BẢNG:
                        - NỬA TRÁI (4 CỘT): XANH LỤC BẠCH NGỌC (STT, MSNV - Tên NV, Dự Kiến Đạt, %DKHT)
                        - NỬA PHẢI: VÀNG ẤM PASTEL HIỂN THỊ TÊN VIẾT TẮT THEO CẤU HÌNH KHAI BÁO
                    */}
                    <thead className="sticky top-0 z-30 shadow-xs select-none">
                        <tr className="text-xs h-[58px] align-middle">
                            {/* 1. STT */}
                            <th
                                onClick={() => handleSort('stt')}
                                className="py-2 px-2 text-center w-12 min-w-[50px] bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase cursor-pointer border-r border-emerald-500 sticky left-0 z-40 transition align-middle"
                                title="Bấm để sắp xếp theo STT"
                            >
                                <div className="flex items-center justify-center gap-1 min-h-[38px] leading-normal">
                                    <span>STT</span>
                                    {sortField === 'stt' ? (
                                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0" /> : <ArrowDown className="w-3 h-3 shrink-0" />
                                    ) : (
                                        <ArrowUpDown className="w-2.5 h-2.5 opacity-60 shrink-0" />
                                    )}
                                </div>
                            </th>

                            {/* 2. MSNV - TÊN NV VIẾT TẮT */}
                            <th
                                onClick={() => handleSort('name')}
                                className="py-2 px-3 min-w-[190px] bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider cursor-pointer border-r border-emerald-500 sticky left-[50px] z-40 transition align-middle"
                                title="Mã số nhân viên và tên rút gọn (Bấm để sắp xếp)"
                            >
                                <div className="flex items-center justify-center gap-1.5 min-h-[38px] leading-normal">
                                    <span>MSNV - Tên NV</span>
                                    {sortField === 'name' && (
                                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0" /> : <ArrowDown className="w-3 h-3 shrink-0" />
                                    )}
                                </div>
                            </th>

                            {/* 3. SỐ THI ĐUA DỰ KIẾN ĐẠT/TỔNG */}
                            <th
                                onClick={() => handleSort('achieved')}
                                className="py-2 px-2 text-center min-w-[110px] w-[110px] bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase cursor-pointer border-r border-emerald-500 sticky left-[240px] z-40 transition align-middle"
                                title="Số lượng ngành hàng thi đua dự kiến đạt (≥100%) trên tổng số ngành hàng"
                            >
                                <div className="flex items-center justify-center gap-1 min-h-[38px] leading-snug">
                                    <div className="text-center">
                                        <div>Dự kiến đạt</div>
                                        <div className="text-[10px] font-semibold opacity-90">/ Tổng</div>
                                    </div>
                                    {sortField === 'achieved' && (
                                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0" /> : <ArrowDown className="w-3 h-3 shrink-0" />
                                    )}
                                </div>
                            </th>

                            {/* 4. %DKHT (Tỷ lệ dự kiến hoàn thành) */}
                            <th
                                onClick={() => handleSort('rate')}
                                className="py-2 px-2 text-center min-w-[85px] w-[85px] bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase cursor-pointer border-r border-emerald-700 sticky left-[350px] z-40 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)] transition align-middle"
                                title="Tỷ lệ % Dự kiến hoàn thành số ngành hàng thi đua"
                            >
                                <div className="flex items-center justify-center gap-1 min-h-[38px] leading-normal">
                                    <span>%DKHT</span>
                                    {sortField === 'rate' && (
                                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0" /> : <ArrowDown className="w-3 h-3 shrink-0" />
                                    )}
                                </div>
                            </th>

                            {/* CÁC CỘT THI ĐUA - HIỂN THỊ TÊN VIẾT TẮT THEO CẤU HÌNH KHAI BÁO */}
                            {displayedCategories.map(cat => {
                                const shortLabel = getCampaignLabel(cat, campaignDict);
                                return (
                                    <th
                                        key={cat}
                                        className="py-2 px-2 text-center min-w-[95px] max-w-[130px] bg-[#fde047] text-slate-900 font-extrabold text-[11px] leading-snug border-r border-amber-300 uppercase select-none align-middle"
                                        title={`Tên đầy đủ: ${cat}`}
                                    >
                                        <div className="flex items-center justify-center min-h-[38px] leading-snug">
                                            <span className="line-clamp-2 break-words text-center font-black" title={cat}>
                                                {shortLabel}
                                            </span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>

                    {/* DỮ LIỆU CÁC DÒNG */}
                    <tbody className="divide-y divide-slate-100 font-medium text-xs">
                        {sortedRows.map((row) => (
                            <tr
                                key={row.employee_id}
                                className="hover:bg-slate-50 transition group"
                            >
                                {/* 1. STT */}
                                <td className="py-2.5 px-2 text-center font-bold text-slate-700 bg-white group-hover:bg-slate-50 border-r border-slate-200 sticky left-0 z-20">
                                    {row.stt}
                                </td>

                                {/* 2. MSNV - TÊN NV VIẾT TẮT */}
                                <td className="py-2.5 px-3 font-black text-slate-900 bg-white group-hover:bg-slate-50 border-r border-slate-200 sticky left-[50px] z-20 whitespace-nowrap">
                                    <span
                                        className="cursor-help"
                                        title={`Họ và tên đầy đủ: ${row.full_name} • Mã NV: ${row.employee_id}`}
                                    >
                                        {row.display_name}
                                    </span>
                                </td>

                                {/* 3. SỐ THI ĐUA DỰ KIẾN ĐẠT/TỔNG (ví dụ: 15/39) */}
                                <td className="py-2.5 px-2 text-center font-mono font-black text-slate-900 bg-white group-hover:bg-slate-50 border-r border-slate-200 sticky left-[240px] z-20 whitespace-nowrap min-w-[110px] w-[110px]">
                                    {row.achieved_count}/{row.total_count}
                                </td>

                                {/* 4. %DKHT (ví dụ: 38.5%) */}
                                <td className="py-2.5 px-2 text-center font-mono font-black text-rose-700 bg-white group-hover:bg-slate-50 border-r border-slate-200 sticky left-[350px] z-20 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap min-w-[85px] w-[85px]">
                                    {row.achievement_rate}%
                                </td>

                                {/* CÁC Ô %DKHT CỦA TỪNG THI ĐUA */}
                                {displayedCategories.map(cat => {
                                    const val = row.campaign_rates[cat] ?? 0;
                                    const isAchieved = val >= 100;
                                    const isLow = val < 50;

                                    return (
                                        <td
                                            key={cat}
                                            className={`py-2.5 px-2 text-center font-mono text-xs border-r border-slate-100 transition whitespace-nowrap ${
                                                isAchieved
                                                    ? 'bg-[#d1fae5] text-[#065f46] font-black'
                                                    : isLow
                                                    ? 'bg-[#ffe4e6] text-[#9f1239] font-black'
                                                    : 'bg-white text-slate-800 font-bold'
                                            }`}
                                        >
                                            {val}%
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
