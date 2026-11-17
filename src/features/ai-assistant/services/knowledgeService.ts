import { supabase } from '../../../core/lib/supabase';
import { getStartOfWeek } from '../../../core/lib/formatters';
import { chunkMarkdownContent } from '../utils/markdownChunker';
import {
    extractSearchKeywords,
    scoreAndFilterKnowledgeChunks,
    type ScoredKnowledgeChunk
} from '../utils/retrievalScorer';
import { deleteKnowledgeImages } from './knowledgeStorageService';
import { invalidateFaqCache, isStoreScopeAllowed } from './faqCacheService';
import {
    DEFAULT_DOCUMENT_VALID_UNTIL,
    type KnowledgeChunk,
    type KnowledgeDocument,
    type KnowledgeSourceType,
    type ChatAttachmentImage,
    type KnowledgeTimeframe,
    type TopHotDocumentItem
} from '../types/aiAssistantTypes';

export { extractSearchKeywords };

/**
 * Kiểm tra xem tài liệu đã hết hạn áp dụng hay chưa
 */
export function isDocumentExpired(validUntil?: string | null): boolean {
    if (!validUntil) return false;
    const todayStr = new Date().toISOString().slice(0, 10);
    return validUntil < todayStr;
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

        const rows = ((data as KnowledgeDocument[]) || []).filter((doc) => {
            if (!isAdminManageView) {
                if (isDocumentExpired(doc.valid_until)) return false;
                return isStoreScopeAllowed(doc.allowed_stores, userStores, userRole === 'ADMIN');
            }
            return true;
        });

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
    valid_until?: string;
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
        const payload: any = {
            title: cleanTitle,
            category: params.category || 'Tài liệu khác',
            source_type: params.source_type,
            summary,
            raw_content: cleanContent,
            image_paths: params.image_paths || [],
            allowed_roles: roles,
            allowed_stores: stores,
            valid_until: params.valid_until || DEFAULT_DOCUMENT_VALID_UNTIL,
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

const CHUNK_SELECT_COLS =
    'id, document_id, chunk_index, section_title, content, search_text, image_path, allowed_roles, allowed_stores, knowledge_documents!inner(title, category, source_type, is_active, valid_until, image_paths)';

/**
 * Tìm kiếm các đoạn tri thức khớp nhất cho người dùng (2 bước: Khớp ĐỦ TỪ KHÓA ưu tiên trước, sau đó mới mở rộng + chấm điểm lọc nhiễu)
 */
export async function searchKnowledgeChunksForUser(params: {
    query: string;
    userRole: string;
    userStores: string[];
    limit?: number;
}): Promise<{ chunks: ScoredKnowledgeChunk[]; error?: string }> {
    const { query, userRole, userStores, limit = 6 } = params;
    const keywords = extractSearchKeywords(query);
    const bypassStore = userRole === 'ADMIN';

    try {
        // BƯỚC 1: Ưu tiên khớp ĐỒNG THỜI tất cả từ khóa (AND) để lấy trúng đích 100% tài liệu mục tiêu
        if (keywords.length >= 2 && keywords.length <= 5) {
            let strictQuery = supabase
                .from('knowledge_chunks')
                .select(CHUNK_SELECT_COLS)
                .eq('knowledge_documents.is_active', true)
                .overlaps('allowed_roles', [userRole, 'ALL']);

            keywords.forEach((kw) => {
                const safeKw = kw.replace(/[,()%]/g, '');
                if (safeKw) strictQuery = strictQuery.ilike('search_text', `%${safeKw}%`);
            });

            const { data: strictData, error: strictErr } = await strictQuery.limit(30);
            if (!strictErr && strictData && strictData.length > 0) {
                const storeMatched = (strictData as any[]).filter((row) =>
                    !isDocumentExpired(row.knowledge_documents?.valid_until) &&
                    isStoreScopeAllowed(row.allowed_stores, userStores, bypassStore)
                );
                const strictScored = scoreAndFilterKnowledgeChunks(storeMatched, query, keywords, limit);
                if (strictScored.length > 0) {
                    return { chunks: strictScored };
                }
            }
        }

        // BƯỚC 2: Truy vấn mở rộng (OR) + chấm điểm độ phủ từ khóa, cụm từ liền kề và lọc nhiễu
        let broadQuery = supabase
            .from('knowledge_chunks')
            .select(CHUNK_SELECT_COLS)
            .eq('knowledge_documents.is_active', true)
            .overlaps('allowed_roles', [userRole, 'ALL']);

        if (keywords.length > 0) {
            const orExpr = keywords
                .map((kw) => kw.replace(/[,()]/g, ''))
                .filter(Boolean)
                .map((kw) => `search_text.ilike.%${kw}%`)
                .join(',');
            if (orExpr) broadQuery = broadQuery.or(orExpr);
        }

        const { data: broadData, error: broadErr } = await broadQuery.limit(100);
        if (broadErr) return { chunks: [], error: broadErr.message };

        const storeFiltered = ((broadData as any[]) || []).filter((row) =>
            !isDocumentExpired(row.knowledge_documents?.valid_until) &&
            isStoreScopeAllowed(row.allowed_stores, userStores, bypassStore)
        );
        return { chunks: scoreAndFilterKnowledgeChunks(storeFiltered, query, keywords, limit) };
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

/**
 * Ghi nhận lượt tra cứu tài liệu ngầm (background non-blocking):
 * 1. Tăng view_count và cập nhật last_viewed_at trên knowledge_documents
 * 2. Tăng view_count trên bảng knowledge_daily_stats theo ngày hôm nay (CURRENT_DATE)
 */
export async function recordDocumentAccess(documentIds: string[]): Promise<void> {
    if (!documentIds || documentIds.length === 0) return;
    const uniqueIds = Array.from(new Set(documentIds.filter(Boolean)));
    if (uniqueIds.length === 0) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    // Chạy ngầm không đồng bộ, lỗi mạng không ảnh hưởng người dùng
    try {
        for (const docId of uniqueIds) {
            // 1. Cập nhật view_count trên knowledge_documents
            const { data: doc } = await supabase
                .from('knowledge_documents')
                .select('view_count')
                .eq('id', docId)
                .maybeSingle();

            if (doc) {
                const currentCount = Number(doc.view_count || 0);
                await supabase
                    .from('knowledge_documents')
                    .update({
                        view_count: currentCount + 1,
                        last_viewed_at: nowIso
                    })
                    .eq('id', docId);
            }

            // 2. Upsert vào bảng knowledge_daily_stats (Daily Bucket chống phình DB)
            const { data: dailyRow, error: dailySelErr } = await supabase
                .from('knowledge_daily_stats')
                .select('view_count')
                .eq('document_id', docId)
                .eq('view_date', todayStr)
                .maybeSingle();

            if (!dailySelErr && dailyRow) {
                await supabase
                    .from('knowledge_daily_stats')
                    .update({ view_count: Number(dailyRow.view_count || 0) + 1 })
                    .eq('document_id', docId)
                    .eq('view_date', todayStr);
            } else if (!dailySelErr) {
                await supabase
                    .from('knowledge_daily_stats')
                    .insert({
                        document_id: docId,
                        view_date: todayStr,
                        view_count: 1
                    });
            }
        }
    } catch (err) {
        console.warn('Lỗi ghi nhận thống kê tra cứu tài liệu:', err);
    }
}

/**
 * Lấy danh sách Top tài liệu được tra cứu nhiều nhất (Hot Documents):
 * - WEEK: Tuần này (Thứ Hai -> Hiện tại, theo Quy chuẩn 7)
 * - MONTH: Tháng này (Ngày 1 -> Hiện tại)
 * - ALL_TIME: Toàn thời gian
 */
export async function fetchTopHotDocuments(params: {
    timeframe: KnowledgeTimeframe;
    limit?: number;
}): Promise<{ success: boolean; data: TopHotDocumentItem[]; error?: string }> {
    const { timeframe, limit = 5 } = params;
    try {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);

        // 1. Tải danh sách thông tin cơ bản của tất cả tài liệu
        const { data: docsData, error: docsErr } = await supabase
            .from('knowledge_documents')
            .select('id, title, category, source_type, view_count, last_viewed_at, valid_until, is_active');

        if (docsErr) throw docsErr;
        const allDocs = (docsData || []) as KnowledgeDocument[];
        const docMap = new Map<string, KnowledgeDocument>(allDocs.map((d) => [d.id, d]));

        // Trường hợp 1: Toàn thời gian (All-Time)
        if (timeframe === 'ALL_TIME') {
            const sorted = allDocs
                .filter((d) => (d.view_count || 0) > 0)
                .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
                .slice(0, limit);

            const result: TopHotDocumentItem[] = sorted.map((d, index) => ({
                document_id: d.id,
                title: d.title,
                category: d.category,
                source_type: d.source_type,
                view_count: d.view_count || 0,
                last_viewed_at: d.last_viewed_at,
                valid_until: d.valid_until,
                is_active: d.is_active,
                rank: index + 1
            }));

            return { success: true, data: result };
        }

        // Trường hợp 2 & 3: Tuần này hoặc Tháng này
        let startDateStr = '';
        if (timeframe === 'WEEK') {
            // Quy tắc 7: Bắt đầu từ Thứ Hai đầu tuần
            startDateStr = getStartOfWeek(today);
        } else {
            // Ngày mùng 1 đầu tháng
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            startDateStr = `${yyyy}-${mm}-01`;
        }

        const { data: dailyStats, error: statsErr } = await supabase
            .from('knowledge_daily_stats')
            .select('document_id, view_count, view_date')
            .gte('view_date', startDateStr)
            .lte('view_date', todayStr);

        // Fallback: nếu bảng daily_stats chưa được tạo, chuyển sang lấy theo all_time
        if (statsErr) {
            console.warn('knowledge_daily_stats chưa sẵn sàng, fallback về ALL_TIME:', statsErr.message);
            return fetchTopHotDocuments({ timeframe: 'ALL_TIME', limit });
        }

        // Tính tổng lượt tra cứu theo từng tài liệu trong kỳ
        const countMap = new Map<string, number>();
        (dailyStats || []).forEach((row: any) => {
            const current = countMap.get(row.document_id) || 0;
            countMap.set(row.document_id, current + Number(row.view_count || 0));
        });

        const docIdsWithViews = Array.from(countMap.entries())
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);

        const result: TopHotDocumentItem[] = docIdsWithViews
            .map(([docId, count], index) => {
                const doc = docMap.get(docId);
                return {
                    document_id: docId,
                    title: doc?.title || 'Tài liệu đã xóa',
                    category: doc?.category || 'Chung',
                    source_type: doc?.source_type,
                    view_count: count,
                    last_viewed_at: doc?.last_viewed_at,
                    valid_until: doc?.valid_until,
                    is_active: doc?.is_active ?? true,
                    rank: index + 1
                };
            })
            .filter((item) => item.title !== 'Tài liệu đã xóa');

        return { success: true, data: result };
    } catch (err: any) {
        return { success: false, data: [], error: err?.message || 'Lỗi lấy top tài liệu hot' };
    }
}
