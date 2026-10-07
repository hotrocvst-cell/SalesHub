import React from 'react';
import { Ticket, CheckCircle2, Clock, AlertTriangle, Flame, Trash2 } from 'lucide-react';
import type { VoucherItem, VoucherHoardingAlert } from '../types';

interface Props {
    vouchers: VoucherItem[];
    hoardingAlerts: VoucherHoardingAlert[];
    onFilterExpired?: () => void;
    onOpenCleanModal?: () => void;
}

export default function VoucherAdminStats({ vouchers, hoardingAlerts, onFilterExpired, onOpenCleanModal }: Props) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const total = vouchers.length;

    // Mã khả dụng (chưa cấp và chưa quá hạn)
    const available = vouchers.filter(v => v.status === 'AVAILABLE' && (!v.expires_at || v.expires_at >= todayStr)).length;
    const claimed = vouchers.filter(v => v.status === 'CLAIMED').length;

    // Mã đã quá hạn (chưa sử dụng hoàn tất)
    const expiredVouchers = vouchers.filter(v => Boolean(v.expires_at && v.expires_at < todayStr && v.status !== 'USED'));
    const expiredCount = expiredVouchers.length;
    const expiredValue = expiredVouchers.reduce((sum, v) => sum + (Number(v.denomination) || 0), 0);

    const criticalAlerts = hoardingAlerts.filter(a => a.risk_level === 'CRITICAL').length;
    const warningAlerts = hoardingAlerts.filter(a => a.risk_level === 'WARNING').length;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 font-avo">
            {/* 1. Tổng kho */}
            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">Tổng Kho Mã</span>
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
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">Khả Dụng (Sẵn Sàng)</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700">
                    {available.toLocaleString('vi-VN')}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                    {total > 0 ? Math.round((available / total) * 100) : 0}% tồn khả dụng
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
            <div className={`rounded-2xl p-3 sm:p-3.5 border shadow-2xs transition ${
                expiredCount > 0
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
                        {expiredCount > 0 ? `${(expiredValue / 1000).toLocaleString('vi-VN')}k tồn chết` : 'Kho sạch, 0 mã hết hạn'}
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
            <div className={`rounded-2xl p-3 sm:p-3.5 border shadow-2xs ${
                criticalAlerts > 0 ? 'border-rose-300 bg-rose-50/40 text-rose-950 col-span-2 sm:col-span-1' : 'bg-white border-slate-200 col-span-2 sm:col-span-1'
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
