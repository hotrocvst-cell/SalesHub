import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Save,
    Pencil,
    Calendar,
    Store,
    Layers,
    AlertCircle,
    CheckCircle2,
    RotateCcw,
    Sparkles,
    CheckSquare,
    Square,
    Clock
} from 'lucide-react';
import type { VoucherItem, VoucherStatus } from '../types';
import {
    updateVoucher,
    getDefaultExpiryDate,
    extractClusterStoresFromNote
} from '../services/voucherService';
import { getShortStoreName, isStoreMatch, formatDateTime } from '../../../core/lib/formatters';
import { getDenominationHotStyle, formatCurrency, parseCurrencyInput } from '../voucherFormatters';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    voucher: VoucherItem | null;
    currentUserDisplayName: string;
    allowedStores?: Array<{ name: string; id?: string }>;
    accessibleStores?: string[];
    isAdmin?: boolean;
    existingCampaigns: string[];
    onSuccess: (updatedVoucher: VoucherItem) => void;
}

const COMMON_DENOMINATIONS = [20000, 30000, 50000, 100000, 200000, 500000, 1000000];

export default function VoucherEditModal({
    isOpen,
    onClose,
    voucher,
    currentUserDisplayName,
    allowedStores = [],
    accessibleStores = [],
    isAdmin = false,
    existingCampaigns,
    onSuccess
}: Props) {
    const [code, setCode] = useState<string>('');
    const [scopeType, setScopeType] = useState<'CLUSTER_ALL' | 'CLUSTER_CUSTOM' | 'SINGLE' | 'GLOBAL'>('CLUSTER_ALL');
    const [selectedStoresInCluster, setSelectedStoresInCluster] = useState<string[]>([]);
    const [singleStoreName, setSingleStoreName] = useState<string>('');
    const [campaignName, setCampaignName] = useState<string>('');
    const [customCampaign, setCustomCampaign] = useState<string>('');
    const [denomination, setDenomination] = useState<number>(50000);
    const [description, setDescription] = useState<string>('');
    const [expiresAt, setExpiresAt] = useState<string>('');
    const [status, setStatus] = useState<VoucherStatus>('AVAILABLE');
    const [resetClaimed, setResetClaimed] = useState<boolean>(false);
    const [userNote, setUserNote] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');

    // Danh sách ST trong cụm của người dùng
    const clusterStoreNames = useMemo<string[]>(() => {
        if (allowedStores && allowedStores.length > 0) {
            return allowedStores.map(s => s.name);
        }
        if (accessibleStores && accessibleStores.length > 0) {
            return accessibleStores;
        }
        return [];
    }, [allowedStores, accessibleStores]);

    // Khởi tạo giá trị khi voucher thay đổi
    useEffect(() => {
        if (!voucher) return;
        setCode(voucher.code);
        setCampaignName(existingCampaigns.includes(voucher.campaign_name) ? voucher.campaign_name : 'NEW');
        setCustomCampaign(existingCampaigns.includes(voucher.campaign_name) ? '' : voucher.campaign_name);
        setDenomination(Number(voucher.denomination) || 50000);
        setDescription(voucher.description || '');
        setExpiresAt(voucher.expires_at || getDefaultExpiryDate());
        setStatus(voucher.status);
        setResetClaimed(false);
        setErrorMsg('');

        // Lấy ghi chú thuần (bỏ tag CỤM)
        const rawNote = voucher.note || '';
        const cleanedNote = rawNote.replace(/\[CỤM:\s*[^\]]+\]/gi, '').trim();
        setUserNote(cleanedNote);

        // Xác định phạm vi Cụm / Kho từ voucher
        const noteClusters = extractClusterStoresFromNote(voucher.note);
        if (noteClusters.length > 0) {
            // Có danh sách Cụm trong note
            if (clusterStoreNames.length > 0 && noteClusters.length === clusterStoreNames.length &&
                clusterStoreNames.every(s => noteClusters.some(nc => isStoreMatch(nc, s)))) {
                setScopeType('CLUSTER_ALL');
                setSelectedStoresInCluster(clusterStoreNames);
            } else {
                setScopeType('CLUSTER_CUSTOM');
                setSelectedStoresInCluster(noteClusters);
            }
        } else if (voucher.store_name === 'Toàn Cụm ST' || voucher.store_name === 'Toàn Cụm' || voucher.store_name === 'all') {
            if (isAdmin) {
                setScopeType('GLOBAL');
            } else {
                setScopeType('CLUSTER_ALL');
                setSelectedStoresInCluster(clusterStoreNames);
            }
        } else {
            // Gán cho 1 ST cụ thể
            setScopeType('SINGLE');
            setSingleStoreName(voucher.store_name);
            setSelectedStoresInCluster([voucher.store_name]);
        }
    }, [voucher, existingCampaigns, clusterStoreNames, isAdmin]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isSubmitting, onClose]);

    if (!isOpen || !voucher) return null;

    const effectiveCampaign = (campaignName === 'NEW' ? customCampaign : campaignName).trim();

    const handleToggleStoreCheckbox = (stName: string) => {
        setSelectedStoresInCluster(prev => {
            const has = prev.some(s => isStoreMatch(s, stName));
            if (has) {
                const next = prev.filter(s => !isStoreMatch(s, stName));
                return next;
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!code.trim()) {
            setErrorMsg('Vui lòng nhập mã voucher!');
            return;
        }

        if (!effectiveCampaign) {
            setErrorMsg('Vui lòng chọn hoặc nhập tên chương trình!');
            return;
        }

        if (denomination <= 0) {
            setErrorMsg('Mệnh giá voucher phải lớn hơn 0đ!');
            return;
        }

        if (!expiresAt) {
            setErrorMsg('Vui lòng chọn ngày hết hạn sử dụng!');
            return;
        }

        // Xác định store_name và cluster_stores
        let targetStoreName: string;
        let targetClusterStores: string[] | undefined;

        if (scopeType === 'CLUSTER_ALL') {
            targetStoreName = clusterStoreNames[0] || 'Toàn Cụm ST';
            targetClusterStores = clusterStoreNames.length > 0 ? clusterStoreNames : undefined;
        } else if (scopeType === 'CLUSTER_CUSTOM') {
            if (selectedStoresInCluster.length === 0) {
                setErrorMsg('Vui lòng tích chọn ít nhất 1 ST trong cụm được phép sử dụng mã!');
                return;
            }
            targetStoreName = selectedStoresInCluster[0] || 'Toàn Cụm ST';
            targetClusterStores = selectedStoresInCluster;
        } else if (scopeType === 'SINGLE') {
            if (!singleStoreName) {
                setErrorMsg('Vui lòng chọn ST áp dụng cho mã voucher!');
                return;
            }
            targetStoreName = singleStoreName;
            targetClusterStores = []; // Xóa tag cụm
        } else {
            // GLOBAL (Admin)
            targetStoreName = 'Toàn Cụm ST';
            targetClusterStores = [];
        }

        setIsSubmitting(true);
        try {
            const clusterContext = {
                userStoreName: voucher.store_name,
                accessibleStores,
                currentUserDisplayName,
                isAdmin
            };

            const res = await updateVoucher(
                voucher.id,
                {
                    code: code.trim(),
                    campaign_name: effectiveCampaign,
                    denomination,
                    description: description.trim() || undefined,
                    expires_at: expiresAt,
                    status,
                    store_name: targetStoreName,
                    cluster_stores: targetClusterStores,
                    note: userNote.trim() || undefined,
                    resetClaimedInfo: resetClaimed || (status === 'AVAILABLE' && voucher.status !== 'AVAILABLE')
                },
                clusterContext
            );

            if (!res.success || !res.voucher) {
                setErrorMsg(res.error || 'Lỗi khi cập nhật mã voucher');
                return;
            }

            onSuccess(res.voucher);
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'Lỗi không xác định');
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="voucher-edit-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !isSubmitting && onClose()}
        >
            <div
                className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-emerald-800 px-5 py-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center font-black">
                            <Pencil className="w-4 h-4 text-amber-300" aria-hidden="true" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 id="voucher-edit-modal-title" className="font-black text-sm uppercase tracking-wide">
                                    Chỉnh Sửa Mã Coupon
                                </h3>
                                <span className="font-mono text-xs bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black">
                                    {voucher.code}
                                </span>
                            </div>
                            <div className="text-[11px] text-emerald-100">
                                Quản lý cập nhật: <strong>{currentUserDisplayName}</strong>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        aria-label="Đóng hộp thoại chỉnh sửa mã coupon"
                        className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer disabled:opacity-50"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Form Nội Dung */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
                    {errorMsg && (
                        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Thông tin nhập kho ban đầu */}
                    {voucher && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-2.5 flex-wrap">
                            <div className="flex items-center gap-1.5 text-slate-700">
                                <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                                <span className="text-[11px] text-slate-600 font-medium">Thời gian nhập kho:</span>
                                <span className="font-mono font-bold text-slate-900 text-xs">
                                    {voucher.created_at ? formatDateTime(voucher.created_at, true) : 'Chưa ghi nhận'}
                                </span>
                            </div>
                            {voucher.created_by && (
                                <div className="text-[11px] text-slate-600">
                                    Người nạp: <strong className="text-slate-800">{voucher.created_by}</strong>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 1. Mã Coupon Thực Tế */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="voucher-edit-code-input" className="block text-[11px] font-black uppercase text-slate-700 cursor-pointer">
                                1. Mã Voucher (Code) <span className="text-rose-600">*</span>
                            </label>
                            <span className="text-[10px] text-slate-500">Tự động viết hoa</span>
                        </div>
                        <input
                            id="voucher-edit-code-input"
                            name="voucher_edit_code"
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-black text-sm text-slate-900 focus:outline-emerald-600 tracking-wider"
                            placeholder="Nhập mã voucher..."
                            required
                        />
                    </div>

                    {/* 2. CỤM / KHO ĐƯỢC PHÉP SỬ DỤNG (TRỌNG TÂM) */}
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3 sm:p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase text-emerald-950 flex items-center gap-1.5">
                                <Store className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                                <span>2. Cụm / Kho Được Phép Sử Dụng</span>
                                <span className="text-rose-600">*</span>
                            </span>
                            <span className="text-[10px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                                Phân quyền truy cập
                            </span>
                        </div>

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
                                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                🏢 Toàn Cụm ({clusterStoreNames.length} ST)
                            </button>

                            <button
                                type="button"
                                onClick={() => setScopeType('CLUSTER_CUSTOM')}
                                className={`p-2 rounded-xl border text-center font-bold text-[11px] transition cursor-pointer ${
                                    scopeType === 'CLUSTER_CUSTOM'
                                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                ☑️ Tùy Chọn ST Trong Cụm
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
                                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                🏪 Riêng 1 ST Cụ Thể
                            </button>

                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={() => setScopeType('GLOBAL')}
                                    className={`p-2 rounded-xl border text-center font-bold text-[11px] transition cursor-pointer col-span-2 sm:col-span-3 ${
                                        scopeType === 'GLOBAL'
                                            ? 'bg-blue-700 text-white border-blue-800 shadow-sm'
                                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                                    }`}
                                >
                                    🌐 Toàn Quốc / Tất Cả Cụm (Admin)
                                </button>
                            )}
                        </div>

                        {/* Danh sách Checkbox chọn từng ST khi chọn CLUSTER_CUSTOM */}
                        {scopeType === 'CLUSTER_CUSTOM' && (
                            <div className="bg-white rounded-xl p-2.5 border border-emerald-200 space-y-2 mt-2">
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 border-b border-slate-100 pb-1.5">
                                    <span>Tích chọn các ST được quyền lấy mã này:</span>
                                    <button
                                        type="button"
                                        onClick={handleSelectAllStoresInCluster}
                                        className="text-emerald-700 hover:underline cursor-pointer flex items-center gap-1 font-black"
                                    >
                                        {selectedStoresInCluster.length === clusterStoreNames.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                                    </button>
                                </div>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
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
                                <div className="text-[10px] text-slate-600 text-right">
                                    Đã chọn: <strong className="text-emerald-700">{selectedStoresInCluster.length}</strong>/{clusterStoreNames.length} ST
                                </div>
                            </div>
                        )}

                        {/* Dropdown chọn 1 ST khi chọn SINGLE */}
                        {scopeType === 'SINGLE' && (
                            <div className="mt-2">
                                <select
                                    id="voucher-edit-single-store"
                                    name="voucher_edit_single_store"
                                    aria-label="Chọn 1 ST cụ thể"
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

                        <p className="text-[10.5px] text-emerald-900 leading-relaxed">
                            {scopeType === 'CLUSTER_ALL'
                                ? `Mã được cấp cho toàn bộ nhân viên tại ${clusterStoreNames.length} ST thuộc Cụm của bạn.`
                                : scopeType === 'CLUSTER_CUSTOM'
                                ? `Mã chỉ cấp riêng cho nhân viên tại ${selectedStoresInCluster.length} ST đã tích chọn.`
                                : scopeType === 'SINGLE'
                                ? `Mã chỉ cấp cho nhân viên đang làm việc tại ST ${getShortStoreName(singleStoreName)}.`
                                : 'Mã dùng chung cho toàn bộ nhân viên trên toàn quốc.'}
                        </p>
                    </div>

                    {/* 3. Chương Trình Áp Dụng */}
                    <div>
                        <label htmlFor="voucher-edit-campaign" className="block text-[11px] font-black uppercase text-slate-700 mb-1.5 cursor-pointer">
                            3. Chương Trình Áp Dụng <span className="text-rose-500">*</span>
                        </label>
                        <select
                            id="voucher-edit-campaign"
                            name="voucher_edit_campaign"
                            value={campaignName}
                            onChange={(e) => setCampaignName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-emerald-600 cursor-pointer"
                        >
                            {existingCampaigns.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                            <option value="NEW">➕ Đổi thành chương trình mới...</option>
                        </select>

                        {campaignName === 'NEW' && (
                            <input
                                id="voucher-edit-custom-campaign"
                                name="voucher_edit_custom_campaign"
                                type="text"
                                aria-label="Tên chương trình mới"
                                onChange={(e) => setCustomCampaign(e.target.value)}
                                placeholder="Nhập tên chương trình mới..."
                                className="mt-2 w-full bg-white border border-emerald-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-emerald-600"
                                autoFocus
                            />
                        )}
                    </div>

                    {/* 4. Mệnh Giá Voucher */}
                    <div>
                        <span className="block text-[11px] font-black uppercase text-slate-700 mb-1.5">
                            4. Mệnh Giá Voucher <span className="text-rose-500">*</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {COMMON_DENOMINATIONS.map(d => {
                                const hot = getDenominationHotStyle(d);
                                const isSelected = denomination === d;
                                return (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => setDenomination(d)}
                                        className={`px-2.5 py-1.5 rounded-xl font-mono text-xs font-black transition cursor-pointer border flex items-center gap-1 ${
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
                            <label htmlFor="voucher-edit-denomination" className="text-slate-600 font-bold shrink-0 text-xs cursor-pointer">
                                Mệnh giá tùy chỉnh:
                            </label>
                            <div className="relative flex-1">
                                <input
                                    id="voucher-edit-denomination"
                                    name="voucher_edit_denomination"
                                    type="text"
                                    inputMode="numeric"
                                    value={denomination > 0 ? denomination.toLocaleString('vi-VN') : ''}
                                    onChange={(e) => setDenomination(parseCurrencyInput(e.target.value))}
                                    placeholder="Nhập mệnh giá..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-3 pr-12 font-mono font-black text-sm text-slate-900 focus:bg-white focus:outline-emerald-600"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-xs">
                                    VNĐ
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 5. Diễn Giải / Điều Kiện Sử Dụng Mệnh Giá (Nhiều dòng) */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="voucher-edit-description" className="text-[11px] font-black uppercase text-slate-700 cursor-pointer">
                                5. Diễn Giải / Điều Kiện Sử Dụng (Nhiều dòng)
                            </label>
                            <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                Nhấn Enter để xuống dòng
                            </span>
                        </div>
                        <textarea
                            id="voucher-edit-description"
                            name="voucher_edit_description"
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Nhập các điều kiện áp dụng, mỗi dòng 1 điều kiện:&#10;• Áp dụng cho đơn từ 500.000đ&#10;• Chỉ áp dụng nhóm Gia Dụng & Phụ Kiện&#10;• Không áp dụng cùng CTKM khác"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs text-slate-900 focus:bg-white focus:outline-emerald-600 placeholder:text-slate-500 font-sans leading-relaxed"
                        />
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                            <span>Bấm để thêm nhanh điều kiện xuống dòng:</span>
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
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                            {['Đơn từ 300.000đ', 'Đơn từ 500.000đ', 'Đơn từ 1.000.000đ', 'Áp dụng ngành Phụ Kiện', 'Áp dụng ngành Gia Dụng', 'Không áp dụng kèm KM khác', 'HSD trong 7 ngày từ khi cấp'].map(preset => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setDescription(prev => {
                                        const clean = prev.trim();
                                        return clean ? `${clean}\n• ${preset}` : `• ${preset}`;
                                    })}
                                    className="text-[10px] font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200 transition cursor-pointer"
                                >
                                    + {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 6. Thời Hạn Sử Dụng (HSD) */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="voucher-edit-expires" className="text-[11px] font-black uppercase text-slate-700 flex items-center gap-1.5 cursor-pointer">
                                <Calendar className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                                <span>6. Thời Hạn Sử Dụng (HSD)</span>
                                <span className="text-rose-500">*</span>
                            </label>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => handleQuickSetMonthEnd(0)}
                                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200 cursor-pointer"
                                >
                                    Cuối tháng này
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickSetMonthEnd(1)}
                                    className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200 cursor-pointer"
                                >
                                    Cuối tháng sau
                                </button>
                            </div>
                        </div>
                        <input
                            id="voucher-edit-expires"
                            name="voucher_edit_expires"
                            type="date"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold font-mono text-slate-800 focus:outline-emerald-600 cursor-pointer"
                            required
                        />
                    </div>

                    {/* 6. Trạng Thái & Reset Cấp Phát */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5">
                        <span className="block text-[11px] font-black uppercase text-slate-700">
                            6. Trạng Thái Mã Voucher
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {(['AVAILABLE', 'CLAIMED', 'USED', 'EXPIRED'] as VoucherStatus[]).map(st => (
                                <button
                                    key={st}
                                    type="button"
                                    onClick={() => {
                                        setStatus(st);
                                        if (st === 'AVAILABLE') setResetClaimed(true);
                                    }}
                                    className={`py-2 px-1 rounded-xl text-center font-bold text-[11px] border transition cursor-pointer ${
                                        status === st
                                            ? st === 'AVAILABLE'
                                                ? 'bg-emerald-700 text-white border-emerald-800'
                                                : st === 'CLAIMED'
                                                ? 'bg-amber-400 text-slate-950 border-amber-500'
                                                : st === 'USED'
                                                ? 'bg-slate-700 text-white border-slate-800'
                                                : 'bg-rose-600 text-white border-rose-700'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {st === 'AVAILABLE' ? '✅ Khả Dụng' : st === 'CLAIMED' ? '⏳ Đã Cấp' : st === 'USED' ? '🎉 Đã Dùng' : '⚠️ Hết Hạn'}
                                </button>
                            ))}
                        </div>

                        {/* Thông tin cấp phát nếu có */}
                        {voucher.claimed_by_name && (
                            <div className="p-2 rounded-xl bg-white border border-slate-200 text-[11px] space-y-1">
                                <div className="font-bold text-slate-700">Thông tin cấp phát hiện tại:</div>
                                <div className="text-slate-600">
                                    • Nhân viên: <strong>{voucher.claimed_by_name}</strong> ({voucher.claimed_by_id})
                                    {voucher.claimed_by_store && ` - ${getShortStoreName(voucher.claimed_by_store)}`}
                                </div>
                                {voucher.order_id && <div>• Đơn hàng: <span className="font-mono text-indigo-700 font-bold">{voucher.order_id}</span></div>}

                                <label className="flex items-center gap-2 pt-1 mt-1 border-t border-slate-100 cursor-pointer font-bold text-amber-900">
                                    <input
                                        type="checkbox"
                                        checked={resetClaimed}
                                        onChange={(e) => setResetClaimed(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                                    />
                                    <span>Xóa thông tin cấp phát & trả mã về kho trắng khả dụng</span>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* 7. Ghi Chú */}
                    <div>
                        <label htmlFor="voucher-edit-note" className="block text-[11px] font-black uppercase text-slate-700 mb-1.5 cursor-pointer">
                            7. Ghi Chú Bổ Sung
                        </label>
                        <textarea
                            id="voucher-edit-note"
                            name="voucher_edit_note"
                            rows={2}
                            value={userNote}
                            onChange={(e) => setUserNote(e.target.value)}
                            placeholder="Ghi chú thêm về mã này (nếu có)..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-emerald-600 resize-none"
                        />
                    </div>
                </form>

                {/* Footer Hành Động */}
                <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white text-xs font-black transition cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 text-amber-300" aria-hidden="true" />
                        <span>{isSubmitting ? 'Đang lưu...' : 'Lưu Cập Nhật'}</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
