import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth, type UserRole } from '../../shared/contexts/AuthContext';
import { fetchStores, type StoreItem } from '../../core/lib/storage';
import { submitOnboardingRequest, ROLE_LABELS } from '../../core/lib/authService';
import SearchableStoreSelect from '../../shared/components/common/SearchableStoreSelect';
import {
    Shield,
    Users,
    Crown,
    Star,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Building2,
    PlusCircle,
    ArrowRight,
    Info,
    Database
} from 'lucide-react';

export default function OnboardingPage() {
    const navigate = useNavigate();
    const { currentUser, isAuthenticated, isInitializing, updateLocalProfileStatus, logout } = useAuth();

    if (isInitializing) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-600 font-bold text-xs gap-3">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Đang tải thông tin tài khoản...</span>
            </div>
        );
    }

    if (!isAuthenticated || !currentUser?.email || !currentUser?.id) {
        return <Navigate to="/dang-nhap" replace />;
    }

    if (currentUser.status === 'ACTIVE') {
        return <Navigate to="/" replace />;
    }

    if (currentUser.status === 'PENDING_APPROVAL') {
        return <Navigate to="/cho-xet-duyet" replace />;
    }

    const [stores, setStores] = useState<StoreItem[]>([]);
    const [isLoadingStores, setIsLoadingStores] = useState(true);

    // Form State
    const [selectedRole, setSelectedRole] = useState<UserRole>('NHAN_VIEN');
    const [selectedStoreName, setSelectedStoreName] = useState<string>('');
    const [isNewStore, setIsNewStore] = useState(false);
    const [newStoreName, setNewStoreName] = useState('');
    const [newStoreCode, setNewStoreCode] = useState('');
    const [newStoreAddress, setNewStoreAddress] = useState('');
    const [employeeId, setEmployeeId] = useState(currentUser.employee_id || '');
    const [phone, setPhone] = useState(currentUser.phone || '');

    const [errorMsg, setErrorMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Tải danh sách siêu thị đã có
    useEffect(() => {
        async function loadStores() {
            setIsLoadingStores(true);
            const res = await fetchStores();
            if (res.success && res.data.length > 0) {
                setStores(res.data);
                // Để trống selectedStoreName để người dùng tự tìm kiếm và chọn
            }
            setIsLoadingStores(false);
        }
        loadStores();
    }, []);

    // Người xét duyệt dự kiến theo phân nhánh logic
    const getApproverInfo = () => {
        if (selectedRole === 'ADMIN' || selectedRole === 'QUAN_LY' || selectedRole === 'TRUONG_CA' || isNewStore) {
            return {
                title: 'Quản trị viên (Admin Hệ Thống)',
                badge: 'Admin Xét Duyệt',
                description: 'Yêu cầu mở siêu thị hoặc vai trò Quản lý / Trưởng ca sẽ được gửi đến Admin để kiểm duyệt thẩm quyền và bảo mật.'
            };
        }
        return {
            title: `Quản lý Siêu thị (${isNewStore ? newStoreName || 'Siêu thị mới' : selectedStoreName || 'Đã chọn'})`,
            badge: 'Quản Lý ST Xét Duyệt',
            description: `Yêu cầu tài khoản Nhân viên kinh doanh sẽ được gửi trực tiếp đến Quản lý của siêu thị ${isNewStore ? newStoreName : selectedStoreName} để phê duyệt vào đội ngũ.`
        };
    };

    const approverInfo = getApproverInfo();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        const finalStoreName = isNewStore ? newStoreName.trim() : selectedStoreName.trim();

        if (!finalStoreName) {
            setErrorMsg('Vui lòng chọn hoặc nhập tên siêu thị làm việc!');
            return;
        }

        if (isNewStore && !newStoreCode.trim()) {
            setErrorMsg('Vui lòng nhập Mã siêu thị (ví dụ: 10335, ST_VTA)!');
            return;
        }

        setIsSubmitting(true);
        const res = await submitOnboardingRequest({
            user: {
                id: currentUser.id || `usr_${Date.now()}`,
                email: currentUser.email || 'user@saleshub.vn',
                employee_id: employeeId || currentUser.employee_id || '',
                full_name: currentUser.full_name,
                phone: phone || currentUser.phone || '',
                store_name: finalStoreName,
                role: selectedRole,
                role_title: ROLE_LABELS[selectedRole],
                status: 'PENDING_APPROVAL',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            requested_role: selectedRole,
            store_name: finalStoreName,
            is_new_store: isNewStore,
            new_store_code: isNewStore ? newStoreCode.trim() : undefined,
            new_store_address: isNewStore ? newStoreAddress.trim() : undefined,
            phone,
            employee_id: employeeId
        });
        setIsSubmitting(false);

        if (res.success) {
            updateLocalProfileStatus('PENDING_APPROVAL', {
                store_name: finalStoreName,
                role: selectedRole,
                role_title: ROLE_LABELS[selectedRole],
                employee_id: employeeId,
                phone
            });
            navigate('/cho-xet-duyet');
        } else {
            setErrorMsg(res.error || 'Gửi yêu cầu không thành công');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 py-10 px-4 flex items-center justify-center relative overflow-hidden">
            {/* Glow effects */}
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-2xl relative z-10 space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-400 text-xs font-bold">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Bước 2/2: Thiết lập Đơn vị &amp; Vai trò làm việc</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        Chào mừng, <span className="text-blue-400">{currentUser.full_name}</span>!
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
                        Vui lòng chọn vai trò mong muốn và siêu thị bạn đang công tác để hệ thống gửi yêu cầu xét duyệt phân quyền.
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
                    {errorMsg && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-in shake duration-200">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                            <div className="flex-1 font-semibold">{errorMsg}</div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* 1. CHỌN VAI TRÒ */}
                        <div className="space-y-3">
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                                1. Chọn vai trò công tác của bạn: <span className="text-rose-500">*</span>
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Vai trò Quản lý */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedRole('QUAN_LY')}
                                    className={`p-4 rounded-2xl border-2 text-left transition flex flex-col justify-between gap-3 cursor-pointer ${
                                        selectedRole === 'QUAN_LY'
                                            ? 'bg-amber-50/80 border-amber-500 shadow-md ring-2 ring-amber-400/30'
                                            : 'bg-slate-50 border-slate-200 hover:border-amber-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                                            <Crown className="w-5 h-5" />
                                        </div>
                                        {selectedRole === 'QUAN_LY' && <CheckCircle2 className="w-5 h-5 text-amber-600" />}
                                    </div>
                                    <div>
                                        <div className="font-black text-sm text-slate-900">Quản Lý Siêu Thị</div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                            Điều hành toàn diện, giao chỉ tiêu &amp; duyệt nhân sự
                                        </div>
                                    </div>
                                </button>

                                {/* Vai trò Trưởng ca */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedRole('TRUONG_CA')}
                                    className={`p-4 rounded-2xl border-2 text-left transition flex flex-col justify-between gap-3 cursor-pointer ${
                                        selectedRole === 'TRUONG_CA'
                                            ? 'bg-blue-50/80 border-blue-500 shadow-md ring-2 ring-blue-400/30'
                                            : 'bg-slate-50 border-slate-200 hover:border-blue-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                            <Star className="w-5 h-5" />
                                        </div>
                                        {selectedRole === 'TRUONG_CA' && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                                    </div>
                                    <div>
                                        <div className="font-black text-sm text-slate-900">Trưởng Ca</div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                            Cập nhật doanh thu ca, theo dõi nhịp bán hàng
                                        </div>
                                    </div>
                                </button>

                                {/* Vai trò Nhân viên */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedRole('NHAN_VIEN')}
                                    className={`p-4 rounded-2xl border-2 text-left transition flex flex-col justify-between gap-3 cursor-pointer ${
                                        selectedRole === 'NHAN_VIEN'
                                            ? 'bg-emerald-50/80 border-emerald-500 shadow-md ring-2 ring-emerald-400/30'
                                            : 'bg-slate-50 border-slate-200 hover:border-emerald-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        {selectedRole === 'NHAN_VIEN' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                                    </div>
                                    <div>
                                        <div className="font-black text-sm text-slate-900">Nhân Viên Bán Hàng</div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                            Theo dõi KPI cá nhân &amp; thi đua ngành hàng
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* 2. CHỌN SIÊU THỊ HOẶC KHAI BÁO MỚI */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                                    2. Đơn vị Siêu thị công tác: <span className="text-rose-500">*</span>
                                </label>

                                <button
                                    type="button"
                                    onClick={() => setIsNewStore(!isNewStore)}
                                    className={`text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                        isNewStore ? 'text-blue-600 hover:text-blue-700' : 'text-slate-600 hover:text-blue-600'
                                    }`}
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    <span>{isNewStore ? 'Chọn siêu thị có sẵn' : 'Khai báo siêu thị mới'}</span>
                                </button>
                            </div>

                            {!isNewStore ? (
                                <div className="space-y-2">
                                    <SearchableStoreSelect
                                        stores={stores}
                                        value={selectedStoreName}
                                        onChange={setSelectedStoreName}
                                        placeholder="-- Nhập mã hoặc tên siêu thị để tìm kiếm --"
                                        disabled={isLoadingStores}
                                    />
                                    <p className="text-[11px] text-slate-500">
                                        💡 Gõ mã siêu thị (ví dụ: 10335) hoặc tên siêu thị để tìm nhanh. Nếu không tìm thấy, bấm <b>"Khai báo siêu thị mới"</b> ở trên.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-3 animate-in fade-in duration-200">
                                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                                        <PlusCircle className="w-4 h-4 text-amber-600" />
                                        <span>Đề xuất thêm mới siêu thị vào hệ thống:</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Tên siêu thị: <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required={isNewStore}
                                                value={newStoreName}
                                                onChange={(e) => setNewStoreName(e.target.value)}
                                                placeholder="ví dụ: AAR_HCM_Q1 - 123 Lê Lợi"
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Mã siêu thị (ERP/POS): <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required={isNewStore}
                                                value={newStoreCode}
                                                onChange={(e) => setNewStoreCode(e.target.value)}
                                                placeholder="ví dụ: 10555"
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                            Địa chỉ siêu thị:
                                        </label>
                                        <input
                                            type="text"
                                            value={newStoreAddress}
                                            onChange={(e) => setNewStoreAddress(e.target.value)}
                                            placeholder="ví dụ: Số 123 Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. THÔNG BÁO VỀ KẾ THỪA DỮ LIỆU & QUY TRÌNH DUYỆT */}
                        <div className="space-y-3 pt-1">
                            {/* Card Kế thừa dữ liệu (Requirement 4) */}
                            {selectedRole === 'QUAN_LY' && (
                                <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200 flex items-start gap-3 text-xs text-blue-900">
                                    <Database className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <span className="font-extrabold block">Bảo toàn &amp; Kế thừa dữ liệu siêu thị:</span>
                                        <p className="text-[11px] text-blue-800 leading-relaxed">
                                            Trong trường hợp siêu thị thay đổi Quản lý, tài khoản mới đăng ký theo siêu thị này sẽ tiếp tục sử dụng trọn vẹn toàn bộ dữ liệu kinh doanh, phiên cập nhật và mục tiêu nhân sự hiện tại của siêu thị.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Card Đích đến xét duyệt (Requirement 2 & 3) */}
                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3 text-xs text-slate-700">
                                <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-slate-800">Quy trình xét duyệt:</span>
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                                            {approverInfo.badge}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                        {approverInfo.description}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* SUBMIT BUTTON */}
                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={logout}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-800 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                            >
                                Đăng xuất / Quay lại
                            </button>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <span>Đang gửi yêu cầu...</span>
                                ) : (
                                    <>
                                        <span>Gửi Yêu Cầu Xét Duyệt</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
