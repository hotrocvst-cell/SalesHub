import type { CampaignProgramItem } from '../types';

/**
 * ==============================================================================
 * BỘ TỪ KHÓA NHẬN DIỆN TỰ ĐỘNG ĐỊNH DẠNG TEXT CHO CHƯƠNG TRÌNH THI ĐUA (SALESHUB)
 * Vị trí file: src/features/campaign-directory/utils/campaignTextBeautifier.ts
 * ------------------------------------------------------------------------------
 * HƯỚNG DẪN DÀNH CHO ADMIN:
 * Để thêm từ khóa mới, bạn chỉ cần thêm chuỗi vào mảng tương ứng bên dưới.
 * Các từ khóa được so khớp không phân biệt hoa thường.
 * ==============================================================================
 */

/**
 * 1. MÀU ĐỎ [red]: Nhận diện các từ khóa thưởng nóng, nhân đôi, cảnh báo, loại trừ
 */
export const RED_KEYWORDS: string[] = [
    'nhân đôi điểm thi đua',
    'nhân đôi điểm',
    'nhân đôi',
    'thưởng nóng',
    'thuong nong',
    'cắt thưởng',
    'loại trừ',
    'lưu ý quan trọng',
    'lưu ý',
    'chú ý',
    'cháy hàng',
    'cực hot',
    'hết suất'
];

/**
 * 2. MÀU XANH DƯƠNG [blue]: Nhận diện cổng thanh toán, ngân hàng, đối tác tài chính & thương hiệu
 */
export const BLUE_KEYWORDS: string[] = [
    'vnpay',
    'momo',
    'zalopay',
    'shopeepay',
    'home credit',
    'fe credit',
    'hdsaison',
    'kredivo',
    'apple pay',
    'samsung pay',
    'apple',
    'samsung',
    'sony',
    'xiaomi',
    'iphone',
    'ipad',
    'macbook',
    'galaxy ai',
    'galaxy'
];

/**
 * 3. MÀU XANH LÁ [green]: Nhận diện quà tặng kèm, trợ giá, thu cũ đổi mới, miễn phí
 */
export const GREEN_KEYWORDS: string[] = [
    'thu cũ đổi mới',
    'thu cu doi moi',
    'trợ giá',
    'tro gia',
    'tặng kèm',
    'miễn phí lắp đặt',
    'bảo hành 1 đổi 1',
    'tặng củ sạc',
    'tặng loa soundbar',
    'tặng loa',
    'tặng tai nghe',
    'giảm thêm',
    'ưu đãi thêm',
    'tặng ốp lưng',
    'tặng quà',
    'quà tặng'
];

/**
 * 4. MÀU VÀNG CAM [amber]: Nhận diện giải thưởng lớn, hiện vật quý, top vinh danh
 */
export const AMBER_KEYWORDS: string[] = [
    '1 chỉ vàng',
    'vàng pnj',
    'vàng 9999',
    'top 1 siêu thị',
    'top 1',
    'top 2',
    'top 3',
    'giải nhất',
    'giai nhat',
    'giải nhì',
    'giải ba',
    'xuất sắc',
    'vinh danh'
];

/**
 * 5. MÀU TÍM [purple]: Nhận diện gói bảo hiểm, rơi vỡ, SIM số đẹp, tiện ích bán lẻ
 */
export const PURPLE_KEYWORDS: string[] = [
    'bảo hiểm rơi vỡ',
    'bảo hành mở rộng',
    'bảo hiểm',
    'aig',
    'mic',
    'sim data',
    'gói cước',
    'tài khoản vip'
];

/**
 * 6. TÔ NỀN HIGHLIGHT VÀNG [hl]: Nhận diện các cột mốc vượt target, ưu tiên đặc biệt
 */
export const HIGHLIGHT_KEYWORDS: string[] = [
    'vượt mốc',
    'vượt 100%',
    'vượt 120%',
    'vượt 150%',
    'ưu tiên tư vấn',
    'ưu tiên'
];

/**
 * Thoát ký tự đặc biệt trong Regex
 */
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * HÀM TỰ ĐỘNG ĐỊNH DẠNG VĂN BẢN THÔNG MINH (SMART TEXT BEAUTIFIER)
 * Tự động gắn thẻ **đậm**, [red], [blue], [green], [amber], [purple], [hl] và gạch đầu dòng '- '
 * Đảm bảo tính Idempotent: Nếu văn bản đã có thẻ từ trước sẽ được giữ nguyên 100%, không bọc đè.
 */
export function beautifyCampaignText(text: string): string {
    if (!text || !text.trim()) return text;

    const tokens: string[] = [];
    function saveToken(content: string): string {
        const id = `___BEAUTIFY_TOKEN_${tokens.length}___`;
        tokens.push(content);
        return id;
    }

    // 1. Khóa an toàn toàn bộ các thẻ định dạng đã có sẵn từ trước trong văn bản
    const existingTagRegex = /(\[color=[^\]]+\][\s\S]*?\[\/color\])|(\[(red|blue|green|amber|gold|vang|orange|purple|tim|rose|cyan|gray|hl|highlight|badge)\][\s\S]*?\[\/\3\])|(\*\*[\s\S]*?\*\*)|(<b>[\s\S]*?<\/b>)|(<strong>[\s\S]*?<\/strong>)|(\*[\s\S]*?\*)|(<i>[\s\S]*?<\/i>)|(<em>[\s\S]*?<\/em>)/gi;
    let tokenized = text.replace(existingTagRegex, match => saveToken(match));

    // Hàm bao bọc từ khóa và khóa token ngay lập tức để không bị từ khóa con bọc đè
    function wrapAndTokenize(content: string, keywords: string[], openTag: string, closeTag: string): string {
        // Sắp xếp các từ khóa dài lên trước để ưu tiên cụm từ ghép
        const sorted = [...keywords].sort((a, b) => b.length - a.length);
        sorted.forEach(kw => {
            const regex = new RegExp(`(?<![a-zA-Z0-9\u00C0-\u1EF9])(${escapeRegExp(kw)})(?![a-zA-Z0-9\u00C0-\u1EF9])`, 'gi');
            content = content.replace(regex, match => saveToken(`${openTag}${match}${closeTag}`));
        });
        return content;
    }

    // 2. Nhận diện các nhóm từ khóa màu sắc theo thứ tự ưu tiên
    tokenized = wrapAndTokenize(tokenized, RED_KEYWORDS, '[red]', '[/red]');
    tokenized = wrapAndTokenize(tokenized, BLUE_KEYWORDS, '[blue]', '[/blue]');
    tokenized = wrapAndTokenize(tokenized, GREEN_KEYWORDS, '[green]', '[/green]');
    tokenized = wrapAndTokenize(tokenized, AMBER_KEYWORDS, '[amber]', '[/amber]');
    tokenized = wrapAndTokenize(tokenized, PURPLE_KEYWORDS, '[purple]', '[/purple]');
    tokenized = wrapAndTokenize(tokenized, HIGHLIGHT_KEYWORDS, '[hl]', '[/hl]');

    // 3. Tự động in đậm số tiền thưởng & giảm giá (ví dụ: 150.000đ, 2.500.000đ, 500k, 2.5tr)
    const moneyRegex = /(?<![a-zA-Z0-9\u00C0-\u1EF9])(\d{1,3}(?:\.\d{3})+(?:\s*(?:đ|vnđ|vnd|đồng))|\d+(?:[.,]\d+)?\s*(?:triệu|tr|k)\b(?:\s*(?:đ|vnđ|vnd|đồng))?)(?![a-zA-Z0-9\u00C0-\u1EF9])/gi;
    tokenized = tokenized.replace(moneyRegex, match => saveToken(`**${match.trim()}**`));

    // 4. Tự động in đậm mốc target & tỷ lệ phần trăm (ví dụ: 100% target, >= 45%)
    const targetRegex = /(?<![a-zA-Z0-9\u00C0-\u1EF9])((?:>=|≥|>|≤|<=)?\s*\d+(?:[.,]\d+)?%\s*(?:target|chỉ tiêu|mục tiêu)?)(?![a-zA-Z0-9\u00C0-\u1EF9])/gi;
    tokenized = tokenized.replace(targetRegex, match => saveToken(`**${match.trim()}**`));

    // 5. Khôi phục lại toàn bộ các token đã khóa theo thứ tự đảo ngược
    for (let i = tokens.length - 1; i >= 0; i--) {
        tokenized = tokenized.split(`___BEAUTIFY_TOKEN_${i}___`).join(tokens[i]);
    }

    // 6. Tự động chuẩn hóa gạch đầu dòng bullet cho văn bản có nhiều dòng
    const lines = tokenized.split(/\r?\n/);
    if (lines.length > 1) {
        const formattedLines = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed) return line;
            if (
                trimmed.startsWith('- ') ||
                trimmed.startsWith('• ') ||
                trimmed.startsWith('+ ') ||
                /^\d+\.\s/.test(trimmed)
            ) {
                return line;
            }
            return `- ${trimmed}`;
        });
        tokenized = formattedLines.join('\n');
    }

    return tokenized;
}

/**
 * Tự động làm đẹp cả Thể Lệ (rules) và Cơ Hội (opportunity) cho 1 chương trình thi đua
 */
export function beautifyCampaignProgramItem(item: CampaignProgramItem): CampaignProgramItem {
    return {
        ...item,
        rules: beautifyCampaignText(item.rules || ''),
        opportunity: item.opportunity ? beautifyCampaignText(item.opportunity) : ''
    };
}

