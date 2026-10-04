import { useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionContext';
import RolePermissionModal from '../../../features/store-management/components/RolePermissionModal';
import UnauthorizedAccessView from './UnauthorizedAccessView';

interface Props {
    path: string;
    children: ReactNode;
}

export default function ProtectedRoute({ path, children }: Props) {
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
            <UnauthorizedAccessView
                title="Hệ Thống Tạm Ẩn Bảo Trì"
                badgeText="Bảo Trì Hệ Thống"
                pageName={pageName}
                path={path}
                message={`Phân hệ [${pageName}] hiện đang được Quản trị viên (Admin) tạm dừng hoạt động để nâng cấp và bảo trì hệ thống. Vui lòng quay lại sau!`}
                countdownSeconds={5}
                homePath="/"
            />
        );
    }

    // 5. Nếu người dùng không đủ quyền truy cập vai trò này
    if (!access.roleAllowed) {
        const pageName = access.page?.page_name || 'Trang này';
        const allowedRoleLabels = (access.page?.allowed_roles || [])
            .map(r => r === 'ADMIN' ? 'Admin' : r === 'QUAN_LY' ? 'Quản lý' : r === 'TRUONG_CA' ? 'Trưởng Ca' : 'Nhân viên')
            .join(', ');

        return (
            <>
                <UnauthorizedAccessView
                    title="Chưa Được Phân Quyền Truy Cập"
                    badgeText="Truy Cập Bị Giới Hạn (403)"
                    pageName={pageName}
                    path={path}
                    allowedRoleLabels={allowedRoleLabels}
                    countdownSeconds={5}
                    homePath="/"
                    showAdminUnlock={isActualAdmin}
                    onOpenRoleModal={() => setIsRoleModalOpen(true)}
                />

                {isActualAdmin && (
                    <RolePermissionModal
                        isOpen={isRoleModalOpen}
                        onClose={() => setIsRoleModalOpen(false)}
                    />
                )}
            </>
        );
    }

    // 6. Đầy đủ quyền truy cập
    return <>{children}</>;
}
