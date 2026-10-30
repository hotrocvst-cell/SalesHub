import React, { useState } from 'react';
import {
    Clock,
    RefreshCw,
    Sparkles,
    Camera,
    Database,
    CheckCircle2,
    AlertCircle,
    Copy,
    Check,
    X,
    Radio
} from 'lucide-react';
import type { RealtimeSessionSummary } from '../services/realtimeSessionService';
import { REALTIME_STORE_SESSIONS_SQL } from '../services/realtimeSessionService';

interface Props {
    sessionSummary: RealtimeSessionSummary | null;
    selectedStore: string;
    isLoading: boolean;
    isTableMissing: boolean;
    isAdmin: boolean;
    onRefresh: () => void;
    onOpenUpdateModal: () => void;
}

export default function RealtimeSessionBanner({
    sessionSummary,
    selectedStore,
    isLoading,
    isTableMissing,
    isAdmin,
    onRefresh,
    onOpenUpdateModal
}: Props) {
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const handleCopySql = () => {
        navigator.clipboard.writeText(REALTIME_STORE_SESSIONS_SQL);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // Chuỗi hiển thị thời gian phiên
    const timeDisplay = sessionSummary?.screenshotTimeStr ||
        (sessionSummary?.sessionTime
            ? new Date(sessionSummary.sessionTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            : 'Chưa có phiên');

    const dateDisplay = sessionSummary?.sessionTime
        ? new Date(sessionSummary.sessionTime).toLocaleDateString('vi-VN')
        : '';

    return (
        <div
            data-html2canvas-ignore="true"
            data-export-ignore="true"
            className="w-full bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-3.5 sm:p-4 shadow-md border border-blue-700/40 space-y-2.5"
        >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Cụm thông tin phiên Realtime */}
                <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 shrink-0 shadow-inner">
                        <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                                CLOUD REALTIME
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-blue-300" />
                                <span>Phiên Cloud:</span>
                                <span className="text-amber-300 font-mono font-black">{timeDisplay}</span>
                                {dateDisplay && <span className="text-slate-300 text-xs font-normal">({dateDisplay})</span>}
                            </span>
                        </div>

                        <p className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>
                                Đơn vị: <strong className="text-white">{selectedStore === 'Tổng' ? 'Toàn Cụm' : selectedStore}</strong>
                            </span>
                            <span className="text-slate-500">•</span>
                            <span>
                                {sessionSummary
                                    ? `${sessionSummary.storeCount} siêu thị • ${sessionSummary.campaignCount} mục thi đua`
                                    : 'Chưa có phiên dữ liệu nào trên Cloud'
                                }
                            </span>
                            {sessionSummary && (
                                <>
                                    <span className="text-slate-500">•</span>
                                    <span className="text-[10px] text-emerald-400">🟢 Đã đồng bộ</span>
                                </>
                            )}
                        </p>
                    </div>
                </div>

                {/* Cụm nút hành động */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                    {/* Cảnh báo chưa tạo bảng (chỉ hiện nút SQL cho ADMIN theo Quy chuẩn 12) */}
                    {isTableMissing && isAdmin && (
                        <button
                            type="button"
                            onClick={() => setShowSqlModal(true)}
                            className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/50 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title="Tạo bảng Supabase realtime_store_sessions"
                        >
                            <Database className="w-3.5 h-3.5" />
                            <span>Mã SQL Bảng</span>
                        </button>
                    )}

                    {/* Nút Làm mới từ Cloud */}
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-white/15 cursor-pointer disabled:opacity-50"
                        title="Tải lại số liệu Realtime mới nhất từ Cloud"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
                        <span>Làm mới Cloud</span>
                    </button>

                    {/* Nút Nạp Phiên Realtime Mới (OCR / Nhập tay) */}
                    <button
                        type="button"
                        onClick={onOpenUpdateModal}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-sm border border-blue-400/30 cursor-pointer"
                    >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Nạp Phiên Mới (OCR / Nhập tay)</span>
                    </button>
                </div>
            </div>

            {/* MODAL MÃ LỆNH SQL DDL CHO ADMIN (QUY CHUẨN 12) */}
            {showSqlModal && isAdmin && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl text-slate-100">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-amber-400" />
                                <h3 className="font-extrabold text-sm sm:text-base text-white">
                                    Mã SQL Tạo Bảng Realtime Cloud
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowSqlModal(false)}
                                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed">
                            Chạy câu lệnh SQL này trong <strong>Supabase SQL Editor</strong> để khởi tạo bảng <code>realtime_store_sessions</code> với ràng buộc <code>UNIQUE(store_name)</code> (mỗi siêu thị chỉ lưu 1 phiên realtime duy nhất).
                        </p>

                        <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto max-h-60 leading-relaxed">
                            {REALTIME_STORE_SESSIONS_SQL}
                        </pre>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                            <button
                                onClick={() => setShowSqlModal(false)}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                            >
                                Đóng
                            </button>
                            <button
                                onClick={handleCopySql}
                                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition cursor-pointer"
                            >
                                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{isCopied ? 'Đã sao chép' : 'Sao chép SQL'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

