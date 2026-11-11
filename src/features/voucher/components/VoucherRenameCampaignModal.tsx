import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Edit3,
    CheckCircle2,
    AlertCircle,
    Info,
    Sparkles,
    Layers,
    Tag,
    Clock,
    Ban,
    EyeOff
} from 'lucide-react';
import type { VoucherItem, VoucherCampaignStatusConfig } from '../types';
import {
    renameVoucherCampaign,
    isVoucherInUserCluster,
    isCampaignOrDenomEnded,
    isCampaignHidden
} from '../services/voucherService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    initialCampaignName?: string;
    vouchers: VoucherItem[];
    campaignStatuses: Record<string, VoucherCampaignStatusConfig>;
    currentStoreName: string;
    accessibleStores?: string[];
    currentUserDisplayName?: string;
    isAdmin?: boolean;
    onSuccess: (updatedCount: number, message: string) => void;
}

export default function VoucherRenameCampaignModal({
    isOpen,
    onClose,
    initialCampaignName,
    vouchers,
    campaignStatuses,
    currentStoreName,
    accessibleStores,
    currentUserDisplayName,
    isAdmin,
    onSuccess
}: Props) {
    const [selectedCampaign, setSelectedCampaign] = useState<string>('');
    const [newCampaignName, setNewCampaignName] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');

    const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

    // Danh sách tất cả các chương trình hiện có
    const allCampaignNames = useMemo<string[]>(() => {
        const set = new Set<string>();
        vouchers.forEach(v => {
            if (!isAdmin || (currentStoreName && currentStoreName !== 'all')) {
                if (!isVoucherInUserCluster(v, currentStoreName, accessibleStores, currentUserDisplayName, isAdmin)) {
                    return;
                }
            }
            const c = (v.campaign_name || '').trim();
            if (c) set.add(c);
        });

        Object.values(campaignStatuses).forEach(s => {
            if (s && s.campaign_name) {
                const c = s.campaign_name.trim();
                if (c) set.add(c);
            }
        });

        return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
    }, [vouchers, campaignStatuses, currentStoreName, accessibleStores, currentUserDisplayName, isAdmin]);

    // Khi modal mở, khởi tạo chương trình được chọn
    useEffect(() => {
        if (!isOpen) return;
        setErrorMsg('');

        if (initialCampaignName && allCampaignNames.includes(initialCampaignName)) {
            setSelectedCampaign(initialCampaignName);
            setNewCampaignName(initialCampaignName);
        } else if (allCampaignNames.length > 0) {
            setSelectedCampaign(allCampaignNames[0]);
            setNewCampaignName(allCampaignNames[0]);
        } else {
            setSelectedCampaign('');
            setNewCampaignName('');
        }
    }, [isOpen, initialCampaignName, allCampaignNames]);

    // Thống kê chi tiết của chương trình đang chọn
    const currentStats = useMemo(() => {
        if (!selectedCampaign) return null;

        let total = 0;
        let available = 0;
        let claimed = 0;
        let used = 0;
        let expired = 0;
        let totalValue = 0;
        const denoms = new Set<number>();

        vouchers.forEach(v => {
            if (!isAdmin || (currentStoreName && currentStoreName !== 'all')) {
                if (!isVoucherInUserCluster(v, currentStoreName, accessibleStores, currentUserDisplayName, isAdmin)) {
                    return;
                }
            }
            if ((v.campaign_name || '').trim().toLowerCase() === selectedCampaign.toLowerCase()) {
                total++;
                totalValue += Number(v.denomination) || 0;
                if (v.denomination) denoms.add(Number(v.denomination));

                const isExp = Boolean(v.expires_at && v.expires_at < todayStr && v.status !== 'USED');
                if (isExp) expired++;

                if (v.status === 'AVAILABLE' && !isExp) available++;
                else if (v.status === 'CLAIMED') claimed++;
                else if (v.status === 'USED') used++;
            }
        });

        const isEnded = isCampaignOrDenomEnded(campaignStatuses, selectedCampaign);
        const isHidden = isCampaignHidden(campaignStatuses, selectedCampaign);

        return {
            total,
            available,
            claimed,
            used,
            expired,
            totalValue,
            denominations: Array.from(denoms).sort((a, b) => a - b),
            isEnded,
            isHidden
        };
    }, [selectedCampaign, vouchers, campaignStatuses, currentStoreName, accessibleStores, currentUserDisplayName, isAdmin, todayStr]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isProcessing) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isProcessing, onClose]);

    if (!isOpen) return null;

    const trimmedNew = newCampaignName.trim();
    const isSameName = trimmedNew.toLowerCase() === selectedCampaign.trim().toLowerCase();
    const isTargetExisting = !isSameName && allCampaignNames.some(
        c => c.toLowerCase() === trimmedNew.toLowerCase()
    );

    const handleExecuteRename = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!selectedCampaign) {
            setErrorMsg('Vui lòng chọn chương trình cần đổi tên!');
            return;
        }

        if (!trimmedNew) {
            setErrorMsg('Vui lòng nhập tên mới cho chương trình!');
            return;
        }

        if (isSameName) {
            setErrorMsg('Tên mới trùng với tên hiện tại. Vui lòng nhập tên khác!');
            return;
        }

        // Cảnh báo nếu gộp vào chương trình đã tồn tại
        if (isTargetExisting) {
            const confirmMerge = window.confirm(
                `⚠️ CHƯƠNG TRÌNH ĐÍCH ĐÃ TỒN TẠI:\n\nTên "${trimmedNew}" hiện đã có trong kho.\nNếu bạn tiếp tục, toàn bộ ${currentStats?.total || 0} mã của "${selectedCampaign}" sẽ được GỘP CHUNG vào chương trình "${trimmedNew}".\n\nBạn có chắc chắn muốn tiến hành?`
            );
            if (!confirmMerge) return;
        }

        setIsProcessing(true);
        try {
            const clusterCtx = {
                userStoreName: currentStoreName,
                accessibleStores,
                currentUserDisplayName,
                isAdmin
            };

            const res = await renameVoucherCampaign(selectedCampaign, trimmedNew, clusterCtx);
            if (res.success) {
                const actionText = isTargetExisting ? 'đã gộp vào' : 'đã đổi tên thành';
                onSuccess(
                    res.updatedVoucherCount,
                    `🎉 Đã cập nhật thành công! Chương trình "${selectedCampaign}" ${actionText} "${trimmedNew}" (${res.updatedVoucherCount} mã PMH)!`
                );
                onClose();
            } else {
                setErrorMsg(res.error || 'Có lỗi xảy ra khi đổi tên chương trình!');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="voucher-rename-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm"
            onClick={() => !isProcessing && onClose()}
        >
            <div
                className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-slate-900 p-4 sm:p-5 text-white flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-700 text-white flex items-center justify-center font-black shadow-md shrink-0">
                            <Edit3 className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 id="voucher-rename-modal-title" className="text-sm sm:text-base font-black uppercase tracking-wide text-amber-300 flex items-center gap-2">
                                <span>Chỉnh Sửa Tên Chương Trình PMH</span>
                            </h2>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Cập nhật đồng loạt tên chương trình cho toàn bộ mã voucher trong kho
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        aria-label="Đóng hộp thoại đổi tên chương trình"
                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 disabled:opacity-50"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleExecuteRename} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                    {/* Error message */}
                    {errorMsg && (
                        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="flex-1 leading-snug">{errorMsg}</div>
                        </div>
                    )}

                    {/* 1. Chọn chương trình cần đổi tên */}
                    <div className="space-y-1.5">
                        <label htmlFor="rename-campaign-select" className="block text-xs font-black uppercase tracking-wider text-slate-700 cursor-pointer">
                            1. Chương trình cần đổi tên:
                        </label>
                        <select
                            id="rename-campaign-select"
                            name="rename_campaign_select"
                            value={selectedCampaign}
                            onChange={(e) => {
                                setSelectedCampaign(e.target.value);
                                setNewCampaignName(e.target.value);
                                setErrorMsg('');
                            }}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 shadow-sm"
                        >
                            {allCampaignNames.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {/* Thẻ tóm tắt thông tin chương trình hiện tại */}
                    {currentStats && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-600 flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Tồn kho hiện tại:</span>
                                </span>
                                <span className="font-mono font-black text-slate-900">
                                    {currentStats.total} mã voucher
                                </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600 pt-1 border-t border-slate-200/60 font-mono">
                                <span className="text-emerald-700">Khả dụng: <strong>{currentStats.available}</strong></span>
                                <span>•</span>
                                <span className="text-indigo-700">Đã dùng: <strong>{currentStats.used}</strong></span>
                                {currentStats.expired > 0 && (
                                    <>
                                        <span>•</span>
                                        <span className="text-rose-700 font-bold">Quá hạn: <strong>{currentStats.expired}</strong></span>
                                    </>
                                )}
                                <span>•</span>
                                <span className="text-slate-700 font-bold">
                                    Trị giá: {currentStats.totalValue.toLocaleString('vi-VN')}đ
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                {currentStats.isEnded && (
                                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-0.5">
                                        <Ban className="w-3 h-3 text-rose-600" aria-hidden="true" />
                                        <span>Đã kết thúc</span>
                                    </span>
                                )}
                                {currentStats.isHidden && (
                                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300 inline-flex items-center gap-0.5">
                                        <EyeOff className="w-3 h-3 text-slate-600" aria-hidden="true" />
                                        <span>Đã ẩn</span>
                                    </span>
                                )}
                                {!currentStats.isEnded && !currentStats.isHidden && (
                                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-200">
                                        Đang hoạt động
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 2. Nhập tên chương trình mới */}
                    <div className="space-y-1.5">
                        <label htmlFor="rename-campaign-new-name" className="block text-xs font-black uppercase tracking-wider text-slate-700 cursor-pointer">
                            2. Tên chương trình mới: <span className="text-rose-600">*</span>
                        </label>
                        <input
                            id="rename-campaign-new-name"
                            name="rename_campaign_new_name"
                            type="text"
                            value={newCampaignName}
                            onChange={(e) => {
                                setNewCampaignName(e.target.value);
                                setErrorMsg('');
                            }}
                            placeholder="Nhập tên mới (VD: PMH 100K MÙA HÈ 2026)..."
                            className="w-full p-2.5 bg-white border border-blue-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl text-xs font-bold text-slate-900 shadow-sm transition"
                            autoFocus
                        />
                    </div>

                    {/* Cảnh báo gộp nếu tên mới đã tồn tại */}
                    {isTargetExisting && (
                        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2">
                            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="leading-relaxed">
                                <strong>Lưu ý gộp chương trình:</strong> Tên <strong>"{trimmedNew}"</strong> hiện đã tồn tại trong kho. Nếu lưu, hệ thống sẽ gộp toàn bộ <strong>{currentStats?.total || 0} mã</strong> của "{selectedCampaign}" vào chương trình này.
                            </div>
                        </div>
                    )}

                    {/* Gợi ý quy trình */}
                    <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3 text-xs text-blue-950 flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="leading-relaxed">
                            Khi xác nhận, tên chương trình mới sẽ được cập nhật đồng loạt cho toàn bộ mã voucher và bảo lưu trọn vẹn trạng thái kết thúc/ẩn trên cả <strong>Cloud Supabase</strong> và máy này.
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isProcessing}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                        >
                            Đóng
                        </button>

                        <button
                            type="submit"
                            disabled={isProcessing || !trimmedNew || isSameName}
                            className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-black text-xs transition cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{isProcessing ? 'Đang lưu tên mới...' : 'Lưu Tên Chương Trình Mới'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}

