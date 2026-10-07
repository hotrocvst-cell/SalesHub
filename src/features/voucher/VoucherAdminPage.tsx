import React, { useState, useEffect, useMemo } from 'react';
import {
    Ticket,
    Plus,
    RotateCcw,
    Store,
    RefreshCw,
    Sparkles,
    ShieldAlert,
    Database,
    Code,
    Lock,
    QrCode,
    AlertTriangle,
    CheckCircle2,
    Cloud,
    CloudOff,
    UploadCloud,
    Trash2
} from 'lucide-react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { fetchStores, type StoreItem } from '../../core/lib/storage';
import { getShortStoreName, isStoreMatch, formatDate } from '../../core/lib/formatters';
import type { VoucherItem } from './types';
import {
    fetchStoreVouchers,
    analyzeHoardingRisks,
    resetClaimedVoucher,
    markVoucherUsed,
    deleteVoucher,
    deleteVouchersBatch,
    checkSupabaseVoucherTable,
    syncLocalVouchersToCloud,
    type SupabaseStorageStatus,
    STORE_VOUCHERS_SQL
} from './services/voucherService';
import VoucherAdminStats from './components/VoucherAdminStats';
import VoucherHoardingTable from './components/VoucherHoardingTable';
import VoucherListTable from './components/VoucherListTable';
import VoucherImportModal from './components/VoucherImportModal';
import VoucherResetModal from './components/VoucherResetModal';
import VoucherQrDoubleCheckModal from './components/VoucherQrDoubleCheckModal';
import VoucherCleanModal from './components/VoucherCleanModal';

export default function VoucherAdminPage() {
    const { currentUser, isAdmin, canConfigure } = useAuth();
    const canManageVouchers = isAdmin || canConfigure || ['ADMIN', 'QUAN_LY', 'TRUONG_CA'].includes(currentUser.role);

    const [stores, setStores] = useState<StoreItem[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [toastMessage, setToastMessage] = useState<string>('');
    const [cloudStatus, setCloudStatus] = useState<SupabaseStorageStatus | null>(null);
    const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

    // Modal state
    const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
    const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
    const [isCleanModalOpen, setIsCleanModalOpen] = useState<boolean>(false);
    const [qrModalVouchers, setQrModalVouchers] = useState<VoucherItem[]>([]);
    const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');
    const [filterStatusFromStats, setFilterStatusFromStats] = useState<string>('ALL');
    const [showSqlModal, setShowSqlModal] = useState<boolean>(false);

    const accessible = useMemo(() => {
        return currentUser.accessible_stores && currentUser.accessible_stores.length > 0
            ? currentUser.accessible_stores
            : (currentUser.store_name ? [currentUser.store_name] : []);
    }, [currentUser]);

    // Phân quyền siêu thị cho quản lý xem số liệu
    const allowedStores = useMemo<StoreItem[]>(() => {
        if (!stores || stores.length === 0) return [];
        if (isAdmin) return stores;
        if (accessible.length === 0) return stores;
        return stores.filter(s => accessible.some(acc => isStoreMatch(s.name, acc, stores)));
    }, [stores, accessible, isAdmin]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [storesRes, voucherList, statusRes] = await Promise.all([
                fetchStores(),
                fetchStoreVouchers(selectedStore, accessible),
                checkSupabaseVoucherTable()
            ]);
            if (storesRes.success) setStores(storesRes.data);
            setVouchers(voucherList);
            setCloudStatus(statusRes);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncToCloud = async () => {
        setIsSyncingCloud(true);
        try {
            const res = await syncLocalVouchersToCloud();
            if (res.success) {
                showToast(`✅ Đã đồng bộ thành công ${res.syncedCount} mã lên Supabase Cloud!`);
                await loadData();
            } else {
                showToast(`❌ Lỗi đồng bộ: ${res.error}`);
            }
        } finally {
            setIsSyncingCloud(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedStore, accessible]);

    // Các chương trình hiện có để gợi ý trong modal nạp
    const existingCampaigns = useMemo(() => {
        const set = new Set<string>();
        vouchers.forEach(v => set.add(v.campaign_name.trim()));
        return Array.from(set).sort();
    }, [vouchers]);

    // Danh sách cảnh báo đầu cơ
    const hoardingAlerts = useMemo(() => {
        return analyzeHoardingRisks(vouchers, selectedStore, accessible);
    }, [vouchers, selectedStore, accessible]);

    const handleResetVoucher = async (code: string) => {
        const confirm = window.confirm(`Bạn có chắc muốn reset mã "${code}" về danh sách chờ khả dụng?`);
        if (!confirm) return;

        const res = await resetClaimedVoucher(code, currentUser.full_name || 'Quản lý', selectedStore, accessible);
        if (res.success) {
            showToast(`✅ Đã reset mã "${code}" về kho chờ!`);
            loadData();
        } else {
            showToast(`❌ Lỗi: ${res.error}`);
        }
    };

    const handleMarkUsed = async (code: string) => {
        const res = await markVoucherUsed(code);
        if (res.success) {
            showToast(`✅ Đã đánh dấu mã "${code}" đã sử dụng!`);
            loadData();
        }
    };

    const handleDeleteSingleVoucher = async (code: string) => {
        const res = await deleteVoucher(code);
        if (res.success) {
            showToast(`🗑️ Đã xóa vĩnh viễn mã "${code}" khỏi kho!`);
            loadData();
        } else {
            showToast(`❌ Lỗi khi xóa: ${res.error}`);
        }
    };

    const handleDeleteMultipleVouchers = async (codes: string[]) => {
        const res = await deleteVouchersBatch(codes);
        if (res.success) {
            showToast(`🗑️ Đã xóa thành công ${res.deletedCount} mã voucher khỏi kho!`);
            loadData();
        } else {
            showToast(`❌ Lỗi khi xóa: ${res.error}`);
        }
    };

    // Thống kê mã quá hạn phục vụ cảnh báo tồn kho
    const todayStr = new Date().toISOString().slice(0, 10);
    const expiredVouchers = useMemo(() => {
        return vouchers.filter(v => Boolean(v.expires_at && v.expires_at < todayStr && v.status !== 'USED'));
    }, [vouchers, todayStr]);
    const expiredCount = expiredVouchers.length;
    const expiredTotalValue = useMemo(() => {
        return expiredVouchers.reduce((sum, v) => sum + (Number(v.denomination) || 0), 0);
    }, [expiredVouchers]);

    const handleOpenQrDoubleCheck = (customList?: VoucherItem[]) => {
        if (customList && customList.length > 0) {
            setQrModalVouchers(customList);
            setIsQrModalOpen(true);
            return;
        }

        // Lấy danh sách mã CLAIMED (chưa double check) trong kho hiện tại
        const claimedList = vouchers.filter(v => v.status === 'CLAIMED');
        if (claimedList.length > 0) {
            setQrModalVouchers(claimedList);
            setIsQrModalOpen(true);
        } else if (vouchers.length > 0) {
            showToast('ℹ️ Không có mã nào đang ở trạng thái CLAIMED. Đang hiển thị toàn bộ mã khả dụng.');
            setQrModalVouchers(vouchers);
            setIsQrModalOpen(true);
        } else {
            showToast('⚠️ Kho voucher hiện tại đang trống!');
        }
    };

    if (!canManageVouchers) {
        return (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center font-avo max-w-md mx-auto my-12">
                <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                <h2 className="text-base font-black text-slate-900">Quyền Truy Cập Bị Giới Hạn</h2>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Phân hệ Quản Lý Kho Voucher chỉ dành riêng cho Quản lý siêu thị, Trưởng ca và Quản trị viên (Admin).
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-16 font-avo">
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-in fade-in">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* 1. HEADER & THANH TÁC VỤ */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shrink-0">
                        <Ticket className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 flex-wrap">
                            <span>Quản Trị Kho Mã Voucher</span>
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                QL / TC / Admin
                            </span>
                            {cloudStatus && cloudStatus.tableExists ? (
                                <span className="text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1" title="Dữ liệu lưu trữ và đồng bộ đám mây Supabase">
                                    <Cloud className="w-3 h-3 text-emerald-600" />
                                    <span>Cloud OK ({cloudStatus.cloudCount ?? vouchers.length} mã)</span>
                                </span>
                            ) : cloudStatus && !cloudStatus.tableExists ? (
                                <span className="text-[10px] font-bold bg-amber-100 border border-amber-300 text-amber-900 px-2 py-0.5 rounded-full flex items-center gap-1" title="Chưa tạo bảng trên Supabase">
                                    <CloudOff className="w-3 h-3 text-amber-700" />
                                    <span>Chưa Có Bảng Cloud</span>
                                </span>
                            ) : null}
                        </h1>
                        <p className="text-xs text-slate-500 hidden sm:block">
                            Nạp mã phiếu, double check mã chưa dùng, phát hiện đầu cơ & reset về danh sách chờ
                        </p>
                    </div>
                </div>

                {/* Các nút hành động */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => handleOpenQrDoubleCheck()}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-[0.99] text-white text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1.5"
                        title="Tạo mã QR code quét trên máy POS để double check"
                    >
                        <QrCode className="w-4 h-4 text-amber-300" />
                        <span>Tạo QR Double Check</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsImportModalOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nạp Mã Mới</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsResetModalOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span>Reset Mã Đã Lấy</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsCleanModalOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1.5"
                        title="Dọn dẹp mã hết hạn hoặc đã dùng để làm sạch kho"
                    >
                        <Trash2 className="w-4 h-4 text-rose-600" />
                        <span>Làm Sạch Kho</span>
                    </button>

                    {cloudStatus && cloudStatus.tableExists && (
                        <button
                            type="button"
                            onClick={handleSyncToCloud}
                            disabled={isSyncingCloud}
                            className="p-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                            title="Đồng bộ lại dữ liệu lên Cloud"
                        >
                            <UploadCloud className={`w-4 h-4 ${isSyncingCloud ? 'animate-bounce text-emerald-600' : ''}`} />
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowSqlModal(true)}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                        title="Xem mã lệnh SQL Supabase"
                    >
                        <Code className="w-4 h-4" />
                    </button>

                    <button
                        type="button"
                        onClick={loadData}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                        title="Tải lại số liệu"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* BANNER CẢNH BÁO: BẢNG SUPABASE CHƯA TỒN TẠI */}
            {cloudStatus && !cloudStatus.tableExists && (
                <div className="bg-gradient-to-r from-amber-50 via-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl p-4 sm:p-5 shadow-xs text-slate-800 space-y-3 animate-in fade-in">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
                            <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                                    Cảnh Báo: Bảng Lưu Trữ Voucher Chưa Được Tạo Trên Supabase Cloud
                                </h3>
                                <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                                    Đang lưu tạm LocalStorage
                                </span>
                            </div>
                            <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                                Bảng <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300 text-rose-700 font-bold">public.store_vouchers</code> chưa được tạo trong PostgreSQL trên Supabase.
                                Dữ liệu coupon hiện chỉ lưu tạm trên trình duyệt của máy tính này. Các thiết bị khác và điện thoại smartphone của nhân viên <strong>sẽ chưa thể truy cập được kho mã</strong>.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-1 sm:pl-13">
                        <button
                            type="button"
                            onClick={() => setShowSqlModal(true)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm flex items-center gap-1.5"
                        >
                            <Code className="w-4 h-4 text-amber-300" />
                            <span>Xem Lệnh SQL & Hướng Dẫn Kích Hoạt Cloud (1 Phút)</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleSyncToCloud}
                            disabled={isSyncingCloud}
                            className="px-4 py-2 bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                            <span>{isSyncingCloud ? 'Đang kiểm tra & đồng bộ...' : 'Đã tạo bảng trên Supabase? Thử đồng bộ lại'}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* 2. CHỌN SIÊU THỊ & PHẠM VI DỮ LIỆU */}
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between gap-3 text-xs flex-wrap">
                <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-600">Phạm Vi Xem:</span>
                    <select
                        value={selectedStore}
                        onChange={(e) => setSelectedStore(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 cursor-pointer max-w-[240px] truncate"
                    >
                        <option value="all">🏢 Toàn Cụm Siêu Thị (Kho Chung)</option>
                        {allowedStores.map(s => (
                            <option key={s.id || s.name} value={s.name}>
                                🏪 {getShortStoreName(s.name)}
                            </option>
                        ))}
                    </select>
                </div>

                {filterEmployeeId && (
                    <div className="flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-200 text-indigo-900 px-3 py-1 rounded-xl">
                        <span>Đang lọc theo NV: <strong>{filterEmployeeId}</strong></span>
                        <button
                            type="button"
                            onClick={() => setFilterEmployeeId('')}
                            className="font-black text-rose-600 hover:underline cursor-pointer"
                        >
                            Xóa lọc
                        </button>
                    </div>
                )}
            </div>

            {/* BANNER CẢNH BÁO TỒN KHO MÃ HẾT HẠN */}
            {expiredCount > 0 && (
                <div className="bg-gradient-to-r from-rose-50 via-rose-50/80 to-amber-50/90 border-2 border-rose-300 rounded-3xl p-4 sm:p-5 shadow-xs text-slate-800 space-y-2.5 animate-in fade-in">
                    <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
                                <AlertTriangle className="w-5 h-5 text-white" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm font-black text-rose-950 uppercase tracking-wide">
                                        Cảnh Báo Tồn Kho: Có {expiredCount} Mã Coupon Đã Quá Hạn Sử Dụng ({expiredTotalValue.toLocaleString('vi-VN')}đ)
                                    </h3>
                                    <span className="text-[10px] font-bold bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full">
                                        Cần Dọn Dẹp
                                    </span>
                                </div>
                                <p className="text-xs text-rose-900 leading-relaxed">
                                    Các mã này đã hết hạn trước ngày <strong>{formatDate(todayStr)}</strong> nhưng vẫn đang chiếm chỗ trong kho. Hãy làm sạch dữ liệu để tránh cấp nhầm cho nhân viên và giải phóng tồn kho.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                            <button
                                type="button"
                                onClick={() => setFilterStatusFromStats('EXPIRED')}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold transition cursor-pointer"
                            >
                                Xem {expiredCount} Mã
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsCleanModalOpen(true)}
                                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm flex items-center gap-1.5"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Làm Sạch Kho Ngay</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. THẺ THỐNG KÊ TỔNG QUAN */}
            <VoucherAdminStats
                vouchers={vouchers}
                hoardingAlerts={hoardingAlerts}
                onFilterExpired={() => setFilterStatusFromStats('EXPIRED')}
                onOpenCleanModal={() => setIsCleanModalOpen(true)}
            />

            {/* 4. BẢNG THEO DÕI & CẢNH BÁO ĐẦU CƠ TÍCH TRỮ */}
            <VoucherHoardingTable
                alerts={hoardingAlerts}
                onFilterEmployee={(empId) => setFilterEmployeeId(empId)}
            />

            {/* 5. DANH SÁCH MÃ VÀ DOUBLE CHECK */}
            <VoucherListTable
                vouchers={vouchers}
                onResetVoucher={handleResetVoucher}
                onMarkUsed={handleMarkUsed}
                onDeleteVoucher={handleDeleteSingleVoucher}
                onDeleteMultiple={handleDeleteMultipleVouchers}
                onOpenCleanModal={() => setIsCleanModalOpen(true)}
                prefilterEmployeeId={filterEmployeeId}
                prefilterStatus={filterStatusFromStats}
                onOpenQrModal={handleOpenQrDoubleCheck}
            />

            {/* MODAL NẠP MÃ */}
            <VoucherImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                currentUserDisplayName={currentUser.full_name || 'Admin'}
                existingCampaigns={existingCampaigns}
                onSuccess={(added, dup, cloudWarning) => {
                    if (cloudWarning) {
                        showToast(`🎉 Đã nạp ${added} mã! ⚠️ ${cloudWarning}`);
                    } else {
                        showToast(`🎉 Đã nạp thành công ${added} mã voucher (${dup} mã trùng bị bỏ qua)!`);
                    }
                    loadData();
                }}
            />

            {/* MODAL RESET MÃ */}
            <VoucherResetModal
                isOpen={isResetModalOpen}
                onClose={() => setIsResetModalOpen(false)}
                currentStoreName={selectedStore}
                currentUserDisplayName={currentUser.full_name || 'Admin'}
                allVouchers={vouchers}
                onSuccess={(code) => {
                    showToast(`✅ Đã reset thành công mã "${code}" về kho chờ!`);
                    loadData();
                }}
            />

            {/* MODAL LÀM SẠCH KHO DỮ LIỆU */}
            <VoucherCleanModal
                isOpen={isCleanModalOpen}
                onClose={() => setIsCleanModalOpen(false)}
                vouchers={vouchers}
                currentStoreName={selectedStore}
                accessibleStores={accessible}
                onSuccess={(affected, msg) => {
                    showToast(msg);
                    loadData();
                }}
            />

            {/* MODAL QR DOUBLE CHECK */}
            <VoucherQrDoubleCheckModal
                isOpen={isQrModalOpen}
                onClose={() => setIsQrModalOpen(false)}
                vouchers={qrModalVouchers}
                onResetVoucher={async (code) => {
                    const res = await resetClaimedVoucher(code, currentUser.full_name || 'Quản lý', selectedStore, accessible);
                    if (res.success) {
                        showToast(`✅ Đã reset mã "${code}" về kho chờ!`);
                        loadData();
                        return true;
                    } else {
                        showToast(`❌ Lỗi: ${res.error}`);
                        return false;
                    }
                }}
                onMarkUsed={async (code) => {
                    const res = await markVoucherUsed(code);
                    if (res.success) {
                        showToast(`🎉 Đã đánh dấu mã "${code}" là ĐÃ DÙNG!`);
                        loadData();
                        return true;
                    }
                    return false;
                }}
            />

            {/* MODAL HƯỚNG DẪN & XUẤT SQL SUPABASE */}
            {showSqlModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs font-avo animate-in fade-in">
                    <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-emerald-600" />
                                <h3 className="font-black text-sm text-slate-900">
                                    Khởi Tạo Bảng Supabase (store_vouchers)
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowSqlModal(false)}
                                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer rounded-lg hover:bg-slate-100"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Hướng dẫn thao tác 3 bước */}
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-950 space-y-1.5">
                            <div className="font-black text-emerald-900 flex items-center gap-1.5">
                                <span>⚡ Hướng dẫn kích hoạt lưu trữ Cloud (Chỉ cần làm 1 lần):</span>
                            </div>
                            <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-emerald-800 leading-relaxed font-medium">
                                <li>Mở <strong>Supabase Dashboard</strong> dự án SalesHub, chọn mục <strong>SQL Editor</strong> ở menu trái.</li>
                                <li>Bấm <strong>New Query</strong>, dán toàn bộ đoạn mã SQL bên dưới vào ô soạn thảo.</li>
                                <li>Bấm nút <strong>Run</strong> (hoặc nhấn tổ hợp phím <code>Ctrl + Enter</code>) để tạo bảng.</li>
                                <li>Quay lại trang này và bấm nút <strong>"Kiểm Tra & Đồng Bộ Local Lên Cloud"</strong> bên dưới.</li>
                            </ol>
                        </div>

                        {/* Textarea mã SQL */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                                <span>Mã Lệnh SQL Chuẩn (Bao Gồm RLS & Cột Thời Hạn expires_at):</span>
                            </div>
                            <textarea
                                readOnly
                                rows={10}
                                value={STORE_VOUCHERS_SQL}
                                className="w-full bg-slate-950 text-emerald-400 p-3.5 rounded-2xl font-mono text-[11px] border border-slate-800 focus:outline-emerald-500 selection:bg-emerald-800"
                            />
                        </div>

                        {/* Nút hành động */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
                            <button
                                type="button"
                                onClick={handleSyncToCloud}
                                disabled={isSyncingCloud}
                                className="px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-black transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <UploadCloud className={`w-4 h-4 ${isSyncingCloud ? 'animate-bounce' : ''}`} />
                                <span>{isSyncingCloud ? 'Đang đồng bộ...' : 'Kiểm Tra & Đồng Bộ Local Lên Cloud'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(STORE_VOUCHERS_SQL);
                                    showToast('📋 Đã copy lệnh SQL vào bộ nhớ tạm!');
                                }}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm flex items-center gap-1.5"
                            >
                                <Code className="w-4 h-4 text-amber-300" />
                                <span>Sao Chép Lệnh SQL</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
