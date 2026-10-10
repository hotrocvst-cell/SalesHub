import { memo } from 'react';
import {
    Database,
    CheckCircle2,
    CloudUpload,
    CloudOff,
    AlertTriangle,
    Loader2,
    RefreshCw,
    Users,
    Coins,
    Trophy,
    Clock
} from 'lucide-react';

export type SyncStatusType = 'synced' | 'unsaved' | 'saving' | 'error';

export interface TargetStats {
    totalEmployees: number;
    countWithRevenue: number;
    totalRevenue: number;
    countCampaignTargets: number;
}

interface Props {
    status: SyncStatusType;
    lastSavedTime: string | null;
    lastErrorMessage: string | null;
    selectedMonth: number;
    selectedYear: number;
    stats: TargetStats;
    isSaving: boolean;
    onSaveAll: () => void;
    onReload: () => void;
}

function formatRevenueDisplay(rev: number): string {
    if (!rev || rev <= 0) return '0 đ';
    if (rev >= 1_000_000_000) {
        return `${(rev / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
    }
    return `${(rev / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tr`;
}

function SupabaseSyncStatusBar({
    status,
    lastSavedTime,
    lastErrorMessage,
    selectedMonth,
    selectedYear,
    stats,
    isSaving,
    onSaveAll,
    onReload
}: Props) {
    const isUnsaved = status === 'unsaved';
    const isSavingStatus = status === 'saving';
    const isError = status === 'error';
    const isSynced = status === 'synced';

    const completionRate = stats.totalEmployees > 0
        ? Math.round((stats.countWithRevenue / stats.totalEmployees) * 100)
        : 0;

    return (
        <div
            className={`rounded-2xl transition-all duration-300 p-3.5 sm:p-4 border shadow-2xs ${
                isUnsaved
                    ? 'bg-gradient-to-r from-amber-50/95 via-orange-50/40 to-white border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
                    : isSavingStatus
                    ? 'bg-gradient-to-r from-blue-50/95 via-indigo-50/40 to-white border-blue-300 shadow-xs'
                    : isError
                    ? 'bg-gradient-to-r from-rose-50/95 via-red-50/40 to-white border-rose-300 ring-2 ring-rose-400/20 shadow-xs'
                    : 'bg-gradient-to-r from-emerald-50/90 via-teal-50/30 to-white border-emerald-200/90'
            }`}
        >
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
                {/* 1. Cụm Trạng Thái Đồng Bộ Supabase Cloud */}
                <div className="flex items-center gap-3 min-w-0">
                    {/* Icon đại diện trạng thái */}
                    <div className="relative shrink-0">
                        {isUnsaved && (
                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-2xs border border-amber-200">
                                <CloudOff className="w-5 h-5 text-amber-600" />
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-white"></span>
                                </span>
                            </div>
                        )}
                        {isSavingStatus && (
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-2xs border border-blue-200">
                                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                            </div>
                        )}
                        {isError && (
                            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-2xs border border-rose-200">
                                <AlertTriangle className="w-5 h-5 text-rose-600" />
                            </div>
                        )}
                        {isSynced && (
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-2xs border border-emerald-200">
                                <Database className="w-5 h-5 text-emerald-600" />
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Tiêu đề & diễn giải trạng thái */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span
                                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                    isUnsaved
                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                        : isSavingStatus
                                        ? 'bg-blue-100 text-blue-900 border-blue-300'
                                        : isError
                                        ? 'bg-rose-100 text-rose-900 border-rose-300'
                                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                }`}
                            >
                                {isUnsaved && '⚠️ Chưa lưu lên Supabase'}
                                {isSavingStatus && '⚡ Đang đồng bộ...'}
                                {isError && '❌ Lỗi kết nối Supabase'}
                                {isSynced && '✅ Đã lưu CLOUD'}
                            </span>

                            <span className="text-[11px] font-bold text-slate-500">
                                Kỳ Tháng {selectedMonth}/{selectedYear}
                            </span>
                        </div>

                        <div className="text-xs sm:text-sm font-black tracking-tight mt-0.5 truncate">
                            {isUnsaved && (
                                <span className="text-amber-950">
                                    Có thay đổi mục tiêu chưa được lưu vào cơ sở dữ liệu Supabase!
                                </span>
                            )}
                            {isSavingStatus && (
                                <span className="text-blue-950">
                                    Đang ghi dữ liệu mục tiêu lên bảng Supabase...
                                </span>
                            )}
                            {isError && (
                                <span className="text-rose-950">
                                    Lưu thất bại: {lastErrorMessage || 'Không thể kết nối đến máy chủ Supabase'}
                                </span>
                            )}
                            {isSynced && (
                                <span className="text-emerald-950">
                                    Toàn bộ mục tiêu đã được lưu an toàn và đồng bộ trực tuyến
                                </span>
                            )}
                        </div>

                        {/* Timestamp lần lưu gần nhất */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {lastSavedTime ? (
                                <span>Lần lưu gần nhất: <b className="text-slate-700 font-bold">{lastSavedTime}</b></span>
                            ) : (
                                <span>Dữ liệu mới nạp từ máy chủ đám mây Supabase</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Cụm Thống Kê Nhanh (Stats Chips) */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Chip: Nhân sự có chỉ tiêu DT */}
                    <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs shadow-2xs ${
                            completionRate === 100
                                ? 'bg-white/90 border-emerald-200 text-emerald-950'
                                : 'bg-white/90 border-amber-200 text-amber-950'
                        }`}
                        title="Số nhân sự đã được nhập chỉ tiêu doanh thu cho tháng này"
                    >
                        <div className={`p-1 rounded-lg ${completionRate === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            <Users className="w-3.5 h-3.5" />
                        </div>
                        <div className="leading-tight">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Có Target DT</div>
                            <div className="font-black text-slate-800 text-[11.5px]">
                                {stats.countWithRevenue}/{stats.totalEmployees} <span className="text-[10px] font-bold text-slate-500">NV ({completionRate}%)</span>
                            </div>
                        </div>
                    </div>

                    {/* Chip: Tổng Doanh Thu đã giao */}
                    <div
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/90 border border-blue-200 text-blue-950 text-xs shadow-2xs"
                        title={`Tổng doanh thu đã giao trong tháng: ${stats.totalRevenue.toLocaleString('vi-VN')} VNĐ`}
                    >
                        <div className="p-1 rounded-lg bg-blue-100 text-blue-700">
                            <Coins className="w-3.5 h-3.5" />
                        </div>
                        <div className="leading-tight">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Tổng DT Giao</div>
                            <div className="font-black text-blue-900 text-[11.5px]">
                                {formatRevenueDisplay(stats.totalRevenue)}
                            </div>
                        </div>
                    </div>

                    {/* Chip: Tổng chỉ tiêu Thi Đua */}
                    <div
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/90 border border-purple-200 text-purple-950 text-xs shadow-2xs"
                        title="Tổng số lượng chỉ tiêu thi đua các ngành hàng đã phân bổ"
                    >
                        <div className="p-1 rounded-lg bg-purple-100 text-purple-700">
                            <Trophy className="w-3.5 h-3.5" />
                        </div>
                        <div className="leading-tight">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Chỉ Tiêu Thi Đua</div>
                            <div className="font-black text-purple-900 text-[11.5px]">
                                {stats.countCampaignTargets} <span className="text-[10px] font-bold text-slate-500">mục</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Nút Thao Tác Ngay Trên Thanh Trạng Thái */}
                    {isUnsaved ? (
                        <button
                            type="button"
                            onClick={onSaveAll}
                            disabled={isSaving}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm shadow-blue-500/30 transition cursor-pointer hover:scale-[1.02] active:scale-[0.98] shrink-0"
                            title="Lưu ngay toàn bộ chỉ tiêu đã chỉnh sửa lên CLOUD"
                        >
                            <CloudUpload className={`w-4 h-4 ${isSaving ? 'animate-bounce' : ''}`} />
                            <span>{isSaving ? 'ĐANG LƯU...' : '⚡ LƯU LÊN SUPABASE NGAY'}</span>
                        </button>
                    ) : isError ? (
                        <button
                            type="button"
                            onClick={onSaveAll}
                            disabled={isSaving}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition cursor-pointer shrink-0"
                            title="Thử lưu lại dữ liệu lên Supabase"
                        >
                            <RefreshCw className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                            <span>{isSaving ? 'ĐANG THỬ LẠI...' : 'THỬ LƯU LẠI'}</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onReload}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs shrink-0"
                            title="Tải lại bản ghi mới nhất từ máy chủ Supabase"
                        >
                            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                            <span>Làm mới Cloud</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default memo(SupabaseSyncStatusBar);
