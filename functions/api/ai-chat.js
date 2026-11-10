/**
 * Cloudflare Pages Function: Proxy gọi Google Gemini API an toàn phía server.
 * - Đọc biến môi trường `GEMINI_API_KEYS` (nhiều key cách nhau bởi dấu phẩy hoặc xuống dòng)
 *   hoặc `GEMINI_API_KEY` cấu hình trong Cloudflare Pages Settings -> Environment variables.
 * - Nếu chưa cấu hình env var trên Cloudflare, trả về HTTP 501 để frontend chủ động fallback
 *   sang cơ chế xoay vòng Key của hệ thống SalesHub.
 */

const DEFAULT_MODELS = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.8-flash'
];

function parseKeys(raw) {
    if (!raw || typeof raw !== 'string') return [];
    return raw
        .split(/[\r\n,;]+/)
        .map((k) => k.trim())
        .filter((k) => k.length >= 20);
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const keys = parseKeys(env?.GEMINI_API_KEYS || env?.GEMINI_API_KEY || '');

    if (keys.length === 0) {
        return new Response(
            JSON.stringify({
                success: false,
                code: 'PROXY_NOT_CONFIGURED',
                message: 'Chưa cấu hình GEMINI_API_KEYS trên Cloudflare Pages Environment Variables.'
            }),
            {
                status: 501,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return new Response(JSON.stringify({ success: false, message: 'Payload JSON không hợp lệ' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const contents = payload?.contents;
    const systemInstruction = payload?.systemInstruction;
    const generationConfig = payload?.generationConfig || { temperature: 0.2, maxOutputTokens: 1500 };
    const models = Array.isArray(payload?.models) && payload.models.length > 0 ? payload.models : DEFAULT_MODELS;

    if (!Array.isArray(contents) || contents.length === 0) {
        return new Response(JSON.stringify({ success: false, message: 'Thiếu nội dung câu hỏi' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    let lastError = 'Không thể kết nối Gemini API';

    for (const apiKey of keys) {
        for (const model of models) {
            try {
                const body = { contents, generationConfig };
                if (systemInstruction) {
                    body.system_instruction = { parts: [{ text: systemInstruction }] };
                }

                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    }
                );

                if (res.status === 429) {
                    lastError = 'Đạt giới hạn RPM/RPD tạm thời (429)';
                    break; // Chuyển sang API Key dự phòng tiếp theo
                }

                if (res.ok) {
                    const data = await res.json();
                    const text =
                        data?.candidates?.[0]?.content?.parts
                            ?.map((p) => p?.text || '')
                            .join('')
                            .trim() || '';
                    return new Response(JSON.stringify({ success: true, text, modelUsed: model }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                const errData = await res.json().catch(() => ({}));
                lastError = errData?.error?.message || `HTTP ${res.status}`;

                if (res.status === 404 || res.status === 503) {
                    continue; // Thử model kế tiếp
                }
            } catch (err) {
                lastError = err?.message || 'Lỗi kết nối mạng Cloudflare Edge';
            }
        }
    }

    return new Response(
        JSON.stringify({
            success: false,
            code: 'GEMINI_UPSTREAM_FAILED',
            message: lastError
        }),
        {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
        }
    );
}

