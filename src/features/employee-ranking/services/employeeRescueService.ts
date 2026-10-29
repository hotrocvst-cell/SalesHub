import { supabase } from '../../../core/lib/supabase';
import type { EmployeeRankingRow } from '../types';

export type ExemptionReason = 'THAI_SAN' | 'NGHI_OM' | 'THU_VIEC' | 'DAC_CACH';

export interface SpecialExemptionItem {
    employee_id: string;
    full_name?: string;
    reason: ExemptionReason;
    note?: string;
    created_at?: string;
}

export interface EmployeeRescueConfig {
    store_name: string;
    month: number;
    year: number;
    rescue_by_revenue_enabled: boolean;
    revenue_min_rate: number;         // Mặc định: 100% (%DKHT hoặc %HT Doanh thu)
    rescue_by_emulation_enabled: boolean;
    emulation_min_points: number;     // Mặc định: 10 điểm (nếu dùng chế độ điểm)
    emulation_min_campaigns: number;  // Mặc định: 3 ngành hàng (nếu dùng chế độ số nhóm)
    special_exemptions: SpecialExemptionItem[]; // Danh sách nhân sự thai sản, chế độ đặc thù
    updated_at?: string;
    updated_by?: string;
}

export interface EmployeeRescueEvaluation {
    rescue_status: 'SAFE' | 'RESCUED' | 'BOT_WARNING';
    rescue_reason: 'NONE' | 'REVENUE_ACHIEVED' | 'EMULATION_ACHIEVED' | 'THAI_SAN' | 'NGHI_OM' | 'THU_VIEC' | 'DAC_CACH';
    rescue_label: string;
    rescue_detail: string;
    badge_variant: 'safe' | 'rescued_rev' | 'rescued_emu' | 'thai_san' | 'warning';
}

const STORAGE_KEY_PREFIX = 'saleshub_emp_rescue_cfg';

function getCleanStoreKey(storeName: string): string {
    if (!storeName || storeName === 'all') return 'ALL';
    return storeName.trim().replace(/\s+/g, '_');
}

/**
 * Cấu hình tiêu chí cứu mặc định chuẩn hệ thống
 */
export function getDefaultRescueConfig(storeName: string, month: number, year: number): EmployeeRescueConfig {
    return {
        store_name: storeName || 'all',
        month,
        year,
        rescue_by_revenue_enabled: true,
        revenue_min_rate: 100,
        rescue_by_emulation_enabled: true,
        emulation_min_points: 10,
        emulation_min_campaigns: 3,
        special_exemptions: []
    };
}

/**
 * Tải cấu hình tiêu chí cứu từ Supabase Cloud (system_performance_configs) & LocalStorage cache
 */
export async function fetchEmployeeRescueConfig(
    storeName: string,
    month: number,
    year: number
): Promise<EmployeeRescueConfig> {
    const cleanKey = getCleanStoreKey(storeName);
    const configKey = `emp_rescue_cfg_${cleanKey}_${month}_${year}`;
    const defaultCfg = getDefaultRescueConfig(storeName, month, year);

    // 1. Tải từ Cloud Supabase
    try {
        const { data, error } = await supabase
            .from('system_performance_configs')
            .select('config_data')
            .eq('config_key', configKey)
            .maybeSingle();

        if (!error && data?.config_data) {
            const parsed = {
                ...defaultCfg,
                ...data.config_data
            } as EmployeeRescueConfig;

            try {
                localStorage.setItem(`${STORAGE_KEY_PREFIX}_${cleanKey}_${month}_${year}`, JSON.stringify(parsed));
            } catch { }

            return parsed;
        }
    } catch (e) {
        console.warn('Lỗi khi tải cấu hình tiêu chí cứu từ Supabase:', e);
    }

    // 2. Fallback đọc LocalStorage cache
    try {
        const cached = localStorage.getItem(`${STORAGE_KEY_PREFIX}_${cleanKey}_${month}_${year}`);
        if (cached) {
            return {
                ...defaultCfg,
                ...JSON.parse(cached)
            };
        }
    } catch { }

    return defaultCfg;
}

/**
 * Lưu cấu hình tiêu chí cứu lên Supabase Cloud & LocalStorage
 */
export async function saveEmployeeRescueConfig(
    config: EmployeeRescueConfig
): Promise<{ success: boolean; fromSupabase: boolean; error?: string }> {
    const cleanKey = getCleanStoreKey(config.store_name);
    const configKey = `emp_rescue_cfg_${cleanKey}_${config.month}_${config.year}`;
    const nowIso = new Date().toISOString();

    const payload: EmployeeRescueConfig = {
        ...config,
        updated_at: nowIso
    };

    // 1. Lưu LocalStorage tức thì
    try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}_${cleanKey}_${config.month}_${config.year}`, JSON.stringify(payload));
    } catch { }

    // 2. Đồng bộ lên Cloud Supabase qua system_performance_configs
    let isCloudSaved = false;
    let cloudError: string | undefined;

    try {
        const { error } = await supabase
            .from('system_performance_configs')
            .upsert({
                config_key: configKey,
                config_data: payload,
                updated_at: nowIso,
                updated_by: config.updated_by || 'Quản lý'
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

/**
 * Đánh giá trạng thái sức khỏe & xét cứu cho từng nhân viên
 */
export function evaluateEmployeeRescue(
    row: Pick<EmployeeRankingRow, 'employee_id' | 'revenue_top_bot_status' | 'emulation_top_bot_status' | 'forecast_completion_rate' | 'points_achieved' | 'campaigns_achieved' | 'scoring_mode' | 'emulation_display'>,
    config: EmployeeRescueConfig
): EmployeeRescueEvaluation {
    const isBotRev = row.revenue_top_bot_status === 'BOT';
    const isBotEmu = row.emulation_top_bot_status === 'BOT';
    const empId = (row.employee_id || '').trim();

    // 1. Kiểm tra miễn trừ đặc thù (thai sản, ốm đau, thử việc, đặc cách)
    const exemption = (config.special_exemptions || []).find(ex => ex.employee_id.trim() === empId);
    if (exemption) {
        let label = 'Đặc cách';
        let detail = exemption.note ? `Miễn trừ: ${exemption.note}` : 'Được miễn trừ đặc cách quản lý';
        let badgeVariant: EmployeeRescueEvaluation['badge_variant'] = 'thai_san';

        if (exemption.reason === 'THAI_SAN') {
            label = 'Thai sản';
            detail = 'Nhân sự nghỉ thai sản / chế độ con nhỏ';
        } else if (exemption.reason === 'NGHI_OM') {
            label = 'Nghỉ ốm/phép';
            detail = 'Nghỉ ốm đau hoặc nghỉ phép dài hạn';
        } else if (exemption.reason === 'THU_VIEC') {
            label = 'Thử việc';
            detail = 'Nhân viên mới học việc / thử việc';
        }

        return {
            rescue_status: 'RESCUED',
            rescue_reason: exemption.reason,
            rescue_label: label,
            rescue_detail: detail,
            badge_variant: badgeVariant
        };
    }

    // 2. Nếu nhân sự KHÔNG bị BOT cả Doanh thu lẫn Thi đua -> Hoàn toàn AN TOÀN
    if (!isBotRev && !isBotEmu) {
        const isAllTop = row.revenue_top_bot_status === 'TOP' && row.emulation_top_bot_status === 'TOP';
        return {
            rescue_status: 'SAFE',
            rescue_reason: 'NONE',
            rescue_label: isAllTop ? 'Top vững' : 'An toàn',
            rescue_detail: isAllTop ? 'Xuất sắc cả Doanh thu và Thi đua' : 'Đạt tiến độ ổn định (không thuộc nhóm BOT)',
            badge_variant: 'safe'
        };
    }

    // 3. XÉT CỨU TRƯỜNG HỢP 1: Bị BOT Thi đua -> Nhưng Doanh thu đạt >= ngưỡng cứu (ví dụ >= 100%)
    if (isBotEmu && !isBotRev) {
        if (config.rescue_by_revenue_enabled && row.forecast_completion_rate >= config.revenue_min_rate) {
            return {
                rescue_status: 'RESCUED',
                rescue_reason: 'REVENUE_ACHIEVED',
                rescue_label: `Cứu: DT ≥${config.revenue_min_rate}%`,
                rescue_detail: `BOT thi đua nhưng được cứu do %DKHT Doanh thu đạt ${row.forecast_completion_rate.toFixed(1)}% (≥ ${config.revenue_min_rate}%)`,
                badge_variant: 'rescued_rev'
            };
        }
    }

    // 4. XÉT CỨU TRƯỜNG HỢP 2: Bị BOT Doanh thu -> Nhưng Thi đua đạt >= ngưỡng cứu (ví dụ >= 10 điểm hoặc >= 3 NH)
    if (isBotRev && !isBotEmu) {
        if (config.rescue_by_emulation_enabled) {
            const isPointsMode = row.scoring_mode === 'POINTS';
            const isEmuAchieved = isPointsMode
                ? row.points_achieved >= config.emulation_min_points
                : row.campaigns_achieved >= config.emulation_min_campaigns;

            if (isEmuAchieved) {
                const targetDisplay = isPointsMode
                    ? `≥${config.emulation_min_points}đ`
                    : `≥${config.emulation_min_campaigns} NH`;

                return {
                    rescue_status: 'RESCUED',
                    rescue_reason: 'EMULATION_ACHIEVED',
                    rescue_label: `Cứu: TĐ ${targetDisplay}`,
                    rescue_detail: `BOT doanh thu nhưng được cứu do thi đua đạt ${row.emulation_display} (${targetDisplay})`,
                    badge_variant: 'rescued_emu'
                };
            }
        }
    }

    // 5. XÉT CỨU TRƯỜNG HỢP 3: Bị BOT CẢ HAI nhưng thỏa mãn ít nhất 1 tiêu chí cứu
    if (isBotRev && isBotEmu) {
        if (config.rescue_by_revenue_enabled && row.forecast_completion_rate >= config.revenue_min_rate) {
            return {
                rescue_status: 'RESCUED',
                rescue_reason: 'REVENUE_ACHIEVED',
                rescue_label: `Cứu: DT ≥${config.revenue_min_rate}%`,
                rescue_detail: `BOT kép nhưng được cứu nhờ Doanh thu %DKHT đạt ${row.forecast_completion_rate.toFixed(1)}%`,
                badge_variant: 'rescued_rev'
            };
        }
        if (config.rescue_by_emulation_enabled) {
            const isPointsMode = row.scoring_mode === 'POINTS';
            const isEmuAchieved = isPointsMode
                ? row.points_achieved >= config.emulation_min_points
                : row.campaigns_achieved >= config.emulation_min_campaigns;

            if (isEmuAchieved) {
                return {
                    rescue_status: 'RESCUED',
                    rescue_reason: 'EMULATION_ACHIEVED',
                    rescue_label: `Cứu: TĐ ${isPointsMode ? '≥' + config.emulation_min_points + 'đ' : '≥' + config.emulation_min_campaigns + ' NH'}`,
                    rescue_detail: `BOT kép nhưng được cứu nhờ Thi đua đạt ${row.emulation_display}`,
                    badge_variant: 'rescued_emu'
                };
            }
        }
    }

    // 6. KHÔNG THỎA MÃN TIÊU CHÍ NÀO -> BÁO ĐỘNG BOT
    return {
        rescue_status: 'BOT_WARNING',
        rescue_reason: 'NONE',
        rescue_label: isBotRev && isBotEmu ? '🚨 BOT kép' : isBotRev ? '🚨 BOT DT' : '🚨 BOT Thi đua',
        rescue_detail: 'Thuộc diện BOT và chưa thỏa mãn điều kiện cứu nào, cần hỗ trợ đôn đốc',
        badge_variant: 'warning'
    };
}

