import { supabase } from '../../../core/lib/supabase';
import {
    MAX_CHAT_SESSIONS_PER_USER,
    MAX_MESSAGE_PAIRS_PER_SESSION,
    MAX_SESSION_AGE_DAYS,
    type AiChatSession,
    type ChatMessage
} from '../types/aiAssistantTypes';
import { getSignedImageUrlsBatch } from './knowledgeStorageService';

const MAX_MESSAGES_TOTAL = MAX_MESSAGE_PAIRS_PER_SESSION * 2;

function trimMessagesForStorage(messages: ChatMessage[]): ChatMessage[] {
    const sliced = messages.slice(-MAX_MESSAGES_TOTAL);
    return sliced.map((msg) => ({
        ...msg,
        // Không lưu signedUrl tạm thời vào DB; chỉ giữ storagePath để tái cấp quyền khi mở lại
        images: msg.images?.map((img) => ({
            storagePath: img.storagePath,
            signedUrl: '',
            caption: img.caption,
            documentTitle: img.documentTitle
        }))
    }));
}

/**
 * Tải tối đa 10 phiên chat gần nhất của user (tự động xóa phiên quá 30 ngày hoặc vượt quá 10 phiên)
 */
export async function fetchUserChatSessions(employeeId: string): Promise<{
    sessions: AiChatSession[];
    error?: string;
}> {
    if (!employeeId) return { sessions: [] };

    try {
        // 1. Dọn dẹp các phiên cũ quá 30 ngày
        const cutoff = new Date(Date.now() - MAX_SESSION_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
        await supabase
            .from('ai_chat_sessions')
            .delete()
            .eq('employee_id', employeeId)
            .lt('updated_at', cutoff);

        // 2. Lấy danh sách phiên còn lại sắp xếp mới nhất lên đầu
        const { data, error } = await supabase
            .from('ai_chat_sessions')
            .select('*')
            .eq('employee_id', employeeId)
            .order('updated_at', { ascending: false })
            .limit(MAX_CHAT_SESSIONS_PER_USER + 10);

        if (error) {
            return { sessions: [], error: error.message };
        }

        const allRows = (data as AiChatSession[]) || [];
        const kept = allRows.slice(0, MAX_CHAT_SESSIONS_PER_USER);
        const overflowIds = allRows.slice(MAX_CHAT_SESSIONS_PER_USER).map((r) => r.id);

        if (overflowIds.length > 0) {
            await supabase.from('ai_chat_sessions').delete().in('id', overflowIds);
        }

        return { sessions: kept };
    } catch (err: any) {
        return { sessions: [], error: err?.message || 'Lỗi tải lịch sử trò chuyện' };
    }
}

/**
 * Tái cấp Signed URL cho các hình ảnh trong một phiên chat cũ khi người dùng mở lại
 */
export async function hydrateSessionImageUrls(messages: ChatMessage[]): Promise<ChatMessage[]> {
    const allPaths: string[] = [];
    messages.forEach((m) => {
        m.images?.forEach((img) => {
            if (img.storagePath) allPaths.push(img.storagePath);
        });
    });

    if (allPaths.length === 0) return messages;
    const urlMap = await getSignedImageUrlsBatch(allPaths);

    return messages.map((m) => ({
        ...m,
        images: m.images
            ?.map((img) => ({
                ...img,
                signedUrl: urlMap[img.storagePath] || img.signedUrl || ''
            }))
            .filter((img) => Boolean(img.signedUrl))
    }));
}

/**
 * Tạo mới hoặc cập nhật phiên chat lên Cloud (tự động giới hạn số tin nhắn mỗi phiên)
 */
export async function saveUserChatSession(params: {
    sessionId?: string | null;
    employeeId: string;
    title: string;
    messages: ChatMessage[];
}): Promise<{ success: boolean; session?: AiChatSession; error?: string }> {
    const { sessionId, employeeId, title, messages } = params;
    if (!employeeId) return { success: false, error: 'Thiếu định danh nhân sự' };

    const trimmedMessages = trimMessagesForStorage(messages);
    const cleanTitle = (title || 'Cuộc trò chuyện mới').trim().slice(0, 80);

    try {
        if (sessionId) {
            const { data, error } = await supabase
                .from('ai_chat_sessions')
                .update({
                    title: cleanTitle,
                    messages: trimmedMessages,
                    message_count: trimmedMessages.length,
                    updated_at: new Date().toISOString()
                })
                .eq('id', sessionId)
                .eq('employee_id', employeeId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, session: data as AiChatSession };
        }

        // Trước khi thêm phiên mới, kiểm tra tổng số phiên hiện có để giữ đúng trần MAX_CHAT_SESSIONS_PER_USER
        const { data: existing } = await supabase
            .from('ai_chat_sessions')
            .select('id')
            .eq('employee_id', employeeId)
            .order('updated_at', { ascending: false });

        if (existing && existing.length >= MAX_CHAT_SESSIONS_PER_USER) {
            const idsToDelete = existing.slice(MAX_CHAT_SESSIONS_PER_USER - 1).map((r: any) => r.id);
            if (idsToDelete.length > 0) {
                await supabase.from('ai_chat_sessions').delete().in('id', idsToDelete);
            }
        }

        const { data, error } = await supabase
            .from('ai_chat_sessions')
            .insert({
                employee_id: employeeId,
                title: cleanTitle,
                messages: trimmedMessages,
                message_count: trimmedMessages.length
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, session: data as AiChatSession };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Lỗi lưu lịch sử chat' };
    }
}

export async function deleteUserChatSession(sessionId: string, employeeId: string): Promise<boolean> {
    if (!sessionId || !employeeId) return false;
    const { error } = await supabase
        .from('ai_chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('employee_id', employeeId);
    return !error;
}

export async function clearAllUserChatSessions(employeeId: string): Promise<boolean> {
    if (!employeeId) return false;
    const { error } = await supabase.from('ai_chat_sessions').delete().eq('employee_id', employeeId);
    return !error;
}

