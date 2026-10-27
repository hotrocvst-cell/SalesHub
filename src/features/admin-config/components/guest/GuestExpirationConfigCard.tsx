import { useState, useEffect } from 'react';
import { Calendar, Shield, Save, CheckCircle2, AlertCircle, Sparkles, Sliders } from 'lucide-react';
import type { AccountExpirationConfig } from '../../services/guestTrialService';

interface Props {
    config: AccountExpirationConfig;
    onSave: (newConfig: Partial<AccountExpirationConfig>) => Promise<boolean>;
    isSaving: boolean;
}

export default function GuestExpirationConfigCard({ config, onSave, isSaving }: Props) {
    const [formData, setFormData] = useState({
        default_guest_valid_days: config.default_guest_valid_days,
        apply_to_all_accounts: config.apply_to_all_accounts,
        all_accounts_valid_days: config.all_accounts_valid_days
    });
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        setFormData({
            default_guest_valid_days: config.default_guest_valid_days,
            apply_to_all_accounts: config.apply_to_all_accounts,
            all_accounts_valid_days: config.all_accounts_valid_days
        });
    }, [config]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg(null);
        const ok = await onSave(formData);
        if (ok) {
            setMsg({ type: 'success', text: 'Đã lưu cấu hình giới hạn thời gian hoạt động thành công lên Cloud!' });
            setTimeout(() => setMsg(null), 3000);
        } else {
            setMsg({ type: 'error', text: 'Có lỗi xảy ra khi lưu cấu hình. Vui lòng kiểm tra lại!' });
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            {/* Card Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-100/70 text-blue-700">
                        <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                            Cài Đặt Giới Hạn Thời Gian Hoạt Động (Theo Ngày)
                        </h3>
                        <p className="text-[11px] text-slate-500">
                            Cấu hình số ngày dùng thử cho tài khoản trải nghiệm &amp; lộ trình mở rộng toàn hệ thống
                        </p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {msg && (
                    <div
                        className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium ${
                            msg.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                    >
                        {msg.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{msg.text}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Mục 1: Thời gian dùng thử mặc định cho Guest */}
                    <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                            <span>Số ngày dùng thử mặc định (Guest):</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={formData.default_guest_valid_days}
                                onChange={e => setFormData({ ...formData, default_guest_valid_days: Math.max(1, parseInt(e.target.value) || 7) })}
                                className="w-24 px-3 py-1.5 rounded-xl border border-slate-300 focus:border-blue-500 text-sm font-black text-center focus:outline-hidden bg-white"
                            />
                            <span className="text-xs font-bold text-slate-600">ngày</span>
                            {/* Preset buttons */}
                            <div className="flex items-center gap-1 ml-auto">
                                {[3, 7, 14, 30].map(days => (
                                    <button
                                        key={days}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, default_guest_valid_days: days })}
                                        className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                                            formData.default_guest_valid_days === days
                                                ? 'bg-blue-600 text-white shadow-2xs'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        {days} ngày
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p className="text-[10.5px] text-slate-500 leading-tight">
                            Khi Admin tạo tài khoản trải nghiệm mới, hệ thống tự động cộng số ngày này vào ngày hết hạn.
                        </p>
                    </div>

                    {/* Mục 2: Cấu hình mở rộng áp dụng toàn bộ tài khoản */}
                    <div className="p-3 rounded-xl bg-indigo-50/40 border border-indigo-200/60 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Áp dụng giới hạn cho toàn bộ tài khoản:</span>
                            </label>
                            {/* Switch toggle */}
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.apply_to_all_accounts}
                                    onChange={e => setFormData({ ...formData, apply_to_all_accounts: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                            </label>
                        </div>

                        <div className={`transition-opacity ${formData.apply_to_all_accounts ? 'opacity-100' : 'opacity-60 pointer-events-none'}`}>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-slate-600">Thời hạn tài khoản toàn hệ thống:</span>
                                <input
                                    type="number"
                                    min={30}
                                    max={3650}
                                    disabled={!formData.apply_to_all_accounts}
                                    value={formData.all_accounts_valid_days}
                                    onChange={e => setFormData({ ...formData, all_accounts_valid_days: Math.max(30, parseInt(e.target.value) || 365) })}
                                    className="w-20 px-2 py-1 rounded-xl border border-slate-300 text-xs font-bold text-center bg-white"
                                />
                                <span className="text-xs text-slate-500 font-bold">ngày (1 năm)</span>
                            </div>
                        </div>

                        <p className="text-[10.5px] text-indigo-800/80 leading-tight">
                            {formData.apply_to_all_accounts
                                ? '⚡ Đang kích hoạt: Tất cả tài khoản trong hệ thống sẽ được kiểm soát thời hạn hoạt động theo ngày.'
                                : 'Chế độ chờ: Hiện tại chỉ áp dụng giới hạn ngày cho tài khoản Guest. Bật toggle khi Boss muốn áp dụng toàn bộ.'}
                        </p>
                    </div>
                </div>

                {/* Footer Save Button */}
                <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400 font-medium italic">
                        * Dữ liệu cấu hình tự động đồng bộ thời gian thực qua Cloud Supabase
                    </span>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình Cloud'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
