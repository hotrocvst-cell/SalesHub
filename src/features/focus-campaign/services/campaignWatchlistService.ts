import { supabase } from '../../../core/lib/supabase';
import type { CampaignWatchlist } from '../types';

const STORAGE_KEY = 'saleshub_campaign_watchlists_v1';

export const CAMPAIGN_WATCHLIST_DDL_SQL = `-- 1. TẠO BẢNG DANH SÁCH THI ĐUA TRỌNG TÂM
CREATE TABLE IF NOT EXISTS public.campaign_watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_name TEXT NOT NULL,
    description TEXT DEFAULT '',
    store_name TEXT NOT NULL DEFAULT 'ALL',
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    campaign_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT DEFAULT ''
);

ALTER TABLE public.campaign_watchlists ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE public.campaign_watchlists ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

ALTER TABLE public.campaign_watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view campaign_watchlists" ON public.campaign_watchlists;
CREATE POLICY "Public view campaign_watchlists" ON public.campaign_watchlists
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all manage campaign_watchlists" ON public.campaign_watchlists;
CREATE POLICY "Allow all manage campaign_watchlists" ON public.campaign_watchlists
    FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_campaign_watchlists_store_period 
    ON public.campaign_watchlists(store_name, month, year);
`;

// LOẠI BỎ TOÀN BỘ DANH SÁCH MẪU THEO YÊU CẦU CỦA BOSS
function getLocalWatchlists(): CampaignWatchlist[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn('Lỗi đọc local watchlists:', e);
        return [];
    }
}

function setLocalWatchlists(items: CampaignWatchlist[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
        console.warn('Lỗi lưu local watchlists:', e);
    }
}

export async function checkWatchlistTableReady(): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('campaign_watchlists')
            .select('id')
            .limit(1);

        if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
                return false;
            }
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

export async function fetchWatchlists(
    storeName: string = 'ALL',
    month?: number,
    year?: number
): Promise<{ success: boolean; data: CampaignWatchlist[]; isCloud: boolean }> {
    try {
        let query = supabase
            .from('campaign_watchlists')
            .select('*')
            .order('order_index', { ascending: true })
            .order('created_at', { ascending: false });

        if (month !== undefined && year !== undefined) {
            query = query.eq('month', month).eq('year', year);
        }

        const { data, error } = await query;

        if (error) {
            const local = getLocalWatchlists().filter(w => {
                const matchStore = w.store_name === 'ALL' || storeName === 'all' || w.store_name === storeName;
                const matchTime = month && year ? (w.month === month && w.year === year) : true;
                return matchStore && matchTime;
            });
            return { success: true, data: local, isCloud: false };
        }

        if (data && data.length > 0) {
            const mapped: CampaignWatchlist[] = data.map((d: any) => ({
                id: d.id,
                list_name: d.list_name,
                description: d.description || '',
                store_name: d.store_name || 'ALL',
                month: Number(d.month),
                year: Number(d.year),
                campaign_keys: Array.isArray(d.campaign_keys) ? d.campaign_keys : [],
                is_default: Boolean(d.is_default),
                order_index: Number(d.order_index || 0),
                created_at: d.created_at,
                updated_at: d.updated_at,
                created_by: d.created_by || ''
            }));

            const filtered = mapped.filter(w => {
                if (storeName === 'all') return true;
                return w.store_name === 'ALL' || w.store_name.toLowerCase() === storeName.toLowerCase();
            });

            setLocalWatchlists(mapped);
            return { success: true, data: filtered, isCloud: true };
        }

        return { success: true, data: [], isCloud: true };
    } catch (err: any) {
        console.warn('Catch fetchWatchlists:', err);
        return { success: true, data: getLocalWatchlists(), isCloud: false };
    }
}

export async function upsertWatchlist(
    item: Partial<CampaignWatchlist>
): Promise<{ success: boolean; data?: CampaignWatchlist; error?: string }> {
    const payload = {
        list_name: (item.list_name || '').trim(),
        description: item.description?.trim() || '',
        store_name: item.store_name?.trim() || 'ALL',
        month: Number(item.month) || new Date().getMonth() + 1,
        year: Number(item.year) || new Date().getFullYear(),
        campaign_keys: item.campaign_keys || [],
        is_default: Boolean(item.is_default),
        order_index: Number(item.order_index) || 0,
        updated_at: new Date().toISOString(),
        created_by: item.created_by || ''
    };

    try {
        let resData: any = null;

        if (item.id && !item.id.startsWith('local-wl-')) {
            const { data, error } = await supabase
                .from('campaign_watchlists')
                .update(payload)
                .eq('id', item.id)
                .select()
                .single();
            if (error) throw error;
            resData = data;
        } else {
            const { data, error } = await supabase
                .from('campaign_watchlists')
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            resData = data;
        }

        const savedItem: CampaignWatchlist = {
            id: resData.id,
            list_name: resData.list_name,
            description: resData.description,
            store_name: resData.store_name,
            month: resData.month,
            year: resData.year,
            campaign_keys: resData.campaign_keys,
            is_default: resData.is_default,
            order_index: resData.order_index,
            created_at: resData.created_at,
            updated_at: resData.updated_at,
            created_by: resData.created_by
        };

        const locals = getLocalWatchlists().filter(w => w.id !== item.id && w.id !== savedItem.id);
        setLocalWatchlists([savedItem, ...locals]);

        return { success: true, data: savedItem };
    } catch (err: any) {
        console.warn('Lỗi upsertWatchlist Supabase, dùng local fallback:', err.message);
        const fallbackId = item.id || `local-wl-${Date.now()}`;
        const fallbackItem: CampaignWatchlist = {
            id: fallbackId,
            list_name: payload.list_name,
            description: payload.description,
            store_name: payload.store_name,
            month: payload.month,
            year: payload.year,
            campaign_keys: payload.campaign_keys,
            is_default: payload.is_default,
            order_index: payload.order_index,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: payload.created_by
        };
        const locals = getLocalWatchlists().filter(w => w.id !== fallbackId);
        setLocalWatchlists([fallbackItem, ...locals]);
        return { success: true, data: fallbackItem };
    }
}

export async function deleteWatchlist(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!id.startsWith('local-wl-')) {
            const { error } = await supabase
                .from('campaign_watchlists')
                .delete()
                .eq('id', id);
            if (error) console.warn('Supabase delete error:', error.message);
        }

        const locals = getLocalWatchlists().filter(w => w.id !== id);
        setLocalWatchlists(locals);
        return { success: true };
    } catch (err: any) {
        console.warn('Catch deleteWatchlist:', err);
        const locals = getLocalWatchlists().filter(w => w.id !== id);
        setLocalWatchlists(locals);
        return { success: true };
    }
}
