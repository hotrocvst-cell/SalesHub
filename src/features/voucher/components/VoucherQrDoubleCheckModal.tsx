import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import {
    X,
    QrCode,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    CheckCircle2,
    Copy,
    Check,
    Store,
    ShoppingBag,
    UserCheck,
    Clock,
    Tag,
    Sparkles,
    AlertCircle
} from 'lucide-react';
import type { VoucherItem } from '../types';
import { formatDate, getShortStoreName } from '../../../core/lib/formatters';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    vouchers: VoucherItem[];
    onResetVoucher: (code: string) => Promise<boolean> | void;
    onMarkUsed?: (code: string) => Promise<boolean> | void;
}

export default function VoucherQrDoubleCheckModal({
    isOpen,
    onClose,
    vouchers,
    onResetVoucher,
    onMarkUsed
}: Props) {
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [copiedCode, setCopiedCode] = useState<string>('');
    const [actionFeedback, setActionFeedback] = useState<string>('');
    const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

    // Lưu trạng thái thao tác cục bộ để cập nhật UI ngay lập tức
    const [statusOverrides, setStatusOverrides] = useState<Record<string, 'AVAILABLE' | 'USED'>>({});

    // Reset index khi mở modal với danh sách mới
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(0);
            setActionFeedback('');
            setStatusOverrides({});
        }
    }, [isOpen, vouchers]);

    const currentVoucher = vouchers[currentIndex] || null;
    const currentStatus = (currentVoucher && statusOverrides[currentVoucher.code]) || currentVoucher?.status;

    // Tạo mã QR Code khi mã hiện tại thay đổi
    useEffect(() => {
        if (!currentVoucher) {
            setQrDataUrl('');
            return;
        }

        let isMounted = true;
        QRCode.toDataURL(currentVoucher.code, {
            width: 320,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
                dark: '#0f172a', // slate-900
                light: '#ffffff'
            }
        })
            .then((url) => {
                if (isMounted) setQrDataUrl(url);
            })
            .catch((err) => {
                console.error('Lỗi tạo QR code:', err);
                if (isMounted) setQrDataUrl('');
            });

        return () => {
            isMounted = false;
        };
    }, [currentVoucher?.code]);

    const handleCopy = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(''), 2000);
        } catch {}
    };

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
            setActionFeedback('');
        }
    }, [currentIndex]);

    const handleNext = useCallback(() => {
        if (currentIndex < vouchers.length - 1) {
            setCurrentIndex((prev) => prev + 1);
            setActionFeedback('');
        }
    }, [currentIndex, vouchers.length]);

    // Thao tác Reset mã hiện tại
    const handleReset = async () => {
        if (!currentVoucher || isActionLoading) return;
        setIsActionLoading(true);
        setActionFeedback('Đang reset mã...');

        try {
            await onResetVoucher(currentVoucher.code);
            setStatusOverrides((prev) => ({ ...prev, [currentVoucher.code]: 'AVAILABLE' }));
            setActionFeedback(`✅ Đã reset mã "${currentVoucher.code}" về kho chờ!`);

            // Tự động chuyển sang mã kế tiếp sau 600ms
            setTimeout(() => {
                if (currentIndex < vouchers.length - 1) {
                    setCurrentIndex((prev) => prev + 1);
                    setActionFeedback('');
                }
            }, 600);
        } catch (e: any) {
            setActionFeedback(`❌ Lỗi: ${e.message || 'Không thể reset'}`);
        } finally {
            setIsActionLoading(false);
        }
    };

    // Thao tác Đánh dấu Đã Dùng
    const handleMarkUsed = async () => {
        if (!currentVoucher || !onMarkUsed || isActionLoading) return;
        setIsActionLoading(true);
        setActionFeedback('Đang cập nhật trạng thái...');

        try {
            await onMarkUsed(currentVoucher.code);
            setStatusOverrides((prev) => ({ ...prev, [currentVoucher.code]: 'USED' }));
            setActionFeedback(`🎉 Đã đánh dấu mã "${currentVoucher.code}" là ĐÃ DÙNG!`);

            // Tự động chuyển sang mã kế tiếp sau 600ms
            setTimeout(() => {
                if (currentIndex < vouchers.length - 1) {
                    setCurrentIndex((prev) => prev + 1);
                    setActionFeedback('');
                }
            }, 600);
        } catch (e: any) {
            setActionFeedback(`❌ Lỗi: ${e.message || 'Không thể cập nhật'}`);
        } finally {
            setIsActionLoading(false);
        }
    };

    // Lắng nghe phím mũi tên và phím tắt trên PC
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Tránh trigger khi user đang gõ trong input/textarea
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                handlePrev();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                handleNext();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                handleReset();
            } else if (e.key === 'u' || e.key === 'U') {
                e.preventDefault();
                handleMarkUsed();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handlePrev, handleNext, onClose, currentVoucher, isActionLoading]);

    if (!isOpen) return null;

    if (vouchers.length === 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-avo animate-in fade-in">
                <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
                    <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
                    <div>
                        <h3 className="font-black text-base text-slate-900">Không Có Mã Nào Được Chọn</h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Vui lòng tích chọn mã trong danh sách hoặc sử dụng bộ lọc để tạo QR code double check.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer hover:bg-slate-800"
                    >
                        Đóng Lại
                    </button>
                </div>
            </div>
        );
    }

    const progressPercent = Math.round(((currentIndex + 1) / vouchers.length) * 100);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs font-avo animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[96vh] animate-in zoom-in-95 duration-200">
                {/* 1. Header */}
                <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 text-white px-4 sm:px-5 py-3.5 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
                            <QrCode className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-black text-xs sm:text-sm uppercase tracking-wide flex items-center gap-1.5">
                                <span>Double Check QR Code</span>
                                <span className="bg-amber-400 text-slate-950 px-2 py-0.2 rounded-full text-[10px] font-black">
                                    POS / Quét
                                </span>
                            </div>
                            <div className="text-[11px] text-indigo-100 font-bold">
                                Mã {currentIndex + 1} / {vouchers.length} coupon
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-white/20 text-white transition cursor-pointer"
                        title="Đóng (Esc)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Thanh Progress Bar */}
                <div className="w-full bg-slate-100 h-1.5 overflow-hidden">
                    <div
                        className="bg-gradient-to-r from-amber-400 to-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                {/* 2. Body: QR Code & Thông Tin */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
                    {/* Thông báo phản hồi sau thao tác */}
                    {actionFeedback && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center font-bold text-xs animate-in fade-in">
                            {actionFeedback}
                        </div>
                    )}

                    {/* Khung Vùng QR Code Trung Tâm */}
                    <div className="bg-gradient-to-b from-slate-50 to-white rounded-2xl p-4 border border-slate-200 text-center shadow-xs flex flex-col items-center justify-center">
                        {/* Chương trình & Mệnh giá */}
                        <div className="w-full flex items-center justify-between border-b border-slate-200/80 pb-2 mb-3">
                            <div className="text-left truncate pr-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Chương Trình</span>
                                <span className="font-black text-xs text-slate-800 truncate block" title={currentVoucher?.campaign_name}>
                                    {currentVoucher?.campaign_name}
                                </span>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Mệnh Giá</span>
                                <span className="font-mono font-black text-sm text-rose-600 block">
                                    {Number(currentVoucher?.denomination || 0).toLocaleString('vi-VN')}đ
                                </span>
                                {currentVoucher?.expires_at && (
                                    <span className="text-[9.5px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 inline-block mt-0.5 font-mono">
                                        HSD: {formatDate(currentVoucher.expires_at)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Hình ảnh QR Code */}
                        <div className="relative p-2 bg-white rounded-2xl border-2 border-indigo-200 shadow-md inline-block">
                            {qrDataUrl ? (
                                <img
                                    src={qrDataUrl}
                                    alt={`QR Code ${currentVoucher?.code}`}
                                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl select-none"
                                />
                            ) : (
                                <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-slate-400 text-xs font-bold">
                                    Đang tạo mã QR...
                                </div>
                            )}

                            {/* Logo nhỏ giữa QR code để tăng tính nhận diện */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-1 shadow-xs border border-slate-200 pointer-events-none">
                                <Tag className="w-4 h-4 text-indigo-600" />
                            </div>
                        </div>

                        {/* Text Mã Voucher + Nút Copy */}
                        <div className="mt-3 flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => currentVoucher && handleCopy(currentVoucher.code)}
                                className="font-mono font-black text-base sm:text-lg tracking-wider text-slate-900 hover:text-indigo-600 transition cursor-pointer flex items-center gap-1.5 group bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs"
                                title="Bấm để copy mã"
                            >
                                <span>{currentVoucher?.code}</span>
                                {copiedCode === currentVoucher?.code ? (
                                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0" />
                                )}
                            </button>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                            {copiedCode === currentVoucher?.code ? (
                                <span className="text-emerald-600 font-bold">✓ Đã copy mã vào bộ nhớ tạm</span>
                            ) : (
                                'Đưa máy quét POS vào QR code hoặc bấm để copy mã'
                            )}
                        </div>

                        {/* Trạng thái hiện tại */}
                        <div className="mt-2.5">
                            {currentStatus === 'AVAILABLE' ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10.5px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Khả Dụng (Đã Trả Về Kho)
                                </span>
                            ) : currentStatus === 'USED' ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10.5px] font-black bg-slate-200 text-slate-800">
                                    <CheckCircle2 className="w-3 h-3 text-slate-600" /> Đã Sử Dụng Thành Công
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10.5px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-700" /> Đang Giữ (Cần Double Check)
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Chi tiết người nhận & siêu thị */}
                    {currentVoucher?.claimed_by_name && (
                        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-[11px] space-y-1.5 text-slate-600">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                                <div className="flex items-center gap-1.5">
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>NV lấy mã: <strong className="text-slate-900">{currentVoucher.claimed_by_name}</strong> ({currentVoucher.claimed_by_id})</span>
                                </div>
                                {currentVoucher.claimed_by_store && (
                                    <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                                        🏪 {getShortStoreName(currentVoucher.claimed_by_store)}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center justify-between text-[10.5px] pt-1 border-t border-slate-200/60 flex-wrap gap-1">
                                {currentVoucher.order_id && (
                                    <div className="flex items-center gap-1 text-indigo-700 font-bold font-mono">
                                        <ShoppingBag className="w-3 h-3 shrink-0" />
                                        <span>Đơn: {currentVoucher.order_id}</span>
                                    </div>
                                )}
                                {currentVoucher.claimed_at && (
                                    <span className="text-slate-400">
                                        ⏱️ {formatDate(currentVoucher.claimed_at)} {new Date(currentVoucher.claimed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 3. HAI NÚT THAO TÁC: RESET / ĐÃ DÙNG */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                        {/* Nút Reset */}
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={isActionLoading || currentStatus === 'AVAILABLE'}
                            className="py-3 px-3 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-black text-xs transition cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                            title="Reset mã này về danh sách chờ khả dụng (Phím tắt: R)"
                        >
                            <RotateCcw className="w-4 h-4 shrink-0" />
                            <span>RESET VỀ KHO (R)</span>
                        </button>

                        {/* Nút Đã Dùng */}
                        <button
                            type="button"
                            onClick={handleMarkUsed}
                            disabled={isActionLoading || currentStatus === 'USED'}
                            className="py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs transition cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                            title="Xác nhận mã đã thanh toán xong trên đơn hàng (Phím tắt: U)"
                        >
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>ĐÃ DÙNG (U)</span>
                        </button>
                    </div>

                    {/* 4. ĐIỀU HƯỚNG MŨI TÊN TRÁI / PHẢI */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                            title="Mã trước đó (Phím mũi tên ←)"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Mã Trước (←)</span>
                        </button>

                        <span className="text-[11px] font-mono font-bold text-slate-500 px-2 shrink-0">
                            {currentIndex + 1} / {vouchers.length}
                        </span>

                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={currentIndex === vouchers.length - 1}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-black text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 shadow-xs"
                            title="Mã tiếp theo (Phím mũi tên →)"
                        >
                            <span>Mã Sau (→)</span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Gợi ý phím tắt PC */}
                    <div className="text-[10px] text-center text-slate-400 pt-0.5">
                        💡 Phím tắt: <strong>← →</strong> chuyển mã | <strong>R</strong>: Reset | <strong>U</strong>: Đã dùng | <strong>Esc</strong>: Đóng
                    </div>
                </div>
            </div>
        </div>
    );
}
