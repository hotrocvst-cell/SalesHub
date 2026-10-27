import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar,
    Cloud,
    HardDrive,
    RefreshCw,
    Edit3,
    Trash2,
    CheckCircle2,
    Plus,
    X,
    Target,
    Users,
    Store as StoreIcon,
    AlertTriangle,
    ArrowRight,
    Search,
    Filter
} from 'lucide-react';
import type { PeriodTargetConfig } from '../types';
import type { StoreItem } from '../../../core/lib/storage';
import {
    fetchAllPeriodTargets,
    deletePeriodTarget,
    syncLocalPeriodTargetsToCloud
} from '../services/periodTargetStorage';
import { formatDate, getShortStoreName, isStoreMatch } from '../../../core/lib/formatters';

interface PeriodTargetSessionManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentStore: string;
    storesList?: StoreItem[];
    isLockedToSingleStore?: boolean;
    onSelectSessionToApply: (session: PeriodTargetConfig) => void;
    onOpenEditSession: (session: PeriodTargetConfig) => void;
    onOpenCreateNew: (store?: string) => void;
}

export default function PeriodTargetSessionManagerModal({
    isOpen,
    onClose,
    currentStore,
    storesList = [],
    isLockedToSingleStore = false,
    onSelectSessionToApply,
    onOpenEditSession,
    onOpenCreateNew
}: PeriodTargetSessionManagerModalProps) {
    const [sessions, setSessions] = useState<PeriodTargetConfig[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [syncingAll, setSyncingAll] = useState<boolean>(false);
    const [actionId, setActionId] = useState<string | null>(null);
    const [toastMsg, setToastMsg] = useState<string>('');

    // State bộ lọc siêu thị và tìm kiếm
    const [selectedFilterStore, setSelectedFilterStore] = useState<string>(currentStore || 'all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 3000);
    };

    const loadSessions = async () => {
        setLoading(true);
        // Tải toàn bộ các phiên để hỗ trợ chuyển đổi bộ lọc siêu thị mượt mà tức thì
        const list = await fetchAllPeriodTargets();
        setSessions(list);
        setLoading(false);
    };

    useEffect(() => {
        if (!isOpen) return;
        setSelectedFilterStore(currentStore || 'all');
        setSearchQuery('');
        loadSessions();
    }, [isOpen, currentStore]);

    const handleSyncAll = async () => {
        setSyncingAll(true);
        const res = await syncLocalPeriodTargetsToCloud();
        setSyncingAll(false);
        if (res.syncedCount > 0) {
            showToast(`✅ Đã đồng bộ ${res.syncedCount} phiên lên Supabase Cloud thành công!`);
        } else if (!res.success) {
            showToast(`⚠️ Không thể đồng bộ. ${res.error || 'Vui lòng kiểm tra kết nối!'}`);
        } else {
            showToast('👍 Tất cả các phiên đã được đồng bộ Cloud!');
        }
        loadSessions();
    };

    const handleDelete = async (id: string, title: string) => {
        if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn phiên target "${title}" không?`)) return;

        setActionId(id);
        const res = await deletePeriodTarget(id);
        setActionId(null);

        if (res.success) {
            showToast('🗑️ Đã xóa phiên target thành công!');
            loadSessions();
        } else {
            showToast(`⚠️ ${res.error || 'Lỗi khi xóa phiên'}`);
        }
    };

    // Danh sách siêu thị khả dụng (hợp nhất từ storesList và các phiên đang có)
    const availableStores = useMemo(() => {
        const map = new Map<string, string>();
        if (storesList && storesList.length > 0) {
            storesList.forEach(s => {
                map.set(s.name, s.short_name || getShortStoreName(s.name));
            });
        }
        sessions.forEach(sess => {
            if (sess.storeName && sess.storeName !== 'all' && !map.has(sess.storeName)) {
                map.set(sess.storeName, getShortStoreName(sess.storeName));
            }
        });
        return Array.from(map.entries()).map(([name, label]) => ({ name, label }));
    }, [storesList, sessions]);

    // Thống kê số lượng phiên theo từng siêu thị
    const storeCounts = useMemo(() => {
        const counts: Record<string, number> = { all: sessions.length };
        sessions.forEach(sess => {
            const rawStore = sess.storeName || 'all';
            counts[rawStore] = (counts[rawStore] || 0) + 1;

            availableStores.forEach(st => {
                if (st.name !== rawStore && isStoreMatch(st.name, rawStore, storesList)) {
                    counts[st.name] = (counts[st.name] || 0) + 1;
                }
            });
        });
        return counts;
    }, [sessions, availableStores, storesList]);

    // Danh sách phiên sau khi lọc theo siêu thị và từ khóa tìm kiếm
    const filteredSessions = useMemo(() => {
        return sessions.filter(sess => {
            // Lọc theo siêu thị
            if (selectedFilterStore !== 'all') {
                const matchesStore = sess.storeName === selectedFilterStore || isStoreMatch(sess.storeName, selectedFilterStore, storesList);
                if (!matchesStore) return false;
            }

            // Lọc theo từ khóa tìm kiếm
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchTitle = (sess.periodTitle || '').toLowerCase().includes(q);
                const matchDate = (sess.fromDate || '').includes(q) || (sess.toDate || '').includes(q);
                const matchStore = (sess.storeName || '').toLowerCase().includes(q) || getShortStoreName(sess.storeName || '').toLowerCase().includes(q);
                if (!matchTitle && !matchDate && !matchStore) return false;
            }

            return true;
        });
    }, [sessions, selectedFilterStore, searchQuery, storesList]);

    const unsyncedCount = sessions.filter(s => !s.isCloudStored).length;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in font-avo">
            <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* HEADER MODAL */}
                <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-600/30 rounded-xl border border-indigo-400/30 text-indigo-400">
                            <Target className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
                                <span>Quản lý Các Phiên Target Giai Đoạn</span>
                                <span className="text-[10px] bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                                    {filteredSessions.length} / {sessions.length} phiên
                                </span>
                            </h2>
                            <p className="text-[11px] text-slate-400">
                                Kiểm tra trạng thái lưu Cloud / Local và chuyển đổi nhanh giữa các đợt thi đua
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* TOAST MESSAGE */}
                {toastMsg && (
                    <div className="bg-slate-900 text-white px-3 py-2 text-xs font-bold flex items-center gap-2 border-b border-slate-800 animate-fade-in">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{toastMsg}</span>
                    </div>
                )}

                {/* HÀNG 1: BỘ LỌC SIÊU THỊ / CỤM Ở VỊ TRÍ ĐẦU TIÊN (RULE 10 CONVENTION) */}
                <div className="p-3 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* BỘ LỌC SIÊU THỊ */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 hover:border-indigo-400 px-3 py-1.5 rounded-xl text-xs transition-all shadow-2xs w-full sm:w-auto">
                            <StoreIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Siêu thị:</span>
                            <select
                                value={selectedFilterStore}
                                disabled={isLockedToSingleStore}
                                onChange={(e) => setSelectedFilterStore(e.target.value)}
                                className="bg-transparent font-black text-slate-900 text-xs focus:outline-hidden cursor-pointer disabled:cursor-not-allowed w-full sm:min-w-[220px]"
                            >
                                <option value="all">🏢 Tất cả siêu thị ({storeCounts['all'] || 0} phiên)</option>
                                {availableStores.map(st => (
                                    <option key={st.name} value={st.name}>
                                        🏪 {st.label} ({storeCounts[st.name] || 0} phiên)
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Ô TÌM KIẾM NHANH */}
                    <div className="relative flex-1 sm:max-w-xs">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm tên phiên, ngày..."
                            className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 font-medium placeholder:text-slate-400 transition-all shadow-2xs"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* HÀNG 2: THANH NÚT THAO TÁC (THÊM MỚI, LÀM MỚI, ĐỒNG BỘ CLOUD) */}
                <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onOpenCreateNew(selectedFilterStore !== 'all' ? selectedFilterStore : undefined)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Thêm giai đoạn mới</span>
                        </button>

                        <button
                            type="button"
                            onClick={loadSessions}
                            disabled={loading}
                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                            <span className="hidden sm:inline">Làm mới</span>
                        </button>
                    </div>

                    {/* TRẠNG THÁI CLOUD VÀ ĐỒNG BỘ */}
                    <div className="flex items-center gap-2">
                        {unsyncedCount > 0 ? (
                            <button
                                type="button"
                                onClick={handleSyncAll}
                                disabled={syncingAll}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3 h-3 ${syncingAll ? 'animate-spin' : ''}`} />
                                <span>Đồng bộ {unsyncedCount} phiên lên Cloud</span>
                            </button>
                        ) : (
                            <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                                <span>100% Đã lưu Cloud</span>
                            </span>
                        )}
                    </div>
                </div>

                {/* DANH SÁCH CÁC PHIÊN TARGET */}
                <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 bg-slate-50/50">
                    {loading ? (
                        <div className="p-8 text-center text-slate-400 space-y-2">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
                            <p className="text-xs">Đang tải danh sách các phiên cấu hình...</p>
                        </div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 space-y-2 bg-white rounded-2xl border border-dashed border-slate-200 shadow-2xs">
                            <Target className="w-8 h-8 mx-auto text-slate-300" />
                            <p className="text-xs font-bold text-slate-600">
                                {sessions.length === 0
                                    ? 'Chưa có phiên cấu hình Target giai đoạn nào'
                                    : `Không tìm thấy phiên nào thuộc ${selectedFilterStore === 'all' ? 'bộ lọc hiện tại' : getShortStoreName(selectedFilterStore)}`}
                            </p>
                            <p className="text-[11px] text-slate-400">
                                {sessions.length === 0
                                    ? 'Hãy bấm "+ Thêm giai đoạn mới" để thiết lập target riêng cho từng nhân viên theo dải ngày.'
                                    : 'Vui lòng thử chọn siêu thị khác hoặc xóa từ khóa tìm kiếm.'}
                            </p>
                            {selectedFilterStore !== 'all' || searchQuery ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedFilterStore('all');
                                        setSearchQuery('');
                                    }}
                                    className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                    <Filter className="w-3 h-3" />
                                    <span>Xem tất cả siêu thị</span>
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        filteredSessions.map((sess) => {
                            const empCount = Object.keys(sess.targets || {}).length;
                            const isCloud = !!sess.isCloudStored;
                            const isCurrentShop = sess.storeName === currentStore;

                            return (
                                <div
                                    key={sess.id}
                                    className={`p-3 sm:p-3.5 bg-white border rounded-2xl shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                                        isCurrentShop ? 'border-indigo-300 bg-indigo-50/10' : 'border-slate-200 hover:border-indigo-200'
                                    }`}
                                >
                                    {/* THÔNG TIN PHIÊN */}
                                    <div className="space-y-1.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                {sess.periodTitle}
                                            </h3>

                                            {/* BADGE SIÊU THỊ NỔI BẬT */}
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                                                <StoreIcon className="w-3 h-3 text-blue-600 shrink-0" />
                                                <span>{sess.storeName === 'all' ? 'Toàn cụm siêu thị' : getShortStoreName(sess.storeName)}</span>
                                            </span>

                                            {/* BADGE TRẠNG THÁI CLOUD */}
                                            {isCloud ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                    <Cloud className="w-3 h-3 text-emerald-600" />
                                                    <span>Cloud</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full animate-pulse">
                                                    <HardDrive className="w-3 h-3 text-amber-600" />
                                                    <span>Local Cache</span>
                                                </span>
                                            )}
                                        </div>

                                        {/* CHI TIẾT MỐC NGÀY, SHOP, TARGET */}
                                        <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                                            <div className="flex items-center gap-1 font-medium">
                                                <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                                <span>
                                                    <strong>{formatDate(sess.fromDate)}</strong> đến <strong>{formatDate(sess.toDate)}</strong>
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1 font-bold text-emerald-700">
                                                <Target className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                <span>Target: {sess.storeTarget.toLocaleString('vi-VN')} tr</span>
                                            </div>

                                            <div className="flex items-center gap-1 font-medium text-slate-600">
                                                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span>{empCount} nhân sự</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* NÚT THAO TÁC */}
                                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                        <button
                                            type="button"
                                            onClick={() => onSelectSessionToApply(sess)}
                                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                            title="Áp dụng mốc ngày và target của giai đoạn này vào báo cáo"
                                        >
                                            <span>Áp dụng</span>
                                            <ArrowRight className="w-3 h-3" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => onOpenEditSession(sess)}
                                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs transition-all cursor-pointer"
                                            title="Chỉnh sửa chỉ tiêu của đợt này"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleDelete(sess.id, sess.periodTitle)}
                                            disabled={actionId === sess.id}
                                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                                            title="Xóa đợt này"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">
                        Hiển thị <strong>{filteredSessions.length}</strong> / {sessions.length} phiên cấu hình
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}

