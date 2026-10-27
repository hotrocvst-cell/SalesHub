import { useState } from 'react';
import { X, Sparkles, UserPlus, KeyRound, Calendar, Store, AlertCircle } from 'lucide-react';
import type { StoreItem } from '../../../../core/lib/storage';
import { GUEST_DEFAULT_STORE } from '../../services/guestTrialService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        email: string;
        full_name: string;
        password?: string;
        valid_days: number;
        store_name?: string;
    }) => Promise<{ success: boolean; error?: string }>;
    defaultValidDays: number;
    stores: StoreItem[];
}

export default function GuestCreateModal({
    isOpen,
    onClose,
    onSubmit,
    defaultValidDays,
    stores
}: Props) {
    const safeStores = Array.isArray(stores) ? stores : [];
    const defaultStore = safeStores.find(s => s && (s.code === '10335' || (s.name && s.name.includes('10335'))))?.name || GUEST_DEFAULT_STORE;
    const [form, setForm] = useState({
        email: `guest${Math.floor(100 + Math.random() * 900)}@saleshub.vn`,
        full_name: 'Khách Trải Nghiệm',
        password: `SH@${Math.floor(1000 + Math.random() * 9000)}`,
        valid_days: defaultValidDays || 7,
        store_name: defaultStore
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!form.email.trim() || !form.email.includes('@')) {
            setError('Vui lòng nhập Email hoặc tên tài khoản hợp lệ!');
            return;
        }

        setIsSubmitting(true);
        const res = await onSubmit(form);
        setIsSubmitting(false);

        if (res.success) {
            onClose();
        } else {
            setError(res.error || 'Có lỗi khi tạo tài khoản');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                            <UserPlus className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <h3 className="text-base font-black">TẠO TÀI KHOẢN TRẢI NGHIỆM</h3>
                            <p className="text-[11px] text-blue-100">Dành cho khách hàng trải nghiệm tính năng</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
                    {error && (
                        <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Email */}
                    <div className="space-y-1">
                        <label className="font-bold text-slate-700 flex items-center justify-between">
                            <span>Email / Tên đăng nhập:</span>
                            <span className="text-[10.5px] text-blue-600 font-semibold">* Duy nhất</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            placeholder="guest1@saleshub.vn"
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 font-medium focus:outline-hidden"
                        />
                    </div>

                    {/* Họ tên */}
                    <div className="space-y-1">
                        <label className="font-bold text-slate-700">Họ tên đại diện khách hàng:</label>
                        <input
                            type="text"
                            required
                            value={form.full_name}
                            onChange={e => setForm({ ...form, full_name: e.target.value })}
                            placeholder="Khách Trải Nghiệm"
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 font-medium focus:outline-hidden"
                        />
                    </div>

                    {/* Mật khẩu */}
                    <div className="space-y-1">
                        <label className="font-bold text-slate-700 flex items-center justify-between">
                            <span>Mật khẩu ban đầu:</span>
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, password: `SH@${Math.floor(1000 + Math.random() * 9000)}` })}
                                className="text-[10.5px] text-blue-600 hover:underline font-bold"
                            >
                                Sinh ngẫu nhiên
                            </button>
                        </label>
                        <div className="relative">
                            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                required
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 font-mono font-bold focus:outline-hidden"
                            />
                        </div>
                    </div>

                    {/* Hạn dùng (ngày) */}
                    <div className="space-y-1">
                        <label className="font-bold text-slate-700 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                            <span>Thời hạn trải nghiệm (Theo ngày):</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={form.valid_days}
                                onChange={e => setForm({ ...form, valid_days: Math.max(1, parseInt(e.target.value) || 7) })}
                                className="w-24 px-3 py-2 rounded-xl border border-slate-300 font-bold text-center focus:outline-hidden"
                            />
                            <span className="font-bold text-slate-600">ngày</span>
                            <div className="flex items-center gap-1 ml-auto">
                                {[3, 7, 14, 30].map(d => (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => setForm({ ...form, valid_days: d })}
                                        className={`px-2 py-1 rounded-lg text-[10.5px] font-bold ${
                                            form.valid_days === d
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {d}d
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Siêu thị gán */}
                    <div className="space-y-1">
                        <label className="font-bold text-slate-700 flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-blue-600" />
                            <span>Siêu thị dữ liệu trải nghiệm:</span>
                        </label>
                        <select
                            value={form.store_name}
                            onChange={e => setForm({ ...form, store_name: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 font-medium focus:outline-hidden bg-white"
                        >
                            {safeStores.length > 0 ? (
                                safeStores.map(s => (
                                    <option key={s.id || s.code} value={s.name}>
                                        {s.name}
                                    </option>
                                ))
                            ) : (
                                <option value={GUEST_DEFAULT_STORE}>{GUEST_DEFAULT_STORE}</option>
                            )}
                        </select>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>{isSubmitting ? 'Đang tạo...' : 'Tạo Tài Khoản'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
