import { supabase } from '../../../core/lib/supabase';

const ADMIN_KEY_STORAGE = 'SALESHUB_ADMIN_GEMINI_KEY';
const USER_KEY_STORAGE = 'SALESHUB_USER_GEMINI_KEY';
const SYSTEM_SETTINGS_KEY = 'gemini_admin_api_key';

export type GeminiKeySource = 'USER' | 'ADMIN' | 'NONE';

export interface ActiveKeyInfo {
    key: string;
    source: GeminiKeySource;
    adminKeyConfigured: boolean;
    userKeyConfigured: boolean;
    isTableReady: boolean;
}

export class GeminiQuotaExceededError extends Error {
    public isQuotaExceeded = true;
    public keySource: GeminiKeySource;

    constructor(message: string, keySource: GeminiKeySource = 'ADMIN') {
        super(message);
        this.name = 'GeminiQuotaExceededError';
        this.keySource = keySource;
    }
}

export const SYSTEM_SETTINGS_SQL = `-- Bảng lưu trữ cấu hình tham số hệ thống chung (Do Quản trị viên cấu hình trên Cloud)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read system_settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update system_settings" ON public.system_settings FOR ALL USING (true);
`;

/**
 * 1. Đọc Key cá nhân của người dùng (từ localStorage)
 */
export function getUserGeminiKey(): string {
    return localStorage.getItem(USER_KEY_STORAGE) || '';
}

export function saveUserGeminiKey(key: string): void {
    const clean = key.trim();
    if (clean) {
        localStorage.setItem(USER_KEY_STORAGE, clean);
    } else {
        localStorage.removeItem(USER_KEY_STORAGE);
    }
}

export function clearUserGeminiKey(): void {
    localStorage.removeItem(USER_KEY_STORAGE);
}

/**
 * 2. Đọc Key quản trị (Admin Key) từ localStorage cache
 */
export function getAdminGeminiKeyLocal(): string {
    return localStorage.getItem(ADMIN_KEY_STORAGE) || '';
}

/**
 * 3. Đồng bộ Key quản trị từ Supabase Cloud
 */
export async function fetchAdminGeminiKeyCloud(): Promise<{ key: string; isTableReady: boolean; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', SYSTEM_SETTINGS_KEY)
            .maybeSingle();

        if (error) {
            // Nhận diện mã PGRST205 (bảng chưa tồn tại trên Supabase)
            if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
                return { key: getAdminGeminiKeyLocal(), isTableReady: false, error: 'Chưa tạo bảng system_settings trên Supabase' };
            }
            return { key: getAdminGeminiKeyLocal(), isTableReady: true, error: error.message };
        }

        const cloudKey = data?.value?.trim() || '';
        if (cloudKey) {
            localStorage.setItem(ADMIN_KEY_STORAGE, cloudKey);
        }
        return { key: cloudKey || getAdminGeminiKeyLocal(), isTableReady: true };
    } catch (err: any) {
        console.warn('Lỗi khi tải Admin Gemini Key từ Cloud:', err);
        return { key: getAdminGeminiKeyLocal(), isTableReady: true, error: err?.message };
    }
}

/**
 * 4. Quản trị viên lưu Admin Key lên Supabase Cloud & Cache
 */
export async function saveAdminGeminiKeyCloud(
    key: string,
    adminEmail?: string
): Promise<{ success: boolean; isTableReady: boolean; error?: string }> {
    const clean = key.trim();
    localStorage.setItem(ADMIN_KEY_STORAGE, clean);

    try {
        const { error } = await supabase.from('system_settings').upsert({
            key: SYSTEM_SETTINGS_KEY,
            value: clean,
            description: 'Google Gemini API Key mặc định hệ thống (Admin cấu hình)',
            updated_at: new Date().toISOString(),
            updated_by: adminEmail || 'ADMIN'
        });

        if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
                return { success: false, isTableReady: false, error: 'Bảng system_settings chưa được tạo trên Supabase' };
            }
            return { success: false, isTableReady: true, error: error.message };
        }

        return { success: true, isTableReady: true };
    } catch (err: any) {
        console.error('Lỗi khi lưu Admin Gemini Key lên Supabase:', err);
        return { success: false, isTableReady: true, error: err?.message || 'Lỗi không xác định' };
    }
}

/**
 * 5. Xác định Key hoạt động (Ưu tiên: User Key > Admin Key > None)
 */
export function resolveActiveGeminiKey(isTableReady = true): ActiveKeyInfo {
    const userKey = getUserGeminiKey();
    const adminKey = getAdminGeminiKeyLocal();

    if (userKey) {
        return {
            key: userKey,
            source: 'USER',
            adminKeyConfigured: Boolean(adminKey),
            userKeyConfigured: true,
            isTableReady
        };
    }

    if (adminKey) {
        return {
            key: adminKey,
            source: 'ADMIN',
            adminKeyConfigured: true,
            userKeyConfigured: false,
            isTableReady
        };
    }

    return {
        key: '',
        source: 'NONE',
        adminKeyConfigured: false,
        userKeyConfigured: false,
        isTableReady
    };
}

/**
 * 6. Kiểm tra tính hợp lệ và hạn ngạch của API Key (Tự động thử chuỗi model: 3.8-flash -> 2.5-flash -> 2.0-flash -> 1.5-flash)
 */
export async function testGeminiApiKey(
    apiKey: string
): Promise<{ success: boolean; message: string; quotaExceeded?: boolean; activeModel?: string }> {
    const clean = apiKey.trim();
    if (!clean) {
        return { success: false, message: 'API Key không được để trống' };
    }

    const candidateModels = [
        'gemini-3.5-flash',
        'gemini-flash-lite-latest',
        'gemini-3.8-flash',
        'gemini-2.5-flash'
    ];
    let lastMsg = '';

    for (const model of candidateModels) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4500);

            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${clean}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'Trả lời số 1 để xác nhận kết nối' }] }],
                        generationConfig: { maxOutputTokens: 5 }
                    }),
                    signal: controller.signal
                }
            );
            clearTimeout(timeoutId);

            if (res.status === 429) {
                return {
                    success: false,
                    quotaExceeded: true,
                    message: 'Hạn ngạch API đã hết (HTTP 429 Resource Exhausted / Rate limit)'
                };
            }

            if (res.ok) {
                localStorage.setItem('SALESHUB_ACTIVE_GEMINI_MODEL', model);
                return {
                    success: true,
                    activeModel: model,
                    message: `✅ Kết nối Google Gemini AI thành công siêu tốc (Model: ${model})!`
                };
            }

            const errJson = await res.json().catch(() => ({}));
            const errMsg = errJson?.error?.message || `HTTP ${res.status}`;
            lastMsg = errMsg;

            const isQuota =
                errJson?.error?.status === 'RESOURCE_EXHAUSTED' ||
                errMsg.toLowerCase().includes('quota') ||
                errMsg.toLowerCase().includes('rate limit');

            if (isQuota) {
                return {
                    success: false,
                    quotaExceeded: true,
                    message: errMsg
                };
            }

            // Nếu model này bị ngừng hỗ trợ, không có quyền truy cập, hoặc đang quá tải (503 / high demand), tự động nhảy sang model tiếp theo
            if (
                errMsg.toLowerCase().includes('no longer available') ||
                errMsg.toLowerCase().includes('not found') ||
                errMsg.toLowerCase().includes('high demand') ||
                res.status === 404 ||
                res.status === 503
            ) {
                console.warn(`Model ${model} đang bận hoặc không khả dụng (${res.status}), thử model tiếp theo...`);
                continue;
            }

            // Lỗi key không hợp lệ (API_KEY_INVALID)
            if (res.status === 400 || res.status === 403) {
                return {
                    success: false,
                    message: errMsg
                };
            }
        } catch (err: any) {
            console.warn(`Thử model ${model} thất bại hoặc timeout:`, err?.message);
            lastMsg = err?.name === 'AbortError' ? `Model ${model} phản hồi quá lâu` : (err?.message || 'Lỗi kết nối');
        }
    }

    return {
        success: false,
        message: lastMsg || 'Không thể kết nối đến các model Gemini'
    };
}

