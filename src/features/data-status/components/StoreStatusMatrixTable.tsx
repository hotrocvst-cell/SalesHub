import { useState, useMemo } from 'react';
import {
    Search,
    CheckCircle2,
    AlertTriangle,
    Store,
    ArrowUpDown,
    Check,
    Clock
} from 'lucide-react';
import type { StoreMatrixRow } from '../types';
import { getShortStoreName, formatDate } from '../../../core/lib/formatters';

interface StoreStatusMatrixTableProps {
    matrix: StoreMatrixRow[];
    expectedDate: string;
}

export default function StoreStatusMatrixTable({ matrix, expectedDate }: StoreStatusMatrixTableProps) {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [filterOnlyWarning, setFilterOnlyWarning] = useState<boolean>(false);
    const [sortBy, setSortBy] = useState<'name' | 'score'>('score');

    // Lọc và sắp xếp
    const filteredRows = useMemo(() => {
        let result = matrix.filter(row => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const nameMatch = row.storeName.toLowerCase().includes(q);
                const codeMatch = row.storeCode?.toLowerCase().includes(q);
                if (!nameMatch && !codeMatch) return false;
            }
            if (filterOnlyWarning && row.allOk) {
                return false;
            }
            return true;
        });

        if (sortBy === 'score') {
            result.sort((a, b) => a.readinessScore - b.readinessScore); // Ưu tiên các siêu thị chưa xong lên trước
        } else {
            result.sort((a, b) => a.storeName.localeCompare(b.storeName));
        }

        return result;
    }, [matrix, searchQuery, filterOnlyWarning, sortBy]);

    // Đếm số siêu thị đã hoàn tất 100%
    const fullyReadyCount = useMemo(() => matrix.filter(r => r.allOk).length, [matrix]);

    const renderStatusBadge = (isOk: boolean, dateVal?: string | null, countVal?: number) => {
        if (isOk) {
            return (
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white shadow-2xs text-[11px] font-black">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>OK</span>
                </div>
            );
        }
        return (
            <div
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs text-[10px] font-bold"
                title={dateVal ? `Phiên gần nhất: ${dateVal}` : 'Chưa có dữ liệu'}
            >
                <Clock className="w-2.5 h-2.5 text-amber-700 stroke-[2.5]" />
                <span className="truncate max-w-[65px]">
                    {dateVal ? formatDate(dateVal, 'dd/mm') : 'Thiếu'}
                </span>
            </div>
        );
    };

    return (
        <div className="rounded-2xl border-2 border-slate-300/80 bg-white shadow-lg overflow-hidden">
            {/* Header công cụ tìm kiếm và lọc: Executive Dark Console Banner */}
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-700">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                        <Store className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-sm sm:text-base text-white uppercase tracking-tight">
                                Chi Tiết Siêu Thị
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 uppercase tracking-wider">
                                {fullyReadyCount}/{matrix.length} ST OK
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-300 font-medium">
                            Rà soát dữ liệu theo từng siêu thị
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Ô tìm kiếm */}
                    <div className="relative min-w-[160px] flex-1 sm:flex-initial">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Tìm siêu thị..."
                            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl border border-slate-700 bg-slate-800/90 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-white placeholder-slate-400 font-medium shadow-inner"
                        />
                    </div>

                    {/* Nút lọc chỉ xem chưa hoàn tất */}
                    <button
                        onClick={() => setFilterOnlyWarning(!filterOnlyWarning)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${filterOnlyWarning
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-amber-500/30'
                            : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white'
                            }`}
                    >
                        <AlertTriangle className={`w-3.5 h-3.5 ${filterOnlyWarning ? 'text-slate-950' : 'text-amber-400'}`} />
                        <span>Chưa đủ phiên</span>
                    </button>

                    {/* Đổi thứ tự sắp xếp */}
                    <button
                        onClick={() => setSortBy(sortBy === 'score' ? 'name' : 'score')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800/90 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                        title="Đổi cách sắp xếp"
                    >
                        <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{sortBy === 'score' ? 'Ưu tiên thiếu' : 'Theo tên'}</span>
                    </button>
                </div>
            </div>

            {/* Bảng dữ liệu co gọn Mobile-First với Thead Slate Đậm Nét */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-slate-800 text-white border-b-2 border-slate-700 text-[11px] font-black uppercase tracking-wider">
                            <th className="py-2.5 px-3 sticky left-0 bg-slate-800 text-white z-20 min-w-[135px] border-r border-slate-700">
                                Siêu thị
                            </th>
                            <th className="py-2.5 px-1.5 text-center min-w-[68px] border-r border-slate-700/60">DT ST</th>
                            <th className="py-2.5 px-1.5 text-center min-w-[70px] border-r border-slate-700/60">Thi Đua ST</th>
                            <th className="py-2.5 px-1.5 text-center min-w-[68px] border-r border-slate-700/60">DT NV</th>
                            <th className="py-2.5 px-1.5 text-center min-w-[70px] border-r border-slate-700/60">Thi Đua NV</th>
                            <th className="py-2.5 px-1.5 text-center min-w-[65px] border-r border-slate-700/60">Chỉ Tiêu</th>
                            <th className="py-2.5 px-1.5 text-center min-w-[65px] border-r border-slate-700/60">Giờ Công</th>
                            <th className="py-2.5 px-2.5 text-right min-w-[76px] text-emerald-300">Mức Đạt</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-8 text-center text-slate-500 font-medium text-xs bg-slate-50">
                                    Không có siêu thị nào khớp với bộ lọc tìm kiếm
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map((row, idx) => (
                                <tr
                                    key={row.storeName}
                                    className={`transition-colors ${!row.allOk
                                        ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
                                        : idx % 2 === 1
                                            ? 'bg-slate-50/70 hover:bg-emerald-50/40'
                                            : 'bg-white hover:bg-emerald-50/40'
                                        }`}
                                >
                                    {/* Cột Tên Siêu Thị (Sticky Left Cố Định Có Đổ Bóng Nhẹ) */}
                                    <td className="py-2.5 px-3 font-black text-slate-900 sticky left-0 bg-white z-10 whitespace-nowrap border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                                        <div className="flex items-center gap-2">
                                            {row.allOk ? (
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 shrink-0" />
                                            ) : (
                                                <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-200 shrink-0" />
                                            )}
                                            <span className="truncate max-w-[160px] sm:max-w-none text-slate-900 font-extrabold" title={row.storeName}>
                                                {getShortStoreName(row.storeName)}
                                            </span>
                                        </div>
                                    </td>

                                    {/* DT Siêu thị */}
                                    <td className="py-2.5 px-1.5 text-center border-r border-slate-100">
                                        {renderStatusBadge(row.storeRevenueOk, row.storeRevenueDate)}
                                    </td>

                                    {/* Thi đua Siêu thị */}
                                    <td className="py-2.5 px-1.5 text-center border-r border-slate-100">
                                        {renderStatusBadge(row.storeEmulationOk, null, row.storeEmulationCount)}
                                    </td>

                                    {/* DT Nhân viên */}
                                    <td className="py-2.5 px-1.5 text-center border-r border-slate-100">
                                        {renderStatusBadge(row.employeeRevenueOk, row.employeeRevenueDate)}
                                    </td>

                                    {/* Thi đua Nhân viên */}
                                    <td className="py-2.5 px-1.5 text-center border-r border-slate-100">
                                        {renderStatusBadge(row.employeeEmulationOk, null, row.employeeEmulationCount)}
                                    </td>

                                    {/* Chỉ tiêu Nhân viên */}
                                    <td className="py-2.5 px-1.5 text-center border-r border-slate-100">
                                        {renderStatusBadge(row.employeeTargetsOk, null, row.employeeTargetsCount)}
                                    </td>

                                    {/* Giờ công Nhân viên */}
                                    <td className="py-2.5 px-1.5 text-center border-r border-slate-100">
                                        {renderStatusBadge(row.workHoursOk)}
                                    </td>

                                    {/* Mức Đạt (%) Pill Nổi Bật */}
                                    <td className="py-2.5 px-2.5 text-right font-mono">
                                        <span
                                            className={`font-black text-xs px-2 py-0.5 rounded-md inline-block shadow-2xs ${row.readinessScore === 100
                                                ? 'bg-emerald-600 text-white'
                                                : row.readinessScore >= 60
                                                    ? 'bg-amber-500 text-white'
                                                    : 'bg-amber-100 text-amber-950 border border-amber-300'
                                                }`}
                                        >
                                            {row.readinessScore}%
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Chân bảng: Executive Dark Footer Summary */}
            <div className="p-3 bg-slate-900 text-slate-300 border-t border-slate-800 text-[11px] flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">
                        ✓ Hoàn tất {fullyReadyCount}/{matrix.length} siêu thị ({matrix.length > 0 ? Math.round((fullyReadyCount / matrix.length) * 100) : 0}%)
                    </span>
                    <span className="text-slate-600">•</span>
                    <span>
                        Phiên kỳ vọng chốt: <strong className="text-white font-bold">{formatDate(expectedDate)} (n-1)</strong>
                    </span>
                </div>
            </div>
        </div>
    );
}
