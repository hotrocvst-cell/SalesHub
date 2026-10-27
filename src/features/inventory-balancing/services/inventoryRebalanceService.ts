import { supabase } from '../../../core/lib/supabase';
import type { InventoryBalancingSavedConfig } from '../types';

export const INVENTORY_REBALANCE_TABLE = 'inventory_rebalance_saved_configs';
export const LOCAL_STORAGE_KEY = 'saleshub_inventory_rebalance_saved_config_v1';

export const INVENTORY_REBALANCE_SQL_DDL = `-- CHẠY LỆNH NÀY TRONG SUPABASE SQL EDITOR ĐỂ KHỞI TẠO BẢNG LƯU TRỮ CẤU HÌNH CÂN TỒN KHO:
CREATE TABLE IF NOT EXISTS public.inventory_rebalance_saved_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_store TEXT NOT NULL,
    config_name TEXT,
    selected_product_codes TEXT[] NOT NULL DEFAULT '{}',
    request_qtys JSONB NOT NULL DEFAULT '{}'::jsonb,
    ordered_items JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_store_filter TEXT DEFAULT '',
    min_source_qty INTEGER DEFAULT 2,
    request_percent INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bổ sung cột ordered_items, request_percent, selected_categories, selected_sub_categories nếu bảng đã tồn tại từ trước:
ALTER TABLE public.inventory_rebalance_saved_configs ADD COLUMN IF NOT EXISTS ordered_items JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.inventory_rebalance_saved_configs ADD COLUMN IF NOT EXISTS request_percent INTEGER DEFAULT 30;
ALTER TABLE public.inventory_rebalance_saved_configs ADD COLUMN IF NOT EXISTS selected_categories TEXT[] DEFAULT NULL;
ALTER TABLE public.inventory_rebalance_saved_configs ADD COLUMN IF NOT EXISTS selected_sub_categories TEXT[] DEFAULT NULL;

-- Kích hoạt RLS
ALTER TABLE public.inventory_rebalance_saved_configs ENABLE ROW LEVEL SECURITY;

-- Cấp quyền truy cập
DROP POLICY IF EXISTS "Allow read inventory_rebalance_saved_configs" ON public.inventory_rebalance_saved_configs;
CREATE POLICY "Allow read inventory_rebalance_saved_configs" ON public.inventory_rebalance_saved_configs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert/update inventory_rebalance_saved_configs" ON public.inventory_rebalance_saved_configs;
CREATE POLICY "Allow insert/update inventory_rebalance_saved_configs" ON public.inventory_rebalance_saved_configs FOR ALL USING (true);
`;

/**
 * Kiểm tra xem bảng trên Supabase Cloud đã sẵn sàng chưa (nhận diện PGRST205)
 */
export async function checkInventoryRebalanceTableReady(): Promise<boolean> {
    try {
        const { error } = await supabase
            .from(INVENTORY_REBALANCE_TABLE)
            .select('id')
            .limit(1);

        if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
                return false;
            }
            // Lỗi mạng hoặc auth, không phải thiếu bảng
            return true;
        }
        return true;
    } catch {
        return false;
    }
}

import { isStoreMatch } from '../../../core/lib/formatters';

export const LOCAL_STORAGE_SESSIONS_KEY = 'saleshub_inventory_rebalance_sessions_v2';

/**
 * Chuẩn hóa một hàng từ DB / LocalStorage thành đối tượng cấu hình hoàn chỉnh
 */
function parseRowToConfig(row: any): InventoryBalancingSavedConfig {
    const packed = (row.request_qtys && typeof row.request_qtys === 'object' && row.request_qtys.__saleshub_v2)
        ? row.request_qtys
        : null;

    const requestQtys = packed ? (packed.qtys || {}) : (row.request_qtys || {});
    const orderedItems = (row.ordered_items && Object.keys(row.ordered_items).length > 0)
        ? row.ordered_items
        : (packed?.ordered_items || {});
    const excludedKeys = row.excluded_store_item_keys || packed?.excluded_store_item_keys || {};
    const storeCustomQtys = row.store_custom_qtys || packed?.store_custom_qtys || {};
    const excludeKeywords = row.exclude_keywords || packed?.exclude_keywords || '';
    const requestPercent = row.request_percent ?? packed?.request_percent ?? 30;
    const selectedCategories = row.selected_categories || packed?.selected_categories || undefined;
    const selectedSubCategories = row.selected_sub_categories || packed?.selected_sub_categories || undefined;
    const excludedStores = row.excluded_source_stores || packed?.excluded_source_stores || [];
    const snapshotProducts = packed?.snapshot_products || [];
    const snapshotMatches = packed?.snapshot_matches || [];
    const rawRecordsCount = packed?.raw_records_count || 0;

    return {
        id: row.id,
        target_store: row.target_store,
        config_name: row.config_name || `Cân tồn kho ${row.target_store}`,
        selected_product_codes: row.selected_product_codes || [],
        request_qtys: requestQtys,
        ordered_items: orderedItems,
        excluded_store_item_keys: excludedKeys,
        store_custom_qtys: storeCustomQtys,
        exclude_keywords: excludeKeywords,
        source_store_filter: row.source_store_filter || '',
        min_source_qty: row.min_source_qty || 2,
        request_percent: requestPercent,
        selected_categories: selectedCategories,
        selected_sub_categories: selectedSubCategories,
        excluded_source_stores: excludedStores,
        snapshot_products: snapshotProducts,
        snapshot_matches: snapshotMatches,
        raw_records_count: rawRecordsCount,
        updated_at: row.updated_at || row.created_at || new Date().toISOString()
    };
}

/**
 * Lưu cấu hình cân tồn kho lên Supabase Cloud (với fallback LocalStorage)
 */
export async function saveRebalanceConfig(config: InventoryBalancingSavedConfig): Promise<{
    success: boolean;
    storageType: 'cloud' | 'local';
    error?: string;
}> {
    // 1. Luôn lưu vào LocalStorage làm cache dự phòng (cả cache đơn và danh sách phiên)
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
        const rawSessions = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
        let list: InventoryBalancingSavedConfig[] = rawSessions ? JSON.parse(rawSessions) : [];
        // Lọc bớt trùng lặp theo target_store hoặc thêm mới vào đầu danh sách
        list = [config, ...list.filter(s => s.id !== config.id && s.updated_at !== config.updated_at)].slice(0, 30);
        localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(list));
    } catch (e) {
        console.warn('Lỗi ghi LocalStorage:', e);
    }

    // 2. Đóng gói an toàn toàn bộ dữ liệu vào trường JSONB request_qtys
    // Đảm bảo không bao giờ bị mất thông tin ordered_items, custom qtys, snapshot kể cả khi Supabase chưa chạy ALTER TABLE
    const packedRequestQtys = {
        __saleshub_v2: true,
        qtys: config.request_qtys || {},
        ordered_items: config.ordered_items || {},
        excluded_store_item_keys: config.excluded_store_item_keys || {},
        store_custom_qtys: config.store_custom_qtys || {},
        exclude_keywords: config.exclude_keywords || '',
        request_percent: config.request_percent ?? 30,
        selected_categories: config.selected_categories || null,
        selected_sub_categories: config.selected_sub_categories || null,
        excluded_source_stores: config.excluded_source_stores || [],
        snapshot_products: config.snapshot_products || [],
        snapshot_matches: config.snapshot_matches || [],
        raw_records_count: config.raw_records_count || 0
    };

    // 3. Đồng bộ lên Supabase Cloud
    try {
        const payload: Record<string, unknown> = {
            target_store: config.target_store,
            config_name: config.config_name || `Cân tồn kho ${config.target_store}`,
            selected_product_codes: config.selected_product_codes,
            request_qtys: packedRequestQtys,
            ordered_items: config.ordered_items || {},
            source_store_filter: config.source_store_filter || '',
            min_source_qty: config.min_source_qty || 2,
            request_percent: config.request_percent ?? 30,
            selected_categories: config.selected_categories || null,
            selected_sub_categories: config.selected_sub_categories || null,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from(INVENTORY_REBALANCE_TABLE)
            .insert(payload);

        if (error) {
            // Nếu lỗi do cột mới chưa tạo trên schema Supabase, loại bỏ các cột mới để insert với schema gốc
            if (error.message?.includes('ordered_items') || error.message?.includes('request_percent') || error.message?.includes('selected_categories') || error.message?.includes('selected_sub_categories') || error.code === 'PGRST204') {
                delete payload.ordered_items;
                delete payload.request_percent;
                delete payload.selected_categories;
                delete payload.selected_sub_categories;
                const retryRes = await supabase.from(INVENTORY_REBALANCE_TABLE).insert(payload);
                if (!retryRes.error) {
                    return { success: true, storageType: 'cloud' };
                }
            }
            console.warn('Lỗi lưu Supabase:', error.message);
            return { success: true, storageType: 'local', error: error.message };
        }

        return { success: true, storageType: 'cloud' };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: true, storageType: 'local', error: msg };
    }
}

/**
 * Tải cấu hình đã lưu (ưu tiên Cloud, fallback LocalStorage)
 */
export async function loadRebalanceConfig(targetStore?: string): Promise<{
    config: InventoryBalancingSavedConfig | null;
    storageType: 'cloud' | 'local';
}> {
    // 1. Thử tải từ Supabase Cloud
    try {
        let query = supabase
            .from(INVENTORY_REBALANCE_TABLE)
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(50);

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
            let matchedRow = data[0];
            if (targetStore) {
                const found = data.find(r => isStoreMatch(r.target_store, targetStore));
                if (found) matchedRow = found;
            }

            if (matchedRow) {
                return {
                    config: parseRowToConfig(matchedRow),
                    storageType: 'cloud'
                };
            }
        }
    } catch (e) {
        console.warn('Không thể đọc Supabase, chuyển sang cache local:', e);
    }

    // 2. Fallback đọc LocalStorage
    try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) {
            const parsed = JSON.parse(local) as InventoryBalancingSavedConfig;
            return { config: parsed, storageType: 'local' };
        }
    } catch (e) {
        console.warn('Lỗi đọc LocalStorage:', e);
    }

    return { config: null, storageType: 'local' };
}

/**
 * Tải danh sách tất cả các phiên cấu hình/xin hàng đã lưu (ưu tiên Cloud, fallback LocalStorage)
 * Hỗ trợ khớp tên siêu thị linh hoạt có mã kho (ví dụ: '111 - TGD_BRV_VTA - 290 Trương Công Định')
 */
export async function fetchAllRebalanceSessions(targetStore?: string): Promise<{
    sessions: InventoryBalancingSavedConfig[];
    storageType: 'cloud' | 'local';
}> {
    try {
        const { data, error } = await supabase
            .from(INVENTORY_REBALANCE_TABLE)
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(100);

        if (!error && data && data.length > 0) {
            let list = data.map(parseRowToConfig);
            if (targetStore && targetStore !== 'ALL') {
                list = list.filter(s => isStoreMatch(s.target_store, targetStore));
            }
            return { sessions: list, storageType: 'cloud' };
        }
    } catch (e) {
        console.warn('Lỗi đọc danh sách phiên từ Cloud:', e);
    }

    // Fallback LocalStorage (cả cache danh sách nhiều phiên và cache đơn)
    try {
        const rawSessions = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
        if (rawSessions) {
            let list = JSON.parse(rawSessions) as InventoryBalancingSavedConfig[];
            if (targetStore && targetStore !== 'ALL') {
                list = list.filter(s => isStoreMatch(s.target_store, targetStore));
            }
            if (list.length > 0) {
                return { sessions: list, storageType: 'local' };
            }
        }

        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) {
            const parsed = JSON.parse(local) as InventoryBalancingSavedConfig;
            if (!targetStore || targetStore === 'ALL' || isStoreMatch(parsed.target_store, targetStore)) {
                return { sessions: [parsed], storageType: 'local' };
            }
        }
    } catch {}

    return { sessions: [], storageType: 'local' };
}

/**
 * Xóa một phiên cấu hình/xin hàng khỏi Cloud
 */
export async function deleteRebalanceSession(id: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from(INVENTORY_REBALANCE_TABLE)
            .delete()
            .eq('id', id);

        // Xóa cả trong LocalStorage cache nếu có
        try {
            const rawSessions = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
            if (rawSessions) {
                const list = JSON.parse(rawSessions) as InventoryBalancingSavedConfig[];
                const filtered = list.filter(s => s.id !== id);
                localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(filtered));
            }
        } catch {}

        return !error;
    } catch {
        return false;
    }
}

