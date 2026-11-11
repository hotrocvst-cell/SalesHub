import {
    STANDARD_GEMINI_MODELS,
    sanitizeCachedGeminiModel
} from '../../data-update/services/geminiApiKeyService';
import { removeVietnameseTones } from '../utils/markdownChunker';
import type { ScoredKnowledgeChunk } from '../utils/retrievalScorer';
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
    return `q2_${hash.toString(36)}_${normalized.length}`;
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
 * Bóc tách thẻ `[[USED_DOCS: ...]]` do AI tự đánh dấu các tài liệu thực sự dùng trả lời, rồi xóa thẻ khỏi văn bản hiển thị
 */
function filterChunksByAiSelection(
    rawAnswer: string,
    chunks: ScoredKnowledgeChunk[]
): { cleanText: string; selectedChunks: ScoredKnowledgeChunk[]; isNoneMatched: boolean } {
    const match = rawAnswer.match(/\[\[USED_DOCS:\s*([^\]]+)\]\]/i);
    const cleanText = rawAnswer.replace(/\[\[USED_DOCS:\s*[^\]]+\]\]/gi, '').trim();

    if (!match) {
        const topScore = chunks[0]?.score || 0;
        return {
            cleanText,
            selectedChunks: chunks.filter((c) => c.score >= topScore * 0.65),
            isNoneMatched: false
        };
    }

    const rawIds = match[1].split(',').map((s) => s.trim()).filter(Boolean);
    if (rawIds.length === 1 && rawIds[0].toUpperCase() === 'NONE') {
        return { cleanText, selectedChunks: [], isNoneMatched: true };
    }

    const idSet = new Set(rawIds);
    const matched = chunks.filter((c) => idSet.has(c.document_id));
    if (matched.length === 0) {
        const topScore = chunks[0]?.score || 0;
        return {
            cleanText,
            selectedChunks: chunks.filter((c) => c.score >= topScore * 0.65),
            isNoneMatched: false
        };
    }

    return { cleanText, selectedChunks: matched, isNoneMatched: false };
}

/**
 * Hàm điều phối trung tâm: Cache FAQ -> RAG lọc quyền & độ khớp chính xác tại Supabase -> Signed Image URL -> AI / Search
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
        limit: 5
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

    if (params.mode === 'SEARCH') {
        const [images, sources] = await Promise.all([
            resolveImageAttachments(chunks, MAX_ATTACHMENT_IMAGES_PER_REPLY, getSignedImageUrlsBatch),
            Promise.resolve(extractUniqueSources(chunks))
        ]);
        const excerpts = chunks
            .slice(0, 4)
            .map((c, idx) => `### ${idx + 1}. ${c.document_title}${c.section_title && c.section_title !== c.document_title ? ` — ${c.section_title}` : ''}\n${c.content}`)
            .join('\n\n---\n\n');

        return {
            id: msgId,
            role: 'assistant',
            content: `Tìm thấy **${chunks.length}** đoạn tài liệu khớp chính xác nhất:\n\n${excerpts}`,
            createdAt: new Date().toISOString(),
            mode: 'SEARCH',
            sources,
            images
        };
    }

    const contextText = chunks
        .map((c, i) => `[DOC_ID: ${c.document_id} | TÀI LIỆU ${i + 1}: ${c.document_title} | Mục: ${c.section_title}]\n${c.content}`)
        .join('\n\n====================\n\n')
        .slice(0, 8000);

    const systemInstruction = `Bạn là Trợ lý AI tra cứu quy trình, chính sách và nghiệp vụ nội bộ trên hệ thống SalesHub.
NGUYÊN TẮC BẮT BUỘC:
1. CHỈ ĐƯỢC PHÉP trả lời dựa trên tài liệu THỰC SỰ LIÊN QUAN TRỰC TIẾP tới câu hỏi trong "TÀI LIỆU THAM KHẢO". Nếu có tài liệu khác chủ đề (ví dụ hỏi về nồi cơm thì bỏ qua tài liệu về máy lọc nước), TUYỆT ĐỐI KHÔNG nhắc hay trích dẫn tài liệu lạc đề đó.
2. Trình bày ngắn gọn, rõ ràng bằng tiếng Việt (Markdown: **ý chính**, gạch đầu dòng, bảng nếu cần) để dễ đọc trên điện thoại.
3. Cuối phần nội dung nhắc ngắn gọn tên tài liệu đúng chủ đề và hướng dẫn xem ảnh gốc đính kèm bên dưới (nếu có).
4. Ở dòng cuối cùng, BẮT BUỘC thêm đúng 1 thẻ kỹ thuật dạng: [[USED_DOCS: doc_id_1]] (hoặc cách nhau dấu phẩy nếu thực sự dùng nhiều tài liệu, hoặc [[USED_DOCS: NONE]] nếu không có tài liệu nào khớp câu hỏi).`;

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
        let rawAnswer = '';
        let modelUsed = '';

        const proxyRes = await callCloudflareProxyIfAvailable({ contents, systemInstruction, models });
        if (proxyRes.handled && proxyRes.text) {
            rawAnswer = proxyRes.text;
            modelUsed = proxyRes.modelUsed || 'cloudflare-proxy';
        } else {
            const direct = await callGeminiDirectWithRotation({ contents, systemInstruction, models });
            rawAnswer = direct.text;
            modelUsed = direct.modelUsed;
        }

        const { cleanText, selectedChunks, isNoneMatched } = filterChunksByAiSelection(rawAnswer, chunks);
        if (isNoneMatched) {
            return {
                id: msgId,
                role: 'assistant',
                content: cleanText || 'Không tìm thấy tài liệu phù hợp chính xác với câu hỏi của bạn.',
                createdAt: new Date().toISOString(),
                mode: 'AI',
                modelUsed
            };
        }

        const [images, sources] = await Promise.all([
            resolveImageAttachments(selectedChunks, MAX_ATTACHMENT_IMAGES_PER_REPLY, getSignedImageUrlsBatch),
            Promise.resolve(extractUniqueSources(selectedChunks))
        ]);

        if (!isFollowUp && cleanText) {
            saveFaqCacheEntry({
                questionHash: qHash,
                normalizedQuestion: normalizedQ,
                allowedRoles: computeStrictRoleIntersection(selectedChunks),
                allowedStores: computeStrictStoreIntersection(selectedChunks, params.userStores),
                answerText: cleanText,
                sources,
                imagePaths: images.map((im) => im.storagePath)
            });
        }

        return {
            id: msgId,
            role: 'assistant',
            content: cleanText,
            createdAt: new Date().toISOString(),
            mode: 'AI',
            sources,
            images,
            modelUsed
        };
    } catch (err: any) {
        const topScore = chunks[0]?.score || 0;
        const tightChunks = chunks.filter((c) => c.score >= topScore * 0.65);
        const [images, sources] = await Promise.all([
            resolveImageAttachments(tightChunks, MAX_ATTACHMENT_IMAGES_PER_REPLY, getSignedImageUrlsBatch),
            Promise.resolve(extractUniqueSources(tightChunks))
        ]);
        const fallbackExcerpts = tightChunks
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
