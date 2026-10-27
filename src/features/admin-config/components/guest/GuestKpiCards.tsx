import React from 'react';
import { Users, CheckCircle2, Clock, ShieldCheck, Sparkles } from 'lucide-react';
import type { UserProfile } from '../../../../core/lib/authService';
import type { AccountExpirationConfig } from '../../services/guestTrialService';
import { calculateRemainingDays } from '../../services/guestTrialService';

interface Props {
    guests: UserProfile[];
    config: AccountExpirationConfig;
}

export default function GuestKpiCards({ guests, config }: Props) {
    const total = guests.length;
    const active = guests.filter(g => {
        const remaining = calculateRemainingDays(g.guest_expires_at);
        return g.status === 'ACTIVE' && !remaining.isExpired;
    }).length;
    const expired = guests.filter(g => {
        const remaining = calculateRemainingDays(g.guest_expires_at);
        return g.status === 'REJECTED' || remaining.isExpired;
    }).length;

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* Thẻ 1: Tổng tài khoản trải nghiệm */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Tài Khoản Guest
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-800 tracking-tight">{total}</span>
                    <span className="text-[11px] font-semibold text-slate-400">/ 3 tài khoản</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Dành cho khách dùng thử</span>
                </div>
            </div>

            {/* Thẻ 2: Đang hoạt động */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Đang Hoạt Động
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-emerald-600 tracking-tight">{active}</span>
                    <span className="text-[11px] font-semibold text-slate-400">sẵn sàng chia sẻ</span>
                </div>
                <div className="mt-1 text-[11px] text-emerald-600 font-medium">
                    <span>🟢 Còn hạn đăng nhập</span>
                </div>
            </div>

            {/* Thẻ 3: Đã / Sắp hết hạn */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Hết Hạn / Tạm Khóa
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-rose-600 tracking-tight">{expired}</span>
                    <span className="text-[11px] font-semibold text-slate-400">cần gia hạn</span>
                </div>
                <div className="mt-1 text-[11px] text-rose-500 font-medium">
                    <span>🔴 Không thể vào hệ thống</span>
                </div>
            </div>

            {/* Thẻ 4: Cấu hình hạn dùng theo ngày */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Hạn Dùng Mặc Định
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-indigo-600 tracking-tight">
                        {config.default_guest_valid_days}
                    </span>
                    <span className="text-xs font-bold text-slate-500">ngày / lần cấp</span>
                </div>
                <div className="mt-1 text-[10.5px] font-medium text-slate-500 truncate">
                    {config.apply_to_all_accounts ? (
                        <span className="text-emerald-700 font-bold">⚡ Đã bật áp dụng toàn hệ thống</span>
                    ) : (
                        <span className="text-slate-400">Hiện chỉ áp dụng cho Guest</span>
                    )}
                </div>
            </div>
        </div>
    );
}
