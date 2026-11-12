import { supabase } from '../../../core/lib/supabase';
import type { PaperSize, PrintPresetPayload, PrintPresetRecord } from '../types';

const CACHE_KEY_PREFIX = 'saleshub_print_presets_v1';

export const PRINT_PRESETS_SQL_DDL = `-- Chạy 1 lần trong Supabase SQL Editor (Quản trị viên ADMIN)
CREATE TABLE IF NOT EXISTS public.sales_print_presets (
    id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    tool_id TEXT NOT NULL,
    preset_name TEXT NOT NULL,
    paper_size TEXT NOT NULL DEFAULT 'A4',
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_print_presets_store_tool
    ON public.sales_print_presets (store_name, tool_id);

ALTER TABLE public.sales_print_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read print presets" ON public.sales_print_presets;
CREATE POLICY "Allow read print presets"
    ON public.sales_print_presets FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow upsert print presets" ON public.sales_print_presets;
CREATE POLICY "Allow upsert print presets"
    ON public.sales_print_presets FOR ALL
    USING (true)
    WITH CHECK (true);`;

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST205' ||
    Boolean(error.message && error.message.toLowerCase().includes('could not find the table'))
  );
}

function getCacheKey(storeName: string): string {
  const safeStore = (storeName || 'ALL').trim().toUpperCase();
  return `${CACHE_KEY_PREFIX}_${safeStore}`;
}

function readLocalCache(storeName: string): PrintPresetRecord[] {
  try {
    const raw = localStorage.getItem(getCacheKey(storeName));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCache(storeName: string, rows: PrintPresetRecord[]): void {
  try {
    localStorage.setItem(getCacheKey(storeName), JSON.stringify(rows));
  } catch {
    // Bỏ qua nếu đầy bộ nhớ cục bộ
  }
}

export async function fetchStorePrintPresets(
  storeName: string,
  toolId?: string
): Promise<{
  data: PrintPresetRecord[];
  storageType: 'cloud' | 'local';
  tableReady: boolean;
}> {
  const normalizedStore = (storeName || 'ALL').trim();
  const cachedAll = readLocalCache(normalizedStore);

  try {
    let query = supabase
      .from('sales_print_presets')
      .select('*')
      .eq('store_name', normalizedStore)
      .order('updated_at', { ascending: false });

    if (toolId) {
      query = query.eq('tool_id', toolId);
    }

    const { data, error } = await query;

    if (isMissingTableError(error)) {
      const filtered = toolId ? cachedAll.filter((r) => r.tool_id === toolId) : cachedAll;
      return { data: filtered, storageType: 'local', tableReady: false };
    }

    if (error) {
      const filtered = toolId ? cachedAll.filter((r) => r.tool_id === toolId) : cachedAll;
      return { data: filtered, storageType: 'local', tableReady: true };
    }

    const cloudRows = (data || []) as PrintPresetRecord[];
    if (!toolId) {
      writeLocalCache(normalizedStore, cloudRows);
    }
    return { data: cloudRows, storageType: 'cloud', tableReady: true };
  } catch {
    const filtered = toolId ? cachedAll.filter((r) => r.tool_id === toolId) : cachedAll;
    return { data: filtered, storageType: 'local', tableReady: true };
  }
}

export async function upsertPrintPreset(params: {
  id?: string;
  storeName: string;
  toolId: string;
  presetName: string;
  paperSize: PaperSize;
  configJson: PrintPresetPayload;
  createdBy?: string;
}): Promise<{
  record: PrintPresetRecord;
  storageType: 'cloud' | 'local';
  tableReady: boolean;
}> {
  const normalizedStore = (params.storeName || 'ALL').trim();
  const record: PrintPresetRecord = {
    id: params.id || `preset_${params.toolId}_${Date.now()}`,
    store_name: normalizedStore,
    tool_id: params.toolId,
    preset_name: params.presetName.trim(),
    paper_size: params.paperSize,
    config_json: params.configJson,
    created_by: params.createdBy || '',
    updated_at: new Date().toISOString(),
  };

  const existing = readLocalCache(normalizedStore).filter((item) => item.id !== record.id);
  writeLocalCache(normalizedStore, [record, ...existing]);

  try {
    const { data, error } = await supabase
      .from('sales_print_presets')
      .upsert(record, { onConflict: 'id' })
      .select()
      .single();

    if (isMissingTableError(error)) {
      return { record, storageType: 'local', tableReady: false };
    }
    if (error) {
      return { record, storageType: 'local', tableReady: true };
    }

    return {
      record: (data as PrintPresetRecord) || record,
      storageType: 'cloud',
      tableReady: true,
    };
  } catch {
    return { record, storageType: 'local', tableReady: true };
  }
}

export async function deletePrintPreset(
  id: string,
  storeName: string
): Promise<{ ok: boolean; tableReady: boolean }> {
  const normalizedStore = (storeName || 'ALL').trim();
  const filtered = readLocalCache(normalizedStore).filter((item) => item.id !== id);
  writeLocalCache(normalizedStore, filtered);

  try {
    const { error } = await supabase.from('sales_print_presets').delete().eq('id', id);
    if (isMissingTableError(error)) {
      return { ok: true, tableReady: false };
    }
    return { ok: !error, tableReady: true };
  } catch {
    return { ok: true, tableReady: true };
  }
}
