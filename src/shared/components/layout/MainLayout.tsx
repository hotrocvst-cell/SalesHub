import { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import RolePermissionModal from '../../../features/store-management/components/RolePermissionModal';
import NotificationBell from '../../../features/auth/components/NotificationBell';
import AdminTestingBar from './AdminTestingBar';
import SidebarNav, { NAVIGATION_GROUPS } from './SidebarNav';
import {
    Store,
    ChevronRight,
    PanelLeftClose,
    PanelLeftOpen,
    Menu,
    X,
    LogOut,
    LogIn,
    FlaskConical,
    RotateCcw
} from 'lucide-react';

export default function MainLayout() {
    const navigate = useNavigate();
    const {
        currentUser,
        isActualAdmin,
        isImpersonating,
        resetImpersonation,
        switchRole,
        isAuthenticated,
        isInitializing,
        logout
    } = useAuth();
    const location = useLocation();

    // 1. Kiểm tra trạng thái khởi tạo
    if (isInitializing) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-600 font-bold text-xs gap-3">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Đang tải hệ thống Sales Hub...</span>
            </div>
        );
    }

    // 2. Chặn toàn bộ truy cập nếu chưa đăng nhập (ngoại trừ trang chủ mở cho mọi người)
    const isPublicHome = location.pathname === '/' || location.pathname === '/trang-chu';
    if ((!isAuthenticated || !currentUser?.email || !currentUser?.id) && !isPublicHome) {
        return <Navigate to="/dang-nhap" replace />;
    }

    // Mặc định là Open (false = không thu gọn)
    const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('saleshub_sidebar_collapsed');
            return saved === 'true'; // false nghĩa là Open, true là Collapsed
        } catch {
            return false;
        }
    });

    // Trạng thái mở menu trên Mobile (drawer)
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

    // Trạng thái bật/tắt thanh công cụ Testing Bar dành cho Admin
    const [isTestingBarOpen, setIsTestingBarOpen] = useState<boolean>(() => {
        if (!isActualAdmin) return false;
        try {
            const saved = localStorage.getItem('saleshub_admin_testing_bar_open');
            if (saved !== null) return saved === 'true';
        } catch {
            // ignore
        }
        return isImpersonating; // Mặc định mở nếu đang có cấu hình mô phỏng
    });

    // Tự động mở Testing Bar nếu Admin kích hoạt mô phỏng
    useEffect(() => {
        if (isImpersonating) {
            setIsTestingBarOpen(true);
        }
    }, [isImpersonating]);

    // Lưu tùy chọn mở thanh testing vào localStorage
    useEffect(() => {
        try {
            localStorage.setItem('saleshub_admin_testing_bar_open', String(isTestingBarOpen));
        } catch {
            // ignore
        }
    }, [isTestingBarOpen]);

    // Lưu tùy chọn thu gọn của người dùng vào localStorage
    useEffect(() => {
        try {
            localStorage.setItem('saleshub_sidebar_collapsed', String(isCollapsed));
        } catch (e) {
            console.warn('Lỗi lưu trạng thái sidebar:', e);
        }
    }, [isCollapsed]);

    // Đóng drawer mobile khi đổi trang
    useEffect(() => {
        setIsMobileOpen(false);
    }, [location.pathname]);

    // Tiêu đề trang động theo URL
    const getPageTitle = () => {
        if (location.pathname === '/' || location.pathname === '/trang-chu') {
            return 'Trang Chủ';
        }
        for (const group of NAVIGATION_GROUPS) {
            // 1. Ưu tiên khớp chính xác trước
            const exact = group.items.find(item => item.path === location.pathname);
            if (exact) return exact.name;

            // 2. Khớp sub-route hợp lệ với dấu '/'
            const found = group.items.find(item => {
                if (item.path === '/') return false;
                return location.pathname.startsWith(item.path + '/');
            });
            if (found) return found.name;
        }
        return 'Sales Hub System';
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col antialiased text-slate-800">
            {/* ========================================================= */}
            {/* 1. TOPBAR (HEADER CHÍNH)                                  */}
            {/* ========================================================= */}
            <header className="h-14 bg-white border-b border-slate-200 sticky top-0 z-40 flex items-center justify-between px-3 sm:px-5 shadow-2xs">
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Nút bật tắt Drawer trên Mobile */}
                    <button
                        type="button"
                        onClick={() => setIsMobileOpen(!isMobileOpen)}
                        className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                        aria-label="Toggle mobile menu"
                    >
                        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>

                    {/* Nút Thu gọn / Mở rộng Sidebar trên Desktop */}
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden lg:flex p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                        title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
                        aria-label={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
                    >
                        {isCollapsed ? (
                            <PanelLeftOpen className="w-5 h-5 text-blue-600" />
                        ) : (
                            <PanelLeftClose className="w-5 h-5 text-slate-600" />
                        )}
                    </button>

                    {/* Logo Brand */}
                    <Link to="/" className="flex items-center gap-2 pl-1 sm:pl-0 hover:opacity-90 transition group cursor-pointer" title="Trở về Trang Chủ">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 group-hover:bg-blue-700 flex items-center justify-center text-white shadow-xs font-black transition">
                            <Store className="w-4 h-4" />
                        </div>
                        <span className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg">
                            SALES<span className="text-blue-600">HUB</span>
                        </span>
                    </Link>

                    {/* Breadcrumb Tên phân hệ */}
                    <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200 text-xs font-bold text-slate-500">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-800 uppercase tracking-wide truncate max-w-xs">{getPageTitle()}</span>
                    </div>
                </div>

                {/* Phía bên phải: Badge Siêu thị, Badge Hệ thống, Chuông Thông Báo & Badge Người Dùng */}
                <div className="flex items-center gap-2">
                    {isAuthenticated && currentUser?.email && currentUser?.id ? (
                        <>
                            {/* Badge Siêu thị hiện tại */}
                            {currentUser.store_name && (
                                <div className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold max-w-xs truncate" title={`Siêu thị hiện tại: ${currentUser.store_name}`}>
                                    <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span className="truncate">{currentUser.store_name}</span>
                                </div>
                            )}

                            {/* Badge Hệ thống */}
                            <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                                <span>Trực tuyến</span>
                            </div>

                            {/* Chuông Thông Báo & Xét Duyệt */}
                            <NotificationBell />

                            {/* CÔNG CỤ KIỂM THỬ PHÂN QUYỀN (CHỈ DÀNH CHO ADMIN) */}
                            {isActualAdmin && (
                                <div className="flex items-center gap-1.5">
                                    {isImpersonating ? (
                                        <>
                                            {/* Badge nổi bật khi đang giả lập kiểm thử */}
                                            <button
                                                type="button"
                                                onClick={() => setIsTestingBarOpen(prev => !prev)}
                                                className="px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition cursor-pointer border border-purple-400/40"
                                                title="Đang trong chế độ kiểm thử phân quyền. Bấm để mở / thu gọn thanh công cụ testing."
                                            >
                                                <FlaskConical className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                                                <span className="hidden sm:inline">Test:</span>
                                                <span className="text-amber-300 uppercase">{currentUser.role}</span>
                                                {currentUser.store_name && (
                                                    <span className="hidden md:inline text-purple-200 truncate max-w-[100px]">
                                                        • {currentUser.store_name}
                                                    </span>
                                                )}
                                                {currentUser.employee_id && (
                                                    <span className="hidden lg:inline text-emerald-300">
                                                        • #{currentUser.employee_id}
                                                    </span>
                                                )}
                                            </button>

                                            {/* Nút 1-click Thoát Chế Độ Mô Phỏng Về Admin Gốc */}
                                            <button
                                                type="button"
                                                onClick={() => resetImpersonation()}
                                                className="px-2 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs transition cursor-pointer"
                                                title="Khôi phục toàn bộ thiết lập về tài khoản Admin tối cao mặc định"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                                <span className="hidden sm:inline">Về Admin</span>
                                            </button>
                                        </>
                                    ) : (
                                        /* Nút bật thanh testing khi chưa mô phỏng */
                                        <button
                                            type="button"
                                            onClick={() => setIsTestingBarOpen(prev => !prev)}
                                            className={`px-2.5 py-1 rounded-full border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                                isTestingBarOpen
                                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                                    : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                            }`}
                                            title="Bật/Tắt thanh công cụ kiểm thử phân quyền theo Siêu thị & Nhân viên"
                                        >
                                            <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
                                            <span className="hidden sm:inline">Giả Lập Testing</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Badge Vai trò Người dùng & Nút Phân Quyền (Dành riêng cho Admin) */}
                            {isActualAdmin ? (
                                <button
                                    type="button"
                                    onClick={() => setIsRoleModalOpen(true)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold transition shadow-2xs cursor-pointer ${
                                        currentUser.role === 'ADMIN'
                                            ? 'bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100'
                                            : currentUser.role === 'QUAN_LY'
                                            ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                                            : currentUser.role === 'TRUONG_CA'
                                            ? 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100'
                                            : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                                    }`}
                                    title="Admin: Bấm để mở bảng phân quyền chi tiết hoặc nhập PIN mở khóa"
                                >
                                    <span className="text-sm">
                                        {currentUser.role === 'ADMIN' ? '🛡️' : currentUser.role === 'QUAN_LY' ? '👑' : currentUser.role === 'TRUONG_CA' ? '⭐' : '👤'}
                                    </span>
                                    <div className="flex flex-col text-left">
                                        <span className="text-[10px] leading-tight opacity-75 font-semibold hidden sm:inline">
                                            {currentUser.role_title}
                                        </span>
                                        <span className="text-xs font-black truncate max-w-[120px]">
                                            {currentUser.full_name}
                                        </span>
                                    </div>
                                </button>
                            ) : (
                                /* Người dùng thông thường: Chỉ hiển thị tĩnh, KHÔNG thể click đổi vai trò */
                                <div
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold shadow-2xs select-none ${
                                        currentUser.role === 'QUAN_LY'
                                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                                            : currentUser.role === 'TRUONG_CA'
                                            ? 'bg-blue-50 border-blue-300 text-blue-900'
                                            : 'bg-slate-100 border-slate-300 text-slate-700'
                                    }`}
                                    title={`${currentUser.role_title}: ${currentUser.full_name}`}
                                >
                                    <span className="text-sm">
                                        {currentUser.role === 'QUAN_LY' ? '👑' : currentUser.role === 'TRUONG_CA' ? '⭐' : '👤'}
                                    </span>
                                    <div className="flex flex-col text-left">
                                        <span className="text-[10px] leading-tight opacity-75 font-semibold hidden sm:inline">
                                            {currentUser.role_title}
                                        </span>
                                        <span className="text-xs font-black truncate max-w-[120px]">
                                            {currentUser.full_name}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Nút Đăng xuất */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.confirm('Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?')) {
                                        logout();
                                        navigate('/dang-nhap');
                                    }
                                }}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition border border-transparent hover:border-rose-200 cursor-pointer"
                                title="Đăng xuất khỏi hệ thống"
                                aria-label="Đăng xuất"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link
                                to="/dang-nhap"
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                            >
                                <LogIn className="w-3.5 h-3.5" />
                                <span>Đăng nhập</span>
                            </Link>
                            <Link
                                to="/dang-ky"
                                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                            >
                                <span>Đăng ký</span>
                            </Link>
                        </div>
                    )}
                </div>
            </header>

            {/* THANH CÔNG CỤ KIỂM THỬ PHÂN QUYỀN HỆ THỐNG DÀNH RIÊNG CHO ADMIN */}
            {isActualAdmin && (
                <AdminTestingBar
                    isOpen={isTestingBarOpen}
                    onClose={() => setIsTestingBarOpen(false)}
                />
            )}

            {/* Modal Phân quyền chỉ khả dụng với Admin */}
            {isActualAdmin && (
                <RolePermissionModal
                    isOpen={isRoleModalOpen}
                    onClose={() => setIsRoleModalOpen(false)}
                />
            )}

            {/* ========================================================= */}
            {/* 2. KHUNG NỘI DUNG CHÍNH (SIDEBAR + MAIN CONTENT)          */}
            {/* ========================================================= */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Lớp phủ mờ nền khi mở Sidebar trên Mobile */}
                {isMobileOpen && (
                    <div
                        onClick={() => setIsMobileOpen(false)}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-40 lg:hidden animate-in fade-in duration-150"
                    />
                )}

                {/* SIDEBAR TRÊN MOBILE (DRAWER) */}
                <aside
                    className={`
                        fixed top-14 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between
                        transition-transform duration-300 ease-in-out lg:hidden
                        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
                    `}
                >
                    <SidebarNav
                        isCollapsed={false}
                        onToggleCollapse={() => setIsMobileOpen(false)}
                        onItemClick={() => setIsMobileOpen(false)}
                    />
                </aside>

                {/* SIDEBAR TRÊN DESKTOP (Có thể Thu gọn / Mở rộng, mặc định Open) */}
                <aside
                    className={`
                        hidden lg:flex flex-col justify-between bg-white border-r border-slate-200 shrink-0
                        transition-all duration-300 ease-in-out
                        ${isCollapsed ? 'w-16' : 'w-64'}
                    `}
                >
                    <SidebarNav
                        isCollapsed={isCollapsed}
                        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
                        onItemClick={() => {}}
                    />
                </aside>

                {/* MAIN OUTLET: Nội dung các trang */}
                <main className="flex-1 overflow-y-auto p-2 sm:p-4 min-w-0 transition-all duration-300">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}