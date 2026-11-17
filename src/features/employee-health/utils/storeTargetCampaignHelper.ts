import { supabase } from '../../../core/lib/supabase';
import type { CampaignDictItem, EmployeeItem, StoreItem } from '../../../core/lib/storage';
import { isStoreMatch } from '../../../core/lib/formatters';
import { normalizeCampaignToken } from '../../campaign-summary/utils/campaignSummaryStorage';
import { getStoreCampaignScoreConfig } from '../../../core/lib/storeCampaignScoreService';

/**
 * Tự động phát hiện danh sách các chương trình thi đua mà một ST cụ thể có chỉ tiêu trong tháng
 * Quét từ 3 nguồn:
 * 1. daily_business_records (emulation_summary có target > 0)
 * 2. employee_campaign_targets (đã có chỉ tiêu nhân viên thuộc ST > 0)
 * 3. store_campaign_scores (cấu hình điểm riêng của ST đó)
 */
export async function detectStoreTargetCampaignKeys(params: {
    storeName: string;
    month: number;
    year: number;
    campaigns: CampaignDictItem[];
    campaignTargets: Record<string, Record<string, number>>;
    scopeEmployees: EmployeeItem[];
    storesList?: StoreItem[];
}): Promise<Set<string>> {
    const { storeName, month, year, campaigns, campaignTargets, scopeEmployees, storesList } = params;
    const storeTargetKeys = new Set<string>();

    if (!storeName || storeName === 'all') {
        campaigns.forEach(c => storeTargetKeys.add(c.raw_key));
        return storeTargetKeys;
    }

    // 1. Quét từ employee_campaign_targets đã có của các nhân viên thuộc ST này trong tháng
    scopeEmployees.forEach(emp => {
        const empTargets = campaignTargets[emp.employee_id] || {};
        Object.entries(empTargets).forEach(([k, val]) => {
            if (Number(val) > 0) {
                storeTargetKeys.add(k.trim());
            }
        });
    });

    // 2. Quét từ StoreCampaignScoreConfig (nếu ST đã cấu hình điểm cho các mục)
    try {
        const scoreCfg = getStoreCampaignScoreConfig(storeName, storesList, month, year);
        if (scoreCfg && scoreCfg.campaign_scores) {
            Object.entries(scoreCfg.campaign_scores).forEach(([k, pts]) => {
                if (Number(pts) > 0) {
                    storeTargetKeys.add(k.trim());
                }
            });
        }
    } catch { }

    // 3. Quét từ daily_business_records của ST trong tháng/năm này
    try {
        const { data: recs } = await supabase
            .from('daily_business_records')
            .select('store_name, emulation_summary')
            .eq('month', month)
            .eq('year', year);

        if (Array.isArray(recs) && recs.length > 0) {
            const matchedRec = recs.find(r => isStoreMatch(r.store_name, storeName, storesList));
            if (matchedRec && matchedRec.emulation_summary && typeof matchedRec.emulation_summary === 'object') {
                Object.entries(matchedRec.emulation_summary).forEach(([k, val]: [string, any]) => {
                    if (k.startsWith('__')) return;
                    if (val && typeof val === 'object') {
                        const target = Number(val.target) || 0;
                        const actual = Number(val.actual) || 0;
                        if (target > 0 || actual > 0) {
                            storeTargetKeys.add(k.trim());
                        }
                    }
                });
            }
        }
    } catch (e) {
        console.warn('Lỗi quét emulation_summary từ daily_business_records:', e);
    }

    // 4. Ánh xạ các key tìm được sang danh sách campaigns hiện có qua normalized token
    const matchedRawKeys = new Set<string>();
    const tokenSet = new Set<string>();

    storeTargetKeys.forEach(k => {
        const tok = normalizeCampaignToken(k);
        if (tok) tokenSet.add(tok);
    });

    campaigns.forEach(c => {
        if (storeTargetKeys.has(c.raw_key) || storeTargetKeys.has(c.display_name)) {
            matchedRawKeys.add(c.raw_key);
            return;
        }
        const cTok = normalizeCampaignToken(c.raw_key) || normalizeCampaignToken(c.display_name);
        if (cTok && tokenSet.has(cTok)) {
            matchedRawKeys.add(c.raw_key);
        }
    });

    return matchedRawKeys;
}
