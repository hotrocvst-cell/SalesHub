import {
    STANDARD_GEMINI_MODELS,
    sanitizeCachedGeminiModel
} from '../../data-update/services/geminiApiKeyService';
import { removeVietnameseTones } from '../utils/markdownChunker';
import { getSignedImageUrlsBatch } from './knowledgeStorageService';
import { getCachedFaqAnswer, saveFaqCacheEntry } from './faqCacheService';
import { resolveImageAttachments, searchKnowledgeChunksForUser } from './knowledgeService';
import { callCloudflareProxyIfAvailable, callGeminiDirectWithRotation } from './geminiChatClient';
import {
    MAX_ATTACHMENT_IMAGES_PER_REPLY,
    MAX_USER_INPUT_CHARS,
    type ChatAttachmentImage,
    type ChatMessage,
    type ChatSourceRef,
    type KnowledgeChunk
} from '../types/aiAssistantTypes';

const ALL_SYSTEM_ROLES = ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'];

function computeStrictRoleIntersection(chunks: KnowledgeChunk[]): string[] {
    let allowedSet = new Set<string>(ALL_SYSTEM_ROLES);
    chunks.forEach((ch) => {
        const roles = ch.allowed_roles && ch.allowed_roles.length > 0 ? ch.allowed_roles : ['ALL'];
        if (!roles.includes('ALL')) {
            allowedSet = new Set(Array.from(allowedSet).filter((r) => roles.includes(r)));
        }
    });
    const arr = Array.from(allowedSet);
    if (arr.length === ALL_SYSTEM_ROLES.length) return ['ALL'];
    return arr.length > 0 ? arr : ['ADMIN'];
}

function computeStrictStoreIntersection(chunks: KnowledgeChunk[], userStores: string[]): string[] {
    const allPublic = chunks.every((ch) => !ch.allowed_stores || ch.allowed_stores.length === 0 || ch.allowed_stores.includes('ALL'));
    if (allPublic) return ['ALL'];
    return userStores.length > 0 ? userStores : ['ALL'];
}

function buildQuestionHash(normalized: string): string {
    let hash = 5381;
    for (let i = 0; i < normalized.length; i++) {
        hash = ((hash << 5) + hash + normalized.charCodeAt(i)) >>> 0;
    }
    return `q_${hash.toString(36)}_${normalized.length}`;
}

function extractUniqueSources(chunks: KnowledgeChunk[]): ChatSourceRef[] {
    const seen = new Set<string>();
    const list: ChatSourceRef[] = [];
    chunks.forEach((ch) => {
        const key = `${ch.document_id}::${ch.section_title}`;
        if (!seen.has(key)) {
            seen.add(key);
            list.push({
                documentId: ch.document_id,
                documentTitle: ch.document_title || 'Tài liệu nội bộ',
                sectionTitle: ch.section_title || '',
                category: ch.category
            });
        }
    });
    return list;
}

/**
 * Hàm điều phối trung tâm: Cache FAQ -> RAG lọc quyền tại Supabase -> Signed Image URL -> AI / Search
 */
export async function askAiAssistant(params: {
    question: string;
    mode: 'AI' | 'SEARCH';
    userRole: string;
    userStores: string[];
    recentMessages?: ChatMessage[];
}): Promise<ChatMessage> {
    const cleanQuestion = params.question.trim().slice(0, MAX_USER_INPUT_CHARS);
    const normalizedQ = removeVietnameseTones(cleanQuestion);
    const qHash = buildQuestionHash(normalizedQ);
    const msgId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const isFollowUp = (params.recentMessages?.filter((m) => m.role === 'user').length || 0) > 0;

    if (params.mode === 'AI' && !isFollowUp) {
        const cached = await getCachedFaqAnswer({
            questionHash: qHash,
            userRole: params.userRole,
            userStores: params.userStores
        });

        if (cached.hit && cached.answerText) {
            const urlMap = await getSignedImageUrlsBatch(cached.imagePaths || []);
            const images: ChatAttachmentImage[] = (cached.imagePaths || [])
                .slice(0, MAX_ATTACHMENT_IMAGES_PER_REPLY)
                .filter((p) => Boolean(urlMap[p]))
                .map((p, idx) => ({
                    storagePath: p,
                    signedUrl: urlMap[p],
                    caption: `Ảnh tài liệu #${idx + 1}`,
                    documentTitle: cached.sources?.[0]?.documentTitle || 'Tài liệu gốc'
                }));

            return {
                id: msgId,
                role: 'assistant',
                content: cached.answerText,
                createdAt: new Date().toISOString(),
                mode: 'AI',
                sources: cached.sources,
                images,
                fromCache: true,
                modelUsed: 'FAQ Cache'
            };
        }
    }

    const { chunks, error: searchErr } = await searchKnowledgeChunksForUser({
        query: cleanQuestion,
        userRole: params.userRole,
        userStores: params.userStores,
        limit: 6
    });

    if (searchErr) {
        return {
            id: msgId,
            role: 'assistant',
            content: `⚠️ Không thể truy vấn kho tri thức lúc này (${searchErr}). Vui lòng kiểm tra khởi tạo bảng Supabase.`,
            createdAt: new Date().toISOString(),
            mode: params.mode,
            isError: true
        };
    }

    if (chunks.length === 0) {
        return {
            id: msgId,
            role: 'assistant',
            content:
                'Không tìm thấy nội dung phù hợp trong **Kho Tài Liệu được cấp quyền** cho tài khoản của bạn.\n\n- Vui lòng thử lại với từ khóa ngắn gọn hơn (ví dụ: tên chương trình, mã quy trình).\n- Hoặc liên hệ Quản lý / Admin để kiểm tra bổ sung tài liệu vào kho kiến thức.',
            createdAt: new Date().toISOString(),
            mode: params.mode
        };
    }

    const [images, sources] = await Promise.all([
        resolveImageAttachments(chunks, MAX_ATTACHMENT_IMAGES_PER_REPLY, getSignedImageUrlsBatch),
        Promise.resolve(extractUniqueSources(chunks))
    ]);

    if (params.mode === 'SEARCH') {
        const excerpts = chunks
            .slice(0, 4)
            .map((c, idx) => `### ${idx + 1}. ${c.document_title}${c.section_title && c.section_title !== c.document_title ? ` — ${c.section_title}` : ''}\n${c.content}`)
            .join('\n\n---\n\n');

        return {
            id: msgId,
            role: 'assistant',
            content: `Tìm thấy **${chunks.length}** đoạn tài liệu khớp với yêu cầu:\n\n${excerpts}`,
            createdAt: new Date().toISOString(),
            mode: 'SEARCH',
            sources,
            images
        };
    }

    const contextText = chunks
        .map((c, i) => `[TÀI LIỆU ${i + 1}: ${c.document_title} | Mục: ${c.section_title}]\n${c.content}`)
        .join('\n\n====================\n\n')
        .slice(0, 8000);

    const systemInstruction = `Bạn là Trợ lý AI tra cứu quy trình, chính sách và nghiệp vụ nội bộ trên hệ thống SalesHub.
NGUYÊN TẮC BẮT BUỘC:
1. CHỈ ĐƯỢC PHÉP trả lời dựa trên nội dung trong "TÀI LIỆU THAM KHẢO" dưới đây. Tuyệt đối KHÔNG tự suy diễn hoặc bịa đặt thông tin không có trong tài liệu.
2. Trình bày câu trả lời bằng tiếng Việt gọn gàng, dễ đọc trên màn hình điện thoại (dùng in đậm **ý chính**, gạch đầu dòng ngắn gọn, bảng Markdown nếu so sánh số liệu).
3. Cuối câu trả lời nêu ngắn gọn tên tài liệu tham chiếu. ${images.length > 0 ? 'Nếu có thông tin trong ảnh đính kèm, hãy nhắc người dùng xem trực tiếp hình ảnh gốc bên dưới.' : ''}
4. Nếu câu hỏi có chi tiết không xuất hiện trong tài liệu được cấp, hãy nói rõ là tài liệu hiện tại chưa đề cập chi tiết đó.`;

    const historyContents = (params.recentMessages || [])
        .slice(-4)
        .filter((m) => !m.isError)
        .map((m) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content.slice(0, 1200) }]
        }));

    const userPrompt = `TÀI LIỆU THAM KHẢO:\n\n${contextText}\n\n---\nCÂU HỎI CỦA NGƯỜI DÙNG: ${cleanQuestion}`;
    const contents = [...historyContents, { role: 'user', parts: [{ text: userPrompt }] }];

    const cachedModel = sanitizeCachedGeminiModel();
    const models = Array.from(new Set([...(cachedModel ? [cachedModel] : []), ...STANDARD_GEMINI_MODELS]));

    try {
        let answerText = '';
        let modelUsed = '';

        const proxyRes = await callCloudflareProxyIfAvailable({ contents, systemInstruction, models });
        if (proxyRes.handled && proxyRes.text) {
            answerText = proxyRes.text;
            modelUsed = proxyRes.modelUsed || 'cloudflare-proxy';
        } else {
            const direct = await callGeminiDirectWithRotation({ contents, systemInstruction, models });
            answerText = direct.text;
            modelUsed = direct.modelUsed;
        }

        if (!isFollowUp && answerText) {
            saveFaqCacheEntry({
                questionHash: qHash,
                normalizedQuestion: normalizedQ,
                allowedRoles: computeStrictRoleIntersection(chunks),
                allowedStores: computeStrictStoreIntersection(chunks, params.userStores),
                answerText,
                sources,
                imagePaths: images.map((im) => im.storagePath)
            });
        }

        return {
            id: msgId,
            role: 'assistant',
            content: answerText,
            createdAt: new Date().toISOString(),
            mode: 'AI',
            sources,
            images,
            modelUsed
        };
    } catch (err: any) {
        const fallbackExcerpts = chunks
            .slice(0, 3)
            .map((c, idx) => `**${idx + 1}. ${c.document_title}**\n${c.content.slice(0, 380)}...`)
            .join('\n\n');

        return {
            id: msgId,
            role: 'assistant',
            content: `⚠️ Trợ lý AI tạm bận (${err?.message || 'Hạn mức tạm thời'}), hệ thống tự động chuyển sang **trích xuất trực tiếp từ tài liệu gốc** cho bạn:\n\n${fallbackExcerpts}`,
            createdAt: new Date().toISOString(),
            mode: 'SEARCH',
            sources,
            images
        };
    }
}
