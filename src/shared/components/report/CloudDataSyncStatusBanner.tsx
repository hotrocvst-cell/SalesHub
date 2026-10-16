import React, { useState } from 'react';
import {
    Cloud,
    HardDrive,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    Database,
    Copy,
    ChevronDown,
    ChevronUp,
    Sparkles
} from 'lucide-react';
import { formatDate } from '../../../core/lib/formatters';

export interface CloudDataSyncStatusBannerProps {
    /** Nguồn dữ liệu hiện tại: 'cloud' (Supabase) | 'local' (LocalStorage cache) | 'hybrid' (kết hợp) */
    storageType?: 'cloud' | 'local' | 'hybrid';
    /** Trạng thái đồng bộ: 'synced' (đã khớp) | 'unsynced' (có dữ liệu chờ gửi) | 'syncing' | 'error' */
    syncStatus?: 'synced' | 'unsynced' | 'syncing' | 'error';
    /** Trạng thái sẵn sàng của bảng trên Supabase Cloud (true nếu đã tạo bảng, false nếu nhận mã PGRST205) */
    tableReady?: boolean;
    /** Tên bảng Supabase liên quan (ví dụ: employee_period_targets, daily_business_records, ...) */
    tableName?: string;
    /** Số lượng bản ghi local đang chờ đồng bộ lên Cloud */
    unsyncedCount?: number;
    /** Hàm xử lý đồng bộ lên Cloud khi người dùng bấm nút */
    onSyncNow?: () => Promise<void> | void;
    /** Câu lệnh SQL DDL để tạo bảng nếu Quản trị viên cần khởi tạo */
    sqlDdl?: string;
    /** Thời gian đồng bộ / kiểm tra gần nhất */
    lastSyncTime?: string | Date | null;
    /** Thông báo bổ sung tùy biến */
    customMessage?: string;
    /** Giao diện co gọn trên mobile */
    compact?: boolean;
    /** Class tùy biến */
    className?: string;
}

export default function CloudDataSyncStatusBanner({
    storageType = 'cloud',
    syncStatus = 'synced',
    tableReady = true,
    tableName,
    unsyncedCount = 0,
    onSyncNow,
    sqlDdl,
    lastSyncTime,
    customMessage,
    compact = false,
    className = ''
}: CloudDataSyncStatusBannerProps) {
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
    const [sqlCopied, setSqlCopied] = useState<boolean>(false);
    const [showDetails, setShowDetails] = useState<boolean>(false);

    const isCloud = storageType === 'cloud';
    const isLocal = storageType === 'local';
    const hasUnsynced = unsyncedCount > 0 || syncStatus === 'unsynced';

    const handleSyncClick = async () => {
        if (!onSyncNow || isSyncing) return;
        setIsSyncing(true);
        try {
            await onSyncNow();
        } finally {
            setIsSyncing(false);
        }
    };

    const handleCopySql = () => {
        if (!sqlDdl) return;
        navigator.clipboard.writeText(sqlDdl);
        setSqlCopied(true);
        setTimeout(() => setSqlCopied(false), 2500);
    };

    const formattedTime = React.useMemo(() => {
        if (!lastSyncTime) return null;
        try {
            const d = new Date(lastSyncTime);
            if (isNaN(d.getTime())) return null;
            return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${formatDate(d)}`;
        } catch {
            return null;
        }
    }, [lastSyncTime]);

    return (
        <div
            data-cloud-sync-banner="true"
            data-html2canvas-ignore="true"
            data-export-ignore="true"
            className={`rounded-2xl border transition-all select-none ${
                !tableReady
                    ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-2xs'
                    : isLocal || hasUnsynced
                        ? 'bg-amber-50/70 border-amber-200 text-amber-900 shadow-2xs'
                        : 'bg-slate-50/90 border-slate-200/90 text-slate-800 shadow-2xs'
            } ${compact ? 'p-2 sm:p-2.5 text-xs' : 'p-3 text-xs'} ${className}`}
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                {/* NHÓM THÔNG TIN BÊN TRÁI: NGUỒN DỮ LIỆU & TRẠNG THÁI */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* CHIP NGUỒN DỮ LIỆU */}
                    <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-black text-[11px] shadow-2xs ${
                            isCloud
                                ? 'bg-indigo-600 text-white'
                                : isLocal
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-teal-600 text-white'
                        }`}
                    >
                        {isCloud ? (
                            <Cloud className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                            <HardDrive className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>
                            {isCloud
                                ? 'Dữ liệu Supabase Cloud'
                                : isLocal
                                    ? 'Bộ nhớ đệm Local'
                                    : 'Đồng bộ Hybrid'}
                        </span>
                    </div>

                    {/* TRẠNG THÁI ĐỒNG BỘ */}
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold">
                        {hasUnsynced ? (
                            <span className="text-amber-700 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>Chưa đồng bộ Cloud {unsyncedCount > 0 ? `(${unsyncedCount} bản ghi)` : ''}</span>
                            </span>
                        ) : (
                            <span className="text-emerald-700 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>Đã đồng bộ thời gian thực</span>
                            </span>
                        )}
                    </div>

                    {/* TRẠNG THÁI BẢNG CLOUD */}
                    <div className="inline-flex items-center gap-1 text-[11px]">
                        {tableReady ? (
                            <span className="text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-lg font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Bảng Cloud sẵn sàng {tableName ? `(${tableName})` : ''}</span>
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowSqlModal(true)}
                                className="text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 hover:bg-rose-200 cursor-pointer transition-all"
                            >
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                <span>Chưa tạo bảng Cloud (Bấm xem SQL DDL)</span>
                            </button>
                        )}
                    </div>

                    {customMessage && (
                        <span className="text-[11px] text-slate-500 italic hidden md:inline">
                            • {customMessage}
                        </span>
                    )}
                </div>

                {/* NHÓM THAO TÁC BÊN PHẢI: NÚT ĐỒNG BỘ & THỜI GIAN */}
                <div className="flex items-center gap-2 justify-between sm:justify-end">
                    {formattedTime && (
                        <span className="text-[10.5px] text-slate-500 font-medium hidden sm:inline">
                            Cập nhật: {formattedTime}
                        </span>
                    )}

                    {onSyncNow && (
                        <button
                            type="button"
                            onClick={handleSyncClick}
                            disabled={isSyncing}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                hasUnsynced
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                        >
                            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-indigo-400' : ''}`} />
                            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Cloud'}</span>
                        </button>
                    )}

                    {sqlDdl && !tableReady && (
                        <button
                            type="button"
                            onClick={() => setShowSqlModal(true)}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                            <Database className="w-3 h-3" />
                            <span>SQL DDL</span>
                        </button>
                    )}
                </div>
            </div>

            {/* MODAL XEM & SAO CHÉP SQL DDL NẾU BẢNG CHƯA TẠO */}
            {showSqlModal && sqlDdl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-indigo-400" />
                                <div>
                                    <h3 className="text-sm font-black">Khởi tạo Bảng trên Supabase Cloud</h3>
                                    <p className="text-[11px] text-slate-400">
                                        Chạy mã SQL DDL 1 lần tại Supabase SQL Editor
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowSqlModal(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
                            <p className="text-slate-600 text-xs">
                                Bảng <strong>{tableName || 'dữ liệu'}</strong> chưa được tạo trên cơ sở dữ liệu Supabase. 
                                Hãy sao chép câu lệnh dưới đây và dán vào <strong>SQL Editor</strong> trên Supabase dashboard để kích hoạt lưu trữ đám mây.
                            </p>
                            <div className="relative">
                                <pre className="bg-slate-900 text-emerald-400 p-3 rounded-xl overflow-x-auto text-[11.5px] font-mono leading-relaxed border border-slate-800">
                                    {sqlDdl}
                                </pre>
                                <button
                                    type="button"
                                    onClick={handleCopySql}
                                    className="absolute top-2.5 right-2.5 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                                >
                                    {sqlCopied ? (
                                        <>
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                                            <span>Đã sao chép!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>Sao chép SQL</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowSqlModal(false)}
                                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
