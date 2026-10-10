import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';
import {
    fetchApprovalRequests,
    resubmitUserApproval,
    ROLE_LABELS,
    type UserRole
} from '../../core/lib/authService';
import { fetchStores, type StoreItem } from '../../core/lib/storage';
import { formatCapitalizeWords } from '../../core/lib/formatters';
import SearchableStoreSelect from '../../shared/components/common/SearchableStoreSelect';
import {
    Clock,
    CheckCircle2,
    XCircle,
    RotateCcw,
    LogOut,
    Store,
    ArrowRight,
    Edit3,
    AlertCircle,
    Send
} from 'lucide-react';

export default function PendingApprovalPage() {
    const navigate = useNavigate();
    const { currentUser, isAuthenticated, isInitializing, refreshProfile, logout } = useAuth();
    const [isChecking, setIsChecking] = useState(false);
    const [requestDetails, setRequestDetails] = useState<any>(null);

    // Chỉnh sửa thông tin hồ sơ
    const [isEditing, setIsEditing] = useState(false);
    const [editFullName, setEditFullName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editEmpId, setEditEmpId] = useState('');
    const [editStoreName, setEditStoreName] = useState('');
    const [editRole, setEditRole] = useState<UserRole>('NHAN_VIEN');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [stores, setStores] = useState<StoreItem[]>([]);

    useEffect(() => {
        if (currentUser) {
            setEditFullName(currentUser.full_name || '');
            setEditPhone(currentUser.phone || '');
            setEditEmpId(currentUser.employee_id || '');
            setEditStoreName(currentUser.store_name || '');
            setEditRole(currentUser.role || 'NHAN_VIEN');
        }
    }, [currentUser]);

    useEffect(() => {
        fetchStores().then(res => {
            if (res.success && res.data) {
                setStores(res.data);
            }
        });
    }, []);

    // Tự động kiểm tra trạng thái
    const handleCheckStatus = async () => {
        setIsChecking(true);
        await refreshProfile();

        // Kiểm tra request
        const requests = await fetchApprovalRequests();
        const myReq = requests.find(r => r.user_id === currentUser?.id || r.email === currentUser?.email);
        if (myReq) {
            setRequestDetails(myReq);
        }
        setIsChecking(false);
    };

    useEffect(() => {
        if (currentUser?.id && currentUser?.email) {
            handleCheckStatus();
            const interval = setInterval(handleCheckStatus, 10000); // 10 giây tự kiểm tra 1 lần
            return () => clearInterval(interval);
        }
    }, [currentUser?.id, currentUser?.email]);

    // Nếu đã được duyệt (ACTIVE) -> Chuyển về Dashboard
    useEffect(() => {
        if (currentUser?.status === 'ACTIVE') {
            const timer = setTimeout(() => {
                navigate('/bc-thang/tong-quan');
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [currentUser?.status, navigate]);

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
        return <Navigate to="/" replace />;
    }

    if (currentUser.status === 'PENDING_ONBOARDING') {
        return <Navigate to="/onboarding" replace />;
    }

    const isApproved = (currentUser.status as string) === 'ACTIVE';
    const isRejected = currentUser.status === 'REJECTED';
    const approverText = (currentUser.role === 'NHAN_VIEN' && !requestDetails?.is_new_store)
        ? `Quản lý Siêu thị (${currentUser.store_name || 'Đã đăng ký'})`
        : 'Quản trị viên Hệ Thống (Admin)';

    const handleSaveAndResubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const formattedName = formatCapitalizeWords(editFullName);
        if (!formattedName) {
            setErrorMsg('Vui lòng nhập Họ và tên!');
            return;
        }
        if (!editStoreName.trim()) {
            setErrorMsg('Vui lòng chọn Đơn vị Siêu thị làm việc!');
            return;
        }

        setErrorMsg('');
        setIsSubmitting(true);
        const res = await resubmitUserApproval({
            userId: currentUser.id,
            full_name: formattedName,
            phone: editPhone.trim(),
            employee_id: editEmpId.trim(),
            store_name: editStoreName.trim(),
            requested_role: editRole
        });
        setIsSubmitting(false);

        if (res.success) {
            setSuccessMsg('Đã cập nhật thông tin và gửi lại yêu cầu xét duyệt thành công!');
            setIsEditing(false);
            await refreshProfile();
        } else {
            setErrorMsg(res.error || 'Có lỗi xảy ra khi cập nhật');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-3 sm:p-4 relative overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute top-1/4 -right-20 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-lg relative z-10 space-y-5">
                {/* Brand */}
                <div className="text-center space-y-1.5">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-lg">
                        <Store className="w-6 h-6" />
                    </div>
                    <h1 className="text-xl font-black text-white tracking-tight">SALESHUB</h1>
                </div>

                {/* Main Status Box */}
                <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200 text-center space-y-5 animate-in zoom-in-95 duration-200">
                    {/* ICON TRẠNG THÁI */}
                    {isApproved ? (
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto shadow-inner animate-bounce">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                    ) : isRejected ? (
                        <div className="w-14 h-14 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                            <XCircle className="w-8 h-8" />
                        </div>
                    ) : (
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                            <Clock className="w-8 h-8 animate-pulse" />
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
                                ? 'Hồ sơ của bạn đã bị từ chối hoặc cần bổ sung thông tin chính xác. Vui lòng xem lý do và chỉnh sửa thông tin bên dưới để gửi duyệt lại.'
                                : `Thông báo xét duyệt đã được chuyển đến [${approverText}]. Vui lòng chờ phản hồi.`}
                        </p>
                    </div>

                    {/* Lý do từ chối nổi bật */}
                    {isRejected && currentUser.rejection_reason && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-left text-xs space-y-1">
                            <div className="font-black text-rose-800 flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>Lý do từ chối:</span>
                            </div>
                            <div className="text-rose-700 font-semibold pl-5 leading-relaxed bg-white/70 p-2 rounded-xl border border-rose-100">
                                {currentUser.rejection_reason}
                            </div>
                        </div>
                    )}

                    {/* Thông báo cập nhật */}
                    {errorMsg && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700 text-left">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {successMsg && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-800 text-left">
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                            <span>{successMsg}</span>
                        </div>
                    )}

                    {/* CHI TIẾT THÔNG TIN ĐĂNG KÝ (Xem) */}
                    {!isEditing && (
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
                                <span className="text-slate-500 font-medium">Mã nhân viên:</span>
                                <span className="font-mono font-bold text-slate-800">
                                    {currentUser.employee_id || '(Chưa có)'}
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Cấp xét duyệt:</span>
                                <span className="font-bold text-amber-700">{approverText}</span>
                            </div>
                        </div>
                    )}

                    {/* FORM CHỈNH SỬA THÔNG TIN */}
                    {isEditing && (
                        <form onSubmit={handleSaveAndResubmit} className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200 text-left space-y-3 text-xs animate-in fade-in duration-150">
                            <div className="flex items-center justify-between pb-2 border-b border-blue-100 font-bold text-blue-900">
                                <span className="flex items-center gap-1.5">
                                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Chỉnh sửa thông tin cá nhân &amp; đơn vị</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="text-[11px] text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
                                >
                                    Đóng
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Họ và tên: <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editFullName}
                                    onChange={(e) => setEditFullName(e.target.value)}
                                    onBlur={() => setEditFullName(formatCapitalizeWords(editFullName))}
                                    placeholder="ví dụ: Nguyễn Văn An"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    * Tự động viết hoa chữ cái đầu mỗi từ
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Đơn vị Siêu thị công tác: <span className="text-rose-500">*</span>
                                </label>
                                <SearchableStoreSelect
                                    stores={stores}
                                    value={editStoreName}
                                    onChange={setEditStoreName}
                                    placeholder="-- Nhập mã hoặc tên siêu thị để tìm kiếm --"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Vai trò công tác: <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditRole('QUAN_LY')}
                                        className={`p-2 rounded-xl border text-center transition cursor-pointer text-xs ${
                                            editRole === 'QUAN_LY'
                                                ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                                                : 'bg-white border-slate-200 text-slate-700'
                                        }`}
                                    >
                                        Quản Lý
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditRole('TRUONG_CA')}
                                        className={`p-2 rounded-xl border text-center transition cursor-pointer text-xs ${
                                            editRole === 'TRUONG_CA'
                                                ? 'bg-blue-100 border-blue-400 text-blue-900 font-bold'
                                                : 'bg-white border-slate-200 text-slate-700'
                                        }`}
                                    >
                                        Trưởng Ca
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditRole('NHAN_VIEN')}
                                        className={`p-2 rounded-xl border text-center transition cursor-pointer text-xs ${
                                            editRole === 'NHAN_VIEN'
                                                ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold'
                                                : 'bg-white border-slate-200 text-slate-700'
                                        }`}
                                    >
                                        Nhân Viên
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Mã nhân viên:
                                    </label>
                                    <input
                                        type="text"
                                        value={editEmpId}
                                        onChange={(e) => setEditEmpId(e.target.value)}
                                        placeholder="ví dụ: 260732"
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Số điện thoại:
                                    </label>
                                    <input
                                        type="tel"
                                        value={editPhone}
                                        onChange={(e) => setEditPhone(e.target.value)}
                                        placeholder="không bắt buộc"
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>{isSubmitting ? 'Đang gửi...' : 'Lưu & Gửi Lại Xét Duyệt'}</span>
                                </button>
                            </div>
                        </form>
                    )}

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
                        ) : (
                            <>
                                {!isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(true)}
                                        className="w-full py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Edit3 className="w-4 h-4 text-amber-600" />
                                        <span>Chỉnh Sửa Lại Thông Tin Cá Nhân &amp; Đơn Vị</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={handleCheckStatus}
                                    disabled={isChecking}
                                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-blue-500/20"
                                >
                                    <RotateCcw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                                    <span>{isChecking ? 'Đang kiểm tra...' : 'Kiểm Tra Trạng Thái Duyệt'}</span>
                                </button>
                            </>
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
