/**
 * Chuẩn hóa chuỗi tiếng Việt về dạng không dấu, viết thường để tìm kiếm toàn văn không phụ thuộc dấu
 */
export function removeVietnameseTones(str: string): string {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Chuyển đổi HTML đơn giản (từ Mammoth DOCX) sang Markdown có bảo toàn tiêu đề, danh sách và bảng
 */
export function htmlToSimpleMarkdown(html: string): string {
    if (typeof window === 'undefined' || !html) return html || '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const serializeNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const childrenText = Array.from(el.childNodes).map(serializeNode).join('');

        switch (tag) {
            case 'h1':
                return `\n# ${childrenText.trim()}\n`;
            case 'h2':
                return `\n## ${childrenText.trim()}\n`;
            case 'h3':
            case 'h4':
                return `\n### ${childrenText.trim()}\n`;
            case 'strong':
            case 'b':
                return childrenText.trim() ? `**${childrenText.trim()}**` : '';
            case 'li':
                return `- ${childrenText.trim()}\n`;
            case 'ul':
            case 'ol':
                return `\n${childrenText}\n`;
            case 'p':
            case 'div':
                return childrenText.trim() ? `\n${childrenText.trim()}\n` : '\n';
            case 'br':
                return '\n';
            case 'table': {
                const rows = Array.from(el.querySelectorAll('tr'));
                if (rows.length === 0) return '';
                const mdRows = rows.map((tr, rIdx) => {
                    const cells = Array.from(tr.querySelectorAll('th, td')).map((cell) =>
                        (cell.textContent || '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '/').trim()
                    );
                    const line = `| ${cells.join(' | ')} |`;
                    if (rIdx === 0) {
                        const sep = `| ${cells.map(() => '---').join(' | ')} |`;
                        return `${line}\n${sep}`;
                    }
                    return line;
                });
                return `\n${mdRows.join('\n')}\n`;
            }
            default:
                return childrenText;
        }
    };

    return serializeNode(doc.body)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Chia nhỏ nội dung Markdown thành các đoạn (chunks) theo tiêu đề mục mà không làm gãy bảng biểu
 */
export function chunkMarkdownContent(
    docTitle: string,
    markdown: string,
    maxChunkChars: number = 950
): Array<{ sectionTitle: string; content: string; searchText: string }> {
    const clean = (markdown || '').replace(/\r\n/g, '\n').trim();
    if (!clean) return [];

    const blocks = clean.split(/\n{2,}/);
    const chunks: Array<{ sectionTitle: string; content: string; searchText: string }> = [];

    let currentSection = docTitle;
    let buffer = '';

    const flushBuffer = () => {
        const trimmed = buffer.trim();
        if (!trimmed) return;
        chunks.push({
            sectionTitle: currentSection,
            content: trimmed,
            searchText: removeVietnameseTones(`${docTitle} ${currentSection} ${trimmed}`)
        });
        buffer = '';
    };

    for (const block of blocks) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) continue;

        const headingMatch = trimmedBlock.match(/^#{1,4}\s+(.+)$/m);
        if (headingMatch && trimmedBlock.startsWith('#')) {
            if (buffer.trim()) flushBuffer();
            currentSection = headingMatch[1].replace(/[*`]/g, '').trim();
        }

        if (buffer.length + trimmedBlock.length + 2 > maxChunkChars && buffer.trim().length > 0) {
            flushBuffer();
        }

        if (trimmedBlock.length > maxChunkChars * 1.5 && !trimmedBlock.startsWith('|')) {
            const lines = trimmedBlock.split('\n');
            for (const line of lines) {
                if (buffer.length + line.length + 1 > maxChunkChars && buffer.trim()) {
                    flushBuffer();
                }
                buffer += (buffer ? '\n' : '') + line;
            }
        } else {
            buffer += (buffer ? '\n\n' : '') + trimmedBlock;
        }
    }

    flushBuffer();
    return chunks;
}

