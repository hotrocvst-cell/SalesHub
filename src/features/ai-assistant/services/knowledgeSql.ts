import { KNOWLEDGE_STORAGE_BUCKET } from '../types/aiAssistantTypes';

export const AI_ASSISTANT_DDL_SQL = `-- ============================================================================
-- SALESHUB: TRỢ LÝ AI & KHO TRI THỨC ĐA NGUỒN (SUPABASE CLOUD + STORAGE)
-- Hỗ trợ phân quyền 4 cấp (ADMIN / QUAN_LY / TRUONG_CA / NHAN_VIEN / ALL)
-- ============================================================================

-- 1. BẢNG QUẢN LÝ TÀI LIỆU GỐC (KNOWLEDGE DOCUMENTS)
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Tài liệu khác',
    source_type TEXT NOT NULL DEFAULT 'TEXT',        -- TEXT | MARKDOWN | EXCEL | DOCX | PDF | IMAGE
    summary TEXT DEFAULT '',
    raw_content TEXT NOT NULL,
    image_paths TEXT[] DEFAULT '{}'::TEXT[],         -- Đường dẫn ảnh gốc trong Private Bucket
    allowed_roles TEXT[] NOT NULL DEFAULT '{ALL}'::TEXT[],
    allowed_stores TEXT[] NOT NULL DEFAULT '{ALL}'::TEXT[],
    valid_until DATE NOT NULL DEFAULT '2030-12-31',  -- Thời hạn áp dụng (Mặc định 31/12/2030)
    view_count INTEGER NOT NULL DEFAULT 0,           -- Lượt tra cứu tích lũy toàn thời gian
    last_viewed_at TIMESTAMPTZ DEFAULT NULL,         -- Lần tra cứu gần nhất
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT DEFAULT 'ADMIN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CẬP NHẬT AN TOÀN CHO HỆ THỐNG ĐÃ TỒN TẠI BẢNG TRƯỚC ĐÓ:
ALTER TABLE public.knowledge_documents
    ADD COLUMN IF NOT EXISTS valid_until DATE NOT NULL DEFAULT '2030-12-31',
    ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ DEFAULT NULL;

-- 2. BẢNG THỐNG KÊ LƯỢT TRA CỨU THEO NGÀY SIÊU NHẸ (KNOWLEDGE DAILY STATS)
-- Mục đích: Đếm top tài liệu hot theo tuần (Thứ Hai -> CN), theo tháng, không làm phình DB
CREATE TABLE IF NOT EXISTS public.knowledge_daily_stats (
    document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
    view_date DATE NOT NULL DEFAULT CURRENT_DATE,
    view_count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (document_id, view_date)
);

-- 3. BẢNG PHÂN ĐOẠN TRI THỨC PHỤC VỤ RAG & TÌM KIẾM NHANH (KNOWLEDGE CHUNKS)
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    section_title TEXT DEFAULT '',
    content TEXT NOT NULL,
    search_text TEXT NOT NULL,                       -- Văn bản chuẩn hóa không dấu để tìm kiếm siêu tốc
    image_path TEXT DEFAULT NULL,
    allowed_roles TEXT[] NOT NULL DEFAULT '{ALL}'::TEXT[],
    allowed_stores TEXT[] NOT NULL DEFAULT '{ALL}'::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. BẢNG CACHE CÂU HỎI THƯỜNG GẶP (GIẢM TẢI GEMINI KHI 50-70 USER CÙNG HỎI)
CREATE TABLE IF NOT EXISTS public.knowledge_faq_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_hash TEXT NOT NULL,
    normalized_question TEXT NOT NULL,
    allowed_roles TEXT[] NOT NULL DEFAULT '{ALL}'::TEXT[],
    allowed_stores TEXT[] NOT NULL DEFAULT '{ALL}'::TEXT[],
    answer_text TEXT NOT NULL,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    image_paths TEXT[] DEFAULT '{}'::TEXT[],
    hit_count INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (question_hash, allowed_roles, allowed_stores)
);

-- 5. BẢNG LỊCH SỬ CHAT CÓ GIỚI HẠN THEO TÀI KHOẢN (AI CHAT SESSIONS)
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Cuộc trò chuyện mới',
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. CHỈ MỤC TĂNG TỐC TÌM KIẾM & LỌC PHÂN QUYỀN
CREATE INDEX IF NOT EXISTS idx_kdocs_roles ON public.knowledge_documents USING GIN (allowed_roles);
CREATE INDEX IF NOT EXISTS idx_kdocs_stores ON public.knowledge_documents USING GIN (allowed_stores);
CREATE INDEX IF NOT EXISTS idx_kdocs_active ON public.knowledge_documents (is_active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_kdocs_validity ON public.knowledge_documents (is_active, valid_until, view_count DESC);
CREATE INDEX IF NOT EXISTS idx_kdaily_date ON public.knowledge_daily_stats (view_date DESC);

CREATE INDEX IF NOT EXISTS idx_kchunks_doc_id ON public.knowledge_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_kchunks_roles ON public.knowledge_chunks USING GIN (allowed_roles);
CREATE INDEX IF NOT EXISTS idx_kchunks_stores ON public.knowledge_chunks USING GIN (allowed_stores);
CREATE INDEX IF NOT EXISTS idx_kchunks_fts ON public.knowledge_chunks USING GIN (to_tsvector('simple', search_text));

CREATE INDEX IF NOT EXISTS idx_kfaq_hash ON public.knowledge_faq_cache (question_hash);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_emp ON public.ai_chat_sessions (employee_id, updated_at DESC);

-- 7. KÍCH HOẠT ROW LEVEL SECURITY (RLS)
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_faq_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read/write knowledge_documents" ON public.knowledge_documents;
CREATE POLICY "Allow read/write knowledge_documents" ON public.knowledge_documents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read/write knowledge_daily_stats" ON public.knowledge_daily_stats;
CREATE POLICY "Allow read/write knowledge_daily_stats" ON public.knowledge_daily_stats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read/write knowledge_chunks" ON public.knowledge_chunks;
CREATE POLICY "Allow read/write knowledge_chunks" ON public.knowledge_chunks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read/write knowledge_faq_cache" ON public.knowledge_faq_cache;
CREATE POLICY "Allow read/write knowledge_faq_cache" ON public.knowledge_faq_cache FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read/write ai_chat_sessions" ON public.ai_chat_sessions;
CREATE POLICY "Allow read/write ai_chat_sessions" ON public.ai_chat_sessions FOR ALL USING (true) WITH CHECK (true);

-- 7. KHỞI TẠO PRIVATE STORAGE BUCKET CHO HÌNH ẢNH TÀI LIỆU GỐC (${KNOWLEDGE_STORAGE_BUCKET})
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    '${KNOWLEDGE_STORAGE_BUCKET}',
    '${KNOWLEDGE_STORAGE_BUCKET}',
    false,                 -- Private Bucket: Chỉ truy cập qua Signed URL có kiểm tra phân quyền
    10485760,              -- Giới hạn tối đa 10MB/file
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage Policies cho phép Client SalesHub upload và tạo Signed URL hợp lệ trong Bucket
DROP POLICY IF EXISTS "SalesHub knowledge bucket select" ON storage.objects;
CREATE POLICY "SalesHub knowledge bucket select" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = '${KNOWLEDGE_STORAGE_BUCKET}');

DROP POLICY IF EXISTS "SalesHub knowledge bucket insert" ON storage.objects;
CREATE POLICY "SalesHub knowledge bucket insert" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = '${KNOWLEDGE_STORAGE_BUCKET}');

DROP POLICY IF EXISTS "SalesHub knowledge bucket update" ON storage.objects;
CREATE POLICY "SalesHub knowledge bucket update" ON storage.objects
    FOR UPDATE TO anon, authenticated
    USING (bucket_id = '${KNOWLEDGE_STORAGE_BUCKET}');

DROP POLICY IF EXISTS "SalesHub knowledge bucket delete" ON storage.objects;
CREATE POLICY "SalesHub knowledge bucket delete" ON storage.objects
    FOR DELETE TO anon, authenticated
    USING (bucket_id = '${KNOWLEDGE_STORAGE_BUCKET}');
`;

