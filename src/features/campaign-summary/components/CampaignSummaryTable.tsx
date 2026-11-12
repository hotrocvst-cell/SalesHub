import { useState, useMemo, type KeyboardEvent } from 'react';
import type { CampaignSummaryRow } from '../types';
import { getCampaignLabel, cleanEmployeeName, getShortenedEmployeeName } from '../../../core/lib/formatters';
import type { CampaignDictItem } from '../../../core/lib/storage';
import { ArrowUpDown, ArrowDown, ArrowUp, Search } from 'lucide-react';

interface Props {
    rows: CampaignSummaryRow[];
    categories: string[];
    selectedCategoryFilter: string; // 'ALL' hoặc categoryName
    campaignDict?: CampaignDictItem[];
    searchQuery?: string;
    onClearSearch?: () => void;
}

export default function CampaignSummaryTable({
    rows,
    categories,
    selectedCategoryFilter,
    campaignDict = [],
    searchQuery = '',
    onClearSearch
}: Props) {
    const [sortField, setSortField] = useState<'stt' | 'achieved' | 'rate' | 'name'>('achieved');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Chiều rộng badge mã nhân viên tự động thích ứng theo mã dài nhất trong bảng để thẳng cột thẳng lề
    const maxIdLength = useMemo(() => {
        if (!rows || rows.length === 0) return 6;
        return Math.max(6, ...rows.map(r => String(r.employee_id || '').trim().length));
    }, [rows]);

    // Lọc danh sách cột ngành hàng hiển thị
    const displayedCategories = selectedCategoryFilter === 'ALL'
        ? categories
        : categories.filter(c => c === selectedCategoryFilter);

    const isPointsMode = rows.length > 0 && rows[0].scoring_mode === 'POINTS';

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
        else if (sortField === 'achieved') {
            if (isPointsMode) {
                diff = (a.achieved_points ?? 0) - (b.achieved_points ?? 0);
            } else {
                diff = a.achieved_count - b.achieved_count;
            }
        }
        else if (sortField === 'rate') diff = a.achievement_rate - b.achievement_rate;
        else if (sortField === 'name') diff = a.full_name.localeCompare(b.full_name);
        return sortDirection === 'asc' ? diff : -diff;
    });

    if (sortedRows.length === 0) {
        return (
            <div data-report-table="true" className="bg-slate-50/80 rounded-2xl border border-slate-200 p-8 text-center space-y-3 font-sans">
                <div className="w-10 h-10 rounded-full bg-slate-200/70 text-slate-600 flex items-center justify-center mx-auto">
                    <Search className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">
                        {searchQuery.trim()
                            ? `Không tìm thấy nhân viên nào khớp "${searchQuery.trim()}"`
                            : 'Không có dữ liệu nhân viên để hiển thị.'}
                    </p>
                    <p className="text-xs text-slate-600">
                        Vui lòng kiểm tra lại từ khóa hoặc bộ lọc ngành hàng hiện tại.
                    </p>
                </div>
                {searchQuery.trim() && onClearSearch && (
                    <button
                        type="button"
                        onClick={onClearSearch}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                        Xóa tìm kiếm
                    </button>
                )}
            </div>
        );
    }

    const handleKeySort = (e: KeyboardEvent<HTMLTableCellElement>, field: 'stt' | 'achieved' | 'rate' | 'name') => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSort(field);
        }
    };

    return (
        <div data-report-table="true" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden font-avo">
            <div
                data-html2canvas-ignore="true"
                data-export-ignore="true"
                className="flex md:hidden items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-600 font-sans"
            >
                <span>Bảng tổng hợp {displayedCategories.length} ngành hàng</span>
                <span className="text-emerald-700 font-bold">Vuốt ngang →</span>
            </div>
            <div className="overflow-x-auto max-h-[750px] overflow-y-auto relative scrollbar-thin scrollbar-thumb-slate-300">
                <table className="w-full text-left text-xs border-collapse font-avo report-table">
                    {/* HÀNG TIÊU ĐỀ BẢNG:
                        - NỬA TRÁI (4 CỘT): XANH LỤC BẠCH NGỌC (STT, MSNV - Tên NV, Dự Kiến Đạt, %DKHT), chỉ cố định từ md+ để không khóa cuộn trên mobile 375px
                        - NỬA PHẢI: VÀNG ẤM PASTEL HIỂN THỊ TÊN VIẾT TẮT THEO CẤU HÌNH KHAI BÁO
                    */}
                    <thead className="sticky top-0 z-30 shadow-sm select-none">
                        <tr className="text-xs h-[58px] align-middle">
                            {/* 1. STT */}
                            <th
                                tabIndex={0}
                                role="button"
                                onClick={() => handleSort('stt')}
                                onKeyDown={e => handleKeySort(e, 'stt')}
                                className="py-2 px-2 text-center w-12 min-w-[50px] bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase cursor-pointer border-r border-emerald-500 md:sticky md:left-0 md:z-40 transition align-middle outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                                title="Bấm để sắp xếp theo STT"
                            >
                                <div className="flex items-center justify-center gap-1 min-h-[38px] leading-normal">
                                    <span>STT</span>
                                    {sortField === 'stt' ? (
                                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0" aria-hidden="true" /> : <ArrowDown className="w-3 h-3 shrink-0" aria-hidden="true" />
                                    ) : (
                                        <ArrowUpDown className="w-2.5 h-2.5 opacity-60 shrink-0" aria-hidden="true" />
                                    )}
                                </div>
                            </th>

                            {/* 2. NHÂN VIÊN */}
                            <th
                                tabIndex={0}
                                role="button"
                                onClick={() => handleSort('name')}
                                onKeyDown={e => handleKeySort(e, 'name')}
                                className="py-2 px-3 min-w-[190px] bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider cursor-pointer border-r border-emerald-500 md:sticky md:left-[50px] md:z-40 transition align-middle outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                                title="Nhân viên (Bấm để sắp xếp)"
                            >
                                <div className="flex items-center justify-center gap-1.5 min-h-[38px] leading-normal">
                                    <span>NHÂN VIÊN</span>
                                    {sortField === 'name' && (
                                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0" aria-hidden="true" /> : <ArrowDown className="w-3 h-3 shrink-0" aria-hidden="true" />
                                    )}
                                </div>
                            </th>

                            {/* 3. SỐ THI ĐUA DỰ KIẾN ĐẠT/TỔNG HOẶC ĐIỂM DỰ KIẾN */}
                            <th
                                tabIndex={0}
                                role="button"
                                onClick={() => handleSort('achieved')}
                                onKeyDown={e => handleKeySort(e, 'achieved')}
                                className="py-2 px-2 text-center min-w-[110px] w-[110px] bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase cursor-pointer border-r border-emerald-500 md:sticky md:left-[240px] md:z-40 transition align-middle outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                                title={isPointsMode ? 'Điểm thi đua dự kiến đạt (≥100%) trên tổng điểm tối đa' : 'Số lượng ngành hàng thi đua dự kiến đạt (≥100%) trên tổng số ngành hàng'}
                            >
                                <div className="flex items-center justify-center gap-1 min-h-[38px] leading-snug">
                                    <div className="text-center">
                                        <div>{isPointsMode ? 'Điểm DK' : 'DK đạt'}</div>
                                    </div>
                                    {sortField === 'achieved' && (
                                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0" aria-hidden="true" /> : <ArrowDown className="w-3 h-3 shrink-0" aria-hidden="true" />
                                    )}
                                </div>
                            </th>

                            {/* 4. %DKHT (Tỷ lệ dự kiến hoàn thành) */}
                            <th
                                tabIndex={0}
                                role="button"
                                onClick={() => handleSort('rate')}
                                onKeyDown={e => handleKeySort(e, 'rate')}
                                className="py-2 px-2 text-center min-w-[85px] w-[85px] bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase cursor-pointer border-r border-emerald-700 md:sticky md:left-[350px] md:z-40 md:shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)] transition align-middle outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                                title="Tỷ lệ % Dự kiến hoàn thành số ngành hàng thi đua"
                            >
                                <div className="flex items-center justify-center gap-1 min-h-[38px] leading-normal">
                                    <span>%DKHT</span>
                                    {sortField === 'rate' && (
                                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0" aria-hidden="true" /> : <ArrowDown className="w-3 h-3 shrink-0" aria-hidden="true" />
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
                                <td className="py-2.5 px-2 text-center font-bold tabular-nums text-slate-700 bg-white group-hover:bg-slate-50 border-r border-slate-200 md:sticky md:left-0 md:z-20">
                                    {row.stt}
                                </td>

                                {/* 2. NHÂN VIÊN */}
                                <td className="py-2.5 px-3 font-black text-slate-900 bg-white group-hover:bg-slate-50 border-r border-slate-200 md:sticky md:left-[50px] md:z-20 whitespace-nowrap">
                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                        <span
                                            style={{ minWidth: `${maxIdLength + 2.2}ch`, width: `${maxIdLength + 2.2}ch` }}
                                            className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                                        >
                                            {row.employee_id}
                                        </span>
                                        <span
                                            title={`Mã NV: ${row.employee_id} - ${cleanEmployeeName(row.full_name || row.display_name)}`}
                                            className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition"
                                        >
                                            {getShortenedEmployeeName(row.full_name || row.display_name)}
                                        </span>
                                    </div>
                                </td>

                                {/* 3. SỐ THI ĐUA DỰ KIẾN ĐẠT/TỔNG (ví dụ: 15/39 hoặc 12/18 đ) */}
                                <td className="py-2.5 px-2 text-center font-mono tabular-nums font-black text-slate-900 bg-white group-hover:bg-slate-50 border-r border-slate-200 md:sticky md:left-[240px] md:z-20 whitespace-nowrap min-w-[110px] w-[110px]">
                                    {isPointsMode
                                        ? (
                                            <span
                                                title={row.bonus_points && row.bonus_points > 0
                                                    ? `Điểm ngành hàng: ${((row.achieved_points ?? 0) - row.bonus_points).toFixed(1)} đ + Điểm thưởng QL: +${row.bonus_points} đ = ${row.achieved_points} đ`
                                                    : undefined}
                                                className="inline-flex items-center justify-center gap-0.5"
                                            >
                                                <span>{row.achieved_points ?? 0}/{row.total_points ?? 0} đ</span>
                                                {row.bonus_points && row.bonus_points > 0 ? (
                                                    <span className="text-[10px] text-amber-600 font-black cursor-help" title={`Đã cộng +${row.bonus_points}đ điểm thưởng`}>⭐</span>
                                                ) : null}
                                            </span>
                                        )
                                        : (
                                            <span
                                                title={row.bonus_points && row.bonus_points > 0
                                                    ? `Đạt chuẩn: ${Number(((row.achieved_count ?? 0) - row.bonus_points).toFixed(1))} NH + Thưởng: +${row.bonus_points}đ = ${row.achieved_count} NH`
                                                    : undefined}
                                                className="inline-flex items-center justify-center gap-0.5"
                                            >
                                                <span>{row.achieved_count}/{row.total_count}</span>
                                                {row.bonus_points && row.bonus_points > 0 ? (
                                                    <span className="text-[10px] text-amber-600 font-black cursor-help" title={`Đã cộng +${row.bonus_points}đ điểm thưởng`}>⭐</span>
                                                ) : null}
                                            </span>
                                        )
                                    }
                                </td>

                                {/* 4. %DKHT (ví dụ: 38.5%) */}
                                <td className="py-2.5 px-2 text-center font-mono tabular-nums font-black text-rose-700 bg-white group-hover:bg-slate-50 border-r border-slate-200 md:sticky md:left-[350px] md:z-20 md:shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap min-w-[85px] w-[85px]">
                                    {row.achievement_rate}%
                                </td>

                                {/* CÁC Ô %DKHT CỦA TỪNG THI ĐUA */}
                                {displayedCategories.map(cat => {
                                    const val = row.campaign_rates[cat] ?? 0;
                                    const isAchieved = val >= 100;
                                    const isLow = val < 50;
                                    const offsetQty = row.campaign_offsets?.[cat] || 0;
                                    const tooltipText = offsetQty !== 0
                                        ? `Dự kiến: ${val}% (Đã điều chỉnh cấn trừ: ${offsetQty > 0 ? `+${offsetQty}` : offsetQty} sp)`
                                        : undefined;

                                    return (
                                        <td
                                            key={cat}
                                            title={tooltipText}
                                            className={`py-2 px-1.5 text-center font-mono tabular-nums text-xs border-r border-slate-100 transition whitespace-nowrap ${isAchieved
                                                ? 'bg-[#d1fae5] text-[#065f46] font-black'
                                                : isLow
                                                    ? 'bg-[#ffe4e6] text-[#9f1239] font-black'
                                                    : 'bg-white text-slate-800 font-bold'
                                                }`}
                                        >
                                            <div className="inline-flex items-center justify-center gap-1">
                                                <span>{val}%</span>
                                                {offsetQty > 0 && (
                                                    <span className="text-[9px] px-1 py-0.5 rounded font-extrabold bg-purple-100 text-purple-800 border border-purple-200 leading-tight" title={`Được nhận cấn trừ +${offsetQty} sản phẩm`}>
                                                        +{offsetQty}
                                                    </span>
                                                )}
                                                {offsetQty < 0 && (
                                                    <span className="text-[9px] px-1 py-0.5 rounded font-extrabold bg-amber-100 text-amber-800 border border-amber-200 leading-tight" title={`Đã cấn trừ sang ngành khác ${offsetQty} sản phẩm`}>
                                                        {offsetQty}
                                                    </span>
                                                )}
                                            </div>
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
