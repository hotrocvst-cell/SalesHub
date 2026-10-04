import type { CampaignDictItem } from '../../../core/lib/storage';
import type { ParsedTargetRow } from './excelHelper';

/**
 * Phân tích chuỗi văn bản copy từ Excel / Google Sheet / Clipboard
 */
export function parseClipboardTargetText(
    rawText: string,
    campaigns: CampaignDictItem[]
): ParsedTargetRow[] {
    if (!rawText.trim()) return [];

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const results: ParsedTargetRow[] = [];

    // Kiểm tra dòng đầu tiên có phải là Header không
    const firstLine = lines[0];
    const firstParts = splitLineIntoCells(firstLine);
    const hasHeader = firstParts.some(p => {
        const lower = p.toLowerCase();
        return lower.includes('mã nv') || lower.includes('employee') || lower.includes('họ tên') || lower.includes('doanh thu');
    });

    let empIdCol = 0;
    let revCol = -1;
    const campColMap: { raw_key: string; colIndex: number }[] = [];

    let startIndex = 0;
    if (hasHeader) {
        startIndex = 1;
        firstParts.forEach((part, colIdx) => {
            const lower = part.toLowerCase();
            if (lower.includes('mã nv') || lower.includes('employee') || lower === 'manv') {
                empIdCol = colIdx;
            } else if (lower.includes('doanh thu') || lower.includes('revenue') || lower.includes('target dt')) {
                revCol = colIdx;
            }

            campaigns.forEach(c => {
                if (
                    part.includes(`[${c.raw_key}]`) ||
                    lower.includes(c.display_name.toLowerCase()) ||
                    lower.includes(c.raw_key.toLowerCase())
                ) {
                    campColMap.push({ raw_key: c.raw_key, colIndex: colIdx });
                }
            });
        });
    }

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        const parts = splitLineIntoCells(line);
        if (parts.length < 1) continue;

        const empId = parts[empIdCol]?.trim();
        if (!empId || empId.toLowerCase().includes('tổng')) continue;

        let target_revenue: number | undefined = undefined;
        const campaign_targets: Record<string, number> = {};

        if (hasHeader) {
            // Có header rõ ràng
            if (revCol !== -1 && parts[revCol] !== undefined) {
                target_revenue = parseCleanNumber(parts[revCol]);
            }
            campColMap.forEach(({ raw_key, colIndex }) => {
                if (parts[colIndex] !== undefined) {
                    campaign_targets[raw_key] = parseCleanNumber(parts[colIndex]);
                }
            });
        } else {
            // Không có header: Nhận diện theo thứ tự cột chuẩn
            // Trường hợp 1: Chỉ 2 cột (Mã NV, Doanh thu)
            if (parts.length === 2 && isNumericString(parts[1])) {
                target_revenue = parseCleanNumber(parts[1]);
            }
            // Trường hợp 2: Thứ tự chuẩn giống file mẫu (Mã NV, Tên, Siêu thị, Doanh thu, Camp1, Camp2...)
            else if (parts.length >= 4) {
                target_revenue = parseCleanNumber(parts[3]);
                campaigns.forEach((c, cIdx) => {
                    const cellVal = parts[4 + cIdx];
                    if (cellVal !== undefined) {
                        campaign_targets[c.raw_key] = parseCleanNumber(cellVal);
                    }
                });
            }
        }

        results.push({
            employee_id: empId,
            target_revenue,
            campaign_targets
        });
    }

    return results;
}

function splitLineIntoCells(line: string): string[] {
    if (line.includes('\t')) {
        return line.split('\t').map(p => p.trim());
    }
    if (line.includes(',')) {
        return line.split(',').map(p => p.trim());
    }
    if (line.includes(';')) {
        return line.split(';').map(p => p.trim());
    }
    return line.split(/\s{2,}/).map(p => p.trim());
}

function parseCleanNumber(str: string): number {
    if (!str) return 0;
    const clean = str.replace(/[,.\sđĐ]/g, '').trim();
    const num = Number(clean);
    return isNaN(num) ? 0 : num;
}

function isNumericString(str: string): boolean {
    const clean = str.replace(/[,.\s]/g, '').trim();
    return clean !== '' && !isNaN(Number(clean));
}
