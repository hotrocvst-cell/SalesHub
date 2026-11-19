import React from 'react';
import { AlertTriangle, LogIn, KeyRound, Smartphone, Monitor } from 'lucide-react';
import type { SessionDeviceInfo } from '../../../core/lib/deviceSessionService';

interface SessionKickOutModalProps {
    isOpen: boolean;
    conflictingSession?: SessionDeviceInfo;
    reason?: string;
    accountName?: string;
    onReLogin: () => void;
    onChangePassword?: () => void;
}

export const SessionKickOutModal: React.FC<SessionKickOutModalProps> = ({
    isOpen,
    conflictingSession,
    reason,
    accountName,
    onReLogin,
    onChangePassword
}) => {
    if (!isOpen) return null;

    const formatTimestamp = (iso?: string) => {
        if (!iso) return 'Vừa xong';
        try {
            const d = new Date(iso);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} - ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        } catch {
            return 'Vừa xong';
        }
    };

    const isMobileConflict = conflictingSession?.device_class === 'MOBILE';

    return (
        <div 
            className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="kickout-title"
            aria-describedby="kickout-desc"
        >
            <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-md w-full overflow-hidden text-slate-800">
                {/* Header dải màu cảnh báo */}
                <div className="bg-gradient-to-r from-rose-600 to-amber-600 px-5 py-4 text-white flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm shrink-0">
                        <AlertTriangle className="w-6 h-6 text-white" aria-hidden="true" />
                    </div>
                    <div>
                        <h3 id="kickout-title" className="font-bold text-base sm:text-lg leading-tight">
                            Phiên làm việc đã kết thúc
                        </h3>
                        <p className="text-xs text-white/90 font-medium">
                            Phát hiện đăng nhập trên thiết bị khác
                        </p>
                    </div>
                </div>

                {/* Nội dung thông báo */}
                <div className="p-5 space-y-4 text-sm">
                    <p id="kickout-desc" className="text-slate-600 leading-relaxed">
                        Tài khoản <span className="font-bold text-slate-900">{accountName || 'của bạn'}</span> vừa được đăng nhập trên một thiết bị cùng loại khác. Để bảo mật dữ liệu, phiên làm việc trên trình duyệt này đã được thu hồi tự động.
                    </p>

                    {/* Khối thông tin thiết bị chiếm quyền */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            {isMobileConflict ? (
                                <Smartphone className="w-4 h-4 text-blue-600" aria-hidden="true" />
                            ) : (
                                <Monitor className="w-4 h-4 text-purple-600" aria-hidden="true" />
                            )}
                            Thiết bị mới vừa đăng nhập:
                        </div>
                        <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                            <span>{conflictingSession?.device_name || 'Thiết bị khác'}</span>
                            <span className="text-xs font-normal text-slate-500">
                                {formatTimestamp(conflictingSession?.logged_in_at)}
                            </span>
                        </div>
                        {conflictingSession?.os && (
                            <div className="text-xs text-slate-500">
                                Hệ điều hành: <span className="font-medium text-slate-700">{conflictingSession.os}</span> • Trình duyệt: <span className="font-medium text-slate-700">{conflictingSession.browser || 'Web'}</span>
                            </div>
                        )}
                    </div>

                    {reason && (
                        <div className="text-xs bg-amber-50 text-amber-800 p-2.5 rounded-lg border border-amber-200">
                            ℹ️ {reason}
                        </div>
                    )}

                    <div className="text-xs text-slate-500 bg-blue-50/70 border border-blue-100 p-2.5 rounded-lg leading-normal">
                        💡 <strong>Chính sách thiết bị SalesHub:</strong><br/>
                        • Quản lý / Trưởng ca / Admin: Được phép dùng song song <strong>1 Điện thoại</strong> + <strong>1 Máy tính bàn</strong>.<br/>
                        • Không được phép dùng cùng lúc 2 điện thoại hoặc 2 máy tính bàn.
                    </div>
                </div>

                {/* Nút hành động */}
                <div className="px-5 pb-5 pt-1 flex flex-col sm:flex-row gap-2.5">
                    <button
                        type="button"
                        onClick={onReLogin}
                        className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition shadow-md shadow-blue-500/20"
                    >
                        <LogIn className="w-4 h-4" aria-hidden="true" />
                        Đăng nhập lại tại đây
                    </button>
                    {onChangePassword && (
                        <button
                            type="button"
                            onClick={onChangePassword}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-xs text-slate-700 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 active:scale-[0.98] transition border border-slate-200"
                        >
                            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                            Đổi mật khẩu
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
