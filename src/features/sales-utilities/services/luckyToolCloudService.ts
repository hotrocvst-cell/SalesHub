import { supabase } from '../../../core/lib/supabase';
import type {
    LuckyToolConfigRecord,
    LuckyToolKey,
    LuckyToolLogRecord,
    PersistentToolKey,
    ToolConfigPayloadMap
} from '../types';

const CONFIG_CACHE_PREFIX = 'saleshub_lucky_tool_configs_v1_';
const LOGS_CACHE_PREFIX = 'saleshub_lucky_tool_logs_v1_';

export const LUCKY_TOOLS_SQL_DDL = `-- TẠO BẢNG LƯU CẤU HÌNH VÀ LỊCH SỬ CÔNG CỤ QUAY SỐ / BỐC THĂM THEO ST
CREATE TABLE IF NOT EXISTS public.sales_lucky_tool_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name TEXT NOT NULL,
    tool_key TEXT NOT NULL,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT sales_lucky_tool_configs_store_tool_key UNIQUE (store_name, tool_key)
);

CREATE INDEX IF NOT EXISTS idx_sales_lucky_tool_configs_store
ON public.sales_lucky_tool_configs (store_name);

CREATE TABLE IF NOT EXISTS public.sales_lucky_tool_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name TEXT NOT NULL,
    tool_key TEXT NOT NULL,
    result_summary TEXT NOT NULL,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_lucky_tool_logs_store_time
ON public.sales_lucky_tool_logs (store_name, created_at DESC);

ALTER TABLE public.sales_lucky_tool_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_lucky_tool_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read sales_lucky_tool_configs" ON public.sales_lucky_tool_configs;
CREATE POLICY "Allow read sales_lucky_tool_configs"
ON public.sales_lucky_tool_configs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write sales_lucky_tool_configs" ON public.sales_lucky_tool_configs;
CREATE POLICY "Allow write sales_lucky_tool_configs"
ON public.sales_lucky_tool_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read sales_lucky_tool_logs" ON public.sales_lucky_tool_logs;
CREATE POLICY "Allow read sales_lucky_tool_logs"
ON public.sales_lucky_tool_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write sales_lucky_tool_logs" ON public.sales_lucky_tool_logs;
CREATE POLICY "Allow write sales_lucky_tool_logs"
ON public.sales_lucky_tool_logs FOR ALL USING (true) WITH CHECK (true);
`;

function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        msg.includes('schema cache') ||
        msg.includes('does not exist')
    );
}

function getConfigCacheKey(storeName: string): string {
    return `${CONFIG_CACHE_PREFIX}${storeName || 'GLOBAL'}`;
}

function getLogsCacheKey(storeName: string): string {
    return `${LOGS_CACHE_PREFIX}${storeName || 'GLOBAL'}`;
}

function readLocalConfigMap(storeName: string): Partial<Record<PersistentToolKey, LuckyToolConfigRecord>> {
    try {
        const raw = localStorage.getItem(getConfigCacheKey(storeName));
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function writeLocalConfigMap(
    storeName: string,
    map: Partial<Record<PersistentToolKey, LuckyToolConfigRecord>>
): void {
    try {
        localStorage.setItem(getConfigCacheKey(storeName), JSON.stringify(map));
    } catch {
        // Bỏ qua lỗi hạn mức localStorage
    }
}

function readLocalLogs(storeName: string): LuckyToolLogRecord[] {
    try {
        const raw = localStorage.getItem(getLogsCacheKey(storeName));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function writeLocalLogs(storeName: string, logs: LuckyToolLogRecord[]): void {
    try {
        localStorage.setItem(getLogsCacheKey(storeName), JSON.stringify(logs.slice(0, 60)));
    } catch {
        // Bỏ qua lỗi hạn mức localStorage
    }
}

/**
 * Kiểm tra trạng thái sẵn sàng của 2 bảng tiện ích trên Supabase Cloud
 */
export async function checkLuckyToolTablesReady(): Promise<{ ready: boolean; error?: string }> {
    try {
        const [cfgRes, logRes] = await Promise.all([
            supabase.from('sales_lucky_tool_configs').select('id', { count: 'exact', head: true }),
            supabase.from('sales_lucky_tool_logs').select('id', { count: 'exact', head: true })
        ]);
        if (isMissingTableError(cfgRes.error) || isMissingTableError(logRes.error)) {
            return {
                ready: false,
                error: 'Bảng cấu hình & lịch sử tiện ích quay số chưa được tạo trên Supabase.'
            };
        }
        return { ready: !cfgRes.error && !logRes.error, error: cfgRes.error?.message || logRes.error?.message };
    } catch (err: any) {
        return { ready: false, error: err?.message || 'Không thể kết nối Cloud' };
    }
}

/**
 * Tải cấu hình 5 công cụ theo ST (Supabase Cloud ưu tiên, fallback cache máy khách)
 */
export async function fetchStoreLuckyConfigs(storeName: string): Promise<{
    configs: Partial<Record<PersistentToolKey, ToolConfigPayloadMap[PersistentToolKey]>>;
    source: 'cloud' | 'local';
    tableReady: boolean;
}> {
    const scope = storeName || 'GLOBAL';
    const localMap = readLocalConfigMap(scope);

    try {
        const { data, error } = await supabase
            .from('sales_lucky_tool_configs')
            .select('*')
            .eq('store_name', scope);

        if (error) {
            const configsOnly: Partial<Record<PersistentToolKey, ToolConfigPayloadMap[PersistentToolKey]>> = {};
            Object.entries(localMap).forEach(([k, v]) => {
                if (v?.config_json) {
                    configsOnly[k as PersistentToolKey] = v.config_json;
                }
            });
            return { configs: configsOnly, source: 'local', tableReady: !isMissingTableError(error) };
        }

        const mergedMap: Partial<Record<PersistentToolKey, LuckyToolConfigRecord>> = { ...localMap };
        (data || []).forEach((row: any) => {
            if (row?.tool_key) {
                mergedMap[row.tool_key as PersistentToolKey] = row as LuckyToolConfigRecord;
            }
        });
        writeLocalConfigMap(scope, mergedMap);

        const result: Partial<Record<PersistentToolKey, ToolConfigPayloadMap[PersistentToolKey]>> = {};
        Object.entries(mergedMap).forEach(([k, v]) => {
            if (v?.config_json) {
                result[k as PersistentToolKey] = v.config_json;
            }
        });
        return { configs: result, source: 'cloud', tableReady: true };
    } catch {
        const fallback: Partial<Record<PersistentToolKey, ToolConfigPayloadMap[PersistentToolKey]>> = {};
        Object.entries(localMap).forEach(([k, v]) => {
            if (v?.config_json) {
                fallback[k as PersistentToolKey] = v.config_json;
            }
        });
        return { configs: fallback, source: 'local', tableReady: true };
    }
}

/**
 * Lưu cấu hình 1 công cụ lên Supabase Cloud (đồng thời cập nhật cache local)
 */
export async function upsertStoreLuckyConfig<K extends PersistentToolKey>(
    storeName: string,
    toolKey: K,
    configJson: ToolConfigPayloadMap[K],
    updatedBy: string
): Promise<{ success: boolean; source: 'cloud' | 'local'; tableReady: boolean; error?: string }> {
    const scope = storeName || 'GLOBAL';
    const nowIso = new Date().toISOString();

    const localMap = readLocalConfigMap(scope);
    localMap[toolKey] = {
        store_name: scope,
        tool_key: toolKey,
        config_json: configJson,
        updated_by: updatedBy,
        updated_at: nowIso
    };
    writeLocalConfigMap(scope, localMap);

    try {
        const { error } = await supabase
            .from('sales_lucky_tool_configs')
            .upsert(
                [
                    {
                        store_name: scope,
                        tool_key: toolKey,
                        config_json: configJson,
                        updated_by: updatedBy,
                        updated_at: nowIso
                    }
                ],
                { onConflict: 'store_name,tool_key' }
            );

        if (error) {
            return {
                success: false,
                source: 'local',
                tableReady: !isMissingTableError(error),
                error: error.message
            };
        }

        return { success: true, source: 'cloud', tableReady: true };
    } catch (err: any) {
        return {
            success: false,
            source: 'local',
            tableReady: true,
            error: err?.message || 'Lỗi kết nối Cloud'
        };
    }
}

/**
 * Tải lịch sử các lần quay/bốc thăm theo ST
 */
export async function fetchStoreLuckyLogs(
    storeName: string,
    limit: number = 30
): Promise<{ logs: LuckyToolLogRecord[]; source: 'cloud' | 'local'; tableReady: boolean }> {
    const scope = storeName || 'GLOBAL';
    const localLogs = readLocalLogs(scope);

    try {
        const { data, error } = await supabase
            .from('sales_lucky_tool_logs')
            .select('*')
            .eq('store_name', scope)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            return { logs: localLogs.slice(0, limit), source: 'local', tableReady: !isMissingTableError(error) };
        }

        const records = (data || []) as LuckyToolLogRecord[];
        writeLocalLogs(scope, records);
        return { logs: records, source: 'cloud', tableReady: true };
    } catch {
        return { logs: localLogs.slice(0, limit), source: 'local', tableReady: true };
    }
}

/**
 * Lưu 1 bản ghi lịch sử quay số / bốc thăm lên Supabase Cloud + cache local
 */
export async function appendStoreLuckyLog(
    entry: Omit<LuckyToolLogRecord, 'id' | 'created_at'>
): Promise<{ record: LuckyToolLogRecord; source: 'cloud' | 'local'; tableReady: boolean }> {
    const scope = entry.store_name || 'GLOBAL';
    const nowIso = new Date().toISOString();
    const localRecord: LuckyToolLogRecord = {
        ...entry,
        store_name: scope,
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        created_at: nowIso
    };

    const existingLocal = readLocalLogs(scope);
    writeLocalLogs(scope, [localRecord, ...existingLocal]);

    try {
        const { data, error } = await supabase
            .from('sales_lucky_tool_logs')
            .insert([
                {
                    store_name: scope,
                    tool_key: entry.tool_key as LuckyToolKey,
                    result_summary: entry.result_summary,
                    result_payload: entry.result_payload,
                    created_by: entry.created_by || 'Nhân sự ST',
                    created_at: nowIso
                }
            ])
            .select()
            .single();

        if (error || !data) {
            return { record: localRecord, source: 'local', tableReady: !isMissingTableError(error) };
        }

        const saved = data as LuckyToolLogRecord;
        writeLocalLogs(scope, [saved, ...existingLocal]);
        return { record: saved, source: 'cloud', tableReady: true };
    } catch {
        return { record: localRecord, source: 'local', tableReady: true };
    }
}

