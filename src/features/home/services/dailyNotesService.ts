import { supabase } from '../../../core/lib/supabase';
import { isStoreMatch } from '../../../core/lib/formatters';
import { getLunarDate, type LunarDate } from '../utils/lunarCalendar';

export type WorkTaskType =
    | 'CONG_VIEC'      // Công việc bán hàng / nghiệp vụ
    | 'SU_KIEN'        // Sự kiện / Chương trình
    | 'NHAC_NHO'       // Nhắc nhở
    | 'CUNG_LE'        // Cúng mùng 2, 16 / Lễ cúng
    | 'HOP_CA'         // Họp giao ban / giao ca
    | 'KIEM_KE'        // Kiểm kê / Kiểm kho
    | 'KHAC';          // Khác

export type WorkTaskRecurrence =
    | 'NONE'           // Không lặp lại
    | 'DAILY'          // Lặp lại hàng ngày
    | 'WEEKLY'         // Lặp lại hàng tuần (vào thứ X)
    | 'MONTHLY_SOLAR'  // Lặp lại hàng tháng (vào ngày dương X)
    | 'MONTHLY_LUNAR'; // Lặp lại hàng tháng (vào ngày âm X: mùng 2, 16, 1, 15)

export type TargetRoleScope =
    | 'ALL'            // Toàn siêu thị / Mọi người
    | 'QL_TC'          // Quản lý & Trưởng ca
    | 'QUAN_LY'        // Chỉ Quản lý
    | 'TRUONG_CA'      // Chỉ Trưởng ca
    | 'NHAN_VIEN';     // Nhân viên bán hàng

export interface DailyWorkNote {
    id: string;
    store_name: string;              // Tên siêu thị cụ thể hoặc '__ALL_ASSIGNED__' (Toàn nhóm siêu thị phụ trách)
    date_key: string;                // YYYY-MM-DD (ngày bắt đầu)
    end_date_key?: string;           // YYYY-MM-DD (ngày kết thúc nếu công việc nhiều ngày)
    title: string;                   // Tiêu đề ghi chú / công việc (hiển thị trên lịch tổng)
    content?: string;                // Nội dung chi tiết ghi chú / công việc cần làm
    task_type?: WorkTaskType;        // Loại công việc/sự kiện
    target_roles?: TargetRoleScope;  // Người nhận / đối tượng xem (QL/TC/NV/Toàn siêu thị)
    recurrence?: WorkTaskRecurrence; // Công việc có lặp lại không
    recurrence_value?: number;       // Giá trị lặp lại (thứ mấy trong tuần, hoặc ngày âm mấy)
    priority?: 'NORMAL' | 'HIGH' | 'URGENT'; // Mức độ ưu tiên
    is_completed?: boolean;          // Trạng thái đã hoàn thành hay chưa
    created_by_id?: string;          // ID người tạo
    created_by_name: string;         // Tên người tạo
    created_by_role: string;         // Vai trò người tạo: ADMIN | QUAN_LY | TRUONG_CA
    created_at: string;              // ISO timestamp
    updated_at: string;              // ISO timestamp
}

// Cấu hình sự kiện sẵn có trên lịch hệ thống
export interface CalendarSystemEvent {
    id: string;
    title: string;                    // Tên sự kiện: Khởi Động, Kỳ Lương, Đánh Giá Giữa Kỳ, Chốt Số Tháng, Cúng Mùng 2 ÂL, Cúng 16 ÂL,...
    description?: string;              // Mô tả chi tiết
    rule_type: 'SOLAR_DAY' | 'SOLAR_LAST_DAY' | 'LUNAR_DAY';
    day_value: number;                // Ngày áp dụng (1..31 hoặc 0 nếu ngày cuối tháng, hoặc ngày âm 1..30)
    color_theme: 'emerald' | 'amber' | 'blue' | 'rose' | 'purple' | 'orange' | 'cyan';
    icon: string;                     // Emoji biểu tượng
    is_enabled: boolean;              // Trạng thái bật/tắt
    notify_roles?: TargetRoleScope;   // Đối tượng nhận thông báo
}

export const LOCAL_STORAGE_NOTES_KEY = 'saleshub_daily_work_targets_v2';
export const LEGACY_NOTES_KEY = 'saleshub_homepage_calendar_notes_v1';
export const LOCAL_STORAGE_SYSTEM_EVENTS_KEY = 'saleshub_calendar_system_events_v1';
export const ALL_ASSIGNED_STORE_KEY = '__ALL_ASSIGNED__';

// Sự kiện mặc định hệ thống ban đầu
export const DEFAULT_SYSTEM_EVENTS: CalendarSystemEvent[] = [
    {
        id: 'ev_start',
        title: 'Khởi Động',
        description: 'Bắt đầu chu kỳ kinh doanh tháng mới, họp giao ban triển khai mục tiêu',
        rule_type: 'SOLAR_DAY',
        day_value: 1,
        color_theme: 'emerald',
        icon: '🚀',
        is_enabled: true,
        notify_roles: 'ALL'
    },
    {
        id: 'ev_cung_mung_2',
        title: 'Cúng Mùng 2 Âm Lịch',
        description: 'Lễ cúng Thần Tài, Thổ Địa đầu tháng âm lịch cầu buôn may bán đắt',
        rule_type: 'LUNAR_DAY',
        day_value: 2,
        color_theme: 'amber',
        icon: '🎋',
        is_enabled: true,
        notify_roles: 'ALL'
    },
    {
        id: 'ev_salary',
        title: 'Kỳ Lương',
        description: 'Chi trả lương & đối soát doanh thu nhân sự tháng trước',
        rule_type: 'SOLAR_DAY',
        day_value: 10,
        color_theme: 'amber',
        icon: '💰',
        is_enabled: true,
        notify_roles: 'ALL'
    },
    {
        id: 'ev_mid',
        title: 'Đánh Giá Giữa Kỳ',
        description: 'Đánh giá tiến độ 50% chặng đường tháng, rà soát tăng tốc ngành hàng chậm',
        rule_type: 'SOLAR_DAY',
        day_value: 15,
        color_theme: 'blue',
        icon: '📊',
        is_enabled: true,
        notify_roles: 'QL_TC'
    },
    {
        id: 'ev_cung_16',
        title: 'Cúng 16 Âm Lịch',
        description: 'Lễ cúng Thổ Địa giữa tháng âm lịch theo phong tục bán lẻ truyền thống',
        rule_type: 'LUNAR_DAY',
        day_value: 16,
        color_theme: 'orange',
        icon: '🎋',
        is_enabled: true,
        notify_roles: 'ALL'
    },
    {
        id: 'ev_closing',
        title: 'Chốt Số Tháng',
        description: 'Kiểm kê tổng kết, chốt doanh thu, doanh số quy đổi và thưởng thi đua',
        rule_type: 'SOLAR_LAST_DAY',
        day_value: 0,
        color_theme: 'rose',
        icon: '🎯',
        is_enabled: true,
        notify_roles: 'ALL'
    }
];

export const DAILY_WORK_NOTES_SQL = `-- Bảng lưu trữ Ghi chú & Công việc cần làm theo ngày và siêu thị phụ trách
CREATE TABLE IF NOT EXISTS public.daily_work_targets (
    id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    date_key TEXT NOT NULL,
    end_date_key TEXT,
    title TEXT NOT NULL,
    content TEXT,
    task_type TEXT DEFAULT 'CONG_VIEC',
    target_roles TEXT DEFAULT 'ALL',
    recurrence TEXT DEFAULT 'NONE',
    recurrence_value INTEGER,
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

// ==============================================================
// 1. QUẢN LÝ CẤU HÌNH SỰ KIỆN LỊCH HỆ THỐNG (CALENDAR SYSTEM EVENTS)
// ==============================================================

/**
 * Lấy danh sách sự kiện lịch sẵn có của hệ thống
 */
export function getCalendarSystemEvents(): CalendarSystemEvent[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_SYSTEM_EVENTS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn('Lỗi đọc calendar system events:', e);
    }
    return DEFAULT_SYSTEM_EVENTS;
}

/**
 * Lưu danh sách sự kiện lịch hệ thống
 */
export function saveCalendarSystemEvents(events: CalendarSystemEvent[]) {
    try {
        localStorage.setItem(LOCAL_STORAGE_SYSTEM_EVENTS_KEY, JSON.stringify(events));
    } catch (e) {
        console.warn('Lỗi lưu calendar system events:', e);
    }
}

/**
 * Khôi phục danh sách sự kiện lịch về mặc định ban đầu
 */
export function resetCalendarSystemEvents(): CalendarSystemEvent[] {
    saveCalendarSystemEvents(DEFAULT_SYSTEM_EVENTS);
    return DEFAULT_SYSTEM_EVENTS;
}

/**
 * Kiểm tra xem ngày cụ thể có sự kiện hệ thống nào trùng khớp không
 */
export function getMatchingSystemEventsForDate(
    events: CalendarSystemEvent[],
    date: Date,
    lunar?: LunarDate
): CalendarSystemEvent[] {
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
    const lunarObj = lunar || getLunarDate(d, m + 1, y);

    return events.filter(ev => {
        if (!ev.is_enabled) return false;

        if (ev.rule_type === 'SOLAR_DAY') {
            return ev.day_value === d;
        }

        if (ev.rule_type === 'SOLAR_LAST_DAY') {
            return d === lastDayOfMonth;
        }

        if (ev.rule_type === 'LUNAR_DAY') {
            return lunarObj.day === ev.day_value;
        }

        return false;
    });
}

// ==============================================================
// 2. QUẢN LÝ DỮ LIỆU CÔNG VIỆC CẦN LÀM (DAILY WORK NOTES / TASKS)
// ==============================================================

/**
 * Nạp tất cả dữ liệu từ LocalStorage và thực hiện tự động di chuyển dữ liệu cũ nếu có
 */
export function getLocalDailyNotes(): DailyWorkNote[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_NOTES_KEY);
        let list: any[] = raw ? JSON.parse(raw) : [];

        let notes: DailyWorkNote[] = list.map(item => ({
            id: String(item.id || `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
            store_name: item.store_name || ALL_ASSIGNED_STORE_KEY,
            date_key: item.date_key,
            end_date_key: item.end_date_key,
            title: item.title || item.text || 'Ghi chú công việc',
            content: item.content || (item.text !== item.title ? item.text : '') || '',
            task_type: (item.task_type || 'CONG_VIEC') as WorkTaskType,
            target_roles: (item.target_roles || 'ALL') as TargetRoleScope,
            recurrence: (item.recurrence || 'NONE') as WorkTaskRecurrence,
            recurrence_value: item.recurrence_value,
            priority: (item.priority || 'NORMAL') as 'NORMAL' | 'HIGH' | 'URGENT',
            is_completed: Boolean(item.is_completed),
            created_by_id: item.created_by_id,
            created_by_name: item.created_by_name || 'Quản lý',
            created_by_role: item.created_by_role || 'QUAN_LY',
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString()
        }));

        // Di chuyển legacy note v1 nếu người dùng đã có ghi chú cũ
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
                            task_type: 'CONG_VIEC',
                            target_roles: 'ALL',
                            recurrence: 'NONE',
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
            end_date_key: row.end_date_key || undefined,
            title: row.title || row.content || 'Ghi chú',
            content: row.content || '',
            task_type: (row.task_type || 'CONG_VIEC') as WorkTaskType,
            target_roles: (row.target_roles || 'ALL') as TargetRoleScope,
            recurrence: (row.recurrence || 'NONE') as WorkTaskRecurrence,
            recurrence_value: row.recurrence_value,
            priority: (row.priority || 'NORMAL') as 'NORMAL' | 'HIGH' | 'URGENT',
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
 * Thêm mới một công việc / sự kiện
 */
export async function addDailyNote(
    noteInput: Omit<DailyWorkNote, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; note?: DailyWorkNote; error?: string }> {
    try {
        const newNote: DailyWorkNote = {
            ...noteInput,
            id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            task_type: noteInput.task_type || 'CONG_VIEC',
            target_roles: noteInput.target_roles || 'ALL',
            recurrence: noteInput.recurrence || 'NONE',
            priority: noteInput.priority || 'NORMAL',
            is_completed: Boolean(noteInput.is_completed),
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
                end_date_key: newNote.end_date_key || null,
                title: newNote.title,
                content: newNote.content || null,
                task_type: newNote.task_type,
                target_roles: newNote.target_roles,
                recurrence: newNote.recurrence,
                recurrence_value: newNote.recurrence_value || null,
                priority: newNote.priority,
                is_completed: newNote.is_completed,
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
 * Cập nhật công việc / sự kiện
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
 * Xóa một công việc theo ID
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

// ==============================================================
// 3. LOGIC LỌC & ĐỐI SOÁT NGÀY, LẶP LẠI & PHÂN QUYỀN
// ==============================================================

/**
 * Kiểm tra xem một công việc có hiệu lực vào ngày dateKey hay không
 * (Bao gồm kiểm tra 1 ngày, nhiều ngày, lặp lại hàng tuần, hàng tháng DL / ÂL)
 */
export function isNoteActiveOnDate(
    note: DailyWorkNote,
    dateKey: string,
    dateObj?: Date,
    lunarObj?: LunarDate
): boolean {
    // 1. Khớp chính xác ngày bắt đầu
    if (note.date_key === dateKey) return true;

    // 2. Công việc nhiều ngày (date_key đến end_date_key)
    if (note.end_date_key && note.end_date_key >= note.date_key) {
        if (dateKey >= note.date_key && dateKey <= note.end_date_key) {
            return true;
        }
    }

    // 3. Công việc có cấu hình lặp lại
    if (note.recurrence && note.recurrence !== 'NONE') {
        const targetDate = dateObj || new Date(`${dateKey}T00:00:00`);
        const startDate = new Date(`${note.date_key}T00:00:00`);

        // Chỉ lặp lại kể từ ngày bắt đầu trở đi
        if (targetDate.getTime() < startDate.getTime()) return false;

        // Lặp lại hàng ngày
        if (note.recurrence === 'DAILY') {
            return true;
        }

        // Lặp lại hàng tuần (khớp thứ trong tuần: 0 = CN, 1 = T2, ..., 6 = T7)
        if (note.recurrence === 'WEEKLY') {
            const startDayOfWeek = startDate.getDay();
            const targetDayOfWeek = targetDate.getDay();
            const expectedDay = note.recurrence_value !== undefined ? note.recurrence_value : startDayOfWeek;
            return targetDayOfWeek === expectedDay;
        }

        // Lặp lại hàng tháng theo Dương lịch (khớp ngày trong tháng)
        if (note.recurrence === 'MONTHLY_SOLAR') {
            const startDayOfMonth = startDate.getDate();
            const expectedDay = note.recurrence_value !== undefined ? note.recurrence_value : startDayOfMonth;
            return targetDate.getDate() === expectedDay;
        }

        // Lặp lại hàng tháng theo Âm lịch (ví dụ mùng 2, 16, 1, 15)
        if (note.recurrence === 'MONTHLY_LUNAR') {
            const lunar = lunarObj || getLunarDate(targetDate.getDate(), targetDate.getMonth() + 1, targetDate.getFullYear());
            const startLunar = getLunarDate(startDate.getDate(), startDate.getMonth() + 1, startDate.getFullYear());
            const expectedLunarDay = note.recurrence_value !== undefined ? note.recurrence_value : startLunar.day;
            return lunar.day === expectedLunarDay;
        }
    }

    return false;
}

/**
 * Kiểm tra xem người dùng có quyền xem công việc này dựa vào target_roles hay không
 */
export function isUserAllowedToViewTask(
    note: DailyWorkNote,
    userRole: string
): boolean {
    const scope = note.target_roles || 'ALL';
    if (scope === 'ALL') return true;
    if (userRole === 'ADMIN') return true;

    if (scope === 'QL_TC') {
        return userRole === 'QUAN_LY' || userRole === 'TRUONG_CA';
    }
    if (scope === 'QUAN_LY') {
        return userRole === 'QUAN_LY';
    }
    if (scope === 'TRUONG_CA') {
        return userRole === 'TRUONG_CA' || userRole === 'QUAN_LY';
    }
    if (scope === 'NHAN_VIEN') {
        return userRole === 'NHAN_VIEN' || userRole === 'TRUONG_CA' || userRole === 'QUAN_LY';
    }
    return true;
}

/**
 * Lọc danh sách công việc theo ngày được chọn & Nhóm siêu thị đang phụ trách & Vai trò người dùng
 */
export function filterNotesForView(
    notes: DailyWorkNote[],
    dateKey: string,
    selectedStore: string,
    userAccessibleStores: string[],
    userRole: string,
    currentUserStoreName?: string,
    dateObj?: Date,
    lunarObj?: LunarDate
): DailyWorkNote[] {
    const targetDate = dateObj || new Date(`${dateKey}T00:00:00`);
    const targetLunar = lunarObj || getLunarDate(targetDate.getDate(), targetDate.getMonth() + 1, targetDate.getFullYear());

    // 1. Lọc theo ngày hiệu lực
    const dateNotes = notes.filter(t => isNoteActiveOnDate(t, dateKey, targetDate, targetLunar));

    // 2. Lọc theo vai trò người nhận (target_roles)
    const roleFiltered = dateNotes.filter(t => isUserAllowedToViewTask(t, userRole));

    // 3. Lọc theo phạm vi siêu thị
    if (userRole === 'NHAN_VIEN') {
        const myStore = currentUserStoreName?.trim() || '';
        return roleFiltered.filter(t => {
            if (t.store_name === ALL_ASSIGNED_STORE_KEY || t.store_name === 'all') return true;
            if (!myStore) return true;
            return isStoreMatch(t.store_name, myStore);
        });
    }

    if (userRole === 'ADMIN') {
        if (selectedStore === ALL_ASSIGNED_STORE_KEY || selectedStore === 'all') {
            return roleFiltered;
        }
        return roleFiltered.filter(t => {
            return t.store_name === ALL_ASSIGNED_STORE_KEY || isStoreMatch(t.store_name, selectedStore);
        });
    }

    // Quản lý (QUAN_LY) hoặc Trưởng ca (TRUONG_CA)
    const accessible = userAccessibleStores.length > 0
        ? userAccessibleStores
        : (currentUserStoreName ? [currentUserStoreName] : []);

    if (selectedStore === ALL_ASSIGNED_STORE_KEY || selectedStore === 'all') {
        return roleFiltered.filter(t => {
            if (t.store_name === ALL_ASSIGNED_STORE_KEY || t.store_name === 'all') return true;
            return accessible.some(acc => isStoreMatch(t.store_name, acc));
        });
    }

    return roleFiltered.filter(t => {
        if (t.store_name === ALL_ASSIGNED_STORE_KEY) return true;
        return isStoreMatch(t.store_name, selectedStore);
    });
}

/**
 * Lấy bản đồ danh sách ghi chú cho từng ngày trong tháng để hiển thị lên lịch tổng
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
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    for (let d = 1; d <= totalDaysInMonth; d++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dateObj = new Date(year, month, d);
        const lunarObj = getLunarDate(d, month + 1, year);

        const dayNotes = filterNotesForView(
            notes,
            dateKey,
            selectedStore,
            userAccessibleStores,
            userRole,
            currentUserStoreName,
            dateObj,
            lunarObj
        );

        if (dayNotes.length > 0) {
            map[dateKey] = dayNotes;
        }
    }

    return map;
}
