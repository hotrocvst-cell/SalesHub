import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionContext';
import { useLocation } from 'react-router-dom';

/**
 * Hook kiểm tra quyền Xuất file Excel theo người dùng và trang cụ thể.
 * Quy tắc:
 * 1. Mặc định là KHÓA và ẨN HIỂN THỊ (canExportExcel = false).
 * 2. Admin luôn có quyền xuất Excel (canExportExcel = true).
 * 3. Các vai trò khác chỉ có quyền khi trang được mở khóa (allow_excel_export === true)
 *    và vai trò của người dùng nằm trong danh sách được phép (allowed_excel_roles).
 */
export function useExcelExportPermission(customPath?: string): {
    canExportExcel: boolean;
    isAdmin: boolean;
    reason?: string;
} {
    const { currentUser, isAdmin } = useAuth();
    const location = useLocation();
    let permissionsContext: any = null;

    try {
        permissionsContext = usePermissions();
    } catch {
        // Fallback nếu gọi ngoài PermissionProvider
        permissionsContext = null;
    }

    if (isAdmin) {
        return { canExportExcel: true, isAdmin: true };
    }

    if (!currentUser) {
        return { canExportExcel: false, isAdmin: false, reason: 'Chưa đăng nhập' };
    }

    const currentPath = customPath || location.pathname;
    const permissions = permissionsContext?.permissions || [];

    // Tìm định nghĩa trang trong hệ thống phân quyền
    const page = permissions.find((p: any) => p.path === currentPath)
        || permissions.find((p: any) => p.path !== '/' && currentPath.startsWith(p.path + '/'))
        || permissions.find((p: any) => p.path !== '/' && p.path.startsWith(currentPath + '/'));

    if (!page) {
        // Mặc định không tìm thấy trang hoặc trang chưa cấu hình -> Khóa & Ẩn
        return { canExportExcel: false, isAdmin: false, reason: 'Chức năng xuất Excel bị khóa mặc định' };
    }

    const allowExcel = Boolean(page.allow_excel_export);
    const allowedRoles = Array.isArray(page.allowed_excel_roles) ? page.allowed_excel_roles : [];
    const isRoleAuthorized = allowedRoles.includes(currentUser.role);

    if (allowExcel && isRoleAuthorized) {
        return { canExportExcel: true, isAdmin: false };
    }

    return {
        canExportExcel: false,
        isAdmin: false,
        reason: 'Bạn không có quyền xuất file Excel trên trang này'
    };
}
