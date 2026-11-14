import type { CampaignDictItem } from '../../../core/lib/storage';
import { matchCampaignColumns, type ParsedTargetRow } from './campaignMatchHelper';
import { normalizeToMillion } from '../../../core/lib/formatters';

/**
 * Phân tích chuỗi văn bản copy từ Excel / Google Sheet / CSV / Clipboard
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
    let campColMap: { raw_key: string; colIndex: number }[] = [];

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
        });

        // Bỏ qua cột mã NV và cột doanh thu khi tìm kiếm các cột thi đua
        const candidateHeaders = firstParts.map((part, idx) => {
            if (idx === empIdCol || idx === revCol) return '';
            return part;
        });

        campColMap = matchCampaignColumns(candidateHeaders, campaigns);
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
            // Trường hợp 2: Thứ tự chuẩn giống file mẫu (Mã NV, Tên, ST, Doanh thu, Camp1, Camp2...)
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
            target_revenue: target_revenue !== undefined ? normalizeToMillion(target_revenue) : undefined,
            campaign_targets
        });
    }

    return results;
}

/**
 * Tách một dòng thành các ô, hỗ trợ TSV (tab) và CSV có dấu ngoặc kép bọc chuỗi (quote-aware)
 */
export function splitLineIntoCells(line: string): string[] {
    if (line.includes('\t')) {
        return line.split('\t').map(p => p.trim());
    }

    // Nếu dòng có dấu phẩy hoặc chấm phẩy
    if (line.includes(',') || line.includes(';')) {
        const delimiter = line.includes(';') ? ';' : ',';
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    // Ký tự nháy kép escaped: ""
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());

        if (result.length > 1) {
            return result;
        }
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
