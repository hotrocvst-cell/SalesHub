import { supabase } from '../../../core/lib/supabase';
import type { EmployeeItem, CampaignDictItem } from '../../../core/lib/storage';
import { resolveCanonicalCampaign } from '../../campaign-summary/utils/campaignSummaryStorage';

export interface CampaignOffsetItem {
    id: string;
    store_name: string;
    month: number;
    year: number;
    employee_id: string;
    from_campaign_key: string;  // Ngành hàng thặng dư
    to_campaign_key: string;    // Ngành hàng thiếu hụt
    offset_quantity: number;    // Số lượng sản phẩm cấn trừ (1 sản phẩm A đổi 1 sản phẩm B)
    note?: string;
    is_approved: boolean;
    created_by?: string;
    created_at?: string;
    updated_at?: string;
}

export const CAMPAIGN_OFFSETS_SQL = `-- 1. BẢNG LƯU TRỮ CẤN TRỪ THI ĐUA CUỐI THÁNG TRÊN SUPABASE CLOUD
CREATE TABLE IF NOT EXISTS public.employee_campaign_offsets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name TEXT NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    employee_id TEXT NOT NULL,
    from_campaign_key TEXT NOT NULL,
    to_campaign_key TEXT NOT NULL,
    offset_quantity NUMERIC NOT NULL DEFAULT 1,
    note TEXT,
    is_approved BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tạo Index tăng tốc truy vấn theo Siêu thị và Kỳ tháng/năm
CREATE INDEX IF NOT EXISTS idx_employee_campaign_offsets_store_period 
ON public.employee_campaign_offsets(store_name, month, year);

CREATE INDEX IF NOT EXISTS idx_employee_campaign_offsets_emp 
ON public.employee_campaign_offsets(employee_id);

-- Kích hoạt RLS & Phân quyền đầy đủ
ALTER TABLE public.employee_campaign_offsets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employee_campaign_offsets_all_policy" ON public.employee_campaign_offsets;
CREATE POLICY "employee_campaign_offsets_all_policy" 
ON public.employee_campaign_offsets FOR ALL USING (true) WITH CHECK (true);
`;

const STORAGE_KEY_PREFIX = 'saleshub_campaign_offsets';

function getCleanStoreKey(storeName: string): string {
    if (!storeName || storeName === 'all') return 'ALL';
    return storeName.trim().replace(/\s+/g, '_');
}

/**
 * Tải danh sách cấn trừ từ Supabase Cloud & LocalStorage fallback
 */
export async function fetchCampaignOffsets(
    storeName: string,
    month: number,
    year: number
): Promise<{ success: boolean; data: CampaignOffsetItem[]; fromSupabase: boolean; error?: string }> {
    const cleanKey = getCleanStoreKey(storeName);

    // 1. Tải từ Cloud Supabase
    try {
        let query = supabase
            .from('employee_campaign_offsets')
            .select('*')
            .eq('month', month)
            .eq('year', year);

        if (storeName && storeName !== 'all') {
            query = query.eq('store_name', storeName);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
            const mapped = data as CampaignOffsetItem[];
            try {
                localStorage.setItem(`${STORAGE_KEY_PREFIX}_${cleanKey}_${month}_${year}`, JSON.stringify(mapped));
            } catch { }
            return { success: true, data: mapped, fromSupabase: true };
        } else if (error) {
            console.warn('Lỗi đọc employee_campaign_offsets từ Supabase:', error.message);
        }
    } catch (e) {
        console.warn('Lỗi truy vấn Supabase campaign offsets:', e);
    }

    // 2. Fallback đọc LocalStorage cache
    try {
        const cached = localStorage.getItem(`${STORAGE_KEY_PREFIX}_${cleanKey}_${month}_${year}`);
        if (cached) {
            return { success: true, data: JSON.parse(cached) as CampaignOffsetItem[], fromSupabase: false };
        }
    } catch { }

    return { success: true, data: [], fromSupabase: false };
}

/**
 * Lưu toàn bộ danh sách cấn trừ của kỳ lên Supabase Cloud & LocalStorage
 */
export async function saveCampaignOffsets(
    offsets: CampaignOffsetItem[],
    storeName: string,
    month: number,
    year: number,
    updatedBy: string = 'Quản lý'
): Promise<{ success: boolean; fromSupabase: boolean; error?: string }> {
    const cleanKey = getCleanStoreKey(storeName);
    const nowIso = new Date().toISOString();

    const preparedOffsets = offsets.map(item => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        store_name: item.store_name || storeName,
        month,
        year,
        created_by: item.created_by || updatedBy,
        updated_at: nowIso
    }));

    // 1. Lưu LocalStorage tức thì
    try {
        localStorage.setItem(
            `${STORAGE_KEY_PREFIX}_${cleanKey}_${month}_${year}`,
            JSON.stringify(preparedOffsets)
        );
    } catch { }

    // 2. Đồng bộ lên Cloud Supabase: Xóa các bản ghi cũ của shop/kỳ và chèn lại các bản ghi mới
    let isCloudSaved = false;
    let cloudError: string | undefined;

    try {
        // Xóa các offset cũ của store và kỳ này nếu storeName xác định
        let deleteQuery = supabase
            .from('employee_campaign_offsets')
            .delete()
            .eq('month', month)
            .eq('year', year);

        if (storeName && storeName !== 'all') {
            deleteQuery = deleteQuery.eq('store_name', storeName);
        }

        const { error: delError } = await deleteQuery;
        if (delError && !delError.message.includes('PGRST205')) {
            console.warn('Cảnh báo khi xóa offset cũ:', delError.message);
        }

        if (preparedOffsets.length > 0) {
            const { error: insError } = await supabase
                .from('employee_campaign_offsets')
                .insert(preparedOffsets);

            if (!insError) {
                isCloudSaved = true;
            } else {
                cloudError = insError.message;
            }
        } else {
            isCloudSaved = true;
        }
    } catch (err: any) {
        cloudError = err?.message || String(err);
    }

    return {
        success: true,
        fromSupabase: isCloudSaved,
        error: isCloudSaved ? undefined : cloudError
    };
}

/**
 * Xóa 1 bản ghi cấn trừ theo ID
 */
export async function deleteCampaignOffset(
    id: string,
    storeName: string,
    month: number,
    year: number
): Promise<{ success: boolean }> {
    try {
        await supabase.from('employee_campaign_offsets').delete().eq('id', id);
    } catch { }

    const cleanKey = getCleanStoreKey(storeName);
    try {
        const cached = localStorage.getItem(`${STORAGE_KEY_PREFIX}_${cleanKey}_${month}_${year}`);
        if (cached) {
            const list = JSON.parse(cached) as CampaignOffsetItem[];
            const filtered = list.filter(item => item.id !== id);
            localStorage.setItem(`${STORAGE_KEY_PREFIX}_${cleanKey}_${month}_${year}`, JSON.stringify(filtered));
        }
    } catch { }

    return { success: true };
}

export interface EmployeeCampaignBalance {
    employee_id: string;
    campaign_key: string;
    campaign_name: string;
    target: number;
    actual_raw: number;
    difference: number; // actual - target: >0 là dư, <0 là thiếu
}

export interface SmartOffsetSuggestion {
    employee_id: string;
    employee_name: string;
    from_campaign_key: string;
    from_campaign_name: string;
    from_surplus: number;
    to_campaign_key: string;
    to_campaign_name: string;
    to_deficit: number;
    offset_quantity: number; // Số lượng 1 đổi 1
    reason: string;
}

/**
 * Thuật toán tính toán cấn trừ thông minh (Smart Auto-Offset)
 * Quy tắc: 1 sản phẩm thực tế của ngành hàng có dư cấn trừ bù cho 1 sản phẩm ngành hàng thiếu
 * Mục tiêu: Tối đa hóa số chương trình thi đua đạt chỉ tiêu cho nhân viên
 */
export function calculateSmartAutoOffsets(
    targetEmployees: EmployeeItem[],
    campaignTargets: Record<string, Record<string, number>>,
    campaignActualsMap: Record<string, Record<string, number>>,
    campaignDict: CampaignDictItem[]
): SmartOffsetSuggestion[] {
    const suggestions: SmartOffsetSuggestion[] = [];

    targetEmployees.forEach(emp => {
        const empId = emp.employee_id.trim();
        const empTargets = campaignTargets[empId] || {};
        const empActuals = campaignActualsMap[empId] || {};

        // 1. Phân loại các ngành hàng có dư (surplus) và các ngành hàng đang thiếu (deficit)
        const surpluses: { key: string; name: string; surplus: number }[] = [];
        const deficits: { key: string; name: string; deficit: number }[] = [];

        Object.entries(empTargets).forEach(([rawKey, targetVal]) => {
            const target = Number(targetVal) || 0;
            if (target <= 0) return;

            const resolved = resolveCanonicalCampaign(rawKey, campaignDict);
            const cKey = resolved.canonicalKey;
            const displayName = resolved.dictItem?.display_name || cKey;

            let actual = 0;
            if (empActuals[rawKey] !== undefined) {
                actual = Number(empActuals[rawKey]) || 0;
            } else if (empActuals[cKey] !== undefined) {
                actual = Number(empActuals[cKey]) || 0;
            }

            const diff = actual - target;
            if (diff > 0) {
                surpluses.push({ key: cKey, name: displayName, surplus: diff });
            } else if (diff < 0) {
                deficits.push({ key: cKey, name: displayName, deficit: Math.abs(diff) });
            }
        });

        // Sắp xếp: Ưu tiên ngành thiếu ít trước (để dễ đạt 100% nhất), và ngành dư nhiều trước
        deficits.sort((a, b) => a.deficit - b.deficit);
        surpluses.sort((a, b) => b.surplus - a.surplus);

        // 2. Ghép cặp cấn trừ 1 đổi 1
        for (const def of deficits) {
            let needed = def.deficit;
            if (needed <= 0) continue;

            for (const sur of surpluses) {
                if (sur.surplus <= 0) continue;

                const transfer = Math.min(sur.surplus, needed);
                if (transfer > 0) {
                    sur.surplus -= transfer;
                    needed -= transfer;

                    suggestions.push({
                        employee_id: empId,
                        employee_name: emp.full_name || empId,
                        from_campaign_key: sur.key,
                        from_campaign_name: sur.name,
                        from_surplus: sur.surplus + transfer,
                        to_campaign_key: def.key,
                        to_campaign_name: def.name,
                        to_deficit: def.deficit,
                        offset_quantity: transfer,
                        reason: `Cấn ${transfer} sp từ [${sur.name}] bù thiếu cho [${def.name}]`
                    });

                    if (needed <= 0) break;
                }
            }
        }
    });

    return suggestions;
}
