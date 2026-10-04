import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Home, KeyRound, Lock, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface UnauthorizedAccessProps {
    title?: string;
    badgeText?: string;
    pageName?: string;
    path?: string;
    message?: string;
    allowedRoleLabels?: string;
    countdownSeconds?: number;
    homePath?: string;
    showAdminUnlock?: boolean;
    onOpenRoleModal?: () => void;
}

export default function UnauthorizedAccessView({
    title = 'Không Đủ Quyền Truy Cập',
    badgeText = 'Truy Cập Bị Giới Hạn (403)',
    pageName,
    path,
    message,
    allowedRoleLabels,
    countdownSeconds = 5,
    homePath = '/bc-thang/tong-quan',
    showAdminUnlock = false,
    onOpenRoleModal,
}: UnauthorizedAccessProps) {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [countdown, setCountdown] = useState<number>(countdownSeconds);
    const [isPaused, setIsPaused] = useState<boolean>(false);

    useEffect(() => {
        if (isPaused) return;

        if (countdown <= 0) {
            navigate(homePath, { replace: true });
            return;
        }

        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    navigate(homePath, { replace: true });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [countdown, isPaused, navigate, homePath]);

    const handleGoHome = () => {
        navigate(homePath, { replace: true });
    };

    const handleUnlockClick = () => {
        setIsPaused(true);
        if (onOpenRoleModal) {
            onOpenRoleModal();
        }
    };

    const progressPercent = Math.max(0, Math.min(100, (countdown / countdownSeconds) * 100));

    return (
        <div className="flex-1 min-h-[75vh] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl p-7 sm:p-8 border border-rose-200/80 shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200 relative overflow-hidden">
                {/* Background decorative tint */}
                <div className="absolute -top-16 -right-16 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Shield Alert Icon with countdown badge */}
                <div className="relative w-20 h-20 mx-auto">
                    <div className="absolute inset-0 rounded-2xl bg-rose-500/15 animate-ping opacity-25" />
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/25">
                        <ShieldAlert className="w-10 h-10" />
                    </div>
                    <div
                        className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 border-2 border-white flex items-center gap-1 text-[11px] font-black shadow-sm"
                        title={`Tự động chuyển về trang chủ sau ${countdown} giây`}
                    >
                        <Clock className="w-3 h-3 text-amber-400 animate-spin" />
                        <span>{countdown}s</span>
                    </div>
                </div>

                {/* Text Details */}
                <div className="space-y-2">
                    <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider inline-block">
                        {badgeText}
                    </span>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">
                        {title}
                    </h2>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        {message || (
                            <>
                                Vai trò hiện tại của bạn là <b className="text-slate-800">{currentUser?.role_title || 'Chưa xác định'}</b> chưa được phân quyền truy cập phân hệ{' '}
                                {pageName ? <b className="text-rose-600">[{pageName}]</b> : 'này'}.
                            </>
                        )}
                    </p>

                    {path && (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-lg text-[11px] font-mono text-slate-600 border border-slate-200">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>{path}</span>
                        </div>
                    )}

                    {allowedRoleLabels && (
                        <p className="text-[11px] text-indigo-700 font-semibold bg-indigo-50/80 py-1.5 px-3 rounded-xl border border-indigo-100 text-left sm:text-center">
                            🔒 Vai trò được cấp phép: <b>{allowedRoleLabels}</b>
                        </p>
                    )}
                </div>

                {/* Progress bar countdown */}
                <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                        <span>Tự động chuyển về trang chủ:</span>
                        <span className="font-extrabold text-rose-600 font-mono">{countdown} giây</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 h-full transition-all duration-1000 ease-linear rounded-full"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={handleGoHome}
                        className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                    >
                        <Home className="w-4 h-4" />
                        <span>Về Trang Chủ Ngay ({countdown}s)</span>
                    </button>

                    {showAdminUnlock && (
                        <button
                            type="button"
                            onClick={handleUnlockClick}
                            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <KeyRound className="w-4 h-4 text-amber-600" />
                            <span>Mở Khóa / Cấu Hình Quyền (Admin)</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
