import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, type UserRole } from '../../shared/contexts/AuthContext';
import { fetchStores, fetchEmployees, type StoreItem, type EmployeeItem, parseEmployeeRoleAndDept } from '../../core/lib/storage';
import { ROLE_LABELS } from '../../core/lib/authService';
import {
    Store,
    UserPlus,
    Mail,
    Lock,
    User,
    Phone,
    BadgeHelp,
    ChevronRight,
    ChevronLeft,
    AlertCircle,
    CheckCircle2,
    Crown,
    Star,
    Users,
    Building2,
    PlusCircle,
    Info,
    Sparkles,
    Send
} from 'lucide-react';

export default function RegisterPage() {
    const navigate = useNavigate();
    const { register, isLoading, isAuthenticated, currentUser } = useAuth();

    // Tự động điều hướng nếu đã đăng nhập
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

    // Step state
    const [step, setStep] = useState<1 | 2>(1);

    // Step 1: User Profile Info
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [phone, setPhone] = useState('');

    // Step 2: Store & Role Selection
    const [role, setRole] = useState<UserRole>('NHAN_VIEN');
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [isLoadingStores, setIsLoadingStores] = useState(true);
    const [selectedStoreName, setSelectedStoreName] = useState('');
    const [isNewStore, setIsNewStore] = useState(false);
    const [newStoreName, setNewStoreName] = useState('');
    const [newStoreCode, setNewStoreCode] = useState('');
    const [newStoreAddress, setNewStoreAddress] = useState('');

    const [errorMsg, setErrorMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Tải danh sách siêu thị & nhân sự đã khai báo trong hệ thống
    useEffect(() => {
        async function loadInitialData() {
            setIsLoadingStores(true);
            const [storesRes, empsRes] = await Promise.all([
                fetchStores(),
                fetchEmployees()
            ]);
            if (storesRes.success && storesRes.data.length > 0) {
                setStores(storesRes.data);
                setSelectedStoreName(storesRes.data[0].name);
            }
            if (empsRes.success && empsRes.data.length > 0) {
                setEmployees(empsRes.data);
            }
            setIsLoadingStores(false);
        }
        loadInitialData();
    }, []);

    // Nhận diện nhân sự đã có sẵn trong hệ thống siêu thị
    const matchedEmployee = useMemo(() => {
        const cleanId = employeeId.trim().toLowerCase();
        if (!cleanId || cleanId.length < 2) return null;
        return employees.find(e => e.employee_id?.trim().toLowerCase() === cleanId) || null;
    }, [employeeId, employees]);

    // Tự động điền và mặc định thông tin theo hệ thống đã lưu trước
    useEffect(() => {
        if (matchedEmployee) {
            if (matchedEmployee.full_name) {
                setFullName(matchedEmployee.full_name);
            }
            if (matchedEmployee.store_name) {
                setSelectedStoreName(matchedEmployee.store_name);
            }
            const normalized = parseEmployeeRoleAndDept(matchedEmployee);
            setRole(normalized.role);
        }
    }, [matchedEmployee]);

    // Chuyển sang bước 2
    const handleProceedToStep2 = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!fullName.trim()) {
            setErrorMsg('Vui lòng nhập Họ và tên của bạn!');
            return;
        }
        if (!email.trim() || !email.includes('@')) {
            setErrorMsg('Vui lòng nhập địa chỉ Email hợp lệ!');
            return;
        }
        if (!password || password.length < 6) {
            setErrorMsg('Mật khẩu tối thiểu 6 ký tự!');
            return;
        }
        if (password !== confirmPassword) {
            setErrorMsg('Mật khẩu xác nhận không khớp!');
            return;
        }

        setStep(2);
    };

    // Hoàn tất đăng ký & gửi yêu cầu xét duyệt
    const handleCompleteRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        const finalStoreName = isNewStore ? newStoreName.trim() : selectedStoreName.trim();

        if (!finalStoreName) {
            setErrorMsg('Vui lòng chọn hoặc nhập tên siêu thị bạn đang công tác!');
            return;
        }

        if (isNewStore && !newStoreCode.trim()) {
            setErrorMsg('Vui lòng nhập Mã siêu thị (ERP / POS)!');
            return;
        }

        // ƯU TIÊN MẶC ĐỊNH SỬ DỤNG HỌ TÊN & BỘ PHẬN THEO HỆ THỐNG ĐÃ LƯU TRƯỚC
        const finalFullName = matchedEmployee?.full_name?.trim() || fullName.trim();
        const finalDepartment = matchedEmployee?.department || matchedEmployee?.job_title || undefined;

        setIsSubmitting(true);
        const res = await register({
            email,
            password,
            full_name: finalFullName,
            employee_id: employeeId.trim(),
            department: finalDepartment,
            phone,
            role,
            store_name: finalStoreName,
            is_new_store: isNewStore,
            new_store_code: isNewStore ? newStoreCode.trim() : undefined,
            new_store_address: isNewStore ? newStoreAddress.trim() : undefined
        });
        setIsSubmitting(false);

        if (res.success) {
            // Đăng ký thành công -> điều hướng sang trang chờ xét duyệt
            navigate('/cho-xet-duyet');
        } else {
            setErrorMsg(res.error || 'Đăng ký không thành công. Vui lòng thử lại!');
        }
    };

    // Thông tin người xét duyệt dự kiến
    const approverInfo = role === 'NHAN_VIEN' && !isNewStore
        ? {
            badge: 'Quản Lý ST & Admin Phê Duyệt',
            text: `Yêu cầu gia nhập sẽ được gửi đến Quản lý siêu thị [${selectedStoreName || 'đã chọn'}] và Quản trị viên (Admin) để xét duyệt.`
        }
        : {
            badge: 'Admin Hệ Thống Phê Duyệt',
            text: 'Yêu cầu chức danh Quản lý / Trưởng ca hoặc Mở siêu thị mới sẽ được gửi trực tiếp tới Quản trị viên (Admin) để xét duyệt phân quyền.'
        };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Glow */}
            <div className="absolute top-1/4 -right-20 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-xl relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-200">
                {/* Brand Header */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xl shadow-blue-500/25 ring-4 ring-white/10">
                        <Store className="w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">
                        SALES<span className="text-blue-400">HUB</span>
                    </h1>
                    <p className="text-xs text-slate-400 font-medium">
                        Khởi tạo tài khoản &amp; Đăng ký phân quyền vào hệ thống kinh doanh
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/20 space-y-6">
                    {/* Stepper Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center ${step === 1 ? 'bg-blue-600 text-white' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                {step === 1 ? '1' : '✓'}
                            </div>
                            <span className={`text-xs font-bold ${step === 1 ? 'text-slate-900' : 'text-slate-500'}`}>
                                Thông tin cá nhân
                            </span>

                            <span className="text-slate-300">→</span>

                            <div className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                                }`}>
                                2
                            </div>
                            <span className={`text-xs font-bold ${step === 2 ? 'text-slate-900' : 'text-slate-400'}`}>
                                Đơn vị &amp; Vai trò
                            </span>
                        </div>

                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                            Admin duyệt tự động
                        </span>
                    </div>

                    {errorMsg && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-in shake duration-200">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                            <div className="flex-1 font-semibold">{errorMsg}</div>
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* BƯỚC 1: THÔNG TIN TÀI KHOẢN                               */}
                    {/* ========================================================= */}
                    {step === 1 && (
                        <form onSubmit={handleProceedToStep2} className="space-y-4 animate-in fade-in duration-150">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Họ và tên của bạn: <span className="text-rose-500">*</span>
                                    </label>
                                    {matchedEmployee && (
                                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                            ✓ Tên chuẩn theo hệ thống
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        readOnly={Boolean(matchedEmployee)}
                                        placeholder="ví dụ: Nguyễn Văn An"
                                        className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition ${
                                            matchedEmployee ? 'border-emerald-300 bg-emerald-50/40 cursor-not-allowed font-bold text-emerald-900' : 'border-slate-200'
                                        }`}
                                    />
                                </div>
                                {matchedEmployee && (
                                    <p className="text-[10px] text-emerald-700 mt-1 font-medium">
                                        🔒 Họ tên đã được khóa cố định theo hồ sơ siêu thị đã lưu: <b>{matchedEmployee.full_name}</b> (#{matchedEmployee.employee_id}) • Siêu thị: <b>{matchedEmployee.store_name}</b>.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Email đăng nhập: <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="ví dụ: nvan@company.com"
                                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Mật khẩu: <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Tối thiểu 6 ký tự"
                                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Xác nhận mật khẩu: <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Nhập lại mật khẩu"
                                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Mã nhân viên:
                                    </label>
                                    <div className="relative">
                                        <BadgeHelp className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                                        <input
                                            type="text"
                                            value={employeeId}
                                            onChange={(e) => setEmployeeId(e.target.value)}
                                            placeholder="ví dụ: 260732"
                                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Số điện thoại:
                                    </label>
                                    <div className="relative">
                                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="không bắt buộc"
                                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full mt-3 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>Tiếp Tục: Chọn Siêu Thị &amp; Vai Trò</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </form>
                    )}

                    {/* ========================================================= */}
                    {/* BƯỚC 2: CHỌN VAI TRÒ & SIÊU THỊ                           */}
                    {/* ========================================================= */}
                    {step === 2 && (
                        <form onSubmit={handleCompleteRegistration} className="space-y-5 animate-in fade-in duration-150">
                            {/* 1. CHỌN VAI TRÒ */}
                            <div className="space-y-2.5">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                                    1. Vai trò bạn mong muốn đảm nhiệm: <span className="text-rose-500">*</span>
                                </label>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    {/* Quản lý */}
                                    <button
                                        type="button"
                                        onClick={() => setRole('QUAN_LY')}
                                        className={`p-3 rounded-2xl border-2 text-left transition flex flex-col justify-between gap-2 cursor-pointer ${role === 'QUAN_LY'
                                            ? 'bg-amber-50/90 border-amber-500 shadow-md ring-2 ring-amber-400/30'
                                            : 'bg-slate-50 border-slate-200 hover:border-amber-300'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                                                <Crown className="w-4 h-4" />
                                            </div>
                                            {role === 'QUAN_LY' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                                        </div>
                                        <div>
                                            <div className="font-black text-xs text-slate-900">Quản Lý Siêu Thị</div>
                                            <div className="text-[10px] text-slate-500 mt-0.5">
                                                Toàn quyền siêu thị &amp; duyệt nhân sự
                                            </div>
                                        </div>
                                    </button>

                                    {/* Trưởng ca */}
                                    <button
                                        type="button"
                                        onClick={() => setRole('TRUONG_CA')}
                                        className={`p-3 rounded-2xl border-2 text-left transition flex flex-col justify-between gap-2 cursor-pointer ${role === 'TRUONG_CA'
                                            ? 'bg-blue-50/90 border-blue-500 shadow-md ring-2 ring-blue-400/30'
                                            : 'bg-slate-50 border-slate-200 hover:border-blue-300'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                                <Star className="w-4 h-4" />
                                            </div>
                                            {role === 'TRUONG_CA' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                                        </div>
                                        <div>
                                            <div className="font-black text-xs text-slate-900">Trưởng Ca</div>
                                            <div className="text-[10px] text-slate-500 mt-0.5">
                                                Cập nhật doanh thu &amp; theo dõi ca
                                            </div>
                                        </div>
                                    </button>

                                    {/* Nhân viên */}
                                    <button
                                        type="button"
                                        onClick={() => setRole('NHAN_VIEN')}
                                        className={`p-3 rounded-2xl border-2 text-left transition flex flex-col justify-between gap-2 cursor-pointer ${role === 'NHAN_VIEN'
                                            ? 'bg-emerald-50/90 border-emerald-500 shadow-md ring-2 ring-emerald-400/30'
                                            : 'bg-slate-50 border-slate-200 hover:border-emerald-300'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                                <Users className="w-4 h-4" />
                                            </div>
                                            {role === 'NHAN_VIEN' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                                        </div>
                                        <div>
                                            <div className="font-black text-xs text-slate-900">Nhân Viên</div>
                                            <div className="text-[10px] text-slate-500 mt-0.5">
                                                Tư vấn bán hàng, AIO, thu ngân, kho...
                                            </div>
                                        </div>
                                    </button>
                                </div>
                                {matchedEmployee && (matchedEmployee.role || matchedEmployee.job_title || matchedEmployee.department) && (
                                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                                        <span>
                                            Vai trò nghiệp vụ đã lưu trong siêu thị: <b>{matchedEmployee.role || matchedEmployee.job_title || matchedEmployee.department}</b>
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* 2. CHỌN SIÊU THỊ */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                                        2. Đơn vị Siêu thị công tác: <span className="text-rose-500">*</span>
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => setIsNewStore(!isNewStore)}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition"
                                    >
                                        <PlusCircle className="w-3.5 h-3.5" />
                                        <span>{isNewStore ? 'Chọn siêu thị có sẵn' : 'Khai báo siêu thị mới'}</span>
                                    </button>
                                </div>

                                {!isNewStore ? (
                                    <div className="relative">
                                        <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                                        <select
                                            value={selectedStoreName}
                                            onChange={(e) => setSelectedStoreName(e.target.value)}
                                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition cursor-pointer"
                                        >
                                            {isLoadingStores && <option>Đang tải danh sách siêu thị...</option>}
                                            {stores.map((st) => (
                                                <option key={st.id || st.code} value={st.name}>
                                                    {st.name} {st.code ? `(${st.code})` : ''}
                                                </option>
                                            ))}
                                            {stores.length === 0 && !isLoadingStores && (
                                                <option value="AAR_BRV_VTA - 290 Trương Công Định">
                                                    AAR_BRV_VTA - 290 Trương Công Định (Mặc định)
                                                </option>
                                            )}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3 animate-in fade-in duration-150">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                                            <PlusCircle className="w-4 h-4 text-amber-600" />
                                            <span>Đề xuất thêm siêu thị mới vào hệ thống:</span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                                                    Mã siêu thị (POS/ERP): <span className="text-rose-500">*</span>
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
                                                placeholder="ví dụ: 123 Lê Lợi, P. Bến Thành, Quận 1, TP.HCM"
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 3. THÔNG TIN XÉT DUYỆT */}
                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-2.5 text-xs text-slate-700">
                                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-slate-800">Quy trình xét duyệt:</span>
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                                            {approverInfo.badge}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                        {approverInfo.text}
                                    </p>
                                </div>
                            </div>

                            {/* BUTTONS */}
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    <span>Quay lại</span>
                                </button>

                                <button
                                    type="submit"
                                    disabled={isSubmitting || isLoading}
                                    className="py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <span>Đang gửi yêu cầu...</span>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            <span>Hoàn Tất Đăng Ký &amp; Gửi Xét Duyệt</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="text-center pt-2 border-t border-slate-100">
                        <span className="text-xs text-slate-500">Đã có tài khoản? </span>
                        <Link
                            to="/dang-nhap"
                            className="text-xs font-black text-blue-600 hover:text-blue-700 hover:underline transition"
                        >
                            Đăng nhập ngay &rarr;
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
