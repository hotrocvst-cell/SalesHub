import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    Clock,
    CheckCircle2,
    Trash2,
    RefreshCw,
    Package,
    Store,
    RotateCcw,
    ChevronDown,
    ChevronRight,
    AlertCircle,
    Calendar,
    Filter,
    Tag
} from 'lucide-react';
import type { InventoryBalancingSavedConfig } from '../types';
import { fetchAllRebalanceSessions, deleteRebalanceSession } from '../services/inventoryRebalanceService';
import { isStoreMatch } from '../../../core/lib/formatters';

interface RebalanceSessionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetStore: string;
    onApplySession: (session: InventoryBalancingSavedConfig) => void;
}

export default function RebalanceSessionHistoryModal({
    isOpen,
    onClose,
    targetStore,
    onApplySession
}: RebalanceSessionHistoryModalProps) {
    const [allSessions, setAllSessions] = useState<InventoryBalancingSavedConfig[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
    const [filterStore, setFilterStore] = useState<string>('ALL');

    const loadSessions = async () => {
        setIsLoading(true);
        // Tải toàn bộ danh sách phiên (không truyền targetStore để client lọc linh hoạt)
        const res = await fetchAllRebalanceSessions();
        setAllSessions(res.sessions || []);
        setIsLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            loadSessions();
        }
    }, [isOpen]);

    // Khi targetStore thay đổi hoặc allSessions được tải, tự động chọn filterStore phù hợp
    useEffect(() => {
        if (allSessions.length > 0 && targetStore) {
            const hasMatch = allSessions.some(s => isStoreMatch(s.target_store, targetStore));
            if (hasMatch) {
                setFilterStore(targetStore);
            } else {
                setFilterStore('ALL');
            }
        }
    }, [allSessions, targetStore]);

    // Danh sách các siêu thị duy nhất có phiên lưu trữ
    const distinctStores = useMemo(() => {
        const set = new Set<string>();
        allSessions.forEach(s => {
            if (s.target_store) set.add(s.target_store);
        });
        return Array.from(set).sort();
    }, [allSessions]);

    // Danh sách phiên sau khi lọc
    const filteredSessions = useMemo(() => {
        if (filterStore === 'ALL') return allSessions;
        return allSessions.filter(s => isStoreMatch(s.target_store, filterStore));
    }, [allSessions, filterStore]);

    if (!isOpen) return null;

    const handleDelete = async (id?: string) => {
        if (!id) return;
        if (!confirm('Bạn có chắc chắn muốn xóa bản ghi phiên xin hàng này?')) return;
        const ok = await deleteRebalanceSession(id);
        if (ok) {
            setAllSessions(prev => prev.filter(s => s.id !== id));
        } else {
            alert('Không thể xóa bản ghi khỏi máy chủ.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* HEADER */}
                <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
                            <Clock className="w-5 h-5" />
                        </span>
                        <div>
                            <h2 className="text-base sm:text-lg font-black text-slate-800">
                                Lịch Sử Các Phiên Cân Tồn Kho & Xin Hàng
                            </h2>
                            <p className="text-xs text-slate-500">
                                Kiểm tra, xem lại chi tiết và khôi phục các phiên xin hàng đã lưu
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* FILTER / TOOLBAR */}
                <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                        <Store className="w-4 h-4 text-slate-500" />
                        <span className="font-semibold text-slate-700">Lọc theo kho:</span>
                        <select
                            value={filterStore}
                            onChange={(e) => setFilterStore(e.target.value)}
                            className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold text-xs max-w-xs truncate"
                        >
                            <option value="ALL">-- Tất cả siêu thị ({allSessions.length} phiên) --</option>
                            {distinctStores.map(st => {
                                const isCurrent = targetStore && isStoreMatch(st, targetStore);
                                const count = allSessions.filter(s => isStoreMatch(s.target_store, st)).length;
                                return (
                                    <option key={st} value={st}>
                                        {st} ({count} phiên){isCurrent ? ' • Hiện tại' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={loadSessions}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Tải lại</span>
                        </button>
                    </div>
                </div>

                {/* SESSIONS LIST */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                    {isLoading ? (
                        <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                            <span>Đang tải danh sách các phiên...</span>
                        </div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                            <Package className="w-8 h-8 text-slate-300" />
                            <span className="font-bold text-slate-600">
                                {filterStore === 'ALL'
                                    ? 'Chưa có phiên lưu trữ nào trên hệ thống.'
                                    : `Không có phiên lưu trữ nào khớp với siêu thị "${filterStore}".`}
                            </span>
                            {filterStore !== 'ALL' && (
                                <button
                                    type="button"
                                    onClick={() => setFilterStore('ALL')}
                                    className="mt-1 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold hover:bg-blue-100 cursor-pointer text-xs"
                                >
                                    Xem tất cả các siêu thị khác ({allSessions.length} phiên)
                                </button>
                            )}
                        </div>
                    ) : (
                        filteredSessions.map((sess) => {
                            const isExpanded = expandedSessionId === sess.id;
                            const orderedEntries = Object.entries(sess.ordered_items || {}).filter(([_, v]) => v.is_ordered);
                            const orderedCount = orderedEntries.length;
                            const shortageCount = sess.selected_product_codes?.length || sess.snapshot_products?.length || 0;
                            const timeStr = sess.updated_at ? new Date(sess.updated_at).toLocaleString('vi-VN') : 'Vừa xong';
                            const hasSnapshotProducts = sess.snapshot_products && sess.snapshot_products.length > 0;

                            return (
                                <div
                                    key={sess.id || Math.random()}
                                    className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs hover:border-blue-300 transition-all"
                                >
                                    <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                                    <Store className="w-3.5 h-3.5 text-blue-600" />
                                                    {sess.target_store}
                                                </span>
                                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {timeStr}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap text-xs">
                                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-[11px] border border-blue-200">
                                                    {shortageCount} mã hàng thiếu
                                                </span>
                                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {orderedCount} lệnh đã tạo
                                                </span>
                                                {sess.request_percent !== undefined && (
                                                    <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                        Xin {sess.request_percent}%
                                                    </span>
                                                )}
                                                {sess.source_store_filter && (
                                                    <span className="text-[10px] text-slate-500 truncate max-w-[180px]" title={sess.source_store_filter}>
                                                        Lọc nguồn: <b>"{sess.source_store_filter}"</b>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                            {/* Nút Xem chi tiết phiên (Luôn hiển thị) */}
                                            <button
                                                type="button"
                                                onClick={() => setExpandedSessionId(isExpanded ? null : (sess.id || ''))}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer border border-slate-200"
                                                title="Xem chi tiết danh sách sản phẩm & cấu hình phiên này"
                                            >
                                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                <span>Chi tiết</span>
                                            </button>

                                            {/* Nút Nạp phiên */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onApplySession(sess);
                                                    onClose();
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                                                title="Khôi phục toàn bộ dữ liệu & sản phẩm của phiên này vào màn hình làm việc"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                                <span>Nạp phiên này</span>
                                            </button>

                                            {sess.id && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(sess.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Xóa phiên này"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* CHI TIẾT PHIÊN KHI EXPAND */}
                                    {isExpanded && (
                                        <div className="bg-slate-50 border-t border-slate-200 p-3 text-xs space-y-3">
                                            {/* 1. LỆNH ĐÃ TẠO */}
                                            {orderedCount > 0 ? (
                                                <div className="space-y-1.5">
                                                    <div className="font-bold text-emerald-800 flex items-center justify-between text-[11px] uppercase tracking-wider">
                                                        <span>Danh sách {orderedCount} sản phẩm đã tạo lệnh xin hàng:</span>
                                                    </div>
                                                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-200 bg-white rounded-lg border border-slate-200">
                                                        {orderedEntries.map(([key, rec]) => {
                                                            const parts = key.split('__');
                                                            const srcStore = parts[0] || 'Kho';
                                                            const pCode = parts[1] || key;
                                                            const ordTime = rec.ordered_at ? new Date(rec.ordered_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';

                                                            return (
                                                                <div key={key} className="p-2 flex items-center justify-between text-xs gap-2">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <span className="font-bold text-slate-800 shrink-0">
                                                                            {srcStore}
                                                                        </span>
                                                                        <span className="font-mono text-blue-600 font-bold truncate">
                                                                            [{pCode}]
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                                        <span>{ordTime}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-200">
                                                    Phiên này chưa đánh dấu tạo lệnh xin hàng cho sản phẩm nào.
                                                </div>
                                            )}

                                            {/* 2. DANH SÁCH MÃ SẢN PHẨM HÀNG THIẾU ĐÃ LƯU */}
                                            <div className="space-y-1.5">
                                                <div className="font-bold text-slate-700 flex items-center justify-between text-[11px] uppercase tracking-wider">
                                                    <span>Danh sách {shortageCount} mã hàng thiếu trong phiên:</span>
                                                </div>
                                                <div className="max-h-44 overflow-y-auto bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                                                    {hasSnapshotProducts ? (
                                                        sess.snapshot_products?.map((sp) => (
                                                            <div key={sp.product_code} className="p-2 flex items-center justify-between text-xs gap-2">
                                                                <div className="min-w-0 flex items-center gap-2">
                                                                    <span className="font-mono font-bold text-blue-700 shrink-0">
                                                                        [{sp.product_code}]
                                                                    </span>
                                                                    <span className="truncate text-slate-800 font-medium" title={sp.product_name}>
                                                                        {sp.product_name}
                                                                    </span>
                                                                    {sp.category && (
                                                                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded shrink-0 hidden sm:inline">
                                                                            {sp.category}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="font-mono font-bold text-rose-600 shrink-0 text-[11px]">
                                                                    Xin: {sp.request_qty || sess.request_qtys?.[sp.product_code] || 1}
                                                                </span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-2.5 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                                                            {(sess.selected_product_codes || []).map(code => (
                                                                <span
                                                                    key={code}
                                                                    className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-blue-800 border border-slate-200 font-bold"
                                                                >
                                                                    {code}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 3. CẤU HÌNH & BỘ LỌC ĐÃ LƯU */}
                                            <div className="pt-1 border-t border-slate-200/80 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                                                <span className="font-bold flex items-center gap-1">
                                                    <Filter className="w-3 h-3 text-slate-400" />
                                                    Cấu hình:
                                                </span>
                                                <span>Tồn nguồn ≥ <b>{sess.min_source_qty || 2}</b></span>
                                                <span>• Tỷ lệ xin <b>{sess.request_percent ?? 30}%</b></span>
                                                {sess.exclude_keywords && (
                                                    <span className="flex items-center gap-1 text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                                        <Tag className="w-2.5 h-2.5" />
                                                        Loại trừ: <b>"{sess.exclude_keywords}"</b>
                                                    </span>
                                                )}
                                                {sess.selected_categories && sess.selected_categories.length > 0 && (
                                                    <span>• Ngành: <b>{sess.selected_categories.join(', ')}</b></span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
                        <span>Bấm "Nạp phiên này" để khôi phục toàn bộ danh sách sản phẩm và các lệnh đã tạo vào màn hình.</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
