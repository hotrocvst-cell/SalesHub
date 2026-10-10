import { supabase } from './supabase';
import { formatCapitalizeWords } from './formatters';

// ==========================================
// 1. CÁC KIỂU DỮ LIỆU CỐT LÕI (INTERFACES)
// ==========================================

export interface EmployeeItem {
    id?: string;
    employee_id: string;      // Mã nhân viên
    full_name: string;        // Họ và tên
    store_name: string;       // Tên siêu thị
    job_title?: string;       // Chức danh / Bộ phận
    role?: string;            // Vai trò: QUAN_LY | TRUONG_CA | NHAN_VIEN (hoặc Quản lý, Trưởng ca, Nhân viên)
    department?: string;      // Bộ phận: AIO, Tư vấn bán hàng, Thu ngân, Kho / Kỹ thuật...
    status?: string;          // active / inactive
    is_active?: boolean;      // Trạng thái hoạt động
    cluster?: string;         // Cụm
    created_at?: string;
    updated_at?: string;
}

export type OperationalRole = 'QUAN_LY' | 'TRUONG_CA' | 'NHAN_VIEN';

export interface NormalizedEmployeeRoleInfo {
    role: OperationalRole;
    operationalRole: OperationalRole;
    department: string;
}

/**
 * Chuẩn hóa vai trò & bộ phận của nhân sự:
 * - VẬN HÀNH DUY NHẤT 3 VAI TRÒ: QUAN_LY, TRUONG_CA, NHAN_VIEN
 * - BỘ PHẬN: AIO (AIO - TZ, AIO - TGD, AIO - ĐMX), Tư vấn bán hàng, Thu ngân, Kho / Kỹ thuật...
 */
export function parseEmployeeRoleAndDept(emp: Partial<EmployeeItem>): NormalizedEmployeeRoleInfo {
    const rawRole = (emp.role || '').trim();
    const rawDept = (emp.department || emp.job_title || '').trim();
    const combined = `${rawRole} ${rawDept}`.toLowerCase();

    // 1. Xác định vai trò (chỉ 1 trong 3: QUAN_LY, TRUONG_CA, NHAN_VIEN)
    let role: OperationalRole = 'NHAN_VIEN';
    if (combined.includes('quản lý') || combined.includes('quan_ly') || rawRole === 'QUAN_LY' || rawRole === 'ADMIN') {
        role = 'QUAN_LY';
    } else if (combined.includes('trưởng ca') || combined.includes('truong_ca') || rawRole === 'TRUONG_CA' || combined.includes('leader')) {
        role = 'TRUONG_CA';
    } else {
        role = 'NHAN_VIEN';
    }

    // 2. Xác định bộ phận (AIO, Tư vấn bán hàng, Thu ngân, Kho / Kỹ thuật, ...)
    let department = rawDept;
    if (!department) {
        if (combined.includes('aio - tz') || rawRole.toLowerCase().includes('aio - tz')) department = 'AIO - TZ';
        else if (combined.includes('aio - tgd') || rawRole.toLowerCase().includes('aio - tgd')) department = 'AIO - TGD';
        else if (combined.includes('aio - đmx') || combined.includes('aio - dmx')) department = 'AIO - ĐMX';
        else if (combined.includes('aio')) department = 'AIO';
        else if (combined.includes('thu ngân') || combined.includes('thu ngan')) department = 'Thu ngân';
        else if (combined.includes('kho') || combined.includes('kỹ thuật') || combined.includes('ky thuat')) department = 'Kho / Kỹ thuật';
        else if (combined.includes('quản lý')) department = 'Quản lý';
        else department = 'Tư vấn bán hàng';
    }

    return { role, operationalRole: role, department };
}

export interface StoreItem {
    id?: string;
    code: string;             // Mã siêu thị (e.g. 10335, 111)
    name: string;             // Tên siêu thị
    address?: string;         // Địa chỉ
    brand?: string;           // Thương hiệu (TGDĐ / ĐMX / TopZone / AAR)
    is_active?: boolean;      // Trạng thái hoạt động
    created_at?: string;
    updated_at?: string;
}

export interface BusinessDayRecord {
    id?: string;
    storeName: string;
    reportDate: string; // YYYY-MM-DD
    month: number;
    year: number;
    passedDays: number;
    totalDays: number;
    revenueActual: number;
    revenueTarget: number;
    revenueInstallment: number;
    installmentRate: number;
    forecastCompletionRate: number;
    emulationSummary: Record<string, { target: number; actual: number; pctDK: number; pctHT?: number }>;
    rawEmulation: string;
    rawRevenue: string;
    updatedAt?: string;
    updatedBy?: string;
    dataType?: string;
}

// Định nghĩa interface chuẩn
export interface CampaignDictionaryItem {
    id?: string;
    raw_key: string;
    display_name: string;
    unit?: string;
    is_active: boolean;
    order_index?: number;
    sort_order?: number;
    created_at?: string;
    updated_at?: string;
}

// 1. Alias dạng type cho các component dùng 'import type { CampaignDictItem }'
export type CampaignDictItem = CampaignDictionaryItem;

// 2. Export dạng const/object runtime để chống lỗi SyntaxError khi component import không có chữ 'type'
export class CampaignDictionaryItem {
    id?: string;
    raw_key!: string;
    display_name!: string;
    unit?: string;
    is_active!: boolean;
    order_index?: number;
    sort_order?: number;
    created_at?: string;
    updated_at?: string;

    toString() {
        return 'CampaignDictItem';
    }
}


export interface EmployeeCampaignTargetItem {
    employeeId: string;
    rawKey: string;
    month: number;
    year: number;
    targetValue: number;
}

export interface UnifiedEmployeeTargetPayload {
    month: number;
    year: number;
    revenueTargets: { employee_id: string; target_revenue: number }[];
    campaignTargets: { employee_id: string; raw_key: string; target_value: number }[];
}

// ==========================================
// 2. PHÂN HỆ QUẢN LÝ DỮ LIỆU KINH DOANH (BUSINESS RECORDS)
// ==========================================

// ========================================================
// HÀM CHUYỂN ĐỔI: daily_business_records (DB) -> BusinessDayRecord (App)
// ========================================================
function mapDbToBusinessDayRecord(row: any): BusinessDayRecord {
    return {
        id: row.id,
        storeName: row.store_name || '',
        reportDate: row.report_date || '',
        month: Number(row.month || 0),
        year: Number(row.year || 0),
        passedDays: Number(row.passed_days ?? 0),
        totalDays: Number(row.total_days ?? 0),
        revenueActual: Number(row.revenue_actual ?? 0),
        revenueTarget: Number(row.revenue_target ?? 0),
        revenueInstallment: Number(row.revenue_installment ?? 0),
        installmentRate: Number(row.installment_rate ?? 0),
        forecastCompletionRate: Number(row.forecast_completion_rate ?? 0),
        emulationSummary: row.emulation_summary || {},
        rawEmulation: row.raw_emulation || '',
        rawRevenue: row.raw_revenue || '',
        dataType: row.data_type || 'daily',
        updatedAt: row.updated_at || '',
        updatedBy: row.updated_by || ''
    };
}

// 1. Tải toàn bộ bản ghi phục vụ Quản lý dữ liệu (DataManagerPage)
export async function fetchAllBusinessRecords() {
    try {
        const { data, error } = await supabase
            .from('daily_business_records')
            .select('*')
            .order('report_date', { ascending: false });

        if (error) throw error;
        return {
            success: true,
            data: (data || []).map(mapDbToBusinessDayRecord)
        };
    } catch (err: any) {
        console.error('Lỗi fetchAllBusinessRecords:', err);
        return { success: false, data: [] as BusinessDayRecord[], error: err.message || err };
    }
}

// 2. Tải bản ghi theo Tháng & Năm (phục vụ MonthlyReportPage & DailyReportPage)
export async function fetchBusinessRecords(month: number, year: number) {
    try {
        const { data, error } = await supabase
            .from('daily_business_records')
            .select('*')
            .eq('month', month)
            .eq('year', year)
            .order('report_date', { ascending: true });

        if (error) throw error;
        return {
            success: true,
            data: (data || []).map(mapDbToBusinessDayRecord)
        };
    } catch (err: any) {
        console.error('Lỗi fetchBusinessRecords:', err);
        return { success: false, data: [] as BusinessDayRecord[], error: err.message || err };
    }
}

// 3. Đồng bộ hàng loạt bản ghi từ trang Cập Nhật vào daily_business_records
export async function syncBatchDailyRecordsToSupabase(records: BusinessDayRecord[]) {
    if (!records || records.length === 0) return { success: true, count: 0 };
    try {
        const payloads = records.map(record => ({
            store_name: record.storeName?.trim(),
            report_date: record.reportDate,
            month: Number(record.month),
            year: Number(record.year),
            passed_days: Number(record.passedDays) || 0,
            total_days: Number(record.totalDays) || 0,
            revenue_actual: Number(record.revenueActual) || 0,
            revenue_target: Number(record.revenueTarget) || 0,
            revenue_installment: Number(record.revenueInstallment) || 0,
            installment_rate: Number(record.installmentRate) || 0,
            forecast_completion_rate: Number(record.forecastCompletionRate) || 0,
            emulation_summary: record.emulationSummary || {},
            raw_emulation: record.rawEmulation || '',
            raw_revenue: record.rawRevenue || '',
            data_type: record.dataType || 'daily',
            updated_at: new Date().toISOString()
        }));

        const { data, error } = await supabase
            .from('daily_business_records')
            .upsert(payloads, { onConflict: 'store_name,report_date' });

        if (error) throw error;
        return { success: true, data, count: payloads.length };
    } catch (err: any) {
        console.error('Lỗi syncBatchDailyRecordsToSupabase:', err);
        return { success: false, count: 0, error: err.message || err };
    }
}

// 4. Lưu 1 bản ghi đơn lẻ
export async function upsertBusinessRecord(record: BusinessDayRecord) {
    try {
        const payload = {
            store_name: record.storeName?.trim(),
            report_date: record.reportDate,
            month: Number(record.month),
            year: Number(record.year),
            passed_days: Number(record.passedDays) || 0,
            total_days: Number(record.totalDays) || 0,
            revenue_actual: Number(record.revenueActual) || 0,
            revenue_target: Number(record.revenueTarget) || 0,
            revenue_installment: Number(record.revenueInstallment) || 0,
            installment_rate: Number(record.installmentRate) || 0,
            forecast_completion_rate: Number(record.forecastCompletionRate) || 0,
            emulation_summary: record.emulationSummary || {},
            raw_emulation: record.rawEmulation || '',
            raw_revenue: record.rawRevenue || '',
            data_type: record.dataType || 'daily',
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('daily_business_records')
            .upsert(payload, { onConflict: 'store_name,report_date' });

        if (error) throw error;
        return { success: true, data };
    } catch (err: any) {
        console.error('Lỗi upsertBusinessRecord:', err);
        return { success: false, error: err.message || err };
    }
}

// 5. Xóa bản ghi theo ID
export async function deleteBusinessRecordById(id: string) {
    try {
        const { data, error } = await supabase
            .from('daily_business_records')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true, data };
    } catch (err: any) {
        console.error('Lỗi deleteBusinessRecordById:', err);
        return { success: false, error: err.message || err };
    }
}

// 6. Xóa bản ghi theo Siêu thị và Ngày báo cáo
export async function deleteBusinessRecord(storeName: string, reportDate: string) {
    try {
        const { data, error } = await supabase
            .from('daily_business_records')
            .delete()
            .eq('store_name', storeName.trim())
            .eq('report_date', reportDate.trim());

        if (error) throw error;
        return { success: true, data };
    } catch (err: any) {
        console.error('Lỗi deleteBusinessRecord:', err);
        return { success: false, error: err.message || err };
    }
}


// ==========================================
// 3. PHÂN HỆ QUẢN LÝ BẢN NHÁP (LOCAL DRAFT)
// ==========================================

const DRAFT_STORAGE_KEY = 'sales_hub_report_draft';

export function getLocalDraft<T = any>(key: string = DRAFT_STORAGE_KEY): T | null {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
    } catch (err) {
        console.warn(`Lỗi khi đọc draft [${key}]:`, err);
        return null;
    }
}

export function saveLocalDraft<T = any>(data: T, key: string = DRAFT_STORAGE_KEY): boolean {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (err) {
        console.warn(`Lỗi khi lưu draft [${key}]:`, err);
        return false;
    }
}

export function clearLocalDraft(key: string = DRAFT_STORAGE_KEY): boolean {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (err) {
        console.warn(`Lỗi khi xóa draft [${key}]:`, err);
        return false;
    }
}

// ==========================================
// 4. PHÂN HỆ NHÂN SỰ & SIÊU THỊ (CRUD HOÀN CHỈNH)
// ==========================================

export async function fetchStores() {
    try {
        const { data, error } = await supabase
            .from('stores')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.warn('Cảnh báo fetchStores, thử truy vấn không order:', error.message);
            const fallback = await supabase.from('stores').select('*');
            if (fallback.error) throw fallback.error;
            return { success: true, data: (fallback.data as StoreItem[]) || [] };
        }
        return { success: true, data: (data as StoreItem[]) || [] };
    } catch (err: any) {
        console.error('Lỗi fetchStores:', err);
        return { success: false, data: [] as StoreItem[], error: err.message || err };
    }
}

export async function fetchClusterStores() {
    return fetchStores();
}

export async function upsertStore(store: Partial<StoreItem>) {
    try {
        const payload: any = {
            code: store.code?.trim(),
            name: store.name?.trim(),
            address: store.address?.trim() || '',
            is_active: store.is_active ?? true,
            updated_at: new Date().toISOString()
        };
        if (store.id) {
            payload.id = store.id;
        }

        const { data, error } = await supabase
            .from('stores')
            .upsert(payload, { onConflict: 'code' })
            .select();

        if (error) throw error;
        return { success: true, data: data?.[0] || null };
    } catch (err: any) {
        console.error('Lỗi upsertStore:', err);
        return { success: false, error: err.message || err };
    }
}

export async function deleteStoreById(id: string) {
    try {
        const { data, error } = await supabase
            .from('stores')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true, data };
    } catch (err: any) {
        console.error('Lỗi deleteStoreById:', err);
        return { success: false, error: err.message || err };
    }
}

export async function fetchEmployees(storeName?: string) {
    try {
        let query = supabase
            .from('employees')
            .select('*')
            .order('store_name', { ascending: true })
            .order('full_name', { ascending: true });

        if (storeName && storeName !== 'all') {
            query = query.eq('store_name', storeName);
        }

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: (data as EmployeeItem[]) || [] };
    } catch (err: any) {
        console.error('Lỗi fetchEmployees:', err);
        return { success: false, data: [] as EmployeeItem[], error: err.message || err };
    }
}

export async function upsertEmployee(emp: Partial<EmployeeItem>) {
    try {
        const { role: normalizedRole, department: normalizedDept } = parseEmployeeRoleAndDept(emp);
        const rawName = emp.full_name?.trim() || '';
        const capitalizedFullName = formatCapitalizeWords(rawName);

        const payload: any = {
            employee_id: emp.employee_id?.trim(),
            full_name: capitalizedFullName,
            store_name: emp.store_name?.trim(),
            role: normalizedRole,
            department: normalizedDept,
            job_title: normalizedDept,
            is_active: emp.is_active ?? true,
            updated_at: new Date().toISOString()
        };

        let resultData: any = null;

        // 1. Nếu có emp.id: Cập nhật trực tiếp theo khóa chính id (tránh lỗi xung đột onConflict)
        if (emp.id) {
            payload.id = emp.id;
            let { data, error } = await supabase
                .from('employees')
                .update(payload)
                .eq('id', emp.id)
                .select();

            if (error) {
                // Dự phòng nếu bảng employees trên Supabase chưa có cột department
                const fallbackPayload = { ...payload };
                delete fallbackPayload.department;
                const { data: fbData, error: fbError } = await supabase
                    .from('employees')
                    .update(fallbackPayload)
                    .eq('id', emp.id)
                    .select();
                if (fbError) throw fbError;
                resultData = fbData?.[0] || null;
            } else {
                resultData = data?.[0] || null;
            }
        } else {
            // 2. Nếu không có emp.id: Kiểm tra xem nhân viên này đã có trong bảng chưa
            const { data: existing } = await supabase
                .from('employees')
                .select('id')
                .eq('employee_id', payload.employee_id)
                .maybeSingle();

            if (existing?.id) {
                // Đã có -> Cập nhật theo existing.id
                let { data, error } = await supabase
                    .from('employees')
                    .update(payload)
                    .eq('id', existing.id)
                    .select();

                if (error) {
                    const fallbackPayload = { ...payload };
                    delete fallbackPayload.department;
                    const { data: fbData, error: fbError } = await supabase
                        .from('employees')
                        .update(fallbackPayload)
                        .eq('id', existing.id)
                        .select();
                    if (fbError) throw fbError;
                    resultData = fbData?.[0] || null;
                } else {
                    resultData = data?.[0] || null;
                }
            } else {
                // Chưa có -> Thêm mới bản ghi nhân viên
                let { data, error } = await supabase
                    .from('employees')
                    .insert(payload)
                    .select();

                if (error) {
                    const fallbackPayload = { ...payload };
                    delete fallbackPayload.department;
                    const { data: fbData, error: fbError } = await supabase
                        .from('employees')
                        .insert(fallbackPayload)
                        .select();
                    if (fbError) throw fbError;
                    resultData = fbData?.[0] || null;
                } else {
                    resultData = data?.[0] || null;
                }
            }
        }

        // 3. ĐỒNG BỘ 2 CHIỀU: Nếu có tài khoản trong user_profiles cùng employee_id, cập nhật luôn tên mới
        if (payload.employee_id && payload.full_name) {
            try {
                await supabase
                    .from('user_profiles')
                    .update({
                        full_name: payload.full_name,
                        store_name: payload.store_name,
                        updated_at: new Date().toISOString()
                    })
                    .eq('employee_id', payload.employee_id);
            } catch (syncErr) {
                console.warn('Lỗi đồng bộ sang user_profiles:', syncErr);
            }
        }

        return { success: true, data: resultData };
    } catch (err: any) {
        console.error('Lỗi upsertEmployee:', err);
        return { success: false, error: err.message || err };
    }
}

export async function upsertEmployeesBatch(emps: Partial<EmployeeItem>[]) {
    if (!emps || emps.length === 0) return { success: true, count: 0 };
    try {
        const payloads = emps.map(emp => {
            const { role: normalizedRole, department: normalizedDept } = parseEmployeeRoleAndDept(emp);
            return {
                ...(emp.id ? { id: emp.id } : {}),
                employee_id: emp.employee_id?.trim(),
                full_name: emp.full_name?.trim(),
                store_name: emp.store_name?.trim() || '',
                role: normalizedRole,
                department: normalizedDept,
                job_title: normalizedDept,
                is_active: emp.is_active ?? true,
                updated_at: new Date().toISOString()
            };
        });

        // 1. Thử upsert đầy đủ
        const { data, error } = await supabase
            .from('employees')
            .upsert(payloads, { onConflict: 'employee_id' })
            .select();

        if (error) {
            // 2. Dự phòng an toàn nếu chưa có cột department
            const fallbackPayloads = payloads.map(({ department, ...rest }) => rest);
            const { data: fbData, error: fbError } = await supabase
                .from('employees')
                .upsert(fallbackPayloads, { onConflict: 'employee_id' })
                .select();
            if (fbError) throw fbError;
            return { success: true, data: fbData, count: fallbackPayloads.length };
        }

        return { success: true, data, count: payloads.length };
    } catch (err: any) {
        console.error('Lỗi upsertEmployeesBatch:', err);
        return { success: false, count: 0, error: err.message || err };
    }
}

export async function deleteEmployeeById(id: string) {
    try {
        const { data, error } = await supabase
            .from('employees')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true, data };
    } catch (err: any) {
        console.error('Lỗi deleteEmployeeById:', err);
        return { success: false, error: err.message || err };
    }
}

// ==========================================
// 5. PHÂN HỆ TỪ ĐIỂN THI ĐUA (ADMIN CONFIG)
// ==========================================

const isUuid = (id: any): boolean =>
    typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function fetchCampaignDictionary() {
    try {
        const { data, error } = await supabase
            .from('campaign_dictionary')
            .select('*')
            .order('order_index', { ascending: true });

        if (error) {
            console.warn('Cảnh báo fetchCampaignDictionary order_index, thử fallback order raw_key:', error.message);
            const fallback = await supabase.from('campaign_dictionary').select('*').order('raw_key', { ascending: true });
            if (fallback.error) throw fallback.error;
            const mapped = (fallback.data || []).map((item: any) => ({
                ...item,
                order_index: item.order_index ?? item.sort_order ?? 0,
                sort_order: item.order_index ?? item.sort_order ?? 0
            }));
            return { success: true, data: mapped as CampaignDictItem[] };
        }

        const mapped = (data || []).map((item: any) => ({
            ...item,
            order_index: item.order_index ?? item.sort_order ?? 0,
            sort_order: item.order_index ?? item.sort_order ?? 0
        }));
        return { success: true, data: mapped as CampaignDictItem[] };
    } catch (err: any) {
        console.error('Lỗi fetchCampaignDictionary:', err);
        return { success: false, data: [] as CampaignDictItem[], error: err.message || err };
    }
}

export async function upsertCampaignDictionary(items: (Partial<CampaignDictItem> | any)[]) {
    if (!items.length) return { success: true, count: 0 };
    try {
        // Lấy danh sách hiện tại trong DB để phát hiện và xử lý an toàn foreign key
        const { data: currentRows, error: fetchErr } = await supabase
            .from('campaign_dictionary')
            .select('id, raw_key');
        if (fetchErr) throw fetchErr;

        const currentMap = new Map<string, string>();
        (currentRows || []).forEach(r => currentMap.set(r.id, r.raw_key));

        const newItemsToUpsert: any[] = [];

        for (const item of items) {
            const rawKey = (item.raw_key || item.rawKey || '')?.toString().trim();
            const displayName = (item.display_name || item.displayName || '')?.toString().trim();
            const unit = (item.unit || 'Cái')?.toString().trim();
            const isActive = item.is_active !== undefined ? Boolean(item.is_active) : (item.isActive !== undefined ? Boolean(item.isActive) : true);
            const orderIndex = Number(item.order_index ?? item.orderIndex ?? item.sort_order) || 0;

            if (!rawKey || !displayName) continue;

            const isExisting = item.id && isUuid(item.id) && currentMap.has(item.id);

            if (isExisting) {
                const oldRawKey = currentMap.get(item.id)!;
                if (oldRawKey !== rawKey) {
                    // Người dùng đổi mã gốc: Cần cascade cập nhật bảng employee_campaign_targets
                    // 1. Thêm bản ghi với raw_key mới vào campaign_dictionary
                    const { error: insErr } = await supabase
                        .from('campaign_dictionary')
                        .upsert({
                            raw_key: rawKey,
                            display_name: displayName,
                            unit: unit,
                            is_active: isActive,
                            order_index: orderIndex,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'raw_key' });
                    if (insErr) throw insErr;

                    // 2. Cascade cập nhật các bản ghi liên quan trong employee_campaign_targets
                    const { error: cascadeErr } = await supabase
                        .from('employee_campaign_targets')
                        .update({ raw_key: rawKey })
                        .eq('raw_key', oldRawKey);
                    if (cascadeErr) {
                        console.warn('Cảnh báo khi cascade employee_campaign_targets:', cascadeErr);
                    }

                    // 3. Xóa bản ghi cũ trong campaign_dictionary
                    await supabase.from('campaign_dictionary').delete().eq('id', item.id);
                } else {
                    // raw_key không đổi: CHỈ CẬP NHẬT các trường hiển thị, KHÔNG chạm vào cột raw_key
                    // để không kích hoạt kiểm tra khóa ngoại từ Postgres
                    const { error: upErr } = await supabase
                        .from('campaign_dictionary')
                        .update({
                            display_name: displayName,
                            unit: unit,
                            is_active: isActive,
                            order_index: orderIndex,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', item.id);
                    if (upErr) throw upErr;
                }
            } else {
                newItemsToUpsert.push({
                    raw_key: rawKey,
                    display_name: displayName,
                    unit: unit,
                    is_active: isActive,
                    order_index: orderIndex,
                    updated_at: new Date().toISOString()
                });
            }
        }

        if (newItemsToUpsert.length > 0) {
            const { error: insErr } = await supabase
                .from('campaign_dictionary')
                .upsert(newItemsToUpsert, { onConflict: 'raw_key' });
            if (insErr) throw insErr;
        }

        return { success: true, count: items.length };
    } catch (err: any) {
        console.error('Lỗi upsertCampaignDictionary:', err);
        return { success: false, error: err.message || String(err) };
    }
}

/**
 * Kiểm tra số lượng bản ghi chỉ tiêu đang liên kết với mã thi đua
 */
export async function checkCampaignDictUsage(idOrRawKey: string): Promise<{
    count: number;
    rawKey: string;
    error?: string;
}> {
    try {
        let rawKeyToCheck = idOrRawKey;
        if (isUuid(idOrRawKey)) {
            const { data } = await supabase
                .from('campaign_dictionary')
                .select('raw_key')
                .eq('id', idOrRawKey)
                .single();
            if (data?.raw_key) rawKeyToCheck = data.raw_key;
        }

        const { count, error } = await supabase
            .from('employee_campaign_targets')
            .select('*', { count: 'exact', head: true })
            .eq('raw_key', rawKeyToCheck);

        if (error) throw error;
        return { count: count ?? 0, rawKey: rawKeyToCheck };
    } catch (err: any) {
        return { count: 0, rawKey: idOrRawKey, error: err.message || String(err) };
    }
}

/**
 * Chuyển trạng thái một mục thi đua sang Tạm ẩn (Soft Archive)
 */
export async function archiveCampaignDictItem(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('campaign_dictionary')
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Lỗi archiveCampaignDictItem:', err);
        return { success: false, error: err.message || String(err) };
    }
}

export async function deleteCampaignDictItem(
    idOrRawKey: string,
    options?: { force?: boolean }
): Promise<{
    success: boolean;
    error?: string;
    hasLinkedData?: boolean;
    targetCount?: number;
    rawKey?: string;
}> {
    try {
        let rawKeyToDelete = idOrRawKey;
        if (isUuid(idOrRawKey)) {
            const { data } = await supabase
                .from('campaign_dictionary')
                .select('raw_key')
                .eq('id', idOrRawKey)
                .single();
            if (data?.raw_key) rawKeyToDelete = data.raw_key;
        }

        // Kiểm tra xem mã này có đang được bảng employee_campaign_targets tham chiếu hay không
        const { count, error: countErr } = await supabase
            .from('employee_campaign_targets')
            .select('*', { count: 'exact', head: true })
            .eq('raw_key', rawKeyToDelete);

        const targetCount = count ?? 0;
        if (!countErr && targetCount > 0) {
            if (!options?.force) {
                return {
                    success: false,
                    hasLinkedData: true,
                    targetCount,
                    rawKey: rawKeyToDelete,
                    error: `Không thể xóa [${rawKeyToDelete}] vì đang có ${targetCount} chỉ tiêu nhân viên liên kết ở các tháng trước.`
                };
            }

            // Nếu người dùng chọn xóa cưỡng bức (Force Delete): Xóa các chỉ tiêu liên quan trước
            const { error: delTargetErr } = await supabase
                .from('employee_campaign_targets')
                .delete()
                .eq('raw_key', rawKeyToDelete);

            if (delTargetErr) throw delTargetErr;
        }

        let query = supabase.from('campaign_dictionary').delete();
        if (isUuid(idOrRawKey)) {
            query = query.eq('id', idOrRawKey);
        } else {
            query = query.eq('raw_key', idOrRawKey);
        }
        const { error } = await query;
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Lỗi deleteCampaignDictItem:', err);
        return { success: false, error: err.message || String(err) };
    }
}

// ==========================================
// 6. PHÂN HỆ MỤC TIÊU NHÂN VIÊN (DOANH THU & THI ĐUA)
// ==========================================

export async function fetchEmployeeRevenueTargets(month: number, year: number) {
    try {
        const { data, error } = await supabase
            .from('employee_targets')
            .select('employee_id, target_revenue')
            .eq('month', month)
            .eq('year', year);

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err: any) {
        console.error('Lỗi fetchEmployeeRevenueTargets:', err);
        return { success: false, data: [], error: err.message || err };
    }
}

export async function fetchEmployeeCampaignTargets(month: number, year: number) {
    try {
        const { data, error } = await supabase
            .from('employee_campaign_targets')
            .select('*')
            .eq('month', month)
            .eq('year', year);

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err: any) {
        console.error('Lỗi fetchEmployeeCampaignTargets:', err);
        return { success: false, data: [], error: err.message || err };
    }
}

export async function upsertEmployeeCampaignTargetsBatch(items: EmployeeCampaignTargetItem[]) {
    if (!items.length) return { success: true, count: 0 };
    try {
        const payloads = items.map(t => ({
            employee_id: t.employeeId.trim(),
            raw_key: t.rawKey.trim(),
            month: t.month,
            year: t.year,
            target_value: Number(t.targetValue) || 0,
            updated_at: new Date().toISOString()
        }));

        const { data, error } = await supabase
            .from('employee_campaign_targets')
            .upsert(payloads, { onConflict: 'employee_id,raw_key,month,year' });

        if (error) throw error;
        return { success: true, data, count: payloads.length };
    } catch (err: any) {
        console.error('Lỗi upsertEmployeeCampaignTargetsBatch:', err);
        return { success: false, error: err.message || err };
    }
}

export async function saveUnifiedEmployeeTargets(payload: UnifiedEmployeeTargetPayload) {
    try {
        const promises: PromiseLike<any>[] = [];

        if (payload.revenueTargets.length > 0) {
            const revData = payload.revenueTargets.map(item => ({
                employee_id: item.employee_id.trim(),
                month: payload.month,
                year: payload.year,
                target_revenue: Number(item.target_revenue) || 0,
                updated_at: new Date().toISOString()
            }));
            promises.push(
                supabase
                    .from('employee_targets')
                    .upsert(revData, { onConflict: 'employee_id,month,year' })
            );
        }

        if (payload.campaignTargets.length > 0) {
            const campData = payload.campaignTargets.map(item => ({
                employee_id: item.employee_id.trim(),
                raw_key: item.raw_key.trim(),
                month: payload.month,
                year: payload.year,
                target_value: Number(item.target_value) || 0,
                updated_at: new Date().toISOString()
            }));
            promises.push(
                supabase
                    .from('employee_campaign_targets')
                    .upsert(campData, { onConflict: 'employee_id,raw_key,month,year' })
            );
        }

        const results = await Promise.all(promises);
        const hasError = results.some(r => r.error);
        if (hasError) throw new Error('Có lỗi khi cập nhật chỉ tiêu lên hệ thống!');

        return { success: true };
    } catch (err: any) {
        console.error('Lỗi saveUnifiedEmployeeTargets:', err);
        return { success: false, error: err.message || err };
    }
}

// ==========================================
// REALTIME LISTENER CHO daily_business_records
// ==========================================
export function subscribeDailyBusinessRecords(callback: () => void) {
    const channel = supabase
        .channel('realtime_daily_business_records')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'daily_business_records' },
            () => {
                callback();
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

// ========================================================
// TRUY VẤN DỮ LIỆU VẼ BIỂU ĐỒ DIỄN BIẾN THÁNG (CHART)
// ========================================================
export async function fetchMonthlyRecordsForChart(month: number, year: number, storeName?: string) {
    try {
        const { data, error } = await supabase
            .from('daily_business_records')
            .select('*')
            .eq('month', month)
            .eq('year', year)
            .order('report_date', { ascending: true });

        if (error) throw error;

        const formatted = (data || []).map(row => ({
            id: row.id,
            storeName: row.store_name || '',
            reportDate: row.report_date || '',
            month: Number(row.month || 0),
            year: Number(row.year || 0),
            passedDays: Number(row.passed_days ?? 0),
            totalDays: Number(row.total_days ?? 0),
            revenueActual: Number(row.revenue_actual ?? 0),
            revenueTarget: Number(row.revenue_target ?? 0),
            revenueInstallment: Number(row.revenue_installment ?? 0),
            installmentRate: Number(row.installment_rate ?? 0),
            forecastCompletionRate: Number(row.forecast_completion_rate ?? 0),
            emulationSummary: row.emulation_summary || {},
            rawEmulation: row.raw_emulation || '',
            rawRevenue: row.raw_revenue || '',
            dataType: row.data_type || 'daily',
            updatedAt: row.updated_at || ''
        }));

        return { success: true, data: formatted as BusinessDayRecord[] };
    } catch (err: any) {
        console.error('Lỗi fetchMonthlyRecordsForChart:', err);
        return { success: false, data: [] as BusinessDayRecord[], error: err.message || err };
    }
}

