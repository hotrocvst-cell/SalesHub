import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Ticket,
    Sparkles,
    ShoppingBag,
    ShieldCheck,
    CheckCircle2,
    AlertCircle,
    ArrowUp,
    Tag,
    RefreshCw,
    History,
    ChevronDown
} from 'lucide-react';
import { useAuth } from '../../shared/contexts/AuthContext';
import type { VoucherItem, VoucherCampaignSummary } from './types';
import {
    fetchStoreVouchers,
    claimVoucher,
    getCampaignSummaries
} from './services/voucherService';
import VoucherCard from './components/VoucherCard';

export default function VoucherClaimPage() {
    const { currentUser } = useAuth();
    const formTopRef = useRef<HTMLDivElement>(null);

    const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [selectedCampaign, setSelectedCampaign] = useState<string>('');
    const [selectedDenomination, setSelectedDenomination] = useState<number>(0);
    const [orderId, setOrderId] = useState<string>('');
    const [termsAgreed, setTermsAgreed] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [justClaimedVoucher, setJustClaimedVoucher] = useState<VoucherItem | null>(null);
    const [toastMessage, setToastMessage] = useState<string>('');
    const [visibleHistoryCount, setVisibleHistoryCount] = useState<number>(5);

    const userStoreName = currentUser.store_name || 'Toàn Cụm Siêu Thị';

    const loadData = async () => {
        setLoading(true);
        try {
            const list = await fetchStoreVouchers(userStoreName);
            setVouchers(list);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [userStoreName]);

    // Tóm tắt các chương trình và tồn kho
    const campaignSummaries = useMemo<VoucherCampaignSummary[]>(() => {
        return getCampaignSummaries(vouchers, userStoreName);
    }, [vouchers, userStoreName]);

    // Các mệnh giá khả dụng của chương trình đang chọn
    const activeCampaignData = useMemo(() => {
        if (!selectedCampaign) return null;
        return campaignSummaries.find(c => c.campaign_name === selectedCampaign) || null;
    }, [campaignSummaries, selectedCampaign]);

    // Tự động chọn chương trình đầu tiên nếu chưa chọn
    useEffect(() => {
        if (campaignSummaries.length > 0 && !selectedCampaign) {
            const firstAvailable = campaignSummaries.find(c => c.total_available > 0) || campaignSummaries[0];
            setSelectedCampaign(firstAvailable.campaign_name);
            const firstDenom = firstAvailable.denominations.find(d => d.available > 0) || firstAvailable.denominations[0];
            if (firstDenom) setSelectedDenomination(firstDenom.denomination);
        }
    }, [campaignSummaries, selectedCampaign]);

    // Khi đổi chương trình, chọn mệnh giá còn hàng đầu tiên
    const handleSelectCampaign = (cName: string) => {
        setSelectedCampaign(cName);
        const camp = campaignSummaries.find(c => c.campaign_name === cName);
        if (camp) {
            const availableDenom = camp.denominations.find(d => d.available > 0) || camp.denominations[0];
            setSelectedDenomination(availableDenom ? availableDenom.denomination : 0);
        }
        setErrorMsg('');
    };

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3000);
    };

    // Thao tác Cấp Mã
    const handleClaim = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!selectedCampaign) {
            setErrorMsg('Vui lòng chọn chương trình voucher!');
            return;
        }
        if (!selectedDenomination || selectedDenomination <= 0) {
            setErrorMsg('Vui lòng chọn mệnh giá voucher cần cấp!');
            return;
        }
        if (!orderId.trim()) {
            setErrorMsg('Vui lòng nhập Mã đơn hàng / Số hóa đơn để gắn với voucher!');
            return;
        }
        if (!termsAgreed) {
            setErrorMsg('Bạn cần tick cam kết điều khoản sử dụng mã trước khi lấy!');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await claimVoucher({
                store_name: userStoreName,
                campaign_name: selectedCampaign,
                denomination: selectedDenomination,
                order_id: orderId.trim().toUpperCase(),
                employee_id: currentUser.employee_id || currentUser.id || 'NV',
                employee_name: currentUser.full_name || 'Nhân Viên'
            });

            if (!res.success || !res.voucher) {
                setErrorMsg(res.error || 'Không thể cấp mã lúc này.');
                return;
            }

            setJustClaimedVoucher(res.voucher);
            setOrderId('');
            setTermsAgreed(false);
            showToast('🎉 Đã cấp mã voucher thành công!');
            await loadData();
        } catch (e: any) {
            setErrorMsg(e.message || 'Lỗi hệ thống');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Nút Lấy Mã Mới: đưa user về đầu trang để thao tác chọn coupon cần lấy
    const handleRequestNewVoucher = () => {
        setJustClaimedVoucher(null);
        setErrorMsg('');
        if (formTopRef.current) {
            formTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Toàn bộ lịch sử mã mà cá nhân user này đã nhận
    const myClaimedVouchers = useMemo(() => {
        const empId = (currentUser.employee_id || currentUser.id || '').trim();
        if (!empId) return [];
        return vouchers
            .filter(v => (v.claimed_by_id || '').trim() === empId)
            .sort((a, b) => new Date(b.claimed_at || 0).getTime() - new Date(a.claimed_at || 0).getTime());
    }, [vouchers, currentUser]);

    const displayedHistoryVouchers = useMemo(() => {
        return myClaimedVouchers.slice(0, visibleHistoryCount);
    }, [myClaimedVouchers, visibleHistoryCount]);

    const remainingHistoryCount = myClaimedVouchers.length - visibleHistoryCount;

    return (
        <div ref={formTopRef} className="space-y-4 pb-16 font-avo max-w-lg mx-auto">
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-in fade-in">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* 1. HERO BANNER DI ĐỘNG */}
            <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white rounded-3xl p-5 shadow-md relative overflow-hidden">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                            <Ticket className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-base sm:text-lg font-black text-amber-300 uppercase tracking-tight">
                                CẤP MÃ PHIẾU MUA HÀNG
                            </h1>
                            <div className="text-[11px] text-emerald-100 font-bold">
                                🏢 {userStoreName}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={loadData}
                        className="p-2 rounded-xl bg-emerald-900/60 hover:bg-emerald-900 text-emerald-200 transition cursor-pointer"
                        title="Tải lại kho mã"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* 2. KẾT QUẢ VỪA CẤP THÀNH CÔNG (NẾU CÓ) */}
            {justClaimedVoucher && (
                <div className="bg-emerald-50 border-2 border-emerald-500 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between text-emerald-900">
                        <div className="flex items-center gap-2 font-black text-sm">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <span>CẤP MÃ VOUCHER THÀNH CÔNG!</span>
                        </div>
                        <span className="text-[11px] font-bold bg-emerald-200/80 px-2.5 py-0.5 rounded-full">
                            Sẵn Sàng Dùng
                        </span>
                    </div>

                    <VoucherCard voucher={justClaimedVoucher} onCopySuccess={() => showToast('📋 Đã copy mã vào bộ nhớ tạm!')} />

                    <button
                        type="button"
                        onClick={handleRequestNewVoucher}
                        className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                        <ArrowUp className="w-4 h-4 text-amber-400" />
                        <span>LẤY THÊM MÃ MỚI CHO ĐƠN TIẾP THEO</span>
                    </button>
                </div>
            )}

            {/* 3. FORM THAO TÁC CẤP MÃ */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-emerald-600" />
                        <h2 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                            Chọn PMH Cần Lấy
                        </h2>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">
                        Kho: {vouchers.filter(v => v.status === 'AVAILABLE').length} mã sẵn sàng
                    </span>
                </div>

                <form onSubmit={handleClaim} className="space-y-4 text-xs">
                    {errorMsg && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-2 font-bold animate-shake">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* BƯỚC 1: CHỌN CHƯƠNG TRÌNH */}
                    <div>
                        <label className="block text-[11px] font-black uppercase text-slate-600 mb-1.5">
                            1. Chương Trình Áp Dụng:
                        </label>
                        <div className="grid grid-cols-1 gap-1.5">
                            {campaignSummaries.length === 0 ? (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 font-bold text-xs">
                                    Chưa có chương trình nào nạp mã cho siêu thị này.
                                </div>
                            ) : (
                                campaignSummaries.map(c => {
                                    const isSelected = selectedCampaign === c.campaign_name;
                                    const hasStock = c.total_available > 0;

                                    return (
                                        <button
                                            key={c.campaign_name}
                                            type="button"
                                            onClick={() => handleSelectCampaign(c.campaign_name)}
                                            className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between ${isSelected
                                                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-black'
                                                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-700'
                                                }`}
                                        >
                                            <div className="truncate pr-2">
                                                <div className="text-xs font-black truncate">{c.campaign_name}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">
                                                    {c.denominations.length} mức mệnh giá
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${hasStock ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                                                }`}>
                                                {hasStock ? `Còn ${c.total_available} mã` : 'Hết mã'}
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* BƯỚC 2: CHỌN MỆNH GIÁ */}
                    {activeCampaignData && (
                        <div>
                            <label className="block text-[11px] font-black uppercase text-slate-600 mb-1.5">
                                2. Mệnh Giá Voucher:
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {activeCampaignData.denominations.map(d => {
                                    const isSelected = selectedDenomination === d.denomination;
                                    const isAvailable = d.available > 0;

                                    return (
                                        <button
                                            key={d.denomination}
                                            type="button"
                                            disabled={!isAvailable}
                                            onClick={() => setSelectedDenomination(d.denomination)}
                                            className={`p-2.5 rounded-2xl border text-center transition cursor-pointer ${isSelected
                                                ? 'bg-amber-500 border-amber-600 text-white shadow-sm ring-2 ring-amber-300'
                                                : isAvailable
                                                    ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                                                    : 'bg-slate-100 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
                                                }`}
                                        >
                                            <div className="font-mono font-black text-sm">
                                                {d.denomination.toLocaleString('vi-VN')}đ
                                            </div>
                                            <div className={`text-[10px] font-bold mt-0.5 ${isSelected ? 'text-amber-100' : isAvailable ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                {isAvailable ? `Còn ${d.available} mã` : 'Hết mã'}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* BƯỚC 3: MÃ ĐƠN HÀNG */}
                    <div>
                        <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                            3. Mã Đơn Hàng: <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <ShoppingBag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={orderId}
                                onChange={(e) => setOrderId(e.target.value)}
                                placeholder="Nhập mã đơn hàng (VD: 00123SO26100703889)"
                                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs font-bold text-slate-900 focus:bg-white focus:outline-emerald-600 uppercase"
                                required
                            />
                        </div>
                    </div>

                    {/* BƯỚC 4: XÁC NHẬN ĐIỀU KHOẢN */}
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={termsAgreed}
                                onChange={(e) => setTermsAgreed(e.target.checked)}
                                className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className="text-[11px] text-slate-600 font-medium leading-relaxed">
                                Tôi cam kết sử dụng voucher cho đúng đơn hàng thực tế của khách hàng, tuyệt đối <strong>không đầu cơ tích trữ mã</strong>.
                            </span>
                        </label>
                    </div>

                    {/* BƯỚC 5: NÚT CẤP MÃ */}
                    <button
                        type="submit"
                        disabled={isSubmitting || !termsAgreed || !selectedDenomination}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider transition cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Ticket className="w-5 h-5 text-amber-300" />
                        <span>{isSubmitting ? 'ĐANG CẤP MÃ...' : 'CẤP MÃ VOUCHER NGAY'}</span>
                    </button>
                </form>
            </div>

            {/* 4. LỊCH SỬ MÃ ĐÃ NHẬN (MẶC ĐỊNH 5 MÃ, XEM THÊM MỞ RỘNG MỖI LẦN 5 MÃ) */}
            {myClaimedVouchers.length > 0 && (
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3 font-avo">
                    <div className="flex items-center justify-between text-xs font-black text-slate-800 border-b border-slate-100 pb-2.5 flex-wrap gap-1">
                        <div className="flex items-center gap-1.5">
                            <History className="w-4 h-4 text-emerald-600" />
                            <span>Lịch Sử Mã Voucher Bạn Đã Nhận:</span>
                        </div>
                        <span className="text-[10px] text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full font-bold">
                            Hiển thị {displayedHistoryVouchers.length}/{myClaimedVouchers.length} mã
                        </span>
                    </div>

                    <div className="space-y-2.5">
                        {displayedHistoryVouchers.map(v => (
                            <VoucherCard key={v.id} voucher={v} compact onCopySuccess={() => showToast('📋 Đã copy mã!')} />
                        ))}
                    </div>

                    {/* NÚT XEM THÊM (+5 MÃ) & THU GỌN */}
                    <div className="pt-1 flex items-center justify-center gap-2">
                        {remainingHistoryCount > 0 && (
                            <button
                                type="button"
                                onClick={() => setVisibleHistoryCount(prev => prev + 5)}
                                className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.99]"
                            >
                                <ChevronDown className="w-4 h-4 text-emerald-600" />
                                <span>Xem thêm 5 mã (còn {remainingHistoryCount} mã nữa)</span>
                            </button>
                        )}
                        {visibleHistoryCount > 5 && (
                            <button
                                type="button"
                                onClick={() => setVisibleHistoryCount(5)}
                                className="py-2.5 px-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold text-xs transition cursor-pointer"
                            >
                                Thu gọn
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
