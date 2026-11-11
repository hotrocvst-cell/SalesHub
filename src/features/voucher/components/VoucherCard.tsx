import React, { useState, useMemo } from 'react';
import { Copy, Check, Sparkles, Tag, ShoppingBag, Clock, UserCheck, Store, Calendar, RotateCcw } from 'lucide-react';
import type { VoucherItem } from '../types';
import { formatDate, getShortStoreName } from '../../../core/lib/formatters';
import { getDenominationHotStyle, formatCurrency, parseConditionLines } from '../voucherFormatters';

interface Props {
    voucher: VoucherItem;
    onCopySuccess?: (code: string) => void;
    compact?: boolean;
    onReturn?: (voucher: VoucherItem) => void;
    isReturning?: boolean;
}

export default function VoucherCard({ voucher, onCopySuccess, compact = false, onReturn, isReturning = false }: Props) {
    const [copied, setCopied] = useState<boolean>(false);
    const hotStyle = getDenominationHotStyle(voucher.denomination);
    const conditionLines = useMemo(() => parseConditionLines(voucher.description), [voucher.description]);

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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 via-amber-700 to-yellow-700 p-0.5 shadow-xl text-slate-900">
            {/* Vùng ruột vé Coupon */}
            <div className="relative bg-white rounded-[15px] p-4 sm:p-5 overflow-hidden">
                {/* Lỗ khuyết vé (Ticket notch bên trái và bên phải) */}
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-900/10 rounded-full border border-amber-300/40" aria-hidden="true" />
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-900/10 rounded-full border border-amber-300/40" aria-hidden="true" />

                {/* Header vé */}
                <div className="flex items-start justify-between gap-2 border-b border-dashed border-amber-200 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shadow-sm shrink-0">
                            <Tag className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div>
                            <div className="text-[11px] font-black uppercase text-amber-800 tracking-wider">
                                Phiếu Ưu Đãi Bán Hàng
                            </div>
                            <div className="text-xs sm:text-sm font-black text-slate-900 line-clamp-1">
                                {voucher.campaign_name}
                            </div>
                            {voucher.description && (
                                <div className="text-[10.5px] font-bold text-amber-950 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5 inline-block max-w-[200px] truncate" title={`Điều kiện: ${voucher.description}`}>
                                    Điều kiện: {voucher.description}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="flex items-center justify-end gap-1">
                            <span className="text-[10px]" aria-hidden="true">{hotStyle.tagIcon}</span>
                            <div className={`text-base sm:text-xl font-black font-mono tabular-nums tracking-tight ${hotStyle.textClass}`}>
                                {formatCurrency(voucher.denomination)}
                            </div>
                        </div>
                        <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-block mt-0.5">
                            {voucher.status === 'CLAIMED' ? 'Đã Cấp Thành Công' : voucher.status === 'USED' ? 'Đã Dùng' : 'Khả Dụng'}
                        </span>
                    </div>
                </div>

                {/* KHU VỰC CHẠM ĐỂ COPY MÃ VOUCHER */}
                <div className="my-4">
                    <div className="text-[10.5px] font-bold text-center text-slate-600 mb-1 flex items-center justify-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-500" aria-hidden="true" />
                        <span>CHẠM VÀO MÃ ĐỂ SAO CHÉP NHANH</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleCopy}
                        className={`w-full relative group p-3.5 sm:p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${copied
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-md scale-[1.01]'
                            : 'bg-amber-50/70 border-amber-400/80 hover:bg-amber-100/70 active:scale-[0.99] shadow-sm'
                            }`}
                        title="Bấm để copy mã voucher vào clipboard"
                    >
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                            <span className="text-xl sm:text-2xl font-black font-mono tracking-widest text-slate-950 select-all">
                                {voucher.code}
                            </span>
                            <div className={`p-1.5 rounded-lg transition ${copied ? 'bg-emerald-700 text-white' : 'bg-amber-200 text-amber-950 group-hover:bg-amber-300'}`}>
                                {copied ? <Check className="w-4 h-4 stroke-[3]" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                            </div>
                        </div>

                        <div className="text-[11px] font-black mt-1">
                            {copied ? (
                                <span className="text-emerald-800 inline-flex items-center gap-1">
                                    <Check className="w-3 h-3" aria-hidden="true" /> ĐÃ COPY VÀO BỘ NHỚ TẠM!
                                </span>
                            ) : (
                                <span className="text-amber-900">
                                    Bấm để copy mã
                                </span>
                            )}
                        </div>
                    </button>
                </div>

                {/* THÔNG TIN CHI TIẾT ĐƠN HÀNG & NHÂN VIÊN */}
                {!compact ? (
                    <>
                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-slate-700">
                            {voucher.order_id && (
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <ShoppingBag className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
                                    <span className="truncate">Đơn: <strong className="text-slate-900 font-mono">{voucher.order_id}</strong></span>
                                </div>
                            )}
                            {voucher.claimed_by_name && (
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                                    <span className="truncate">NV: <strong className="text-slate-900">{voucher.claimed_by_name}</strong></span>
                                </div>
                            )}
                            {voucher.claimed_by_store && (
                                <div className="flex items-center gap-1.5 col-span-2 text-emerald-900 bg-emerald-50/80 px-2 py-1 rounded-lg border border-emerald-200 overflow-hidden font-bold">
                                    <Store className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                                    <span className="truncate">ST: <strong>{getShortStoreName(voucher.claimed_by_store)}</strong></span>
                                </div>
                            )}
                            {voucher.claimed_at && (
                                <div className="flex items-center gap-1.5 col-span-2 text-slate-600 overflow-hidden text-[10px]">
                                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                                    <span className="tabular-nums">Cấp lúc: {formatDate(voucher.claimed_at)} ({new Date(voucher.claimed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})</span>
                                </div>
                            )}
                            {voucher.expires_at && (
                                <div className="flex items-center gap-1.5 col-span-2 text-rose-800 bg-rose-50/80 px-2 py-1 rounded-lg border border-rose-200 overflow-hidden font-bold text-[10.5px]">
                                    <Calendar className="w-3.5 h-3.5 text-rose-700 shrink-0" aria-hidden="true" />
                                    <span>Hạn sử dụng: <strong className="font-mono tabular-nums">{formatDate(voucher.expires_at)}</strong></span>
                                </div>
                            )}
                        </div>

                        {/* KHỐI ĐIỀU KIỆN SỬ DỤNG NHIỀU DÒNG */}
                        {conditionLines.length > 0 && (
                            <div className="mt-2 bg-amber-50/80 border border-amber-200/90 rounded-xl p-2.5 space-y-1 text-left">
                                <div className="text-[10px] font-black uppercase text-amber-950 flex items-center gap-1">
                                    <span>Điều Kiện Sử Dụng ({conditionLines.length}):</span>
                                </div>
                                <div className="space-y-0.5 pl-0.5">
                                    {conditionLines.map((cond, idx) => (
                                        <div key={idx} className="text-[11px] font-semibold text-amber-950 flex items-start gap-1.5 leading-snug">
                                            <span className="text-amber-700 font-bold shrink-0" aria-hidden="true">•</span>
                                            <span>{cond}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Nút trả lại mã cho voucher vừa cấp nếu lỡ lấy nhầm */}
                        {onReturn && voucher.status === 'CLAIMED' && (
                            <div className="mt-3 pt-2.5 border-t border-dashed border-amber-200/90 flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[11px] font-bold text-amber-900">
                                    Lấy nhầm đơn hoặc chưa dùng?
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onReturn(voucher);
                                    }}
                                    disabled={isReturning}
                                    className="px-3 py-2 min-h-[34px] rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 hover:border-rose-300 text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-[0.98] disabled:opacity-50"
                                    title="Hoàn trả mã này về kho"
                                >
                                    <RotateCcw className={`w-3.5 h-3.5 text-rose-700 ${isReturning ? 'animate-spin' : ''}`} aria-hidden="true" />
                                    <span>Trả Lại Mã Vào Kho</span>
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="space-y-2 mt-1.5">
                        <div className="flex items-center justify-between text-[10.5px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 flex-wrap gap-1">
                            {voucher.claimed_by_store && (
                                <span className="font-bold text-emerald-800 inline-flex items-center gap-1">
                                    <Store className="w-3 h-3 text-emerald-700 shrink-0" aria-hidden="true" />
                                    <span>{getShortStoreName(voucher.claimed_by_store)}</span>
                                </span>
                            )}
                            {conditionLines.length === 1 && (
                                <span className="font-bold text-amber-950 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title={`Điều kiện: ${voucher.description}`}>
                                    {conditionLines[0]}
                                </span>
                            )}
                            {conditionLines.length > 1 && (
                                <span className="font-bold text-amber-950 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title={conditionLines.join('\n')}>
                                    {conditionLines.length} điều kiện
                                </span>
                            )}
                            {voucher.order_id && (
                                <span className="font-mono font-bold text-blue-800">
                                    Đơn: {voucher.order_id}
                                </span>
                            )}
                            {voucher.expires_at && (
                                <span className="font-mono font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 tabular-nums">
                                    HSD: {formatDate(voucher.expires_at)}
                                </span>
                            )}
                            {voucher.claimed_at && (
                                <span className="text-slate-600 text-[10px] tabular-nums">
                                    {new Date(voucher.claimed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {formatDate(voucher.claimed_at)}
                                </span>
                            )}
                        </div>

                        {/* Danh sách điều kiện ở compact mode nếu có nhiều điều kiện */}
                        {conditionLines.length > 1 && (
                            <div className="bg-amber-50/70 border border-amber-200/70 rounded-lg p-1.5 space-y-0.5 text-left">
                                {conditionLines.map((cond, idx) => (
                                    <div key={idx} className="text-[10px] font-medium text-amber-950 flex items-start gap-1 leading-tight">
                                        <span className="text-amber-700 font-bold shrink-0" aria-hidden="true">•</span>
                                        <span>{cond}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* THANH TÁC VỤ HOÀN TRẢ MÃ KHO (NẾU CHƯA DÙNG) TRONG LỊCH SỬ */}
                        {onReturn && voucher.status === 'CLAIMED' && (
                            <div className="pt-1.5 border-t border-dashed border-amber-200/90 flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[10.5px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-amber-700" aria-hidden="true" />
                                    <span>Chưa dùng trong hóa đơn</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onReturn(voucher);
                                    }}
                                    disabled={isReturning}
                                    className="px-2.5 py-1.5 min-h-[32px] rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 hover:border-rose-300 text-[11px] font-black transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-[0.98] disabled:opacity-50"
                                    title="Trả lại mã voucher này về kho nếu chưa dùng trong hóa đơn"
                                >
                                    <RotateCcw className={`w-3.5 h-3.5 text-rose-700 ${isReturning ? 'animate-spin' : ''}`} aria-hidden="true" />
                                    <span>Trả Lại Mã</span>
                                </button>
                            </div>
                        )}

                        {voucher.status === 'USED' && (
                            <div className="pt-1 flex items-center justify-between text-[10px] text-slate-600 font-medium">
                                <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                                    <span>Đã dùng cho hóa đơn</span>
                                </span>
                                {voucher.used_at && (
                                    <span className="tabular-nums">Lúc: {new Date(voucher.used_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {formatDate(voucher.used_at)}</span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
