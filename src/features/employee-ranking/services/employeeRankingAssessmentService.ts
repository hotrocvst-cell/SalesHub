import { supabase } from '../../../core/lib/supabase';

export interface EmployeeRankingAssessmentData {
    store_name: string;
    month: number;
    year: number;
    comment: string;
    show_on_report?: boolean;
    updated_at?: string;
    updated_by?: string;
}

const STORAGE_KEY_PREFIX = 'saleshub_emp_ranking_assessment';

function getCleanStoreKey(storeName: string): string {
    if (!storeName || storeName === 'all') return 'ALL';
    return storeName.trim().replace(/\s+/g, '_');
}

/**
 * Tải nhận xét xếp hạng nhân viên từ Cloud Supabase (system_performance_configs) & LocalStorage fallback
 */
export async function fetchEmployeeRankingAssessment(
    storeName: string,
    month: number,
    year: number
): Promise<EmployeeRankingAssessmentData | null> {
    const cleanKey = getCleanStoreKey(storeName);
    const configKey = `emp_ranking_assessment_${cleanKey}_${month}_${year}`;

    // 1. Tải từ Cloud Supabase qua system_performance_configs
    try {
        const { data, error } = await supabase
            .from('system_performance_configs')
            .select('config_data')
            .eq('config_key', configKey)
            .maybeSingle();

        if (!error && data?.config_data?.comment) {
            const res = data.config_data as EmployeeRankingAssessmentData;
            try {
                localStorage.setItem(`${STORAGE_KEY_PREFIX}_${cleanKey}_${month}_${year}`, JSON.stringify(res));
            } catch { }
            return res;
        }
    } catch (e) {
        console.warn('Lỗi tải assessment từ Supabase:', e);
    }

    // 2. Fallback đọc LocalStorage cache
    try {
        const cached = localStorage.getItem(`${STORAGE_KEY_PREFIX}_${cleanKey}_${month}_${year}`);
        if (cached) {
            return JSON.parse(cached) as EmployeeRankingAssessmentData;
        }
    } catch { }

    return null;
}

/**
 * Lưu nhận xét xếp hạng nhân viên lên Cloud Supabase & LocalStorage
 */
export async function saveEmployeeRankingAssessment(
    data: EmployeeRankingAssessmentData
): Promise<{ success: boolean; fromSupabase: boolean; error?: string }> {
    const cleanKey = getCleanStoreKey(data.store_name);
    const configKey = `emp_ranking_assessment_${cleanKey}_${data.month}_${data.year}`;
    const nowIso = new Date().toISOString();

    const payload: EmployeeRankingAssessmentData = {
        ...data,
        updated_at: nowIso
    };

    // 1. Lưu LocalStorage tức thì
    try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}_${cleanKey}_${data.month}_${data.year}`, JSON.stringify(payload));
    } catch { }

    // 2. Đồng bộ lên Cloud: Bảng system_performance_configs
    let isCloudSaved = false;
    let cloudError: string | undefined;

    try {
        const { error } = await supabase
            .from('system_performance_configs')
            .upsert({
                config_key: configKey,
                config_data: payload,
                updated_at: nowIso,
                updated_by: data.updated_by || 'Quản lý'
            }, { onConflict: 'config_key' });

        if (!error) {
            isCloudSaved = true;
        } else {
            cloudError = error.message;
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
