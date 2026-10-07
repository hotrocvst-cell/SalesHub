import React, { useState } from 'react';
import { Copy, Check, Sparkles, Tag, ShoppingBag, Clock, UserCheck, Store, Calendar } from 'lucide-react';
import type { VoucherItem } from '../types';
import { formatDate, getShortStoreName } from '../../../core/lib/formatters';

interface Props {
    voucher: VoucherItem;
    onCopySuccess?: (code: string) => void;
    compact?: boolean;
}

export default function VoucherCard({ voucher, onCopySuccess, compact = false }: Props) {
    const [copied, setCopied] = useState<boolean>(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(voucher.code);
            setCopied(true);
            if (onCopySuccess) onCopySuccess(voucher.code);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            // Fallback
            const el = document.createElement('textarea');
            el.value = voucher.code;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        }
    };

    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 p-0.5 shadow-xl text-slate-900 font-avo animate-in fade-in zoom-in-95 duration-300">
            {/* Vùng ruột vé Coupon */}
            <div className="relative bg-white rounded-[15px] p-4 sm:p-5 overflow-hidden">
                {/* Lỗ khuyết vé (Ticket notch bên trái và bên phải) */}
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-900/10 rounded-full border border-amber-300/40" />
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-900/10 rounded-full border border-amber-300/40" />

                {/* Header vé */}
                <div className="flex items-start justify-between gap-2 border-b border-dashed border-amber-200 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                            <Tag className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-[11px] font-black uppercase text-amber-700 tracking-wider">
                                Phiếu Ưu Đãi Bán Hàng
                            </div>
                            <div className="text-xs sm:text-sm font-black text-slate-900 line-clamp-1">
                                {voucher.campaign_name}
                            </div>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-base sm:text-xl font-black text-rose-600 font-mono tracking-tight">
                            {Number(voucher.denomination).toLocaleString('vi-VN')}đ
                        </div>
                        <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {voucher.status === 'CLAIMED' ? 'Đã Cấp Thành Công' : voucher.status === 'USED' ? 'Đã Dùng' : 'Khả Dụng'}
                        </span>
                    </div>
                </div>

                {/* KHU VỰC CHẠM ĐỂ COPY MÃ VOUCHER */}
                <div className="my-4">
                    <div className="text-[10.5px] font-bold text-center text-slate-500 mb-1 flex items-center justify-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                        <span>CHẠM VÀO MÃ ĐỂ SAO CHÉP NHANH</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleCopy}
                        className={`w-full relative group p-3.5 sm:p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${copied
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-md scale-[1.01]'
                            : 'bg-amber-50/70 border-amber-400/80 hover:bg-amber-100/70 active:scale-[0.99] shadow-2xs'
                            }`}
                        title="Bấm để copy mã voucher vào clipboard"
                    >
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                            <span className="text-xl sm:text-2xl font-black font-mono tracking-widest text-slate-950 select-all">
                                {voucher.code}
                            </span>
                            <div className={`p-1.5 rounded-lg transition ${copied ? 'bg-emerald-600 text-white' : 'bg-amber-200 text-amber-900 group-hover:bg-amber-300'}`}>
                                {copied ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                            </div>
                        </div>

                        <div className="text-[11px] font-black mt-1">
                            {copied ? (
                                <span className="text-emerald-700 flex items-center gap-1 animate-pulse">
                                    <Check className="w-3 h-3" /> ĐÃ COPY VÀO BỘ NHỚ TẠM!
                                </span>
                            ) : (
                                <span className="text-amber-800">
                                    📋 Bấm để copy mã
                                </span>
                            )}
                        </div>
                    </button>
                </div>

                {/* THÔNG TIN CHI TIẾT ĐƠN HÀNG & NHÂN VIÊN */}
                {!compact ? (
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-slate-600">
                        {voucher.order_id && (
                            <div className="flex items-center gap-1.5 overflow-hidden">
                                <ShoppingBag className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span className="truncate">Đơn: <strong className="text-slate-900 font-mono">{voucher.order_id}</strong></span>
                            </div>
                        )}
                        {voucher.claimed_by_name && (
                            <div className="flex items-center gap-1.5 overflow-hidden">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">NV: <strong className="text-slate-900">{voucher.claimed_by_name}</strong></span>
                            </div>
                        )}
                        {voucher.claimed_by_store && (
                            <div className="flex items-center gap-1.5 col-span-2 text-emerald-800 bg-emerald-50/80 px-2 py-1 rounded-lg border border-emerald-100 overflow-hidden font-bold">
                                <Store className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">Siêu thị: <strong>{getShortStoreName(voucher.claimed_by_store)}</strong></span>
                            </div>
                        )}
                        {voucher.claimed_at && (
                            <div className="flex items-center gap-1.5 col-span-2 text-slate-500 overflow-hidden text-[10px]">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>Cấp lúc: {formatDate(voucher.claimed_at)} ({new Date(voucher.claimed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})</span>
                            </div>
                        )}
                        {voucher.expires_at && (
                            <div className="flex items-center gap-1.5 col-span-2 text-rose-700 bg-rose-50/80 px-2 py-1 rounded-lg border border-rose-100 overflow-hidden font-bold text-[10.5px]">
                                <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>Hạn sử dụng: <strong className="font-mono">{formatDate(voucher.expires_at)}</strong></span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-[10.5px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100 flex-wrap gap-1 mt-1">
                        {voucher.claimed_by_store && (
                            <span className="font-bold text-emerald-800 flex items-center gap-1">
                                <span>🏪</span>
                                <span>{getShortStoreName(voucher.claimed_by_store)}</span>
                            </span>
                        )}
                        {voucher.order_id && (
                            <span className="font-mono font-bold text-indigo-700">
                                Đơn: {voucher.order_id}
                            </span>
                        )}
                        {voucher.expires_at && (
                            <span className="font-mono font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                                HSD: {formatDate(voucher.expires_at)}
                            </span>
                        )}
                        {voucher.claimed_at && (
                            <span className="text-slate-400 text-[10px]">
                                {new Date(voucher.claimed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {formatDate(voucher.claimed_at)}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
