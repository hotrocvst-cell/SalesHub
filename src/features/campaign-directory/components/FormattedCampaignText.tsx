import React from 'react';

interface Props {
    text?: string;
    className?: string;
    fallback?: string;
}

/**
 * Định nghĩa bảng màu được hỗ trợ
 */
const COLOR_CLASSES: Record<string, string> = {
    red: 'text-rose-600 font-bold',
    do: 'text-rose-600 font-bold',
    rose: 'text-pink-600 font-bold',
    blue: 'text-blue-600 font-bold',
    xanh: 'text-blue-600 font-bold',
    green: 'text-emerald-600 font-bold',
    luc: 'text-emerald-600 font-bold',
    amber: 'text-amber-600 font-bold',
    gold: 'text-amber-600 font-bold',
    vang: 'text-amber-600 font-bold',
    orange: 'text-orange-600 font-bold',
    purple: 'text-purple-600 font-bold',
    tim: 'text-purple-600 font-bold',
    cyan: 'text-cyan-700 font-bold',
    gray: 'text-slate-500 font-medium'
};

/**
 * Parse an inline string containing formatting tags into React nodes
 */
function parseInlineFormattedText(input: string): React.ReactNode {
    if (!input) return null;

    // Pattern matches:
    // 1. [color=val]...[/color]
    // 2. [(red|blue|green|amber|gold|vang|orange|purple|tim|rose|cyan|gray|hl|highlight|badge)]...[/...]
    // 3. **bold** or <b>bold</b> or <strong>bold</strong>
    // 4. *italic* or <i>italic</i> or <em>italic</em>
    const tokenRegex = /(\[color=([#a-zA-Z0-9]+)\]([\s\S]*?)\[\/color\])|(\[(red|blue|green|amber|gold|vang|orange|purple|tim|rose|cyan|gray|hl|highlight|badge)\]([\s\S]*?)\[\/\5\])|(\*\*(.*?)\*\*)|(<b>(.*?)<\/b>)|(<strong>(.*?)<\/strong>)|(\*(.*?)\*)|(<i>(.*?)<\/i>)|(<em>(.*?)<\/em>)/i;

    const parts: React.ReactNode[] = [];
    let remaining = input;
    let keyIdx = 0;

    while (remaining.length > 0) {
        const match = remaining.match(tokenRegex);
        if (!match || match.index === undefined) {
            parts.push(remaining);
            break;
        }

        const matchIndex = match.index;
        if (matchIndex > 0) {
            parts.push(remaining.substring(0, matchIndex));
        }

        const fullMatch = match[0];

        // 1. [color=XYZ]...[/color]
        if (match[1]) {
            const colorVal = match[2].toLowerCase();
            const innerText = match[3];
            const cls = COLOR_CLASSES[colorVal];
            if (cls) {
                parts.push(
                    <span key={`col-${keyIdx++}`} className={cls}>
                        {parseInlineFormattedText(innerText)}
                    </span>
                );
            } else if (colorVal.startsWith('#')) {
                parts.push(
                    <span key={`col-${keyIdx++}`} style={{ color: colorVal }} className="font-bold">
                        {parseInlineFormattedText(innerText)}
                    </span>
                );
            } else {
                parts.push(
                    <span key={`col-${keyIdx++}`} style={{ color: colorVal }} className="font-bold">
                        {parseInlineFormattedText(innerText)}
                    </span>
                );
            }
        }
        // 2. Named color tag: [red]...[/red], [hl]...[/hl], [badge]...[/badge]
        else if (match[4]) {
            const tagName = match[5].toLowerCase();
            const innerText = match[6];
            if (tagName === 'hl' || tagName === 'highlight') {
                parts.push(
                    <mark key={`hl-${keyIdx++}`} className="bg-amber-100 text-amber-950 px-1 py-0.5 rounded-sm font-bold border border-amber-200">
                        {parseInlineFormattedText(innerText)}
                    </mark>
                );
            } else if (tagName === 'badge') {
                parts.push(
                    <span key={`bg-${keyIdx++}`} className="inline-block px-1.5 py-0.5 rounded-md text-[10.5px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-200">
                        {parseInlineFormattedText(innerText)}
                    </span>
                );
            } else {
                const cls = COLOR_CLASSES[tagName] || 'font-bold';
                parts.push(
                    <span key={`tag-${keyIdx++}`} className={cls}>
                        {parseInlineFormattedText(innerText)}
                    </span>
                );
            }
        }
        // 3. **bold** or <b>bold</b> or <strong>bold</strong>
        else if (match[7] || match[9] || match[11]) {
            const innerText = match[8] || match[10] || match[12] || '';
            parts.push(
                <strong key={`b-${keyIdx++}`} className="font-black text-slate-900">
                    {parseInlineFormattedText(innerText)}
                </strong>
            );
        }
        // 4. *italic* or <i>italic</i> or <em>italic</em>
        else if (match[13] || match[15] || match[17]) {
            const innerText = match[14] || match[16] || match[18] || '';
            parts.push(
                <em key={`i-${keyIdx++}`} className="italic font-medium">
                    {parseInlineFormattedText(innerText)}
                </em>
            );
        }

        remaining = remaining.substring(matchIndex + fullMatch.length);
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export default function FormattedCampaignText({
    text = '',
    className = '',
    fallback = '—'
}: Props) {
    if (!text || !text.trim()) {
        return <span className={`text-slate-400 italic ${className}`}>{fallback}</span>;
    }

    // Tách theo xuống hàng (\r\n hoặc \n hoặc <br>)
    const normalized = text.replace(/<br\s*\/?>/gi, '\n');
    const rawLines = normalized.split(/\r?\n/);

    return (
        <div className={`space-y-1 font-avo leading-relaxed ${className}`}>
            {rawLines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) {
                    return <div key={idx} className="h-1.5" />;
                }

                // Nhận diện gạch đầu dòng danh sách: - , • , * (có khoảng trắng), hoặc số 1.
                const bulletMatch = trimmed.match(/^([-•+]|\d+\.)\s+(.+)$/);
                if (bulletMatch) {
                    const bulletSymbol = bulletMatch[1];
                    const bulletContent = bulletMatch[2];
                    return (
                        <div key={idx} className="flex items-start gap-1.5 pl-1.5">
                            <span className="text-blue-600 font-bold select-none shrink-0 text-xs mt-0.5">
                                {bulletSymbol === '-' || bulletSymbol === '+' ? '•' : bulletSymbol}
                            </span>
                            <div className="flex-1">
                                {parseInlineFormattedText(bulletContent)}
                            </div>
                        </div>
                    );
                }

                return (
                    <div key={idx}>
                        {parseInlineFormattedText(line)}
                    </div>
                );
            })}
        </div>
    );
}
