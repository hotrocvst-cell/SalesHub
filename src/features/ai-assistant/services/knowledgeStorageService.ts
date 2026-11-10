import { supabase } from '../../../core/lib/supabase';
import { prepareImageForOcr } from '../../data-update/services/imageCompressionService';
import { KNOWLEDGE_STORAGE_BUCKET, type StorageHealthStatus } from '../types/aiAssistantTypes';

// Bộ đệm ngắn hạn cho Signed URL trong phiên làm việc (giảm số lần xin chữ ký lặp lại)
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function base64ToBlob(base64: string, mimeType: string): Blob {
    const cleanB64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const byteCharacters = atob(cleanB64);
    const byteArrays: Uint8Array<ArrayBuffer>[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const buffer = new ArrayBuffer(byteNumbers.length);
        const view = new Uint8Array(buffer);
        view.set(byteNumbers);
        byteArrays.push(view);
    }

    return new Blob(byteArrays, { type: mimeType });
}

/**
 * Kiểm tra tính sẵn sàng của các bảng tri thức & Private Storage Bucket trên Supabase
 */
export async function checkKnowledgeStorageHealth(): Promise<StorageHealthStatus> {
    let tablesReady = true;
    let bucketReady = true;
    let missingReason = '';

    try {
        const { error: docErr } = await supabase
            .from('knowledge_documents')
            .select('id')
            .limit(1);

        if (docErr && (docErr.code === 'PGRST205' || docErr.message?.includes('schema cache') || docErr.message?.includes('does not exist'))) {
            tablesReady = false;
            missingReason = 'Chưa khởi tạo bảng knowledge_documents / knowledge_chunks / ai_chat_sessions trên Supabase.';
        }

        const { error: sessionErr } = await supabase
            .from('ai_chat_sessions')
            .select('id')
            .limit(1);

        if (sessionErr && (sessionErr.code === 'PGRST205' || sessionErr.message?.includes('schema cache'))) {
            tablesReady = false;
            missingReason = missingReason || 'Chưa khởi tạo bảng ai_chat_sessions trên Supabase.';
        }
    } catch (err: any) {
        tablesReady = false;
        missingReason = err?.message || 'Lỗi kiểm tra kết nối Supabase';
    }

    try {
        const { error: listErr } = await supabase.storage
            .from(KNOWLEDGE_STORAGE_BUCKET)
            .list('', { limit: 1 });

        if (listErr) {
            const msg = (listErr.message || '').toLowerCase();
            if (msg.includes('not found') || msg.includes('bucket') || msg.includes('does not exist')) {
                bucketReady = false;
                missingReason = missingReason || `Chưa tạo Private Bucket "${KNOWLEDGE_STORAGE_BUCKET}" trên Supabase Storage.`;
            }
        }
    } catch {
        bucketReady = false;
    }

    return { tablesReady, bucketReady, missingReason };
}

/**
 * Nén ảnh chuẩn SalesHub (max 1600px, JPEG 0.82 ~ 250KB) và tải lên Private Bucket trên Supabase Storage
 */
export async function uploadKnowledgeImage(
    file: File,
    folderKey: string = 'docs'
): Promise<{ success: boolean; storagePath?: string; sizeKb?: number; error?: string }> {
    try {
        const prepared = await prepareImageForOcr(file, 1600, 0.82);
        const blob = base64ToBlob(prepared.data, prepared.mimeType || 'image/jpeg');
        const sizeKb = Math.round(blob.size / 1024);

        const safeExt = prepared.mimeType === 'image/png' ? 'png' : 'jpg';
        const randomId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const storagePath = `${folderKey}/${randomId}.${safeExt}`;

        const { error } = await supabase.storage
            .from(KNOWLEDGE_STORAGE_BUCKET)
            .upload(storagePath, blob, {
                contentType: prepared.mimeType || 'image/jpeg',
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            return {
                success: false,
                error: error.message || `Lỗi tải ảnh lên bucket ${KNOWLEDGE_STORAGE_BUCKET}`
            };
        }

        return { success: true, storagePath, sizeKb };
    } catch (err: any) {
        return {
            success: false,
            error: err?.message || 'Không thể nén và tải ảnh lên Supabase Storage'
        };
    }
}

/**
 * Tạo Signed URL ngắn hạn (60 phút) cho ảnh nằm trong Private Bucket sau khi đã lọc quyền trên DB
 */
export async function getSignedImageUrl(storagePath: string): Promise<string | null> {
    if (!storagePath) return null;
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
        return storagePath;
    }

    const now = Date.now();
    const cached = signedUrlCache.get(storagePath);
    if (cached && cached.expiresAt > now + 60_000) {
        return cached.url;
    }

    try {
        const { data, error } = await supabase.storage
            .from(KNOWLEDGE_STORAGE_BUCKET)
            .createSignedUrl(storagePath, 3600);

        if (error || !data?.signedUrl) {
            return null;
        }

        signedUrlCache.set(storagePath, {
            url: data.signedUrl,
            expiresAt: now + 3500_000
        });
        return data.signedUrl;
    } catch {
        return null;
    }
}

/**
 * Lấy hàng loạt Signed URL cho tối đa N ảnh
 */
export async function getSignedImageUrlsBatch(storagePaths: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const unique = Array.from(new Set(storagePaths.filter(Boolean)));
    if (unique.length === 0) return result;

    await Promise.all(
        unique.map(async (p) => {
            const url = await getSignedImageUrl(p);
            if (url) result[p] = url;
        })
    );

    return result;
}

/**
 * Xóa danh sách ảnh khỏi Supabase Storage khi Admin xóa tài liệu
 */
export async function deleteKnowledgeImages(storagePaths: string[]): Promise<void> {
    const clean = storagePaths.filter((p) => p && !p.startsWith('http'));
    if (clean.length === 0) return;

    try {
        await supabase.storage.from(KNOWLEDGE_STORAGE_BUCKET).remove(clean);
        clean.forEach((p) => signedUrlCache.delete(p));
    } catch (err) {
        console.warn('Không thể xóa một số ảnh khỏi Supabase Storage:', err);
    }
}

