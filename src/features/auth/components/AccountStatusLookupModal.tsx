import React, { useState, useEffect } from 'react';
import {
    Search,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    RotateCcw,
    Send,
    User,
    Mail,
    Phone,
    BadgeHelp,
    Building2,
    Crown,
    Star,
    Users,
    Edit3,
    ArrowRight,
    Store
} from 'lucide-react';
import {
    lookupUserAccountStatus,
    resubmitUserApproval,
    ROLE_LABELS,
    type UserProfile,
    type UserApprovalRequest,
    type UserRole
} from '../../../core/lib/authService';
import { fetchStores, type StoreItem } from '../../../core/lib/storage';
import { formatCapitalizeWords } from '../../../core/lib/formatters';
import SearchableStoreSelect from '../../../shared/components/common/SearchableStoreSelect';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onLoginRedirect?: () => void;
    initialSearchKey?: string;
}

export default function AccountStatusLookupModal({
    isOpen,
    onClose,
    onLoginRedirect,
    initialSearchKey = ''
}: Props) {
    const [searchKey, setSearchKey] = useState(initialSearchKey);
    const [isSearching, setIsSearching] = useState(false);
    const [lookupResult, setLookupResult] = useState<{
        user: UserProfile;
        approvalRequest?: UserApprovalRequest;
    } | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Edit form state (for rejected or pending accounts)
    const [isEditing, setIsEditing] = useState(false);
    const [editFullName, setEditFullName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editEmpId, setEditEmpId] = useState('');
    const [editStoreName, setEditStoreName] = useState('');
    const [editRole, setEditRole] = useState<UserRole>('NHAN_VIEN');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Danh sách siêu thị cho ô chọn
    const [stores, setStores] = useState<StoreItem[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchStores().then(res => {
                if (res.success && res.data) {
                    setStores(res.data);
                }
            });
            if (initialSearchKey && !lookupResult) {
                setSearchKey(initialSearchKey);
                handleSearch(initialSearchKey);
            }
        }
    }, [isOpen, initialSearchKey]);

    if (!isOpen) return null;

    const handleSearch = async (termToSearch?: string) => {
        const query = (termToSearch !== undefined ? termToSearch : searchKey).trim();
        if (!query) {
            setErrorMsg('Vui lòng nhập Email, Mã nhân viên hoặc Số điện thoại để tra cứu');
            return;
        }

        setErrorMsg('');
        setSuccessMsg('');
        setIsSearching(true);
        setIsEditing(false);

        const res = await lookupUserAccountStatus(query);
        setIsSearching(false);

        if (res.success && res.data) {
            setLookupResult(res.data);
            // Chuẩn bị dữ liệu form sửa
            setEditFullName(res.data.user.full_name || '');
            setEditPhone(res.data.user.phone || '');
            setEditEmpId(res.data.user.employee_id || '');
            setEditStoreName(res.data.user.store_name || '');
            setEditRole(res.data.user.role || 'NHAN_VIEN');
        } else {
            setLookupResult(null);
            setErrorMsg(res.error || 'Không tìm thấy tài khoản phù hợp');
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lookupResult?.user) return;

        const formattedName = formatCapitalizeWords(editFullName);
        if (!formattedName) {
            setErrorMsg('Vui lòng nhập Họ và tên');
            return;
        }
        if (!editStoreName.trim()) {
            setErrorMsg('Vui lòng chọn Đơn vị Siêu thị làm việc');
            return;
        }

        setErrorMsg('');
        setIsSubmitting(true);
        const res = await resubmitUserApproval({
            userId: lookupResult.user.id,
            full_name: formattedName,
            phone: editPhone.trim(),
            employee_id: editEmpId.trim(),
            store_name: editStoreName.trim(),
            requested_role: editRole
        });
        setIsSubmitting(false);

        if (res.success && res.data) {
            setSuccessMsg('Đã cập nhật thông tin và gửi lại yêu cầu xét duyệt thành công! Vui lòng chờ phản hồi.');
            setLookupResult({
                user: res.data,
                approvalRequest: lookupResult.approvalRequest
            });
            setIsEditing(false);
        } else {
            setErrorMsg(res.error || 'Có lỗi xảy ra khi cập nhật thông tin');
        }
    };

    const user = lookupResult?.user;
    const isApproved = user?.status === 'ACTIVE';
    const isRejected = user?.status === 'REJECTED';
    const isPending = user?.status === 'PENDING_APPROVAL' || user?.status === 'PENDING_ONBOARDING';

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <Search className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-sm text-slate-800">
                                Cổng Tra Cứu Trạng Thái Xét Duyệt
                            </h3>
                            <p className="text-[11px] text-slate-500">
                                Kiểm tra tiến độ duyệt hồ sơ, lý do từ chối &amp; chỉnh sửa lại thông tin
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition cursor-pointer text-sm font-bold"
                    >
                        ✕
                    </button>
                </div>

                {/* Input Search Form */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSearch();
                    }}
                    className="flex gap-2"
                >
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                            type="text"
                            value={searchKey}
                            onChange={(e) => setSearchKey(e.target.value)}
                            placeholder="Nhập Email, Mã nhân viên (ví dụ: 260732) hoặc SĐT..."
                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSearching}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                    >
                        <RotateCcw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
                        <span>{isSearching ? 'Đang tìm...' : 'Tra Cứu'}</span>
                    </button>
                </form>

                {/* Thông báo lỗi / thành công */}
                {errorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700 animate-in fade-in duration-150">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                        <span className="font-medium">{errorMsg}</span>
                    </div>
                )}

                {successMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-800 animate-in fade-in duration-150">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                        <span className="font-semibold">{successMsg}</span>
                    </div>
                )}

                {/* Kết quả tra cứu */}
                {user && (
                    <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                        {/* Status Card Header */}
                        <div className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${
                            isApproved
                                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                : isRejected
                                ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                                : 'bg-amber-50/70 border-amber-200 text-amber-900'
                        }`}>
                            <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                    isApproved
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : isRejected
                                        ? 'bg-rose-100 text-rose-700'
                                        : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {isApproved ? (
                                        <CheckCircle2 className="w-6 h-6" />
                                    ) : isRejected ? (
                                        <XCircle className="w-6 h-6" />
                                    ) : (
                                        <Clock className="w-6 h-6 animate-pulse" />
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                            isApproved
                                                ? 'bg-emerald-200/80 text-emerald-900'
                                                : isRejected
                                                ? 'bg-rose-200/80 text-rose-900'
                                                : 'bg-amber-200/80 text-amber-900'
                                        }`}>
                                            {isApproved ? 'Đã kích hoạt (ACTIVE)' : isRejected ? 'Bị từ chối (REJECTED)' : 'Đang chờ duyệt (PENDING)'}
                                        </span>
                                    </div>
                                    <h4 className="font-extrabold text-sm text-slate-900">
                                        {user.full_name}
                                    </h4>
                                    <p className="text-xs text-slate-600">
                                        Email: <span className="font-medium text-slate-800">{user.email}</span>
                                        {user.employee_id && (
                                            <> • Mã NV: <span className="font-mono font-bold text-slate-800">{user.employee_id}</span></>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Lý do từ chối nếu có */}
                        {isRejected && user.rejection_reason && (
                            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-1">
                                <div className="font-black text-rose-800 flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>Lý do từ chối hồ sơ từ Ban Quản lý / Admin:</span>
                                </div>
                                <p className="text-rose-700 font-medium pl-5.5 leading-relaxed bg-white/60 p-2 rounded-xl border border-rose-100">
                                    {user.rejection_reason}
                                </p>
                            </div>
                        )}

                        {/* Chi tiết thông tin hiện tại */}
                        {!isEditing && (
                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                                    <span className="text-slate-500">Đơn vị Siêu thị:</span>
                                    <span className="font-bold text-slate-800 text-right max-w-[280px] truncate">
                                        {user.store_name || '(Chưa gán siêu thị)'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                                    <span className="text-slate-500">Vai trò đăng ký:</span>
                                    <span className="font-bold text-blue-700">
                                        {ROLE_LABELS[user.role] || user.role_title}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-1">
                                    <span className="text-slate-500">Số điện thoại:</span>
                                    <span className="font-semibold text-slate-700">
                                        {user.phone || '(Chưa cập nhật)'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Form Chỉnh sửa thông tin phù hợp */}
                        {isEditing && (
                            <form onSubmit={handleFormSubmit} className="space-y-3.5 p-4 bg-blue-50/40 rounded-2xl border border-blue-200 animate-in fade-in duration-150">
                                <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Chỉnh sửa thông tin &amp; gửi lại xét duyệt</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(false)}
                                        className="text-[11px] text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
                                    >
                                        Hủy sửa
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
                                        Đơn vị Siêu thị làm việc: <span className="text-rose-500">*</span>
                                    </label>
                                    <SearchableStoreSelect
                                        stores={stores}
                                        value={editStoreName}
                                        onChange={setEditStoreName}
                                        placeholder="-- Nhập tìm kiếm hoặc chọn siêu thị công tác --"
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
                                                    ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold shadow-xs'
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
                                                    ? 'bg-blue-100 border-blue-400 text-blue-900 font-bold shadow-xs'
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
                                                    ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold shadow-xs'
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
                                        <span>{isSubmitting ? 'Đang gửi...' : 'Cập Nhật & Gửi Lại Xét Duyệt'}</span>
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            {isApproved ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        if (onLoginRedirect) onLoginRedirect();
                                    }}
                                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                    <span>Tài khoản đã sẵn sàng • Đăng nhập ngay</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <>
                                    {!isEditing && (
                                        <button
                                            type="button"
                                            onClick={() => setIsEditing(true)}
                                            className="py-2 px-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                                            <span>Chỉnh sửa thông tin hồ sơ</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="ml-auto py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                                    >
                                        Đóng
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
