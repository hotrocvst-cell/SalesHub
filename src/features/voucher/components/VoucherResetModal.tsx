import React, { useState } from 'react';
import { X, Search, RotateCcw, AlertCircle, CheckCircle2, UserCheck, ShoppingBag, Clock, Store } from 'lucide-react';
import type { VoucherItem } from '../types';
import { resetClaimedVoucher } from '../services/voucherService';
import { formatDate, getShortStoreName } from '../../../core/lib/formatters';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentStoreName: string;
    currentUserDisplayName: string;
    allVouchers: VoucherItem[];
    onSuccess: (code: string) => void;
}

export default function VoucherResetModal({
    isOpen,
    onClose,
    currentStoreName,
    currentUserDisplayName,
    allVouchers,
    onSuccess
}: Props) {
    const [searchCode, setSearchCode] = useState<string>('');
    const [foundVoucher, setFoundVoucher] = useState<VoucherItem | null>(null);
    const [hasSearched, setHasSearched] = useState<boolean>(false);
    const [isResetting, setIsResetting] = useState<boolean>(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    if (!isOpen) return null;

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setHasSearched(true);

        const clean = searchCode.trim().toUpperCase();
        if (!clean) {
            setFoundVoucher(null);
            return;
        }

        const match = allVouchers.find(v => v.code.toUpperCase() === clean);
        setFoundVoucher(match || null);
    };

    const handleReset = async () => {
        if (!foundVoucher) return;
        setIsResetting(true);
        setMessage(null);

        try {
            const res = await resetClaimedVoucher(
                foundVoucher.code,
                currentUserDisplayName,
                currentStoreName
            );

            if (!res.success) {
                setMessage({ type: 'error', text: res.error || 'Không thể reset voucher' });
                return;
            }

            setMessage({
                type: 'success',
                text: `✅ Đã đưa mã "${foundVoucher.code}" trở về trạng thái Khả Dụng (AVAILABLE)!`
            });
            setFoundVoucher(res.voucher || null);
            onSuccess(foundVoucher.code);
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message || 'Lỗi hệ thống' });
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs font-avo animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-amber-600 px-5 py-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <RotateCcw className="w-5 h-5 text-amber-200" />
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-wide">
                                Tra Cứu & Reset Mã Về Kho
                            </h3>
                            <div className="text-[11px] text-amber-100">
                                Nhập lại mã chưa dùng vào danh sách chờ
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-xl hover:bg-amber-700 text-white transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-5 space-y-4 text-xs">
                    {/* Ô Tra Cứu */}
                    <form onSubmit={handleSearch} className="space-y-2">
                        <label className="block text-[11px] font-black uppercase text-slate-700">
                            Nhập Mã Voucher Cần Tra Cứu
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={searchCode}
                                onChange={(e) => setSearchCode(e.target.value)}
                                placeholder="Nhập chính xác mã coupon..."
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:outline-amber-600 uppercase"
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black transition cursor-pointer flex items-center gap-1 shrink-0"
                            >
                                <Search className="w-4 h-4" />
                                <span>Kiểm Tra</span>
                            </button>
                        </div>
                    </form>

                    {message && (
                        <div className={`p-3 rounded-xl border flex items-center gap-2 font-bold ${
                            message.type === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                            {message.type === 'success' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            )}
                            <span>{message.text}</span>
                        </div>
                    )}

                    {/* Kết Quả Tra Cứu */}
                    {hasSearched && !foundVoucher && !message && (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-slate-500 font-bold">
                            Không tìm thấy mã này trong kho của hệ thống.
                        </div>
                    )}

                    {foundVoucher && (
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-[10.5px] font-bold text-slate-400 uppercase">Chương Trình</div>
                                    <div className="font-black text-slate-900 text-sm">{foundVoucher.campaign_name}</div>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10.5px] ${
                                    foundVoucher.status === 'AVAILABLE'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : foundVoucher.status === 'CLAIMED'
                                        ? 'bg-amber-100 text-amber-900'
                                        : 'bg-slate-200 text-slate-700'
                                }`}>
                                    {foundVoucher.status === 'AVAILABLE' ? 'Khả Dụng' : foundVoucher.status === 'CLAIMED' ? 'Đang Bị Giữ' : foundVoucher.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200">
                                <div>
                                    <span className="text-slate-400">Mệnh giá:</span>
                                    <div className="font-black font-mono text-rose-600">
                                        {Number(foundVoucher.denomination).toLocaleString('vi-VN')}đ
                                    </div>
                                </div>
                                <div>
                                    <span className="text-slate-400">Siêu thị:</span>
                                    <div className="font-bold text-slate-800">{foundVoucher.store_name}</div>
                                </div>
                                {foundVoucher.claimed_by_name && (
                                    <div className="col-span-2 flex items-center gap-1.5 text-slate-700 bg-white p-2 rounded-xl border border-slate-200">
                                        <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>NV đã lấy: <strong>{foundVoucher.claimed_by_name}</strong> ({foundVoucher.claimed_by_id})</span>
                                    </div>
                                )}
                                {foundVoucher.claimed_by_store && (
                                    <div className="col-span-2 flex items-center gap-1.5 text-emerald-800 bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                                        <Store className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>Siêu thị của NV: <strong>{getShortStoreName(foundVoucher.claimed_by_store)}</strong></span>
                                    </div>
                                )}
                                {foundVoucher.order_id && (
                                    <div className="col-span-2 flex items-center gap-1.5 text-slate-700 bg-white p-2 rounded-xl border border-slate-200">
                                        <ShoppingBag className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                        <span>Mã đơn hàng: <strong className="font-mono">{foundVoucher.order_id}</strong></span>
                                    </div>
                                )}
                                {foundVoucher.claimed_at && (
                                    <div className="col-span-2 flex items-center gap-1.5 text-slate-500">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Thời gian lấy: {formatDate(foundVoucher.claimed_at)} ({new Date(foundVoucher.claimed_at).toLocaleTimeString('vi-VN')})</span>
                                    </div>
                                )}
                            </div>

                            {/* Nút Reset */}
                            {foundVoucher.status !== 'AVAILABLE' && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    disabled={isResetting}
                                    className="w-full mt-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-black transition cursor-pointer shadow-md flex items-center justify-center gap-2"
                                >
                                    <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
                                    <span>{isResetting ? 'Đang Reset...' : 'RESET VỀ DANH SÁCH CHỜ (AVAILABLE)'}</span>
                                </button>
                            )}
                        </div>
                    )}

                    <div className="pt-2 text-right">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer"
                        >
                            Đóng Lại
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
