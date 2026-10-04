import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { updatePasswordWithSession } from '../../core/lib/authService';
import { supabase } from '../../core/lib/supabase';
import { Store, KeyRound, Lock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function ResetPasswordCallbackPage() {
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [userEmail, setUserEmail] = useState<string>('');

    useEffect(() => {
        // 1. Lắng nghe sự kiện auth (ví dụ PASSWORD_RECOVERY từ link email)
        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user?.email) {
                setUserEmail(session.user.email);
            }
        });

        // 2. Kiểm tra xem URL có chứa mã xác thực code (PKCE) hay không
        async function checkRecoverySession() {
            try {
                const searchParams = new URLSearchParams(window.location.search);
                const code = searchParams.get('code');
                if (code) {
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                    if (!error && data.session?.user?.email) {
                        setUserEmail(data.session.user.email);
                        return;
                    }
                }

                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user?.email) {
                    setUserEmail(session.user.email);
                }
            } catch (err) {
                console.warn('Lỗi kiểm tra recovery session:', err);
            }
        }
        checkRecoverySession();

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!newPassword || newPassword.length < 6) {
            setErrorMsg('Mật khẩu mới phải có tối thiểu 6 ký tự!');
            return;
        }

        if (newPassword !== confirmPassword) {
            setErrorMsg('Xác nhận mật khẩu không khớp!');
            return;
        }

        setIsSubmitting(true);
        const res = await updatePasswordWithSession(newPassword);
        setIsSubmitting(false);

        if (res.success) {
            setIsSuccess(true);
            setTimeout(() => {
                navigate('/dang-nhap');
            }, 3000);
        } else {
            setErrorMsg(res.error || 'Có lỗi khi cập nhật mật khẩu mới. Liên kết có thể đã hết hạn.');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/4 -right-20 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-200">
                {/* Brand */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xl shadow-blue-500/25 ring-4 ring-white/10">
                        <Store className="w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">
                        SALES<span className="text-blue-400">HUB</span>
                    </h1>
                    <p className="text-xs text-slate-400 font-medium">
                        Khôi phục quyền truy cập tài khoản hệ thống
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/20 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                            <KeyRound className="w-4 h-4 text-blue-600" />
                            <span>Tạo Mật Khẩu Mới</span>
                        </h2>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            Xác thực Email
                        </span>
                    </div>

                    {userEmail && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600">
                            Đang đặt lại mật khẩu cho tài khoản: <b className="text-slate-900">{userEmail}</b>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-in shake duration-200">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                            <div className="flex-1 font-semibold">{errorMsg}</div>
                        </div>
                    )}

                    {!isSuccess ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Mật khẩu mới: <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                                    <input
                                        type="password"
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Tối thiểu 6 ký tự..."
                                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Xác nhận mật khẩu mới: <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                                    <input
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Nhập lại mật khẩu..."
                                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <span>Đang cập nhật...</span>
                                ) : (
                                    <>
                                        <span>Lưu Mật Khẩu Mới</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <div className="py-4 text-center space-y-3 animate-in zoom-in-95 duration-150">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-extrabold text-base text-slate-800">
                                    Cập Nhật Thành Công!
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Mật khẩu của bạn đã được thay đổi. Đang tự động chuyển hướng về trang Đăng nhập...
                                </p>
                            </div>
                            <Link
                                to="/dang-nhap"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 pt-2"
                            >
                                <span>Vào Đăng Nhập Ngay</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
