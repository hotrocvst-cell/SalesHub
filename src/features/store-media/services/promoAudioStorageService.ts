import { supabase } from '../../../core/lib/supabase';
import type { PromoAudioItem } from '../types';

export const PROMO_AUDIO_SQL_DDL = `-- =========================================================
-- BẢNG THƯ VIỆN AUDIO PHÁT THANH KHUYẾN MÃI THEO ST / CỤM
-- =========================================================
CREATE TABLE IF NOT EXISTS promo_audio_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    drive_file_id TEXT,
    drive_url TEXT,
    store_codes TEXT[] DEFAULT '{}',
    duration_sec INTEGER DEFAULT 0,
    valid_until DATE DEFAULT '2030-12-31',
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT DEFAULT 'ADMIN',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kích hoạt Row Level Security
ALTER TABLE promo_audio_library ENABLE ROW LEVEL SECURITY;

-- Mọi tài khoản có thể đọc danh sách bài phát thanh còn hiệu lực
DROP POLICY IF EXISTS "Cho phép đọc thư viện audio KM" ON promo_audio_library;
CREATE POLICY "Cho phép đọc thư viện audio KM"
ON promo_audio_library FOR SELECT
USING (true);

-- Cho phép người dùng xác thực thêm/sửa/xóa bài phát thanh
DROP POLICY IF EXISTS "Cho phép quản lý thư viện audio KM" ON promo_audio_library;
CREATE POLICY "Cho phép quản lý thư viện audio KM"
ON promo_audio_library FOR ALL
USING (auth.role() = 'authenticated');

-- Chỉ mục tối ưu tìm kiếm theo ST
CREATE INDEX IF NOT EXISTS idx_promo_audio_valid ON promo_audio_library(valid_until, is_active);
`;

const DB_NAME = 'SalesHubPromoAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'cached_audio_blobs';

function openIndexedDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB không được hỗ trợ trên trình duyệt này'));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Lưu Blob âm thanh vào IndexedDB máy khách để phát offline / loop cả ngày
 */
export async function cacheAudioBlobLocally(id: string, blob: Blob, title?: string): Promise<boolean> {
    try {
        const db = await openIndexedDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({ id, blob, title, cachedAt: Date.now() });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch (err) {
        console.warn('Lỗi lưu cache IndexedDB:', err);
        return false;
    }
}

/**
 * Lấy Blob âm thanh đã cache từ IndexedDB
 */
export async function getCachedAudioBlob(id: string): Promise<Blob | null> {
    try {
        const db = await openIndexedDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(id);
            req.onsuccess = () => {
                if (req.result?.blob instanceof Blob) {
                    resolve(req.result.blob);
                } else {
                    resolve(null);
                }
            };
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

/**
 * Xóa Blob âm thanh khỏi IndexedDB
 */
export async function removeCachedAudioBlob(id: string): Promise<boolean> {
    try {
        const db = await openIndexedDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.delete(id);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

/**
 * Trích xuất Google Drive File ID từ bất kỳ định dạng link chia sẻ nào
 */
export function extractDriveFileId(rawUrlOrId: string): string {
    if (!rawUrlOrId) return '';
    const clean = rawUrlOrId.trim();

    // Dạng 1: /file/d/{ID}/view
    const match1 = clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1 && match1[1]) return match1[1];

    // Dạng 2: ?id={ID} hoặc &id={ID}
    const match2 = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2 && match2[1]) return match2[1];

    // Dạng 3: Direct ID (chỉ gồm ký tự a-z, 0-9, gạch ngang)
    if (/^[a-zA-Z0-9_-]{20,}$/.test(clean)) {
        return clean;
    }

    return clean;
}

/**
 * Tạo URL stream Google Drive trực tiếp
 */
export function getDriveStreamUrl(fileId: string): string {
    const cleanId = extractDriveFileId(fileId);
    if (!cleanId) return '';
    return `https://docs.google.com/uc?export=download&id=${cleanId}`;
}

/**
 * Kiểm tra bảng promo_audio_library đã sẵn sàng trên Supabase chưa
 */
export async function checkPromoAudioTableReady(): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('promo_audio_library')
            .select('id')
            .limit(1);

        if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache'))) {
            return false;
        }
        return !error;
    } catch {
        return false;
    }
}

/**
 * Tải danh mục bài phát thanh KM từ Supabase Cloud
 */
export async function fetchPromoAudioLibrary(storeCode?: string): Promise<{
    success: boolean;
    data: PromoAudioItem[];
    isTableMissing?: boolean;
    error?: string;
}> {
    try {
        const todayStr = new Date().toISOString().slice(0, 10);
        let query = supabase
            .from('promo_audio_library')
            .select('*')
            .eq('is_active', true)
            .gte('valid_until', todayStr)
            .order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
                return { success: false, data: [], isTableMissing: true };
            }
            return { success: false, data: [], error: error.message };
        }

        const items: PromoAudioItem[] = (data || []).map((row: any) => ({
            id: row.id,
            title: row.title,
            description: row.description || '',
            sourceType: 'google_drive',
            driveFileId: row.drive_file_id || '',
            driveUrl: row.drive_url || '',
            storeCodes: Array.isArray(row.store_codes) ? row.store_codes : [],
            durationSec: row.duration_sec || 0,
            validUntil: row.valid_until,
            isActive: Boolean(row.is_active),
            createdAt: row.created_at,
            createdBy: row.created_by
        }));

        // Lọc bài theo ST: Chỉ lấy bài chung (storeCodes rỗng) HOẶC bài có gắn đúng mã ST
        const filtered = storeCode
            ? items.filter(i => i.storeCodes.length === 0 || i.storeCodes.includes(storeCode))
            : items;

        return { success: true, data: filtered };
    } catch (err: any) {
        return { success: false, data: [], error: err?.message || 'Lỗi kết nối' };
    }
}

/**
 * Lưu hoặc cập nhật bài phát thanh KM lên Supabase Cloud
 */
export async function savePromoAudioItem(item: Partial<PromoAudioItem>, user: string = 'ADMIN'): Promise<{
    success: boolean;
    id?: string;
    error?: string;
}> {
    try {
        const payload: any = {
            title: item.title?.trim(),
            description: item.description?.trim() || null,
            drive_file_id: item.driveFileId ? extractDriveFileId(item.driveFileId) : null,
            drive_url: item.driveUrl?.trim() || null,
            store_codes: item.storeCodes || [],
            duration_sec: item.durationSec || 0,
            valid_until: item.validUntil || '2030-12-31',
            is_active: item.isActive !== undefined ? item.isActive : true,
            updated_at: new Date().toISOString()
        };

        if (item.id && !item.id.startsWith('local_')) {
            payload.id = item.id;
            const { error } = await supabase
                .from('promo_audio_library')
                .update(payload)
                .eq('id', item.id);
            if (error) throw error;
            return { success: true, id: item.id };
        } else {
            payload.created_by = user;
            const { data, error } = await supabase
                .from('promo_audio_library')
                .insert([payload])
                .select('id')
                .single();
            if (error) throw error;
            return { success: true, id: data?.id };
        }
    } catch (err: any) {
        return { success: false, error: err?.message || 'Không thể lưu bài phát thanh' };
    }
}

/**
 * Xóa bài phát thanh khỏi Supabase
 */
export async function deletePromoAudioItem(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('promo_audio_library')
            .delete()
            .eq('id', id);
        if (error) throw error;
        await removeCachedAudioBlob(id);
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message };
    }
}
