import React from 'react';
import { Ticket, CheckCircle2, Clock, AlertTriangle, Flame, Trash2 } from 'lucide-react';
import type { VoucherItem, VoucherHoardingAlert, VoucherCampaignStatusConfig } from '../types';
import { isCampaignEndedOrHidden } from '../services/voucherService';

interface Props {
    vouchers: VoucherItem[];
    hoardingAlerts: VoucherHoardingAlert[];
    campaignStatuses?: Record<string, VoucherCampaignStatusConfig>;
    onFilterExpired?: () => void;
    onOpenCleanModal?: () => void;
}

export default function VoucherAdminStats({ vouchers, hoardingAlerts, campaignStatuses, onFilterExpired, onOpenCleanModal }: Props) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const total = vouchers.length;

    const isArchived = (cName: string, denom?: number) => {
        return isCampaignEndedOrHidden(campaignStatuses, cName, denom);
    };

    // Mã khả dụng (chưa cấp và chưa quá hạn của các chương trình đang hoạt động)
    const available = vouchers.filter(v => v.status === 'AVAILABLE' && (!v.expires_at || v.expires_at >= todayStr) && !isArchived(v.campaign_name, v.denomination)).length;
    const claimed = vouchers.filter(v => v.status === 'CLAIMED').length;

    // Mã đã quá hạn trong các chương trình ĐANG HOẠT ĐỘNG (cần xử lý)
    const activeExpiredVouchers = vouchers.filter(v => Boolean(v.expires_at && v.expires_at < todayStr && v.status !== 'USED') && !isArchived(v.campaign_name, v.denomination));
    const expiredCount = activeExpiredVouchers.length;
    const expiredValue = activeExpiredVouchers.reduce((sum, v) => sum + (Number(v.denomination) || 0), 0);

    // Mã quá hạn đã được ẩn hoặc kết thúc an toàn trong các chương trình lưu trữ
    const hiddenExpiredCount = vouchers.filter(v => Boolean(v.expires_at && v.expires_at < todayStr && v.status !== 'USED') && isArchived(v.campaign_name, v.denomination)).length;

    const criticalAlerts = hoardingAlerts.filter(a => a.risk_level === 'CRITICAL').length;
    const warningAlerts = hoardingAlerts.filter(a => a.risk_level === 'WARNING').length;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 font-avo">
            {/* 1. Tổng kho */}
            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">Tổng Kho</span>
                    <Ticket className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                    {total.toLocaleString('vi-VN')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                    Tất cả chương trình
                </div>
            </div>

            {/* 2. Khả dụng (chưa cấp và còn hạn) */}
            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-emerald-200 bg-emerald-50/30 shadow-2xs">
                <div className="flex items-center justify-between text-emerald-700 mb-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">Khả Dụng</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700">
                    {available.toLocaleString('vi-VN')}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                    {total > 0 ? Math.round((available / total) * 100) : 0}% khả dụng
                </div>
            </div>

            {/* 3. Đang giữ */}
            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-amber-200 bg-amber-50/30 shadow-2xs">
                <div className="flex items-center justify-between text-amber-800 mb-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">Đã Cấp (Đang Giữ)</span>
                    <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-amber-700">
                    {claimed.toLocaleString('vi-VN')}
                </div>
                <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                    Chưa xác nhận dùng: {claimed}
                </div>
            </div>

            {/* 4. Mã Hết Hạn / Cần Dọn Kho */}
            <div className={`rounded-2xl p-3 sm:p-3.5 border shadow-2xs transition ${expiredCount > 0
                ? 'bg-rose-50/50 border-rose-300 text-rose-950 ring-1 ring-rose-200'
                : 'bg-white border-slate-200 text-slate-700'
                }`}>
                <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className={`text-[10.5px] font-bold uppercase tracking-wider ${expiredCount > 0 ? 'text-rose-700 font-black' : ''}`}>
                        Quá Hạn (Cần Dọn)
                    </span>
                    <Trash2 className={`w-4 h-4 ${expiredCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                </div>
                <div className="flex items-baseline justify-between gap-1">
                    <div className={`text-xl sm:text-2xl font-black font-mono ${expiredCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {expiredCount.toLocaleString('vi-VN')}
                    </div>
                    {expiredCount > 0 && onOpenCleanModal && (
                        <button
                            type="button"
                            onClick={onOpenCleanModal}
                            className="text-[10px] font-black bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 rounded-md cursor-pointer transition shadow-2xs"
                            title="Mở bảng làm sạch kho mã hết hạn"
                        >
                            Làm sạch
                        </button>
                    )}
                </div>
                <div className="flex items-center justify-between text-[10px] mt-0.5">
                    <span className={expiredCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                        {expiredCount > 0
                            ? `${(expiredValue / 1000).toLocaleString('vi-VN')}k tồn chết`
                            : hiddenExpiredCount > 0
                            ? `Đã lưu trữ ${hiddenExpiredCount} mã cũ`
                            : 'Kho sạch, 0 mã hết hạn'}
                    </span>
                    {expiredCount > 0 && onFilterExpired && (
                        <button
                            type="button"
                            onClick={onFilterExpired}
                            className="text-rose-700 underline font-black hover:text-rose-900 cursor-pointer"
                        >
                            Xem mã
                        </button>
                    )}
                </div>
            </div>

            {/* 5. Cảnh báo đầu cơ */}
            <div className={`rounded-2xl p-3 sm:p-3.5 border shadow-2xs ${criticalAlerts > 0 ? 'border-rose-300 bg-rose-50/40 text-rose-950 col-span-2 sm:col-span-1' : 'bg-white border-slate-200 col-span-2 sm:col-span-1'
                }`}>
                <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">Cảnh Báo Đầu Cơ</span>
                    {criticalAlerts > 0 ? (
                        <Flame className="w-4 h-4 text-rose-600 animate-bounce" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                </div>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-xl sm:text-2xl font-black font-mono text-rose-600">
                        {criticalAlerts}
                    </span>
                    <span className="text-xs text-amber-600 font-bold">
                        (+{warningAlerts} chú ý)
                    </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                    {criticalAlerts > 0 ? 'Phát hiện lấy mã liên tiếp' : 'Không có bất thường lớn'}
                </div>
            </div>
        </div>
    );
}
