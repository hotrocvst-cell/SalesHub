import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, type UserRole, type UserAccountStatus } from '../../shared/contexts/AuthContext';
import {
    fetchAllUserProfiles,
    adminResetPassword,
    adminUpdateUserProfile,
    adminDeleteUserProfile,
    adminCreateUserProfile,
    adminQuickApproveUser,
    sendPasswordResetEmail,
    checkSupabaseUserProfilesTable,
    getUnsyncedUserProfiles,
    syncLocalProfilesToCloud,
    AUTH_SYSTEM_SQL,
    type UserProfile,
    ROLE_LABELS
} from '../../core/lib/authService';
import {
    fetchStores,
    fetchEmployees,
    type StoreItem,
    type EmployeeItem,
    parseEmployeeRoleAndDept
} from '../../core/lib/storage';
import { formatCapitalizeWords } from '../../core/lib/formatters';
import ApprovalModal from '../auth/components/ApprovalModal';
import {
    Users,
    UserCheck,
    KeyRound,
    UserPlus,
    Search,
    Filter,
    Store,
    Shield,
    Crown,
    Star,
    CheckCircle2,
    XCircle,
    Clock,
    Lock,
    Unlock,
    Edit2,
    Trash2,
    RefreshCw,
    Copy,
    Check,
    AlertCircle,
    Eye,
    EyeOff,
    Send,
    Phone,
    Mail,
    BadgeHelp,
    Building2,
    Database,
    Code,
    CloudUpload
} from 'lucide-react';

export default function UserManagementPage() {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [allEmployees, setAllEmployees] = useState<EmployeeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [storeFilter, setStoreFilter] = useState<string>('ALL');

    // Modals
    const [resetUser, setResetUser] = useState<UserProfile | null>(null);
    const [editUser, setEditUser] = useState<UserProfile | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);

    // Reset Password Form State
    const [resetMode, setResetMode] = useState<'EMAIL' | 'DIRECT'>('EMAIL');
    const [newPassword, setNewPassword] = useState('');
    const [resetSuccessData, setResetSuccessData] = useState<{ user: UserProfile; pass: string } | null>(null);
    const [emailSentSuccess, setEmailSentSuccess] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Cloud Database Status
    const [cloudStatus, setCloudStatus] = useState<{ exists: boolean; count: number; error?: string }>({ exists: true, count: 0 });
    const [unsyncedUsers, setUnsyncedUsers] = useState<UserProfile[]>([]);
    const [isSyncingCloud, setIsSyncingCloud] = useState(false);
    const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
    const [isSqlCopied, setIsSqlCopied] = useState(false);

    // Create User Form State
    const [createForm, setCreateForm] = useState({
        full_name: '',
        email: '',
        password: 'SalesHub@' + new Date().getFullYear(),
        role: 'NHAN_VIEN' as UserRole,
        store_name: '',
        employee_id: '',
        phone: ''
    });
    const [matchedEmpInfo, setMatchedEmpInfo] = useState<string | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        const [userList, storeRes, cStatus, unsyncedRes, empList] = await Promise.all([
            fetchAllUserProfiles(),
            fetchStores(),
            checkSupabaseUserProfilesTable(),
            getUnsyncedUserProfiles(),
            fetchEmployees()
        ]);
        setUsers(userList);
        setCloudStatus(cStatus);
        setUnsyncedUsers(unsyncedRes.unsynced || []);
        setAllEmployees(empList.data || []);
        if (storeRes.success) {
            setStores(storeRes.data);
            if (storeRes.data.length > 0 && !createForm.store_name) {
                setCreateForm(prev => ({ ...prev, store_name: storeRes.data[0].name }));
            }
        }
        setIsLoading(false);
    };

    const handleSyncAllToCloud = async () => {
        setIsSyncingCloud(true);
        const res = await syncLocalProfilesToCloud();
        setIsSyncingCloud(false);
        if (res.success) {
            showMsg('success', `Đã đồng bộ thành công ${res.count} tài khoản lên Cloud!`);
            await loadData();
        } else {
            showMsg('error', res.error || 'Lỗi đồng bộ tài khoản lên Cloud');
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const showMsg = (type: 'success' | 'error', text: string) => {
        setActionMsg({ type, text });
        setTimeout(() => setActionMsg(null), 4000);
    };

    // Lọc danh sách người dùng
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q ||
                u.full_name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                (u.employee_id && u.employee_id.toLowerCase().includes(q)) ||
                (u.phone && u.phone.includes(q)) ||
                (u.store_name && u.store_name.toLowerCase().includes(q));

            const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
            const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
            const matchesStore = storeFilter === 'ALL' || u.store_name === storeFilter;

            return matchesSearch && matchesRole && matchesStatus && matchesStore;
        });
    }, [users, searchQuery, roleFilter, statusFilter, storeFilter]);

    // Thống kê nhanh
    const stats = useMemo(() => {
        const total = users.length;
        const active = users.filter(u => u.status === 'ACTIVE').length;
        const pending = users.filter(u => u.status === 'PENDING_APPROVAL' || u.status === 'PENDING_ONBOARDING').length;
        const managers = users.filter(u => u.role === 'QUAN_LY').length;
        const staff = users.filter(u => u.role === 'NHAN_VIEN' || u.role === 'TRUONG_CA').length;
        return { total, active, pending, managers, staff };
    }, [users]);

    // Tạo mật khẩu ngẫu nhiên
    const generateRandomPassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
        let pass = 'SH@';
        for (let i = 0; i < 6; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setNewPassword(pass);
    };

    // Mở modal reset mật khẩu
    const handleOpenResetModal = (user: UserProfile) => {
        setResetUser(user);
        setResetSuccessData(null);
        setEmailSentSuccess(false);
        setResetMode('EMAIL');
        setNewPassword('SalesHub@' + Math.floor(1000 + Math.random() * 9000));
    };

    // Gửi email khôi phục mật khẩu tự động
    const handleSendResetEmail = async () => {
        if (!resetUser || !resetUser.email) return;
        setIsProcessing(true);
        const res = await sendPasswordResetEmail(resetUser.email);
        setIsProcessing(false);

        if (res.success) {
            setEmailSentSuccess(true);
            showMsg('success', `Đã gửi email khôi phục mật khẩu đến ${resetUser.email}!`);
        } else {
            showMsg('error', res.error || 'Có lỗi khi gửi email khôi phục');
        }
    };

    // Thực hiện Reset mật khẩu
    const handleConfirmResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetUser || !newPassword.trim()) return;

        setIsProcessing(true);
        const res = await adminResetPassword(resetUser.id, newPassword);
        setIsProcessing(false);

        if (res.success) {
            setResetSuccessData({ user: resetUser, pass: newPassword.trim() });
            showMsg('success', `Đã đặt lại mật khẩu cho ${resetUser.full_name} thành công!`);
            await loadData();
        } else {
            showMsg('error', res.error || 'Có lỗi khi đặt lại mật khẩu');
        }
    };

    // Sao chép thông tin tài khoản để gửi Messaging App
    const handleCopyAccountInfo = () => {
        if (!resetSuccessData) return;
        const text = `🔐 THÔNG TIN ĐĂNG NHẬP SALES HUB:\n- Họ tên: ${resetSuccessData.user.full_name}\n- Tài khoản: ${resetSuccessData.user.email}${resetSuccessData.user.employee_id ? ` (hoặc Mã NV: ${resetSuccessData.user.employee_id})` : ''}\n- Mật khẩu mới: ${resetSuccessData.pass}\n- Đơn vị: ${resetSuccessData.user.store_name}\n- Link đăng nhập: ${window.location.origin}/dang-nhap`;
        navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // Khóa / Mở khóa tài khoản
    const handleToggleLock = async (user: UserProfile) => {
        const newStatus: UserAccountStatus = user.status === 'ACTIVE' ? 'REJECTED' : 'ACTIVE';
        const res = await adminUpdateUserProfile(user.id, {
            status: newStatus,
            rejection_reason: newStatus === 'REJECTED' ? 'Tài khoản bị Quản trị viên tạm khóa' : undefined
        });
        if (res.success) {
            showMsg('success', newStatus === 'ACTIVE' ? `Đã mở khóa tài khoản ${user.full_name}` : `Đã tạm khóa tài khoản ${user.full_name}`);
            await loadData();
        } else {
            showMsg('error', res.error || 'Có lỗi khi cập nhật');
        }
    };

    // Phê duyệt nhanh tài khoản người dùng
    const handleQuickApprove = async (u: UserProfile) => {
        setIsProcessing(true);
        const res = await adminQuickApproveUser(u, `${currentUser.full_name} (Admin)`);
        setIsProcessing(false);
        if (res.success) {
            showMsg('success', `Đã phê duyệt tài khoản ${u.full_name} (${u.email}) thành công!`);
            await loadData();
        } else {
            showMsg('error', res.error || 'Lỗi khi phê duyệt tài khoản');
        }
    };

    // Lưu chỉnh sửa thông tin người dùng
    const handleSaveEditUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editUser) return;

        const formattedName = formatCapitalizeWords(editUser.full_name);
        const userToSave = { ...editUser, full_name: formattedName };

        setIsProcessing(true);
        const res = await adminUpdateUserProfile(userToSave.id, userToSave);
        setIsProcessing(false);

        if (res.success) {
            showMsg('success', `Đã cập nhật thông tin tài khoản ${userToSave.full_name}!`);
            setEditUser(null);
            await loadData();
        } else {
            showMsg('error', res.error || 'Lỗi lưu thông tin');
        }
    };

    // Xóa người dùng
    const handleConfirmDelete = async () => {
        if (!deleteUser) return;
        setIsProcessing(true);
        const res = await adminDeleteUserProfile(deleteUser.id);
        setIsProcessing(false);

        if (res.success) {
            showMsg('success', `Đã xóa tài khoản ${deleteUser.full_name}`);
            setDeleteUser(null);
            await loadData();
        } else {
            showMsg('error', res.error || 'Lỗi xóa tài khoản');
        }
    };

    // Tự động nhận diện nhân viên đã khai báo khi nhập mã NV
    const handleCreateEmployeeIdChange = (empId: string) => {
        const trimmed = empId.trim();
        setCreateForm(prev => {
            const next = { ...prev, employee_id: empId };
            if (trimmed && allEmployees.length > 0) {
                const found = allEmployees.find(e => e.employee_id.trim().toLowerCase() === trimmed.toLowerCase());
                if (found) {
                    const parsed = parseEmployeeRoleAndDept(found);
                    setMatchedEmpInfo(`✓ Khớp nhân sự hệ thống: [${found.full_name}] • Siêu thị: ${found.store_name} • Vai trò: ${found.role || 'Nhân viên'}`);
                    // MẶC ĐỊNH SỬ DỤNG HỌ TÊN VÀ VAI TRÒ THEO HỆ THỐNG ĐÃ LƯU TRƯỚC
                    next.full_name = formatCapitalizeWords(found.full_name);
                    next.store_name = found.store_name;
                    if (next.role !== 'ADMIN') {
                        next.role = parsed.operationalRole as UserRole;
                    }
                    return next;
                }
            }
            setMatchedEmpInfo(null);
            return next;
        });
    };

    // Admin tạo tài khoản mới trực tiếp
    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createForm.full_name || !createForm.email) return;

        const formattedName = formatCapitalizeWords(createForm.full_name);
        const formToCreate = { ...createForm, full_name: formattedName };

        setIsProcessing(true);
        const res = await adminCreateUserProfile(formToCreate);
        setIsProcessing(false);

        if (res.success && res.data) {
            showMsg('success', `Đã tạo mới tài khoản ${formattedName}!`);
            setResetSuccessData({ user: res.data, pass: createForm.password });
            setIsCreateModalOpen(false);
            setMatchedEmpInfo(null);
            setCreateForm({
                full_name: '',
                email: '',
                password: 'SalesHub@' + new Date().getFullYear(),
                role: 'NHAN_VIEN',
                store_name: stores[0]?.name || '',
                employee_id: '',
                phone: ''
            });
            await loadData();
        } else {
            showMsg('error', res.error || 'Lỗi tạo tài khoản');
        }
    };

    return (
        <div className="space-y-4 pb-12 animate-in fade-in duration-200">
            {/* Header Phân hệ */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                Quản Lý Tài Khoản Người Dùng
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                                🛡️ Admin Only
                            </span>
                            {cloudStatus.exists ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5" title="Bảng user_profiles đã kết nối thành công với Cloud">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span>☁️ Cloud ({cloudStatus.count} TK)</span>
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsSqlModalOpen(true)}
                                    className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition cursor-pointer"
                                    title="Nhấp để xem lệnh SQL tạo bảng trên Supabase"
                                >
                                    ⚠️ Chưa tạo bảng Cloud
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Quản lý toàn bộ tài khoản, đặt lại mật khẩu cho nhân sự, chuyển giao siêu thị và phân quyền vai trò
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={loadData}
                        disabled={isLoading}
                        className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                        title="Tải lại danh sách"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>

                    {stats.pending > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsApprovalModalOpen(true)}
                            className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-sm shadow-amber-500/20 cursor-pointer animate-pulse"
                            title="Có tài khoản đang chờ bạn duyệt"
                        >
                            <UserCheck className="w-4 h-4" />
                            <span>Xét Duyệt ({stats.pending})</span>
                        </button>
                    )}

                    <Link
                        to="/phan-quyen-sieu-thi"
                        className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                        title="Theo dõi và phân quyền xem dữ liệu siêu thị cho các tài khoản"
                    >
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <span className="hidden sm:inline">Phân Quyền Siêu Thị</span>
                    </Link>

                    <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-sm shadow-blue-500/20 cursor-pointer"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>Thêm Tài Khoản Mới</span>
                    </button>
                </div>
            </div>

            {/* Banner Cảnh Báo Tài Khoản Chờ Xét Duyệt */}
            {stats.pending > 0 && (
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-start sm:items-center gap-3">
                        <div className="p-2.5 bg-amber-200/80 text-amber-900 rounded-2xl shrink-0 font-bold border border-amber-300">
                            <UserCheck className="w-5 h-5 text-amber-800" />
                        </div>
                        <div>
                            <div className="font-black text-amber-950 flex items-center gap-2">
                                <span>Phát hiện {stats.pending} tài khoản đang chờ xét duyệt phân quyền!</span>
                                <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-[10px] font-bold">Chờ duyệt</span>
                            </div>
                            <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">
                                Người dùng đã đăng ký tài khoản và gửi yêu cầu vai trò / siêu thị. Bạn có thể mở danh sách xét duyệt hoặc bấm trực tiếp nút <b>"Duyệt"</b> ở từng dòng dưới bảng.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsApprovalModalOpen(true)}
                        className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shrink-0 transition shadow-md shadow-amber-500/20 cursor-pointer text-xs flex items-center gap-1.5 self-start sm:self-center"
                    >
                        <UserCheck className="w-4 h-4" />
                        <span>Xem &amp; Xét Duyệt Ngay ({stats.pending})</span>
                    </button>
                </div>
            )}

            {/* Thông báo thao tác */}
            {actionMsg && (
                <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-2 duration-150 ${actionMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                    {actionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                    <span>{actionMsg.text}</span>
                </div>
            )}

            {/* Cảnh báo Cloud Database nếu chưa tạo bảng trên Supabase */}
            {!cloudStatus.exists && (
                <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-amber-100 text-amber-800 rounded-2xl shrink-0 mt-0.5 border border-amber-200">
                            <Database className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                            <div className="font-black text-amber-950 flex items-center gap-2">
                                <span>Chưa kết nối bảng dữ liệu Cloud (`user_profiles`)</span>
                                <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-full text-[10px] font-bold">Chế độ Local Cache</span>
                            </div>
                            <p className="text-amber-800 text-[11px] leading-relaxed">
                                Dữ liệu tài khoản hiện đang lưu tại trình duyệt này. Để đồng bộ vĩnh viễn lên cơ sở dữ liệu Cloud và tránh mất dữ liệu khi đổi thiết bị, bạn chỉ cần chạy đoạn mã SQL tạo bảng 1 lần trong Cloud SQL Editor.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsSqlModalOpen(true)}
                        className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl font-bold shrink-0 transition shadow-xs cursor-pointer text-xs flex items-center gap-1.5 self-start sm:self-center"
                    >
                        <Code className="w-3.5 h-3.5" />
                        <span>Xem Lệnh SQL Tạo Bảng</span>
                    </button>
                </div>
            )}

            {/* Cảnh báo có tài khoản cục bộ chưa đồng bộ lên Supabase */}
            {cloudStatus.exists && unsyncedUsers.length > 0 && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-950 shadow-2xs animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-blue-100 text-blue-700 rounded-2xl shrink-0 mt-0.5 border border-blue-200 shadow-inner">
                            <CloudUpload className="w-5 h-5 animate-pulse text-blue-600" />
                        </div>
                        <div className="space-y-0.5">
                            <div className="font-black text-blue-950 flex items-center gap-2">
                                <span>Phát hiện {unsyncedUsers.length} tài khoản người dùng lưu cục bộ chưa đồng bộ lên Cloud!</span>
                                <span className="px-2 py-0.5 bg-blue-200/80 text-blue-900 rounded-full text-[10px] font-bold">Cần đồng bộ</span>
                            </div>
                            <p className="text-blue-800 text-[11px] leading-relaxed">
                                Danh sách: <b>{unsyncedUsers.map(u => u.full_name).slice(0, 3).join(', ')}{unsyncedUsers.length > 3 ? ` và ${unsyncedUsers.length - 3} tài khoản khác` : ''}</b> hiện chỉ có ở máy này. Hãy bấm đồng bộ ngay để tài khoản có mặt trên cơ sở dữ liệu Cloud.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled={isSyncingCloud}
                        onClick={handleSyncAllToCloud}
                        className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shrink-0 transition shadow-md shadow-blue-500/20 cursor-pointer text-xs flex items-center gap-2 self-start sm:self-center disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                        <span>{isSyncingCloud ? 'Đang đồng bộ...' : `⚡ Đồng Bộ ${unsyncedUsers.length} Tài Khoản Lên Cloud`}</span>
                    </button>
                </div>
            )}

            {/* Thống kê nhanh */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="text-[11px] font-bold text-slate-400 uppercase">Tổng tài khoản</div>
                    <div className="text-xl font-black text-slate-800 mt-0.5">{stats.total}</div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="text-[11px] font-bold text-emerald-600 uppercase">Đang hoạt động</div>
                    <div className="text-xl font-black text-emerald-700 mt-0.5">{stats.active}</div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="text-[11px] font-bold text-amber-600 uppercase">Quản lý Siêu thị (QL)</div>
                    <div className="text-xl font-black text-amber-700 mt-0.5">{stats.managers}</div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="text-[11px] font-bold text-blue-600 uppercase">Trưởng ca &amp; Nhân viên</div>
                    <div className="text-xl font-black text-blue-700 mt-0.5">{stats.staff}</div>
                </div>
            </div>

            {/* Thanh Tìm kiếm & Bộ lọc */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm theo họ tên, email, mã nhân viên, số điện thoại..."
                        className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Lọc Role */}
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="ALL">Tất cả vai trò</option>
                        <option value="ADMIN">🛡️ Admin</option>
                        <option value="QUAN_LY">👑 Quản lý (QL)</option>
                        <option value="TRUONG_CA">⭐ Trưởng ca (TC)</option>
                        <option value="NHAN_VIEN">👤 Nhân viên (NV)</option>
                    </select>

                    {/* Lọc Trạng thái */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="ALL">Tất cả trạng thái</option>
                        <option value="ACTIVE">Hoạt động</option>
                        <option value="PENDING_APPROVAL">Chờ duyệt</option>
                        <option value="REJECTED">Bị khóa / Từ chối</option>
                    </select>

                    {/* Lọc Siêu thị */}
                    <select
                        value={storeFilter}
                        onChange={(e) => setStoreFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[180px] truncate"
                    >
                        <option value="ALL">Tất cả siêu thị</option>
                        {stores.map(st => (
                            <option key={st.id || st.code} value={st.name}>{st.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Bảng Danh Sách Tài Khoản */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="py-3.5 px-4">Tài khoản &amp; Nhân sự</th>
                                <th className="py-3.5 px-3">Vai trò</th>
                                <th className="py-3.5 px-3">Siêu thị công tác</th>
                                <th className="py-3.5 px-3">Trạng thái</th>
                                <th className="py-3.5 px-3">Bảo mật</th>
                                <th className="py-3.5 px-4 text-right">Thao tác Admin</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-xs font-bold text-slate-400">
                                        Đang tải danh sách tài khoản...
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                                        Không tìm thấy tài khoản nào phù hợp với bộ lọc.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50/60 transition group">
                                        {/* TÀI KHOẢN & NHÂN SỰ */}
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${u.role === 'ADMIN'
                                                        ? 'bg-rose-100 text-rose-800'
                                                        : u.role === 'QUAN_LY'
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : u.role === 'TRUONG_CA'
                                                                ? 'bg-blue-100 text-blue-800'
                                                                : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                    {u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-extrabold text-slate-900 truncate">
                                                        {u.full_name}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                                        <span className="truncate">{u.email}</span>
                                                        {u.employee_id && (
                                                            <span>• Mã: <b>{u.employee_id}</b></span>
                                                        )}
                                                        {u.phone && (
                                                            <span>• {u.phone}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* VAI TRÒ */}
                                        <td className="py-3 px-3">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${u.role === 'ADMIN'
                                                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                                    : u.role === 'QUAN_LY'
                                                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                                        : u.role === 'TRUONG_CA'
                                                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                }`}>
                                                <span>{u.role === 'ADMIN' ? '🛡️' : u.role === 'QUAN_LY' ? '👑' : u.role === 'TRUONG_CA' ? '⭐' : '👤'}</span>
                                                <span>{ROLE_LABELS[u.role] || u.role}</span>
                                            </span>
                                        </td>

                                        {/* SIÊU THỊ CÔNG TÁC & PHẠM VI XEM */}
                                        <td className="py-3 px-3">
                                            {u.store_name ? (
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-1.5 text-slate-700 font-semibold max-w-[220px] truncate" title={u.store_name}>
                                                        <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                        <span className="truncate">{u.store_name}</span>
                                                    </div>
                                                    {u.accessible_stores && u.accessible_stores.length > 1 && (
                                                        <Link
                                                            to="/phan-quyen-sieu-thi"
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold hover:bg-amber-200 transition"
                                                            title={`Được xem ${u.accessible_stores.length} siêu thị: ${u.accessible_stores.join(', ')}`}
                                                        >
                                                            <span>🏢 Phụ trách {u.accessible_stores.length} shop</span>
                                                        </Link>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic text-[11px]">Chưa gắn ST</span>
                                            )}
                                        </td>

                                        {/* TRẠNG THÁI */}
                                        <td className="py-3 px-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase inline-block ${u.status === 'ACTIVE'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : u.status === 'PENDING_APPROVAL'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : u.status === 'PENDING_ONBOARDING'
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-rose-100 text-rose-800'
                                                }`}>
                                                {u.status === 'ACTIVE'
                                                    ? '✓ Hoạt động'
                                                    : u.status === 'PENDING_APPROVAL'
                                                        ? '⏳ Chờ duyệt'
                                                        : u.status === 'PENDING_ONBOARDING'
                                                            ? '📝 Chưa Onboard'
                                                            : '✕ Bị khóa / Từ chối'}
                                            </span>
                                        </td>

                                        {/* BẢO MẬT & MẬT KHẨU */}
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                    {u.password ? '••••••••' : 'Chưa đặt MK'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* THAO TÁC */}
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {/* Nút Phê Duyệt Nhanh (Nếu đang chờ duyệt hoặc chưa onboard) */}
                                                {(u.status === 'PENDING_APPROVAL' || u.status === 'PENDING_ONBOARDING') && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQuickApprove(u)}
                                                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] transition flex items-center gap-1 cursor-pointer shadow-xs shadow-emerald-500/20"
                                                        title="Phê duyệt tài khoản này ngay lập tức"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>Duyệt</span>
                                                    </button>
                                                )}

                                                {/* Nút Reset Mật Khẩu */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenResetModal(u)}
                                                    className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                                                    title="Đặt lại mật khẩu cho tài khoản này"
                                                >
                                                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                                                    <span className="hidden lg:inline">Reset MK</span>
                                                </button>

                                                {/* Nút Sửa */}
                                                <button
                                                    type="button"
                                                    onClick={() => setEditUser(u)}
                                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition cursor-pointer"
                                                    title="Chỉnh sửa thông tin tài khoản"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>

                                                {/* Nút Khóa / Mở Khóa */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleLock(u)}
                                                    className={`p-1.5 rounded-lg transition cursor-pointer ${u.status === 'ACTIVE'
                                                            ? 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600'
                                                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                                        }`}
                                                    title={u.status === 'ACTIVE' ? 'Khóa tài khoản này' : 'Mở khóa tài khoản này'}
                                                >
                                                    {u.status === 'ACTIVE' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                                </button>

                                                {/* Nút Xóa */}
                                                {u.id !== currentUser.id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteUser(u)}
                                                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                                                        title="Xóa tài khoản"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ========================================================= */}
            {/* MODAL 1: RESET MẬT KHẨU (PASSWORD RESET)                 */}
            {/* ========================================================= */}
            {resetUser && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                                    <KeyRound className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-sm text-slate-800">
                                        Đặt Lại Mật Khẩu Người Dùng
                                    </h3>
                                    <p className="text-[11px] text-slate-500">Cấp mật khẩu mới cho nhân sự</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setResetUser(null)}
                                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Thông tin người nhận reset */}
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Nhân sự:</span>
                                <span className="font-extrabold text-slate-900">{resetUser.full_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Email:</span>
                                <span className="font-semibold text-slate-700">{resetUser.email}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Đơn vị:</span>
                                <span className="font-semibold text-blue-700">{resetUser.store_name || 'Hệ thống'}</span>
                            </div>
                        </div>

                        {/* Chọn chế độ Reset: Email tự động vs Cấp mật khẩu trực tiếp */}
                        <div className="flex gap-2 border-b border-slate-100 pb-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setResetMode('EMAIL');
                                    setResetSuccessData(null);
                                }}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${resetMode === 'EMAIL'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                <Mail className="w-3.5 h-3.5" />
                                <span>1. Gửi Email Tự Động</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setResetMode('DIRECT');
                                    setEmailSentSuccess(false);
                                }}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${resetMode === 'DIRECT'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>2. Cấp MK Trực Tiếp</span>
                            </button>
                        </div>

                        {/* CHẾ ĐỘ 1: GỬI EMAIL TỰ ĐỘNG QUA SUPABASE AUTH */}
                        {resetMode === 'EMAIL' ? (
                            <div className="space-y-4">
                                {!emailSentSuccess ? (
                                    <div className="space-y-4">
                                        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs text-blue-900 space-y-1.5">
                                            <div className="font-extrabold flex items-center gap-1.5">
                                                <Send className="w-4 h-4 text-blue-600" />
                                                <span>Cơ chế gửi Email tự động:</span>
                                            </div>
                                            <p className="text-[11px] text-blue-800 leading-relaxed">
                                                Hệ thống sẽ gửi email chứa liên kết bảo mật trực tiếp đến hòm thư <b>{resetUser.email}</b>. Nhân sự chỉ cần mở email và nhấp vào liên kết để tự tạo mật khẩu mới an toàn.
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => setResetUser(null)}
                                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                            >
                                                Hủy
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isProcessing}
                                                onClick={handleSendResetEmail}
                                                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                                            >
                                                <Send className={`w-3.5 h-3.5 ${isProcessing ? 'animate-bounce' : ''}`} />
                                                <span>{isProcessing ? 'Đang gửi email...' : 'Gửi Email Khôi Phục'}</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 animate-in zoom-in-95 duration-150">
                                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                                                <CheckCircle2 className="w-7 h-7" />
                                            </div>
                                            <h4 className="font-extrabold text-sm text-emerald-900">
                                                Email Đã Được Gửi Tự Động!
                                            </h4>
                                            <p className="text-xs text-emerald-700 leading-relaxed max-w-xs mx-auto">
                                                Hệ thống đã gửi liên kết khôi phục mật khẩu đến <b>{resetUser.email}</b>. Vui lòng nhắc nhân sự kiểm tra hộp thư đến (Inbox) hoặc thư rác (Spam).
                                            </p>
                                        </div>

                                        <div className="text-center pt-1">
                                            <button
                                                type="button"
                                                onClick={() => setResetUser(null)}
                                                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
                                            >
                                                Hoàn Tất &amp; Đóng
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* CHẾ ĐỘ 2: CẤP MẬT KHẨU TRỰC TIẾP TỪ ADMIN */
                            !resetSuccessData ? (
                                <form onSubmit={handleConfirmResetPassword} className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-bold text-slate-700">
                                                Mật khẩu mới khởi tạo: <span className="text-rose-500">*</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={generateRandomPassword}
                                                className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                                            >
                                                ⚡ Tạo ngẫu nhiên
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Nhập mật khẩu mới..."
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Mật khẩu sẽ có hiệu lực ngay lập tức. Người dùng có thể đăng nhập bằng email và mật khẩu này.
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setResetUser(null)}
                                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isProcessing || !newPassword.trim()}
                                            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer disabled:opacity-50"
                                        >
                                            {isProcessing ? 'Đang cập nhật...' : 'Xác Nhận Đổi MK'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                /* Card Kết quả thành công & Nút Copy gửi Messaging App */
                                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
                                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                                        <div className="font-extrabold text-sm text-emerald-900">
                                            Đã Đặt Lại Mật Khẩu Thành Công!
                                        </div>
                                        <div className="text-xs text-emerald-700">
                                            Mật khẩu mới: <b className="font-mono bg-emerald-100 px-2 py-0.5 rounded">{resetSuccessData.pass}</b>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-slate-900 text-slate-200 rounded-2xl text-[11px] font-mono leading-relaxed space-y-1">
                                        <div className="text-slate-400 font-bold border-b border-slate-800 pb-1">
                                            Nội dung gửi cho nhân sự (Messaging App / Email):
                                        </div>
                                        <div>Tài khoản: <b>{resetSuccessData.user.email}</b></div>
                                        <div>Mật khẩu mới: <b className="text-amber-300">{resetSuccessData.pass}</b></div>
                                        <div>Đơn vị: {resetSuccessData.user.store_name}</div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleCopyAccountInfo}
                                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
                                    >
                                        {isCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                                        <span>{isCopied ? 'Đã sao chép vào bộ nhớ tạm!' : 'Sao Chép Thông Tin Gửi Messaging App/Email'}</span>
                                    </button>

                                    <div className="text-center pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setResetUser(null)}
                                            className="text-xs font-bold text-slate-500 hover:text-slate-800"
                                        >
                                            Đóng cửa sổ
                                        </button>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 2: CHỈNH SỬA THÔNG TIN TÀI KHOẢN                   */}
            {/* ========================================================= */}
            {editUser && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                    <Edit2 className="w-5 h-5" />
                                </div>
                                <h3 className="font-extrabold text-sm text-slate-800">
                                    Chỉnh Sửa Hồ Sơ Tài Khoản
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditUser(null)}
                                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveEditUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Họ và tên: <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editUser.full_name}
                                    onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })}
                                    onBlur={() => setEditUser({ ...editUser, full_name: formatCapitalizeWords(editUser.full_name) })}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Mã nhân viên:
                                    </label>
                                    <input
                                        type="text"
                                        value={editUser.employee_id || ''}
                                        onChange={(e) => setEditUser({ ...editUser, employee_id: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Số điện thoại:
                                    </label>
                                    <input
                                        type="tel"
                                        value={editUser.phone || ''}
                                        onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Vai trò công tác:
                                    </label>
                                    <select
                                        value={editUser.role}
                                        onChange={(e) => setEditUser({ ...editUser, role: e.target.value as UserRole })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="ADMIN">🛡️ Admin</option>
                                        <option value="QUAN_LY">👑 Quản lý Siêu thị</option>
                                        <option value="TRUONG_CA">⭐ Trưởng ca</option>
                                        <option value="NHAN_VIEN">👤 Nhân viên kinh doanh</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Trạng thái hoạt động:
                                    </label>
                                    <select
                                        value={editUser.status}
                                        onChange={(e) => setEditUser({ ...editUser, status: e.target.value as UserAccountStatus })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                                        <option value="PENDING_APPROVAL">Chờ duyệt (PENDING)</option>
                                        <option value="REJECTED">Tạm khóa / Từ chối (LOCKED)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Đơn vị Siêu thị công tác:
                                </label>
                                <select
                                    value={editUser.store_name || ''}
                                    onChange={(e) => setEditUser({ ...editUser, store_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">-- Chưa gán siêu thị --</option>
                                    {stores.map(st => (
                                        <option key={st.id || st.code} value={st.name}>
                                            {st.name} {st.code ? `(${st.code})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setEditUser(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isProcessing}
                                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                    {isProcessing ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 3: THÊM TÀI KHOẢN MỚI TRỰC TIẾP (ADMIN)           */}
            {/* ========================================================= */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-sm text-slate-800">
                                        Tạo Mới Tài Khoản Người Dùng
                                    </h3>
                                    <p className="text-[11px] text-slate-500">Tài khoản được kích hoạt ngay không cần chờ xét duyệt</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            {/* Mã NV đặt trước để tự động tra cứu họ tên chuẩn */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Mã nhân viên (nếu có):
                                    </label>
                                    <input
                                        type="text"
                                        value={createForm.employee_id}
                                        onChange={(e) => handleCreateEmployeeIdChange(e.target.value)}
                                        placeholder="ví dụ: 260732"
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Số điện thoại:
                                    </label>
                                    <input
                                        type="tel"
                                        value={createForm.phone}
                                        onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                                        placeholder="0901234567"
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Banner thông báo tìm thấy nhân sự */}
                            {matchedEmpInfo && (
                                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-1.5 animate-in fade-in duration-150">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>{matchedEmpInfo}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Họ và tên nhân sự: <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={createForm.full_name}
                                    onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                                    onBlur={() => setCreateForm({ ...createForm, full_name: formatCapitalizeWords(createForm.full_name) })}
                                    placeholder="ví dụ: Nguyễn Văn A"
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Email đăng nhập: <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={createForm.email}
                                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                        placeholder="nva@company.com"
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Mật khẩu khởi tạo: <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={createForm.password}
                                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Vai trò cấp phát:
                                    </label>
                                    <select
                                        value={createForm.role}
                                        onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="ADMIN">🛡️ Admin</option>
                                        <option value="QUAN_LY">👑 Quản lý Siêu thị</option>
                                        <option value="TRUONG_CA">⭐ Trưởng ca</option>
                                        <option value="NHAN_VIEN">👤 Nhân viên kinh doanh</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Siêu thị công tác:
                                    </label>
                                    <select
                                        value={createForm.store_name}
                                        onChange={(e) => setCreateForm({ ...createForm, store_name: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {stores.map(st => (
                                            <option key={st.id || st.code} value={st.name}>
                                                {st.name} {st.code ? `(${st.code})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isProcessing}
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                    {isProcessing ? 'Đang tạo...' : 'Tạo Tài Khoản'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 4: XÁC NHẬN XÓA TÀI KHOẢN                           */}
            {/* ========================================================= */}
            {deleteUser && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-base text-slate-800">
                                Xóa tài khoản này?
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Bạn có chắc chắn muốn xóa tài khoản <b>{deleteUser.full_name}</b> ({deleteUser.email})? Thao tác này không thể hoàn tác.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteUser(null)}
                                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                disabled={isProcessing}
                                onClick={handleConfirmDelete}
                                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                            >
                                {isProcessing ? 'Đang xóa...' : 'Xác Nhận Xóa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 5: MÃ SQL KHỞI TẠO BẢNG SUPABASE CLOUD            */}
            {/* ========================================================= */}
            {isSqlModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <Database className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-sm text-slate-900">
                                        Khởi Tạo Bảng Cơ Sở Dữ Liệu Trên Cloud
                                    </h3>
                                    <p className="text-[11px] text-slate-500">Chạy câu lệnh SQL này để đồng bộ tài khoản đa thiết bị</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsSqlModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition cursor-pointer text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs text-blue-900 space-y-1">
                            <div className="font-bold">📋 Hướng dẫn thực hiện 3 bước:</div>
                            <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-blue-800">
                                <li>Nhấp nút <b>"Sao Chép Mã SQL"</b> bên dưới.</li>
                                <li>Mở Supabase Dashboard ➔ chọn mục <b>SQL Editor</b> (ở thanh bên trái).</li>
                                <li>Dán đoạn mã vào và nhấn nút <b>Run</b> (chạy). Hệ thống sẽ tự động tạo bảng và lưu trữ vĩnh viễn toàn bộ tài khoản!</li>
                            </ol>
                        </div>

                        <div className="relative">
                            <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-2xl max-h-60 overflow-y-auto leading-relaxed border border-slate-800 select-all">
                                {AUTH_SYSTEM_SQL}
                            </pre>
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(AUTH_SYSTEM_SQL);
                                    setIsSqlCopied(true);
                                    setTimeout(() => setIsSqlCopied(false), 2500);
                                }}
                                className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold transition flex items-center gap-1.5 shadow-sm border border-slate-700 cursor-pointer"
                            >
                                {isSqlCopied ? (
                                    <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-300">Đã chép!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                                        <span>Sao Chép Mã SQL</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSqlModalOpen(false);
                                    loadData();
                                }}
                                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
                            >
                                Đóng &amp; Tải Lại Dữ Liệu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Xét Duyệt Tài Khoản & Phân Quyền */}
            <ApprovalModal
                isOpen={isApprovalModalOpen}
                onClose={() => setIsApprovalModalOpen(false)}
                onUpdated={loadData}
            />
        </div>
    );
}
