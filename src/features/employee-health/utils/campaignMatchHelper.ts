import type { CampaignDictItem } from '../../../core/lib/storage';

export interface ParsedTargetRow {
    employee_id: string;
    full_name?: string;
    store_name?: string;
    target_revenue?: number;
    campaign_targets: Record<string, number>;
}

export interface MatchedCampaignCol {
    raw_key: string;
    colIndex: number;
}

/**
 * Trích xuất raw_key từ dấu ngoặc vuông cuối cùng trong tiêu đề (nếu có)
 * Ví dụ: "Sim (SL) [T11 - Sim]" -> "T11 - Sim"
 */
export function extractBracketedKey(header: string): string | null {
    const match = header.match(/\[([^\]]+)\]\s*$/) || header.match(/\[([^\]]+)\]/);
    return match ? match[1].trim() : null;
}

/**
 * Trích xuất tên hiển thị bằng cách gỡ bỏ [raw_key] và (đơn vị)
 * Ví dụ: "Sim (SL) [T11 - Sim]" -> "Sim"
 * Ví dụ: "Sim ĐMX (SL) [T11 - Sim ĐMX]" -> "Sim ĐMX"
 */
export function cleanHeaderDisplayName(header: string): string {
    return header
        .replace(/\[[^\]]+\]/g, '') // bỏ [raw_key]
        .replace(/\([^)]+\)/g, '')   // bỏ (SL), (DT), (cái)...
        .trim();
}

/**
 * Khớp nối các cột tiêu đề với danh mục chương trình thi đua (1-to-1 matching)
 * Ưu tiên tuyệt đối:
 * 1. Khớp chính xác mã raw_key trong ngoặc vuông [RAW_KEY]
 * 2. Khớp chính xác tên hiển thị display_name (sau khi gỡ đơn vị)
 * 3. Khớp chính xác mã raw_key
 * 4. Khớp bao hàm có sắp xếp ưu tiên độ dài (để "Sim ĐMX" không bị "Sim" nhận nhầm)
 */
export function matchCampaignColumns(
    headers: string[],
    campaigns: CampaignDictItem[]
): MatchedCampaignCol[] {
    const matchedCampKeys = new Set<string>();
    const campCols: MatchedCampaignCol[] = [];

    // BƯỚC 1: Quét ưu tiên tuyệt đối các cột có [RAW_KEY] trong tiêu đề
    headers.forEach((header, colIndex) => {
        const text = String(header || '').trim();
        if (!text) return;

        const bracketKey = extractBracketedKey(text);
        if (bracketKey) {
            const exactCamp = campaigns.find(
                c => c.raw_key.trim().toLowerCase() === bracketKey.toLowerCase()
            );
            if (exactCamp && !matchedCampKeys.has(exactCamp.raw_key)) {
                campCols.push({ raw_key: exactCamp.raw_key, colIndex });
                matchedCampKeys.add(exactCamp.raw_key);
            }
        }
    });

    // BƯỚC 2: Với các cột chưa được gán, tìm theo độ khớp chính xác
    headers.forEach((header, colIndex) => {
        const text = String(header || '').trim();
        if (!text) return;

        // Nếu cột này đã được map ở Bước 1 thì bỏ qua
        if (campCols.some(c => c.colIndex === colIndex)) return;

        const cleanDisplay = cleanHeaderDisplayName(text).toLowerCase();
        const lower = text.toLowerCase();

        // Sắp xếp các campaign chưa map theo độ dài giảm dần để ưu tiên tên dài hơn (tránh "Sim" ăn mất "Sim ĐMX")
        const availableCamps = campaigns
            .filter(c => !matchedCampKeys.has(c.raw_key))
            .sort((a, b) => (b.display_name.length + b.raw_key.length) - (a.display_name.length + a.raw_key.length));

        // 2.1 Khớp chính xác tên hiển thị sau khi lọc bỏ đơn vị
        let bestCamp = cleanDisplay
            ? availableCamps.find(c => c.display_name.trim().toLowerCase() === cleanDisplay)
            : undefined;

        // 2.2 Khớp chính xác raw_key
        if (!bestCamp) {
            bestCamp = availableCamps.find(
                c => c.raw_key.trim().toLowerCase() === text.toLowerCase()
            );
        }

        // 2.3 Khớp bao hàm (substring) nhưng chỉ khi có ranh giới từ hoặc chuỗi dài
        if (!bestCamp) {
            bestCamp = availableCamps.find(c => {
                const cDisp = c.display_name.trim().toLowerCase();
                const cRaw = c.raw_key.trim().toLowerCase();
                if (!cDisp && !cRaw) return false;

                // Kiểm tra tên hiển thị khớp nguyên từ
                if (cDisp) {
                    const wordRegex = new RegExp(`(^|\\s|\\(|\\b)${escapeRegex(cDisp)}(\\s|\\)|\\b|$)`, 'i');
                    if (wordRegex.test(cleanDisplay) || wordRegex.test(text)) return true;
                }

                // Kiểm tra raw_key trong text
                if (cRaw && lower.includes(cRaw)) return true;

                return false;
            });
        }

        if (bestCamp) {
            campCols.push({ raw_key: bestCamp.raw_key, colIndex });
            matchedCampKeys.add(bestCamp.raw_key);
        }
    });

    return campCols;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
