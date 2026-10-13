import { supabase } from '../../../core/lib/supabase';
import { type ClusterTargetConfigItem, type ClusterAssessmentData } from '../types';

const STORAGE_KEY_TARGETS = 'saleshub_cluster_targets_cache';
const STORAGE_KEY_ASSESSMENT = 'saleshub_cluster_assessment_cache';

export const CLUSTER_REPORT_SQL = `
-- Bảng lưu cấu hình Target vượt trội & Doanh thu TB 3 tháng cho Cụm Siêu Thị
CREATE TABLE IF NOT EXISTS public.cluster_target_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    target_over NUMERIC DEFAULT 0,
    avg_3months NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(store_name, month, year)
);

-- Bảng lưu Nhận xét & Hướng dẫn Sức khỏe Cụm
CREATE TABLE IF NOT EXISTS public.cluster_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    comment TEXT,
    highlights TEXT[],
    action_items TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(month, year)
);

-- RLS
ALTER TABLE public.cluster_target_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public cluster_target_configs" ON public.cluster_target_configs;
CREATE POLICY "Public cluster_target_configs" ON public.cluster_target_configs FOR ALL USING (true);

DROP POLICY IF EXISTS "Public cluster_assessments" ON public.cluster_assessments;
CREATE POLICY "Public cluster_assessments" ON public.cluster_assessments FOR ALL USING (true);
`;

/**
 * Tải cấu hình Target của Cụm theo Tháng / Năm từ Cloud (system_performance_configs)
 */
export async function fetchClusterTargetConfigs(month: number, year: number): Promise<ClusterTargetConfigItem[]> {
    const configKey = `cluster_targets_${month}_${year}`;

    // 1. Tải từ Cloud qua bảng system_performance_configs (bảng đã tồn tại 100% trong DB)
    try {
        const { data, error } = await supabase
            .from('system_performance_configs')
            .select('config_data')
            .eq('config_key', configKey)
            .maybeSingle();

        if (!error && data?.config_data) {
            const list = Array.isArray(data.config_data) ? data.config_data : (data.config_data.items || []);
            if (Array.isArray(list) && list.length > 0) {
                try {
                    localStorage.setItem(`${STORAGE_KEY_TARGETS}_${month}_${year}`, JSON.stringify(list));
                } catch { }
                return list as ClusterTargetConfigItem[];
            }
        }
    } catch { }

    // 2. Fallback LocalStorage cache
    try {
        const cached = localStorage.getItem(`${STORAGE_KEY_TARGETS}_${month}_${year}`);
        if (cached) {
            return JSON.parse(cached) as ClusterTargetConfigItem[];
        }
    } catch { }

    return [];
}

/**
 * Tải toàn bộ gói Cấu hình Target gồm items và nhịp chung globalPaceRate
 */
export async function fetchClusterTargetConfigPackage(month: number, year: number): Promise<{
    items: ClusterTargetConfigItem[];
    globalPaceRate: number;
    updatedAt?: string;
}> {
    const configKey = `cluster_targets_${month}_${year}`;
    let globalPaceRate = 100;
    let items: ClusterTargetConfigItem[] = [];
    let updatedAt: string | undefined;

    try {
        const { data, error } = await supabase
            .from('system_performance_configs')
            .select('config_data, updated_at')
            .eq('config_key', configKey)
            .maybeSingle();

        if (!error && data?.config_data) {
            if (data.config_data.globalPaceRate) {
                globalPaceRate = Number(data.config_data.globalPaceRate) || 100;
            }
            if (Array.isArray(data.config_data)) {
                items = data.config_data;
            } else if (Array.isArray(data.config_data.items)) {
                items = data.config_data.items;
            }
            updatedAt = data.updated_at || data.config_data.updated_at;
            if (items.length > 0) {
                try {
                    localStorage.setItem(`${STORAGE_KEY_TARGETS}_${month}_${year}`, JSON.stringify(items));
                    localStorage.setItem(`${STORAGE_KEY_TARGETS}_pace_${month}_${year}`, String(globalPaceRate));
                } catch { }
                return { items, globalPaceRate, updatedAt };
            }
        }
    } catch { }

    // Fallback qua fetchClusterTargetConfigs
    items = await fetchClusterTargetConfigs(month, year);
    try {
        const cachedPace = localStorage.getItem(`${STORAGE_KEY_TARGETS}_pace_${month}_${year}`);
        if (cachedPace) globalPaceRate = Number(cachedPace) || 100;
    } catch { }

    return { items, globalPaceRate, updatedAt };
}

/**
 * Lưu danh sách Target Cụm lên Supabase Cloud & Local Cache (đồng bộ đa thiết bị)
 */
export async function saveClusterTargetConfigs(
    month: number,
    year: number,
    configs: ClusterTargetConfigItem[],
    globalPaceRate: number = 100
): Promise<{ success: boolean; fromSupabase: boolean; error?: string }> {
    // 1. Lưu LocalStorage tức thì
    try {
        localStorage.setItem(`${STORAGE_KEY_TARGETS}_${month}_${year}`, JSON.stringify(configs));
        localStorage.setItem(`${STORAGE_KEY_TARGETS}_pace_${month}_${year}`, String(globalPaceRate));
    } catch { }

    const configKey = `cluster_targets_${month}_${year}`;
    let isCloudSaved = false;
    let cloudError: string | undefined;

    // 2. Đồng bộ lên Cloud: Bảng system_performance_configs (Đảm bảo 100% hoạt động ngay)
    try {
        const { error: errPerf } = await supabase
            .from('system_performance_configs')
            .upsert({
                config_key: configKey,
                config_data: {
                    month,
                    year,
                    globalPaceRate,
                    items: configs,
                    updated_at: new Date().toISOString()
                },
                updated_at: new Date().toISOString()
            }, { onConflict: 'config_key' });

        if (!errPerf) {
            isCloudSaved = true;
        } else {
            cloudError = errPerf.message;
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
 * Tải Nhận xét Sức Khỏe Cụm từ Cloud (system_performance_configs)
 */
export async function fetchClusterAssessment(month: number, year: number): Promise<ClusterAssessmentData | null> {
    const configKey = `cluster_assessment_${month}_${year}`;

    // 1. Tải từ Cloud qua system_performance_configs
    try {
        const { data, error } = await supabase
            .from('system_performance_configs')
            .select('config_data')
            .eq('config_key', configKey)
            .maybeSingle();

        if (!error && data?.config_data?.comment) {
            const res = data.config_data as ClusterAssessmentData;
            try {
                localStorage.setItem(`${STORAGE_KEY_ASSESSMENT}_${month}_${year}`, JSON.stringify(res));
            } catch { }
            return res;
        }
    } catch { }

    // 2. Fallback cache
    try {
        const cached = localStorage.getItem(`${STORAGE_KEY_ASSESSMENT}_${month}_${year}`);
        if (cached) {
            return JSON.parse(cached) as ClusterAssessmentData;
        }
    } catch { }

    return null;
}

/**
 * Lưu Nhận xét Sức Khỏe Cụm lên Cloud (system_performance_configs)
 */
export async function saveClusterAssessment(
    data: ClusterAssessmentData
): Promise<{ success: boolean; fromSupabase: boolean; error?: string }> {
    try {
        localStorage.setItem(`${STORAGE_KEY_ASSESSMENT}_${data.month}_${data.year}`, JSON.stringify(data));
    } catch { }

    const configKey = `cluster_assessment_${data.month}_${data.year}`;
    let isCloudSaved = false;

    // 1. Lưu system_performance_configs
    try {
        const { error: errPerf } = await supabase
            .from('system_performance_configs')
            .upsert({
                config_key: configKey,
                config_data: {
                    ...data,
                    updated_at: new Date().toISOString()
                },
                updated_at: new Date().toISOString()
            }, { onConflict: 'config_key' });

        if (!errPerf) isCloudSaved = true;
    } catch { }

    return { success: true, fromSupabase: isCloudSaved };
}
