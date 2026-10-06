import { supabase } from './supabase';
import { isStoreMatch } from './formatters';

export type CampaignScoringMode = 'POINTS' | 'COUNT';

export interface StoreCampaignScoreConfig {
    store_name: string;                      // Tên siêu thị (viết tắt hoặc đầy đủ), hoặc 'DEFAULT'
    scoring_mode: CampaignScoringMode;       // 'POINTS': Tính điểm đạt / tổng điểm; 'COUNT': Chỉ tính đạt / không đạt
    campaign_scores: Record<string, number>; // key: raw_key hoặc canonicalKey -> số điểm (ví dụ: 1, 2, 0.5,...)
    updated_at?: string;
    updated_by?: string;
}

const LOCAL_STORAGE_KEY = 'saleshub_store_campaign_scores_v1';

/**
 * Lấy toàn bộ bản đồ cấu hình điểm thi đua của các siêu thị từ LocalStorage
 */
export function getAllStoreCampaignScoreConfigs(): Record<string, StoreCampaignScoreConfig> {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('Lỗi đọc cấu hình điểm thi đua từ LocalStorage:', e);
    }
    return {};
}

/**
 * Lấy cấu hình tính điểm của 1 siêu thị cụ thể
 * Tự động đối chiếu thông minh qua isStoreMatch và fallback về DEFAULT
 */
export function getStoreCampaignScoreConfig(storeName?: string): StoreCampaignScoreConfig {
    const allConfigs = getAllStoreCampaignScoreConfigs();

    if (!storeName || storeName === 'all' || storeName === 'Tổng') {
        const defaultCfg = allConfigs['DEFAULT'];
        if (defaultCfg) return defaultCfg;
        return {
            store_name: 'DEFAULT',
            scoring_mode: 'COUNT',
            campaign_scores: {}
        };
    }

    // 1. Tìm khớp chính xác key
    if (allConfigs[storeName]) {
        return allConfigs[storeName];
    }

    // 2. Tìm khớp tương đương qua isStoreMatch
    for (const [key, cfg] of Object.entries(allConfigs)) {
        if (key !== 'DEFAULT' && isStoreMatch(key, storeName)) {
            return cfg;
        }
    }

    // 3. Fallback cấu hình mặc định DEFAULT
    const defaultCfg = allConfigs['DEFAULT'];
    if (defaultCfg) {
        return {
            ...defaultCfg,
            store_name: storeName
        };
    }

    // 4. Mặc định chưa có cấu hình: chế độ COUNT (chỉ tính đạt / không đạt)
    return {
        store_name: storeName,
        scoring_mode: 'COUNT',
        campaign_scores: {}
    };
}

/**
 * Lấy số điểm quy định của một chương trình thi đua cụ thể theo cấu hình siêu thị
 * Mặc định trả về 1 điểm nếu chưa gán điểm hoặc điểm <= 0
 */
export function getCampaignPoints(
    campaignKey: string,
    config?: StoreCampaignScoreConfig | null
): number {
    if (!config || !config.campaign_scores) return 1;

    // Tìm theo exact key
    if (config.campaign_scores[campaignKey] !== undefined) {
        const pts = Number(config.campaign_scores[campaignKey]);
        return pts > 0 ? pts : 1;
    }

    // Tìm không phân biệt hoa thường hoặc loại bỏ khoảng trắng
    const cleanKey = campaignKey.trim().toLowerCase();
    for (const [k, v] of Object.entries(config.campaign_scores)) {
        if (k.trim().toLowerCase() === cleanKey) {
            const pts = Number(v);
            return pts > 0 ? pts : 1;
        }
    }

    return 1;
}

/**
 * Tính số điểm đạt được của một chương trình thi đua:
 * Quy tắc: Nếu % Dự kiến đạt (%DKHT) >= 100% -> Có trọn vẹn điểm. Dưới 100% -> 0 điểm.
 */
export function calculateCampaignScore(
    rate: number,
    campaignKey: string,
    config?: StoreCampaignScoreConfig | null
): { achievedPoints: number; maxPoints: number; isPassed: boolean } {
    const maxPoints = getCampaignPoints(campaignKey, config);
    const isPassed = rate >= 100;
    const achievedPoints = isPassed ? maxPoints : 0;
    return { achievedPoints, maxPoints, isPassed };
}

/**
 * Lưu cấu hình tính điểm thi đua cho 1 siêu thị (hoặc nhiều siêu thị phụ trách)
 * Đồng thời đồng bộ xuống LocalStorage và đẩy lên Cloud Supabase (nếu bảng tồn tại)
 */
export async function saveStoreCampaignScoreConfig(
    config: StoreCampaignScoreConfig,
    options?: {
        applyToStoreNames?: string[];
        userName?: string;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const allConfigs = getAllStoreCampaignScoreConfigs();
        const now = new Date().toISOString();
        const updatedBy = options?.userName || 'User';

        const targets = (options?.applyToStoreNames && options.applyToStoreNames.length > 0)
            ? Array.from(new Set([config.store_name, ...options.applyToStoreNames]))
            : [config.store_name];

        // 1. Lưu vào LocalStorage
        targets.forEach(sName => {
            allConfigs[sName] = {
                ...config,
                store_name: sName,
                updated_at: now,
                updated_by: updatedBy
            };
        });

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allConfigs));

        // 2. Thử đồng bộ lên Supabase Cloud (bảng store_campaign_scores)
        try {
            const upsertRows = targets.map(sName => ({
                store_name: sName,
                scoring_mode: config.scoring_mode,
                campaign_scores: config.campaign_scores,
                updated_by: updatedBy,
                updated_at: now
            }));

            const { error } = await supabase
                .from('store_campaign_scores')
                .upsert(upsertRows, { onConflict: 'store_name' });

            if (error) {
                // Không ngắt luồng nếu bảng chưa được tạo trên Supabase (404 / 42P01)
                console.warn('Lưu Cloud Supabase (store_campaign_scores) không thành công, đã lưu LocalStorage:', error.message);
            }
        } catch (cloudErr) {
            console.warn('Không thể kết nối Supabase store_campaign_scores:', cloudErr);
        }

        return { success: true };
    } catch (e: any) {
        console.error('Lỗi saveStoreCampaignScoreConfig:', e);
        return { success: false, error: e?.message || 'Không thể lưu cấu hình' };
    }
}

/**
 * Tải dữ liệu cấu hình tính điểm từ Cloud Supabase nếu có
 */
export async function syncStoreCampaignScoresFromCloud(): Promise<Record<string, StoreCampaignScoreConfig>> {
    try {
        const { data, error } = await supabase
            .from('store_campaign_scores')
            .select('*');

        if (!error && Array.isArray(data) && data.length > 0) {
            const allConfigs = getAllStoreCampaignScoreConfigs();
            data.forEach((row: any) => {
                if (row && row.store_name) {
                    allConfigs[row.store_name] = {
                        store_name: row.store_name,
                        scoring_mode: row.scoring_mode === 'POINTS' ? 'POINTS' : 'COUNT',
                        campaign_scores: row.campaign_scores || {},
                        updated_at: row.updated_at,
                        updated_by: row.updated_by
                    };
                }
            });
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allConfigs));
            return allConfigs;
        }
    } catch {
        // Fallback LocalStorage âm thầm
    }
    return getAllStoreCampaignScoreConfigs();
}

/**
 * Kiểm tra trạng thái kết nối trực tiếp với Supabase Cloud cho phân hệ Thi đua
 */
export async function checkSupabaseCampaignConnection(): Promise<{
    isConnected: boolean;
    campaignDictReady: boolean;
    campaignDictCount: number;
    storeScoresReady: boolean;
    storeScoresCount: number;
    error?: string;
    checkedAt: string;
}> {
    const checkedAt = new Date().toLocaleTimeString('vi-VN');
    try {
        const [dictRes, scoreRes] = await Promise.all([
            supabase.from('campaign_dictionary').select('*', { count: 'exact', head: true }),
            supabase.from('store_campaign_scores').select('*', { count: 'exact', head: true })
        ]);

        const campaignDictReady = !dictRes.error;
        const storeScoresReady = !scoreRes.error;
        const isConnected = campaignDictReady && storeScoresReady;

        return {
            isConnected,
            campaignDictReady,
            campaignDictCount: dictRes.count || 0,
            storeScoresReady,
            storeScoresCount: scoreRes.count || 0,
            error: dictRes.error?.message || scoreRes.error?.message,
            checkedAt
        };
    } catch (err: any) {
        return {
            isConnected: false,
            campaignDictReady: false,
            campaignDictCount: 0,
            storeScoresReady: false,
            storeScoresCount: 0,
            error: err?.message || 'Không thể kết nối máy chủ Supabase',
            checkedAt
        };
    }
}

