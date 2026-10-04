import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';
import { fetchApprovalRequests, ROLE_LABELS } from '../../core/lib/authService';
import {
    Clock,
    CheckCircle2,
    XCircle,
    RotateCcw,
    LogOut,
    Store,
    ArrowRight
} from 'lucide-react';

export default function PendingApprovalPage() {
    const navigate = useNavigate();
    const { currentUser, isAuthenticated, isInitializing, refreshProfile, logout } = useAuth();
    const [isChecking, setIsChecking] = useState(false);
    const [requestDetails, setRequestDetails] = useState<any>(null);

    if (isInitializing) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-600 font-bold text-xs gap-3">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Đang tải thông tin xét duyệt...</span>
            </div>
        );
    }

    if (!isAuthenticated || !currentUser?.email || !currentUser?.id) {
        return <Navigate to="/dang-nhap" replace />;
    }

    if (currentUser.status === 'ACTIVE') {
        return <Navigate to="/bc-thang/tong-quan" replace />;
    }

    if (currentUser.status === 'PENDING_ONBOARDING') {
        return <Navigate to="/onboarding" replace />;
    }

    // Tự động kiểm tra trạng thái
    const handleCheckStatus = async () => {
        setIsChecking(true);
        await refreshProfile();

        // Kiểm tra request
        const requests = await fetchApprovalRequests();
        const myReq = requests.find(r => r.user_id === currentUser.id || r.email === currentUser.email);
        if (myReq) {
            setRequestDetails(myReq);
        }
        setIsChecking(false);
    };

    useEffect(() => {
        handleCheckStatus();
        const interval = setInterval(handleCheckStatus, 10000); // 10 giây tự kiểm tra 1 lần
        return () => clearInterval(interval);
    }, [currentUser.id, currentUser.email]);

    // Nếu đã được duyệt (ACTIVE) -> Chuyển về Dashboard
    useEffect(() => {
        if (currentUser.status === 'ACTIVE') {
            const timer = setTimeout(() => {
                navigate('/bc-thang/tong-quan');
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [currentUser.status, navigate]);

    const isApproved = (currentUser.status as string) === 'ACTIVE';
    const isRejected = currentUser.status === 'REJECTED';
    const approverText = (currentUser.role === 'NHAN_VIEN' && !requestDetails?.is_new_store)
        ? `Quản lý Siêu thị (${currentUser.store_name || 'Đã đăng ký'})`
        : 'Quản trị viên Hệ Thống (Admin)';

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute top-1/4 -right-20 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-lg relative z-10 space-y-6">
                {/* Brand */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-lg">
                        <Store className="w-6 h-6" />
                    </div>
                    <h1 className="text-xl font-black text-white tracking-tight">SALESHUB</h1>
                </div>

                {/* Main Status Box */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 text-center space-y-6 animate-in zoom-in-95 duration-200">
                    {/* ICON TRẠNG THÁI */}
                    {isApproved ? (
                        <div className="w-16 h-16 rounded-3xl bg-emerald-50 border-2 border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto shadow-inner animate-bounce">
                            <CheckCircle2 className="w-9 h-9" />
                        </div>
                    ) : isRejected ? (
                        <div className="w-16 h-16 rounded-3xl bg-rose-50 border-2 border-rose-300 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                            <XCircle className="w-9 h-9" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-3xl bg-amber-50 border-2 border-amber-300 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                            <Clock className="w-9 h-9 animate-pulse" />
                        </div>
                    )}

                    {/* TIÊU ĐỀ */}
                    <div className="space-y-1.5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-block ${
                            isApproved
                                ? 'bg-emerald-100 text-emerald-800'
                                : isRejected
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                        }`}>
                            {isApproved ? 'Đã Phê Duyệt Thành Công' : isRejected ? 'Yêu Cầu Bị Từ Chối' : 'Hồ Sơ Đang Chờ Xét Duyệt'}
                        </span>

                        <h2 className="text-xl font-black text-slate-800">
                            {isApproved
                                ? `Xin chúc mừng, ${currentUser.full_name}!`
                                : isRejected
                                ? 'Hồ sơ chưa được chấp thuận'
                                : 'Yêu cầu đang được xử lý'}
                        </h2>

                        <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                            {isApproved
                                ? 'Tài khoản của bạn đã được phê duyệt. Đang chuyển hướng vào hệ thống làm việc...'
                                : isRejected
                                ? (currentUser.rejection_reason || 'Rất tiếc yêu cầu phân quyền của bạn không phù hợp hoặc bị từ chối.')
                                : `Thông báo xét duyệt đã được chuyển đến [${approverText}]. Vui lòng chờ phản hồi.`}
                        </p>
                    </div>

                    {/* CHI TIẾT THÔNG TIN ĐĂNG KÝ */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-2.5 text-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200 font-bold text-slate-700">
                            <span>Thông tin đăng ký</span>
                            <span className="text-slate-400 font-normal">{currentUser.email}</span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Họ &amp; Tên:</span>
                            <span className="font-bold text-slate-800">{currentUser.full_name}</span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Vai trò đăng ký:</span>
                            <span className="font-bold text-blue-700">
                                {ROLE_LABELS[currentUser.role] || currentUser.role_title}
                            </span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Siêu thị làm việc:</span>
                            <span className="font-bold text-slate-800 text-right max-w-[200px] truncate">
                                {currentUser.store_name || 'Chưa thiết lập'}
                            </span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Cấp xét duyệt:</span>
                            <span className="font-bold text-amber-700">{approverText}</span>
                        </div>
                    </div>

                    {/* BUTTONS */}
                    <div className="space-y-2 pt-2">
                        {isApproved ? (
                            <button
                                type="button"
                                onClick={() => navigate('/bc-thang/tong-quan')}
                                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>Vào Hệ Thống Ngay</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : isRejected ? (
                            <button
                                type="button"
                                onClick={() => navigate('/onboarding')}
                                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <RotateCcw className="w-4 h-4" />
                                <span>Gửi Lại Yêu Cầu Khác</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleCheckStatus}
                                disabled={isChecking}
                                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-blue-500/20"
                            >
                                <RotateCcw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                                <span>{isChecking ? 'Đang kiểm tra...' : 'Kiểm Tra Trạng Thái Duyệt'}</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={logout}
                            className="w-full py-2.5 px-4 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Đăng Xuất / Đổi Tài Khoản Khác</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
