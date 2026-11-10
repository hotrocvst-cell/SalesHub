import { supabase } from '../../../core/lib/supabase';
import { chunkMarkdownContent, removeVietnameseTones } from '../utils/markdownChunker';
import { deleteKnowledgeImages } from './knowledgeStorageService';
import { invalidateFaqCache, isStoreScopeAllowed } from './faqCacheService';
import type {
    KnowledgeChunk,
    KnowledgeDocument,
    KnowledgeSourceType,
    ChatAttachmentImage
} from '../types/aiAssistantTypes';

const VN_STOPWORDS = new Set([
    'la', 'gi', 'cua', 'cho', 'nhu', 'the', 'nao', 'co', 'duoc', 'khong', 'ko',
    've', 'trong', 'khi', 'ma', 'va', 'hoac', 'hay', 'thi', 'voi', 'tai', 'o',
    'tu', 'den', 'bao', 'nhieu', 'sao', 'vi', 'ban', 'toi', 'em', 'anh', 'chi',
    'hoi', 'xin', 'vui', 'long', 'cach', 'huong', 'dan', 'quy', 'dinh'
]);

export function extractSearchKeywords(query: string): string[] {
    const clean = removeVietnameseTones(query).replace(/[^a-z0-9\s%]/g, ' ');
    const tokens = clean.split(/\s+/).filter((t) => t.length >= 2 && !VN_STOPWORDS.has(t));
    if (tokens.length > 0) return Array.from(new Set(tokens)).slice(0, 8);
    return Array.from(new Set(clean.split(/\s+/).filter((t) => t.length >= 2))).slice(0, 6);
}

/**
 * Tải danh sách tài liệu theo quyền vai trò (Admin tab quản trị thấy toàn bộ; User chỉ thấy tài liệu được phép)
 */
export async function fetchKnowledgeDocuments(params: {
    userRole: string;
    userStores: string[];
    isAdminManageView?: boolean;
}): Promise<{ success: boolean; data: KnowledgeDocument[]; error?: string }> {
    const { userRole, userStores, isAdminManageView = false } = params;
    try {
        let query = supabase
            .from('knowledge_documents')
            .select('*')
            .order('updated_at', { ascending: false });

        if (!isAdminManageView) {
            query = query.eq('is_active', true).overlaps('allowed_roles', [userRole, 'ALL']);
        }

        const { data, error } = await query.limit(200);
        if (error) {
            return { success: false, data: [], error: error.message };
        }

        const rows = ((data as KnowledgeDocument[]) || []).filter((doc) =>
            isAdminManageView ? true : isStoreScopeAllowed(doc.allowed_stores, userStores, userRole === 'ADMIN')
        );

        return { success: true, data: rows };
    } catch (err: any) {
        return { success: false, data: [], error: err?.message || 'Lỗi tải tài liệu' };
    }
}

/**
 * Lưu tài liệu mới hoặc cập nhật tài liệu + tự động cắt đoạn & đánh chỉ mục search_text
 */
export async function saveKnowledgeDocument(params: {
    id?: string;
    title: string;
    category: string;
    source_type: KnowledgeSourceType;
    raw_content: string;
    image_paths: string[];
    allowed_roles: string[];
    allowed_stores: string[];
    is_active?: boolean;
    created_by: string;
}): Promise<{ success: boolean; document?: KnowledgeDocument; chunkCount?: number; error?: string }> {
    const cleanTitle = params.title.trim();
    const cleanContent = params.raw_content.trim();
    if (!cleanTitle || !cleanContent) {
        return { success: false, error: 'Tiêu đề và nội dung tài liệu không được để trống.' };
    }

    const roles = params.allowed_roles.length > 0 ? params.allowed_roles : ['ALL'];
    const stores = params.allowed_stores.length > 0 ? params.allowed_stores : ['ALL'];
    const summary = cleanContent.replace(/[#*|>\-\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);

    try {
        let savedDoc: KnowledgeDocument | null = null;
        const payload = {
            title: cleanTitle,
            category: params.category || 'Tài liệu khác',
            source_type: params.source_type,
            summary,
            raw_content: cleanContent,
            image_paths: params.image_paths || [],
            allowed_roles: roles,
            allowed_stores: stores,
            is_active: params.is_active ?? true,
            created_by: params.created_by,
            updated_at: new Date().toISOString()
        };

        if (params.id) {
            const { data, error } = await supabase
                .from('knowledge_documents')
                .update(payload)
                .eq('id', params.id)
                .select()
                .single();
            if (error) throw error;
            savedDoc = data as KnowledgeDocument;
            await supabase.from('knowledge_chunks').delete().eq('document_id', savedDoc.id);
        } else {
            const { data, error } = await supabase
                .from('knowledge_documents')
                .insert(payload)
                .select()
                .single();
            if (error) throw error;
            savedDoc = data as KnowledgeDocument;
        }

        const chunks = chunkMarkdownContent(cleanTitle, cleanContent, 950);
        const primaryImage = params.image_paths?.[0] || null;
        const chunkRows = chunks.map((ch, idx) => ({
            document_id: savedDoc!.id,
            chunk_index: idx,
            section_title: ch.sectionTitle,
            content: ch.content,
            search_text: ch.searchText,
            image_path: params.image_paths?.[idx] || primaryImage,
            allowed_roles: roles,
            allowed_stores: stores
        }));

        if (chunkRows.length > 0) {
            const { error: chunkErr } = await supabase.from('knowledge_chunks').insert(chunkRows);
            if (chunkErr) throw chunkErr;
        }

        await invalidateFaqCache();

        return { success: true, document: savedDoc, chunkCount: chunkRows.length };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Lỗi lưu tài liệu lên Supabase' };
    }
}

export async function toggleKnowledgeDocumentActive(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('knowledge_documents')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) return { success: false, error: error.message };
    await invalidateFaqCache();
    return { success: true };
}

export async function deleteKnowledgeDocument(doc: KnowledgeDocument): Promise<{ success: boolean; error?: string }> {
    if (doc.image_paths && doc.image_paths.length > 0) {
        await deleteKnowledgeImages(doc.image_paths);
    }
    const { error } = await supabase.from('knowledge_documents').delete().eq('id', doc.id);
    if (error) return { success: false, error: error.message };
    await invalidateFaqCache();
    return { success: true };
}

/**
 * Tìm kiếm các đoạn tri thức khớp nhất cho người dùng (LỌC NGAY TẠI SUPABASE THEO ROLE & STORE)
 */
export async function searchKnowledgeChunksForUser(params: {
    query: string;
    userRole: string;
    userStores: string[];
    limit?: number;
}): Promise<{ chunks: KnowledgeChunk[]; error?: string }> {
    const { query, userRole, userStores, limit = 6 } = params;
    const keywords = extractSearchKeywords(query);
    const normalizedQuery = removeVietnameseTones(query);

    try {
        let dbQuery = supabase
            .from('knowledge_chunks')
            .select('id, document_id, chunk_index, section_title, content, search_text, image_path, allowed_roles, allowed_stores, knowledge_documents!inner(title, category, source_type, is_active, image_paths)')
            .eq('knowledge_documents.is_active', true)
            .overlaps('allowed_roles', [userRole, 'ALL']);

        if (keywords.length > 0) {
            const orExpr = keywords.map((kw) => `search_text.ilike.%${kw.replace(/[,()]/g, '')}%`).join(',');
            dbQuery = dbQuery.or(orExpr);
        }

        const { data, error } = await dbQuery.limit(45);
        if (error) return { chunks: [], error: error.message };

        const candidates = ((data as any[]) || [])
            .filter((row) => isStoreScopeAllowed(row.allowed_stores, userStores, userRole === 'ADMIN'))
            .map((row) => {
                const docInfo = row.knowledge_documents || {};
                const searchTxt: string = row.search_text || '';
                const docTitleNorm = removeVietnameseTones(docInfo.title || '');
                let score = 0;

                if (normalizedQuery.length >= 4 && searchTxt.includes(normalizedQuery)) score += 25;
                if (normalizedQuery.length >= 4 && docTitleNorm.includes(normalizedQuery)) score += 15;

                keywords.forEach((kw) => {
                    if (searchTxt.includes(kw)) score += 5;
                    if (docTitleNorm.includes(kw)) score += 4;
                });

                const fallbackImg = Array.isArray(docInfo.image_paths) && docInfo.image_paths.length > 0 ? docInfo.image_paths[0] : null;
                return {
                    id: row.id,
                    document_id: row.document_id,
                    chunk_index: row.chunk_index,
                    section_title: row.section_title,
                    content: row.content,
                    search_text: searchTxt,
                    image_path: row.image_path || fallbackImg,
                    allowed_roles: row.allowed_roles,
                    allowed_stores: row.allowed_stores,
                    document_title: docInfo.title || 'Tài liệu nội bộ',
                    category: docInfo.category || '',
                    source_type: docInfo.source_type,
                    score
                } as KnowledgeChunk;
            });

        candidates.sort((a, b) => (b.score || 0) - (a.score || 0));
        return { chunks: candidates.slice(0, limit) };
    } catch (err: any) {
        return { chunks: [], error: err?.message || 'Lỗi truy vấn tri thức' };
    }
}

export async function resolveImageAttachments(
    chunks: KnowledgeChunk[],
    maxImages: number,
    getUrlsFn: (paths: string[]) => Promise<Record<string, string>>
): Promise<ChatAttachmentImage[]> {
    const pathMetaMap = new Map<string, { docTitle: string; caption: string }>();
    chunks.forEach((ch) => {
        if (ch.image_path && !pathMetaMap.has(ch.image_path) && pathMetaMap.size < maxImages) {
            pathMetaMap.set(ch.image_path, {
                docTitle: ch.document_title || 'Tài liệu gốc',
                caption: ch.section_title || ch.document_title || 'Hình ảnh đính kèm'
            });
        }
    });

    const paths = Array.from(pathMetaMap.keys());
    if (paths.length === 0) return [];

    const urlMap = await getUrlsFn(paths);
    return paths
        .filter((p) => Boolean(urlMap[p]))
        .map((p) => ({
            storagePath: p,
            signedUrl: urlMap[p],
            caption: pathMetaMap.get(p)!.caption,
            documentTitle: pathMetaMap.get(p)!.docTitle
        }));
}
