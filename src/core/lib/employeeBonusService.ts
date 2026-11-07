import { supabase } from './supabase';
import { isStoreMatch } from './formatters';

export interface EmployeeBonusItem {
    id: string;
    store_name: string;
    employee_id: string;
    employee_name: string;
    month: number;
    year: number;
    bonus_date: string;         // 'YYYY-MM-DD'
    campaign_key: string;       // Mã ngành hàng (ví dụ: 'VP', 'SIM') hoặc 'GENERAL'
    campaign_name: string;      // Tên ngành hàng (ví dụ: 'Mở thẻ VP') hoặc 'Điểm thưởng chung'
    bonus_points: number;       // Số điểm cộng (ví dụ: 1.0, 0.5, 2.0)
    reason: string;             // Lý do (ví dụ: 'Mở thẻ VP đầu tiên')
    created_by?: string;
    created_at?: string;
    updated_at?: string;
}

export const EMPLOYEE_BONUSES_SQL = `-- 1. BẢNG LƯU TRỮ ĐIỂM CỘNG THI ĐUA NHÂN VIÊN TRÊN CLOUD SUPABASE
CREATE TABLE IF NOT EXISTS public.employee_emulation_bonuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    employee_name TEXT,
    month INT NOT NULL,
    year INT NOT NULL,
    bonus_date DATE NOT NULL,
    campaign_key TEXT DEFAULT 'GENERAL',
    campaign_name TEXT DEFAULT 'Điểm thưởng chung',
    bonus_points NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
    reason TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index tối ưu tốc độ truy vấn theo ST, kỳ tháng/năm và mã nhân viên
CREATE INDEX IF NOT EXISTS idx_emp_bonuses_store_period 
ON public.employee_emulation_bonuses(store_name, month, year);

CREATE INDEX IF NOT EXISTS idx_emp_bonuses_emp_id 
ON public.employee_emulation_bonuses(employee_id);

-- Kích hoạt RLS & Phân quyền bảo mật
ALTER TABLE public.employee_emulation_bonuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employee_emulation_bonuses_all_policy" ON public.employee_emulation_bonuses;
CREATE POLICY "employee_emulation_bonuses_all_policy" 
ON public.employee_emulation_bonuses FOR ALL USING (true) WITH CHECK (true);
`;

const LOCAL_STORAGE_KEY = 'saleshub_employee_bonuses_v1';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Sinh UUID v4 chuẩn để tương thích 100% với kiểu UUID của Supabase/PostgreSQL
 */
export function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try {
            return crypto.randomUUID();
        } catch { }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Đọc tất cả các bản ghi điểm cộng từ LocalStorage
 */
export function getLocalEmployeeBonuses(): EmployeeBonusItem[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        console.warn('Lỗi đọc employee_bonuses từ LocalStorage:', e);
    }
    return [];
}

/**
 * Lưu toàn bộ danh sách điểm cộng vào LocalStorage
 */
export function setLocalEmployeeBonuses(items: EmployeeBonusItem[]): void {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
        console.warn('Lỗi ghi employee_bonuses vào LocalStorage:', e);
    }
}

/**
 * Tải danh sách điểm cộng từ Supabase Cloud (đồng thời đồng bộ & fallback LocalStorage)
 */
export async function fetchEmployeeBonuses(options?: {
    storeName?: string;
    month?: number;
    year?: number;
    employeeId?: string;
    storesList?: Array<{ code?: string; name: string; id?: string }>;
}): Promise<EmployeeBonusItem[]> {
    const localItems = getLocalEmployeeBonuses();
    const { storeName, month, year, employeeId, storesList } = options || {};

    try {
        let query = supabase.from('employee_emulation_bonuses').select('*');

        if (month !== undefined && month > 0) {
            query = query.eq('month', month);
        }
        if (year !== undefined && year > 0) {
            query = query.eq('year', year);
        }
        if (employeeId) {
            query = query.eq('employee_id', employeeId.trim());
        }

        const { data, error } = await query.order('bonus_date', { ascending: false });

        if (!error && Array.isArray(data)) {
            const cloudItems: EmployeeBonusItem[] = data.map((d: any) => ({
                id: d.id,
                store_name: d.store_name,
                employee_id: d.employee_id,
                employee_name: d.employee_name || '',
                month: Number(d.month),
                year: Number(d.year),
                bonus_date: d.bonus_date ? String(d.bonus_date).substring(0, 10) : new Date().toISOString().substring(0, 10),
                campaign_key: d.campaign_key || 'GENERAL',
                campaign_name: d.campaign_name || 'Điểm thưởng chung',
                bonus_points: Number(d.bonus_points) || 1.0,
                reason: d.reason || '',
                created_by: d.created_by || '',
                created_at: d.created_at,
                updated_at: d.updated_at
            }));

            // Hợp nhất vào LocalStorage để hoạt động ngoại tuyến
            const map = new Map<string, EmployeeBonusItem>();
            localItems.forEach(item => map.set(item.id, item));
            cloudItems.forEach(item => map.set(item.id, item));
            const merged = Array.from(map.values());
            setLocalEmployeeBonuses(merged);

            // Lọc trả về theo ST nếu có
            return filterBonusList(cloudItems, storeName, month, year, employeeId, storesList);
        } else if (error) {
            console.warn('Lỗi đọc Cloud Supabase employee_emulation_bonuses:', error.message);
        }
    } catch (err) {
        console.warn('Lỗi kết nối Supabase employee_emulation_bonuses, sử dụng LocalStorage fallback:', err);
    }

    // Fallback LocalStorage
    return filterBonusList(localItems, storeName, month, year, employeeId, storesList);
}

function filterBonusList(
    items: EmployeeBonusItem[],
    storeName?: string,
    month?: number,
    year?: number,
    employeeId?: string,
    storesList?: Array<{ code?: string; name: string; id?: string }>
): EmployeeBonusItem[] {
    return items.filter(item => {
        if (month !== undefined && month > 0 && item.month !== month) return false;
        if (year !== undefined && year > 0 && item.year !== year) return false;
        if (employeeId && item.employee_id.trim() !== employeeId.trim()) return false;
        if (storeName && storeName !== 'all' && storeName !== 'Tổng' && storeName !== 'Toàn Cụm ST') {
            if (!isStoreMatch(item.store_name, storeName, storesList)) return false;
        }
        return true;
    });
}

/**
 * Thêm hoặc cập nhật bản ghi điểm cộng trực tiếp lên Cloud Supabase & LocalStorage
 */
export async function saveEmployeeBonus(
    bonusData: Omit<EmployeeBonusItem, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<{ success: boolean; cloudSaved: boolean; data?: EmployeeBonusItem; error?: string }> {
    try {
        const id = (bonusData.id && UUID_REGEX.test(bonusData.id)) ? bonusData.id : generateUUID();
        const now = new Date().toISOString();

        const newItem: EmployeeBonusItem = {
            ...bonusData,
            id,
            created_at: now,
            updated_at: now
        };

        // 1. Lưu vào LocalStorage ngay lập tức để giữ an toàn dữ liệu
        const localList = getLocalEmployeeBonuses();
        const existingIdx = localList.findIndex(item => item.id === id);
        if (existingIdx >= 0) {
            localList[existingIdx] = newItem;
        } else {
            localList.unshift(newItem);
        }
        setLocalEmployeeBonuses(localList);

        // 2. Đồng bộ lên Cloud Supabase (Chỉ truyền các trường có trong schema của bảng)
        let cloudSaved = false;
        let cloudErrorMsg: string | undefined;

        try {
            const rowToUpsert = {
                id: newItem.id,
                store_name: newItem.store_name,
                employee_id: newItem.employee_id,
                employee_name: newItem.employee_name || '',
                month: newItem.month,
                year: newItem.year,
                bonus_date: newItem.bonus_date,
                campaign_key: newItem.campaign_key || 'GENERAL',
                campaign_name: newItem.campaign_name || 'Điểm thưởng chung',
                bonus_points: newItem.bonus_points,
                reason: newItem.reason,
                created_by: newItem.created_by || '',
                updated_at: now
            };

            const { data, error } = await supabase
                .from('employee_emulation_bonuses')
                .upsert([rowToUpsert])
                .select();

            if (error) {
                console.error('Lỗi lưu Cloud Supabase employee_emulation_bonuses:', error);
                cloudErrorMsg = error.message;
            } else {
                cloudSaved = true;
                if (data && data[0] && data[0].id) {
                    newItem.id = data[0].id;
                }
            }
        } catch (cloudErr: any) {
            console.error('Không thể kết nối Cloud Supabase:', cloudErr);
            cloudErrorMsg = cloudErr?.message || 'Lỗi kết nối máy chủ Cloud';
        }

        if (!cloudSaved) {
            return {
                success: false,
                cloudSaved: false,
                data: newItem,
                error: cloudErrorMsg || 'Không thể lưu lên Supabase Cloud'
            };
        }

        return { success: true, cloudSaved: true, data: newItem };
    } catch (e: any) {
        console.error('Lỗi saveEmployeeBonus:', e);
        return { success: false, cloudSaved: false, error: e?.message || 'Không thể lưu điểm cộng' };
    }
}

/**
 * Xóa một bản ghi điểm cộng trên LocalStorage và Cloud Supabase
 */
export async function deleteEmployeeBonus(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Xóa khỏi LocalStorage
        const localList = getLocalEmployeeBonuses();
        const updated = localList.filter(item => item.id !== id);
        setLocalEmployeeBonuses(updated);

        // 2. Xóa trên Supabase Cloud
        try {
            if (UUID_REGEX.test(id)) {
                const { error } = await supabase
                    .from('employee_emulation_bonuses')
                    .delete()
                    .eq('id', id);

                if (error) {
                    console.warn('Lỗi xóa Cloud Supabase employee_emulation_bonuses:', error.message);
                }
            }
        } catch (cloudErr) {
            console.warn('Không thể xóa Cloud Supabase:', cloudErr);
        }

        return { success: true };
    } catch (e: any) {
        console.error('Lỗi deleteEmployeeBonus:', e);
        return { success: false, error: e?.message || 'Không thể xóa điểm cộng' };
    }
}

/**
 * Đồng bộ tất cả các bản ghi điểm cộng từ LocalStorage chưa có trên Cloud lên Supabase
 */
export async function syncLocalBonusesToCloud(): Promise<{
    success: boolean;
    syncedCount: number;
    error?: string;
}> {
    const localItems = getLocalEmployeeBonuses();
    if (localItems.length === 0) return { success: true, syncedCount: 0 };

    try {
        const rowsToSync = localItems.map(item => ({
            id: UUID_REGEX.test(item.id) ? item.id : generateUUID(),
            store_name: item.store_name,
            employee_id: item.employee_id,
            employee_name: item.employee_name || '',
            month: item.month,
            year: item.year,
            bonus_date: item.bonus_date,
            campaign_key: item.campaign_key || 'GENERAL',
            campaign_name: item.campaign_name || 'Điểm thưởng chung',
            bonus_points: Number(item.bonus_points) || 1.0,
            reason: item.reason,
            created_by: item.created_by || '',
            updated_at: new Date().toISOString()
        }));

        const { data, error } = await supabase
            .from('employee_emulation_bonuses')
            .upsert(rowsToSync)
            .select();

        if (error) {
            return { success: false, syncedCount: 0, error: error.message };
        }

        if (data && Array.isArray(data)) {
            // Cập nhật lại LocalStorage với id chuẩn UUID từ Supabase
            const updatedLocal: EmployeeBonusItem[] = data.map((d: any) => ({
                id: d.id,
                store_name: d.store_name,
                employee_id: d.employee_id,
                employee_name: d.employee_name || '',
                month: Number(d.month),
                year: Number(d.year),
                bonus_date: d.bonus_date ? String(d.bonus_date).substring(0, 10) : new Date().toISOString().substring(0, 10),
                campaign_key: d.campaign_key || 'GENERAL',
                campaign_name: d.campaign_name || 'Điểm thưởng chung',
                bonus_points: Number(d.bonus_points) || 1.0,
                reason: d.reason || '',
                created_by: d.created_by || '',
                created_at: d.created_at,
                updated_at: d.updated_at
            }));
            setLocalEmployeeBonuses(updatedLocal);
            return { success: true, syncedCount: updatedLocal.length };
        }

        return { success: true, syncedCount: rowsToSync.length };
    } catch (e: any) {
        return { success: false, syncedCount: 0, error: e?.message || 'Lỗi đồng bộ' };
    }
}

/**
 * Cấu trúc dữ liệu tổng hợp điểm cộng theo từng nhân viên
 */
export interface EmployeeBonusSummary {
    totalBonusPoints: number;
    campaignBonusPoints: Record<string, number>;
    items: EmployeeBonusItem[];
}

/**
 * Tạo bản đồ tổng hợp điểm cộng theo từng employee_id
 */
export function buildEmployeeBonusSummaryMap(
    bonuses: EmployeeBonusItem[]
): Record<string, EmployeeBonusSummary> {
    const map: Record<string, EmployeeBonusSummary> = {};

    bonuses.forEach(b => {
        const empId = (b.employee_id || '').trim();
        if (!empId) return;

        if (!map[empId]) {
            map[empId] = {
                totalBonusPoints: 0,
                campaignBonusPoints: {},
                items: []
            };
        }

        const pts = Number(b.bonus_points) || 0;
        map[empId].totalBonusPoints = Number((map[empId].totalBonusPoints + pts).toFixed(2));
        map[empId].items.push(b);

        const cKey = (b.campaign_key || 'GENERAL').trim();
        map[empId].campaignBonusPoints[cKey] = Number(((map[empId].campaignBonusPoints[cKey] || 0) + pts).toFixed(2));
    });

    return map;
}

/**
 * Kiểm tra trạng thái sẵn sàng của bảng employee_emulation_bonuses trên Supabase Cloud
 */
export async function checkSupabaseEmployeeBonusReady(): Promise<{
    isReady: boolean;
    count: number;
    error?: string;
}> {
    try {
        const { count, error } = await supabase
            .from('employee_emulation_bonuses')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return {
                isReady: false,
                count: 0,
                error: error.message
            };
        }

        return {
            isReady: true,
            count: count || 0
        };
    } catch (err: any) {
        return {
            isReady: false,
            count: 0,
            error: err?.message || 'Không thể kết nối máy chủ Supabase'
        };
    }
}
