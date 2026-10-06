import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../../core/lib/supabase';
import {
    fetchSystemPagePermissions,
    saveSystemPagePermissions,
    checkSupabasePermissionsTable,
    DEFAULT_PAGE_PERMISSIONS,
    type SystemPagePermission
} from '../../core/lib/permissions';

interface PageAccessResult {
    allowed: boolean;
    isEnabled: boolean;
    roleAllowed: boolean;
    page?: SystemPagePermission;
}

interface PermissionContextType {
    permissions: SystemPagePermission[];
    loading: boolean;
    isSyncedWithSupabase: boolean;
    canAccessPage: (path: string) => PageAccessResult;
    updatePermissions: (newPerms: SystemPagePermission[]) => Promise<{ success: boolean; fromSupabase: boolean; error?: string }>;
    resetToDefault: () => Promise<{ success: boolean; fromSupabase: boolean }>;
    refreshPermissions: () => Promise<void>;
    checkCloudConnection: () => Promise<{ exists: boolean; count: number; error?: string }>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: ReactNode }) {
    const { currentUser } = useAuth();
    const [permissions, setPermissions] = useState<SystemPagePermission[]>(DEFAULT_PAGE_PERMISSIONS);
    const [loading, setLoading] = useState<boolean>(true);
    const [isSyncedWithSupabase, setIsSyncedWithSupabase] = useState<boolean>(false);

    const loadPermissions = async () => {
        setLoading(true);
        const res = await fetchSystemPagePermissions();
        if (res.success && res.data) {
            setPermissions(res.data);
            setIsSyncedWithSupabase(res.fromSupabase);
        }
        setLoading(false);
    };

    const checkCloudConnection = async () => {
        const res = await checkSupabasePermissionsTable();
        setIsSyncedWithSupabase(res.exists);
        return res;
    };

    useEffect(() => {
        loadPermissions();

        // Kích hoạt Realtime subscription để đồng bộ tự động giữa các máy khi Admin thay đổi quyền
        const channel = supabase
            .channel('system_page_permissions_realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'system_page_permissions'
                },
                () => {
                    loadPermissions();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const canAccessPage = (path: string): PageAccessResult => {
        // Trang chủ luôn mở khả dụng cho tất cả user
        if (path === '/' || path === '/trang-chu') {
            return { allowed: true, isEnabled: true, roleAllowed: true, page: permissions.find(p => p.path === '/') };
        }

        // 1. Ưu tiên TUYỆT ĐỐI tìm trang khớp chính xác path trước
        let page = permissions.find(p => p.path === path);

        // 2. Nếu không tìm thấy khớp chính xác, chỉ khớp tiền tố nếu là sub-path hợp lệ (phân tách bởi '/')
        // Ví dụ: '/cap-nhat/abc' sẽ khớp với '/cap-nhat',
        // nhưng '/cap-nhat-luy-ke-nhan-vien' TUYỆT ĐỐI KHÔNG khớp với '/cap-nhat' vì không có dấu '/' phân tách!
        if (!page) {
            page = permissions.find(p => p.path !== '/' && path.startsWith(p.path + '/'));
        }

        // 3. Hỗ trợ route cha chuyển hướng đến route con trong permissions (ví dụ: '/bc-thang' -> '/bc-thang/tong-quan')
        if (!page) {
            page = permissions.find(p => p.path !== '/' && p.path.startsWith(path + '/'));
        }

        // Trang Quản trị hệ thống: ĐẶC BIỆT CHỈ DÀNH CHO ADMIN
        if (path === '/quan-tri-he-thong' || (page && page.path === '/quan-tri-he-thong')) {
            const isAdmin = currentUser?.role === 'ADMIN';
            return {
                allowed: isAdmin,
                isEnabled: true,
                roleAllowed: isAdmin,
                page
            };
        }

        // Trang Quản lý tài khoản: Phân quyền theo cấu hình (mặc định chỉ dành cho Admin)
        if (path === '/quan-ly-tai-khoan' || (page && page.path === '/quan-ly-tai-khoan')) {
            const isEnabled = page ? Boolean(page.is_enabled) : true;
            const allowedRoles = page?.allowed_roles || ['ADMIN'];
            const roleAllowed = Boolean(currentUser?.role === 'ADMIN' || (currentUser?.role && allowedRoles.includes(currentUser.role)));
            return {
                allowed: isEnabled && roleAllowed,
                isEnabled,
                roleAllowed,
                page
            };
        }

        if (!page) {
            // Route không nằm trong danh mục (ví dụ /bc-thang chuyển hướng sang /bc-thang/tong-quan)
            return { allowed: true, isEnabled: true, roleAllowed: true };
        }

        const isEnabled = Boolean(page.is_enabled);
        // ADMIN luôn có quyền mọi trang nếu trang đang Bật
        const roleAllowed = Boolean(currentUser?.role === 'ADMIN' || (page.allowed_roles && currentUser?.role && page.allowed_roles.includes(currentUser.role)));
        const allowed = isEnabled && roleAllowed;

        return { allowed, isEnabled, roleAllowed, page };
    };

    const updatePermissions = async (newPerms: SystemPagePermission[]) => {
        setPermissions(newPerms);
        const res = await saveSystemPagePermissions(newPerms);
        setIsSyncedWithSupabase(res.fromSupabase);
        return res;
    };

    const resetToDefault = async () => {
        setPermissions(DEFAULT_PAGE_PERMISSIONS);
        const res = await saveSystemPagePermissions(DEFAULT_PAGE_PERMISSIONS);
        setIsSyncedWithSupabase(res.fromSupabase);
        return res;
    };

    return (
        <PermissionContext.Provider
            value={{
                permissions,
                loading,
                isSyncedWithSupabase,
                canAccessPage,
                updatePermissions,
                resetToDefault,
                refreshPermissions: loadPermissions,
                checkCloudConnection
            }}
        >
            {children}
        </PermissionContext.Provider>
    );
}

export function usePermissions() {
    const context = useContext(PermissionContext);
    if (!context) {
        throw new Error('usePermissions must be used within a PermissionProvider');
    }
    return context;
}
