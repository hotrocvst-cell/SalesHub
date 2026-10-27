import { useState } from 'react';
import {
    Copy,
    Check,
    KeyRound,
    Lock,
    Unlock,
    Trash2,
    Calendar,
    Eye,
    EyeOff,
    Sparkles,
    UserCheck,
    Store,
    Clock,
    Plus
} from 'lucide-react';
import type { UserProfile } from '../../../../core/lib/authService';
import { calculateRemainingDays } from '../../services/guestTrialService';

interface Props {
    guests: UserProfile[];
    onOpenChangePassword: (user: UserProfile) => void;
    onOpenShareMessage: (user: UserProfile) => void;
    onToggleLock: (user: UserProfile) => void;
    onDelete: (user: UserProfile) => void;
    onExtendDays: (user: UserProfile, days: number) => void;
    onGenerateDefaults: () => void;
}

export default function GuestAccountTable({
    guests,
    onOpenChangePassword,
    onOpenShareMessage,
    onToggleLock,
    onDelete,
    onExtendDays,
    onGenerateDefaults
}: Props) {
    const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
    const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

    const toggleReveal = (userId: string) => {
        setRevealedPasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
    };

    const handleCopyLoginShort = (user: UserProfile) => {
        const pass = user.password || 'SalesHub@2026';
        const text = `Tài khoản: ${user.email} | Mật khẩu: ${pass} | Link: ${window.location.origin}/dang-nhap`;
        navigator.clipboard.writeText(text);
        setCopiedUserId(user.id);
        setTimeout(() => setCopiedUserId(null), 2000);
    };

    if (guests.length === 0) {
        return (
            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-slate-800">Chưa có tài khoản trải nghiệm nào</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                        Khởi tạo nhanh 1-3 tài khoản trải nghiệm mẫu chuẩn (`guest1@saleshub.vn`, `guest2...`) để gửi ngay cho khách hàng!
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onGenerateDefaults}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    <span>Khởi Tạo Nhanh 3 Tài Khoản Mẫu</span>
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10.5px]">
                            <th className="py-2.5 px-3 text-center w-12">STT</th>
                            <th className="py-2.5 px-3">Tài Khoản / Khách Hàng</th>
                            <th className="py-2.5 px-3">Mật Khẩu</th>
                            <th className="py-2.5 px-3">Thời Hạn Hoạt Động (Theo Ngày)</th>
                            <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                            <th className="py-2.5 px-3 text-right">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {guests.map((user, idx) => {
                            const remaining = calculateRemainingDays(user.guest_expires_at);
                            const isRevealed = Boolean(revealedPasswords[user.id]);
                            const isCopied = copiedUserId === user.id;

                            return (
                                <tr key={user.id} className="hover:bg-slate-50/80 transition">
                                    {/* STT */}
                                    <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                                        {idx + 1}
                                    </td>

                                    {/* Tài khoản / Khách hàng */}
                                    <td className="py-2.5 px-3">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                <span>{user.full_name}</span>
                                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                                                    GUEST
                                                </span>
                                            </div>
                                            <span className="text-slate-500 font-mono text-[11px] select-all">
                                                {user.email}
                                            </span>
                                            <div className="flex items-center gap-1 text-[10.5px] text-slate-400 mt-0.5">
                                                <Store className="w-3 h-3 text-slate-400" />
                                                <span>{user.store_name || 'Siêu thị Mẫu SalesHub'}</span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Mật khẩu */}
                                    <td className="py-2.5 px-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 min-w-[90px] text-center select-all">
                                                {isRevealed ? user.password || '123456' : '••••••••'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => toggleReveal(user.id)}
                                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                                                title={isRevealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                            >
                                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onOpenChangePassword(user)}
                                                className="p-1 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                                title="Đổi mật khẩu tài khoản này"
                                            >
                                                <KeyRound className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>

                                    {/* Thời hạn hoạt động */}
                                    <td className="py-2.5 px-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10.5px] ${
                                                        remaining.isExpired
                                                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                            : remaining.days <= 2
                                                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                    }`}
                                                >
                                                    <Clock className="w-3 h-3" />
                                                    {remaining.label}
                                                </span>
                                                <span className="text-[10.5px] text-slate-500">
                                                    (Hạn: {remaining.formattedDate})
                                                </span>
                                            </div>

                                            {/* Nút gia hạn nhanh */}
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-400">Gia hạn:</span>
                                                {[3, 7, 30].map(d => (
                                                    <button
                                                        key={d}
                                                        type="button"
                                                        onClick={() => onExtendDays(user, d)}
                                                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-[10px] font-bold border border-slate-200 transition cursor-pointer"
                                                        title={`Cộng thêm ${d} ngày sử dụng`}
                                                    >
                                                        +{d}d
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Trạng thái */}
                                    <td className="py-2.5 px-3 text-center">
                                        {user.status === 'ACTIVE' && !remaining.isExpired ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                🟢 Hoạt động
                                            </span>
                                        ) : remaining.isExpired ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                🔴 Hết hạn
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                🔒 Tạm khóa
                                            </span>
                                        )}
                                    </td>

                                    {/* Thao tác */}
                                    <td className="py-2.5 px-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {/* Nút Mở modal tin nhắn chia sẻ Zalo */}
                                            <button
                                                type="button"
                                                onClick={() => onOpenShareMessage(user)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition cursor-pointer"
                                                title="Mẫu tin nhắn quảng cáo gửi khách"
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                                <span>Gửi Khách</span>
                                            </button>

                                            {/* Nút Sao chép nhanh */}
                                            <button
                                                type="button"
                                                onClick={() => handleCopyLoginShort(user)}
                                                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition border border-slate-200 cursor-pointer"
                                                title="Sao chép nhanh User/Pass"
                                            >
                                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>

                                            {/* Khóa / Mở khóa */}
                                            <button
                                                type="button"
                                                onClick={() => onToggleLock(user)}
                                                className={`p-1.5 rounded-xl transition border cursor-pointer ${
                                                    user.status === 'ACTIVE'
                                                        ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 border-slate-200'
                                                        : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                                                }`}
                                                title={user.status === 'ACTIVE' ? 'Tạm khóa tài khoản' : 'Mở khóa tài khoản'}
                                            >
                                                {user.status === 'ACTIVE' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                            </button>

                                            {/* Xóa */}
                                            <button
                                                type="button"
                                                onClick={() => onDelete(user)}
                                                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition cursor-pointer"
                                                title="Xóa tài khoản này"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
