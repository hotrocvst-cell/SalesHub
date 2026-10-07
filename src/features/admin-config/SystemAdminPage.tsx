import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../shared/contexts/PermissionContext';
import { type UserRole } from '../../shared/contexts/AuthContext';
import {
    SYSTEM_PAGE_PERMISSIONS_SQL,
    auditRouteCoverage,
    syncMissingPagesToPermissions,
    type SystemPagePermission
} from '../../core/lib/permissions';
import { AUTH_SYSTEM_SQL } from '../../core/lib/authService';
import { EMPLOYEE_DATA_SESSIONS_SQL } from '../employee-cumulative/utils/sessionStorage';
import ApprovalModal from '../auth/components/ApprovalModal';
import {
    ShieldCheck,
    Save,
    RotateCcw,
    Database,
    Search,
    CheckCircle2,
    AlertCircle,
    Eye,
    EyeOff,
    Check,
    Copy,
    Code,
    Layers,
    Cloud,
    CloudUpload,
    RefreshCw,
    ExternalLink,
    UserCheck,
    Users,
    Sparkles
} from 'lucide-react';

export default function SystemAdminPage() {
    const navigate = useNavigate();
    const { permissions, isSyncedWithSupabase, updatePermissions, resetToDefault, checkCloudConnection } = usePermissions();

    const [pageList, setPageList] = useState<SystemPagePermission[]>(permissions);
    const [hasChanges, setHasChanges] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isCheckingCloud, setIsCheckingCloud] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
    const [toastMessage, setToastMessage] = useState<string>('');
    const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState<boolean>(false);
    const [sqlTab, setSqlTab] = useState<'PERMISSIONS' | 'AUTH' | 'SESSIONS' | 'ALL'>('PERMISSIONS');
    const [isCopied, setIsCopied] = useState<boolean>(false);

    const getActiveSql = () => {
        if (sqlTab === 'PERMISSIONS') return SYSTEM_PAGE_PERMISSIONS_SQL;
        if (sqlTab === 'AUTH') return AUTH_SYSTEM_SQL;
        if (sqlTab === 'SESSIONS') return EMPLOYEE_DATA_SESSIONS_SQL;
        return `-- ==================================================\n-- TOÀN BỘ LỆNH TẠO BẢNG SUPABASE CHO SALES HUB\n-- ==================================================\n\n` + 
            SYSTEM_PAGE_PERMISSIONS_SQL + '\n\n' + 
            AUTH_SYSTEM_SQL + '\n\n' + 
            EMPLOYEE_DATA_SESSIONS_SQL;
    };

    // Đồng bộ khi permissions từ context thay đổi lần đầu
    useMemo(() => {
        if (!hasChanges) {
            setPageList(permissions);
        }
    }, [permissions]);

    // Kiểm toán tính toàn vẹn giữa các trang thực tế và danh sách phân quyền
    const routeAudit = useMemo(() => auditRouteCoverage(pageList), [pageList]);

    // Đồng bộ nhanh tất cả trang thực tế chưa được quản trị
    const handleSyncMissingRoutes = () => {
        const full = syncMissingPagesToPermissions(pageList);
        setPageList(full);
        setHasChanges(true);
        showToast(`⚡ Đã bổ sung ${routeAudit.unmanagedRoutes.length} trang mới vào danh sách! Nhấn "Lưu lên Supabase Cloud" để hoàn tất.`);
    };

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    // Kiểm tra kết nối bảng Supabase Cloud
    const handleCheckCloud = async () => {
        setIsCheckingCloud(true);
        const res = await checkCloudConnection();
        setIsCheckingCloud(false);
        if (res.exists) {
            showToast(`✅ Kết nối Supabase Cloud hoàn tất! Bảng [system_page_permissions] đã sẵn sàng (${res.count} bản ghi).`);
        } else {
            showToast(`⚠️ Chưa tìm thấy bảng [system_page_permissions] trên Supabase! Đang mở hướng dẫn tạo bảng...`);
            setIsSqlModalOpen(true);
        }
    };

    // Toggle trạng thái Bật/Tắt một trang
    const handleToggleStatus = (path: string) => {
        // Trang Quản trị không được phép tắt
        if (path === '/quan-tri-he-thong') {
            showToast('⚠️ Trang Quản trị Hệ Thống luôn luôn phải hoạt động!');
            return;
        }

        setPageList(prev => prev.map(p => {
            if (p.path === path) {
                return { ...p, is_enabled: !p.is_enabled };
            }
            return p;
        }));
        setHasChanges(true);
    };

    // Toggle phân quyền vai trò
    const handleToggleRole = (path: string, role: UserRole) => {
        if (path === '/quan-tri-he-thong' && role !== 'ADMIN') {
            showToast('⚠️ Trang Quản trị Hệ Thống chỉ dành riêng cho Admin!');
            return;
        }

        setPageList(prev => prev.map(p => {
            if (p.path === path) {
                const currentRoles = p.allowed_roles || [];
                const hasRole = currentRoles.includes(role);
                const nextRoles = hasRole
                    ? currentRoles.filter(r => r !== role)
                    : [...currentRoles, role];

                return { ...p, allowed_roles: nextRoles };
            }
            return p;
        }));
        setHasChanges(true);
    };

    // Cấp quyền tất cả vai trò cho 1 trang
    const handleGrantAll = (path: string) => {
        if (path === '/quan-tri-he-thong') return;
        setPageList(prev => prev.map(p => {
            if (p.path === path) {
                return { ...p, allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'] };
            }
            return p;
        }));
        setHasChanges(true);
    };

    // Thu hồi chỉ để Quản lý & Admin
    const handleRestrictToManagers = (path: string) => {
        if (path === '/quan-tri-he-thong') return;
        setPageList(prev => prev.map(p => {
            if (p.path === path) {
                return { ...p, allowed_roles: ['ADMIN', 'QUAN_LY'] };
            }
            return p;
        }));
        setHasChanges(true);
    };

    // Lưu cấu hình
    const handleSave = async () => {
        setIsSaving(true);
        const res = await updatePermissions(pageList);
        setIsSaving(false);

        if (res.success) {
            setHasChanges(false);
            if (res.fromSupabase) {
                showToast('☁️ Đã lưu cấu hình lên Supabase Cloud thành công! Áp dụng ngay cho mọi thiết bị.');
            } else {
                showToast('⚠️ Đã lưu cấu hình tạm vào máy này (Chưa tạo bảng trên Cloud). Bấm "Mã SQL Supabase" để khởi tạo.');
            }
        } else {
            showToast('⚠️ Lỗi khi lưu cấu hình: ' + (res.error || 'Vui lòng thử lại!'));
        }
    };

    // Khôi phục mặc định
    const handleReset = async () => {
        if (window.confirm('Bạn có chắc chắn muốn khôi phục ma trận phân quyền về trạng thái mặc định ban đầu của hệ thống?')) {
            setIsSaving(true);
            await resetToDefault();
            setIsSaving(false);
            setHasChanges(false);
            showToast('🔄 Đã khôi phục ma trận phân quyền về mặc định!');
        }
    };

    // Copy SQL
    const handleCopySql = () => {
        navigator.clipboard.writeText(getActiveSql());
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // Lọc danh sách hiển thị
    const filteredList = useMemo(() => {
        return pageList.filter(item => {
            const matchesQuery = searchQuery === '' ||
                item.page_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.group_title.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesGroup = selectedGroup === 'ALL' || item.group_title === selectedGroup;

            return matchesQuery && matchesGroup;
        });
    }, [pageList, searchQuery, selectedGroup]);

    // Danh sách các nhóm menu
    const groups = useMemo(() => {
        const set = new Set<string>();
        pageList.forEach(p => set.add(p.group_title));
        return Array.from(set);
    }, [pageList]);

    // Thống kê
    const activeCount = pageList.filter(p => p.is_enabled).length;
    const disabledCount = pageList.length - activeCount;

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-[1300px] mx-auto w-full">
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Header Phân hệ */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                            <ShieldCheck className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <span>Quản Trị Hệ Thống & Phân Quyền Tính Năng</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-extrabold tracking-wider uppercase">
                                    Admin Only
                                </span>
                            </h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Kiểm soát trạng thái hiển thị (Bật / Tạm ẩn) và phân quyền truy cập từng trang theo vai trò người dùng.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {hasChanges && (
                        <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5" /> Có thay đổi chưa lưu!
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={handleCheckCloud}
                        disabled={isCheckingCloud}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-50"
                        title="Kiểm tra trạng thái kết nối tới bảng trên Supabase"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isCheckingCloud ? 'animate-spin' : ''}`} />
                        <span>{isCheckingCloud ? 'Đang kiểm tra...' : 'Kiểm tra Cloud'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/quan-ly-tai-khoan')}
                        className="px-3.5 py-2 bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-300 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                        title="Quản lý danh sách tài khoản người dùng & Đặt lại mật khẩu"
                    >
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>Quản Lý Tài Khoản</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsApprovalModalOpen(true)}
                        className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                        title="Xét duyệt các yêu cầu đăng ký tài khoản & khai báo siêu thị mới"
                    >
                        <UserCheck className="w-3.5 h-3.5 text-amber-300" />
                        <span>Xét Duyệt Tài Khoản &amp; ST</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsSqlModalOpen(true)}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                        title="Xem mã SQL để tạo bảng lưu trữ trên Supabase"
                    >
                        <Code className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Mã SQL Supabase</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={isSaving}
                        className="px-3.5 py-2 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-slate-700 hover:text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-50"
                        title="Khôi phục ma trận về mặc định ban đầu"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Khôi phục mặc định</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50 ${hasChanges
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400 animate-pulse'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                    >
                        {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                        <span>{isSaving ? 'ĐANG LƯU LÊN CLOUD...' : '☁️ LƯU LÊN SUPABASE CLOUD'}</span>
                    </button>
                </div>
            </div>

            {/* Banner trạng thái đồng bộ Cloud Supabase */}
            {isSyncedWithSupabase ? (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-emerald-800 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span>
                            <b>Supabase Cloud Realtime:</b> Cấu hình phân quyền đã đồng bộ trực tuyến. Mọi thay đổi bạn lưu sẽ tự động cập nhật ngay lập tức đến thiết bị của mọi nhân sự mà không cần tải lại trang.
                        </span>
                    </div>
                </div>
            ) : (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                            <span className="font-extrabold block">Đang lưu tạm tại bộ nhớ cục bộ (Local Cache)</span>
                            <span className="text-amber-800 text-[11px]">
                                Bảng <code className="bg-amber-100 px-1 py-0.2 rounded font-mono font-bold">system_page_permissions</code> chưa được tạo trên Supabase Cloud. Để lưu và đồng bộ ma trận phân quyền cho toàn hệ thống, vui lòng chạy lệnh SQL tạo bảng (chỉ mất 30 giây).
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsSqlModalOpen(true)}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                    >
                        <Code className="w-3.5 h-3.5" />
                        <span>Lấy Mã SQL Tạo Bảng</span>
                    </button>
                </div>
            )}

            {/* Khối Kiểm Soát Tính Toàn Vẹn Tuyến Đường (Route Audit & Registry Monitor) */}
            <div className={`rounded-2xl p-4 border transition-all ${
                routeAudit.isFullyAudited
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 shadow-2xs'
                    : 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-sm'
            }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                            routeAudit.isFullyAudited ? 'bg-emerald-200/80 text-emerald-800' : 'bg-amber-200/90 text-amber-900'
                        }`}>
                            <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-500">
                                    Kiểm Soát Tính Toàn Vẹn Tuyến Đường (Route Audit)
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    routeAudit.isFullyAudited
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-amber-500 text-white animate-pulse'
                                }`}>
                                    {routeAudit.isFullyAudited
                                        ? '✓ 100% HOÀN TOÀN ĐỒNG BỘ'
                                        : `⚠️ CÒN ${routeAudit.unmanagedRoutes.length} TRANG CHƯA ĐĂNG KÝ`}
                                </span>
                            </div>
                            <p className="text-xs mt-0.5 text-slate-700">
                                Hệ thống có <b>{routeAudit.totalAppRoutes}</b> trang thực tế. Đã đăng ký quản trị:{' '}
                                <b>{routeAudit.managedRoutesCount}/{routeAudit.totalAppRoutes}</b> ({routeAudit.coveragePercent}% độ phủ).
                            </p>
                        </div>
                    </div>

                    {!routeAudit.isFullyAudited && (
                        <button
                            type="button"
                            onClick={handleSyncMissingRoutes}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0 self-start md:self-auto cursor-pointer"
                            title="Tự động bổ sung các trang còn thiếu vào danh sách phân quyền"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Đồng Bộ {routeAudit.unmanagedRoutes.length} Trang Thiếu</span>
                        </button>
                    )}
                </div>

                {/* Danh sách các trang chưa được đăng ký vào Quản trị */}
                {!routeAudit.isFullyAudited && (
                    <div className="mt-3 pt-3 border-t border-amber-200/80 flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-bold text-[11px] text-amber-900 shrink-0">Các trang thiếu:</span>
                        {routeAudit.unmanagedRoutes.map(missing => (
                            <span
                                key={missing.path}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold text-[11px] shadow-2xs"
                            >
                                <span>{missing.page_name}</span>
                                <code className="text-[10px] text-amber-700 font-mono font-normal">({missing.path})</code>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Thống kê nhanh & Trạng thái đồng bộ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase">Kiểm soát trang</div>
                        <div className="text-xl font-black text-slate-800">
                            {pageList.length}/{routeAudit.totalAppRoutes} phân hệ
                        </div>
                        <div className={`text-[10px] font-bold ${routeAudit.isFullyAudited ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {routeAudit.coveragePercent}% độ phủ
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                        <Layers className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold text-emerald-600 uppercase">Đang mở hoạt động</div>
                        <div className="text-xl font-black text-emerald-700">{activeCount} trang</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Eye className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold text-amber-600 uppercase">Đang tạm ẩn / Bảo trì</div>
                        <div className="text-xl font-black text-amber-700">{disabledCount} trang</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                        <EyeOff className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase">Trạng thái dữ liệu</div>
                        <div className="text-xs font-black flex items-center gap-1.5 mt-1">
                            {isSyncedWithSupabase ? (
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đồng bộ Cloud
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsSqlModalOpen(true)}
                                    className="text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1 transition cursor-pointer"
                                    title="Nhấn để xem hướng dẫn tạo bảng trên Cloud"
                                >
                                    <Database className="w-3.5 h-3.5 text-amber-600" /> Lưu Local (Cần SQL)
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        {isSyncedWithSupabase ? <Cloud className="w-5 h-5 text-emerald-600" /> : <Database className="w-5 h-5 text-amber-600" />}
                    </div>
                </div>
            </div>

            {/* Thanh Tìm kiếm & Lọc nhóm */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                        type="text"
                        placeholder="Tìm theo tên trang hoặc URL..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => setSelectedGroup('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${selectedGroup === 'ALL'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        Tất cả ({pageList.length})
                    </button>
                    {groups.map(grp => (
                        <button
                            key={grp}
                            type="button"
                            onClick={() => setSelectedGroup(grp)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${selectedGroup === grp
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {grp}
                        </button>
                    ))}
                </div>
            </div>

            {/* BẢNG MA TRẬN PHÂN QUYỀN */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-xs text-left min-w-[900px]">
                        <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-black tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="py-3 px-3 w-12 text-center">#</th>
                                <th className="py-3 px-3 w-72">TÊN PHÂN HỆ / TRANG</th>
                                <th className="py-3 px-3 w-44">NHÓM CHỨC NĂNG</th>
                                <th className="py-3 px-3 w-32 text-center">TRẠNG THÁI</th>
                                <th className="py-3 px-3 w-28 text-center bg-indigo-50/70 text-indigo-900 border-x border-indigo-100">
                                    👑 QUẢN LÝ
                                </th>
                                <th className="py-3 px-3 w-28 text-center bg-blue-50/70 text-blue-900 border-r border-blue-100">
                                    ⭐ TRƯỞNG CA
                                </th>
                                <th className="py-3 px-3 w-28 text-center bg-slate-50 text-slate-800 border-r border-slate-200">
                                    👤 NHÂN VIÊN
                                </th>
                                <th className="py-3 px-3 text-center">TÁC VỤ NHANH</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {filteredList.map((item, idx) => {
                                const isAdminPage = item.path === '/quan-tri-he-thong';
                                const hasQuanLy = item.allowed_roles.includes('QUAN_LY');
                                const hasTruongCa = item.allowed_roles.includes('TRUONG_CA');
                                const hasNhanVien = item.allowed_roles.includes('NHAN_VIEN');

                                return (
                                    <tr
                                        key={item.page_key || idx}
                                        className={`hover:bg-indigo-50/30 transition ${!item.is_enabled ? 'bg-amber-50/40 opacity-75' : ''
                                            }`}
                                    >
                                        {/* Số thứ tự */}
                                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                                            {item.order_index ?? idx + 1}
                                        </td>

                                        {/* Tên trang & URL */}
                                        <td className="py-3 px-3">
                                            <div className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                                                <span>{item.page_name}</span>
                                                {isAdminPage && (
                                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-black">
                                                        Admin
                                                    </span>
                                                )}
                                            </div>
                                            <div className="font-mono text-[10px] text-indigo-600 mt-0.5">
                                                {item.path}
                                            </div>
                                            {item.description && (
                                                <div className="text-[11px] text-slate-400 truncate max-w-sm mt-0.5">
                                                    {item.description}
                                                </div>
                                            )}
                                        </td>

                                        {/* Nhóm */}
                                        <td className="py-3 px-3">
                                            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                {item.group_title}
                                            </span>
                                        </td>

                                        {/* Bật / Tạm ẩn */}
                                        <td className="py-3 px-3 text-center">
                                            {isAdminPage ? (
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                    ✓ Luôn Bật
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleStatus(item.path)}
                                                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition cursor-pointer flex items-center gap-1 mx-auto ${item.is_enabled
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                                        : 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
                                                        }`}
                                                >
                                                    {item.is_enabled ? (
                                                        <>
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                                            <span>Hiển thị</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                                            <span>Tạm ẩn</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </td>

                                        {/* Quyền Quản Lý */}
                                        <td className="py-3 px-3 text-center bg-indigo-50/30 border-x border-indigo-100">
                                            {isAdminPage ? (
                                                <span className="text-slate-300 text-xs font-bold">—</span>
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    checked={hasQuanLy}
                                                    onChange={() => handleToggleRole(item.path, 'QUAN_LY')}
                                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                />
                                            )}
                                        </td>

                                        {/* Quyền Trưởng Ca */}
                                        <td className="py-3 px-3 text-center bg-blue-50/30 border-r border-blue-100">
                                            {isAdminPage ? (
                                                <span className="text-slate-300 text-xs font-bold">—</span>
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    checked={hasTruongCa}
                                                    onChange={() => handleToggleRole(item.path, 'TRUONG_CA')}
                                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                />
                                            )}
                                        </td>

                                        {/* Quyền Nhân Viên */}
                                        <td className="py-3 px-3 text-center bg-slate-50/50 border-r border-slate-200">
                                            {isAdminPage ? (
                                                <span className="text-slate-300 text-xs font-bold">—</span>
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    checked={hasNhanVien}
                                                    onChange={() => handleToggleRole(item.path, 'NHAN_VIEN')}
                                                    className="w-4 h-4 text-slate-700 rounded border-slate-300 focus:ring-slate-500 cursor-pointer"
                                                />
                                            )}
                                        </td>

                                        {/* Tác vụ nhanh */}
                                        <td className="py-3 px-3 text-center">
                                            {isAdminPage ? (
                                                <span className="text-[10px] text-slate-400 font-semibold italic">
                                                    Đặc quyền Admin
                                                </span>
                                            ) : (
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleGrantAll(item.path)}
                                                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                                        title="Cấp quyền cho tất cả vai trò"
                                                    >
                                                        Cấp tất cả
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRestrictToManagers(item.path)}
                                                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition cursor-pointer"
                                                        title="Chỉ Quản lý & Admin"
                                                    >
                                                        Chỉ Quản lý
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Lệnh SQL Supabase */}
            {isSqlModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2">
                                <Code className="w-5 h-5 text-indigo-600" />
                                <h3 className="font-extrabold text-base text-slate-800">
                                    Mã Lệnh SQL Khởi Tạo Supabase Cloud
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsSqlModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Tabs chọn kịch bản SQL */}
                        <div className="flex gap-2 border-b border-slate-200 pb-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setSqlTab('PERMISSIONS')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                    sqlTab === 'PERMISSIONS'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                1. Phân Quyền Trang (system_page_permissions)
                            </button>
                            <button
                                type="button"
                                onClick={() => setSqlTab('AUTH')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                    sqlTab === 'AUTH'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                2. Tài Khoản &amp; Xét Duyệt (user_profiles)
                            </button>
                            <button
                                type="button"
                                onClick={() => setSqlTab('SESSIONS')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                    sqlTab === 'SESSIONS'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                3. Phiên Dữ Liệu Nhân Sự (employee_data_sessions)
                            </button>
                            <button
                                type="button"
                                onClick={() => setSqlTab('ALL')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                    sqlTab === 'ALL'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                ⚡ Tất Cả Bảng (Trọn Bộ)
                            </button>
                        </div>

                        <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                            <p className="font-bold text-slate-800">
                                📌 3 Bước để kích hoạt lưu cấu hình lên Supabase Cloud:
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-slate-600">
                                <li>Nhấn nút <b>"Copy Mã SQL"</b> ở bên dưới.</li>
                                <li>Truy cập vào <b>Supabase Dashboard &gt; SQL Editor</b> của dự án.</li>
                                <li>Dán mã SQL vào ô soạn thảo và nhấn nút <b>RUN</b> (màu xanh lá) để tạo bảng.</li>
                            </ol>
                        </div>

                        <div className="relative">
                            <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-xs font-mono overflow-x-auto max-h-64 leading-relaxed border border-slate-800">
                                {getActiveSql()}
                            </pre>
                            <button
                                type="button"
                                onClick={handleCopySql}
                                className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                            >
                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{isCopied ? 'Đã sao chép!' : 'Copy Mã SQL'}</span>
                            </button>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                            <span className="text-[11px] text-slate-500">
                                Sau khi chạy SQL thành công, dữ liệu tài khoản, phân quyền và thông báo sẽ được lưu đồng bộ trực tiếp lên Cloud.
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsSqlModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Xét Duyệt Tài Khoản & Siêu Thị */}
            <ApprovalModal
                isOpen={isApprovalModalOpen}
                onClose={() => setIsApprovalModalOpen(false)}
            />
        </div>
    );
}
