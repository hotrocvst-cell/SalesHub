import { supabase } from '../../../core/lib/supabase';
import { isStoreMatch } from '../../../core/lib/formatters';

export type TargetCategory = 'TARGET' | 'TASK' | 'REMINDER' | 'CAMPAIGN';
export type TargetPriority = 'HIGH' | 'MEDIUM' | 'NORMAL';

export interface DailyWorkTarget {
    id: string;
    store_name: string;        // Tên siêu thị cụ thể hoặc '__ALL_ASSIGNED__' (Toàn nhóm siêu thị phụ trách)
    date_key: string;          // YYYY-MM-DD
    title: string;             // Nội dung mục tiêu / ghi chú
    category: TargetCategory;  // Phân loại: 🎯 Mục tiêu | 📋 Giao việc | 📢 Nhắc nhở | 🏆 Thi đua
    target_value?: string;     // Chỉ tiêu định lượng (nếu có: e.g. "50 Triệu", "10 iPhone", "15 Sim")
    priority: TargetPriority;  // Mức độ ưu tiên: HIGH (Cao/Khẩn cấp), MEDIUM (Quan trọng), NORMAL (Tiêu chuẩn)
    is_completed: boolean;     // Trạng thái hoàn thành
    created_by_id?: string;    // ID người tạo
    created_by_name: string;   // Tên người tạo (ví dụ: QL Nguyễn Văn A)
    created_by_role: string;   // Vai trò người tạo: ADMIN | QUAN_LY | TRUONG_CA
    created_at: string;        // ISO timestamp
    updated_at: string;        // ISO timestamp
}

export const LOCAL_STORAGE_TARGETS_KEY = 'saleshub_daily_work_targets_v2';
export const LEGACY_NOTES_KEY = 'saleshub_homepage_calendar_notes_v1';
export const ALL_ASSIGNED_STORE_KEY = '__ALL_ASSIGNED__';

export const CATEGORY_CONFIG: Record<TargetCategory, { label: string; icon: string; color: string; bg: string; border: string }> = {
    TARGET: {
        label: 'Mục tiêu kinh doanh',
        icon: '🎯',
        color: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border-rose-200'
    },
    TASK: {
        label: 'Giao việc ca',
        icon: '📋',
        color: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200'
    },
    REMINDER: {
        label: 'Nhắc nhở ca',
        icon: '📢',
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200'
    },
    CAMPAIGN: {
        label: 'Thi đua / Thưởng',
        icon: '🏆',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200'
    }
};

export const PRIORITY_CONFIG: Record<TargetPriority, { label: string; color: string; badge: string }> = {
    HIGH: {
        label: 'Khẩn cấp / Ưu tiên cao',
        color: 'text-rose-600',
        badge: 'bg-rose-100 text-rose-800 border-rose-200'
    },
    MEDIUM: {
        label: 'Quan trọng',
        color: 'text-amber-600',
        badge: 'bg-amber-100 text-amber-800 border-amber-200'
    },
    NORMAL: {
        label: 'Tiêu chuẩn',
        color: 'text-slate-600',
        badge: 'bg-slate-100 text-slate-700 border-slate-200'
    }
};

export const DAILY_WORK_TARGETS_SQL = `-- Bảng lưu trữ Ghi chú công việc & Mục tiêu ngày theo siêu thị và nhóm phụ trách
CREATE TABLE IF NOT EXISTS public.daily_work_targets (
    id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    date_key TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'TARGET',
    target_value TEXT,
    priority TEXT DEFAULT 'NORMAL',
    is_completed BOOLEAN DEFAULT FALSE,
    created_by_id TEXT,
    created_by_name TEXT,
    created_by_role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kích hoạt RLS và tạo chính sách truy cập toàn quyền
ALTER TABLE public.daily_work_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_work_targets_all_policy" ON public.daily_work_targets;
CREATE POLICY "daily_work_targets_all_policy" 
ON public.daily_work_targets FOR ALL USING (true) WITH CHECK (true);

-- Đánh index tăng tốc truy vấn theo ngày và siêu thị
CREATE INDEX IF NOT EXISTS idx_daily_work_targets_date ON public.daily_work_targets(date_key);
CREATE INDEX IF NOT EXISTS idx_daily_work_targets_store ON public.daily_work_targets(store_name);
`;

/**
 * Kiểm tra xem bảng daily_work_targets đã tồn tại trên Supabase chưa
 */
export async function checkSupabaseDailyTargetsTable(): Promise<{ exists: boolean; count: number; error?: string }> {
    try {
        const { count, error } = await supabase
            .from('daily_work_targets')
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
 * Nạp tất cả dữ liệu từ LocalStorage và thực hiện tự động di chuyển dữ liệu cũ từ bản v1 nếu có
 */
export function getLocalDailyTargets(): DailyWorkTarget[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_TARGETS_KEY);
        let targets: DailyWorkTarget[] = raw ? JSON.parse(raw) : [];

        // Kiểm tra và migrate từ legacy note v1 nếu người dùng đã có ghi chú cũ
        try {
            const legacyRaw = localStorage.getItem(LEGACY_NOTES_KEY);
            if (legacyRaw) {
                const legacyNotes: Record<string, string> = JSON.parse(legacyRaw);
                const legacyKeys = Object.keys(legacyNotes);
                let migratedCount = 0;

                for (const dateKey of legacyKeys) {
                    const text = legacyNotes[dateKey]?.trim();
                    if (!text) continue;

                    // Kiểm tra xem đã có target nào cho ngày này chưa
                    const exists = targets.some(t => t.date_key === dateKey && t.title === text);
                    if (!exists) {
                        targets.push({
                            id: `migrated_${dateKey}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                            store_name: ALL_ASSIGNED_STORE_KEY,
                            date_key: dateKey,
                            title: text,
                            category: 'TARGET',
                            priority: 'NORMAL',
                            is_completed: false,
                            created_by_name: 'Ghi chú hệ thống',
                            created_by_role: 'QUAN_LY',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                        migratedCount++;
                    }
                }

                if (migratedCount > 0) {
                    saveLocalDailyTargets(targets);
                }
            }
        } catch (migErr) {
            console.warn('Lỗi khi migrate ghi chú cũ:', migErr);
        }

        return targets;
    } catch (e) {
        console.error('Lỗi đọc daily targets từ localStorage:', e);
        return [];
    }
}

/**
 * Lưu toàn bộ danh sách DailyWorkTarget vào LocalStorage
 */
export function saveLocalDailyTargets(targets: DailyWorkTarget[]) {
    try {
        localStorage.setItem(LOCAL_STORAGE_TARGETS_KEY, JSON.stringify(targets));
    } catch (e) {
        console.warn('Lỗi ghi daily targets vào localStorage:', e);
    }
}

/**
 * Tải dữ liệu từ Supabase Cloud
 */
export async function fetchCloudDailyTargets(): Promise<{ success: boolean; data: DailyWorkTarget[]; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('daily_work_targets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped: DailyWorkTarget[] = (data || []).map((row: any) => ({
            id: String(row.id),
            store_name: row.store_name || ALL_ASSIGNED_STORE_KEY,
            date_key: row.date_key,
            title: row.title || '',
            category: (row.category as TargetCategory) || 'TARGET',
            target_value: row.target_value || '',
            priority: (row.priority as TargetPriority) || 'NORMAL',
            is_completed: Boolean(row.is_completed),
            created_by_id: row.created_by_id,
            created_by_name: row.created_by_name || 'Quản lý',
            created_by_role: row.created_by_role || 'QUAN_LY',
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString()
        }));

        return { success: true, data: mapped };
    } catch (e: any) {
        return { success: false, data: [], error: e.message || String(e) };
    }
}

/**
 * Hợp nhất Cloud và LocalStorage
 */
export async function syncDailyTargets(): Promise<DailyWorkTarget[]> {
    const localTargets = getLocalDailyTargets();
    try {
        const cloudRes = await fetchCloudDailyTargets();
        if (cloudRes.success && cloudRes.data.length > 0) {
            // Hợp nhất ưu tiên bản ghi mới nhất theo updated_at
            const targetMap = new Map<string, DailyWorkTarget>();
            localTargets.forEach(t => targetMap.set(t.id, t));

            cloudRes.data.forEach(cloudItem => {
                const localItem = targetMap.get(cloudItem.id);
                if (!localItem) {
                    targetMap.set(cloudItem.id, cloudItem);
                } else {
                    const localTime = new Date(localItem.updated_at || localItem.created_at).getTime();
                    const cloudTime = new Date(cloudItem.updated_at || cloudItem.created_at).getTime();
                    if (cloudTime >= localTime) {
                        targetMap.set(cloudItem.id, cloudItem);
                    }
                }
            });

            const merged = Array.from(targetMap.values());
            saveLocalDailyTargets(merged);
            return merged;
        }
    } catch {
        // Supabase không khả dụng hoặc chưa có bảng, tiếp tục với local
    }
    return localTargets;
}

/**
 * Thêm mới một mục tiêu / ghi chú ngày
 */
export async function addDailyTarget(
    targetInput: Omit<DailyWorkTarget, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; target?: DailyWorkTarget; error?: string }> {
    try {
        const newTarget: DailyWorkTarget = {
            ...targetInput,
            id: `target_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // 1. Lưu ngay vào LocalStorage
        const currentList = getLocalDailyTargets();
        const updatedList = [newTarget, ...currentList];
        saveLocalDailyTargets(updatedList);

        // 2. Đồng bộ ngầm lên Supabase Cloud nếu có bảng
        try {
            await supabase.from('daily_work_targets').insert([{
                id: newTarget.id,
                store_name: newTarget.store_name,
                date_key: newTarget.date_key,
                title: newTarget.title,
                category: newTarget.category,
                target_value: newTarget.target_value || null,
                priority: newTarget.priority,
                is_completed: newTarget.is_completed,
                created_by_id: newTarget.created_by_id || null,
                created_by_name: newTarget.created_by_name,
                created_by_role: newTarget.created_by_role,
                created_at: newTarget.created_at,
                updated_at: newTarget.updated_at
            }]);
        } catch (cloudErr) {
            console.warn('Lưu Supabase ngầm thất bại (sẽ lưu local):', cloudErr);
        }

        return { success: true, target: newTarget };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

/**
 * Xóa một mục tiêu theo ID
 */
export async function deleteDailyTarget(id: string): Promise<boolean> {
    try {
        const currentList = getLocalDailyTargets();
        const updatedList = currentList.filter(t => t.id !== id);
        saveLocalDailyTargets(updatedList);

        try {
            await supabase.from('daily_work_targets').delete().eq('id', id);
        } catch {
            // ignore
        }
        return true;
    } catch (e) {
        console.error('Lỗi xóa daily target:', e);
        return false;
    }
}

/**
 * Đổi trạng thái hoàn thành của một mục tiêu
 */
export async function toggleDailyTargetComplete(id: string): Promise<boolean> {
    try {
        const currentList = getLocalDailyTargets();
        const target = currentList.find(t => t.id === id);
        if (!target) return false;

        const newStatus = !target.is_completed;
        const nowIso = new Date().toISOString();
        target.is_completed = newStatus;
        target.updated_at = nowIso;

        saveLocalDailyTargets(currentList);

        try {
            await supabase
                .from('daily_work_targets')
                .update({ is_completed: newStatus, updated_at: nowIso })
                .eq('id', id);
        } catch {
            // ignore
        }
        return true;
    } catch (e) {
        console.error('Lỗi toggle hoàn thành daily target:', e);
        return false;
    }
}

/**
 * Cập nhật thông tin chi tiết một mục tiêu
 */
export async function updateDailyTarget(
    id: string,
    updates: Partial<Omit<DailyWorkTarget, 'id' | 'created_at'>>
): Promise<boolean> {
    try {
        const currentList = getLocalDailyTargets();
        const target = currentList.find(t => t.id === id);
        if (!target) return false;

        Object.assign(target, updates, { updated_at: new Date().toISOString() });
        saveLocalDailyTargets(currentList);

        try {
            await supabase
                .from('daily_work_targets')
                .update({
                    ...updates,
                    updated_at: target.updated_at
                })
                .eq('id', id);
        } catch {
            // ignore
        }
        return true;
    } catch (e) {
        console.error('Lỗi update daily target:', e);
        return false;
    }
}

/**
 * Lọc danh sách mục tiêu hiển thị theo ngày được chọn & Nhóm siêu thị đang phụ trách
 */
export function filterTargetsForView(
    targets: DailyWorkTarget[],
    dateKey: string,
    selectedStore: string, // '__ALL_ASSIGNED__' hoặc Tên siêu thị cụ thể
    userAccessibleStores: string[],
    userRole: string,
    currentUserStoreName?: string
): DailyWorkTarget[] {
    // 1. Lọc theo ngày
    const dateTargets = targets.filter(t => t.date_key === dateKey);

    // 2. Lọc theo vai trò và siêu thị
    if (userRole === 'NHAN_VIEN') {
        // Nhân viên chỉ được xem siêu thị của mình hoặc mục tiêu gán cho Toàn nhóm / Tất cả
        const myStore = currentUserStoreName?.trim() || '';
        return dateTargets.filter(t => {
            if (t.store_name === ALL_ASSIGNED_STORE_KEY || t.store_name === 'all') return true;
            if (!myStore) return true;
            return isStoreMatch(t.store_name, myStore);
        });
    }

    if (userRole === 'ADMIN') {
        // Admin xem theo selectedStore
        if (selectedStore === ALL_ASSIGNED_STORE_KEY || selectedStore === 'all') {
            return dateTargets;
        }
        return dateTargets.filter(t => {
            return t.store_name === ALL_ASSIGNED_STORE_KEY || isStoreMatch(t.store_name, selectedStore);
        });
    }

    // Quản lý (QUAN_LY) hoặc Trưởng ca (TRUONG_CA)
    const accessible = userAccessibleStores.length > 0
        ? userAccessibleStores
        : (currentUserStoreName ? [currentUserStoreName] : []);

    if (selectedStore === ALL_ASSIGNED_STORE_KEY || selectedStore === 'all') {
        // Xem toàn bộ nhóm siêu thị mình phụ trách
        return dateTargets.filter(t => {
            if (t.store_name === ALL_ASSIGNED_STORE_KEY || t.store_name === 'all') return true;
            return accessible.some(acc => isStoreMatch(t.store_name, acc));
        });
    }

    // Chọn 1 siêu thị cụ thể trong nhóm
    return dateTargets.filter(t => {
        if (t.store_name === ALL_ASSIGNED_STORE_KEY) return true;
        return isStoreMatch(t.store_name, selectedStore);
    });
}

/**
 * Lấy bản đồ số lượng mục tiêu cho từng ngày trong tháng để hiển thị trên ô lịch
 */
export function getMonthTargetStatsMap(
    targets: DailyWorkTarget[],
    year: number,
    month: number, // 0 - 11
    selectedStore: string,
    userAccessibleStores: string[],
    userRole: string,
    currentUserStoreName?: string
): Record<string, { total: number; completed: number; hasUrgent: boolean }> {
    const map: Record<string, { total: number; completed: number; hasUrgent: boolean }> = {};
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    // Lọc trước các targets trong tháng
    const monthTargets = targets.filter(t => t.date_key.startsWith(prefix));

    for (const target of monthTargets) {
        // Kiểm tra xem target có thuộc phạm vi siêu thị đang xem không
        let matchesStore = false;
        if (userRole === 'NHAN_VIEN') {
            const myStore = currentUserStoreName?.trim() || '';
            matchesStore = target.store_name === ALL_ASSIGNED_STORE_KEY || target.store_name === 'all' || isStoreMatch(target.store_name, myStore);
        } else if (userRole === 'ADMIN') {
            matchesStore = (selectedStore === ALL_ASSIGNED_STORE_KEY || selectedStore === 'all') ||
                target.store_name === ALL_ASSIGNED_STORE_KEY ||
                isStoreMatch(target.store_name, selectedStore);
        } else {
            // QL / TC
            const accessible = userAccessibleStores.length > 0
                ? userAccessibleStores
                : (currentUserStoreName ? [currentUserStoreName] : []);

            if (selectedStore === ALL_ASSIGNED_STORE_KEY || selectedStore === 'all') {
                matchesStore = target.store_name === ALL_ASSIGNED_STORE_KEY || accessible.some(acc => isStoreMatch(target.store_name, acc));
            } else {
                matchesStore = target.store_name === ALL_ASSIGNED_STORE_KEY || isStoreMatch(target.store_name, selectedStore);
            }
        }

        if (matchesStore) {
            const dateKey = target.date_key;
            if (!map[dateKey]) {
                map[dateKey] = { total: 0, completed: 0, hasUrgent: false };
            }
            map[dateKey].total += 1;
            if (target.is_completed) {
                map[dateKey].completed += 1;
            }
            if (target.priority === 'HIGH') {
                map[dateKey].hasUrgent = true;
            }
        }
    }

    return map;
}
