import type { UserRole } from '../../../shared/contexts/AuthContext';

export type KnowledgeRoleToken = UserRole | 'ALL';

export type KnowledgeSourceType = 'TEXT' | 'MARKDOWN' | 'EXCEL' | 'DOCX' | 'PDF' | 'IMAGE';

export const KNOWLEDGE_STORAGE_BUCKET = 'knowledge-assets';

// Giới hạn lịch sử & chống quá tải DB/AI theo thiết kế đã chốt
export const MAX_CHAT_SESSIONS_PER_USER = 10;
export const MAX_MESSAGE_PAIRS_PER_SESSION = 20; // Tối đa 40 tin nhắn (20 cặp hỏi-đáp)/phiên
export const MAX_SESSION_AGE_DAYS = 30;
export const MAX_USER_INPUT_CHARS = 1000;
export const MAX_ATTACHMENT_IMAGES_PER_REPLY = 3;

export const KNOWLEDGE_CATEGORIES = [
    'Quy trình vận hành ST',
    'Chính sách thi đua & Thưởng',
    'Hướng dẫn sử dụng SalesHub',
    'Nghiệp vụ bán hàng & Voucher',
    'Nhân sự & Nội quy',
    'Tài liệu khác'
] as const;

export const ROLE_SCOPE_OPTIONS: Array<{
    value: KnowledgeRoleToken;
    label: string;
    shortLabel: string;
    badgeClass: string;
}> = [
    { value: 'ALL', label: 'Toàn hệ thống (Tất cả vai trò)', shortLabel: 'Toàn hệ thống', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { value: 'ADMIN', label: 'Quản trị viên (ADMIN)', shortLabel: 'ADMIN', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
    { value: 'QUAN_LY', label: 'Quản lý ST (QUAN_LY)', shortLabel: 'Quản lý', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { value: 'TRUONG_CA', label: 'Trưởng ca (TRUONG_CA)', shortLabel: 'Trưởng ca', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' },
    { value: 'NHAN_VIEN', label: 'Nhân viên (NHAN_VIEN)', shortLabel: 'Nhân viên', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' }
];

export interface KnowledgeDocument {
    id: string;
    title: string;
    category: string;
    source_type: KnowledgeSourceType;
    summary: string;
    raw_content: string;
    image_paths: string[];
    allowed_roles: string[];
    allowed_stores: string[];
    is_active: boolean;
    created_by: string;
    created_at?: string;
    updated_at?: string;
}

export interface KnowledgeChunk {
    id?: string;
    document_id: string;
    chunk_index: number;
    section_title: string;
    content: string;
    search_text: string;
    image_path?: string | null;
    allowed_roles: string[];
    allowed_stores: string[];
    // Trường bổ sung khi join hiển thị
    document_title?: string;
    category?: string;
    source_type?: KnowledgeSourceType;
    score?: number;
}

export interface ChatAttachmentImage {
    storagePath: string;
    signedUrl: string;
    caption: string;
    documentTitle: string;
}

export interface ChatSourceRef {
    documentId: string;
    documentTitle: string;
    sectionTitle: string;
    category?: string;
}

export interface ChatClarificationOption {
    label: string;
    query: string;
    documentId?: string;
    category?: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
    mode?: 'AI' | 'SEARCH';
    sources?: ChatSourceRef[];
    images?: ChatAttachmentImage[];
    fromCache?: boolean;
    modelUsed?: string;
    isError?: boolean;
    clarificationOptions?: ChatClarificationOption[];
    originalQuestion?: string;
}

export interface AiChatSession {
    id: string;
    employee_id: string;
    title: string;
    messages: ChatMessage[];
    message_count: number;
    created_at: string;
    updated_at: string;
}

export interface StorageHealthStatus {
    tablesReady: boolean;
    bucketReady: boolean;
    missingReason?: string;
}

