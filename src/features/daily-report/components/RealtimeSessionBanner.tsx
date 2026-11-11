import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Clock,
    RefreshCw,
    Camera,
    Database,
    Copy,
    Check,
    X,
    Radio,
    Settings
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
    onOpenManagerModal?: () => void;
}

export default function RealtimeSessionBanner({
    sessionSummary,
    selectedStore,
    isLoading,
    isTableMissing,
    isAdmin,
    onRefresh,
    onOpenUpdateModal,
    onOpenManagerModal
}: Props) {
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const sqlCloseBtnRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!showSqlModal) return;
        sqlCloseBtnRef.current?.focus();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowSqlModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showSqlModal]);

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
            className="w-full bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-3.5 sm:p-4 shadow-md border border-blue-800/60 space-y-2.5"
        >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Cụm thông tin phiên Realtime */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 shrink-0 shadow-inner">
                        <Radio className="w-5 h-5 text-emerald-300" aria-hidden="true" />
                        <span className="absolute -top-1 -right-1 inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 ring-2 ring-slate-900" aria-hidden="true" />
                    </div>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block" aria-hidden="true"></span>
                                CLOUD REALTIME
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5 flex-wrap">
                                <Clock className="w-3.5 h-3.5 text-blue-200 shrink-0" aria-hidden="true" />
                                <span>Phiên:</span>
                                <span className="text-amber-300 font-mono font-black tabular-nums">{timeDisplay}</span>
                                {dateDisplay && <span className="text-slate-200 text-xs font-normal tabular-nums">({dateDisplay})</span>}
                            </span>
                        </div>

                        <p className="text-[11px] text-slate-200 mt-1 flex items-center gap-2 flex-wrap leading-snug">
                            <span>
                                Cụm/ST: <strong className="text-white">
                                    {!isAdmin
                                        ? (selectedStore === 'Tổng' ? 'ST phân quyền' : selectedStore)
                                        : (selectedStore === 'Tổng' ? 'Toàn Cụm' : selectedStore)
                                    }
                                </strong>
                            </span>
                            {sessionSummary && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-200 border border-emerald-400/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block" aria-hidden="true"></span>
                                    Đã đồng bộ
                                </span>
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
                            className="px-3 py-2 min-h-[36px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                            title="Tạo bảng SQL realtime_store_sessions"
                        >
                            <Database className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Mã SQL Bảng</span>
                        </button>
                    )}

                    {/* Nút Làm mới từ Cloud */}
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="px-3 py-2 min-h-[36px] bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-white/20 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                        title="Tải lại số liệu Realtime mới nhất từ Cloud"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-300' : ''}`} aria-hidden="true" />
                        <span>Làm mới Cloud</span>
                    </button>

                    {/* Nút Quản Lý Phiên Realtime Cloud - DÀNH RIÊNG CHO ADMIN */}
                    {isAdmin && onOpenManagerModal && (
                        <button
                            type="button"
                            onClick={onOpenManagerModal}
                            className="px-3 py-2 min-h-[36px] bg-blue-800/80 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-blue-400/40 cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                            title="Quản lý, chuẩn hóa tên ST hoặc xóa các phiên Realtime trên Cloud"
                        >
                            <Settings className="w-3.5 h-3.5 text-blue-200" aria-hidden="true" />
                            <span>Quản Lý Phiên</span>
                        </button>
                    )}

                    {/* Nút Nạp Phiên Realtime (OCR / Nhập tay Doanh Thu & Thi Đua) */}
                    <button
                        type="button"
                        onClick={onOpenUpdateModal}
                        className="px-3.5 py-2 min-h-[36px] bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-sm border border-blue-400/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                        title="Nạp doanh thu (DTQĐ, DT Thực, Trả góp) và thi đua qua OCR hoặc nhập tay (hỗ trợ nạp cả Cụm hoặc từng ST đích danh)"
                    >
                        <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Nạp Doanh Thu &amp; Thi Đua</span>
                    </button>
                </div>
            </div>

            {/* MODAL MÃ LỆNH SQL DDL CHO ADMIN (QUY CHUẨN 12) */}
            {showSqlModal && isAdmin && createPortal(
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="realtime-sql-modal-title"
                    className="!mt-0 fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 z-50"
                >
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl text-slate-100">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-amber-400" aria-hidden="true" />
                                <h3 id="realtime-sql-modal-title" className="font-extrabold text-sm sm:text-base text-white">
                                    Mã SQL Tạo Bảng Realtime Cloud
                                </h3>
                            </div>
                            <button
                                ref={sqlCloseBtnRef}
                                type="button"
                                aria-label="Đóng hộp thoại mã SQL"
                                onClick={() => setShowSqlModal(false)}
                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                            >
                                <X className="w-5 h-5" aria-hidden="true" />
                            </button>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                            Chạy câu lệnh SQL này trong <strong>SQL Editor</strong> để khởi tạo bảng <code>realtime_store_sessions</code> với ràng buộc <code>UNIQUE(store_name)</code> (mỗi ST chỉ lưu 1 phiên realtime duy nhất).
                        </p>

                        <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto max-h-60 leading-relaxed">
                            {REALTIME_STORE_SESSIONS_SQL}
                        </pre>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setShowSqlModal(false)}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                onClick={handleCopySql}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                            >
                                {isCopied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                                <span>{isCopied ? 'Đã sao chép' : 'Sao chép SQL'}</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

