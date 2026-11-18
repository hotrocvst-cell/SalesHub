import { supabase } from '../../../core/lib/supabase';
import type { SampleDataGroup, SampleDataItem } from '../types';
import {
    createDefaultOcrSampleGroups,
    inferOcrToolCategory,
    inferOcrToolPath,
    LEGACY_TEXT_GROUP_KEYS
} from '../utils/ocrSamplePresets';

const LOCAL_STORAGE_KEY = 'saleshub_sample_ocr_images_cache_v2';

export const SAMPLE_DATA_SQL_DDL = `-- =========================================================================
-- KHỞI TẠO BẢNG KHO HÌNH ẢNH MẪU NHẬP LIỆU OCR - SALES HUB
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.sample_data_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_key TEXT UNIQUE NOT NULL,
    group_title TEXT NOT NULL,
    description TEXT DEFAULT '',
    order_index INTEGER NOT NULL DEFAULT 1,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_by TEXT DEFAULT NULL
);

-- BẬT ROW LEVEL SECURITY
ALTER TABLE public.sample_data_groups ENABLE ROW LEVEL SECURITY;

-- CHÍNH SÁCH BẢO MẬT
DROP POLICY IF EXISTS "Cho phép Admin toàn quyền quản lý dữ liệu mẫu" ON public.sample_data_groups;
DROP POLICY IF EXISTS "sample_data_groups_all_policy" ON public.sample_data_groups;

CREATE POLICY "sample_data_groups_all_policy"
    ON public.sample_data_groups
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sample_data_groups_order ON public.sample_data_groups (order_index ASC);
`;

export const DEFAULT_SEED_SAMPLE_GROUPS: SampleDataGroup[] = createDefaultOcrSampleGroups();

function normalizeSampleItem(raw: any, idx: number): SampleDataItem {
    const rawImages = Array.isArray(raw?.images) ? raw.images : [];
    const validImages = rawImages
        .filter((img: any) => img && typeof img.data_url === 'string' && img.data_url.startsWith('data:image/'))
        .map((img: any, i: number) => ({
            id: String(img.id || `img-${Date.now()}-${i}`),
            file_name: String(img.file_name || `anh_mau_${i + 1}.jpg`),
            mime_type: String(img.mime_type || 'image/jpeg'),
            data_url: String(img.data_url),
            width: typeof img.width === 'number' ? img.width : undefined,
            height: typeof img.height === 'number' ? img.height : undefined,
            size_kb: typeof img.size_kb === 'number' ? img.size_kb : undefined,
            caption: typeof img.caption === 'string' ? img.caption : '',
            uploaded_at: String(img.uploaded_at || new Date().toISOString())
        }));

    return {
        id: String(raw?.id || `slot-${Date.now()}-${idx}`),
        label: String(raw?.label || `Ô ảnh mẫu #${idx + 1}`),
        note: typeof raw?.note === 'string' ? raw.note : '',
        images: validImages,
        updated_at: String(raw?.updated_at || new Date().toISOString())
    };
}

function normalizeSampleGroup(raw: any, idx: number): SampleDataGroup {
    const groupKey = String(raw?.group_key || `ocr_group_${idx + 1}`);
    const groupTitle = String(raw?.group_title || 'Nhóm công cụ OCR');
    const category = raw?.tool_category || inferOcrToolCategory(groupKey, groupTitle);
    const items = Array.isArray(raw?.items)
        ? raw.items.map((it: any, i: number) => normalizeSampleItem(it, i))
        : [];

    return {
        id: String(raw?.id || `grp-${idx + 1}`),
        group_key: groupKey,
        group_title: groupTitle,
        tool_category: category,
        tool_path: raw?.tool_path || inferOcrToolPath(category),
        description: String(raw?.description || ''),
        order_index: Number(raw?.order_index) || idx + 1,
        items,
        created_at: raw?.created_at,
        updated_at: raw?.updated_at,
        updated_by: raw?.updated_by
    };
}

export function getLocalSampleGroups(): SampleDataGroup[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map((g, idx) => normalizeSampleGroup(g, idx));
            }
        }
    } catch {
        // ignore localStorage read error
    }
    return createDefaultOcrSampleGroups();
}

export function setLocalSampleGroups(groups: SampleDataGroup[]) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(groups));
    } catch {
        // Nếu dung lượng ảnh vượt hạn mức LocalStorage (~5MB), bỏ qua cache cục bộ vì Supabase Cloud là nguồn chính
    }
}

export async function fetchSampleDataGroups(): Promise<{
    groups: SampleDataGroup[];
    source: 'SUPABASE_CLOUD' | 'LOCAL_CACHE';
    isTableReady: boolean;
    migratedFromLegacyText?: boolean;
    error?: string;
}> {
    const local = getLocalSampleGroups();

    try {
        const { data, error } = await supabase
            .from('sample_data_groups')
            .select('*')
            .order('order_index', { ascending: true });

        if (error) {
            const isMissingTable =
                error.code === 'PGRST205' ||
                error.message.includes('relation "public.sample_data_groups" does not exist');
            return {
                groups: local,
                source: 'LOCAL_CACHE',
                isTableReady: !isMissingTable,
                error: error.message
            };
        }

        if (Array.isArray(data) && data.length > 0) {
            const normalized = data.map((d, idx) => normalizeSampleGroup(d, idx));

            // Tự động chuyển đổi nếu toàn bộ bản ghi trên Cloud là nhóm mẫu text cũ (không có nhóm ocr_* nào và chưa có ảnh nào)
            const hasAnyOcrGroup = normalized.some(
                g =>
                    g.group_key.startsWith('ocr_') ||
                    (g.tool_category && g.tool_category !== 'other')
            );
            const totalImages = normalized.reduce(
                (acc, g) => acc + g.items.reduce((s, it) => s + it.images.length, 0),
                0
            );

            if (!hasAnyOcrGroup && totalImages === 0) {
                const defaultOcrGroups = createDefaultOcrSampleGroups();
                const legacyKeys = normalized.map(g => g.group_key);
                try {
                    if (legacyKeys.length > 0) {
                        await supabase
                            .from('sample_data_groups')
                            .delete()
                            .in('group_key', legacyKeys);
                    }
                    await saveAllSampleDataGroups(defaultOcrGroups, 'SYSTEM_MIGRATION');
                } catch (migErr) {
                    console.warn('Không thể tự động dọn nhóm text cũ trên Cloud:', migErr);
                }
                setLocalSampleGroups(defaultOcrGroups);
                return {
                    groups: defaultOcrGroups,
                    source: 'SUPABASE_CLOUD',
                    isTableReady: true,
                    migratedFromLegacyText: true
                };
            }

            setLocalSampleGroups(normalized);
            return {
                groups: normalized,
                source: 'SUPABASE_CLOUD',
                isTableReady: true
            };
        }

        // Bảng trống -> khởi tạo bộ 4 nhóm công cụ OCR chuẩn lên Cloud
        const defaultGroups = createDefaultOcrSampleGroups();
        await saveAllSampleDataGroups(defaultGroups);
        setLocalSampleGroups(defaultGroups);
        return {
            groups: defaultGroups,
            source: 'SUPABASE_CLOUD',
            isTableReady: true
        };
    } catch (e: any) {
        return {
            groups: local,
            source: 'LOCAL_CACHE',
            isTableReady: false,
            error: e?.message || 'Lỗi mạng khi tải dữ liệu'
        };
    }
}

export async function saveAllSampleDataGroups(
    groups: SampleDataGroup[],
    userEmail?: string
): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toISOString();
    const updatedGroups = groups.map((g, i) => ({
        ...g,
        order_index: i + 1,
        updated_at: now,
        updated_by: userEmail || 'ADMIN'
    }));
    setLocalSampleGroups(updatedGroups);

    try {
        const payload = updatedGroups.map(g => ({
            group_key: g.group_key,
            group_title: g.group_title,
            description: g.description || '',
            order_index: g.order_index,
            items: g.items || [],
            updated_at: g.updated_at,
            updated_by: g.updated_by
        }));

        const { error } = await supabase
            .from('sample_data_groups')
            .upsert(payload, { onConflict: 'group_key' });

        if (error) {
            console.warn('Lỗi lưu toàn bộ sample_data_groups lên Cloud:', error.message);
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message };
    }
}

export async function resetToDefaultOcrGroups(
    currentGroups: SampleDataGroup[],
    userEmail?: string
): Promise<{ success: boolean; groups: SampleDataGroup[]; error?: string }> {
    const defaults = createDefaultOcrSampleGroups();
    const defaultKeySet = new Set(defaults.map(g => g.group_key));
    const keysToRemove = new Set<string>(Array.from(LEGACY_TEXT_GROUP_KEYS));
    currentGroups.forEach(g => {
        if (!defaultKeySet.has(g.group_key)) keysToRemove.add(g.group_key);
    });

    try {
        if (keysToRemove.size > 0) {
            await supabase
                .from('sample_data_groups')
                .delete()
                .in('group_key', Array.from(keysToRemove));
        }
    } catch (e) {
        console.warn('Lỗi dọn nhóm cũ khi khôi phục mặc định:', e);
    }

    const res = await saveAllSampleDataGroups(defaults, userEmail);
    return {
        success: res.success,
        groups: defaults,
        error: res.error
    };
}

export async function deleteSampleDataGroup(groupKey: string): Promise<{ success: boolean; error?: string }> {
    const local = getLocalSampleGroups().filter(g => g.group_key !== groupKey);
    setLocalSampleGroups(local);

    try {
        const { error } = await supabase
            .from('sample_data_groups')
            .delete()
            .eq('group_key', groupKey);

        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message };
    }
}
