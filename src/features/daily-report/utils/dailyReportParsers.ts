import { getCampaignLabel, getShortStoreName } from '../../../core/lib/formatters';
import type { CampaignDictItem } from '../../../core/lib/storage';

export interface CampaignItem {
    label: string;
    rawHeader?: string;
    store: string;
    shortName: string;
    target: number;
    actual: number;
    pctHT: number;
    pctDK: number;
}

export interface RevenueItem {
    store: string;
    shortName: string;
    sl: number;
    rev: number;
    rawRev: number;
    target: number;
    pct: number;
    pctTraGop: number;
    dtTraGop: number;
    isNewFormat: boolean;
}

export const DAILY_REPORT_STORAGE_KEYS = {
    EMULATION: 'saleshub_daily_report_emulation_text',
    REVENUE: 'saleshub_daily_report_revenue_text',
    REAL_REVENUE: 'saleshub_daily_report_real_revenue_text',
    SELECTED_STORE: 'saleshub_daily_report_selected_store'
};

// =========================================================
// 1. BỘ PHÂN TÍCH DỮ LIỆU THI ĐUA REALTIME
// =========================================================
export const parseEmulationData = (raw: string, campaignsDict: CampaignDictItem[] = []): CampaignItem[] => {
    if (!raw.trim()) return [];
    const lines = raw.split('\n');
    const result: CampaignItem[] = [];
    let curHeader = '';

    lines.forEach(l => {
        const trimmedLine = l.trim();
        if (!trimmedLine) return;

        const p = trimmedLine.split(/\t|\s{2,}/).map(x => x.trim()).filter(Boolean);
        const lowerLine = trimmedLine.toLowerCase();
        const firstCol = p[0] || '';
        const firstColUpper = firstCol.toUpperCase();

        const isHeader = (
            (lowerLine.includes('target') ||
                lowerLine.includes('(rt)') ||
                lowerLine.includes('realtime') ||
                lowerLine.includes('lũy kế') ||
                lowerLine.includes('% ht') ||
                lowerLine.includes('doanh thu') ||
                lowerLine.includes('số lượng') ||
                lowerLine.includes('hạng vùng')) &&
            !firstColUpper.startsWith('TỔNG') &&
            !firstColUpper.startsWith('TONG') &&
            !/^(aar|tgd|đmx|dmx|\d+)/i.test(firstCol)
        );

        if (isHeader) {
            curHeader = firstCol.trim();
            return;
        }

        const isDataRow = (
            firstColUpper.startsWith('TỔNG') ||
            firstColUpper.startsWith('TONG') ||
            /^(aar_|tgd_|đmx_|dmx_)/i.test(firstCol) ||
            /^\d+\s*-\s*(aar|tgd|đmx|dmx)/i.test(firstCol) ||
            firstColUpper.includes('TGD_') ||
            firstColUpper.includes('AAR_') ||
            firstColUpper.includes('ĐMX_') ||
            firstColUpper.includes('DMX_')
        );

        if (isDataRow && curHeader && p.length >= 3) {
            // Ánh xạ tên viết tắt qua từ điển
            const label = getCampaignLabel(curHeader, campaignsDict);
            const isTongRow = firstColUpper.startsWith('TỔNG') || firstColUpper.startsWith('TONG');
            const storeName = isTongRow ? 'Tổng' : firstCol;
            const shortName = isTongRow ? 'Tổng' : getShortStoreName(storeName);

            const actual = parseFloat(String(p[1] || '0').replace(/,/g, '')) || 0;
            const target = parseFloat(String(p[2] || '0').replace(/,/g, '')) || 0;

            // ĐIỀU KIỆN TIÊN QUYẾT: CHỈ LẤY THI ĐUA CÓ TARGET > 0
            if (target > 0) {
                const pctColRaw = String(p[3] || '').trim();
                const pctColVal = parseFloat(pctColRaw.replace(/%/g, '').replace(/,/g, ''));
                const pctHT = (!isNaN(pctColVal) && pctColRaw.includes('%'))
                    ? pctColVal
                    : (actual / target * 100);

                result.push({
                    label,
                    rawHeader: curHeader,
                    store: storeName,
                    shortName,
                    target,
                    actual,
                    pctHT,
                    pctDK: pctHT
                });
            }
        }
    });

    return result;
};

// =========================================================
// 2. BỘ PHÂN TÍCH DỮ LIỆU DOANH THU REALTIME (QD + THỰC)
// =========================================================
export const parseRevenueData = (raw: string, rawReal?: string): {
    revMap: Record<string, RevenueItem>;
    revList: RevenueItem[];
} => {
    const revMap: Record<string, RevenueItem> = {};
    const revList: RevenueItem[] = [];
    if (!raw.trim() && !(rawReal && rawReal.trim())) return { revMap, revList };

    let qdText = raw;
    let realText = rawReal || '';

    const SPLIT_TOKEN = '=== BẢNG DOANH THU THỰC ===';
    if (!realText && qdText.includes(SPLIT_TOKEN)) {
        const parts = qdText.split(SPLIT_TOKEN);
        qdText = parts[0];
        realText = parts[1] || '';
    }

    // 1. Phân tích bảng Doanh thu thực (nếu có) để lấy DT Thực và DT Trả góp chuẩn
    const realMap: Record<string, { revReal: number; dtTraGop: number; pctTraGop: number }> = {};
    if (realText.trim()) {
        const realLines = realText.split('\n');
        let pendingRealStore: string | null = null;

        const recordReal = (storeName: string, parts: string[]) => {
            const isTong = /^(tổng|tong)/i.test(storeName);
            const sName = isTong ? 'Tổng' : getShortStoreName(storeName);
            const revReal = parseFloat(String(parts[1] || '0').replace(/,/g, '')) || 0;
            // parts[8] ở bảng DT thực là DT Trả Góp thực tế
            const dtTraGop = parts.length > 8 ? parseFloat(String(parts[8] || '0').replace(/,/g, '')) || 0 : 0;
            const pctTraGop = revReal > 0 ? Number(((dtTraGop / revReal) * 100).toFixed(1)) : 0;
            realMap[sName] = { revReal, dtTraGop, pctTraGop };
        };

        for (let i = 0; i < realLines.length; i++) {
            const trimmed = realLines[i].trim();
            if (!trimmed || trimmed.startsWith('Đơn vị') || trimmed.startsWith('Tỉ trọng tính')) continue;

            const parts = trimmed.split(/\t|\s{2,}/).map(x => x.trim()).filter(Boolean);
            const firstCol = parts[0] || '';
            const isStoreNameCol = /^(tổng|\d+\s*-|aar_|tgd_|đmx_|dmx_)/i.test(firstCol);

            if (isStoreNameCol && parts.length >= 6) {
                recordReal(firstCol, parts.slice(1));
                pendingRealStore = null;
                continue;
            }
            if (/^(tổng|\d+\s*-\s*(aar|tgd|đmx|dmx)|aar_|tgd_|đmx_|dmx_)/i.test(trimmed) && parts.length <= 2) {
                pendingRealStore = trimmed;
                continue;
            }
            if (pendingRealStore && parts.length >= 6) {
                recordReal(pendingRealStore, parts);
                pendingRealStore = null;
                continue;
            }
        }
    }

    // 2. Phân tích bảng Doanh thu quy đổi (hoặc bảng đơn)
    const lines = qdText.split('\n');
    let pendingStore: string | null = null;

    const recordRevenue = (storeName: string, parts: string[]) => {
        const isTong = /^(tổng|tong)/i.test(storeName);
        const sName = isTong ? 'Tổng' : getShortStoreName(storeName);

        const isNewFormat = parts.length >= 8 && (
            String(parts[4] || '').includes('%') ||
            String(parts[2] || '').includes('%')
        );

        let sl = 0;
        let revQd = 0;
        let rawRev = 0;
        let target = 0;
        let pct = 0;
        let dtTraGop = 0;
        let pctTraGop = 0;

        if (isNewFormat) {
            sl = parseFloat(String(parts[0] || '0').replace(/,/g, '')) || 0;
            revQd = parseFloat(String(parts[1] || '0').replace(/,/g, '')) || 0;
            target = parseFloat(String(parts[3] || '0').replace(/,/g, '')) || 0;
            pct = parseFloat(String(parts[4] || '0').replace(/%/g, '').replace(/,/g, '')) || 0;

            const matchedReal = realMap[sName];
            if (matchedReal) {
                rawRev = matchedReal.revReal;
                dtTraGop = matchedReal.dtTraGop;
                pctTraGop = matchedReal.pctTraGop;
            } else {
                rawRev = revQd;
                dtTraGop = 0;
                pctTraGop = 0;
            }
        } else {
            sl = parseFloat(String(parts[0] || '0').replace(/,/g, '')) || 0;
            revQd = parseFloat(String(parts[1] || '0').replace(/,/g, '')) || 0;
            rawRev = revQd;
            target = parseFloat(String(parts[2] || '0').replace(/,/g, '')) || 0;
            pct = parseFloat(String(parts[3] || '0').replace(/%/g, '').replace(/,/g, '')) || 0;

            const matchedReal = realMap[sName];
            if (matchedReal) {
                rawRev = matchedReal.revReal;
                dtTraGop = matchedReal.dtTraGop;
                pctTraGop = matchedReal.pctTraGop;
            }
        }

        const item: RevenueItem = {
            store: storeName,
            shortName: sName,
            sl,
            rev: revQd,
            rawRev,
            target,
            pct,
            pctTraGop,
            dtTraGop,
            isNewFormat
        };

        revMap[sName] = item;
        revList.push(item);
    };

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed || trimmed.startsWith('Đơn vị') || trimmed.startsWith('Tỉ trọng tính')) continue;

        const parts = trimmed.split(/\t|\s{2,}/).map(x => x.trim()).filter(Boolean);
        const firstCol = parts[0] || '';
        const isStoreNameCol = /^(tổng|\d+\s*-|aar_|tgd_|đmx_|dmx_)/i.test(firstCol);

        if (isStoreNameCol && parts.length >= 4) {
            recordRevenue(firstCol, parts.slice(1));
            pendingStore = null;
            continue;
        }

        if (/^(tổng|\d+\s*-\s*(aar|tgd|đmx|dmx)|aar_|tgd_|đmx_|dmx_)/i.test(trimmed) && parts.length <= 2) {
            pendingStore = trimmed;
            continue;
        }

        if (pendingStore && parts.length >= 4) {
            recordRevenue(pendingStore, parts);
            pendingStore = null;
            continue;
        }
    }

    return { revMap, revList };
};
