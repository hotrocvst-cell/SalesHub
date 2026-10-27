import { getCampaignLabel, DEFAULT_CAMPAIGN_CONFIG } from '../../../core/lib/formatters';
import type { CampaignDictItem } from '../../../core/lib/storage';
import { normalizeCampaignToken, resolveCanonicalCampaign } from '../../campaign-summary/utils/campaignSummaryStorage';
import type { CampaignItem } from './dailyReportParsers';

export interface RemainingCampaignItem extends CampaignItem {
    monthTarget: number;
    cumulativeActual: number;
    remainingTarget: number;
    isMonthCompleted: boolean;
    requiredDailyAverage: number;
    appliedDailyTarget: number;
    appliedRuleReason: 'RULE_1_CAP_200' | 'RULE_2_REMAINING_LESS' | 'RULE_3_DAILY_AVERAGE' | 'NO_CUMULATIVE';
    appliedPctHT: number;
    appliedShortage: number;
}

/**
 * Trích xuất toàn bộ các định danh/token có thể có của một hạng mục thi đua
 * để đảm bảo đối chiếu 2 chiều 100% chuẩn xác giữa Realtime và Lũy Kế
 */
export function getCampaignTokens(key: string, campaignsDict: CampaignDictItem[] = []): string[] {
    if (!key) return [];
    const tokens = new Set<string>();

    const directToken = normalizeCampaignToken(key);
    if (directToken) tokens.add(directToken);

    const lbl = getCampaignLabel(key, campaignsDict);
    if (lbl) {
        const lblToken = normalizeCampaignToken(lbl);
        if (lblToken) tokens.add(lblToken);
    }

    // Tra cứu chéo 2 chiều qua DEFAULT_CAMPAIGN_CONFIG mẫu regex và từ điển
    if (Array.isArray(DEFAULT_CAMPAIGN_CONFIG)) {
        for (const cfg of DEFAULT_CAMPAIGN_CONFIG) {
            const isMatch = cfg.key.test(key) ||
                cfg.label.toUpperCase() === key.toUpperCase() ||
                normalizeCampaignToken(cfg.label) === directToken;

            if (isMatch) {
                tokens.add(normalizeCampaignToken(cfg.label));
                if (campaignsDict && campaignsDict.length > 0) {
                    campaignsDict.forEach(d => {
                        if (cfg.key.test(d.raw_key) || cfg.key.test(d.display_name)) {
                            tokens.add(normalizeCampaignToken(d.raw_key));
                            tokens.add(normalizeCampaignToken(d.display_name));
                        }
                    });
                }
            }
        }
    }

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

    return Array.from(tokens).filter(Boolean);
}
