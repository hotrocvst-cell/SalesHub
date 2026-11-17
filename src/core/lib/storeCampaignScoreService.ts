import { supabase } from './supabase';
import { isStoreMatch, getShortStoreName } from './formatters';

export type CampaignScoringMode = 'POINTS' | 'COUNT';

export interface StoreCampaignScoreConfig {
    store_name: string;                      // Tên ST (viết tắt hoặc đầy đủ), hoặc 'DEFAULT'
    month?: number;                          // Tháng áp dụng (1 - 12)
    year?: number;                           // Năm áp dụng (ví dụ 2026)
    scoring_mode: CampaignScoringMode;       // 'POINTS': Tính điểm đạt / tổng điểm; 'COUNT': Chỉ tính đạt / không đạt
    campaign_scores: Record<string, number>; // key: raw_key hoặc canonicalKey -> số điểm (ví dụ: 1, 2, 0.5,...)
    updated_at?: string;
    updated_by?: string;
}

const LOCAL_STORAGE_KEY = 'saleshub_store_campaign_scores_v1';
const LOCAL_STORAGE_MONTHLY_KEY = 'saleshub_store_campaign_scores_monthly_v1';
const CLOUD_CONFIG_PREFIX = 'store_campaign_scores_';

/**
 * Trích xuất tháng từ tiền tố tên thi đua (ví dụ "T11 - Laptop" -> 11, "T10 - Laptop" -> 10, "Sim SL" -> null)
 */
export function extractCampaignMonthPrefix(nameOrKey?: string): number | null {
    if (!nameOrKey) return null;
    const match = String(nameOrKey).trim().match(/^t(\d{1,2})\s*-\s*/i);
    if (match && match[1]) {
        const m = parseInt(match[1], 10);
        if (m >= 1 && m <= 12) return m;
    }
    return null;
}

/**
 * Tạo khóa định danh duy nhất cho cấu hình điểm theo ST + Tháng + Năm
 */
export function buildMonthlyScoreKey(storeName: string, month: number, year: number): string {
    const sName = (storeName || 'DEFAULT').trim();
    return `${sName}__${month}__${year}`;
}

export function getCleanStoreKey(storeName: string): string {
    if (!storeName || storeName === 'all' || storeName === 'Tổng' || storeName === 'DEFAULT') return 'DEFAULT';
    return storeName.trim().replace(/\s+/g, '_');
}

/**
 * Lấy toàn bộ bản đồ cấu hình điểm thi đua legacy từ LocalStorage
 */
export function getAllStoreCampaignScoreConfigs(): Record<string, StoreCampaignScoreConfig> {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('Lỗi đọc cấu hình điểm thi đua legacy từ LocalStorage:', e);
    }
    return {};
}

/**
 * Lấy toàn bộ bản đồ cấu hình điểm thi đua THEO THÁNG từ LocalStorage
 */
export function getAllMonthlyStoreCampaignScoreConfigs(): Record<string, StoreCampaignScoreConfig> {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_MONTHLY_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('Lỗi đọc cấu hình điểm thi đua theo tháng từ LocalStorage:', e);
    }
    return {};
}

/**
 * Lấy cấu hình tính điểm của 1 ST cụ thể theo Tháng và Năm
 * Chuỗi Fallback thông minh:
 * 1. Khớp chính xác (storeName, month, year)
 * 2. Khớp tương đương isStoreMatch (month, year)
 * 3. Kế thừa tháng trước (storeName, prevMonth, prevYear)
 * 4. Khớp DEFAULT của tháng đó (DEFAULT, month, year)
 * 5. Khớp DEFAULT của tháng trước (DEFAULT, prevMonth, prevYear)
 * 6. Khớp cấu hình legacy (storeName)
 * 7. Khớp cấu hình legacy DEFAULT
 * 8. Trả về cấu hình mặc định COUNT
 */
export function getStoreCampaignScoreConfig(
    storeName?: string,
    storesList?: Array<{ code?: string; name: string; id?: string }>,
    month?: number,
    year?: number
): StoreCampaignScoreConfig {
    const targetStore = (!storeName || storeName === 'all' || storeName === 'Tổng') ? 'DEFAULT' : storeName.trim();
    const targetMonth = month && month >= 1 && month <= 12 ? month : (new Date().getMonth() + 1);
    const targetYear = year && year >= 2000 ? year : (new Date().getFullYear());

    const monthlyConfigs = getAllMonthlyStoreCampaignScoreConfigs();
    const legacyConfigs = getAllStoreCampaignScoreConfigs();

    // 1. Tìm cấu hình chính xác theo ST + Tháng + Năm
    const exactMonthlyKey = buildMonthlyScoreKey(targetStore, targetMonth, targetYear);
    if (monthlyConfigs[exactMonthlyKey]) {
        return monthlyConfigs[exactMonthlyKey];
    }

    // 2. Tìm khớp tương đương qua isStoreMatch trong cùng tháng
    if (targetStore !== 'DEFAULT') {
        for (const [key, cfg] of Object.entries(monthlyConfigs)) {
            if (cfg.month === targetMonth && cfg.year === targetYear && cfg.store_name !== 'DEFAULT') {
                if (isStoreMatch(cfg.store_name, targetStore, storesList)) {
                    return cfg;
                }
            }
        }

        // Khớp qua Short Name trong cùng tháng
        const shortTarget = getShortStoreName(targetStore).toLowerCase();
        if (shortTarget && shortTarget !== 'tổng') {
            for (const [key, cfg] of Object.entries(monthlyConfigs)) {
                if (cfg.month === targetMonth && cfg.year === targetYear && cfg.store_name !== 'DEFAULT') {
                    if (getShortStoreName(cfg.store_name).toLowerCase() === shortTarget) {
                        return cfg;
                    }
                }
            }
        }
    }

    // 3. Fallback tháng trước (Kế thừa mượt mà)
    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;

    const prevMonthlyKey = buildMonthlyScoreKey(targetStore, prevMonth, prevYear);
    if (monthlyConfigs[prevMonthlyKey]) {
        return {
            ...monthlyConfigs[prevMonthlyKey],
            month: targetMonth,
            year: targetYear
        };
    }

    if (targetStore !== 'DEFAULT') {
        for (const [key, cfg] of Object.entries(monthlyConfigs)) {
            if (cfg.month === prevMonth && cfg.year === prevYear && cfg.store_name !== 'DEFAULT') {
                if (isStoreMatch(cfg.store_name, targetStore, storesList)) {
                    return {
                        ...cfg,
                        month: targetMonth,
                        year: targetYear
                    };
                }
            }
        }
    }

    // 4. Fallback DEFAULT của tháng hiện tại
    const defaultMonthlyKey = buildMonthlyScoreKey('DEFAULT', targetMonth, targetYear);
    if (monthlyConfigs[defaultMonthlyKey]) {
        return {
            ...monthlyConfigs[defaultMonthlyKey],
            store_name: targetStore,
            month: targetMonth,
            year: targetYear
        };
    }

    // 5. Fallback DEFAULT của tháng trước
    const defaultPrevMonthlyKey = buildMonthlyScoreKey('DEFAULT', prevMonth, prevYear);
    if (monthlyConfigs[defaultPrevMonthlyKey]) {
        return {
            ...monthlyConfigs[defaultPrevMonthlyKey],
            store_name: targetStore,
            month: targetMonth,
            year: targetYear
        };
    }

    // 6. Fallback Legacy configs (bảng cũ)
    if (targetStore !== 'DEFAULT' && legacyConfigs[targetStore]) {
        return {
            ...legacyConfigs[targetStore],
            month: targetMonth,
            year: targetYear
        };
    }

    if (targetStore !== 'DEFAULT') {
        for (const [key, cfg] of Object.entries(legacyConfigs)) {
            if (key !== 'DEFAULT' && isStoreMatch(key, targetStore, storesList)) {
                return {
                    ...cfg,
                    month: targetMonth,
                    year: targetYear
                };
            }
        }
    }

    // 7. Fallback Legacy DEFAULT
    const defaultLegacy = legacyConfigs['DEFAULT'];
    if (defaultLegacy) {
        return {
            ...defaultLegacy,
            store_name: targetStore,
            month: targetMonth,
            year: targetYear
        };
    }

    // 8. Mặc định chưa có cấu hình: chế độ COUNT (chỉ tính đạt / không đạt)
    return {
        store_name: targetStore,
        month: targetMonth,
        year: targetYear,
        scoring_mode: 'COUNT',
        campaign_scores: {}
    };
}

export function normalizeScoreToken(str: string): string {
    if (!str) return '';
    let s = str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/^t\d{1,2}\s*-\s*(t\d{1,2}\s*)?/i, '')
        .replace(/[^a-z0-9]/g, ' ')
        .trim();

    s = s
        .replace(/\bphu\s*kien\b/g, 'pk')
        .replace(/\bdien\s*may\s*xanh\b/g, 'dmx')
        .replace(/\bbao\s*hiem\b/g, 'bh')
        .replace(/\btho\s*(dmx|ict)?\b/g, 'thoict')
        .replace(/\bcap\s*sac\b/g, 'capsac')
        .replace(/\bday\s*sac\b/g, 'capsac')
        .replace(/\bcap\b/g, 'capsac')
        .replace(/\bsac\s*du\s*phong\b/g, 'pinsdp')
        .replace(/\bpin\s*sdp\b/g, 'pinsdp')
        .replace(/\bnap\s*rut\b/g, 'naprut')
        .replace(/\bvi\s*tra\s*sau\b/g, 'vitrasau')
        .replace(/\bvay\s*tien\s*mat\b/g, 'vaytienmat')
        .replace(/\s+/g, '');

    return s;
}

/**
 * Lấy số điểm quy định của một chương trình thi đua cụ thể theo cấu hình ST
 * Tự động loại bỏ tiền tố tháng (T11 -, T10 -) khi đối chiếu
 * Mặc định trả về 1 điểm nếu chưa gán điểm hoặc điểm <= 0
 */
export function getCampaignPoints(
    campaignKey: string,
    config?: StoreCampaignScoreConfig | null
): number {
    if (!config || !config.campaign_scores) return 1;

    // 1. Tìm theo exact key nếu có điểm tùy biến > 1
    if (config.campaign_scores[campaignKey] !== undefined) {
        const pts = Number(config.campaign_scores[campaignKey]);
        if (pts > 1) return pts;
    }

    // 2. Tìm qua token chuẩn hóa: Ưu tiên trả về điểm tùy biến (> 1) của bất kỳ alias nào có cùng token
    // Ví dụ: User chỉ chỉnh "T11 - Laptop" = 2đ (hoặc chỉ chỉnh "Laptop" = 2đ) -> Cả 2 đều nhận 2đ!
    const tok = normalizeScoreToken(campaignKey);
    if (tok) {
        for (const [k, v] of Object.entries(config.campaign_scores)) {
            if (normalizeScoreToken(k) === tok) {
                const pts = Number(v);
                if (pts > 1) return pts;
            }
        }
    }

    // 3. Tìm theo exact key với điểm chuẩn (kể cả 1 hoặc điểm hợp lệ > 0)
    if (config.campaign_scores[campaignKey] !== undefined) {
        const pts = Number(config.campaign_scores[campaignKey]);
        return pts > 0 ? pts : 1;
    }

    // 4. Tìm không phân biệt hoa thường hoặc loại bỏ khoảng trắng
    const cleanKey = campaignKey.trim().toLowerCase();
    for (const [k, v] of Object.entries(config.campaign_scores)) {
        if (k.trim().toLowerCase() === cleanKey) {
            const pts = Number(v);
            return pts > 0 ? pts : 1;
        }
    }

    // 5. Tìm qua token chuẩn hóa với điểm bất kỳ > 0
    if (tok) {
        for (const [k, v] of Object.entries(config.campaign_scores)) {
            if (normalizeScoreToken(k) === tok) {
                const pts = Number(v);
                return pts > 0 ? pts : 1;
            }
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
 * Lưu cấu hình tính điểm thi đua cho 1 ST (hoặc nhiều ST phụ trách) theo Tháng/Năm
 * Đồng thời đồng bộ xuống LocalStorage (Monthly + Legacy) và đẩy lên Cloud Supabase (system_performance_configs)
 */
export async function saveStoreCampaignScoreConfig(
    config: StoreCampaignScoreConfig,
    options?: {
        month?: number;
        year?: number;
        applyToStoreNames?: string[];
        userName?: string;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();
        const updatedBy = options?.userName || config.updated_by || 'User';
        const targetMonth = config.month || options?.month || (new Date().getMonth() + 1);
        const targetYear = config.year || options?.year || (new Date().getFullYear());

        const monthlyConfigs = getAllMonthlyStoreCampaignScoreConfigs();
        const legacyConfigs = getAllStoreCampaignScoreConfigs();

        const targets = (options?.applyToStoreNames && options.applyToStoreNames.length > 0)
            ? Array.from(new Set([config.store_name, ...options.applyToStoreNames]))
            : [config.store_name];

        // 1. Cập nhật LocalStorage
        targets.forEach(sName => {
            const monthlyKey = buildMonthlyScoreKey(sName, targetMonth, targetYear);
            const entry: StoreCampaignScoreConfig = {
                ...config,
                store_name: sName,
                month: targetMonth,
                year: targetYear,
                updated_at: now,
                updated_by: updatedBy
            };
            monthlyConfigs[monthlyKey] = entry;

            // Đồng bộ fallback vào legacy cache
            legacyConfigs[sName] = {
                ...config,
                store_name: sName,
                updated_at: now,
                updated_by: updatedBy
            };
        });

        localStorage.setItem(LOCAL_STORAGE_MONTHLY_KEY, JSON.stringify(monthlyConfigs));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(legacyConfigs));

        // 2. Đồng bộ lên Cloud Supabase (bảng system_performance_configs)
        try {
            const upsertSystemRows = targets.map(sName => ({
                config_key: `${CLOUD_CONFIG_PREFIX}${getCleanStoreKey(sName)}_${targetMonth}_${targetYear}`,
                config_data: {
                    store_name: sName,
                    month: targetMonth,
                    year: targetYear,
                    scoring_mode: config.scoring_mode,
                    campaign_scores: config.campaign_scores,
                    updated_at: now,
                    updated_by: updatedBy
                },
                updated_at: now
            }));

            const { error: sysError } = await supabase
                .from('system_performance_configs')
                .upsert(upsertSystemRows, { onConflict: 'config_key' });

            if (sysError) {
                console.warn('Lưu Supabase system_performance_configs không thành công:', sysError.message);
            }
        } catch (cloudErr) {
            console.warn('Không thể kết nối Supabase system_performance_configs:', cloudErr);
        }

        // 3. Đồng bộ tương thích ngược vào bảng legacy store_campaign_scores (nếu có)
        try {
            const legacyRows = targets.map(sName => ({
                store_name: sName,
                scoring_mode: config.scoring_mode,
                campaign_scores: config.campaign_scores,
                updated_by: updatedBy,
                updated_at: now
            }));

            await supabase
                .from('store_campaign_scores')
                .upsert(legacyRows, { onConflict: 'store_name' });
        } catch { }

        return { success: true };
    } catch (e: any) {
        console.error('Lỗi saveStoreCampaignScoreConfig:', e);
        return { success: false, error: e?.message || 'Không thể lưu cấu hình' };
    }
}

/**
 * Kế thừa / Sao chép cấu hình điểm từ tháng này sang tháng khác
 * Tự động chuyển đổi tiền tố tháng (ví dụ: T10 - Laptop -> T11 - Laptop) nếu có danh mục thi đua tháng đích
 */
export async function copyStoreCampaignScoreConfig(params: {
    fromMonth: number;
    fromYear: number;
    toMonth: number;
    toYear: number;
    storeName: string;
    applyToStoreNames?: string[];
    userName?: string;
    campaigns?: Array<{ raw_key: string; display_name: string }>;
}): Promise<{ success: boolean; copiedCount: number; error?: string }> {
    const { fromMonth, fromYear, toMonth, toYear, storeName, applyToStoreNames, userName, campaigns } = params;

    try {
        const sourceConfig = getStoreCampaignScoreConfig(storeName, undefined, fromMonth, fromYear);
        if (!sourceConfig || !sourceConfig.campaign_scores || Object.keys(sourceConfig.campaign_scores).length === 0) {
            return {
                success: false,
                copiedCount: 0,
                error: `Không tìm thấy cấu hình điểm nào tại Tháng ${fromMonth}/${fromYear} để kế thừa!`
            };
        }

        const newScores: Record<string, number> = {};
        let count = 0;

        // Xây dựng map token cho các chương trình của tháng đích (nếu có danh sách campaigns)
        const destCampaigns = (campaigns || []).filter(c => {
            const p = extractCampaignMonthPrefix(c.raw_key);
            return p === null || p === toMonth;
        });

        Object.entries(sourceConfig.campaign_scores).forEach(([srcKey, points]) => {
            const srcToken = normalizeScoreToken(srcKey);

            // Tìm chương trình tương ứng của tháng đích
            const matchedDest = destCampaigns.find(d => normalizeScoreToken(d.raw_key) === srcToken);
            if (matchedDest) {
                newScores[matchedDest.raw_key] = points;
                count++;
            } else {
                // Giữ lại key chuẩn hóa
                newScores[srcKey] = points;
                count++;
            }
        });

        const newConfig: StoreCampaignScoreConfig = {
            store_name: storeName,
            month: toMonth,
            year: toYear,
            scoring_mode: sourceConfig.scoring_mode,
            campaign_scores: newScores,
            updated_by: userName || 'User'
        };

        const res = await saveStoreCampaignScoreConfig(newConfig, {
            month: toMonth,
            year: toYear,
            applyToStoreNames,
            userName
        });

        if (res.success) {
            return { success: true, copiedCount: count };
        } else {
            return { success: false, copiedCount: 0, error: res.error };
        }
    } catch (err: any) {
        return { success: false, copiedCount: 0, error: err?.message || 'Lỗi khi sao chép cấu hình' };
    }
}

/**
 * Tải dữ liệu cấu hình tính điểm từ Cloud Supabase
 * Tự động nạp cả cấu hình theo tháng (system_performance_configs) và legacy (store_campaign_scores)
 */
export async function syncStoreCampaignScoresFromCloud(
    month?: number,
    year?: number
): Promise<Record<string, StoreCampaignScoreConfig>> {
    const monthlyConfigs = getAllMonthlyStoreCampaignScoreConfigs();
    const legacyConfigs = getAllStoreCampaignScoreConfigs();

    // 1. Tải từ system_performance_configs
    try {
        let query = supabase
            .from('system_performance_configs')
            .select('*')
            .like('config_key', `${CLOUD_CONFIG_PREFIX}%`);

        const { data, error } = await query;

        if (!error && Array.isArray(data) && data.length > 0) {
            data.forEach((row: any) => {
                if (row && row.config_data && row.config_data.store_name) {
                    const cData = row.config_data;
                    const cMonth = Number(cData.month) || (new Date().getMonth() + 1);
                    const cYear = Number(cData.year) || (new Date().getFullYear());
                    const mKey = buildMonthlyScoreKey(cData.store_name, cMonth, cYear);

                    monthlyConfigs[mKey] = {
                        store_name: cData.store_name,
                        month: cMonth,
                        year: cYear,
                        scoring_mode: cData.scoring_mode === 'POINTS' ? 'POINTS' : 'COUNT',
                        campaign_scores: cData.campaign_scores || {},
                        updated_at: cData.updated_at || row.updated_at,
                        updated_by: cData.updated_by
                    };
                }
            });

            localStorage.setItem(LOCAL_STORAGE_MONTHLY_KEY, JSON.stringify(monthlyConfigs));
        }
    } catch { }

    // 2. Tải tương thích từ bảng legacy store_campaign_scores
    try {
        const { data: legacyData, error: legacyErr } = await supabase
            .from('store_campaign_scores')
            .select('*');

        if (!legacyErr && Array.isArray(legacyData) && legacyData.length > 0) {
            legacyData.forEach((row: any) => {
                if (row && row.store_name) {
                    legacyConfigs[row.store_name] = {
                        store_name: row.store_name,
                        scoring_mode: row.scoring_mode === 'POINTS' ? 'POINTS' : 'COUNT',
                        campaign_scores: row.campaign_scores || {},
                        updated_at: row.updated_at,
                        updated_by: row.updated_by
                    };
                }
            });
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(legacyConfigs));
        }
    } catch { }

    return monthlyConfigs;
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
        const [dictRes, scoreRes, sysConfigRes] = await Promise.all([
            supabase.from('campaign_dictionary').select('*', { count: 'exact', head: true }),
            supabase.from('store_campaign_scores').select('*', { count: 'exact', head: true }),
            supabase.from('system_performance_configs').select('*', { count: 'exact', head: true }).like('config_key', `${CLOUD_CONFIG_PREFIX}%`)
        ]);

        const campaignDictReady = !dictRes.error;
        const storeScoresReady = !scoreRes.error || !sysConfigRes.error;
        const isConnected = campaignDictReady && storeScoresReady;
        const totalScoreCount = (sysConfigRes.count || 0) + (scoreRes.count || 0);

        return {
            isConnected,
            campaignDictReady,
            campaignDictCount: dictRes.count || 0,
            storeScoresReady,
            storeScoresCount: totalScoreCount,
            error: dictRes.error?.message || (scoreRes.error?.message && sysConfigRes.error?.message ? sysConfigRes.error?.message : undefined),
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
