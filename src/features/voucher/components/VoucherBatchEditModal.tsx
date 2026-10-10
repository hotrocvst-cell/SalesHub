import React, { useState, useMemo } from 'react';
import {
    X,
    Save,
    Pencil,
    Calendar,
    Store,
    Layers,
    AlertCircle,
    CheckCircle2,
    CheckSquare,
    Square,
    Edit3,
    Sparkles,
    Tag,
    Clock
} from 'lucide-react';
import {
    updateVouchersBatch,
    getDefaultExpiryDate
} from '../services/voucherService';
import type { VoucherItem, VoucherStatus } from '../types';
import { getShortStoreName, isStoreMatch } from '../../../core/lib/formatters';
import { getDenominationHotStyle, formatCurrency, parseCurrencyInput } from '../voucherFormatters';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    selectedVouchers: VoucherItem[];
    currentUserDisplayName: string;
    allowedStores?: Array<{ name: string; id?: string }>;
    accessibleStores?: string[];
    isAdmin?: boolean;
    existingCampaigns: string[];
    onSuccess: (updatedCount: number) => void;
}

const COMMON_DENOMINATIONS = [20000, 30000, 50000, 100000, 200000, 500000, 1000000];

export default function VoucherBatchEditModal({
    isOpen,
    onClose,
    selectedVouchers,
    currentUserDisplayName,
    allowedStores = [],
    accessibleStores = [],
    isAdmin = false,
    existingCampaigns,
    onSuccess
}: Props) {
    // Các công tắc (Toggles) chọn trường nào sẽ được cập nhật hàng loạt
    const [applyScope, setApplyScope] = useState<boolean>(true); // Mặc định bật vì đây là nhu cầu trọng tâm
    const [applyCampaign, setApplyCampaign] = useState<boolean>(false);
    const [applyDenomination, setApplyDenomination] = useState<boolean>(false);
    const [applyExpiresAt, setApplyExpiresAt] = useState<boolean>(false);
    const [applyStatus, setApplyStatus] = useState<boolean>(false);
    const [applyNote, setApplyNote] = useState<boolean>(false);

    // 1. Cụm / Kho
    const [scopeType, setScopeType] = useState<'CLUSTER_ALL' | 'CLUSTER_CUSTOM' | 'SINGLE' | 'GLOBAL'>('CLUSTER_ALL');
    const [selectedStoresInCluster, setSelectedStoresInCluster] = useState<string[]>([]);
    const [singleStoreName, setSingleStoreName] = useState<string>('');

    // 2. Chương trình
    const [campaignName, setCampaignName] = useState<string>('');
    const [customCampaign, setCustomCampaign] = useState<string>('');

    // 3. Mệnh giá
    const [denomination, setDenomination] = useState<number>(50000);

    // 3.1 Diễn giải / Điều kiện sử dụng
    const [applyDescription, setApplyDescription] = useState<boolean>(false);
    const [description, setDescription] = useState<string>('');

    // 4. Hạn dùng
    const [expiresAt, setExpiresAt] = useState<string>(getDefaultExpiryDate());

    // 5. Trạng thái
    const [status, setStatus] = useState<VoucherStatus>('AVAILABLE');
    const [resetClaimed, setResetClaimed] = useState<boolean>(true);

    // 6. Ghi chú
    const [noteText, setNoteText] = useState<string>('');
    const [noteMode, setNoteMode] = useState<'REPLACE' | 'APPEND'>('APPEND');

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');

    // Danh sách siêu thị trong cụm của người dùng
    const clusterStoreNames = useMemo<string[]>(() => {
        if (allowedStores && allowedStores.length > 0) {
            return allowedStores.map(s => s.name);
        }
        if (accessibleStores && accessibleStores.length > 0) {
            return accessibleStores;
        }
        return [];
    }, [allowedStores, accessibleStores]);

    // Khởi tạo danh sách shop khi mở modal
    React.useEffect(() => {
        if (isOpen && clusterStoreNames.length > 0) {
            setSelectedStoresInCluster(clusterStoreNames);
            setSingleStoreName(clusterStoreNames[0]);
            setErrorMsg('');
        }
    }, [isOpen, clusterStoreNames]);

    if (!isOpen || selectedVouchers.length === 0) return null;

    const totalSelectedValue = selectedVouchers.reduce((sum, v) => sum + (Number(v.denomination) || 0), 0);

    const handleToggleStoreCheckbox = (stName: string) => {
        setSelectedStoresInCluster(prev => {
            const has = prev.some(s => isStoreMatch(s, stName));
            if (has) {
                return prev.filter(s => !isStoreMatch(s, stName));
            } else {
                return [...prev, stName];
            }
        });
    };

    const handleSelectAllStoresInCluster = () => {
        if (selectedStoresInCluster.length === clusterStoreNames.length) {
            setSelectedStoresInCluster([]);
        } else {
            setSelectedStoresInCluster([...clusterStoreNames]);
        }
    };

    const handleQuickSetMonthEnd = (addMonths: number = 0) => {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1 + addMonths, 0);
        const yyyy = lastDay.getFullYear();
        const mm = String(lastDay.getMonth() + 1).padStart(2, '0');
        const dd = String(lastDay.getDate()).padStart(2, '0');
        setExpiresAt(`${yyyy}-${mm}-${dd}`);
    };

    const effectiveCampaign = (campaignName === 'NEW' ? customCampaign : campaignName).trim();

    const enabledFieldsCount = [
        applyScope,
        applyCampaign,
        applyDenomination,
        applyDescription,
        applyExpiresAt,
        applyStatus,
        applyNote
    ].filter(Boolean).length;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (enabledFieldsCount === 0) {
            setErrorMsg('Vui lòng chọn ít nhất 1 thuộc tính cần cập nhật hàng loạt!');
            return;
        }

        const updates: any = {};

        // 1. Cập nhật cụm/kho
        if (applyScope) {
            if (scopeType === 'CLUSTER_ALL') {
                updates.store_name = clusterStoreNames[0] || 'Toàn Cụm Siêu Thị';
                updates.cluster_stores = clusterStoreNames;
            } else if (scopeType === 'CLUSTER_CUSTOM') {
                if (selectedStoresInCluster.length === 0) {
                    setErrorMsg('Vui lòng tích chọn ít nhất 1 siêu thị trong cụm!');
                    return;
                }
                updates.store_name = selectedStoresInCluster[0] || 'Toàn Cụm Siêu Thị';
                updates.cluster_stores = selectedStoresInCluster;
            } else if (scopeType === 'SINGLE') {
                if (!singleStoreName) {
                    setErrorMsg('Vui lòng chọn siêu thị áp dụng!');
                    return;
                }
                updates.store_name = singleStoreName;
                updates.cluster_stores = []; // Xóa tag cụm
            } else {
                updates.store_name = 'Toàn Cụm Siêu Thị';
                updates.cluster_stores = [];
            }
        }

        // 2. Cập nhật chương trình
        if (applyCampaign) {
            if (!effectiveCampaign) {
                setErrorMsg('Vui lòng chọn hoặc nhập tên chương trình!');
                return;
            }
            updates.campaign_name = effectiveCampaign;
        }

        // 3. Cập nhật mệnh giá
        if (applyDenomination) {
            if (denomination <= 0) {
                setErrorMsg('Mệnh giá phải lớn hơn 0đ!');
                return;
            }
            updates.denomination = denomination;
        }

        // 3.1 Cập nhật diễn giải / điều kiện sử dụng
        if (applyDescription) {
            updates.description = description.trim() || undefined;
        }

        // 4. Cập nhật HSD
        if (applyExpiresAt) {
            if (!expiresAt) {
                setErrorMsg('Vui lòng chọn ngày hết hạn!');
                return;
            }
            updates.expires_at = expiresAt;
        }

        // 5. Cập nhật trạng thái
        if (applyStatus) {
            updates.status = status;
            updates.resetClaimedInfo = resetClaimed || status === 'AVAILABLE';
        }

        // 6. Cập nhật ghi chú
        if (applyNote) {
            updates.note = noteText.trim();
            updates.appendNote = noteMode === 'APPEND';
        }

        setIsSubmitting(true);
        try {
            const clusterContext = {
                userStoreName: selectedVouchers[0]?.store_name,
                accessibleStores,
                currentUserDisplayName,
                isAdmin
            };

            const ids = selectedVouchers.map(v => v.id);
            const res = await updateVouchersBatch(ids, updates, clusterContext);

            if (!res.success) {
                setErrorMsg(res.error || 'Lỗi khi cập nhật hàng loạt');
                return;
            }

            onSuccess(res.updatedCount);
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'Lỗi không xác định');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs font-avo animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 px-5 py-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-black">
                            <Edit3 className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-black text-sm uppercase tracking-wide">
                                    Cập Nhật Hàng Loạt Voucher
                                </h3>
                                <span className="font-mono text-xs bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full font-black">
                                    {selectedVouchers.length} mã đã chọn
                                </span>
                            </div>
                            <div className="text-[11px] text-indigo-200">
                                Tổng giá trị: <strong>{totalSelectedValue.toLocaleString('vi-VN')}đ</strong> • Người thực hiện: {currentUserDisplayName}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Banner Hướng Dẫn & Tóm Tắt Mã Chọn */}
                <div className="bg-slate-50 border-b border-slate-200 p-3 sm:px-5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Tích chọn những thông tin bạn muốn thay đổi đồng loạt bên dưới.</span>
                    </div>
                    <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0">
                        Sẽ cập nhật {enabledFieldsCount} trường
                    </span>
                </div>

                {/* Form Nội Dung */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
                    {errorMsg && (
                        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* 1. CẬP NHẬT CỤM / KHO ĐƯỢC PHÉP SỬ DỤNG (TRỌNG TÂM) */}
                    <div className={`rounded-2xl border transition p-3 sm:p-3.5 space-y-2.5 ${
                        applyScope ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-50/60 border-slate-200 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setApplyScope(!applyScope)}>
                            <label className="flex items-center gap-2 font-black text-xs text-slate-900 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={applyScope}
                                    onChange={(e) => setApplyScope(e.target.checked)}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <Store className="w-4 h-4 text-emerald-700" />
                                <span className="uppercase">1. Cập Nhật Cụm / Kho Được Phép Sử Dụng</span>
                            </label>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                applyScope ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-200 text-slate-600 border-slate-300'
                            }`}>
                                {applyScope ? 'Đang bật' : 'Bỏ qua'}
                            </span>
                        </div>

                        {applyScope && (
                            <div className="space-y-2.5 pt-1 pl-6">
                                {/* Kiểu phạm vi */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setScopeType('CLUSTER_ALL');
                                            setSelectedStoresInCluster(clusterStoreNames);
                                        }}
                                        className={`p-2 rounded-xl border text-center font-bold text-[11px] transition cursor-pointer ${
                                            scopeType === 'CLUSTER_ALL'
                                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        🏢 Toàn Cụm ({clusterStoreNames.length} Shop)
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setScopeType('CLUSTER_CUSTOM')}
                                        className={`p-2 rounded-xl border text-center font-bold text-[11px] transition cursor-pointer ${
                                            scopeType === 'CLUSTER_CUSTOM'
                                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        ☑️ Tùy Chọn Shop Trong Cụm
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setScopeType('SINGLE');
                                            if (!singleStoreName && clusterStoreNames.length > 0) {
                                                setSingleStoreName(clusterStoreNames[0]);
                                            }
                                        }}
                                        className={`p-2 rounded-xl border text-center font-bold text-[11px] transition cursor-pointer ${
                                            scopeType === 'SINGLE'
                                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        🏪 Riêng 1 Shop Cụ Thể
                                    </button>

                                    {isAdmin && (
                                        <button
                                            type="button"
                                            onClick={() => setScopeType('GLOBAL')}
                                            className={`p-2 rounded-xl border text-center font-bold text-[11px] transition cursor-pointer col-span-2 sm:col-span-3 ${
                                                scopeType === 'GLOBAL'
                                                    ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                                                    : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
                                            }`}
                                        >
                                            🌐 Toàn Quốc / Tất Cả Cụm (Admin)
                                        </button>
                                    )}
                                </div>

                                {/* Checkbox list khi chọn CLUSTER_CUSTOM */}
                                {scopeType === 'CLUSTER_CUSTOM' && (
                                    <div className="bg-white rounded-xl p-2.5 border border-emerald-200 space-y-2 mt-2">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 border-b border-slate-100 pb-1.5">
                                            <span>Chọn các siêu thị được quyền lấy {selectedVouchers.length} mã này:</span>
                                            <button
                                                type="button"
                                                onClick={handleSelectAllStoresInCluster}
                                                className="text-emerald-700 hover:underline cursor-pointer font-black"
                                            >
                                                {selectedStoresInCluster.length === clusterStoreNames.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                                            </button>
                                        </div>
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                            {clusterStoreNames.map(stName => {
                                                const isChecked = selectedStoresInCluster.some(s => isStoreMatch(s, stName));
                                                return (
                                                    <label
                                                        key={stName}
                                                        className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition ${
                                                            isChecked
                                                                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                                                                : 'bg-slate-50 border-slate-200 text-slate-600'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => handleToggleStoreCheckbox(stName)}
                                                            className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                        />
                                                        <span className="truncate">{getShortStoreName(stName)}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <div className="text-[10px] text-slate-400 text-right">
                                            Đã chọn: <strong className="text-emerald-700">{selectedStoresInCluster.length}</strong>/{clusterStoreNames.length} shop
                                        </div>
                                    </div>
                                )}

                                {/* Dropdown chọn 1 shop khi chọn SINGLE */}
                                {scopeType === 'SINGLE' && (
                                    <div className="mt-2">
                                        <select
                                            value={singleStoreName}
                                            onChange={(e) => setSingleStoreName(e.target.value)}
                                            className="w-full bg-white border border-emerald-300 rounded-xl p-2 font-bold text-slate-800 cursor-pointer"
                                        >
                                            {clusterStoreNames.map(s => (
                                                <option key={s} value={s}>
                                                    🏪 {getShortStoreName(s)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 2. CẬP NHẬT CHƯƠNG TRÌNH */}
                    <div className={`rounded-2xl border transition p-3 sm:p-3.5 space-y-2.5 ${
                        applyCampaign ? 'bg-indigo-50/70 border-indigo-300' : 'bg-slate-50/60 border-slate-200 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setApplyCampaign(!applyCampaign)}>
                            <label className="flex items-center gap-2 font-black text-xs text-slate-900 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={applyCampaign}
                                    onChange={(e) => setApplyCampaign(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                                <Layers className="w-4 h-4 text-indigo-700" />
                                <span className="uppercase">2. Cập Nhật Chương Trình Áp Dụng</span>
                            </label>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                applyCampaign ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-200 text-slate-600 border-slate-300'
                            }`}>
                                {applyCampaign ? 'Đang bật' : 'Bỏ qua'}
                            </span>
                        </div>

                        {applyCampaign && (
                            <div className="space-y-2 pt-1 pl-6">
                                <select
                                    value={campaignName}
                                    onChange={(e) => setCampaignName(e.target.value)}
                                    className="w-full bg-white border border-indigo-300 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-indigo-600 cursor-pointer"
                                >
                                    <option value="">-- Chọn chương trình --</option>
                                    {existingCampaigns.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                    <option value="NEW">➕ Đổi thành chương trình mới...</option>
                                </select>

                                {campaignName === 'NEW' && (
                                    <input
                                        type="text"
                                        value={customCampaign}
                                        onChange={(e) => setCustomCampaign(e.target.value)}
                                        placeholder="Nhập tên chương trình mới..."
                                        className="w-full bg-white border border-indigo-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-indigo-600"
                                        autoFocus
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    {/* 3. CẬP NHẬT MỆNH GIÁ */}
                    <div className={`rounded-2xl border transition p-3 sm:p-3.5 space-y-2.5 ${
                        applyDenomination ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50/60 border-slate-200 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setApplyDenomination(!applyDenomination)}>
                            <label className="flex items-center gap-2 font-black text-xs text-slate-900 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={applyDenomination}
                                    onChange={(e) => setApplyDenomination(e.target.checked)}
                                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <Tag className="w-4 h-4 text-amber-700" />
                                <span className="uppercase">3. Cập Nhật Mệnh Giá Voucher</span>
                            </label>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                applyDenomination ? 'bg-amber-600 text-white border-amber-700' : 'bg-slate-200 text-slate-600 border-slate-300'
                            }`}>
                                {applyDenomination ? 'Đang bật' : 'Bỏ qua'}
                            </span>
                        </div>

                        {applyDenomination && (
                            <div className="space-y-2 pt-1 pl-6">
                                <div className="flex flex-wrap gap-1.5">
                                    {COMMON_DENOMINATIONS.map(d => {
                                        const hot = getDenominationHotStyle(d);
                                        const isSelected = denomination === d;
                                        return (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => setDenomination(d)}
                                                className={`px-2.5 py-1 rounded-lg font-mono text-xs font-black transition cursor-pointer border flex items-center gap-1 ${
                                                    isSelected
                                                        ? hot.activeClass
                                                        : `${hot.bgClass} ${hot.textClass} ${hot.borderClass} hover:opacity-90`
                                                }`}
                                            >
                                                <span className="text-[10px]">{hot.tagIcon}</span>
                                                <span>{formatCurrency(d)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-500 font-bold shrink-0 text-xs">Mệnh giá tùy chỉnh:</span>
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={denomination > 0 ? denomination.toLocaleString('vi-VN') : ''}
                                            onChange={(e) => setDenomination(parseCurrencyInput(e.target.value))}
                                            placeholder="Nhập mệnh giá..."
                                            className="w-full bg-white border border-amber-300 rounded-xl py-1.5 pl-3 pr-12 font-mono font-black text-sm text-slate-900 focus:outline-amber-600"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                                            VNĐ
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3.1 CẬP NHẬT DIỄN GIẢI / ĐIỀU KIỆN SỬ DỤNG */}
                    <div className={`rounded-2xl border transition p-3 sm:p-3.5 space-y-2.5 ${
                        applyDescription ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-50/60 border-slate-200 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setApplyDescription(!applyDescription)}>
                            <label className="flex items-center gap-2 font-black text-xs text-slate-900 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={applyDescription}
                                    onChange={(e) => setApplyDescription(e.target.checked)}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <Edit3 className="w-4 h-4 text-emerald-700" />
                                <span className="uppercase">4. Cập Nhật Diễn Giải / Điều Kiện Áp Dụng</span>
                            </label>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                applyDescription ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-200 text-slate-600 border-slate-300'
                            }`}>
                                {applyDescription ? 'Đang bật' : 'Bỏ qua'}
                            </span>
                        </div>

                        {applyDescription && (
                            <div className="space-y-2 pt-1 pl-6">
                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                    <span>Nhấn Enter để xuống dòng điều kiện:</span>
                                    {description.trim() && (
                                        <button
                                            type="button"
                                            onClick={() => setDescription('')}
                                            className="text-rose-600 hover:underline font-bold cursor-pointer"
                                        >
                                            Xóa hết
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Nhập các điều kiện áp dụng, mỗi dòng 1 điều kiện:&#10;• Áp dụng cho đơn từ 500.000đ&#10;• Chỉ áp dụng nhóm Gia Dụng & Phụ Kiện&#10;• Không áp dụng cùng CTKM khác"
                                    className="w-full bg-white border border-emerald-300 rounded-xl p-2.5 font-bold text-xs text-slate-900 focus:outline-emerald-600 placeholder:text-slate-400 font-sans leading-relaxed"
                                />
                                <div className="flex flex-wrap items-center gap-1">
                                    {['Đơn từ 300.000đ', 'Đơn từ 500.000đ', 'Đơn từ 1.000.000đ', 'Áp dụng ngành Phụ Kiện', 'Áp dụng ngành Gia Dụng', 'Không áp dụng kèm KM khác', 'HSD trong 7 ngày từ khi cấp'].map(preset => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setDescription(prev => {
                                                const clean = prev.trim();
                                                return clean ? `${clean}\n• ${preset}` : `• ${preset}`;
                                            })}
                                            className="text-[10px] font-semibold bg-white hover:bg-emerald-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200 transition cursor-pointer"
                                        >
                                            + {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. CẬP NHẬT THỜI HẠN SỬ DỤNG (HSD) */}
                    <div className={`rounded-2xl border transition p-3 sm:p-3.5 space-y-2.5 ${
                        applyExpiresAt ? 'bg-sky-50/70 border-sky-300' : 'bg-slate-50/60 border-slate-200 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setApplyExpiresAt(!applyExpiresAt)}>
                            <label className="flex items-center gap-2 font-black text-xs text-slate-900 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={applyExpiresAt}
                                    onChange={(e) => setApplyExpiresAt(e.target.checked)}
                                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                                />
                                <Calendar className="w-4 h-4 text-sky-700" />
                                <span className="uppercase">4. Cập Nhật Thời Hạn Sử Dụng (HSD)</span>
                            </label>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                applyExpiresAt ? 'bg-sky-600 text-white border-sky-700' : 'bg-slate-200 text-slate-600 border-slate-300'
                            }`}>
                                {applyExpiresAt ? 'Đang bật' : 'Bỏ qua'}
                            </span>
                        </div>

                        {applyExpiresAt && (
                            <div className="space-y-2 pt-1 pl-6">
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => handleQuickSetMonthEnd(0)}
                                        className="text-[10px] font-bold text-sky-800 bg-white hover:bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-200 cursor-pointer"
                                    >
                                        Cuối tháng này
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleQuickSetMonthEnd(1)}
                                        className="text-[10px] font-bold text-indigo-800 bg-white hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 cursor-pointer"
                                    >
                                        Cuối tháng sau
                                    </button>
                                </div>
                                <input
                                    type="date"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                    className="w-full bg-white border border-sky-300 rounded-xl p-2 font-bold font-mono text-slate-800 focus:outline-sky-600 cursor-pointer"
                                />
                            </div>
                        )}
                    </div>

                    {/* 5. CẬP NHẬT TRẠNG THÁI */}
                    <div className={`rounded-2xl border transition p-3 sm:p-3.5 space-y-2.5 ${
                        applyStatus ? 'bg-rose-50/70 border-rose-300' : 'bg-slate-50/60 border-slate-200 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setApplyStatus(!applyStatus)}>
                            <label className="flex items-center gap-2 font-black text-xs text-slate-900 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={applyStatus}
                                    onChange={(e) => setApplyStatus(e.target.checked)}
                                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                                />
                                <Clock className="w-4 h-4 text-rose-700" />
                                <span className="uppercase">5. Cập Nhật Trạng Thái Kho Mã</span>
                            </label>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                applyStatus ? 'bg-rose-600 text-white border-rose-700' : 'bg-slate-200 text-slate-600 border-slate-300'
                            }`}>
                                {applyStatus ? 'Đang bật' : 'Bỏ qua'}
                            </span>
                        </div>

                        {applyStatus && (
                            <div className="space-y-2 pt-1 pl-6">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                    {(['AVAILABLE', 'CLAIMED', 'USED', 'EXPIRED'] as VoucherStatus[]).map(st => (
                                        <button
                                            key={st}
                                            type="button"
                                            onClick={() => setStatus(st)}
                                            className={`py-2 px-1 rounded-xl text-center font-bold text-[11px] border transition cursor-pointer ${
                                                status === st
                                                    ? 'bg-rose-600 text-white border-rose-700'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            {st === 'AVAILABLE' ? '✅ Khả Dụng' : st === 'CLAIMED' ? '⏳ Đã Cấp' : st === 'USED' ? '🎉 Đã Dùng' : '⚠️ Hết Hạn'}
                                        </button>
                                    ))}
                                </div>

                                <label className="flex items-center gap-2 pt-1 cursor-pointer font-bold text-amber-900">
                                    <input
                                        type="checkbox"
                                        checked={resetClaimed}
                                        onChange={(e) => setResetClaimed(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                                    />
                                    <span>Xóa sạch thông tin cấp phát & đơn hàng cũ (đưa về kho sẵn sàng)</span>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* 6. CẬP NHẬT GHI CHÚ */}
                    <div className={`rounded-2xl border transition p-3 sm:p-3.5 space-y-2.5 ${
                        applyNote ? 'bg-slate-100 border-slate-300' : 'bg-slate-50/60 border-slate-200 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setApplyNote(!applyNote)}>
                            <label className="flex items-center gap-2 font-black text-xs text-slate-900 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={applyNote}
                                    onChange={(e) => setApplyNote(e.target.checked)}
                                    className="w-4 h-4 rounded text-slate-700 focus:ring-slate-500 cursor-pointer"
                                />
                                <Pencil className="w-4 h-4 text-slate-700" />
                                <span className="uppercase">6. Cập Nhật Ghi Chú</span>
                            </label>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                applyNote ? 'bg-slate-700 text-white border-slate-800' : 'bg-slate-200 text-slate-600 border-slate-300'
                            }`}>
                                {applyNote ? 'Đang bật' : 'Bỏ qua'}
                            </span>
                        </div>

                        {applyNote && (
                            <div className="space-y-2 pt-1 pl-6">
                                <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="noteMode"
                                            value="APPEND"
                                            checked={noteMode === 'APPEND'}
                                            onChange={() => setNoteMode('APPEND')}
                                        />
                                        <span>Nối thêm vào ghi chú cũ</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="noteMode"
                                            value="REPLACE"
                                            checked={noteMode === 'REPLACE'}
                                            onChange={() => setNoteMode('REPLACE')}
                                        />
                                        <span>Ghi đè hoàn toàn</span>
                                    </label>
                                </div>
                                <textarea
                                    rows={2}
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    placeholder="Nội dung ghi chú muốn cập nhật..."
                                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-800 focus:outline-slate-600 resize-none"
                                />
                            </div>
                        )}
                    </div>
                </form>

                {/* Footer Hành Động */}
                <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-[11px] text-slate-500 font-bold">
                        Đang chọn <strong className="text-indigo-700">{selectedVouchers.length}</strong> mã voucher
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting || enabledFieldsCount === 0}
                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-[0.99] text-white text-xs font-black transition cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4 text-amber-300" />
                            <span>{isSubmitting ? 'Đang cập nhật...' : `Cập Nhật ${selectedVouchers.length} Mã`}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
