import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { EmployeeItem } from '../../core/lib/storage';
import { supabase } from '../../core/lib/supabase';
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

export interface CurrentUser {
    id?: string;
    auth_user_id?: string;
    email?: string;
    employee_id: string;
    full_name: string;
    store_name: string;
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
    login: (emailOrEmployeeId: string, password?: string) => Promise<{ success: boolean; error?: string }>;
    register: (params: {
        email: string;
        password?: string;
        full_name: string;
        phone?: string;
        employee_id?: string;
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [currentUser, setCurrentUser] = useState<CurrentUser>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_ACTIVE_USER_KEY) || localStorage.getItem(STORAGE_LEGACY_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Phải có cả id và email hợp lệ thì mới coi là đã đăng nhập trước đó
                if (parsed && parsed.id && parsed.email) {
                    return {
                        ...parsed,
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

    // Chỉ lưu vào LocalStorage khi người dùng THỰC SỰ đã xác thực (có id và email)
    useEffect(() => {
        try {
            if (currentUser && currentUser.id && currentUser.email) {
                localStorage.setItem(STORAGE_ACTIVE_USER_KEY, JSON.stringify(currentUser));
            } else {
                localStorage.removeItem(STORAGE_ACTIVE_USER_KEY);
                localStorage.removeItem(STORAGE_LEGACY_KEY);
            }
        } catch (e) {
            console.warn('Lỗi lưu Auth vào localStorage:', e);
        }
    }, [currentUser]);

    // Kiểm tra session Supabase khi khởi chạy
    useEffect(() => {
        async function checkSupabaseSession() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user?.email) {
                    const profile = await getUserProfile(session.user.email);
                    if (profile) {
                        setCurrentUser({
                            id: profile.id,
                            auth_user_id: session.user.id,
                            email: profile.email,
                            employee_id: profile.employee_id,
                            full_name: profile.full_name,
                            store_name: profile.store_name,
                            role: profile.role,
                            actual_role: profile.role,
                            role_title: profile.role_title,
                            status: profile.status,
                            phone: profile.phone,
                            rejection_reason: profile.rejection_reason
                        });
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
                    setCurrentUser(prev => ({
                        ...prev,
                        id: profile.id,
                        auth_user_id: session.user.id,
                        email: profile.email,
                        employee_id: profile.employee_id,
                        full_name: profile.full_name,
                        store_name: profile.store_name,
                        role: profile.role,
                        actual_role: profile.role,
                        role_title: profile.role_title,
                        status: profile.status,
                        phone: profile.phone,
                        rejection_reason: profile.rejection_reason
                    }));
                }
            } else if (_event === 'SIGNED_OUT') {
                setCurrentUser(ANONYMOUS_USER);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const isAuthenticated = Boolean(currentUser && currentUser.email && currentUser.id);
    const isActualAdmin = isAuthenticated && ((currentUser.actual_role === 'ADMIN') || (currentUser.role === 'ADMIN') || (currentUser.email === 'admin@saleshub.vn'));
    const isAdmin = isAuthenticated && (currentUser.role === 'ADMIN');
    const canConfigure = isAuthenticated && (currentUser.role === 'ADMIN' || currentUser.role === 'QUAN_LY' || currentUser.role === 'TRUONG_CA');
    const isManager = isAuthenticated && (currentUser.role === 'ADMIN' || currentUser.role === 'QUAN_LY');
    const isShiftLeader = isAuthenticated && (currentUser.role === 'TRUONG_CA');

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

                        setCurrentUser({
                            id: profile.id,
                            auth_user_id: data.user.id,
                            email: profile.email,
                            employee_id: profile.employee_id,
                            full_name: profile.full_name,
                            store_name: profile.store_name,
                            role: profile.role,
                            actual_role: profile.role,
                            role_title: profile.role_title,
                            status: profile.status,
                            phone: profile.phone,
                            rejection_reason: profile.rejection_reason
                        });
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

                setCurrentUser({
                    id: profile.id,
                    auth_user_id: profile.auth_user_id,
                    email: profile.email,
                    employee_id: profile.employee_id,
                    full_name: profile.full_name,
                    store_name: profile.store_name,
                    role: profile.role,
                    actual_role: profile.role,
                    role_title: profile.role_title,
                    status: profile.status,
                    phone: profile.phone,
                    rejection_reason: profile.rejection_reason
                });
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
        role?: UserRole;
        store_name?: string;
        is_new_store?: boolean;
        new_store_code?: string;
        new_store_address?: string;
    }): Promise<{ success: boolean; error?: string }> => {
        setIsLoading(true);
        try {
            let authUserId: string | undefined;

            // 1. Thử đăng ký Supabase Auth nếu có mật khẩu
            if (params.password) {
                try {
                    const { data, error } = await supabase.auth.signUp({
                        email: params.email.trim(),
                        password: params.password,
                        options: {
                            data: {
                                full_name: params.full_name,
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
                full_name: params.full_name,
                phone: params.phone,
                employee_id: params.employee_id,
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
                    store_name: 'Chưa gắn siêu thị (Chờ Onboard)',
                    is_new_store: false,
                    phone: params.phone,
                    employee_id: params.employee_id
                });
            }

            setCurrentUser({
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
        setCurrentUser({
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
        if (!currentUser.email && !currentUser.id) return;
        try {
            const key = currentUser.email || currentUser.id || '';
            const profile = await getUserProfile(key);
            if (profile) {
                setCurrentUser(prev => ({
                    ...prev,
                    id: profile.id,
                    email: profile.email,
                    employee_id: profile.employee_id,
                    full_name: profile.full_name,
                    store_name: profile.store_name,
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
    }, [currentUser.email, currentUser.id]);

    const updateLocalProfileStatus = (status: UserAccountStatus, updates?: Partial<CurrentUser>) => {
        setCurrentUser(prev => ({
            ...prev,
            status,
            ...(updates || {})
        }));
    };

    // 5. Chuyển đổi vai trò nhanh
    const switchRole = (newRole: UserRole, storeName?: string) => {
        setCurrentUser(prev => ({
            ...prev,
            role: newRole,
            actual_role: prev.actual_role || prev.role,
            role_title: ROLE_LABELS[newRole],
            ...(storeName ? { store_name: storeName } : {})
        }));
    };

    // 6. Đăng nhập vai trò nhân viên từ danh sách
    const loginAsEmployee = (employee: EmployeeItem, roleOverride?: UserRole) => {
        let determinedRole: UserRole = roleOverride || 'NHAN_VIEN';
        if (!roleOverride) {
            const title = (employee.role || employee.job_title || '').toLowerCase();
            if (title.includes('admin') || title.includes('quản trị')) {
                determinedRole = 'ADMIN';
            } else if (title.includes('quản lý') || title.includes('boss') || title.includes('cụm')) {
                determinedRole = 'QUAN_LY';
            } else if (title.includes('trưởng ca') || title.includes('leader') || title.includes('ca trưởng')) {
                determinedRole = 'TRUONG_CA';
            } else {
                determinedRole = 'NHAN_VIEN';
            }
        }

        setCurrentUser({
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
        setCurrentUser(ANONYMOUS_USER);
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
