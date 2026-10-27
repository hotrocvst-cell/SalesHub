import { useState } from 'react';
import { X, KeyRound, Check, Copy, AlertCircle } from 'lucide-react';
import type { UserProfile } from '../../../../core/lib/authService';

interface Props {
    user: UserProfile | null;
    onClose: () => void;
    onSubmit: (userId: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
}

export default function GuestPasswordModal({ user, onClose, onSubmit }: Props) {
    const [password, setPassword] = useState(`SH@${Math.floor(1000 + Math.random() * 9000)}`);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successData, setSuccessData] = useState<{ user: UserProfile; pass: string } | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    if (!user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!password.trim()) {
            setError('Vui lòng nhập mật khẩu mới!');
            return;
        }

        setIsSubmitting(true);
        const res = await onSubmit(user.id, password.trim());
        setIsSubmitting(false);

        if (res.success) {
            setSuccessData({ user, pass: password.trim() });
        } else {
            setError(res.error || 'Có lỗi khi đặt lại mật khẩu');
        }
    };

    const handleCopy = () => {
        if (!successData) return;
        const text = `Tài khoản: ${successData.user.email} | Mật khẩu mới: ${successData.pass} | Link: ${window.location.origin}/dang-nhap`;
        navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <KeyRound className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black">ĐỔI MẬT KHẨU TÀI KHOẢN</h3>
                            <p className="text-[11px] text-slate-400">{user.email}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 text-xs">
                    {successData ? (
                        <div className="space-y-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-4 ring-emerald-50">
                                <Check className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-800">Đặt lại mật khẩu thành công!</h4>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Mật khẩu mới đã được cập nhật trực tiếp trên cơ sở dữ liệu.
                                </p>
                            </div>

                            <div className="p-3 rounded-2xl bg-slate-100 font-mono text-center space-y-1">
                                <div className="text-[11px] text-slate-500">Mật khẩu mới:</div>
                                <div className="text-base font-black text-blue-700 tracking-wider select-all">
                                    {successData.pass}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleCopy}
                                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer"
                            >
                                {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                <span>{isCopied ? 'Đã sao chép!' : 'Sao chép thông tin gửi khách'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full py-2 text-slate-500 hover:text-slate-800 font-semibold transition"
                            >
                                Đóng
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-3.5">
                            {error && (
                                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="font-bold text-slate-700 flex items-center justify-between">
                                    <span>Mật khẩu mới:</span>
                                    <button
                                        type="button"
                                        onClick={() => setPassword(`SH@${Math.floor(1000 + Math.random() * 9000)}`)}
                                        className="text-[10.5px] text-blue-600 hover:underline font-bold"
                                    >
                                        Sinh ngẫu nhiên
                                    </button>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-sm focus:border-blue-500 focus:outline-hidden"
                                />
                            </div>

                            <p className="text-[11px] text-slate-500">
                                Mật khẩu mới có hiệu lực ngay lập tức, khách hàng có thể dùng để đăng nhập ngay.
                            </p>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                                >
                                    {isSubmitting ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
