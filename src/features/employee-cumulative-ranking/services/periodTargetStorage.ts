import { supabase } from '../../../core/lib/supabase';
import { isStoreMatch, normalizeToMillion } from '../../../core/lib/formatters';
import type { PeriodTargetConfig } from '../types';

const STORAGE_CACHE_KEY = 'saleshub_period_targets_cache_v1';

export const EMPLOYEE_PERIOD_TARGETS_SQL = `-- Bảng lưu trữ cấu hình Target theo từng Giai đoạn riêng biệt (Đơn vị tính: Triệu đồng)
CREATE TABLE IF NOT EXISTS public.employee_period_targets (
    id TEXT PRIMARY KEY,
    period_title TEXT NOT NULL,
    store_name TEXT NOT NULL,
    from_date TEXT NOT NULL,
    to_date TEXT NOT NULL,
    store_target NUMERIC DEFAULT 0,
    targets JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- Bật RLS và cấp quyền truy cập
ALTER TABLE public.employee_period_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cho phép toàn quyền truy cập employee_period_targets" ON public.employee_period_targets;
CREATE POLICY "Cho phép toàn quyền truy cập employee_period_targets" 
ON public.employee_period_targets FOR ALL USING (true) WITH CHECK (true);
`;

/**
 * Tạo ID chuẩn hóa cho cấu hình giai đoạn
 */
export function buildPeriodTargetId(storeName: string, fromDate: string, toDate: string): string {
    const cleanStore = storeName.trim().replace(/\s+/g, '_');
    return `period_${cleanStore}_${fromDate}_${toDate}`;
}

/**
 * Kiểm tra xem bảng employee_period_targets đã sẵn sàng trên Supabase chưa
 */
export async function checkSupabasePeriodTargetTable(): Promise<{ exists: boolean; count: number; error?: string }> {
    try {
        const { count, error } = await supabase
            .from('employee_period_targets')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return { exists: false, count: 0, error: error.message };
        }
        return { exists: true, count: count ?? 0 };
    } catch (e: any) {
        return { exists: false, count: 0, error: e.message || String(e) };
    }
}

/**
 * Đọc cache từ LocalStorage
 */
export function getLocalCache(): PeriodTargetConfig[] {
    try {
        const raw = localStorage.getItem(STORAGE_CACHE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * Lưu cache vào LocalStorage
 */
export function setLocalCache(list: PeriodTargetConfig[]): void {
    try {
        localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(list));
    } catch {}
}

/**
 * Chuẩn hóa các giá trị target bên trong object về đơn vị Triệu đồng
 */
function normalizeTargetsMap(rawTargets: Record<string, any> | undefined): Record<string, number> {
    if (!rawTargets || typeof rawTargets !== 'object') return {};
    const result: Record<string, number> = {};
    Object.entries(rawTargets).forEach(([k, v]) => {
        result[k.trim()] = normalizeToMillion(v);
    });
    return result;
}

/**
 * Tải cấu hình target giai đoạn cho một siêu thị và dải ngày cụ thể
 */
export async function fetchPeriodTarget(
    storeName: string,
    fromDate: string,
    toDate: string,
    storesList?: { name: string; short_name?: string }[]
): Promise<PeriodTargetConfig | null> {
    try {
        const { data, error } = await supabase
            .from('employee_period_targets')
            .select('*')
            .eq('from_date', fromDate)
            .eq('to_date', toDate);

        if (!error && data && data.length > 0) {
            // Tìm bản ghi khớp store
            const matched = data.find(row => 
                storeName === 'all' || isStoreMatch(row.store_name, storeName, storesList)
            );
            if (matched) {
                return {
                    id: matched.id,
                    periodTitle: matched.period_title || '',
                    storeName: matched.store_name,
                    fromDate: matched.from_date,
                    toDate: matched.to_date,
                    storeTarget: normalizeToMillion(matched.store_target),
                    targets: normalizeTargetsMap(matched.targets),
                    isCloudStored: true,
                    createdAt: matched.created_at,
                    updatedAt: matched.updated_at,
                    updatedBy: matched.updated_by
                };
            }
        }
    } catch (err) {
        console.warn('Lỗi đọc employee_period_targets từ Supabase:', err);
    }

    // Fallback LocalStorage cache
    const cached = getLocalCache();
    const localMatch = cached.find(c =>
        c.fromDate === fromDate &&
        c.toDate === toDate &&
        (storeName === 'all' || isStoreMatch(c.storeName, storeName, storesList))
    );

    if (localMatch) {
        return {
            ...localMatch,
            storeTarget: normalizeToMillion(localMatch.storeTarget),
            targets: normalizeTargetsMap(localMatch.targets),
            isCloudStored: false
        };
    }

    return null;
}

/**
 * Tải tất cả các giai đoạn đã cấu hình (hỗ trợ phân biệt Cloud vs Local cache)
 */
export async function fetchAllPeriodTargets(storeName?: string): Promise<PeriodTargetConfig[]> {
    try {
        let query = supabase
            .from('employee_period_targets')
            .select('*')
            .order('from_date', { ascending: false });

        if (storeName && storeName !== 'all') {
            query = query.eq('store_name', storeName);
        }

        const { data, error } = await query;
        if (!error && data) {
            const cloudResults: PeriodTargetConfig[] = data.map(row => ({
                id: row.id,
                periodTitle: row.period_title || '',
                storeName: row.store_name,
                fromDate: row.from_date,
                toDate: row.to_date,
                storeTarget: normalizeToMillion(row.store_target),
                targets: normalizeTargetsMap(row.targets),
                isCloudStored: true,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                updatedBy: row.updated_by
            }));
            
            // Hợp nhất với local cache nếu có bản ghi chỉ nằm ở máy khách
            const localCache = getLocalCache();
            const cloudIdSet = new Set(cloudResults.map(c => c.id));
            const unsyncedLocal = localCache.filter(l => !cloudIdSet.has(l.id)).map(l => ({
                ...l,
                storeTarget: normalizeToMillion(l.storeTarget),
                targets: normalizeTargetsMap(l.targets),
                isCloudStored: false
            }));

            const combined = [...cloudResults, ...unsyncedLocal];
            setLocalCache(combined);
            return combined;
        }
    } catch (err) {
        console.warn('Lỗi fetchAllPeriodTargets từ Cloud, dùng cache:', err);
    }

    const localList = getLocalCache();
    return localList.map(l => ({
        ...l,
        storeTarget: normalizeToMillion(l.storeTarget),
        targets: normalizeTargetsMap(l.targets),
        isCloudStored: false
    }));
}

/**
 * Lưu hoặc cập nhật cấu hình target giai đoạn (100% Cloud-First)
 */
export async function savePeriodTarget(
    config: PeriodTargetConfig
): Promise<{ success: boolean; data?: PeriodTargetConfig; error?: string }> {
    const id = config.id || buildPeriodTargetId(config.storeName, config.fromDate, config.toDate);
    const now = new Date().toISOString();

    const normalizedStoreTarget = normalizeToMillion(config.storeTarget);
    const normalizedTargets = normalizeTargetsMap(config.targets);

    const payload = {
        id,
        period_title: config.periodTitle || `Giai đoạn ${config.fromDate} - ${config.toDate}`,
        store_name: config.storeName,
        from_date: config.fromDate,
        to_date: config.toDate,
        store_target: normalizedStoreTarget,
        targets: normalizedTargets,
        updated_at: now
    };

    // 1. Cập nhật cache local trước (đánh dấu tạm offline)
    const cached = getLocalCache();
    const updatedCacheConfig: PeriodTargetConfig = {
        ...config,
        id,
        storeTarget: normalizedStoreTarget,
        targets: normalizedTargets,
        updatedAt: now,
        isCloudStored: false
    };
    const updatedCache = [
        updatedCacheConfig,
        ...cached.filter(c => c.id !== id)
    ];
    setLocalCache(updatedCache);

    // 2. Đồng bộ lên Supabase Cloud
    try {
        const { error } = await supabase
            .from('employee_period_targets')
            .upsert(payload, { onConflict: 'id' });

        if (error) {
            console.error('Lỗi Supabase upsert employee_period_targets:', error);
            return {
                success: false,
                data: updatedCacheConfig,
                error: `Đã lưu bộ nhớ máy, lỗi Cloud: ${error.message}`
            };
        }

        // Đánh dấu đã lưu thành công lên Cloud
        const cloudConfig: PeriodTargetConfig = {
            ...updatedCacheConfig,
            isCloudStored: true
        };
        setLocalCache([
            cloudConfig,
            ...cached.filter(c => c.id !== id)
        ]);

        return { success: true, data: cloudConfig };
    } catch (e: any) {
        console.error('Lỗi ngoại lệ savePeriodTarget:', e);
        return {
            success: false,
            data: updatedCacheConfig,
            error: e.message || String(e)
        };
    }
}

/**
 * Xóa một cấu hình target giai đoạn
 */
export async function deletePeriodTarget(id: string): Promise<{ success: boolean; error?: string }> {
    // 1. Xóa cache
    const cached = getLocalCache();
    setLocalCache(cached.filter(c => c.id !== id));

    // 2. Xóa Cloud
    try {
        const { error } = await supabase
            .from('employee_period_targets')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

/**
 * Đồng bộ toàn bộ các phiên Target giai đoạn từ Local lên Cloud
 */
export async function syncLocalPeriodTargetsToCloud(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    const cached = getLocalCache();
    const unsynced = cached.filter(c => !c.isCloudStored);
    if (unsynced.length === 0) return { success: true, syncedCount: 0 };

    try {
        const payloads = unsynced.map(c => ({
            id: c.id,
            period_title: c.periodTitle,
            store_name: c.storeName,
            from_date: c.fromDate,
            to_date: c.toDate,
            store_target: normalizeToMillion(c.storeTarget),
            targets: normalizeTargetsMap(c.targets),
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('employee_period_targets')
            .upsert(payloads, { onConflict: 'id' });

        if (error) throw error;

        // Cập nhật lại cache thành isCloudStored = true
        const updated = cached.map(c => ({ ...c, isCloudStored: true }));
        setLocalCache(updated);

        return { success: true, syncedCount: payloads.length };
    } catch (e: any) {
        return { success: false, syncedCount: 0, error: e.message || String(e) };
    }
}
