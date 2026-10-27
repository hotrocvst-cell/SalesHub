import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../../core/lib/supabase';
import { isStoreMatch } from '../../core/lib/formatters';
import {
    fetchSystemPagePermissions,
    saveSystemPagePermissions,
    checkSupabasePermissionsTable,
    auditRouteCoverage,
    syncMissingPagesToPermissions,
    DEFAULT_PAGE_PERMISSIONS,
    isGuestPathRestricted,
    type SystemPagePermission,
    type RouteAuditReport
} from '../../core/lib/permissions';

export interface PageAccessResult {
    allowed: boolean;
    isEnabled: boolean;
    roleAllowed: boolean;
    storeAllowed: boolean;
    page?: SystemPagePermission;
}

interface PermissionContextType {
    permissions: SystemPagePermission[];
    loading: boolean;
    isSyncedWithSupabase: boolean;
    hasBadgeColumnsOnCloud: boolean;
    routeAudit: RouteAuditReport;
    canAccessPage: (path: string) => PageAccessResult;
    updatePermissions: (newPerms: SystemPagePermission[]) => Promise<{ success: boolean; fromSupabase: boolean; error?: string }>;
    syncMissingPages: () => Promise<{ success: boolean; fromSupabase: boolean; error?: string }>;
    resetToDefault: () => Promise<{ success: boolean; fromSupabase: boolean }>;
    refreshPermissions: () => Promise<void>;
    checkCloudConnection: () => Promise<{ exists: boolean; hasBadgeColumns: boolean; count: number; error?: string }>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: ReactNode }) {
    const { currentUser } = useAuth();
    const [permissions, setPermissions] = useState<SystemPagePermission[]>(DEFAULT_PAGE_PERMISSIONS);
    const [loading, setLoading] = useState<boolean>(true);
    const [isSyncedWithSupabase, setIsSyncedWithSupabase] = useState<boolean>(false);
    const [hasBadgeColumnsOnCloud, setHasBadgeColumnsOnCloud] = useState<boolean>(true);

    const loadPermissions = async () => {
        setLoading(true);
        const res = await fetchSystemPagePermissions();
        if (res.success && res.data) {
            setPermissions(res.data);
            setIsSyncedWithSupabase(res.fromSupabase);
        }
        const cloudCheck = await checkSupabasePermissionsTable();
        setHasBadgeColumnsOnCloud(cloudCheck.hasBadgeColumns);
        setLoading(false);
    };

    const checkCloudConnection = async () => {
        const res = await checkSupabasePermissionsTable();
        setIsSyncedWithSupabase(res.exists);
        setHasBadgeColumnsOnCloud(res.hasBadgeColumns);
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
            return {
                allowed: true,
                isEnabled: true,
                roleAllowed: true,
                storeAllowed: true,
                page: permissions.find(p => p.path === '/')
            };
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

        const isGuest = Boolean(currentUser?.is_guest);
        const isAdmin = !isGuest && currentUser?.role === 'ADMIN';

        // CHỐT CHẶN BẢO VỆ CHẾ ĐỘ TRẢI NGHIỆM (GUEST / TRIAL SANDBOX):
        // 1. Tuyệt đối khóa toàn bộ các phân hệ cấu hình nghiệp vụ, nạp số liệu & quản trị
        if (isGuest && isGuestPathRestricted(path)) {
            return {
                allowed: false,
                isEnabled: true,
                roleAllowed: false,
                storeAllowed: false,
                page
            };
        }

        // 2. Phân quyền linh hoạt cho tài khoản trải nghiệm dựa trên cờ allow_guest của từng trang
        if (isGuest) {
            if (!page) {
                // Hỗ trợ route phụ / redirect
                return { allowed: true, isEnabled: true, roleAllowed: true, storeAllowed: true };
            }
            const isEnabled = Boolean(page.is_enabled);
            const guestAllowed = Boolean(page.allow_guest);
            return {
                allowed: isEnabled && guestAllowed,
                isEnabled,
                roleAllowed: guestAllowed,
                storeAllowed: true,
                page
            };
        }

        // Trang Quản trị hệ thống: ĐẶC BIỆT CHỈ DÀNH CHO ADMIN
        if (path === '/quan-tri-he-thong' || (page && page.path === '/quan-tri-he-thong')) {
            return {
                allowed: isAdmin,
                isEnabled: true,
                roleAllowed: isAdmin,
                storeAllowed: true,
                page
            };
        }

        if (!page) {
            // Route không nằm trong danh mục (ví dụ /bc-thang chuyển hướng sang /bc-thang/tong-quan)
            return { allowed: true, isEnabled: true, roleAllowed: true, storeAllowed: true };
        }

        const isEnabled = Boolean(page.is_enabled);
        
        // 1. Phân quyền theo vai trò (Role-based): Admin luôn được phép, các vai trò khác theo allowed_roles
        const roleAllowed = Boolean(isAdmin || (page.allowed_roles && currentUser?.role && page.allowed_roles.includes(currentUser.role)));

        // 2. Phân quyền theo siêu thị (Store-based / Branch feature subscription):
        // Nếu không cấu hình hoặc chứa 'ALL' -> Mở cho tất cả siêu thị.
        // Ngược lại -> Chỉ mở cho các siêu thị trong danh sách cấu hình.
        let storeAllowed = true;
        if (!isAdmin && page.allowed_stores && page.allowed_stores.length > 0 && !page.allowed_stores.includes('ALL')) {
            const userStores = [
                currentUser?.store_name,
                ...(currentUser?.accessible_stores || [])
            ].filter(Boolean) as string[];

            storeAllowed = userStores.length > 0 && userStores.some(uStore =>
                page.allowed_stores!.some(allowedStore => isStoreMatch(uStore, allowedStore))
            );
        }

        const allowed = isEnabled && roleAllowed && storeAllowed;

        return { allowed, isEnabled, roleAllowed, storeAllowed, page };
    };

    const routeAudit = auditRouteCoverage(permissions);

    const updatePermissions = async (newPerms: SystemPagePermission[]) => {
        setPermissions(newPerms);
        const res = await saveSystemPagePermissions(newPerms);
        setIsSyncedWithSupabase(res.fromSupabase);
        return res;
    };

    const syncMissingPages = async () => {
        const full = syncMissingPagesToPermissions(permissions);
        setPermissions(full);
        const res = await saveSystemPagePermissions(full);
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
                hasBadgeColumnsOnCloud,
                routeAudit,
                canAccessPage,
                updatePermissions,
                syncMissingPages,
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
