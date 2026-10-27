import React from 'react';
import { formatValue, cleanEmployeeName, getShortenedEmployeeName } from '../../../core/lib/formatters';
import type { EmployeeCumulativeRankingRow, StoreCumulativeSummary, CumulativeRankingViewMode } from '../types';
import { Trophy, Medal, Award, User, Info, Building2 } from 'lucide-react';

interface CumulativeRankingTableProps {
    rows: EmployeeCumulativeRankingRow[];
    summary: StoreCumulativeSummary;
    viewMode: CumulativeRankingViewMode;
    showTarget: boolean;
    isMultiStore: boolean;
}

/**
 * Format ngày hiển thị dạng dd/MM (ví dụ 2026-10-05 -> 05/10)
 */
function formatShortDate(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
}

export default function CumulativeRankingTable({
    rows,
    summary,
    viewMode,
    showTarget,
    isMultiStore
}: CumulativeRankingTableProps) {
    const { dateList, storeCumulativeRevenue, storeDailyRevenue, storeTarget, storeCompletionRate, sumOfEmployeesCumulative, unassignedOrOnlineDiff } = summary;

    // Chiều rộng badge mã nhân viên tự động thích ứng theo mã dài nhất trong bảng để thẳng cột thẳng lề
    const maxIdLength = React.useMemo(() => {
        if (!rows || rows.length === 0) return 6;
        return Math.max(6, ...rows.map(r => String(r.employeeId || '').trim().length));
    }, [rows]);

    const renderRankBadge = (rank: number) => {
        if (rank === 1) {
            return (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-black text-[10px] border border-amber-300 shadow-2xs">
                    🥇 #1
                </span>
            );
        }
        if (rank === 2) {
            return (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-800 font-black text-[10px] border border-slate-300">
                    🥈 #2
                </span>
            );
        }
        if (rank === 3) {
            return (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-800 font-black text-[10px] border border-orange-300">
                    🥉 #3
                </span>
            );
        }
        return (
            <span className="text-[10px] font-black text-slate-500 font-mono">
                #{rank}
            </span>
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden" data-ranking-table-container="true">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px] sm:text-xs" data-ranking-table="true">
                    {/* TIÊU ĐỀ CỘT */}
                    <thead>
                        <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                            <th className="px-2 py-2.5 text-center w-12 sticky left-0 z-20 bg-slate-900 border-r border-slate-800">
                                Hạng
                            </th>
                            <th className="px-3 py-2.5 text-left min-w-[180px] sticky left-12 z-20 bg-slate-900 border-r border-slate-800">
                                Nhân viên
                            </th>

                            {isMultiStore && (
                                <th className="px-2 py-2.5 text-left min-w-[100px]">
                                    Siêu thị
                                </th>
                            )}

                            {showTarget && (
                                <th className="px-2.5 py-2.5 text-right min-w-[95px] text-amber-300 font-black bg-amber-950/70 border-x border-amber-600/30">
                                    {summary.targetSource === 'PERIOD' ? 'Target 🎯' : 'Target 🎯'}
                                </th>
                            )}

                            <th className="px-2.5 py-2.5 text-right min-w-[105px] text-emerald-300 font-black bg-slate-950/60">
                                Lũy Kế
                            </th>

                            {showTarget && (
                                <th className="px-2 py-2.5 text-center min-w-[65px] text-amber-300 font-extrabold">
                                    %HT
                                </th>
                            )}

                            <th className="px-2 py-2.5 text-right min-w-[65px] text-slate-300">
                                %ĐÓNG GÓP
                            </th>

                            {/* CÁC CỘT CHI TIẾT TỪNG NGÀY KHI CHẾ ĐỘ WITH_DAILY ĐƯỢC CHỌN */}
                            {viewMode === 'WITH_DAILY' && dateList.map((d) => (
                                <th
                                    key={d}
                                    className="px-1.5 py-2.5 text-right min-w-[70px] text-slate-300 font-medium whitespace-nowrap border-l border-slate-800"
                                >
                                    {formatShortDate(d)}
                                </th>
                            ))}

                            {viewMode === 'CUMULATIVE_ONLY' && (
                                <th className="px-2 py-2.5 text-center min-w-[70px] text-slate-300">
                                    Số ngày bán
                                </th>
                            )}
                        </tr>
                    </thead>

                    {/* DỮ LIỆU TỪNG NHÂN VIÊN */}
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={viewMode === 'WITH_DAILY' ? (isMultiStore ? 8 : 7) + dateList.length : (isMultiStore ? 8 : 7)}
                                    className="px-4 py-8 text-center text-slate-400 italic"
                                >
                                    Không có dữ liệu nhân viên nào trong khoảng thời gian đã chọn.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => {
                                const isTop3 = row.rank <= 3;
                                return (
                                    <tr
                                        key={row.employeeId || idx}
                                        className={`hover:bg-slate-50/90 transition-colors ${isTop3 ? 'bg-amber-50/20' : idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                                            }`}
                                    >
                                        {/* HẠNG */}
                                        <td className="px-2 py-2 text-center sticky left-0 z-10 bg-inherit border-r border-slate-100 whitespace-nowrap">
                                            {renderRankBadge(row.rank)}
                                        </td>

                                        {/* NHÂN VIÊN (MÃ NV BADGE CỐ ĐỊNH CHIỀU RỘNG + TÊN RÚT GỌN) */}
                                        <td className="px-3 py-2 text-left sticky left-12 z-10 bg-inherit border-r border-slate-100 whitespace-nowrap">
                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                <span
                                                    style={{ minWidth: `${maxIdLength + 2.2}ch`, width: `${maxIdLength + 2.2}ch` }}
                                                    className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                                                >
                                                    {row.employeeId}
                                                </span>
                                                <span
                                                    className="font-bold text-xs text-slate-900 transition"
                                                    title={`Mã NV: ${row.employeeId} - ${cleanEmployeeName(row.fullName)}`}
                                                >
                                                    {getShortenedEmployeeName(row.fullName)}
                                                </span>
                                            </div>
                                        </td>

                                        {/* SIÊU THỊ */}
                                        {isMultiStore && (
                                            <td className="px-2 py-2 text-slate-600 truncate max-w-[120px]">
                                                {row.storeName}
                                            </td>
                                        )}

                                        {/* TARGET - NỔI BẬT CAO */}
                                        {showTarget && (
                                            <td className="px-2 py-2 text-right bg-amber-50/60 border-x border-amber-200/50">
                                                {row.target > 0 ? (
                                                    <span className="inline-block font-black font-mono text-amber-950 bg-amber-200/80 border border-amber-400 px-2 py-0.5 rounded-lg text-xs shadow-2xs">
                                                        {formatValue(row.target)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-[10px] italic">Chưa giao</span>
                                                )}
                                            </td>
                                        )}

                                        {/* DOANH THU LŨY KẾ */}
                                        <td className="px-2.5 py-2 text-right font-black font-mono text-indigo-950 bg-indigo-50/40">
                                            {formatValue(row.cumulativeRevenue)}
                                        </td>

                                        {/* %HT */}
                                        {showTarget && (
                                            <td className="px-2 py-2 text-center font-mono">
                                                {row.target > 0 ? (
                                                    <span
                                                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${row.completionRate >= 100
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : row.completionRate >= 80
                                                                ? 'bg-blue-100 text-blue-800'
                                                                : 'bg-rose-100 text-rose-800'
                                                            }`}
                                                    >
                                                        {row.completionRate.toFixed(1)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-[10px]">-</span>
                                                )}
                                            </td>
                                        )}

                                        {/* % TỶ TRỌNG ĐÓNG GÓP */}
                                        <td className="px-2 py-2 text-right font-mono text-slate-600 font-semibold">
                                            {row.storeShareRate.toFixed(1)}%
                                        </td>

                                        {/* CÁC CỘT CHI TIẾT TỪNG NGÀY */}
                                        {viewMode === 'WITH_DAILY' && dateList.map((d) => {
                                            const dayRev = row.dailyRevenues[d] || 0;
                                            return (
                                                <td
                                                    key={d}
                                                    className={`px-1.5 py-2 text-right font-mono border-l border-slate-100 whitespace-nowrap ${dayRev > 0 ? 'text-slate-800 font-bold' : 'text-slate-300'
                                                        }`}
                                                >
                                                    {dayRev > 0 ? formatValue(dayRev) : '-'}
                                                </td>
                                            );
                                        })}

                                        {viewMode === 'CUMULATIVE_ONLY' && (
                                            <td className="px-2 py-2 text-center">
                                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                                                    {row.activeDaysCount} ngày
                                                </span>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>

                    {/* HÀNG SỐ TỔNG (SUMMARY FOOTER): SỐ TỔNG LÀ DỮ LIỆU LŨY KẾ CỦA SIÊU THỊ */}
                    <tfoot>
                        <tr className="bg-slate-900 text-white font-black border-t-2 border-indigo-400">
                            <td className="px-2 py-3 text-center sticky left-0 z-20 bg-slate-900 border-r border-slate-800">
                                🏢
                            </td>
                            <td className="px-3 py-3 text-left sticky left-12 z-20 bg-slate-900 text-amber-300 font-black whitespace-nowrap border-r border-slate-800">
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span
                                        style={{ minWidth: `${maxIdLength + 2.2}ch`, width: `${maxIdLength + 2.2}ch` }}
                                        className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 inline-block text-center leading-normal shrink-0"
                                    >
                                        TỔNG
                                    </span>
                                    <span className="text-xs uppercase tracking-wide">
                                        Lũy Kế Siêu Thị
                                    </span>
                                </div>
                            </td>

                            {isMultiStore && (
                                <td className="px-2 py-3 text-left text-slate-300 text-[10px]">
                                    (Chốt hệ thống)
                                </td>
                            )}

                            {showTarget && (
                                <td className="px-2 py-3 text-right font-black font-mono text-amber-300 bg-amber-950/60 border-x border-amber-700/40 text-xs sm:text-sm">
                                    {storeTarget > 0 ? (
                                        <span className="px-2 py-0.5 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300">
                                            {formatValue(storeTarget)}
                                        </span>
                                    ) : '-'}
                                </td>
                            )}

                            {/* DOANH THU LŨY KẾ CỦA SIÊU THỊ (SỐ TỔNG CHUẨN) */}
                            <td className="px-2.5 py-3 text-right font-mono text-emerald-300 text-xs sm:text-sm bg-slate-950">
                                {formatValue(storeCumulativeRevenue)}
                            </td>

                            {showTarget && (
                                <td className="px-2 py-3 text-center font-mono">
                                    {storeTarget > 0 ? (
                                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]">
                                            {storeCompletionRate.toFixed(1)}%
                                        </span>
                                    ) : (
                                        '-'
                                    )}
                                </td>
                            )}

                            <td className="px-2 py-3 text-right font-mono text-slate-300">
                                100%
                            </td>

                            {/* CHI TIẾT TỪNG NGÀY CỦA SIÊU THỊ */}
                            {viewMode === 'WITH_DAILY' && dateList.map((d) => {
                                const dayStoreRev = storeDailyRevenue[d] || 0;
                                return (
                                    <td
                                        key={d}
                                        className="px-1.5 py-3 text-right font-mono text-amber-300 border-l border-slate-800 whitespace-nowrap text-[11px]"
                                    >
                                        {dayStoreRev > 0 ? formatValue(dayStoreRev) : '-'}
                                    </td>
                                );
                            })}

                            {viewMode === 'CUMULATIVE_ONLY' && (
                                <td className="px-2 py-3 text-center text-[10px] text-slate-400">
                                    {dateList.length} ngày
                                </td>
                            )}
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
