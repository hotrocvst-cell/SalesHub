import { supabase } from '../../../core/lib/supabase';
import type { PromoAudioItem } from '../types';

export const PROMO_AUDIO_RLS_FIX_SQL = `-- Cấp lại quyền RLS chuẩn SalesHub cho bảng promo_audio_library
ALTER TABLE public.promo_audio_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cho phép đọc thư viện audio KM" ON public.promo_audio_library;
DROP POLICY IF EXISTS "Cho phép quản lý thư viện audio KM" ON public.promo_audio_library;
DROP POLICY IF EXISTS "promo_audio_library_all_policy" ON public.promo_audio_library;

CREATE POLICY "promo_audio_library_all_policy"
ON public.promo_audio_library
FOR ALL
USING (true)
WITH CHECK (true);`;

export const PROMO_AUDIO_SQL_DDL = `-- =========================================================
-- BẢNG THƯ VIỆN AUDIO PHÁT THANH KHUYẾN MÃI THEO ST / CỤM
-- =========================================================
CREATE TABLE IF NOT EXISTS public.promo_audio_library (
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

${PROMO_AUDIO_RLS_FIX_SQL}

-- Chỉ mục tối ưu tìm kiếm theo ST
CREATE INDEX IF NOT EXISTS idx_promo_audio_valid ON public.promo_audio_library(valid_until, is_active);
`;

const DB_NAME = 'SalesHubPromoAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'cached_audio_blobs';
const CLOUD_AUDIO_MARKER = '__CLOUD_AUDIO__';

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
 * Lưu Blob âm thanh vào IndexedDB máy khách để phát offline / lặp cả ngày (0 KB Cloud)
 */
export async function cacheAudioBlobLocally(
    id: string,
    blob: Blob,
    title?: string,
    storeCode?: string
): Promise<boolean> {
    try {
        const db = await openIndexedDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({ id, blob, title, storeCode: storeCode || '', cachedAt: Date.now() });
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
 * Tải lại danh sách các file âm thanh đã nạp cục bộ từ máy trong IndexedDB (giữ nguyên sau khi F5)
 */
export async function loadPersistedLocalAudioItems(storeCode?: string): Promise<PromoAudioItem[]> {
    try {
        const db = await openIndexedDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => {
                const rows = Array.isArray(req.result) ? req.result : [];
                const localRows = rows
                    .filter((r: any) => typeof r?.id === 'string' && r.id.startsWith('local_') && r.blob instanceof Blob)
                    .filter((r: any) => !storeCode || !r.storeCode || r.storeCode === storeCode)
                    .sort((a: any, b: any) => (b.cachedAt || 0) - (a.cachedAt || 0));

                const items: PromoAudioItem[] = localRows.map((r: any) => ({
                    id: r.id,
                    title: r.title || 'File âm thanh máy',
                    sourceType: 'local_file',
                    storeCodes: r.storeCode ? [r.storeCode] : [],
                    blobUrl: URL.createObjectURL(r.blob),
                    isCachedLocally: true,
                    isActive: true
                }));
                resolve(items);
            };
            req.onerror = () => resolve([]);
        });
    } catch {
        return [];
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
 * Đọc tệp âm thanh từ máy Admin sang Data URL để lưu trực tiếp lên Supabase Cloud (<= 5MB)
 */
export function readAudioFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('Không thể đọc dữ liệu file âm thanh.'));
            }
        };
        reader.onerror = () => reject(new Error('Lỗi đọc file âm thanh từ thiết bị.'));
        reader.readAsDataURL(file);
    });
}

/**
 * Chuyển đổi Data URL (data:audio/...) sang Blob để cache vào IndexedDB & phát mượt
 */
export function dataUrlToBlob(dataUrl: string): Blob {
    const [header, base64] = dataUrl.split(',');
    const mimeMatch = header?.match(/data:([^;]+);/);
    const mime = mimeMatch ? mimeMatch[1] : 'audio/mp4';
    const binary = atob(base64 || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
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
 * Tải danh mục bài phát thanh Cloud từ Supabase (CHỈ tải metadata nhẹ < 2KB, lọc bỏ các bản ghi Drive cũ không còn hỗ trợ)
 */
export async function fetchPromoAudioLibrary(storeCode?: string): Promise<{
    success: boolean;
    data: PromoAudioItem[];
    isTableMissing?: boolean;
    error?: string;
}> {
    try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase
            .from('promo_audio_library')
            .select('id, title, description, drive_file_id, store_codes, duration_sec, valid_until, is_active, created_at, created_by')
            .eq('is_active', true)
            .eq('drive_file_id', CLOUD_AUDIO_MARKER)
            .gte('valid_until', todayStr)
            .order('created_at', { ascending: false });

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
            sourceType: 'cloud_audio',
            storeCodes: Array.isArray(row.store_codes) ? row.store_codes : [],
            durationSec: row.duration_sec || 0,
            validUntil: row.valid_until,
            isActive: Boolean(row.is_active),
            createdAt: row.created_at,
            createdBy: row.created_by
        }));

        const filtered = storeCode
            ? items.filter(i => i.storeCodes.length === 0 || i.storeCodes.includes(storeCode))
            : items;

        return { success: true, data: filtered };
    } catch (err: any) {
        return { success: false, data: [], error: err?.message || 'Lỗi kết nối' };
    }
}

/**
 * Tải lười (Lazy-Load) nội dung âm thanh của đúng 1 bài Cloud duy nhất khi máy chưa có trong IndexedDB
 */
export async function fetchCloudAudioPayloadById(id: string): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('promo_audio_library')
            .select('drive_url')
            .eq('id', id)
            .maybeSingle();

        if (error || !data?.drive_url) return null;
        return String(data.drive_url).trim();
    } catch {
        return null;
    }
}

/**
 * Lưu bài phát thanh Cloud lên Supabase
 */
export async function savePromoAudioItem(item: Partial<PromoAudioItem>, user: string = 'ADMIN'): Promise<{
    success: boolean;
    id?: string;
    isRlsError?: boolean;
    error?: string;
}> {
    try {
        const payload: any = {
            title: item.title?.trim(),
            description: item.description?.trim() || null,
            drive_file_id: CLOUD_AUDIO_MARKER,
            drive_url: (item.audioDataUrl || '').trim() || null,
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
        const msg = err?.message || 'Không thể lưu bài phát thanh';
        const isRlsError = err?.code === '42501' || msg.toLowerCase().includes('row-level security');
        return { success: false, isRlsError, error: msg };
    }
}

/**
 * Xóa bài phát thanh khỏi Supabase
 */
export async function deletePromoAudioItem(id: string): Promise<{ success: boolean; isRlsError?: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('promo_audio_library')
            .delete()
            .eq('id', id);
        if (error) throw error;
        await removeCachedAudioBlob(id);
        return { success: true };
    } catch (err: any) {
        const msg = err?.message || 'Không thể xóa bài phát thanh';
        const isRlsError = err?.code === '42501' || msg.toLowerCase().includes('row-level security');
        return { success: false, isRlsError, error: msg };
    }
}
