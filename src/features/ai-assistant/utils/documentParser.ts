import type { KnowledgeSourceType } from '../types/aiAssistantTypes';
import { prepareImageForOcr, fileToBase64 } from '../../data-update/services/imageCompressionService';
import {
    getAvailableApiKeys,
    STANDARD_GEMINI_MODELS,
    sanitizeCachedGeminiModel,
    GeminiQuotaExceededError
} from '../../data-update/services/geminiApiKeyService';
import {
    removeVietnameseTones,
    htmlToSimpleMarkdown,
    chunkMarkdownContent
} from './markdownChunker';

export { removeVietnameseTones, chunkMarkdownContent };

/**
 * Đọc file Excel (.xlsx / .csv) thành các bảng Markdown theo từng Sheet
 */
async function parseExcelFileToMarkdown(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sections: string[] = [];
    workbook.eachSheet((sheet) => {
        const rows: string[][] = [];
        sheet.eachRow((row) => {
            const values = Array.isArray(row.values) ? row.values.slice(1) : [];
            const line = values.map((v) => {
                if (v === null || v === undefined) return '';
                if (typeof v === 'object' && 'text' in (v as any)) return String((v as any).text || '');
                if (typeof v === 'object' && 'result' in (v as any)) return String((v as any).result ?? '');
                return String(v);
            });
            if (line.some((c) => c.trim() !== '')) {
                rows.push(line.map((c) => c.replace(/[\r\n]+/g, ' ').replace(/\|/g, '/').trim()));
            }
        });

        if (rows.length > 0) {
            const colCount = Math.max(...rows.map((r) => r.length));
            const padded = rows.map((r) => {
                const copy = [...r];
                while (copy.length < colCount) copy.push('');
                return `| ${copy.join(' | ')} |`;
            });
            const headerSep = `| ${Array(colCount).fill('---').join(' | ')} |`;
            const tableMd = [padded[0], headerSep, ...padded.slice(1)].join('\n');
            sections.push(`## Sheet: ${sheet.name}\n\n${tableMd}`);
        }
    });

    return sections.join('\n\n') || '(File Excel không có dữ liệu văn bản)';
}

/**
 * Đọc file Word (.docx) thành Markdown
 */
async function parseDocxFileToMarkdown(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    return htmlToSimpleMarkdown(result.value) || '(File Word không có nội dung)';
}

/**
 * Gọi Gemini Vision/Multimodal bóc tách nội dung từ Hình ảnh hoặc PDF sang Markdown
 */
async function extractPdfOrImageWithGemini(
    file: File,
    preferredKey?: string
): Promise<{ markdown: string; compressedBase64?: string; mimeType?: string }> {
    const candidateKeys = getAvailableApiKeys(preferredKey);
    if (candidateKeys.length === 0) {
        throw new Error('Chưa cấu hình Gemini API Key để đọc nội dung PDF hoặc Hình ảnh. Vui lòng thêm API Key trong cài đặt.');
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    let base64Data = '';
    let mimeType = file.type || 'image/jpeg';

    if (isPdf) {
        if (file.size > 15 * 1024 * 1024) {
            throw new Error('File PDF vượt quá giới hạn 15MB. Vui lòng tách nhỏ hoặc nén file PDF trước khi tải lên.');
        }
        base64Data = await fileToBase64(file);
        mimeType = 'application/pdf';
    } else {
        const prepared = await prepareImageForOcr(file, 1600, 0.82);
        base64Data = prepared.data;
        mimeType = prepared.mimeType;
    }

    const prompt = `Bạn là trợ lý số hóa tài liệu nghiệp vụ bán lẻ.
Hãy đọc toàn bộ nội dung trong ${isPdf ? 'tài liệu PDF' : 'hình ảnh'} này và chuyển đổi chính xác sang định dạng Markdown tiếng Việt.
YÊU CẦU:
1. Giữ nguyên cấu trúc tiêu đề (#, ##, ###), danh sách gạch đầu dòng và các con số, mốc thưởng, tỷ lệ %.
2. Nếu có bảng biểu, hãy kẻ thành bảng Markdown chuẩn (| Cột 1 | Cột 2 | ...).
3. Không tự ý thêm thông tin ngoài tài liệu, không thêm lời bình luận thừa, chỉ trả về nội dung Markdown sạch sẽ.`;

    const cachedModel = sanitizeCachedGeminiModel();
    const models = Array.from(new Set([...(cachedModel ? [cachedModel] : []), ...STANDARD_GEMINI_MODELS]));
    let lastError = 'Không thể bóc tách nội dung bằng Gemini AI';

    for (const apiKey of candidateKeys) {
        for (const model of models) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 45000);

                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        signal: controller.signal,
                        body: JSON.stringify({
                            contents: [
                                {
                                    parts: [
                                        { text: prompt },
                                        { inline_data: { mime_type: mimeType, data: base64Data } }
                                    ]
                                }
                            ],
                            generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
                        })
                    }
                );
                clearTimeout(timeoutId);

                if (res.status === 429) {
                    lastError = 'Gemini API Key tạm chạm giới hạn 429';
                    break;
                }

                if (res.ok) {
                    const data = await res.json();
                    const text =
                        data?.candidates?.[0]?.content?.parts
                            ?.map((p: any) => p?.text || '')
                            .join('')
                            .trim() || '';
                    if (text) {
                        return {
                            markdown: text,
                            compressedBase64: isPdf ? undefined : base64Data,
                            mimeType
                        };
                    }
                }
            } catch (err: any) {
                lastError = err?.message || 'Lỗi kết nối Gemini';
            }
        }
    }

    throw new GeminiQuotaExceededError(lastError, 'ADMIN');
}

/**
 * Bộ điều phối bóc tách đa định dạng tập trung cho tab Quản lý Kho Tri Thức
 */
export async function parseUploadedDocumentFile(
    file: File,
    preferredGeminiKey?: string
): Promise<{ sourceType: KnowledgeSourceType; markdown: string; isImage: boolean }> {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        const res = await extractPdfOrImageWithGemini(file, preferredGeminiKey);
        return { sourceType: 'IMAGE', markdown: res.markdown, isImage: true };
    }

    if (file.type === 'application/pdf' || ext === 'pdf') {
        const res = await extractPdfOrImageWithGemini(file, preferredGeminiKey);
        return { sourceType: 'PDF', markdown: res.markdown, isImage: false };
    }

    if (ext === 'docx') {
        const markdown = await parseDocxFileToMarkdown(file);
        return { sourceType: 'DOCX', markdown, isImage: false };
    }

    if (['xlsx', 'xls'].includes(ext)) {
        const markdown = await parseExcelFileToMarkdown(file);
        return { sourceType: 'EXCEL', markdown, isImage: false };
    }

    if (ext === 'md') {
        const text = await file.text();
        return { sourceType: 'MARKDOWN', markdown: text.trim(), isImage: false };
    }

    const text = await file.text();
    return { sourceType: 'TEXT', markdown: text.trim(), isImage: false };
}
