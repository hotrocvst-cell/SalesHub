import { supabase } from '../../../core/lib/supabase';
import {
    type UserProfile,
    fetchAllUserProfiles,
    adminCreateUserProfile,
    adminUpdateUserProfile,
    adminDeleteUserProfile,
    adminResetPassword
} from '../../../core/lib/authService';

export interface AccountExpirationConfig {
    id: string;
    default_guest_valid_days: number; // Mặc định số ngày dùng thử khi tạo (vd: 7 ngày)
    apply_to_all_accounts: boolean;    // Cờ sau này áp dụng cho toàn bộ tài khoản
    all_accounts_valid_days: number;   // Số ngày hoạt động toàn hệ thống (vd: 365 ngày)
    is_enabled: boolean;
    updated_by?: string;
    updated_at: string;
}

export const DEFAULT_EXPIRATION_CONFIG: AccountExpirationConfig = {
    id: 'default_config',
    default_guest_valid_days: 7,
    apply_to_all_accounts: false,
    all_accounts_valid_days: 365,
    is_enabled: true,
    updated_at: new Date().toISOString()
};

const LOCAL_STORAGE_EXPIRATION_CONFIG_KEY = 'saleshub_account_expiration_config_v1';

export const GUEST_SYSTEM_SQL = `-- Bảng 1: Cấu hình giới hạn thời gian hoạt động theo ngày (Account Expiration Settings)
CREATE TABLE IF NOT EXISTS public.account_expiration_configs (
    id TEXT PRIMARY KEY DEFAULT 'default_config',
    default_guest_valid_days INTEGER NOT NULL DEFAULT 7,
    apply_to_all_accounts BOOLEAN NOT NULL DEFAULT false,
    all_accounts_valid_days INTEGER NOT NULL DEFAULT 365,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tự động thêm cột is_guest và guest_expires_at cho bảng user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS guest_expires_at TIMESTAMPTZ;

-- Bật RLS và phân quyền truy cập
ALTER TABLE public.account_expiration_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all account_expiration_configs" ON public.account_expiration_configs;
CREATE POLICY "Allow all account_expiration_configs" ON public.account_expiration_configs FOR ALL USING (true);

-- Khởi tạo bản ghi cấu hình mặc định ban đầu
INSERT INTO public.account_expiration_configs (id, default_guest_valid_days, apply_to_all_accounts, all_accounts_valid_days, is_enabled)
VALUES ('default_config', 7, false, 365, true)
ON CONFLICT (id) DO NOTHING;
`;

/**
 * Kiểm tra xem bảng account_expiration_configs đã được tạo trên Supabase hay chưa
 */
export async function checkSupabaseGuestConfigsTable(): Promise<{ exists: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('account_expiration_configs')
            .select('id')
            .limit(1);

        if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
                return { exists: false, error: 'Chưa khởi tạo bảng account_expiration_configs trên Supabase' };
            }
            return { exists: false, error: error.message };
        }
        return { exists: true };
    } catch (e: any) {
        return { exists: false, error: e.message || 'Lỗi kiểm tra bảng Cloud' };
    }
}

/**
 * Tải cấu hình thời gian hoạt động (Cloud-First với fallback LocalStorage)
 */
export async function fetchAccountExpirationConfig(): Promise<{
    config: AccountExpirationConfig;
    isCloud: boolean;
}> {
    // 1. Lấy từ Supabase Cloud
    try {
        const { data, error } = await supabase
            .from('account_expiration_configs')
            .select('*')
            .eq('id', 'default_config')
            .maybeSingle();

        if (!error && data) {
            const config: AccountExpirationConfig = {
                id: data.id || 'default_config',
                default_guest_valid_days: Number(data.default_guest_valid_days ?? 7),
                apply_to_all_accounts: Boolean(data.apply_to_all_accounts),
                all_accounts_valid_days: Number(data.all_accounts_valid_days ?? 365),
                is_enabled: data.is_enabled !== false,
                updated_by: data.updated_by,
                updated_at: data.updated_at || new Date().toISOString()
            };
            localStorage.setItem(LOCAL_STORAGE_EXPIRATION_CONFIG_KEY, JSON.stringify(config));
            return { config, isCloud: true };
        }
    } catch (e) {
        console.warn('Lỗi tải cấu hình Supabase account_expiration_configs, fallback LocalStorage:', e);
    }

    // 2. Fallback LocalStorage
    try {
        const saved = localStorage.getItem(LOCAL_STORAGE_EXPIRATION_CONFIG_KEY);
        if (saved) {
            return { config: { ...DEFAULT_EXPIRATION_CONFIG, ...JSON.parse(saved) }, isCloud: false };
        }
    } catch {
        // Safe fallback
    }

    return { config: DEFAULT_EXPIRATION_CONFIG, isCloud: false };
}

/**
 * Lưu cấu hình thời gian hoạt động lên Cloud và LocalStorage
 */
export async function saveAccountExpirationConfig(
    config: Partial<AccountExpirationConfig>,
    updatedBy?: string
): Promise<{ success: boolean; data?: AccountExpirationConfig; error?: string }> {
    try {
        const current = (await fetchAccountExpirationConfig()).config;
        const updated: AccountExpirationConfig = {
            ...current,
            ...config,
            id: 'default_config',
            updated_by: updatedBy || current.updated_by,
            updated_at: new Date().toISOString()
        };

        // 1. Lưu LocalStorage
        localStorage.setItem(LOCAL_STORAGE_EXPIRATION_CONFIG_KEY, JSON.stringify(updated));

        // 2. Đồng bộ Supabase Cloud
        try {
            const { error } = await supabase
                .from('account_expiration_configs')
                .upsert({
                    id: 'default_config',
                    default_guest_valid_days: updated.default_guest_valid_days,
                    apply_to_all_accounts: updated.apply_to_all_accounts,
                    all_accounts_valid_days: updated.all_accounts_valid_days,
                    is_enabled: updated.is_enabled,
                    updated_by: updated.updated_by,
                    updated_at: updated.updated_at
                });

            if (error) {
                console.warn('Lỗi upsert account_expiration_configs Supabase:', error);
                return { success: true, data: updated, error: 'Đã lưu cục bộ. Lỗi Cloud: ' + error.message };
            }
        } catch (cloudErr: any) {
            console.warn('Không thể kết nối Supabase, đã lưu LocalStorage:', cloudErr);
            return { success: true, data: updated, error: 'Đã lưu cục bộ. Lỗi Cloud: ' + cloudErr.message };
        }

        return { success: true, data: updated };
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi lưu cấu hình' };
    }
}

/**
 * Tính toán số ngày còn lại của tài khoản
 */
export function calculateRemainingDays(expiresAt?: string): {
    days: number;
    isExpired: boolean;
    label: string;
    formattedDate: string;
} {
    if (!expiresAt) {
        return {
            days: 9999,
            isExpired: false,
            label: 'Vô thời hạn',
            formattedDate: 'Vô thời hạn'
        };
    }

    const end = new Date(expiresAt);
    end.setHours(23, 59, 59, 999);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();

    const formattedDate = `${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')}/${end.getFullYear()}`;

    if (diffMs <= 0) {
        return {
            days: 0,
            isExpired: true,
            label: 'Đã hết hạn',
            formattedDate
        };
    }

    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return {
        days,
        isExpired: false,
        label: `Còn ${days} ngày`,
        formattedDate
    };
}

import { GUEST_DEMO_STORE } from '../../../core/lib/guestDemoStoreService';

export const GUEST_DEFAULT_STORE = GUEST_DEMO_STORE;

/**
 * Lấy danh sách các tài khoản trải nghiệm
 */
export async function fetchGuestAccounts(): Promise<UserProfile[]> {
    const allUsers = await fetchAllUserProfiles();
    const guests = allUsers.filter(u => {
        const isGuestFlag = u.is_guest === true;
        const emailLower = (u.email || '').toLowerCase();
        const nameLower = (u.full_name || '').toLowerCase();
        const isGuestEmail = emailLower.includes('guest') || emailLower.includes('demo') || emailLower.includes('trainghiem');
        const isGuestName = nameLower.includes('trải nghiệm') || nameLower.includes('demo') || nameLower.includes('guest');
        return isGuestFlag || isGuestEmail || isGuestName;
    });

    // Chuẩn hóa siêu thị trải nghiệm: đảm bảo luôn trỏ về 838679 - Demo Store
    guests.forEach(u => {
        if (!u.store_name || !u.store_name.includes('838679') || u.store_name.includes('10335') || u.store_name === 'Siêu thị Mẫu SalesHub') {
            u.store_name = GUEST_DEFAULT_STORE;
            u.accessible_stores = [GUEST_DEFAULT_STORE];
        }
    });

    return guests;
}

/**
 * Tạo mới 1 tài khoản trải nghiệm (hoặc tự động cập nhật nếu tài khoản đã tồn tại)
 */
export async function createGuestAccount(data: {
    email: string;
    full_name: string;
    password?: string;
    valid_days?: number;
    store_name?: string;
}): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
    const cleanEmail = data.email.trim().toLowerCase();
    const validDays = data.valid_days && data.valid_days > 0 ? data.valid_days : 7;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + validDays);
    expiryDate.setHours(23, 59, 59, 999);

    // 1. Kiểm tra xem tài khoản này đã có sẵn trên hệ thống hay chưa
    const allUsers = await fetchAllUserProfiles();
    const existing = allUsers.find(u => u.email.toLowerCase() === cleanEmail);

    if (existing) {
        // TỰ ĐỘNG CHUYỂN ĐỔI / GIA HẠN TÀI KHOẢN ĐÃ CÓ THÀNH TÀI KHOẢN TRẢI NGHIỆM!
        const updates: Partial<UserProfile> = {
            is_guest: true,
            guest_expires_at: expiryDate.toISOString(),
            status: 'ACTIVE',
            role: 'QUAN_LY',
            role_title: 'Quản Lý',
            full_name: data.full_name.trim() || existing.full_name,
            store_name: data.store_name?.trim() || existing.store_name || GUEST_DEFAULT_STORE,
            accessible_stores: [data.store_name?.trim() || existing.store_name || GUEST_DEFAULT_STORE],
            department: 'Khách Trải Nghiệm (Demo)'
        };
        if (data.password && data.password.trim()) {
            updates.password = data.password.trim();
        }

        const updateRes = await adminUpdateUserProfile(existing.id, updates);
        if (data.password && data.password.trim()) {
            await adminResetPassword(existing.id, data.password.trim());
        }

        if (updateRes.success) {
            const updatedProfile: UserProfile = {
                ...existing,
                ...updates
            };
            return { success: true, data: updatedProfile };
        } else {
            return { success: false, error: updateRes.error || 'Không thể cập nhật tài khoản thành tài khoản trải nghiệm' };
        }
    }

    // 2. Nếu chưa tồn tại, tạo mới hoàn toàn
    const res = await adminCreateUserProfile({
        email: cleanEmail,
        full_name: data.full_name.trim(),
        password: data.password || 'SalesHub@2026',
        role: 'QUAN_LY', // Cấp vai trò Quản lý để khách trải nghiệm trọn vẹn mọi bảng báo cáo
        store_name: data.store_name?.trim() || GUEST_DEFAULT_STORE,
        department: 'Khách Trải Nghiệm (Demo)'
    });

    if (res.success && res.data) {
        // Cập nhật cờ is_guest và guest_expires_at
        await adminUpdateUserProfile(res.data.id, {
            is_guest: true,
            guest_expires_at: expiryDate.toISOString(),
            accessible_stores: [data.store_name?.trim() || GUEST_DEFAULT_STORE]
        } as any);

        res.data.is_guest = true;
        res.data.guest_expires_at = expiryDate.toISOString();
        res.data.accessible_stores = [data.store_name?.trim() || GUEST_DEFAULT_STORE];
    }

    return res;
}

/**
 * Tạo nhanh 1 đến 3 tài khoản trải nghiệm chuẩn mẫu
 */
export async function generateDefaultGuestAccounts(count: 1 | 2 | 3 = 3, validDays: number = 7, storeName?: string): Promise<{
    createdCount: number;
    errors: string[];
}> {
    const sampleGuests = [
        { email: 'guest1@saleshub.vn', full_name: 'Khách Trải Nghiệm 01', password: 'SH@Khach01' },
        { email: 'guest2@saleshub.vn', full_name: 'Khách Trải Nghiệm 02', password: 'SH@Khach02' },
        { email: 'guest3@saleshub.vn', full_name: 'Khách Trải Nghiệm 03', password: 'SH@Khach03' }
    ];

    const targetList = sampleGuests.slice(0, count);
    const existingGuests = await fetchGuestAccounts();
    const existingEmails = new Set(existingGuests.map(g => g.email.toLowerCase()));

    let createdCount = 0;
    const errors: string[] = [];

    for (const item of targetList) {
        if (existingEmails.has(item.email.toLowerCase())) {
            continue; // Đã tồn tại, bỏ qua
        }
        const res = await createGuestAccount({
            email: item.email,
            full_name: item.full_name,
            password: item.password,
            valid_days: validDays,
            store_name: storeName || GUEST_DEFAULT_STORE
        });
        if (res.success) {
            createdCount++;
        } else if (res.error) {
            errors.push(`${item.email}: ${res.error}`);
        }
    }

    return { createdCount, errors };
}

/**
 * Cập nhật thời hạn sử dụng theo ngày cho tài khoản
 */
export async function updateGuestExpirationDate(
    userId: string,
    expiryDateISO: string
): Promise<{ success: boolean; error?: string }> {
    return adminUpdateUserProfile(userId, {
        guest_expires_at: expiryDateISO
    } as any);
}

/**
 * Gia hạn thêm X ngày cho tài khoản trải nghiệm
 */
export async function extendGuestDays(
    user: UserProfile,
    additionalDays: number
): Promise<{ success: boolean; error?: string; newExpiry?: string }> {
    const currentExpiry = user.guest_expires_at ? new Date(user.guest_expires_at) : new Date();
    // Nếu đã hết hạn trước đó, cộng từ ngày hôm nay
    const baseDate = currentExpiry.getTime() < Date.now() ? new Date() : currentExpiry;
    baseDate.setDate(baseDate.getDate() + additionalDays);
    baseDate.setHours(23, 59, 59, 999);

    const iso = baseDate.toISOString();
    const res = await adminUpdateUserProfile(user.id, {
        guest_expires_at: iso,
        status: 'ACTIVE'
    } as any);

    return { success: res.success, error: res.error, newExpiry: iso };
}

/**
 * Đổi mật khẩu tài khoản trải nghiệm
 */
export async function updateGuestPassword(userId: string, newPass: string) {
    return adminResetPassword(userId, newPass);
}

/**
 * Xóa tài khoản trải nghiệm
 */
export async function deleteGuestAccount(userId: string) {
    return adminDeleteUserProfile(userId);
}

/**
 * Tạo mẫu tin nhắn quảng cáo / chia sẻ tài khoản gửi khách hàng qua Zalo / Facebook
 */
export function generateTrialShareMessage(user: UserProfile, customPass?: string): string {
    const origin = window.location.origin;
    const pass = customPass || user.password || 'Liên hệ Admin';
    const remaining = calculateRemainingDays(user.guest_expires_at);

    return `🌟 KÍNH MỜI QUÝ KHÁCH TRẢI NGHIỆM HỆ THỐNG SALES HUB 🌟
Hệ thống điều hành & quản trị mục tiêu kinh doanh siêu thị số 1 hiện nay!

🔐 THÔNG TIN ĐĂNG NHẬP TRẢI NGHIỆM:
• Đường dẫn đăng nhập: ${origin}/dang-nhap
• Tài khoản (Email): ${user.email}
• Mật khẩu: ${pass}
• Hạn trải nghiệm: Đến hết ${remaining.formattedDate} (${remaining.label})

💎 CÁC TÍNH NĂNG VƯỢT TRỘI QUÝ KHÁCH CÓ THỂ KHÁM PHÁ:
✅ Báo cáo cụm siêu thị & Báo cáo doanh thu Realtime trong ngày
✅ Theo dõi tiến độ lũy kế tháng & dự kiến hoàn thành mục tiêu
✅ Xếp hạng doanh thu nhân viên & Top thi đua tự động
✅ Bảng đếm tiền & bàn giao ca thu ngân tiện lợi
✅ Phân bổ mục tiêu, quản trị voucher & chiến dịch kinh doanh

📞 Hỗ trợ & Đăng ký gói Premium bản quyền chính thức:
Quý khách vui lòng liên hệ Admin SalesHub để nhận tư vấn & ưu đãi tốt nhất!`;
}
