import { supabase } from '../../../core/lib/supabase';
import { isStoreMatch } from '../../../core/lib/formatters';
import type { PeriodTargetConfig } from '../types';

const STORAGE_CACHE_KEY = 'saleshub_period_targets_cache_v1';

export const EMPLOYEE_PERIOD_TARGETS_SQL = `-- Bảng lưu trữ cấu hình Target theo từng Giai đoạn riêng biệt (khác với target nguyên tháng)
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
function getLocalCache(): PeriodTargetConfig[] {
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
function setLocalCache(list: PeriodTargetConfig[]): void {
    try {
        localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(list));
    } catch {}
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
                    storeTarget: Number(matched.store_target) || 0,
                    targets: matched.targets || {},
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
    return cached.find(c =>
        c.fromDate === fromDate &&
        c.toDate === toDate &&
        (storeName === 'all' || isStoreMatch(c.storeName, storeName, storesList))
    ) || null;
}

/**
 * Tải tất cả các giai đoạn đã cấu hình của một siêu thị
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
            const result: PeriodTargetConfig[] = data.map(row => ({
                id: row.id,
                periodTitle: row.period_title || '',
                storeName: row.store_name,
                fromDate: row.from_date,
                toDate: row.to_date,
                storeTarget: Number(row.store_target) || 0,
                targets: row.targets || {},
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                updatedBy: row.updated_by
            }));
            setLocalCache(result);
            return result;
        }
    } catch (err) {
        console.warn('Lỗi fetchAllPeriodTargets:', err);
    }

    return getLocalCache();
}

/**
 * Lưu hoặc cập nhật cấu hình target giai đoạn (100% Cloud-First)
 */
export async function savePeriodTarget(
    config: PeriodTargetConfig
): Promise<{ success: boolean; data?: PeriodTargetConfig; error?: string }> {
    const id = config.id || buildPeriodTargetId(config.storeName, config.fromDate, config.toDate);
    const now = new Date().toISOString();

    const payload = {
        id,
        period_title: config.periodTitle || `Giai đoạn ${config.fromDate} - ${config.toDate}`,
        store_name: config.storeName,
        from_date: config.fromDate,
        to_date: config.toDate,
        store_target: Number(config.storeTarget) || 0,
        targets: config.targets || {},
        updated_at: now
    };

    // 1. Cập nhật cache local trước
    const cached = getLocalCache();
    const updatedCache = [
        config,
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
                data: config,
                error: `Đã lưu tạm offline, lỗi Cloud: ${error.message}`
            };
        }

        return { success: true, data: { ...config, id, updatedAt: now } };
    } catch (e: any) {
        console.error('Lỗi ngoại lệ savePeriodTarget:', e);
        return {
            success: false,
            data: config,
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
