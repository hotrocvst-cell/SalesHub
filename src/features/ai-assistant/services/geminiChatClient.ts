import {
    getAvailableApiKeys,
    fetchAdminGeminiKeyCloud,
    maskApiKey
} from '../../data-update/services/geminiApiKeyService';

/**
 * Thử gọi qua Cloudflare Pages Function `/api/ai-chat` (nếu đã cấu hình GEMINI_API_KEYS trên Cloudflare)
 */
export async function callCloudflareProxyIfAvailable(payload: {
    contents: any[];
    systemInstruction: string;
    models: string[];
}): Promise<{ handled: boolean; text?: string; modelUsed?: string; error?: string }> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const res = await fetch('/api/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                ...payload,
                generationConfig: { temperature: 0.2, maxOutputTokens: 1600 }
            })
        });
        clearTimeout(timeoutId);

        if (res.status === 404 || res.status === 501) {
            return { handled: false };
        }

        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success && data?.text) {
            return { handled: true, text: data.text, modelUsed: data.modelUsed || 'cloudflare-edge' };
        }
        return { handled: true, error: data?.message || `Lỗi Proxy (${res.status})` };
    } catch {
        return { handled: false };
    }
}

/**
 * Gọi Gemini trực tiếp bằng Pool Key xoay vòng của SalesHub khi không qua Proxy
 */
export async function callGeminiDirectWithRotation(payload: {
    contents: any[];
    systemInstruction: string;
    models: string[];
}): Promise<{ text: string; modelUsed: string }> {
    await fetchAdminGeminiKeyCloud().catch(() => { });
    const keys = getAvailableApiKeys();
    if (keys.length === 0) {
        throw new Error('Hệ thống chưa cấu hình Gemini API Key. Quản trị viên vui lòng thiết lập key trong phần Cài đặt Gemini API.');
    }

    let lastError = 'Tất cả API Key hiện đang bận hoặc đạt giới hạn.';

    for (const apiKey of keys) {
        for (const model of payload.models) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        signal: controller.signal,
                        body: JSON.stringify({
                            system_instruction: { parts: [{ text: payload.systemInstruction }] },
                            contents: payload.contents,
                            generationConfig: { temperature: 0.2, maxOutputTokens: 1600 }
                        })
                    }
                );
                clearTimeout(timeoutId);

                if (res.status === 429) {
                    lastError = `Key [${maskApiKey(apiKey)}] tạm chạm ngưỡng giới hạn phút (429). Đang thử key dự phòng...`;
                    break;
                }

                if (res.ok) {
                    const json = await res.json();
                    const text =
                        json?.candidates?.[0]?.content?.parts
                            ?.map((p: any) => p?.text || '')
                            .join('')
                            .trim() || '';
                    if (text) {
                        localStorage.setItem('SALESHUB_ACTIVE_GEMINI_MODEL', model);
                        return { text, modelUsed: model };
                    }
                }

                const errData = await res.json().catch(() => ({}));
                lastError = errData?.error?.message || `HTTP ${res.status}`;
                if (res.status === 404 || res.status === 503) continue;
            } catch (err: any) {
                lastError = err?.name === 'AbortError' ? 'AI phản hồi quá lâu (timeout 30s).' : (err?.message || 'Lỗi mạng');
            }
        }
    }

    throw new Error(lastError);
}

