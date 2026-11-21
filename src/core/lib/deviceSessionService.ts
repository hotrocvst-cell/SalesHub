import { supabase } from './supabase';
import type { UserRole } from './authService';

export type DeviceClass = 'MOBILE' | 'DESKTOP';

export interface SessionDeviceInfo {
    session_id: string;
    device_class: DeviceClass;
    device_name: string;
    browser: string;
    os: string;
    logged_in_at: string;
    last_active_at?: string;
}

export interface UserActiveSessions {
    mobile?: SessionDeviceInfo;
    desktop?: SessionDeviceInfo;
}

export const STORAGE_SESSION_ID_KEY = 'saleshub_active_session_id_v2';
export const STORAGE_DEVICE_CLASS_KEY = 'saleshub_device_class_v2';

// SQL Migration thêm cột active_sessions vào user_profiles
export const SQL_ADD_ACTIVE_SESSIONS_COLUMN = `ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS active_sessions JSONB DEFAULT '{}'::jsonb;`;

/**
 * Tạo UUID phiên an toàn, hỗ trợ fallback nếu crypto.randomUUID không khả dụng
 */
export function generateSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch {
            // fallback
        }
    }
    return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
}

/**
 * Nhận diện phân loại thiết bị: MOBILE (smartphone/tablet) hoặc DESKTOP (laptop/PC)
 */
export function detectDeviceClass(): DeviceClass {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return 'DESKTOP';
    }

    const ua = (navigator.userAgent || '').toLowerCase();
    
    // Kiểm tra các từ khóa di động phổ biến
    const isMobileUA = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini|harmonyos|phone/i.test(ua);
    
    // Nhận diện iPad chạy iPadOS (Safari trên iPadOS báo MacIntel nhưng có touch point > 1)
    const isIPadOS = typeof navigator.platform === 'string' && 
                     navigator.platform === 'MacIntel' && 
                     navigator.maxTouchPoints > 1;

    return (isMobileUA || isIPadOS) ? 'MOBILE' : 'DESKTOP';
}

/**
 * Trích xuất tên thiết bị, hệ điều hành và trình duyệt thân thiện
 */
export function detectFriendlyDeviceInfo(): { deviceName: string; os: string; browser: string; deviceClass: DeviceClass } {
    const deviceClass = detectDeviceClass();
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return {
            deviceClass,
            deviceName: 'Máy tính (Trình duyệt Web)',
            os: 'Windows/PC',
            browser: 'Trình duyệt Web'
        };
    }

    const ua = navigator.userAgent || '';
    
    // 1. Nhận diện Hệ điều hành (OS)
    let os = 'Khác';
    if (/iPhone/i.test(ua)) os = 'iOS (iPhone)';
    else if (/iPad/i.test(ua)) os = 'iPadOS';
    else if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) os = 'iPadOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    // 2. Nhận diện Trình duyệt (Browser)
    let browser = 'Trình duyệt Web';
    if (/Zalo/i.test(ua)) browser = 'Zalo App';
    else if (/coc_coc/i.test(ua)) browser = 'Cốc Cốc';
    else if (/Edg\//i.test(ua)) browser = 'MS Edge';
    else if (/Chrome\//i.test(ua)) browser = 'Chrome';
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';

    // 3. Tên thiết bị hiển thị thân thiện
    let deviceName = '';
    if (deviceClass === 'MOBILE') {
        if (/iPhone/i.test(ua)) {
            deviceName = `iPhone (${browser})`;
        } else if (/iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
            deviceName = `iPad (${browser})`;
        } else if (/Android/i.test(ua)) {
            deviceName = `Điện thoại Android (${browser})`;
        } else {
            deviceName = `Thiết bị di động (${os} - ${browser})`;
        }
    } else {
        if (/Windows/i.test(ua)) {
            deviceName = `Máy tính Windows (${browser})`;
        } else if (/Macintosh|Mac OS X/i.test(ua)) {
            deviceName = `Mac / MacBook (${browser})`;
        } else {
            deviceName = `Máy tính bàn / Laptop (${os} - ${browser})`;
        }
    }

    return { deviceName, os, browser, deviceClass };
}

/**
 * Lấy Session ID hiện tại của thiết bị từ localStorage
 */
export function getLocalSessionId(): string | null {
    try {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(STORAGE_SESSION_ID_KEY);
    } catch {
        return null;
    }
}

/**
 * Lưu Session ID và Device Class vào localStorage
 */
export function saveLocalSession(sessionId: string, deviceClass: DeviceClass): void {
    try {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_SESSION_ID_KEY, sessionId);
        localStorage.setItem(STORAGE_DEVICE_CLASS_KEY, deviceClass);
    } catch (e) {
        console.warn('Lỗi lưu session vào localStorage:', e);
    }
}

/**
 * Xóa Session ID khỏi localStorage khi đăng xuất hoặc bị kick-out
 */
export function clearLocalSession(): void {
    try {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(STORAGE_SESSION_ID_KEY);
        localStorage.removeItem(STORAGE_DEVICE_CLASS_KEY);
    } catch (e) {
        console.warn('Lỗi xóa session khỏi localStorage:', e);
    }
}

/**
 * Đăng ký phiên hoạt động mới lên Supabase Cloud:
 * - ADMIN / QUAN_LY / TRUONG_CA: Cho phép 1 Mobile + 1 Desktop. 
 *   + Nếu đăng nhập Mobile: Giữ Desktop, ghi đè Mobile (kick-out Mobile cũ).
 *   + Nếu đăng nhập Desktop: Giữ Mobile, ghi đè Desktop (kick-out Desktop cũ).
 * - NHAN_VIEN / GUEST / Khác: Chỉ 1 phiên duy nhất. Ghi đè toàn bộ thiết bị cũ.
 */
export async function registerDeviceSession(params: {
    userId: string;
    role: UserRole;
    userEmail?: string;
    customSessionId?: string;
}): Promise<{
    sessionId: string;
    deviceClass: DeviceClass;
    activeSessions: UserActiveSessions;
    success: boolean;
}> {
    const { userId, role, userEmail, customSessionId } = params;
    const deviceClass = detectDeviceClass();
    const sessionId = customSessionId || generateSessionId();
    const { deviceName, os, browser } = detectFriendlyDeviceInfo();

    const newDeviceInfo: SessionDeviceInfo = {
        session_id: sessionId,
        device_class: deviceClass,
        device_name: deviceName,
        browser,
        os,
        logged_in_at: new Date().toISOString(),
        last_active_at: new Date().toISOString()
    };

    // Lưu ngay vào localStorage thiết bị hiện tại
    saveLocalSession(sessionId, deviceClass);

    try {
        // 1. Lấy thông tin user_profiles hiện tại trên Supabase
        let targetId = userId;
        const { data: profile, error: fetchErr } = await supabase
            .from('user_profiles')
            .select('id, active_sessions, role')
            .or(`id.eq.${userId}${userEmail ? `,email.ilike.${userEmail}` : ''}`)
            .limit(1)
            .maybeSingle();

        if (fetchErr) {
            console.warn('Cảnh báo tra cứu profile khi đăng ký phiên:', fetchErr.message);
        }

        if (profile?.id) {
            targetId = profile.id;
        }

        const existingSessions: UserActiveSessions = (profile?.active_sessions && typeof profile.active_sessions === 'object')
            ? profile.active_sessions
            : {};

        // 2. Tính toán active_sessions mới theo quy tắc phân vai
        const isManagerial = role === 'ADMIN' || role === 'QUAN_LY' || role === 'TRUONG_CA';
        let updatedSessions: UserActiveSessions = {};

        if (isManagerial) {
            // Cho phép song song 1 Mobile + 1 Desktop
            if (deviceClass === 'MOBILE') {
                updatedSessions = {
                    desktop: existingSessions.desktop, // Giữ phiên desktop
                    mobile: newDeviceInfo               // Ghi đè phiên mobile (kick mobile cũ)
                };
            } else {
                updatedSessions = {
                    mobile: existingSessions.mobile,   // Giữ phiên mobile
                    desktop: newDeviceInfo             // Ghi đè phiên desktop (kick desktop cũ)
                };
            }
        } else {
            // Vai trò nhân viên hoặc khách: Duy nhất 1 phiên
            if (deviceClass === 'MOBILE') {
                updatedSessions = {
                    mobile: newDeviceInfo
                };
            } else {
                updatedSessions = {
                    desktop: newDeviceInfo
                };
            }
        }

        // 3. Cập nhật lên Supabase Cloud
        if (targetId) {
            const { error: updateErr } = await supabase
                .from('user_profiles')
                .update({
                    active_sessions: updatedSessions,
                    updated_at: new Date().toISOString()
                })
                .eq('id', targetId);

            if (updateErr) {
                console.warn('Lỗi cập nhật active_sessions lên Supabase:', updateErr.message);
            }
        }

        return {
            sessionId,
            deviceClass,
            activeSessions: updatedSessions,
            success: true
        };
    } catch (err) {
        console.warn('Không thể đồng bộ session lên Cloud (hoạt động offline/fallback):', err);
        return {
            sessionId,
            deviceClass,
            activeSessions: { [deviceClass === 'MOBILE' ? 'mobile' : 'desktop']: newDeviceInfo },
            success: false
        };
    }
}

/**
 * Kiểm tra xem phiên hiện tại của thiết bị này có còn hợp lệ hay đã bị thiết bị khác thay thế
 */
export function evaluateSessionStatus(params: {
    localSessionId: string | null;
    currentDeviceClass: DeviceClass;
    userRole: UserRole;
    activeSessions?: UserActiveSessions | null;
}): {
    isValid: boolean;
    conflictingSession?: SessionDeviceInfo;
    reason?: string;
} {
    const { localSessionId, currentDeviceClass, activeSessions, userRole } = params;

    // 1. Quản trị viên (ADMIN): Miễn trừ kiểm soát xung đột phiên đơn để phục vụ kiểm thử, phát triển
    // và vận hành song song trên nhiều thiết bị / trình duyệt ẩn danh (Incognito)
    if (userRole === 'ADMIN') {
        return { isValid: true };
    }

    // Nếu chưa có localSessionId hoặc chưa cấu hình active_sessions trên DB (chưa chạy migration SQL)
    if (!localSessionId || !activeSessions || typeof activeSessions !== 'object') {
        return { isValid: true };
    }

    const currentSlot = currentDeviceClass === 'MOBILE' ? activeSessions.mobile : activeSessions.desktop;

    // Nếu slot của loại thiết bị này hoàn toàn rỗng trên DB (ví dụ đã bị đăng xuất từ xa)
    if (!currentSlot) {
        // Kiểm tra xem có phiên ở slot khác mà người này là nhân viên không (nhân viên chỉ 1 phiên)
        const otherSlot = currentDeviceClass === 'MOBILE' ? activeSessions.desktop : activeSessions.mobile;
        if (otherSlot && (params.userRole === 'NHAN_VIEN' || !params.userRole)) {
            return {
                isValid: false,
                conflictingSession: otherSlot,
                reason: `Tài khoản đã đăng nhập trên ${otherSlot.device_name || 'một thiết bị khác'}.`
            };
        }
        return { isValid: true };
    }

    // Nếu session_id trên DB khác với session_id lưu trên máy này -> BỊ ĐÁ VĂNG (KICK-OUT)
    if (currentSlot.session_id && currentSlot.session_id !== localSessionId) {
        return {
            isValid: false,
            conflictingSession: currentSlot,
            reason: `Tài khoản của bạn vừa được đăng nhập trên một ${currentDeviceClass === 'MOBILE' ? 'Điện thoại/Máy tính bảng' : 'Máy tính/Laptop'} khác (${currentSlot.device_name || 'Thiết bị mới'}).`
        };
    }

    return { isValid: true };
}

/**
 * Hỗ trợ Quản lý/Admin chủ động đăng xuất khỏi thiết bị còn lại từ xa
 */
export async function terminateRemoteSession(params: {
    userId: string;
    targetDeviceClass: DeviceClass;
}): Promise<boolean> {
    try {
        const { userId, targetDeviceClass } = params;
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('active_sessions')
            .eq('id', userId)
            .maybeSingle();

        const currentSessions: UserActiveSessions = (profile?.active_sessions && typeof profile.active_sessions === 'object')
            ? { ...profile.active_sessions }
            : {};

        if (targetDeviceClass === 'MOBILE') {
            delete currentSessions.mobile;
        } else {
            delete currentSessions.desktop;
        }

        const { error } = await supabase
            .from('user_profiles')
            .update({
                active_sessions: currentSessions,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        return !error;
    } catch {
        return false;
    }
}
