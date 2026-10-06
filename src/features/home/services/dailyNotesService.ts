import { supabase } from '../../../core/lib/supabase';
import { isStoreMatch } from '../../../core/lib/formatters';

export interface DailyWorkNote {
    id: string;
    store_name: string;        // Tên siêu thị cụ thể hoặc '__ALL_ASSIGNED__' (Toàn nhóm siêu thị phụ trách)
    date_key: string;          // YYYY-MM-DD
    title: string;             // Tiêu đề ghi chú / công việc (hiển thị trên lịch tổng)
    content?: string;          // Nội dung chi tiết ghi chú / công việc cần làm
    created_by_id?: string;    // ID người tạo
    created_by_name: string;   // Tên người tạo
    created_by_role: string;   // Vai trò người tạo: ADMIN | QUAN_LY | TRUONG_CA
    created_at: string;        // ISO timestamp
    updated_at: string;        // ISO timestamp
}

export const LOCAL_STORAGE_NOTES_KEY = 'saleshub_daily_work_targets_v2';
export const LEGACY_NOTES_KEY = 'saleshub_homepage_calendar_notes_v1';
export const ALL_ASSIGNED_STORE_KEY = '__ALL_ASSIGNED__';

export const DAILY_WORK_NOTES_SQL = `-- Bảng lưu trữ Ghi chú & Công việc cần làm theo ngày và siêu thị phụ trách
CREATE TABLE IF NOT EXISTS public.daily_work_targets (
    id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    date_key TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
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
 * Nạp tất cả dữ liệu từ LocalStorage và thực hiện tự động di chuyển dữ liệu cũ nếu có
 */
export function getLocalDailyNotes(): DailyWorkNote[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_NOTES_KEY);
        let list: any[] = raw ? JSON.parse(raw) : [];

        // Chuyển đổi linh hoạt đảm bảo có cả title và content
        let notes: DailyWorkNote[] = list.map(item => ({
            id: String(item.id || `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
            store_name: item.store_name || ALL_ASSIGNED_STORE_KEY,
            date_key: item.date_key,
            title: item.title || item.text || 'Ghi chú công việc',
            content: item.content || (item.text !== item.title ? item.text : '') || '',
            created_by_id: item.created_by_id,
            created_by_name: item.created_by_name || 'Quản lý',
            created_by_role: item.created_by_role || 'QUAN_LY',
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString()
        }));

        // Kiểm tra và migrate từ legacy note v1 nếu người dùng đã có ghi chú cũ dạng text
        try {
            const legacyRaw = localStorage.getItem(LEGACY_NOTES_KEY);
            if (legacyRaw) {
                const legacyNotes: Record<string, string> = JSON.parse(legacyRaw);
                const legacyKeys = Object.keys(legacyNotes);
                let migratedCount = 0;

                for (const dateKey of legacyKeys) {
                    const text = legacyNotes[dateKey]?.trim();
                    if (!text) continue;

                    const exists = notes.some(t => t.date_key === dateKey && (t.title === text || t.content === text));
                    if (!exists) {
                        notes.push({
                            id: `migrated_${dateKey}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                            store_name: ALL_ASSIGNED_STORE_KEY,
                            date_key: dateKey,
                            title: text.length > 50 ? `${text.substring(0, 47)}...` : text,
                            content: text,
                            created_by_name: 'Ghi chú hệ thống',
                            created_by_role: 'QUAN_LY',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                        migratedCount++;
                    }
                }

                if (migratedCount > 0) {
                    saveLocalDailyNotes(notes);
                }
            }
        } catch (migErr) {
            console.warn('Lỗi khi migrate ghi chú cũ:', migErr);
        }

        return notes;
    } catch (e) {
        console.error('Lỗi đọc daily notes từ localStorage:', e);
        return [];
    }
}

/**
 * Lưu toàn bộ danh sách DailyWorkNote vào LocalStorage
 */
export function saveLocalDailyNotes(notes: DailyWorkNote[]) {
    try {
        localStorage.setItem(LOCAL_STORAGE_NOTES_KEY, JSON.stringify(notes));
    } catch (e) {
        console.warn('Lỗi ghi daily notes vào localStorage:', e);
    }
}

/**
 * Tải dữ liệu từ Supabase Cloud
 */
export async function fetchCloudDailyNotes(): Promise<{ success: boolean; data: DailyWorkNote[]; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('daily_work_targets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped: DailyWorkNote[] = (data || []).map((row: any) => ({
            id: String(row.id),
            store_name: row.store_name || ALL_ASSIGNED_STORE_KEY,
            date_key: row.date_key,
            title: row.title || row.content || 'Ghi chú',
            content: row.content || '',
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
export async function syncDailyNotes(): Promise<DailyWorkNote[]> {
    const localNotes = getLocalDailyNotes();
    try {
        const cloudRes = await fetchCloudDailyNotes();
        if (cloudRes.success && cloudRes.data.length > 0) {
            const noteMap = new Map<string, DailyWorkNote>();
            localNotes.forEach(t => noteMap.set(t.id, t));

            cloudRes.data.forEach(cloudItem => {
                const localItem = noteMap.get(cloudItem.id);
                if (!localItem) {
                    noteMap.set(cloudItem.id, cloudItem);
                } else {
                    const localTime = new Date(localItem.updated_at || localItem.created_at).getTime();
                    const cloudTime = new Date(cloudItem.updated_at || cloudItem.created_at).getTime();
                    if (cloudTime >= localTime) {
                        noteMap.set(cloudItem.id, cloudItem);
                    }
                }
            });

            const merged = Array.from(noteMap.values());
            saveLocalDailyNotes(merged);
            return merged;
        }
    } catch {
        // Supabase không khả dụng hoặc chưa có bảng, tiếp tục với local
    }
    return localNotes;
}

/**
 * Thêm mới một ghi chú / công việc ngày
 */
export async function addDailyNote(
    noteInput: Omit<DailyWorkNote, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; note?: DailyWorkNote; error?: string }> {
    try {
        const newNote: DailyWorkNote = {
            ...noteInput,
            id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // 1. Lưu ngay vào LocalStorage
        const currentList = getLocalDailyNotes();
        const updatedList = [newNote, ...currentList];
        saveLocalDailyNotes(updatedList);

        // 2. Đồng bộ ngầm lên Supabase Cloud nếu có bảng
        try {
            await supabase.from('daily_work_targets').insert([{
                id: newNote.id,
                store_name: newNote.store_name,
                date_key: newNote.date_key,
                title: newNote.title,
                content: newNote.content || null,
                created_by_id: newNote.created_by_id || null,
                created_by_name: newNote.created_by_name,
                created_by_role: newNote.created_by_role,
                created_at: newNote.created_at,
                updated_at: newNote.updated_at
            }]);
        } catch (cloudErr) {
            console.warn('Lưu Supabase ngầm thất bại (tiếp tục lưu local):', cloudErr);
        }

        return { success: true, note: newNote };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

/**
 * Cập nhật tiêu đề hoặc nội dung ghi chú
 */
export async function updateDailyNote(
    id: string,
    updates: Partial<Omit<DailyWorkNote, 'id' | 'created_at'>>
): Promise<boolean> {
    try {
        const currentList = getLocalDailyNotes();
        const note = currentList.find(t => t.id === id);
        if (!note) return false;

        Object.assign(note, updates, { updated_at: new Date().toISOString() });
        saveLocalDailyNotes(currentList);

        try {
            await supabase
                .from('daily_work_targets')
                .update({
                    ...updates,
                    updated_at: note.updated_at
                })
                .eq('id', id);
        } catch {
            // ignore
        }
        return true;
    } catch (e) {
        console.error('Lỗi update daily note:', e);
        return false;
    }
}

/**
 * Xóa một ghi chú theo ID
 */
export async function deleteDailyNote(id: string): Promise<boolean> {
    try {
        const currentList = getLocalDailyNotes();
        const updatedList = currentList.filter(t => t.id !== id);
        saveLocalDailyNotes(updatedList);

        try {
            await supabase.from('daily_work_targets').delete().eq('id', id);
        } catch {
            // ignore
        }
        return true;
    } catch (e) {
        console.error('Lỗi xóa daily note:', e);
        return false;
    }
}

/**
 * Lọc danh sách ghi chú theo ngày được chọn & Nhóm siêu thị đang phụ trách
 */
export function filterNotesForView(
    notes: DailyWorkNote[],
    dateKey: string,
    selectedStore: string, // '__ALL_ASSIGNED__' hoặc Tên siêu thị cụ thể
    userAccessibleStores: string[],
    userRole: string,
    currentUserStoreName?: string
): DailyWorkNote[] {
    const dateNotes = notes.filter(t => t.date_key === dateKey);

    if (userRole === 'NHAN_VIEN') {
        const myStore = currentUserStoreName?.trim() || '';
        return dateNotes.filter(t => {
            if (t.store_name === ALL_ASSIGNED_STORE_KEY || t.store_name === 'all') return true;
            if (!myStore) return true;
            return isStoreMatch(t.store_name, myStore);
        });
    }

    if (userRole === 'ADMIN') {
        if (selectedStore === ALL_ASSIGNED_STORE_KEY || selectedStore === 'all') {
            return dateNotes;
        }
        return dateNotes.filter(t => {
            return t.store_name === ALL_ASSIGNED_STORE_KEY || isStoreMatch(t.store_name, selectedStore);
        });
    }

    // Quản lý (QUAN_LY) hoặc Trưởng ca (TRUONG_CA)
    const accessible = userAccessibleStores.length > 0
        ? userAccessibleStores
        : (currentUserStoreName ? [currentUserStoreName] : []);

    if (selectedStore === ALL_ASSIGNED_STORE_KEY || selectedStore === 'all') {
        return dateNotes.filter(t => {
            if (t.store_name === ALL_ASSIGNED_STORE_KEY || t.store_name === 'all') return true;
            return accessible.some(acc => isStoreMatch(t.store_name, acc));
        });
    }

    return dateNotes.filter(t => {
        if (t.store_name === ALL_ASSIGNED_STORE_KEY) return true;
        return isStoreMatch(t.store_name, selectedStore);
    });
}

/**
 * Lấy bản đồ danh sách ghi chú cho từng ngày trong tháng để hiển thị trực tiếp tiêu đề lên lịch tổng
 */
export function getMonthNotesMap(
    notes: DailyWorkNote[],
    year: number,
    month: number, // 0 - 11
    selectedStore: string,
    userAccessibleStores: string[],
    userRole: string,
    currentUserStoreName?: string
): Record<string, DailyWorkNote[]> {
    const map: Record<string, DailyWorkNote[]> = {};
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthNotes = notes.filter(t => t.date_key.startsWith(prefix));

    for (const note of monthNotes) {
        let matchesStore = false;
        if (userRole === 'NHAN_VIEN') {
            const myStore = currentUserStoreName?.trim() || '';
            matchesStore = note.store_name === ALL_ASSIGNED_STORE_KEY || note.store_name === 'all' || isStoreMatch(note.store_name, myStore);
        } else if (userRole === 'ADMIN') {
            matchesStore = (selectedStore === ALL_ASSIGNED_STORE_KEY || selectedStore === 'all') ||
                note.store_name === ALL_ASSIGNED_STORE_KEY ||
                isStoreMatch(note.store_name, selectedStore);
        } else {
            const accessible = userAccessibleStores.length > 0
                ? userAccessibleStores
                : (currentUserStoreName ? [currentUserStoreName] : []);

            if (selectedStore === ALL_ASSIGNED_STORE_KEY || selectedStore === 'all') {
                matchesStore = note.store_name === ALL_ASSIGNED_STORE_KEY || accessible.some(acc => isStoreMatch(note.store_name, acc));
            } else {
                matchesStore = note.store_name === ALL_ASSIGNED_STORE_KEY || isStoreMatch(note.store_name, selectedStore);
            }
        }

        if (matchesStore) {
            const dateKey = note.date_key;
            if (!map[dateKey]) {
                map[dateKey] = [];
            }
            map[dateKey].push(note);
        }
    }

    return map;
}
