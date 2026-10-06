import { useState } from 'react';
import {
    Cloud,
    CloudCheck,
    CloudAlert,
    CloudOff,
    RefreshCw,
    Save,
    AlertCircle,
    CheckCircle2,
    Database,
    Sparkles,
    ChevronDown,
    ChevronUp,
    Info
} from 'lucide-react';

export type CloudSyncStatus = 'READY' | 'SYNCING' | 'PENDING_CHANGES' | 'OFFLINE' | 'CHECKING';

interface Props {
    status: CloudSyncStatus;
    lastCheckedTime: string;
    hasDictChanges: boolean;
    hasScoreChanges: boolean;
    isSyncing: boolean;
    dictCount: number;
    scoresCount: number;
    errorMessage?: string;
    isAdmin?: boolean;
    onCheckConnection: () => Promise<void>;
    onSyncNow?: () => Promise<void>;
}

export default function SupabaseSyncStatusBar({
    status,
    lastCheckedTime,
    hasDictChanges,
    hasScoreChanges,
    isSyncing,
    dictCount,
    scoresCount,
    errorMessage,
    isAdmin = false,
    onCheckConnection,
    onSyncNow
}: Props) {
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const hasAnyUnsaved = hasDictChanges || hasScoreChanges;

    // Xác định chế độ hiển thị
    const effectiveStatus: CloudSyncStatus = isSyncing
        ? 'SYNCING'
        : hasAnyUnsaved
            ? 'PENDING_CHANGES'
            : status;

    return (
        <div className="space-y-2">
            {/* THANH TRẠNG THÁI CHÍNH */}
            <div
                className={`rounded-2xl border px-4 py-3 shadow-xs transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    effectiveStatus === 'PENDING_CHANGES'
                        ? 'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-amber-300 text-amber-900 shadow-amber-500/5 ring-1 ring-amber-400/40'
                        : effectiveStatus === 'READY'
                            ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-300 text-emerald-950'
                            : effectiveStatus === 'SYNCING' || effectiveStatus === 'CHECKING'
                                ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-blue-300 text-blue-950'
                                : 'bg-gradient-to-r from-rose-50 via-red-50 to-rose-50 border-rose-300 text-rose-950'
                }`}
            >
                {/* Khối Thông tin Trạng thái */}
                <div className="flex items-center gap-3 min-w-0">
                    {/* Icon Cloud với Đèn LED Trạng thái */}
                    <div className="relative shrink-0">
                        <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
                                effectiveStatus === 'PENDING_CHANGES'
                                    ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                    : effectiveStatus === 'READY'
                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                        : effectiveStatus === 'SYNCING' || effectiveStatus === 'CHECKING'
                                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                            : 'bg-rose-100 text-rose-700 border border-rose-300'
                            }`}
                        >
                            {effectiveStatus === 'PENDING_CHANGES' && <AlertCircle className="w-5 h-5 text-amber-600 animate-bounce" />}
                            {effectiveStatus === 'READY' && <Cloud className="w-5 h-5 text-emerald-600" />}
                            {(effectiveStatus === 'SYNCING' || effectiveStatus === 'CHECKING') && (
                                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                            )}
                            {effectiveStatus === 'OFFLINE' && <CloudOff className="w-5 h-5 text-rose-600" />}
                        </div>

                        {/* Đèn nhấp nháy LED */}
                        {effectiveStatus === 'READY' && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
                            </span>
                        )}
                        {effectiveStatus === 'PENDING_CHANGES' && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-white"></span>
                            </span>
                        )}
                    </div>

                    {/* Nội dung diễn giải */}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                {effectiveStatus === 'PENDING_CHANGES' && '⚠️ CÓ THAY ĐỔI CHƯA LƯU / CHƯA SYNC CLOUD'}
                                {effectiveStatus === 'READY' && '🟢 SUPABASE CLOUD: SẴN SÀNG (ĐÃ KẾT NỐI)'}
                                {(effectiveStatus === 'SYNCING' || effectiveStatus === 'CHECKING') && '🔄 ĐANG KẾT NỐI & ĐỒNG BỘ DỮ LIỆU...'}
                                {effectiveStatus === 'OFFLINE' && '❌ MẤT KẾT NỐI SUPABASE CLOUD (CHẾ ĐỘ OFFLINE)'}
                            </span>

                            {effectiveStatus === 'PENDING_CHANGES' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-400/80 animate-pulse">
                                    Chờ lưu
                                </span>
                            )}
                            {effectiveStatus === 'READY' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200/70 text-emerald-900 border border-emerald-300">
                                    Online
                                </span>
                            )}
                        </div>

                        <p className="text-[11px] opacity-90 truncate mt-0.5">
                            {effectiveStatus === 'PENDING_CHANGES' && (
                                <>
                                    Phát hiện thay đổi tại{' '}
                                    {hasScoreChanges && <b className="text-amber-950 font-bold">[Điểm thi đua]</b>}
                                    {hasScoreChanges && hasDictChanges && ' & '}
                                    {hasDictChanges && <b className="text-amber-950 font-bold">[Từ điển thi đua]</b>}
                                    . Dữ liệu tạm thời chỉ nằm trên máy bạn, hãy bấm đồng bộ để ghi nhận lên Cloud.
                                </>
                            )}
                            {effectiveStatus === 'READY' && (
                                <>
                                    Đã kết nối trực tiếp với Supabase • <b>{dictCount}</b> mục từ điển • Bảng điểm siêu thị hoạt động • Cập nhật lúc <b>{lastCheckedTime || 'Vừa xong'}</b>
                                </>
                            )}
                            {(effectiveStatus === 'SYNCING' || effectiveStatus === 'CHECKING') && (
                                <>
                                    Đang truyền tải và đồng bộ các thay đổi mới nhất lên cơ sở dữ liệu Supabase Cloud...
                                </>
                            )}
                            {effectiveStatus === 'OFFLINE' && (
                                <>
                                    {errorMessage || 'Không thể kết nối tới cơ sở dữ liệu Supabase'}. Đang tự động lưu trữ trên LocalStorage của trình duyệt.
                                </>
                            )}
                        </p>
                    </div>
                </div>

                {/* Khối Nút thao tác nhanh */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {effectiveStatus === 'PENDING_CHANGES' && onSyncNow && (
                        <button
                            type="button"
                            onClick={onSyncNow}
                            disabled={isSyncing}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                            title="Lưu tất cả thay đổi và đồng bộ ngay lên Supabase"
                        >
                            <Save className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span>{isSyncing ? 'ĐANG SYNC...' : '⚡ ĐỒNG BỘ CLOUD NGAY'}</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onCheckConnection}
                        disabled={isSyncing || status === 'CHECKING'}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer disabled:opacity-50 ${
                            effectiveStatus === 'PENDING_CHANGES'
                                ? 'bg-white hover:bg-amber-50 text-amber-900 border-amber-300'
                                : effectiveStatus === 'READY'
                                    ? 'bg-white hover:bg-emerald-100/60 text-emerald-800 border-emerald-300'
                                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                        }`}
                        title="Kiểm tra lại trạng thái kết nối với Supabase Cloud"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || status === 'CHECKING' ? 'animate-spin text-indigo-600' : ''}`} />
                        <span className="hidden sm:inline">Kiểm tra kết nối</span>
                    </button>

                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                            className="p-1.5 rounded-xl hover:bg-black/5 text-slate-500 transition cursor-pointer"
                            title="Xem chi tiết trạng thái cơ sở dữ liệu (Admin)"
                        >
                            {isDetailsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>

            {/* BẢNG CHI TIẾT KẾT NỐI (COLLAPSIBLE DETAILS - CHỈ HIỂN THỊ VỚI ADMIN) */}
            {isAdmin && isDetailsOpen && (
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs text-xs space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                            <Database className="w-4 h-4 text-indigo-600" />
                            CHI TIẾT KẾT NỐI BẢNG DỮ LIỆU TRÊN SUPABASE CLOUD
                        </span>
                        <span className="text-[11px] text-slate-400">
                            Lần kiểm tra cuối: <b>{lastCheckedTime || 'Chưa kiểm tra'}</b>
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Bảng 1: campaign_dictionary */}
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-800 font-mono text-[11px]">
                                    public.campaign_dictionary
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                    Từ điển mã thi đua toàn hệ thống
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[11px] text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    {dictCount} mục
                                </span>
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Đã kết nối thành công"></span>
                            </div>
                        </div>

                        {/* Bảng 2: store_campaign_scores */}
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-800 font-mono text-[11px]">
                                    public.store_campaign_scores
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                    Cấu hình điểm theo siêu thị & chế độ tính
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[11px] text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    {scoresCount > 0 ? `${scoresCount} siêu thị` : 'Sẵn sàng'}
                                </span>
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Đã kết nối thành công"></span>
                            </div>
                        </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 text-[11px] flex items-start gap-2">
                        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                            Hệ thống hoạt động với kiến trúc <b>Offline-First & Cloud-Synced</b>: Dữ liệu được lưu ngay lập tức vào LocalStorage của bạn để thao tác cực nhanh, đồng thời tự động đồng bộ lên Supabase Cloud để dữ liệu không bị mất và xem được trên nhiều thiết bị.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
