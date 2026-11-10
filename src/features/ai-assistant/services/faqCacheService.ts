import { supabase } from '../../../core/lib/supabase';
import { isStoreMatch } from '../../../core/lib/formatters';
import type { ChatSourceRef } from '../types/aiAssistantTypes';

export function isStoreScopeAllowed(allowedStores: string[], userStores: string[], bypassStoreFilter: boolean): boolean {
    if (bypassStoreFilter) return true;
    if (!allowedStores || allowedStores.length === 0 || allowedStores.includes('ALL')) return true;
    if (!userStores || userStores.length === 0) return false;
    return userStores.some((us) => allowedStores.some((as) => isStoreMatch(us, as)));
}

export async function invalidateFaqCache(): Promise<void> {
    try {
        await supabase.from('knowledge_faq_cache').delete().neq('hit_count', -1);
    } catch { }
}

export async function getCachedFaqAnswer(params: {
    questionHash: string;
    userRole: string;
    userStores: string[];
}): Promise<{ hit: boolean; answerText?: string; sources?: ChatSourceRef[]; imagePaths?: string[] }> {
    try {
        const { data, error } = await supabase
            .from('knowledge_faq_cache')
            .select('*')
            .eq('question_hash', params.questionHash)
            .overlaps('allowed_roles', [params.userRole, 'ALL'])
            .limit(5);

        if (error || !data || data.length === 0) return { hit: false };

        const matched = (data as any[]).find((entry) =>
            isStoreScopeAllowed(entry.allowed_stores, params.userStores, params.userRole === 'ADMIN')
        );
        if (!matched) return { hit: false };

        supabase
            .from('knowledge_faq_cache')
            .update({ hit_count: (matched.hit_count || 1) + 1, updated_at: new Date().toISOString() })
            .eq('id', matched.id)
            .then(() => { });

        return {
            hit: true,
            answerText: matched.answer_text,
            sources: (matched.sources as ChatSourceRef[]) || [],
            imagePaths: (matched.image_paths as string[]) || []
        };
    } catch {
        return { hit: false };
    }
}

export async function saveFaqCacheEntry(params: {
    questionHash: string;
    normalizedQuestion: string;
    allowedRoles: string[];
    allowedStores: string[];
    answerText: string;
    sources: ChatSourceRef[];
    imagePaths: string[];
}): Promise<void> {
    try {
        await supabase.from('knowledge_faq_cache').upsert(
            {
                question_hash: params.questionHash,
                normalized_question: params.normalizedQuestion,
                allowed_roles: params.allowedRoles,
                allowed_stores: params.allowedStores,
                answer_text: params.answerText,
                sources: params.sources,
                image_paths: params.imagePaths,
                hit_count: 1,
                updated_at: new Date().toISOString()
            },
            { onConflict: 'question_hash,allowed_roles,allowed_stores' }
        );
    } catch { }
}

