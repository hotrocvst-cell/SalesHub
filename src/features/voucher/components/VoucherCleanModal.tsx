import React, { useState, useMemo } from 'react';
import { Trash2, AlertTriangle, CheckCircle2, ShieldAlert, X, Sparkles, Filter, Archive } from 'lucide-react';
import type { VoucherItem } from '../types';
import { cleanVouchers } from '../services/voucherService';
import { formatDate, getShortStoreName, isStoreMatch } from '../../../core/lib/formatters';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    vouchers: VoucherItem[];
    currentStoreName: string;
    accessibleStores?: string[];
    onSuccess: (affectedCount: number, message: string) => void;
}

export default function VoucherCleanModal({
    isOpen,
    onClose,
    vouchers,
    currentStoreName,
    accessibleStores,
    onSuccess
}: Props) {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [cleanType, setCleanType] = useState<'EXPIRED' | 'USED' | 'ALL_INACTIVE'>('EXPIRED');
    const [cleanMode, setCleanMode] = useState<'DELETE' | 'MARK_EXPIRED'>('DELETE');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [selectedCampaign, setSelectedCampaign] = useState<string>('ALL');

    // Lọc danh sách mã áp dụng làm sạch
    const targetVouchers = useMemo(() => {
        let list = vouchers;

        if (currentStoreName && currentStoreName !== 'all') {
            list = list.filter(v =>
                isStoreMatch(v.store_name, currentStoreName) ||
                (accessibleStores && accessibleStores.some(s => isStoreMatch(v.store_name, s))) ||
                (v.claimed_by_store && isStoreMatch(v.claimed_by_store, currentStoreName)) ||
                v.store_name === 'Toàn Cụm Siêu Thị' ||
                v.store_name === 'Toàn Cụm'
            );
        }

        if (selectedCampaign !== 'ALL') {
            list = list.filter(v => v.campaign_name.trim() === selectedCampaign);
        }

        return list.filter(v => {
            const isExpired = Boolean(v.expires_at && v.expires_at < todayStr);
            if (cleanType === 'EXPIRED') {
                return isExpired && v.status !== 'USED';
            }
            if (cleanType === 'USED') {
                return v.status === 'USED';
            }
            if (cleanType === 'ALL_INACTIVE') {
                return v.status === 'USED' || isExpired;
            }
            return false;
        });
    }, [vouchers, currentStoreName, accessibleStores, cleanType, selectedCampaign, todayStr]);

    const totalValue = useMemo(() => {
        return targetVouchers.reduce((sum, v) => sum + (Number(v.denomination) || 0), 0);
    }, [targetVouchers]);

    // Danh sách chương trình trong các mã mục tiêu
    const campaignOptions = useMemo(() => {
        const set = new Set<string>();
        vouchers.forEach(v => {
            const isExpired = Boolean(v.expires_at && v.expires_at < todayStr);
            if (isExpired || v.status === 'USED') {
                set.add(v.campaign_name.trim());
            }
        });
        return Array.from(set).sort();
    }, [vouchers, todayStr]);

    if (!isOpen) return null;

    const handleExecuteClean = async () => {
        if (targetVouchers.length === 0) return;

        const actionText = cleanMode === 'DELETE' ? 'XÓA VĨNH VIỄN' : 'CHUYỂN TRẠNG THÁI SANG EXPIRED';
        const confirmMsg = `⚠️ XÁC NHẬN LÀM SẠCH KHO:\nBạn có chắc chắn muốn ${actionText} ${targetVouchers.length} mã coupon (${totalValue.toLocaleString('vi-VN')}đ) khỏi kho ${currentStoreName === 'all' ? 'Toàn Cụm' : currentStoreName}?`;

        if (!window.confirm(confirmMsg)) return;

        setIsProcessing(true);
        try {
            const res = await cleanVouchers({
                type: cleanType,
                mode: cleanMode,
                storeName: currentStoreName,
                accessibleStores
            });

            if (res.success) {
                const modeMsg = cleanMode === 'DELETE' ? 'Đã xóa vĩnh viễn' : 'Đã đánh dấu hết hạn';
                onSuccess(res.affectedCount, `🧹 ${modeMsg} ${res.affectedCount} mã voucher tồn kho!`);
                onClose();
            } else {
                alert(`Lỗi: ${res.error}`);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs font-avo animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                            <Trash2 className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm text-slate-900">
                                Làm Sạch Dữ Liệu Tồn Kho Coupon
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Phạm vi: <strong>{currentStoreName === 'all' ? 'Toàn Cụm Siêu Thị' : getShortStoreName(currentStoreName)}</strong>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer rounded-lg hover:bg-slate-100"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Thẻ tóm tắt số liệu cần làm sạch */}
                <div className="bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-rose-900 tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            <span>Mã Phát Hiện Cần Dọn Dẹp:</span>
                        </span>
                        <span className="text-sm font-black font-mono text-rose-700">
                            {targetVouchers.length} mã
                        </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-rose-950 font-bold border-t border-rose-200/60 pt-2">
                        <span>Tổng trị giá mệnh giá:</span>
                        <span className="text-sm font-black text-rose-700 font-mono">
                            {totalValue.toLocaleString('vi-VN')}đ
                        </span>
                    </div>
                </div>

                {/* 1. Chọn loại mã cần làm sạch */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                        1. Nhóm mã cần xử lý:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setCleanType('EXPIRED')}
                            className={`p-2.5 rounded-xl border text-center transition cursor-pointer text-xs font-bold ${
                                cleanType === 'EXPIRED'
                                    ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-300'
                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                            }`}
                        >
                            <div className="text-[11px] font-black">⚠️ Quá Hạn</div>
                            <div className="text-[9.5px] text-slate-500 mt-0.5">Chưa dùng &amp; hết hạn</div>
                        </button>

                        <button
                            type="button"
                            onClick={() => setCleanType('USED')}
                            className={`p-2.5 rounded-xl border text-center transition cursor-pointer text-xs font-bold ${
                                cleanType === 'USED'
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-300'
                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                            }`}
                        >
                            <div className="text-[11px] font-black">🎉 Đã Dùng</div>
                            <div className="text-[9.5px] text-slate-500 mt-0.5">Đã hoàn tất hóa đơn</div>
                        </button>

                        <button
                            type="button"
                            onClick={() => setCleanType('ALL_INACTIVE')}
                            className={`p-2.5 rounded-xl border text-center transition cursor-pointer text-xs font-bold ${
                                cleanType === 'ALL_INACTIVE'
                                    ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-300'
                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                            }`}
                        >
                            <div className="text-[11px] font-black">🧹 Toàn Bộ</div>
                            <div className="text-[9.5px] text-slate-500 mt-0.5">Hết hạn + Đã dùng</div>
                        </button>
                    </div>
                </div>

                {/* 2. Chọn hình thức xử lý */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                        2. Hình thức dọn dẹp:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setCleanMode('DELETE')}
                            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                                cleanMode === 'DELETE'
                                    ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-300'
                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            <div className="flex items-center gap-1.5 text-xs font-black text-rose-700">
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa Vĩnh Viễn (Khuyên dùng)</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                                Giải phóng hoàn toàn kho mã, xóa sạch khỏi Cloud và Local để báo cáo chuẩn xác.
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setCleanMode('MARK_EXPIRED')}
                            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                                cleanMode === 'MARK_EXPIRED'
                                    ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-300'
                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            <div className="flex items-center gap-1.5 text-xs font-black text-amber-800">
                                <Archive className="w-3.5 h-3.5" />
                                <span>Chuyển Sang EXPIRED</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                                Giữ lại mã để lưu vết lịch sử nhưng không cấp cho nhân viên nữa.
                            </p>
                        </button>
                    </div>
                </div>

                {/* 3. Danh sách preview một số mã sẽ bị xử lý */}
                {targetVouchers.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                            <span>Mã mẫu sẽ bị xử lý ({Math.min(targetVouchers.length, 5)}/{targetVouchers.length}):</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 max-h-28 overflow-y-auto divide-y divide-slate-200/60 text-xs font-mono">
                            {targetVouchers.slice(0, 5).map(v => (
                                <div key={v.id} className="py-1 flex items-center justify-between">
                                    <span className="font-bold text-slate-800">{v.code}</span>
                                    <span className="text-[11px] text-slate-500">{v.campaign_name}</span>
                                    <span className="text-[11px] text-rose-600 font-bold">{Number(v.denomination).toLocaleString('vi-VN')}đ</span>
                                    <span className="text-[10px] text-slate-400">{v.expires_at ? formatDate(v.expires_at) : 'KTH'}</span>
                                </div>
                            ))}
                            {targetVouchers.length > 5 && (
                                <div className="pt-1 text-[10px] text-slate-400 italic text-center font-avo">
                                    ... và còn {targetVouchers.length - 5} mã khác
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                        Đóng
                    </button>

                    <button
                        type="button"
                        disabled={isProcessing || targetVouchers.length === 0}
                        onClick={handleExecuteClean}
                        className={`px-4 py-2 rounded-xl text-xs font-black text-white transition cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                            cleanMode === 'DELETE'
                                ? 'bg-rose-600 hover:bg-rose-700 active:scale-[0.99]'
                                : 'bg-amber-600 hover:bg-amber-700 active:scale-[0.99]'
                        }`}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>
                            {isProcessing ? 'Đang dọn dẹp...' : `Tiến Hành Làm Sạch (${targetVouchers.length} mã)`}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
