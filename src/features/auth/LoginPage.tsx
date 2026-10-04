import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';
import { sendPasswordResetEmail } from '../../core/lib/authService';
import { Store, LogIn, Lock, Mail, ChevronRight, AlertCircle, Send, CheckCircle2, KeyRound } from 'lucide-react';

export default function LoginPage() {
    const navigate = useNavigate();
    const { login, isLoading, isAuthenticated, currentUser } = useAuth();

    // Tự động điều hướng nếu đã có phiên đăng nhập hợp lệ
    useEffect(() => {
        if (isAuthenticated && currentUser.email && currentUser.id) {
            if (currentUser.status === 'PENDING_ONBOARDING') {
                navigate('/onboarding', { replace: true });
            } else if (currentUser.status === 'PENDING_APPROVAL' || currentUser.status === 'REJECTED') {
                navigate('/cho-xet-duyet', { replace: true });
            } else {
                navigate('/bc-thang/tong-quan', { replace: true });
            }
        }
    }, [isAuthenticated, currentUser, navigate]);

    const [accountKey, setAccountKey] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Quên mật khẩu modal state
    const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [isSendingReset, setIsSendingReset] = useState(false);
    const [forgotSuccess, setForgotSuccess] = useState(false);
    const [forgotError, setForgotError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!accountKey.trim()) {
            setErrorMsg('Vui lòng nhập Email hoặc Mã nhân viên!');
            return;
        }

        setIsSubmitting(true);
        const res = await login(accountKey, password);
        setIsSubmitting(false);

        if (res.success) {
            navigate('/bc-thang/tong-quan');
        } else {
            setErrorMsg(res.error || 'Đăng nhập không thành công');
        }
    };

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotError('');
        if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
            setForgotError('Vui lòng nhập địa chỉ Email hợp lệ!');
            return;
        }

        setIsSendingReset(true);
        const res = await sendPasswordResetEmail(forgotEmail);
        setIsSendingReset(false);

        if (res.success) {
            setForgotSuccess(true);
        } else {
            setForgotError(res.error || 'Có lỗi khi gửi email khôi phục. Vui lòng thử lại.');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Glow Circles */}
            <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-200">
                {/* Brand Header */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xl shadow-blue-500/25 ring-4 ring-white/10">
                        <Store className="w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">
                        SALES<span className="text-blue-400">HUB</span>
                    </h1>
                    <p className="text-xs text-slate-400 font-medium">
                        Hệ thống điều hành &amp; Quản trị mục tiêu kinh doanh siêu thị
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/20 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                            <LogIn className="w-4 h-4 text-blue-600" />
                            <span>Đăng nhập hệ thống</span>
                        </h2>
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                            Bảo mật 2 lớp
                        </span>
                    </div>

                    {errorMsg && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-in shake duration-200">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                            <div className="flex-1 font-semibold">{errorMsg}</div>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Email hoặc Mã nhân viên:
                            </label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                                <input
                                    type="text"
                                    value={accountKey}
                                    onChange={(e) => setAccountKey(e.target.value)}
                                    placeholder="ví dụ: admin@saleshub.vn hoặc QL9999"
                                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-bold text-slate-700">
                                    Mật khẩu:
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setForgotEmail(accountKey.includes('@') ? accountKey : '');
                                        setIsForgotModalOpen(true);
                                        setForgotSuccess(false);
                                        setForgotError('');
                                    }}
                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline transition cursor-pointer"
                                >
                                    Quên mật khẩu?
                                </button>
                            </div>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Nhập mật khẩu của bạn..."
                                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || isLoading}
                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <span>Đang xác thực...</span>
                            ) : (
                                <>
                                    <span>Đăng Nhập Ngay</span>
                                    <ChevronRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="text-center pt-2 border-t border-slate-100">
                        <span className="text-xs text-slate-500">Chưa có tài khoản trên hệ thống? </span>
                        <Link
                            to="/dang-ky"
                            className="text-xs font-black text-blue-600 hover:text-blue-700 hover:underline transition"
                        >
                            Đăng ký tài khoản mới &rarr;
                        </Link>
                    </div>
                </div>
            </div>

            {/* Forgot Password Modal */}
            {isForgotModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <KeyRound className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800">Khôi phục mật khẩu</h3>
                                    <p className="text-[11px] text-slate-400">Gửi liên kết đặt lại mật khẩu qua email</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsForgotModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition cursor-pointer text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {forgotSuccess ? (
                            <div className="space-y-4 py-2 text-center">
                                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border-4 border-emerald-100 animate-in zoom-in duration-300">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-black text-slate-800">Email đã được gửi thành công!</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Hệ thống đã gửi liên kết an toàn tới hộp thư <strong className="text-slate-800">{forgotEmail}</strong>. 
                                        Vui lòng kiểm tra hộp thư đến (hoặc hòm thư Rác/Spam) và nhấp vào liên kết để tạo mật khẩu mới.
                                    </p>
                                </div>
                                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-left text-[11px] text-blue-700">
                                    💡 <strong>Lưu ý:</strong> Liên kết có hiệu lực trong vòng 60 phút. Nếu bạn không nhận được email sau 2-3 phút, vui lòng kiểm tra lại địa chỉ email hoặc liên hệ Admin hệ thống.
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsForgotModalOpen(false)}
                                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                                >
                                    Đóng cửa sổ
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleForgotSubmit} className="space-y-4">
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    Nhập địa chỉ email đăng ký tài khoản của bạn. Hệ thống sẽ tự động gửi email chứa liên kết bảo mật để bạn thiết lập mật khẩu mới ngay lập tức.
                                </p>

                                {forgotError && (
                                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                                        <span>{forgotError}</span>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Email của bạn:
                                    </label>
                                    <div className="relative">
                                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                                        <input
                                            type="email"
                                            value={forgotEmail}
                                            onChange={(e) => setForgotEmail(e.target.value)}
                                            placeholder="ví dụ: user@saleshub.vn"
                                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                            autoFocus
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2.5 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsForgotModalOpen(false)}
                                        className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSendingReset}
                                        className="py-2.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {isSendingReset ? (
                                            <span>Đang gửi email...</span>
                                        ) : (
                                            <>
                                                <Send className="w-3.5 h-3.5" />
                                                <span>Gửi Email Khôi Phục</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
