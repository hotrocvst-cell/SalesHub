import { removeVietnameseTones } from './markdownChunker';
import type { KnowledgeChunk } from '../types/aiAssistantTypes';

const VN_STOPWORDS = new Set([
    'la', 'gi', 'cua', 'cho', 'nhu', 'the', 'nao', 'co', 'duoc', 'khong', 'ko',
    've', 'trong', 'khi', 'ma', 'va', 'hoac', 'hay', 'thi', 'voi', 'tai', 'o',
    'tu', 'den', 'bao', 'nhieu', 'sao', 'vi', 'ban', 'toi', 'em', 'anh', 'chi',
    'hoi', 'xin', 'vui', 'long', 'cach', 'huong', 'dan', 'quy', 'dinh', 'tai sao'
]);

const MULTI_TOPIC_CUES = [' va ', ' voi ', ' so sanh ', ' khac nhau ', ' hay ', ' hoac ', ' tat ca ', ' cac loai '];

export interface ScoredKnowledgeChunk extends KnowledgeChunk {
    score: number;
    keywordCoverage: number;
    titleExactMatch: boolean;
}

export function extractSearchKeywords(query: string): string[] {
    const clean = removeVietnameseTones(query).replace(/[^a-z0-9\s%]/g, ' ');
    const tokens = clean.split(/\s+/).filter((t) => t.length >= 2 && !VN_STOPWORDS.has(t));
    if (tokens.length > 0) return Array.from(new Set(tokens)).slice(0, 8);
    return Array.from(new Set(clean.split(/\s+/).filter((t) => t.length >= 2))).slice(0, 6);
}

function buildBigrams(tokens: string[]): string[] {
    const bigrams: string[] = [];
    for (let i = 0; i < tokens.length - 1; i++) {
        bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
    }
    return bigrams;
}

function tokenizeWords(normalizedText: string): Set<string> {
    return new Set(normalizedText.split(/[^a-z0-9%]+/).filter(Boolean));
}

/**
 * Chấm điểm chính xác từng phân đoạn dựa trên:
 * 1. Khớp cụm từ nguyên vẹn trong Tiêu đề / Nội dung
 * 2. Tỷ lệ bao phủ từ khóa nguyên từ (Whole-word coverage)
 * 3. Khớp cặp từ liên tiếp (Bigrams tiếng Việt: "noi com", "loc nuoc"...)
 */
export function scoreAndFilterKnowledgeChunks(
    rawRows: any[],
    query: string,
    keywords: string[],
    limit: number
): ScoredKnowledgeChunk[] {
    const normalizedQuery = removeVietnameseTones(query);
    const bigrams = buildBigrams(keywords);
    const isMultiTopicQuery = MULTI_TOPIC_CUES.some((cue) => ` ${normalizedQuery} `.includes(cue));

    const scored: ScoredKnowledgeChunk[] = rawRows.map((row) => {
        const docInfo = row.knowledge_documents || {};
        const docTitleNorm = removeVietnameseTones(docInfo.title || '');
        const sectionNorm = removeVietnameseTones(row.section_title || '');
        const searchTxt: string = row.search_text || removeVietnameseTones(`${docTitleNorm} ${row.content || ''}`);

        const bodyWords = tokenizeWords(searchTxt);
        const titleWords = tokenizeWords(docTitleNorm);

        let matchedKeywords = 0;
        let titleMatchedKeywords = 0;
        let score = 0;

        keywords.forEach((kw) => {
            const inTitle = titleWords.has(kw) || docTitleNorm.includes(kw);
            const inBody = bodyWords.has(kw);

            if (inTitle || inBody) matchedKeywords++;
            if (inTitle) titleMatchedKeywords++;

            if (titleWords.has(kw)) score += 12;
            else if (docTitleNorm.includes(kw)) score += 7;

            if (bodyWords.has(kw)) score += 6;
            else if (searchTxt.includes(kw)) score += 2;

            if (sectionNorm.includes(kw)) score += 4;
        });

        bigrams.forEach((bg) => {
            if (docTitleNorm.includes(bg)) score += 22;
            if (searchTxt.includes(bg)) score += 12;
        });

        const titleFullKeywords = keywords.length > 0 && titleMatchedKeywords === keywords.length;
        const titlePhraseHit = normalizedQuery.length >= 4 && docTitleNorm.includes(normalizedQuery);
        const titleExactMatch = titlePhraseHit || titleFullKeywords;

        if (titlePhraseHit) score += 45;
        if (titleFullKeywords) score += 30;
        if (normalizedQuery.length >= 4 && searchTxt.includes(normalizedQuery)) score += 25;

        const keywordCoverage = keywords.length > 0 ? matchedKeywords / keywords.length : 1;
        // Thưởng lớn theo độ phủ từ khóa để tài liệu khớp đủ chữ luôn vượt xa tài liệu chỉ ăn ké 1 chữ (vd: "qr")
        score += Math.round(keywordCoverage * 35);

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
            score,
            keywordCoverage,
            titleExactMatch
        };
    });

    const positive = scored.filter((c) => c.score > 0);
    if (positive.length === 0) return [];

    positive.sort((a, b) => b.score - a.score);
    const topScore = positive[0].score;
    const maxCoverage = Math.max(...positive.map((c) => c.keywordCoverage));
    const hasTitleExactMatch = positive.some((c) => c.titleExactMatch);

    // Bộ lọc loại bỏ nhiễu: chỉ giữ các đoạn khớp đủ chặt với trọng tâm câu hỏi
    const minRequiredCoverage = maxCoverage >= 0.99 ? 0.66 : Math.max(0.4, maxCoverage - 0.3);
    const minRequiredScore = topScore * 0.55;

    let filtered = positive.filter((c) => c.keywordCoverage >= minRequiredCoverage && c.score >= minRequiredScore);

    // Nếu câu hỏi chỉ nhắm tới 1 đối tượng cụ thể và có tài liệu khớp chính xác 100% tiêu đề -> cô lập tài liệu đó
    if (hasTitleExactMatch && !isMultiTopicQuery) {
        const exactTitleChunks = filtered.filter((c) => c.titleExactMatch);
        if (exactTitleChunks.length > 0) {
            filtered = exactTitleChunks;
        }
    }

    return filtered.slice(0, limit);
}

