import React, { useState } from 'react';
import {
    X,
    Database,
    Trash2,
    Edit3,
    Check,
    RefreshCw,
    Clock,
    AlertTriangle,
    Store,
    Calendar,
    User,
    CheckCircle2,
    ShieldAlert
} from 'lucide-react';
import type { StoreItem } from '../../../core/lib/storage';
import { formatValue, formatStoreDisplayName, formatDate } from '../../../core/lib/formatters';
import {
    deleteRealtimeStoreSession,
    renameRealtimeStoreSession,
    deleteAllRealtimeStoreSessions,
    type RealtimeStoreSessionRecord
} from '../services/realtimeSessionService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    sessions: RealtimeStoreSessionRecord[];
    availableStores: StoreItem[];
    onRefresh: () => Promise<void> | void;
    onSessionsUpdated: () => void;
}

export default function RealtimeSessionManagerModal({
    isOpen,
    onClose,
    sessions,
    availableStores,
    onRefresh,
    onSessionsUpdated
}: Props) {
    if (!isOpen) return null;

    const [editingStoreName, setEditingStoreName] = useState<string | null>(null);
    const [newStoreNameInput, setNewStoreNameInput] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');

    const showMsg = (type: 'success' | 'error', text: string) => {
        setActionMsg({ type, text });
        setTimeout(() => setActionMsg(null), 3000);
    };

    // Bắt đầu sửa tên ST
    const handleStartEdit = (currentName: string) => {
        setEditingStoreName(currentName);
        setNewStoreNameInput(currentName);
        setDeleteConfirmTarget(null);
    };

    // Hủy sửa tên
    const handleCancelEdit = () => {
        setEditingStoreName(null);
        setNewStoreNameInput('');
    };

    // Lưu tên ST mới
    const handleSaveNewName = async (oldName: string) => {
        if (!newStoreNameInput.trim()) {
            showMsg('error', 'Tên ST không được để trống!');
            return;
        }
        if (newStoreNameInput.trim() === oldName.trim()) {
            handleCancelEdit();
            return;
        }

        setIsProcessing(true);
        const res = await renameRealtimeStoreSession(oldName, newStoreNameInput.trim());
        setIsProcessing(false);

        if (res.success) {
            showMsg('success', `✅ Đã đổi tên ST thành "${newStoreNameInput.trim()}"!`);
            handleCancelEdit();
            onSessionsUpdated();
        } else {
            showMsg('error', `❌ Lỗi: ${res.error || 'Không thể đổi tên ST'}`);
        }
    };

    // Xóa 1 phiên
    const handleDeleteSession = async (storeName: string) => {
        setIsProcessing(true);
        const res = await deleteRealtimeStoreSession(storeName);
        setIsProcessing(false);
        setDeleteConfirmTarget(null);

        if (res.success) {
            showMsg('success', `🗑️ Đã xóa phiên realtime của "${formatStoreDisplayName(storeName)}"!`);
            onSessionsUpdated();
        } else {
            showMsg('error', `❌ Lỗi: ${res.error || 'Không thể xóa phiên'}`);
        }
    };

    // Xóa toàn bộ phiên
    const handleDeleteAll = async () => {
        if (!window.confirm('⚠️ CẢNH BÁO QUAN TRỌNG:\n\nBạn có chắc chắn muốn XÓA TOÀN BỘ các phiên Realtime trên Supabase Cloud?\nThao tác này không thể hoàn tác!')) {
            return;
        }
        if (!window.confirm('Xác nhận lần 2: Nhấn OK để xóa sạch toàn bộ các phiên Realtime hiện có.')) {
            return;
        }

        setIsProcessing(true);
        const res = await deleteAllRealtimeStoreSessions();
        setIsProcessing(false);

        if (res.success) {
            showMsg('success', '🧹 Đã xóa sạch toàn bộ các phiên Realtime trên Cloud!');
            onSessionsUpdated();
        } else {
            showMsg('error', `❌ Lỗi: ${res.error || 'Không thể dọn dẹp phiên'}`);
        }
    };

    // Làm mới danh sách
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefresh();
        setIsRefreshing(false);
        showMsg('success', '🔄 Đã làm mới danh sách phiên từ Cloud!');
    };

    // Lọc theo tìm kiếm
    const filteredSessions = sessions.filter(s => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
            s.store_name.toLowerCase().includes(q) ||
            (s.updated_by && s.updated_by.toLowerCase().includes(q)) ||
            (s.screenshot_time_str && s.screenshot_time_str.toLowerCase().includes(q))
        );
    });

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* 1. HEADER MODAL */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between gap-3 shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
                            <Database className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                                    Quản Lý Phiên Realtime Cloud
                                </h2>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                                    <ShieldAlert className="w-3 h-3 text-rose-400" />
                                    ADMIN ONLY
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Danh sách các phiên độc lập lưu trên bảng Supabase <code className="text-indigo-300">realtime_store_sessions</code>
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 2. THANH THÔNG BÁO NỘI BỘ */}
                {actionMsg && (
                    <div className={`px-4 py-2 text-xs font-bold text-center animate-fade-in shrink-0 ${
                        actionMsg.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}>
                        {actionMsg.text}
                    </div>
                )}

                {/* 3. THANH THỐNG KÊ & TÌM KIẾM */}
                <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-700">
                            Tổng số phiên: <strong className="text-blue-700 font-extrabold">{sessions.length}</strong> ST
                        </span>
                        <span className="text-slate-300">•</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm theo tên ST, người cập nhật..."
                            className="bg-white border border-slate-300 text-slate-800 text-xs py-1.5 px-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                        />
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing || isProcessing}
                            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                            <span>Làm Mới</span>
                        </button>

                        {sessions.length > 0 && (
                            <button
                                type="button"
                                onClick={handleDeleteAll}
                                disabled={isProcessing}
                                className="px-3 py-1.5 bg-rose-50 border border-rose-300 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                                title="Xóa toàn bộ các phiên Realtime để dọn dẹp hệ thống"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa Toàn Bộ</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* 4. DANH SÁCH CÁC PHIÊN CUỘN DỌC */}
                <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3 flex-1">
                    {filteredSessions.length === 0 ? (
                        <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                            <Store className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                            <p className="text-sm font-bold text-slate-600">
                                {searchTerm ? 'Không tìm thấy phiên nào khớp với từ khóa tìm kiếm.' : 'Chưa có phiên dữ liệu Realtime nào được lưu trên Cloud.'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                Khi Quản lý hoặc Admin nạp số liệu thi đua/doanh thu, các phiên sẽ xuất hiện tại đây.
                            </p>
                        </div>
                    ) : (
                        filteredSessions.map((sess, idx) => {
                            const isEditing = editingStoreName === sess.store_name;
                            const isConfirmingDelete = deleteConfirmTarget === sess.store_name;
                            const rev = (sess.revenue_data as any)?.rev || (sess.revenue_data as any)?.rawRev || 0;
                            const tg = (sess.revenue_data as any)?.target || 0;
                            const pct = typeof (sess.revenue_data as any)?.pct === 'number'
                                ? (sess.revenue_data as any).pct
                                : (tg > 0 ? (rev / tg) * 100 : 0);
                            const emuCount = Array.isArray(sess.emulation_data) ? sess.emulation_data.length : 0;

                            return (
                                <div
                                    key={sess.id || sess.store_name || idx}
                                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                                        isEditing
                                            ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-400/30'
                                            : isConfirmingDelete
                                                ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-400/30'
                                                : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                                    }`}
                                >
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        {/* THÔNG TIN ST & PHIÊN */}
                                        <div className="flex-1 space-y-1.5 w-full">
                                            {isEditing ? (
                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-black uppercase text-blue-700 flex items-center gap-1">
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                        <span>Sửa Tên ST (Chuẩn Hóa):</span>
                                                    </label>
                                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={newStoreNameInput}
                                                            onChange={(e) => setNewStoreNameInput(e.target.value)}
                                                            className="flex-1 bg-white border border-blue-400 text-slate-800 text-xs font-bold py-2 px-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                                                            placeholder="Nhập tên chuẩn (ví dụ: 111 - TGD - 290 Trương Công Định)"
                                                        />
                                                        {/* Gợi ý chọn nhanh từ availableStores */}
                                                        {availableStores.length > 0 && (
                                                            <select
                                                                onChange={(e) => {
                                                                    if (e.target.value) setNewStoreNameInput(e.target.value);
                                                                }}
                                                                defaultValue=""
                                                                className="bg-white border border-slate-300 text-slate-700 text-xs py-2 px-2.5 rounded-xl cursor-pointer"
                                                            >
                                                                <option value="" disabled>📋 Chọn tên mẫu có sẵn...</option>
                                                                {availableStores.map(st => (
                                                                    <option key={st.name} value={st.name}>
                                                                        {st.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSaveNewName(sess.store_name)}
                                                            disabled={isProcessing}
                                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                            <span>Lưu Tên Mới</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleCancelEdit}
                                                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                                                        >
                                                            Hủy
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                                                            {formatStoreDisplayName(sess.store_name)}
                                                        </span>
                                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300">
                                                            Raw: {sess.store_name}
                                                        </span>
                                                    </div>

                                                    {/* THÔNG SỐ TÓM TẮT CỦA PHIÊN */}
                                                    <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600 pt-0.5">
                                                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg font-bold">
                                                            <Clock className="w-3 h-3 text-amber-600" />
                                                            <span>Phiên: {sess.screenshot_time_str || (sess.session_time ? formatDate(sess.session_time) : 'N/A')}</span>
                                                        </span>

                                                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded-lg font-bold">
                                                            <span>💰 DTQĐ: <strong>{formatValue(rev)} tr</strong></span>
                                                            {tg > 0 && <span>/ {formatValue(tg)} tr ({pct.toFixed(1)}%)</span>}
                                                        </span>

                                                        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-900 border border-purple-200 px-2 py-0.5 rounded-lg font-bold">
                                                            <span>🎯 {emuCount} chỉ tiêu thi đua</span>
                                                        </span>

                                                        <span className="inline-flex items-center gap-1 text-slate-500 text-[11px]">
                                                            <User className="w-3 h-3 text-slate-400" />
                                                            <span>Lưu bởi: <strong>{sess.updated_by || 'ADMIN'}</strong></span>
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* HÀNH ĐỘNG SỬA / XÓA */}
                                        {!isEditing && (
                                            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                                                {isConfirmingDelete ? (
                                                    <div className="flex items-center gap-1.5 p-1 bg-rose-100 border border-rose-300 rounded-xl animate-fade-in">
                                                        <span className="text-[11px] font-bold text-rose-800 px-1.5">
                                                            Xác nhận xóa?
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteSession(sess.store_name)}
                                                            disabled={isProcessing}
                                                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                                                        >
                                                            Xóa Ngay
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeleteConfirmTarget(null)}
                                                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                                                        >
                                                            Hủy
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStartEdit(sess.store_name)}
                                                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                                            title="Đổi tên / Chuẩn hóa tên ST"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                            <span>Sửa Tên</span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => setDeleteConfirmTarget(sess.store_name)}
                                                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                                            title="Xóa phiên realtime này"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            <span>Xóa</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 5. FOOTER */}
                <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
                    <span className="text-[11px] text-slate-500">
                        * Xóa các phiên cũ hoặc trùng tên sẽ giúp số liệu Toàn Cụm và Dropdown hiển thị chính xác nhất.
                    </span>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                        Đóng Quản Lý
                    </button>
                </div>
            </div>
        </div>
    );
}

