/**
 * Quản lý Phiên dữ liệu cập nhật nhân viên (Employee Data Sessions)
 */

export interface EmployeeSessionRecord {
    employee_id: string;
    full_name: string;
    quantity: number;
    revenue_qd: number;
    revenue_actual: number;
    installment_revenue: number;
    installment_rate: number;
    work_hours?: number;
    campaigns?: Record<string, number>;
}

export interface EmployeeDataSession {
    id: string;
    session_type: 'REVENUE_CAMPAIGN' | 'WORK_HOURS' | 'FULL_SYNC';
    session_title: string;
    store_name: string;
    month: number;
    year: number;
    report_date: string;
    created_at: string;
    created_by: string;
    employee_count: number;
    total_revenue_actual: number;
    total_revenue_qd: number;
    total_work_hours: number;
    source_type: 'PASTE_TEXT' | 'EXCEL' | 'MANUAL';
    records: EmployeeSessionRecord[];
    note?: string;
}

const STORAGE_KEY = 'saleshub_emp_data_sessions_v1';

import { isStoreMatch } from '../../../core/lib/formatters';
import { supabase } from '../../../core/lib/supabase';

export const EMPLOYEE_DATA_SESSIONS_SQL = `-- Bảng lưu trữ phiên dữ liệu cập nhật nhân viên (Doanh thu, Thi đua, Giờ công)
CREATE TABLE IF NOT EXISTS public.employee_data_sessions (
    id TEXT PRIMARY KEY,
    session_type TEXT NOT NULL,
    session_title TEXT NOT NULL,
    store_name TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    report_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    employee_count INTEGER DEFAULT 0,
    total_revenue_actual NUMERIC DEFAULT 0,
    total_revenue_qd NUMERIC DEFAULT 0,
    total_work_hours NUMERIC DEFAULT 0,
    source_type TEXT DEFAULT 'PASTE_TEXT',
    records JSONB DEFAULT '[]'::jsonb,
    note TEXT
);

-- Bật RLS và cấp quyền truy cập
ALTER TABLE public.employee_data_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cho phép toàn quyền truy cập employee_data_sessions" ON public.employee_data_sessions;
CREATE POLICY "Cho phép toàn quyền truy cập employee_data_sessions" 
ON public.employee_data_sessions FOR ALL USING (true) WITH CHECK (true);
`;

/**
 * Kiểm tra xem bảng employee_data_sessions đã tồn tại trên Supabase chưa
 */
export async function checkSupabaseSessionTable(): Promise<{ exists: boolean; count: number; error?: string }> {
    try {
        const { count, error } = await supabase
            .from('employee_data_sessions')
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
 * Tải danh sách phiên từ Supabase Cloud (hỗ trợ lọc trực tiếp trên Cloud)
 */
export async function fetchCloudEmployeeDataSessions(filters?: {
    month?: number;
    year?: number;
    storeName?: string;
    sessionType?: string;
}): Promise<{ success: boolean; data: EmployeeDataSession[]; error?: string }> {
    try {
        let query = supabase
            .from('employee_data_sessions')
            .select('*')
            .order('created_at', { ascending: false });

        if (filters) {
            // month === 0 nghĩa là "Tất cả các tháng"
            if (filters.month !== undefined && filters.month > 0) {
                query = query.eq('month', filters.month);
            }
            // year === 0 nghĩa là "Tất cả các năm"
            if (filters.year !== undefined && filters.year > 0) {
                query = query.eq('year', filters.year);
            }
            if (filters.sessionType && filters.sessionType !== 'all') {
                query = query.eq('session_type', filters.sessionType);
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        let list = (data || []) as EmployeeDataSession[];

        // Lọc theo tên siêu thị (hỗ trợ so khớp linh hoạt theo mã/tên/cụm)
        if (filters?.storeName && filters.storeName !== 'all') {
            const targetStore = filters.storeName.trim();
            list = list.filter(s => {
                if (!s.store_name) return false;
                return isStoreMatch(s.store_name, targetStore);
            });
        }

        return { success: true, data: list };
    } catch (e: any) {
        return { success: false, data: [], error: e.message || String(e) };
    }
}

/**
 * Tải toàn bộ danh sách phiên từ Supabase Cloud và đồng bộ vào LocalStorage làm cache
 * (Chỉ lưu các phiên thực tế tồn tại trên Supabase Cloud, loại bỏ toàn bộ bản ghi rác thuần local)
 */
export async function pullCloudSessionsToLocal(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        const cloudRes = await fetchCloudEmployeeDataSessions();
        if (!cloudRes.success) {
            return { success: false, count: 0, error: cloudRes.error };
        }

        const cloudSessions = cloudRes.data;
        const sorted = [...cloudSessions].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Ghi đè bộ nhớ đệm LocalStorage chỉ với dữ liệu từ Supabase Cloud
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted.slice(0, 300)));
        return { success: true, count: sorted.length };
    } catch (e: any) {
        console.warn('Lỗi pullCloudSessionsToLocal:', e);
        return { success: false, count: 0, error: e.message || String(e) };
    }
}

/**
 * Tải và lọc danh sách phiên dữ liệu (ưu tiên tuyệt đối Supabase Cloud)
 */
export async function syncAndFetchEmployeeDataSessions(filters?: {
    month?: number;
    year?: number;
    storeName?: string;
    sessionType?: string;
}): Promise<EmployeeDataSession[]> {
    try {
        const cloudRes = await fetchCloudEmployeeDataSessions(filters);
        if (cloudRes.success) {
            // Đồng bộ cache local chỉ chứa các phiên trên Cloud
            pullCloudSessionsToLocal().catch(() => {});
            return cloudRes.data;
        }
    } catch (e) {
        console.warn('Lỗi truy vấn CLOUD:', e);
    }

    // Dự phòng offline chỉ lấy từ cache (nếu có)
    return fetchEmployeeDataSessions(filters);
}

/**
 * Lấy các phiên local chưa có trên Supabase
 */
export async function getUnsyncedSessions(): Promise<{ unsynced: EmployeeDataSession[]; cloudCount: number; tableExists: boolean }> {
    const localSessions = fetchEmployeeDataSessions();
    const tableCheck = await checkSupabaseSessionTable();

    if (!tableCheck.exists) {
        return { unsynced: localSessions, cloudCount: 0, tableExists: false };
    }

    try {
        const { data: cloudSessions } = await supabase
            .from('employee_data_sessions')
            .select('id');

        const cloudIdSet = new Set((cloudSessions || []).map(s => s.id));
        const unsynced = localSessions.filter(s => !cloudIdSet.has(s.id));

        return { unsynced, cloudCount: cloudSessions?.length || 0, tableExists: true };
    } catch {
        return { unsynced: localSessions, cloudCount: 0, tableExists: true };
    }
}

/**
 * Đồng bộ toàn bộ phiên từ Local lên Supabase Cloud
 */
export async function syncLocalSessionsToCloud(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    const localSessions = fetchEmployeeDataSessions();
    if (localSessions.length === 0) {
        return { success: true, syncedCount: 0 };
    }

    try {
        const payloads = localSessions.map(s => ({
            id: s.id,
            session_type: s.session_type,
            session_title: s.session_title,
            store_name: s.store_name,
            month: s.month,
            year: s.year,
            report_date: s.report_date,
            created_at: s.created_at,
            created_by: s.created_by,
            employee_count: s.employee_count,
            total_revenue_actual: s.total_revenue_actual,
            total_revenue_qd: s.total_revenue_qd,
            total_work_hours: s.total_work_hours,
            source_type: s.source_type,
            records: s.records,
            note: s.note
        }));

        const { error } = await supabase
            .from('employee_data_sessions')
            .upsert(payloads, { onConflict: 'id' });

        if (error) throw error;
        return { success: true, syncedCount: payloads.length };
    } catch (e: any) {
        console.error('Lỗi syncLocalSessionsToCloud:', e);
        return { success: false, syncedCount: 0, error: e.message || String(e) };
    }
}

export function fetchEmployeeDataSessions(filters?: {
    month?: number;
    year?: number;
    storeName?: string;
    sessionType?: string;
}): EmployeeDataSession[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        let list: EmployeeDataSession[] = JSON.parse(raw);

        if (filters) {
            // month === 0 nghĩa là "Tất cả các tháng"
            if (filters.month !== undefined && filters.month > 0) {
                list = list.filter(s => s.month === filters.month);
            }
            // year === 0 nghĩa là "Tất cả các năm"
            if (filters.year !== undefined && filters.year > 0) {
                list = list.filter(s => s.year === filters.year);
            }
            if (filters.storeName && filters.storeName !== 'all') {
                const targetStore = filters.storeName.trim();
                list = list.filter(s => {
                    if (!s.store_name) return false;
                    return isStoreMatch(s.store_name, targetStore);
                });
            }
            if (filters.sessionType && filters.sessionType !== 'all') {
                list = list.filter(s => s.session_type === filters.sessionType);
            }
        }

        // Sắp xếp phiên mới nhất lên đầu
        return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (e) {
        console.warn('Lỗi fetchEmployeeDataSessions:', e);
        return [];
    }
}

export async function saveEmployeeDataSession(
    data: Omit<EmployeeDataSession, 'id' | 'created_at'>
): Promise<{ success: boolean; session: EmployeeDataSession; error?: string }> {
    const existing = fetchEmployeeDataSessions();
    const newSession: EmployeeDataSession = {
        ...data,
        id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        created_at: new Date().toISOString()
    };

    const updated = [newSession, ...existing];
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 300))); // Lưu tối đa 300 phiên
    } catch (e) {
        console.warn('Lỗi saveEmployeeDataSession local:', e);
    }

    // Đẩy lên Supabase Cloud
    try {
        const { error } = await supabase
            .from('employee_data_sessions')
            .upsert({
                id: newSession.id,
                session_type: newSession.session_type,
                session_title: newSession.session_title,
                store_name: newSession.store_name,
                month: newSession.month,
                year: newSession.year,
                report_date: newSession.report_date,
                created_at: newSession.created_at,
                created_by: newSession.created_by,
                employee_count: newSession.employee_count,
                total_revenue_actual: newSession.total_revenue_actual,
                total_revenue_qd: newSession.total_revenue_qd,
                total_work_hours: newSession.total_work_hours,
                source_type: newSession.source_type,
                records: newSession.records,
                note: newSession.note
            });

        if (error) {
            console.warn('Lưu session lên CLOUD có lỗi:', error.message);
            return {
                success: true,
                session: newSession,
                error: 'Đã lưu cục bộ nhưng chưa thể đưa lên Cloud: ' + error.message
            };
        }
    } catch (err: any) {
        console.warn('Lỗi mạng khi lưu session lên Cloud:', err);
        return {
            success: true,
            session: newSession,
            error: 'Đã lưu cục bộ nhưng lỗi mạng Cloud: ' + (err.message || String(err))
        };
    }

    return { success: true, session: newSession };
}

/**
 * Cập nhật trực tiếp dữ liệu vào một phiên đã tồn tại (giữ nguyên ID phiên)
 */
export async function updateEmployeeDataSession(
    sessionId: string,
    data: Partial<Omit<EmployeeDataSession, 'id' | 'created_at'>>
): Promise<{ success: boolean; session?: EmployeeDataSession; error?: string }> {
    const existing = fetchEmployeeDataSessions();
    const index = existing.findIndex(s => s.id === sessionId);
    if (index === -1) {
        return { success: false, error: 'Không tìm thấy phiên cần cập nhật!' };
    }

    const updatedSession: EmployeeDataSession = {
        ...existing[index],
        ...data,
        id: sessionId
    };

    existing[index] = updatedSession;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (e) {
        console.warn('Lỗi updateEmployeeDataSession local:', e);
    }

    // Cập nhật lên Supabase Cloud
    try {
        const { error } = await supabase
            .from('employee_data_sessions')
            .upsert({
                id: updatedSession.id,
                session_type: updatedSession.session_type,
                session_title: updatedSession.session_title,
                store_name: updatedSession.store_name,
                month: updatedSession.month,
                year: updatedSession.year,
                report_date: updatedSession.report_date,
                created_at: updatedSession.created_at,
                created_by: updatedSession.created_by,
                employee_count: updatedSession.employee_count,
                total_revenue_actual: updatedSession.total_revenue_actual,
                total_revenue_qd: updatedSession.total_revenue_qd,
                total_work_hours: updatedSession.total_work_hours,
                source_type: updatedSession.source_type,
                records: updatedSession.records,
                note: updatedSession.note
            });

        if (error) {
            console.warn('Lỗi cập nhật session lên Cloud:', error.message);
            return {
                success: true,
                session: updatedSession,
                error: 'Đã cập nhật cục bộ nhưng chưa thể đưa lên Cloud: ' + error.message
            };
        }
    } catch (err: any) {
        console.warn('Lỗi mạng khi cập nhật session lên Cloud:', err);
        return {
            success: true,
            session: updatedSession,
            error: 'Đã cập nhật cục bộ nhưng lỗi mạng Cloud: ' + (err.message || String(err))
        };
    }

    return { success: true, session: updatedSession };
}

export async function deleteEmployeeDataSession(sessionId: string): Promise<boolean> {
    const existing = fetchEmployeeDataSessions();
    const updated = existing.filter(s => s.id !== sessionId);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
        console.warn('Lỗi deleteEmployeeDataSession:', e);
        return false;
    }

    // Xóa trên Supabase Cloud
    try {
        await supabase
            .from('employee_data_sessions')
            .delete()
            .eq('id', sessionId);
    } catch (e) {
        console.warn('Lỗi xóa session trên Cloud:', e);
    }

    return true;
}

/**
 * Lấy phiên doanh thu mới nhất của 1 siêu thị trong tháng/năm
 */
export function getLatestStoreRevenueSession(
    storeName: string,
    month: number,
    year: number
): EmployeeDataSession | null {
    const sessions = fetchEmployeeDataSessions({ month, year });
    const storeSessions = sessions.filter(
        s => (s.store_name === storeName || storeName === 'all') && s.session_type === 'REVENUE_CAMPAIGN'
    );
    return storeSessions[0] || null;
}

/**
 * Lấy phiên giờ công mới nhất của toàn cụm trong tháng/năm
 */
export function getLatestWorkHoursSession(
    month: number,
    year: number
): EmployeeDataSession | null {
    const sessions = fetchEmployeeDataSessions({ month, year });
    const hoursSessions = sessions.filter(s => s.session_type === 'WORK_HOURS');
    return hoursSessions[0] || null;
}

/**
 * Tái tạo chuỗi dữ liệu thô (tab-delimited) từ danh sách doanh thu để nạp vào ô nhập liệu textarea
 */
export function formatEmployeeRevenueToRawText(
    records: {
        employee_id: string;
        full_name: string;
        quantity: number;
        revenue_qd: number;
        revenue_actual: number;
        installment_revenue: number;
        installment_rate: number;
    }[]
): string {
    return records
        .map(r => {
            const line1 = `${r.employee_id} - ${r.full_name}`;
            const line2 = `${r.quantity}\t${r.revenue_qd.toLocaleString('vi-VN')}\t0%\t${r.revenue_actual.toLocaleString('vi-VN')}\t0\t—\t${r.installment_revenue.toLocaleString('vi-VN')}\t${r.installment_rate}%`;
            return `${line1}\n${line2}`;
        })
        .join('\n');
}

/**
 * Tái tạo chuỗi dữ liệu thô cho các khối thi đua để nạp vào ô nhập liệu textarea
 */
export function formatEmployeeCampaignToRawText(
    campaigns: {
        campaign_name: string;
        unit_type: 'DOANH THU' | 'SỐ LƯỢNG';
        employee_values: Record<string, number>;
    }[]
): string {
    return campaigns
        .map(c => {
            const header = `${c.campaign_name}\t${c.unit_type}\tHẠNG TRONG ST\tTOP/BOTTOM ST\tBỘ PHẬN`;
            const rows = Object.entries(c.employee_values)
                .map(([empId, val]) => `${empId} - Nhân Viên\t${val}\t1\tTOP`)
                .join('\n');
            return `${header}\n${rows}`;
        })
        .join('\n\n');
}

/**
 * Tái tạo chuỗi dữ liệu giờ công thô để nạp vào ô nhập liệu textarea
 */
export function formatWorkHoursToRawText(
    hoursMap: Record<string, number>,
    employees?: { employee_id: string; full_name: string; store_name?: string }[]
): string {
    const empInfoMap = new Map((employees || []).map(e => [e.employee_id.trim().toLowerCase(), e]));
    return Object.entries(hoursMap)
        .map(([empId, hours]) => {
            const info = empInfoMap.get(empId.trim().toLowerCase());
            const name = info?.full_name || `Nhân Viên ${empId}`;
            const store = info?.store_name || 'Toàn Cụm';
            return `2026/09/26\t2026/T09\t${store}\t${empId} - ${name}\t${name}\tBP Kho\tNhân Viên\tCa Tổng\t${hours}`;
        })
        .join('\n');
}
