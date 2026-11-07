import type { CampaignDictItem, BusinessDayRecord } from '../../../core/lib/storage';
import type { EmployeeDataSession } from '../../employee-cumulative/utils/sessionStorage';
import { resolveCanonicalCampaign, normalizeCampaignToken } from '../../campaign-summary/utils/campaignSummaryStorage';
import { extractCampaignMonth } from './focusCampaignCalculations';

/**
 * Trích xuất danh sách các nhóm hàng thi đua có phát sinh chỉ tiêu hoặc số liệu trong kỳ (Tháng/Năm)
 * Giải quyết triệt để việc hiển thị thi đua rác, dư thừa của các tháng trước (Yêu cầu 5)
 */
export function extractPeriodActiveCampaigns(
    campaignDict: CampaignDictItem[],
    businessRecords: BusinessDayRecord[],
    targetsMap: Record<string, Record<string, number>>,
    sessions: EmployeeDataSession[],
    selectedCampaignKeys: string[],
    selectedMonth: number
): CampaignDictItem[] {
    if (!campaignDict || campaignDict.length === 0) return [];
    const activeRawKeys = new Set<string>();

    // 1. Từ emulationSummary của ST trong tháng
    businessRecords.forEach(br => {
        if (br.emulationSummary) {
            Object.entries(br.emulationSummary).forEach(([k, v]: [string, any]) => {
                if ((Number(v?.target) || 0) > 0 || (Number(v?.actual) || 0) > 0) {
                    activeRawKeys.add(k.trim());
                }
            });
        }
    });

    // 2. Từ chỉ tiêu nhân viên trong tháng
    Object.values(targetsMap).forEach(empTargetObj => {
        Object.entries(empTargetObj).forEach(([k, val]) => {
            if (Number(val) > 0) activeRawKeys.add(k.trim());
        });
    });

    // 3. Từ thực tế bán trong các phiên
    sessions.forEach(sess => {
        sess.records?.forEach(r => {
            if (r.campaigns) {
                Object.entries(r.campaigns).forEach(([k, v]) => {
                    if (Number(v) > 0) activeRawKeys.add(k.trim());
                });
            }
        });
    });

    // 4. Giữ lại các key đang được chọn
    selectedCampaignKeys.forEach(k => activeRawKeys.add(k.trim()));

    const matched = campaignDict.filter(d => {
        // Nếu d có tiền tố tháng và tiền tố đó khác với selectedMonth -> không đưa vào danh sách thi đua kỳ này (trừ khi đang được chọn)
        const dMonth = extractCampaignMonth(d.raw_key) ?? extractCampaignMonth(d.display_name);
        if (dMonth !== null && dMonth !== selectedMonth) {
            if (!selectedCampaignKeys.includes(d.raw_key)) {
                return false;
            }
        }

        if (selectedCampaignKeys.includes(d.raw_key)) return true;
        for (const rk of activeRawKeys) {
            const rMonth = extractCampaignMonth(rk);
            if (rMonth !== null && dMonth !== null && rMonth !== dMonth) {
                continue;
            }
            if (rk === d.raw_key) return true;
            if (normalizeCampaignToken(rk) === normalizeCampaignToken(d.raw_key)) {
                return true;
            }
        }
        return false;
    });

    // Fallback nếu tháng mới chưa có số liệu nạp vào: chỉ hiện các thi đua active không bị gắn tiền tố tháng cũ
    if (matched.length === 0) {
        return campaignDict.filter(d => {
            const r = d.raw_key.toUpperCase();
            const hasOldPrefix = /T\d{1,2}\s*[-_]/.test(r) && !r.includes(`T${selectedMonth}`) && !r.includes(`T0${selectedMonth}`);
            return !hasOldPrefix;
        });
    }

    return matched;
}

