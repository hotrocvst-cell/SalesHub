import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { type EmployeeItem, parseEmployeeRoleAndDept } from '../../core/lib/storage';
import { supabase } from '../../core/lib/supabase';
import { isStoreMatch } from '../../core/lib/formatters';
import {
    type UserProfile,
    type UserRole,
    type UserAccountStatus,
    ROLE_LABELS,
    getUserProfile,
    createUserProfile,
    submitOnboardingRequest
} from '../../core/lib/authService';

export type { UserRole, UserAccountStatus };

export interface ImpersonationState {
    isActive: boolean;
    role?: UserRole;
    store_name?: string;
    employee_id?: string;
    employee_name?: string;
}

export interface CurrentUser {
    id?: string;
    auth_user_id?: string;
    email?: string;
    employee_id: string;
    full_name: string;
    store_name: string;
    accessible_stores?: string[];
    role: UserRole;
    actual_role?: UserRole;
    role_title: string;
    status: UserAccountStatus;
    phone?: string;
    rejection_reason?: string;
}

interface AuthContextType {
    currentUser: CurrentUser;
    isAuthenticated: boolean;
    isLoading: boolean;
    isInitializing: boolean;
    canConfigure: boolean;
    isAdmin: boolean;
    isActualAdmin: boolean;
    isManager: boolean;
    isShiftLeader: boolean;
    accessibleStores: string[];
    canAccessStore: (storeName: string) => boolean;
    // Kiểm thử / Mô phỏng dành riêng cho Admin
    isImpersonating: boolean;
    impersonationState: ImpersonationState;
    setImpersonation: (updates: Partial<ImpersonationState>) => void;
    setImpersonationRole: (role: UserRole) => void;
    setImpersonationStore: (storeName?: string) => void;
    setImpersonationEmployee: (employee?: { employee_id: string; full_name: string; store_name?: string; role?: UserRole }) => void;
    resetImpersonation: () => void;
    login: (emailOrEmployeeId: string, password?: string) => Promise<{ success: boolean; error?: string }>;
    register: (params: {
        email: string;
        password?: string;
        full_name: string;
        phone?: string;
        employee_id?: string;
        department?: string;
        role?: UserRole;
        store_name?: string;
        is_new_store?: boolean;
        new_store_code?: string;
        new_store_address?: string;
    }) => Promise<{ success: boolean; error?: string }>;
    loginAsDemoUser: (user: UserProfile) => void;
    loginAsEmployee: (employee: EmployeeItem, roleOverride?: UserRole) => void;
    switchRole: (role: UserRole, storeName?: string) => void;
    verifyPasscode: (pin: string) => boolean;
    refreshProfile: () => Promise<void>;
    updateLocalProfileStatus: (status: UserAccountStatus, updates?: Partial<CurrentUser>) => void;
    logout: () => void;
}

const STORAGE_ACTIVE_USER_KEY = 'saleshub_active_user_v2';
const STORAGE_LEGACY_KEY = 'saleshub_active_user_v1';
const STORAGE_IMPERSONATION_KEY = 'saleshub_admin_impersonation_v2';

// Trạng thái người dùng ẩn danh / Chưa xác thực
export const ANONYMOUS_USER: CurrentUser = {
    id: '',
    email: '',
    employee_id: '',
    full_name: 'Khách',
    store_name: '',
    role: 'NHAN_VIEN',
    actual_role: 'NHAN_VIEN',
    role_title: 'Chưa đăng nhập',
    status: 'PENDING_ONBOARDING'
};

function profileToCurrentUser(profile: UserProfile, authUserId?: string, actualRole?: UserRole): CurrentUser {
    const accessible = profile.accessible_stores && profile.accessible_stores.length > 0
        ? profile.accessible_stores
        : (profile.store_name ? [profile.store_name] : []);
    return {
        id: profile.id,
        auth_user_id: authUserId || profile.auth_user_id,
        email: profile.email,
        employee_id: profile.employee_id,
        full_name: profile.full_name,
        store_name: profile.store_name,
        accessible_stores: accessible,
        role: profile.role,
        actual_role: actualRole || profile.role,
        role_title: profile.role_title,
        status: profile.status,
        phone: profile.phone,
        rejection_reason: profile.rejection_reason
    };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [rawUser, setRawUser] = useState<CurrentUser>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_ACTIVE_USER_KEY) || localStorage.getItem(STORAGE_LEGACY_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Phải có cả id và email hợp lệ thì mới coi là đã đăng nhập trước đó
                if (parsed && parsed.id && parsed.email) {
                    return {
                        ...parsed,
                        accessible_stores: parsed.accessible_stores || (parsed.store_name ? [parsed.store_name] : []),
                        actual_role: parsed.actual_role || parsed.role || 'NHAN_VIEN',
                        status: parsed.status || 'ACTIVE'
                    };
                }
            }
        } catch (e) {
            console.warn('Lỗi đọc Auth từ localStorage:', e);
        }
        return ANONYMOUS_USER;
    });

    // Trạng thái mô phỏng dành riêng cho Admin để kiểm thử hệ thống
    const [impersonationState, setImpersonationState] = useState<ImpersonationState>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_IMPERSONATION_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Lỗi đọc Impersonation từ localStorage:', e);
        }
        return { isActive: false };
    });

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isInitializing, setIsInitializing] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_ACTIVE_USER_KEY) || localStorage.getItem(STORAGE_LEGACY_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.id && parsed.email) {
                    return false;
                }
            }
        } catch {
            // ignore
        }
        return true;
    });

    // Quyền Admin thực tế (dựa trên tài khoản đăng nhập gốc)
    const isAuthenticated = Boolean(rawUser && rawUser.email && rawUser.id);
    const isActualAdmin = isAuthenticated && (
        (rawUser.actual_role === 'ADMIN') ||
        (rawUser.role === 'ADMIN') ||
        (rawUser.email === 'admin@saleshub.vn')
    );
    const isImpersonating = Boolean(isActualAdmin && impersonationState.isActive);

    // Tính toán currentUser hiệu lực (đã áp dụng mô phỏng nếu Admin đang testing)
    const currentUser = useMemo<CurrentUser>(() => {
        if (!isActualAdmin || !impersonationState.isActive) {
            return rawUser;
        }

        const effectiveRole = impersonationState.role || rawUser.role || 'ADMIN';
        const effectiveStore = impersonationState.store_name !== undefined ? impersonationState.store_name : rawUser.store_name;
        const effectiveEmpId = impersonationState.employee_id !== undefined ? impersonationState.employee_id : rawUser.employee_id;
        const effectiveName = impersonationState.employee_name || rawUser.full_name;

        let effectiveAccessible: string[] = [];
        if (effectiveRole === 'ADMIN') {
            effectiveAccessible = ['all'];
        } else if (effectiveRole === 'NHAN_VIEN') {
            effectiveAccessible = effectiveStore ? [effectiveStore] : [];
        } else {
            // Quản lý hoặc Trưởng ca
            effectiveAccessible = effectiveStore ? [effectiveStore] : (rawUser.accessible_stores || []);
        }

        return {
            ...rawUser,
            role: effectiveRole,
            actual_role: rawUser.actual_role || rawUser.role || 'ADMIN',
            role_title: ROLE_LABELS[effectiveRole] || effectiveRole,
            store_name: effectiveStore,
            employee_id: effectiveEmpId,
            full_name: effectiveName,
            accessible_stores: effectiveAccessible
        };
    }, [rawUser, isActualAdmin, impersonationState]);

    // Danh sách siêu thị được phép xem của tài khoản hiện tại
    const accessibleStores = useMemo<string[]>(() => {
        if (!currentUser || !currentUser.id) return [];
        if (currentUser.role === 'ADMIN') return ['all'];
        if (currentUser.accessible_stores && currentUser.accessible_stores.length > 0) {
            return currentUser.accessible_stores;
        }
        return currentUser.store_name ? [currentUser.store_name] : [];
    }, [currentUser]);

    // Kiểm tra xem user hiện tại có quyền xem một siêu thị cụ thể không
    const canAccessStore = useCallback((storeName: string): boolean => {
        if (!currentUser) return false;
        if (currentUser.role === 'ADMIN') return true;
        if (currentUser.role === 'NHAN_VIEN') {
            if (storeName === 'all') return false;
            return currentUser.store_name ? isStoreMatch(currentUser.store_name, storeName) : false;
        }
        // Quản lý hoặc Trưởng ca
        if (storeName === 'all') return true;
        const myStores = currentUser.accessible_stores && currentUser.accessible_stores.length > 0
            ? currentUser.accessible_stores
            : (currentUser.store_name ? [currentUser.store_name] : []);
        if (myStores.length === 0) return true;
        return myStores.some(s => isStoreMatch(s, storeName));
    }, [currentUser]);

    // Chỉ lưu vào LocalStorage khi người dùng THỰC SỰ đã xác thực (có id và email)
    useEffect(() => {
        try {
            if (rawUser && rawUser.id && rawUser.email) {
                localStorage.setItem(STORAGE_ACTIVE_USER_KEY, JSON.stringify(rawUser));
            } else {
                localStorage.removeItem(STORAGE_ACTIVE_USER_KEY);
                localStorage.removeItem(STORAGE_LEGACY_KEY);
            }
        } catch (e) {
            console.warn('Lỗi lưu Auth vào localStorage:', e);
        }
    }, [rawUser]);

    // Kiểm tra session Supabase khi khởi chạy
    useEffect(() => {
        async function checkSupabaseSession() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user?.email) {
                    const profile = await getUserProfile(session.user.email);
                    if (profile) {
                        setRawUser(profileToCurrentUser(profile, session.user.id));
                    }
                }
            } catch {
                // Offline fallback
            } finally {
                setIsInitializing(false);
            }
        }
        checkSupabaseSession();

        // Lắng nghe thay đổi auth từ Supabase
        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user?.email) {
                const profile = await getUserProfile(session.user.email);
                if (profile) {
                    setRawUser(profileToCurrentUser(profile, session.user.id));
                }
            } else if (_event === 'SIGNED_OUT') {
                setRawUser(ANONYMOUS_USER);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const isAdmin = isAuthenticated && (currentUser.role === 'ADMIN');
    const canConfigure = isAuthenticated && (currentUser.role === 'ADMIN' || currentUser.role === 'QUAN_LY' || currentUser.role === 'TRUONG_CA');
    const isManager = isAuthenticated && (currentUser.role === 'ADMIN' || currentUser.role === 'QUAN_LY');
    const isShiftLeader = isAuthenticated && (currentUser.role === 'TRUONG_CA');

    // =========================================================================
    // HỆ THỐNG MÔ PHỎNG / TESTING PHÂN QUYỀN DÀNH CHO ADMIN
    // =========================================================================
    const setImpersonation = useCallback((updates: Partial<ImpersonationState>) => {
        if (!isActualAdmin) return;
        setImpersonationState(prev => {
            const next: ImpersonationState = {
                ...prev,
                ...updates,
                isActive: true
            };
            try {
                localStorage.setItem(STORAGE_IMPERSONATION_KEY, JSON.stringify(next));
            } catch (e) {
                console.warn('Lỗi lưu impersonation:', e);
            }
            return next;
        });
    }, [isActualAdmin]);

    const setImpersonationRole = useCallback((role: UserRole) => {
        setImpersonation({ role });
    }, [setImpersonation]);

    const setImpersonationStore = useCallback((storeName?: string) => {
        setImpersonation({ store_name: storeName });
    }, [setImpersonation]);

    const setImpersonationEmployee = useCallback((emp?: { employee_id: string; full_name: string; store_name?: string; role?: UserRole }) => {
        if (!emp) {
            setImpersonation({
                employee_id: '',
                employee_name: undefined
            });
            return;
        }
        setImpersonation({
            employee_id: emp.employee_id,
            employee_name: emp.full_name,
            ...(emp.store_name ? { store_name: emp.store_name } : {}),
            ...(emp.role ? { role: emp.role } : {})
        });
    }, [setImpersonation]);

    const resetImpersonation = useCallback(() => {
        setImpersonationState({ isActive: false });
        try {
            localStorage.removeItem(STORAGE_IMPERSONATION_KEY);
        } catch (e) {
            console.warn('Lỗi xóa impersonation:', e);
        }
    }, []);

    // 1. Đăng nhập bằng Email / Mã nhân viên + Mật khẩu
    const login = async (emailOrEmployeeId: string, password?: string): Promise<{ success: boolean; error?: string }> => {
        setIsLoading(true);
        try {
            const cleanKey = emailOrEmployeeId.trim().toLowerCase();

            // 1. Thử xác thực với Supabase Auth nếu nhập Email và Mật khẩu
            if (cleanKey.includes('@') && password) {
                try {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email: cleanKey,
                        password: password
                    });

                    if (!error && data?.user) {
                        let profile = await getUserProfile(data.user.email || cleanKey);
                        if (!profile) {
                            // Tự động khởi tạo hồ sơ nếu đã có tài khoản trên Supabase Auth nhưng chưa có trong user_profiles
                            profile = await createUserProfile({
                                email: data.user.email || cleanKey,
                                full_name: data.user.user_metadata?.full_name || cleanKey.split('@')[0],
                                auth_user_id: data.user.id
                            });
                        }

                        setRawUser(profileToCurrentUser(profile, data.user.id));
                        setIsLoading(false);
                        return { success: true };
                    }
                } catch {
                    // Supabase Auth lỗi hoặc mạng, tiếp tục kiểm tra mật khẩu trong cơ sở dữ liệu
                }
            }

            // 2. Kiểm tra tài khoản trong cơ sở dữ liệu user_profiles (Hỗ trợ mật khẩu Admin cấp trực tiếp)
            const profile = await getUserProfile(cleanKey);
            if (profile) {
                // Kiểm tra mật khẩu nếu tài khoản có mật khẩu thiết lập
                if (profile.password) {
                    if (!password || profile.password.trim() !== password.trim()) {
                        setIsLoading(false);
                        return {
                            success: false,
                            error: 'Mật khẩu không chính xác! Vui lòng kiểm tra lại hoặc liên hệ Quản trị viên (Admin) để cấp lại mật khẩu.'
                        };
                    }
                }

                setRawUser(profileToCurrentUser(profile));
                setIsLoading(false);
                return { success: true };
            }

            setIsLoading(false);
            return {
                success: false,
                error: `Không tìm thấy tài khoản với "${emailOrEmployeeId}". Bạn có thể bấm "Đăng ký" để tạo tài khoản mới.`
            };
        } catch (err: any) {
            setIsLoading(false);
            return { success: false, error: err.message || String(err) };
        }
    };

    // 2. Đăng ký tài khoản mới (Hỗ trợ cả thông tin đơn vị & vai trò ngay khi đăng ký)
    const register = async (params: {
        email: string;
        password?: string;
        full_name: string;
        phone?: string;
        employee_id?: string;
        department?: string;
        role?: UserRole;
        store_name?: string;
        is_new_store?: boolean;
        new_store_code?: string;
        new_store_address?: string;
    }): Promise<{ success: boolean; error?: string }> => {
        setIsLoading(true);
        try {
            let authUserId: string | undefined;

            // KIỂM TRA ĐỐI CHIẾU NHÂN SỰ ĐÃ KHAI BÁO TRƯỚC VỚI SIÊU THỊ:
            // Nếu mã NV khớp với nhân sự đã có trong hệ thống, mặc định sử dụng họ tên và bộ phận đã lưu trước!
            let resolvedFullName = params.full_name.trim();
            let resolvedDept = params.department?.trim();
            const cleanEmpId = (params.employee_id || '').trim();

            if (cleanEmpId) {
                try {
                    const { data: matchedEmp } = await supabase
                        .from('employees')
                        .select('*')
                        .eq('employee_id', cleanEmpId)
                        .maybeSingle();

                    if (matchedEmp && matchedEmp.full_name?.trim()) {
                        resolvedFullName = matchedEmp.full_name.trim();
                        if (!resolvedDept) {
                            resolvedDept = (matchedEmp.role || matchedEmp.job_title || matchedEmp.department || '').trim();
                        }
                    }
                } catch (e) {
                    console.warn('Lỗi kiểm tra nhân viên tồn tại khi đăng ký:', e);
                }
            }

            // 1. Thử đăng ký Supabase Auth nếu có mật khẩu
            if (params.password) {
                try {
                    const { data, error } = await supabase.auth.signUp({
                        email: params.email.trim(),
                        password: params.password,
                        options: {
                            data: {
                                full_name: resolvedFullName,
                                phone: params.phone,
                                employee_id: params.employee_id
                            }
                        }
                    });
                    if (!error && data.user) {
                        authUserId = data.user.id;
                    }
                } catch {
                    // Tiếp tục tạo profile trong hệ thống
                }
            }

            const chosenRole: UserRole = params.role || 'NHAN_VIEN';
            const chosenStore = (params.store_name || '').trim();
            const initialStatus: UserAccountStatus = chosenStore ? 'PENDING_APPROVAL' : 'PENDING_ONBOARDING';

            // 2. Tạo hồ sơ người dùng mới
            const profile = await createUserProfile({
                email: params.email,
                full_name: resolvedFullName,
                phone: params.phone,
                employee_id: params.employee_id,
                department: resolvedDept,
                auth_user_id: authUserId,
                password: params.password || '123456',
                role: chosenRole,
                store_name: chosenStore,
                status: initialStatus
            });

            // 3. Nếu đã chọn siêu thị (hoặc khai báo mới), tự động gửi luôn yêu cầu xét duyệt + thông báo đến Admin / QL
            if (chosenStore) {
                await submitOnboardingRequest({
                    user: profile,
                    requested_role: chosenRole,
                    department: resolvedDept,
                    store_name: chosenStore,
                    is_new_store: Boolean(params.is_new_store),
                    new_store_code: params.new_store_code,
                    new_store_address: params.new_store_address,
                    phone: params.phone,
                    employee_id: params.employee_id
                });
            } else {
                // Nếu chưa chọn siêu thị, vẫn gửi 1 thông báo cho Admin biết có tài khoản mới đăng ký
                await submitOnboardingRequest({
                    user: profile,
                    requested_role: chosenRole,
                    department: resolvedDept,
                    store_name: 'Chưa gắn siêu thị (Chờ Onboard)',
                    is_new_store: false,
                    phone: params.phone,
                    employee_id: params.employee_id
                });
            }

            setRawUser({
                id: profile.id,
                auth_user_id: profile.auth_user_id,
                email: profile.email,
                employee_id: profile.employee_id,
                full_name: profile.full_name,
                store_name: chosenStore,
                role: chosenRole,
                actual_role: chosenRole,
                role_title: ROLE_LABELS[chosenRole],
                status: 'PENDING_APPROVAL',
                phone: profile.phone
            });

            setIsLoading(false);
            return { success: true };
        } catch (err: any) {
            setIsLoading(false);
            return { success: false, error: err.message || String(err) };
        }
    };

    // 3. Đăng nhập nhanh bằng Demo User
    const loginAsDemoUser = (user: UserProfile) => {
        setRawUser({
            id: user.id,
            email: user.email,
            employee_id: user.employee_id,
            full_name: user.full_name,
            store_name: user.store_name,
            role: user.role,
            actual_role: user.role,
            role_title: user.role_title,
            status: user.status,
            phone: user.phone
        });
    };

    // 4. Đồng bộ / Tải lại trạng thái hồ sơ người dùng
    const refreshProfile = useCallback(async () => {
        if (!rawUser.email && !rawUser.id) return;
        try {
            const key = rawUser.email || rawUser.id || '';
            const profile = await getUserProfile(key);
            if (profile) {
                setRawUser(prev => ({
                    ...prev,
                    id: profile.id,
                    email: profile.email,
                    employee_id: profile.employee_id,
                    full_name: profile.full_name,
                    store_name: profile.store_name,
                    accessible_stores: profile.accessible_stores && profile.accessible_stores.length > 0
                        ? profile.accessible_stores
                        : (profile.store_name ? [profile.store_name] : []),
                    role: profile.role,
                    actual_role: profile.role || prev.actual_role,
                    role_title: profile.role_title,
                    status: profile.status,
                    phone: profile.phone,
                    rejection_reason: profile.rejection_reason
                }));
            }
        } catch (e) {
            console.warn('Lỗi refreshProfile:', e);
        }
    }, [rawUser.email, rawUser.id]);

    const updateLocalProfileStatus = (status: UserAccountStatus, updates?: Partial<CurrentUser>) => {
        setRawUser(prev => ({
            ...prev,
            status,
            ...(updates || {})
        }));
    };

    // 5. Chuyển đổi vai trò nhanh (Tích hợp mô phỏng nếu là Admin)
    const switchRole = useCallback((newRole: UserRole, storeName?: string) => {
        if (isActualAdmin) {
            if (newRole === 'ADMIN' && !storeName) {
                resetImpersonation();
            } else {
                setImpersonation({
                    role: newRole,
                    ...(storeName !== undefined ? { store_name: storeName } : {})
                });
            }
        } else {
            setRawUser(prev => ({
                ...prev,
                role: newRole,
                actual_role: prev.actual_role || prev.role,
                role_title: ROLE_LABELS[newRole],
                ...(storeName ? { store_name: storeName } : {})
            }));
        }
    }, [isActualAdmin, resetImpersonation, setImpersonation]);

    // 6. Đăng nhập vai trò nhân viên từ danh sách
    const loginAsEmployee = (employee: EmployeeItem, roleOverride?: UserRole) => {
        let determinedRole: UserRole = roleOverride || 'NHAN_VIEN';
        if (!roleOverride) {
            const normalized = parseEmployeeRoleAndDept(employee);
            determinedRole = normalized.role;
        }

        setRawUser({
            id: employee.id,
            employee_id: employee.employee_id,
            full_name: employee.full_name,
            store_name: employee.store_name,
            role: determinedRole,
            actual_role: determinedRole,
            role_title: ROLE_LABELS[determinedRole],
            status: 'ACTIVE'
        });
    };

    // 7. Mã PIN mở khóa nhanh quyền Admin / Quản lý / Trưởng ca
    const verifyPasscode = (pin: string): boolean => {
        const cleanPin = pin.trim();
        if (cleanPin === '999999' || cleanPin === '888888' || cleanPin === '686868') {
            switchRole('ADMIN');
            return true;
        }
        if (cleanPin === '6868' || cleanPin === '1234' || cleanPin === '8888') {
            switchRole('QUAN_LY');
            return true;
        }
        if (cleanPin === '9999' || cleanPin === '5678') {
            switchRole('TRUONG_CA');
            return true;
        }
        return false;
    };

    // 8. Đăng xuất
    const logout = async () => {
        try {
            await supabase.auth.signOut();
        } catch {
            // Ignore
        }
        localStorage.removeItem(STORAGE_ACTIVE_USER_KEY);
        localStorage.removeItem(STORAGE_LEGACY_KEY);
        localStorage.removeItem(STORAGE_IMPERSONATION_KEY);
        setImpersonationState({ isActive: false });
        setRawUser(ANONYMOUS_USER);
    };

    return (
        <AuthContext.Provider
            value={{
                currentUser,
                isAuthenticated,
                isLoading,
                isInitializing,
                canConfigure,
                isAdmin,
                isActualAdmin,
                isManager,
                isShiftLeader,
                accessibleStores,
                canAccessStore,
                isImpersonating,
                impersonationState,
                setImpersonation,
                setImpersonationRole,
                setImpersonationStore,
                setImpersonationEmployee,
                resetImpersonation,
                login,
                register,
                loginAsDemoUser,
                loginAsEmployee,
                switchRole,
                verifyPasscode,
                refreshProfile,
                updateLocalProfileStatus,
                logout
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

