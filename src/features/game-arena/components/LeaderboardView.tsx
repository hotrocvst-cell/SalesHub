import React, { useMemo } from 'react';
import { Trophy, Camera, RefreshCw, Filter, Calendar } from 'lucide-react';
import LeaderboardPodium from './LeaderboardPodium';
import { useLeaderboardExport } from '../hooks/useLeaderboardExport';
import { getShortenedEmployeeName, cleanEmployeeName, formatDate } from '../../../core/lib/formatters';
import { SYSTEM_GAMES_LIST } from '../constants';
import type { GameScoreRecord, LeaderboardFilter, LeaderboardTimeRange } from '../types';

interface LeaderboardViewProps {
    scores: GameScoreRecord[];
    filter: LeaderboardFilter;
    onFilterChange: (newFilter: Partial<LeaderboardFilter>) => void;
    onRefresh: () => void;
    availableStores: string[];
    isLoading: boolean;
}

export default function LeaderboardView({
    scores,
    filter,
    onFilterChange,
    onRefresh,
    availableStores,
    isLoading
}: LeaderboardViewProps) {
    const { exportLeaderboardImage, isExporting } = useLeaderboardExport();

    // Tính độ dài mã nhân viên lớn nhất để đồng bộ chiều rộng Badge theo Quy chuẩn 11
    const maxIdLength = useMemo(() => {
        if (!scores || scores.length === 0) return 6;
        return Math.max(6, ...scores.map(r => String(r.employee_id || '').trim().length));
    }, [scores]);

    const activeGame = SYSTEM_GAMES_LIST.find(g => g.id === filter.game_id);

    return (
        <div className="space-y-4">
            {/* DÒNG 1: QUY CHUẨN 10 - BỘ LỌC ST / CỤM NẰM RIÊNG LẺ DÒNG ĐẦU TIÊN */}
            <div data-export-ignore="true" className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-purple-600" /> Phạm vi ST:
                    </span>
                    <select
                        value={filter.store_name}
                        onChange={e => onFilterChange({ store_name: e.target.value })}
                        className="w-full sm:max-w-xs text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="ALL">Toàn Hệ Thống (Tất cả ST)</option>
                        {availableStores.map(st => (
                            <option key={st} value={st}>{st}</option>
                        ))}
                    </select>
                </div>

                {/* Các nút hành động */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                        onClick={onRefresh}
                        disabled={isLoading}
                        title="Tải lại bảng điểm"
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Làm mới</span>
                    </button>
                    <button
                        onClick={() => exportLeaderboardImage('game-leaderboard-capture-area', `BXH-${filter.game_id}`)}
                        disabled={isExporting}
                        className="flex items-center gap-1.5 text-xs font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-3.5 py-2 rounded-xl shadow transition-transform active:scale-95 disabled:opacity-50"
                    >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{isExporting ? 'Đang xuất...' : 'Xuất ảnh BXH'}</span>
                    </button>
                </div>
            </div>

            {/* DÒNG 2: BỘ LỌC GAME VÀ CHU KỲ THỜI GIAN */}
            <div data-export-ignore="true" className="flex flex-wrap items-center justify-between gap-2">
                {/* Lọc theo Game */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                    <button
                        onClick={() => onFilterChange({ game_id: 'all' })}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
                            filter.game_id === 'all'
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        Tất cả game
                    </button>
                    {SYSTEM_GAMES_LIST.filter(g => g.isReady).map(g => (
                        <button
                            key={g.id}
                            onClick={() => onFilterChange({ game_id: g.id })}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
                                filter.game_id === g.id
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {g.title}
                        </button>
                    ))}
                </div>

                {/* Lọc theo Chu kỳ (Hôm nay, Tuần này - Monday first, Tháng này, Toàn bộ) */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                    {(['today', 'week', 'month', 'all'] as LeaderboardTimeRange[]).map(t => {
                        const labels: Record<LeaderboardTimeRange, string> = {
                            today: 'Hôm nay',
                            week: 'Tuần này',
                            month: 'Tháng này',
                            all: 'Tất cả'
                        };
                        return (
                            <button
                                key={t}
                                onClick={() => onFilterChange({ time_range: t })}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                                    filter.time_range === t
                                        ? 'bg-purple-100 text-purple-800 font-extrabold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {labels[t]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* VÙNG CHỤP XUẤT ẢNH BẢNG XẾP HẠNG (KHÔNG FOOTER WATERMARK THEO QUY TẮC) */}
            <div id="game-leaderboard-capture-area" className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                {/* Header Bảng Xếp Hạng */}
                <div className="text-center pb-3 border-b border-slate-100 mb-4">
                    <div className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-800 text-xs font-black px-3 py-1 rounded-full mb-1">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" /> BẢNG VÀNG CAO THỦ GIẢI TRÍ
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                        {activeGame ? activeGame.title.toUpperCase() : 'TOÀN BỘ MINI GAME'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {filter.store_name === 'ALL' ? 'Phạm vi: Toàn Hệ Thống' : `ST: ${filter.store_name}`}
                        {' • '}
                        {filter.time_range === 'today' ? 'Kỳ: Hôm nay' : filter.time_range === 'week' ? 'Kỳ: Tuần này' : filter.time_range === 'month' ? 'Kỳ: Tháng này' : 'Kỳ: Mọi lúc'}
                    </p>
                </div>

                {/* Bục Vinh Danh Top 3 Podium */}
                {scores.length > 0 && <LeaderboardPodium topScores={scores.slice(0, 3)} />}

                {/* Bảng Xếp Hạng Chi Tiết Chuẩn Quy chuẩn 11 */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 mt-4">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <th className="px-2 py-2 text-center w-12">Hạng</th>
                                {/* Quy chuẩn 11: Gộp chung Mã NV và Tên NV trên 1 cột */}
                                <th className="px-2.5 py-2">Nhân viên</th>
                                <th className="px-2 py-2">ST</th>
                                <th className="px-2.5 py-2 text-right">Điểm số</th>
                                <th className="px-2 py-2 text-center hidden sm:table-cell">Thời gian</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {scores.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                                        Chưa có bản ghi điểm nào trong giai đoạn này. Hãy là người đầu tiên chinh phục bảng vàng!
                                    </td>
                                </tr>
                            ) : (
                                scores.map((item, idx) => {
                                    const rankNum = idx + 1;
                                    const isTop1 = rankNum === 1;
                                    const isTop2 = rankNum === 2;
                                    const isTop3 = rankNum === 3;

                                    return (
                                        <tr
                                            key={item.id || `${item.employee_id}-${idx}`}
                                            className={`transition-colors hover:bg-slate-50/80 ${
                                                isTop1 ? 'bg-amber-50/40' : isTop2 ? 'bg-slate-50/60' : isTop3 ? 'bg-orange-50/30' : ''
                                            }`}
                                        >
                                            {/* Cột Thứ Hạng */}
                                            <td className="px-2 py-2 text-center font-black">
                                                {isTop1 ? <span className="text-base">🥇</span> :
                                                 isTop2 ? <span className="text-base">🥈</span> :
                                                 isTop3 ? <span className="text-base">🥉</span> :
                                                 <span className="font-mono text-slate-500 font-bold">#{rankNum}</span>}
                                            </td>

                                            {/* Cột Nhân Viên Chuẩn Quy chuẩn 11: Gộp Mã NV + Tên Rút Gọn */}
                                            <td className="px-2.5 py-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                                                        style={{
                                                            minWidth: `${maxIdLength + 2.2}ch`,
                                                            width: `${maxIdLength + 2.2}ch`
                                                        }}
                                                    >
                                                        {item.employee_id}
                                                    </span>
                                                    <span
                                                        title={`Mã NV: ${item.employee_id} - ${cleanEmployeeName(item.employee_name)}`}
                                                        className="font-black text-slate-800 text-xs truncate max-w-[130px] sm:max-w-[180px]"
                                                    >
                                                        {getShortenedEmployeeName(item.employee_name)}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Cột ST */}
                                            <td className="px-2 py-2 text-slate-600 truncate max-w-[110px] sm:max-w-[160px] text-[11px]">
                                                {item.store_name}
                                            </td>

                                            {/* Cột Điểm Số Căn Phải */}
                                            <td className="px-2.5 py-2 text-right">
                                                <span className="font-mono font-black text-amber-600 text-xs sm:text-sm">
                                                    {item.score}
                                                </span>
                                            </td>

                                            {/* Cột Thời Gian */}
                                            <td className="px-2 py-2 text-center text-[10px] text-slate-400 font-mono hidden sm:table-cell">
                                                {item.played_at ? formatDate(item.played_at) : '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

