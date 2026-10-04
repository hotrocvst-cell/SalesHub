import { useState, type ReactNode } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionContext';
import RolePermissionModal from '../../../features/store-management/components/RolePermissionModal';
import { ShieldAlert, Wrench, ArrowLeft, KeyRound, Home } from 'lucide-react';

interface Props {
    path: string;
    children: ReactNode;
}

export default function ProtectedRoute({ path, children }: Props) {
    const navigate = useNavigate();
    const { currentUser, isAuthenticated, isActualAdmin, isInitializing } = useAuth();
    const { canAccessPage } = usePermissions();
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

    // Chờ khôi phục phiên làm việc Supabase/Local cache
    if (isInitializing) {
        return (
            <div className="flex-1 min-h-[70vh] flex items-center justify-center p-4">
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm text-slate-600 text-xs font-bold animate-pulse">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Đang kiểm tra quyền truy cập...</span>
                </div>
            </div>
        );
    }

    // 1. Kiểm tra xác thực (Yêu cầu 1: Bắt buộc phải đăng ký/đăng nhập)
    if (!isAuthenticated || !currentUser?.email || !currentUser?.id) {
        return <Navigate to="/dang-nhap" replace />;
    }

    // 2. Kiểm tra Onboarding (Yêu cầu 2: Chưa chọn siêu thị và vai trò)
    if (currentUser.status === 'PENDING_ONBOARDING') {
        return <Navigate to="/onboarding" replace />;
    }

    // 3. Kiểm tra Trạng thái Chờ xét duyệt / Bị từ chối (Yêu cầu 2 & 3)
    if (currentUser.status === 'PENDING_APPROVAL' || currentUser.status === 'REJECTED') {
        return <Navigate to="/cho-xet-duyet" replace />;
    }

    const access = canAccessPage(path);

    // 4. Nếu trang bị tắt / tạm ẩn toàn hệ thống
    if (!access.isEnabled) {
        const pageName = access.page?.page_name || 'Phân hệ này';
        return (
            <div className="flex-1 min-h-[70vh] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-amber-200/80 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-inner">
                        <Wrench className="w-8 h-8 animate-pulse" />
                    </div>

                    <div className="space-y-2">
                        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider inline-block">
                            Tạm Ẩn Bảo Trì
                        </span>
                        <h2 className="text-lg font-black text-slate-800">
                            {pageName}
                        </h2>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Trang này hiện đang được Quản trị viên (Admin) tạm dừng hoạt động để nâng cấp và bảo trì hệ thống. Vui lòng quay lại sau!
                        </p>
                    </div>

                    <div className="pt-2 flex items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => navigate('/bc-thang/tong-quan')}
                            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
                        >
                            <Home className="w-4 h-4" />
                            <span>Về Trang Chủ</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 5. Nếu người dùng không đủ quyền truy cập vai trò này
    if (!access.roleAllowed) {
        const pageName = access.page?.page_name || 'Trang này';
        const allowedRoleLabels = (access.page?.allowed_roles || [])
            .map(r => r === 'ADMIN' ? 'Admin' : r === 'QUAN_LY' ? 'Quản lý' : r === 'TRUONG_CA' ? 'Trưởng Ca' : 'Nhân viên')
            .join(', ');

        return (
            <div className="flex-1 min-h-[70vh] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-rose-200 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600 shadow-inner">
                        <ShieldAlert className="w-8 h-8" />
                    </div>

                    <div className="space-y-2">
                        <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider inline-block">
                            Truy Cập Bị Giới Hạn (403)
                        </span>
                        <h2 className="text-lg font-black text-slate-800">
                            Không Đủ Quyền Truy Cập
                        </h2>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Vai trò hiện tại của bạn là <b>{currentUser.role_title}</b> không có quyền xem <b>[{pageName}]</b>.
                        </p>
                        {allowedRoleLabels && (
                            <p className="text-[11px] text-indigo-600 font-semibold bg-indigo-50 py-1.5 px-3 rounded-xl border border-indigo-100">
                                🔒 Vai trò được phép: <b>{allowedRoleLabels}</b>
                            </p>
                        )}
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => navigate('/bc-thang/tong-quan')}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Về Trang Chủ</span>
                        </button>

                        {isActualAdmin && (
                            <button
                                type="button"
                                onClick={() => setIsRoleModalOpen(true)}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                <KeyRound className="w-4 h-4" />
                                <span>Mở Khóa / Đổi Vai Trò</span>
                            </button>
                        )}
                    </div>

                    {isActualAdmin && (
                        <RolePermissionModal
                            isOpen={isRoleModalOpen}
                            onClose={() => setIsRoleModalOpen(false)}
                        />
                    )}
                </div>
            </div>
        );
    }

    // 6. Đầy đủ quyền truy cập
    return <>{children}</>;
}
