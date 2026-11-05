import { supabase } from '../../../core/lib/supabase';
import { cleanBiNumber, isStoreMatch } from '../../../core/lib/formatters';
import type { StoreItem } from '../../../core/lib/storage';

export interface KnownStoreCampaignTarget {
    campaignName: string;
    target: number;
    actual?: number;
    unit?: string;
    rawHeader?: string;
}

export interface CampaignMappingItem {
    rawName: string;
    resolvedName: string;
    unit: string;
    storeActual: number;
    storeTarget: number;
    isAutoMatched: boolean;
    mappedReason?: string;
}

/**
 * Tải danh mục chỉ tiêu thi đua đã có của ST từ bảng daily_business_records
 * Phục vụ cơ chế tự động mapping tên thi đua bị cắt ngắn (...) qua Target ST.
 */
export async function fetchStoreKnownCampaignTargets(
    storeName: string,
    reportDate: string,
    storesList: StoreItem[] = []
): Promise<KnownStoreCampaignTarget[]> {
    if (!storeName) return [];

    try {
        const cleanStore = storeName.trim();
        const dateStr = reportDate.trim();
        const monthPrefix = dateStr ? dateStr.substring(0, 7) : new Date().toISOString().substring(0, 7);

        // 1. Thử tìm chính xác theo store_name và report_date
        const { data: exactMatch } = await supabase
            .from('daily_business_records')
            .select('store_name, report_date, emulation_summary')
            .eq('report_date', dateStr);

        let targetRecord = exactMatch?.find(r => isStoreMatch(r.store_name, cleanStore, storesList));

        // 2. Nếu ngày chốt chưa có, tìm bản ghi gần nhất trong cùng tháng của ST này
        if (!targetRecord || !targetRecord.emulation_summary) {
            const { data: monthRecords } = await supabase
                .from('daily_business_records')
                .select('store_name, report_date, emulation_summary')
                .like('report_date', `${monthPrefix}%`)
                .order('report_date', { ascending: false });

            targetRecord = monthRecords?.find(r => isStoreMatch(r.store_name, cleanStore, storesList));
        }

        const emuSummary = targetRecord?.emulation_summary;
        if (emuSummary && typeof emuSummary === 'object') {
            const list: KnownStoreCampaignTarget[] = [];
            Object.entries(emuSummary).forEach(([cName, item]: [string, any]) => {
                if (cName.startsWith('__')) return; // Bỏ qua __real_revenue
                if (item && typeof item === 'object') {
                    list.push({
                        campaignName: cName.trim(),
                        target: cleanBiNumber(item.target),
                        actual: cleanBiNumber(item.actual),
                        unit: item.unit || 'DT'
                    });
                }
            });
            return list;
        }
    } catch (err) {
        console.warn('Lỗi khi tải known campaign targets:', err);
    }

    return [];
}

/**
 * Tự động ánh xạ tên chương trình thi đua (đặc biệt khi bị cắt ngắn "...")
 * dựa vào Target ST và tiền tố tên chương trình.
 */
export function resolveCampaignNameByTarget(
    rawName: string,
    storeTarget: number,
    storeActual: number | undefined,
    knownCampaigns: KnownStoreCampaignTarget[],
    campaignDictionary: Array<{ raw_key: string; display_name: string; unit?: string }> = []
): { resolvedName: string; isAutoMatched: boolean; reason?: string; unit?: string } {
    const cleanRaw = rawName.trim();
    if (!cleanRaw) return { resolvedName: 'Chương trình khác', isAutoMatched: false };

    const isTruncated = cleanRaw.endsWith('...') || cleanRaw.endsWith('…') || cleanRaw.length <= 15;
    const cleanPrefix = cleanRaw
        .replace(/\.\.\.$/g, '')
        .replace(/…$/g, '')
        .trim()
        .toLowerCase();

    // 1. Nếu tên đầy đủ và trùng khớp 100% với một mục đã biết
    const exactMatch = knownCampaigns.find(k => k.campaignName.toLowerCase() === cleanRaw.toLowerCase());
    if (exactMatch && !isTruncated) {
        return { resolvedName: exactMatch.campaignName, isAutoMatched: false, unit: exactMatch.unit };
    }

    // 2. Nếu tên bị cắt ngắn hoặc cần đối chiếu qua Target ST:
    if (storeTarget > 0 && knownCampaigns.length > 0) {
        // Ưu tiên 1: Khớp tiền tố VÀ khớp Target (dung sai <= 0.05 hoặc tỉ lệ < 0.5%)
        const matchedByPrefixAndTarget = knownCampaigns.find(k => {
            const kNameLower = k.campaignName.toLowerCase();
            const prefixMatches = kNameLower.startsWith(cleanPrefix) || kNameLower.includes(cleanPrefix);
            const targetDiff = Math.abs(k.target - storeTarget);
            const targetMatches = targetDiff <= 0.05 || (k.target > 0 && targetDiff / k.target < 0.005);
            return prefixMatches && targetMatches;
        });

        if (matchedByPrefixAndTarget) {
            return {
                resolvedName: matchedByPrefixAndTarget.campaignName,
                isAutoMatched: true,
                reason: `Khớp Target ST: ${storeTarget} (Chương trình gốc: ${matchedByPrefixAndTarget.campaignName})`,
                unit: matchedByPrefixAndTarget.unit
            };
        }

        // Ưu tiên 2: Khớp Target chính xác duy nhất trong ST
        const matchedByExactTargetOnly = knownCampaigns.filter(k => Math.abs(k.target - storeTarget) <= 0.05);
        if (matchedByExactTargetOnly.length === 1) {
            return {
                resolvedName: matchedByExactTargetOnly[0].campaignName,
                isAutoMatched: true,
                reason: `Khớp duy nhất Target ST: ${storeTarget}`,
                unit: matchedByExactTargetOnly[0].unit
            };
        }
    }

    // 3. Nếu chưa khớp trong knownCampaigns của ST, tra cứu trong campaignDictionary
    if (isTruncated && campaignDictionary.length > 0) {
        const dictCandidate = campaignDictionary.find(d => {
            const rawKeyLower = (d.raw_key || '').toLowerCase();
            const dispLower = (d.display_name || '').toLowerCase();
            return rawKeyLower.startsWith(cleanPrefix) || dispLower.startsWith(cleanPrefix);
        });

        if (dictCandidate) {
            return {
                resolvedName: dictCandidate.raw_key || dictCandidate.display_name,
                isAutoMatched: true,
                reason: `Khớp tiền tố trong danh mục hệ thống: ${dictCandidate.display_name}`,
                unit: dictCandidate.unit
            };
        }
    }

    // Fallback: Loại bỏ dấu ba chấm nếu có
    const cleanedName = cleanRaw.replace(/\.\.\.$/g, '').replace(/…$/g, '').trim();
    return {
        resolvedName: cleanedName,
        isAutoMatched: false
    };
}

/**
 * Kiểm tra xem một chương trình thi đua có phải tính theo số lượng (SL) hay không
 * dựa trên nhãn đơn vị, tên chương trình, danh mục target ST hoặc danh mục hệ thống.
 */
export function isQuantityCampaign(
    unit?: string,
    campaignName?: string,
    knownTargets?: KnownStoreCampaignTarget[],
    campaignDictionary?: Array<{ raw_key?: string; display_name?: string; unit?: string }>
): boolean {
    // 1. Kiểm tra trực tiếp qua unit
    if (unit) {
        const u = unit.trim().toUpperCase();
        if (u === 'SL' || u === 'SLQĐ' || u === 'SLQD' || u.includes('SL') || u.includes('SỐ LƯỢNG') || u.includes('SO LUONG')) {
            return true;
        }
    }

    // 2. Kiểm tra nhãn/hậu tố trong tên chương trình: ví dụ "[SL]", "(SL)", "[SLQĐ]", "Số lượng"
    if (campaignName) {
        const cleanName = campaignName.trim();
        if (/[\(\[\{](SL|SLQĐ|SLQD|SỐ LƯỢNG|SO LUONG)[\)\]\}]/i.test(cleanName)) {
            return true;
        }
        if (/\b(SL|SLQĐ|SLQD)\b/i.test(cleanName) && !/\b(DT|DTQĐ|DTQD)\b/i.test(cleanName)) {
            return true;
        }
    }

    // 3. Tra cứu trong knownTargets của ST
    if (campaignName && knownTargets && knownTargets.length > 0) {
        const cLower = campaignName.trim().toLowerCase();
        const found = knownTargets.find(k => k.campaignName.toLowerCase() === cLower);
        if (found && found.unit) {
            const fu = found.unit.trim().toUpperCase();
            if (fu === 'SL' || fu === 'SLQĐ' || fu === 'SLQD' || fu.includes('SL') || fu.includes('SỐ LƯỢNG') || fu.includes('SO LUONG')) {
                return true;
            }
        }
    }

    // 4. Tra cứu trong danh mục hệ thống campaignDictionary
    if (campaignName && campaignDictionary && campaignDictionary.length > 0) {
        const cLower = campaignName.trim().toLowerCase();
        const found = campaignDictionary.find(d => 
            (d.raw_key && d.raw_key.trim().toLowerCase() === cLower) || 
            (d.display_name && d.display_name.trim().toLowerCase() === cLower)
        );
        if (found && found.unit) {
            const du = found.unit.trim().toUpperCase();
            if (du === 'SL' || du === 'SLQĐ' || du === 'SLQD' || du.includes('SL') || du.includes('SỐ LƯỢNG') || du.includes('SO LUONG')) {
                return true;
            }
        }
    }

    return false;
}

