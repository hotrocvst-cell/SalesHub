import { getCampaignLabel, DEFAULT_CAMPAIGN_CONFIG } from '../../../core/lib/formatters';
import type { CampaignDictItem } from '../../../core/lib/storage';
import { normalizeCampaignToken, resolveCanonicalCampaign } from '../../campaign-summary/utils/campaignSummaryStorage';
import type { CampaignItem } from './dailyReportParsers';

export type RemainingSortMode = 'CUMULATIVE' | 'REALTIME';

export interface RemainingCampaignItem extends CampaignItem {
    monthTarget: number;
    cumulativeActual: number;
    monthPctHT: number;
    remainingTarget: number;
    isMonthCompleted: boolean;
    requiredDailyAverage: number;
    appliedDailyTarget: number;
    appliedRuleReason: 'RULE_1_CAP_200' | 'RULE_2_REMAINING_LESS' | 'RULE_3_DAILY_AVERAGE' | 'NO_CUMULATIVE';
    appliedPctHT: number;
    appliedShortage: number;
}

/**
 * Trích xuất toàn bộ các định danh/token của một hạng mục thi đua
 * để đảm bảo đối chiếu 2 chiều 100% chuẩn xác giữa Realtime và Lũy Kế.
 * Đảm bảo tính cô lập, không trộn lẫn giữa các chương trình có tên tương tự nhau
 * (ví dụ: BẢO_HIỂM_ĐMX vs BẢO_HIỂM, ICT_ANDROID vs TABLET_ANDROID).
 */
export function getCampaignTokens(key: string, campaignsDict: CampaignDictItem[] = []): string[] {
    if (!key) return [];
    const tokens = new Set<string>();

    const directToken = normalizeCampaignToken(key);
    if (directToken) tokens.add(directToken);

    // 1. Ánh xạ qua resolveCanonicalCampaign
    const resolved = resolveCanonicalCampaign(key, campaignsDict);
    if (resolved.canonicalKey) {
        const cToken = normalizeCampaignToken(resolved.canonicalKey);
        if (cToken) tokens.add(cToken);
    }
    if (resolved.dictItem) {
        if (resolved.dictItem.raw_key) {
            tokens.add(normalizeCampaignToken(resolved.dictItem.raw_key));
        }
        if (resolved.dictItem.display_name) {
            tokens.add(normalizeCampaignToken(resolved.dictItem.display_name));
        }
    }

    // 2. Ánh xạ qua getCampaignLabel
    const lbl = getCampaignLabel(key, campaignsDict);
    if (lbl && lbl !== key) {
        const lblToken = normalizeCampaignToken(lbl);
        if (lblToken) tokens.add(lblToken);
    }

    // 3. Tra cứu qua DEFAULT_CAMPAIGN_CONFIG: chỉ lấy mục ĐẦU TIÊN khớp (first match) và DỪNG NGAY
    if (Array.isArray(DEFAULT_CAMPAIGN_CONFIG)) {
        for (const cfg of DEFAULT_CAMPAIGN_CONFIG) {
            const isMatch = cfg.key.test(key) ||
                cfg.label.toUpperCase() === key.toUpperCase() ||
                normalizeCampaignToken(cfg.label) === directToken;

            if (isMatch) {
                tokens.add(normalizeCampaignToken(cfg.label));
                break; // <-- DỪNG LẠI NGAY LẬP TỨC để tránh nhận nhầm sang các mục có tên ngắn hơn
            }
        }
    }

    return Array.from(tokens).filter(Boolean);
}
