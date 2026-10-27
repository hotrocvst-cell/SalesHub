import { supabase } from '../../../core/lib/supabase';
import type { SupportTicket, TicketComment, TicketStatus, TicketCategory, TicketPriority } from '../types';

const TICKETS_STORAGE_KEY = 'saleshub_support_tickets_v1';
const COMMENTS_STORAGE_KEY = 'saleshub_support_comments_v1';

export const SUPPORT_TICKETS_DDL_SQL = `-- 1. BẢNG QUẢN LÝ PHIẾU HỖ TRỢ & GÓP Ý
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_code TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'huong_dan',
    priority TEXT NOT NULL DEFAULT 'trung_binh',
    status TEXT NOT NULL DEFAULT 'open',
    content TEXT NOT NULL,
    creator_id TEXT NOT NULL,
    creator_name TEXT NOT NULL,
    creator_role TEXT NOT NULL DEFAULT 'NHAN_VIEN',
    creator_store TEXT NOT NULL DEFAULT '',
    assigned_to TEXT DEFAULT '',
    is_starred BOOLEAN DEFAULT false,
    is_anonymous BOOLEAN DEFAULT false,
    rating INTEGER DEFAULT NULL,
    rating_comment TEXT DEFAULT NULL,
    rated_at TIMESTAMPTZ DEFAULT NULL,
    closed_by TEXT DEFAULT NULL,
    closed_at TIMESTAMPTZ DEFAULT NULL,
    resolution_note TEXT DEFAULT NULL,
    comment_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. BẢNG BÌNH LUẬN & TRAO ĐỔI THEO PHIẾU
CREATE TABLE IF NOT EXISTS public.support_ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL DEFAULT 'NHAN_VIEN',
    author_store TEXT DEFAULT '',
    content TEXT NOT NULL,
    is_admin_reply BOOLEAN DEFAULT false,
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Bổ sung cột is_anonymous nếu bảng đã được tạo trước đó
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;
ALTER TABLE public.support_ticket_comments ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;

-- 3. KÍCH HOẠT ROW LEVEL SECURITY (RLS)
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_comments ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES CHO PHÉP TRUY CẬP VÀ QUẢN LÝ
DROP POLICY IF EXISTS "Public view support_tickets" ON public.support_tickets;
CREATE POLICY "Public view support_tickets" ON public.support_tickets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all manage support_tickets" ON public.support_tickets;
CREATE POLICY "Allow all manage support_tickets" ON public.support_tickets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public view support_ticket_comments" ON public.support_ticket_comments;
CREATE POLICY "Public view support_ticket_comments" ON public.support_ticket_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all manage support_ticket_comments" ON public.support_ticket_comments;
CREATE POLICY "Allow all manage support_ticket_comments" ON public.support_ticket_comments FOR ALL USING (true) WITH CHECK (true);

-- 5. CHỈ MỤC TĂNG TỐC TÌM KIẾM
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_creator ON public.support_tickets(creator_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_store ON public.support_tickets(creator_store);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_starred ON public.support_tickets(is_starred);
CREATE INDEX IF NOT EXISTS idx_support_ticket_comments_tid ON public.support_ticket_comments(ticket_id);
`;

export const INITIAL_SEED_TICKETS: SupportTicket[] = [
    {
        id: 'seed-tk-001',
        ticket_code: 'TK-1001',
        title: 'Hướng dẫn cách xem tỷ lệ hoàn thành thi đua nhóm ngành Gia dụng',
        category: 'huong_dan',
        priority: 'trung_binh',
        status: 'resolved',
        content: 'Cho em hỏi cách tra cứu chi tiết tiến độ thi đua nhóm máy giặt và tủ lạnh trong ngày ạ? Em vào mục Báo cáo ngày nhưng chưa thấy tách riêng.',
        creator_id: '124890',
        creator_name: 'Nguyễn Văn Minh',
        creator_role: 'NHAN_VIEN',
        creator_store: 'TGD_BRV_VTA - 290 Trương Công Định',
        is_starred: false,
        rating: 5,
        rating_comment: 'Admin hướng dẫn rất tận tình và nhanh chóng, em đã xem được rồi ạ!',
        rated_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        closed_by: 'Admin Hệ Thống',
        closed_at: new Date(Date.now() - 3600000 * 25).toISOString(),
        resolution_note: 'Đã hướng dẫn vào phân hệ "Tiến độ thi đua" và chọn bộ lọc nhóm "Gia dụng".',
        comment_count: 2,
        created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 24).toISOString()
    },
    {
        id: 'seed-tk-002',
        ticket_code: 'TK-1002',
        title: 'Góp ý giao diện mobile: Các cột bảng lũy kế nhân viên xem trên điện thoại hơi rộng',
        category: 'gop_y_giao_dien',
        priority: 'cao',
        status: 'in_progress',
        content: 'Khi em mở bảng xếp hạng doanh thu trên điện thoại iPhone thì phải cuộn ngang một chút mới thấy hết cột trả chậm. Nhờ Admin tối ưu co gọn thêm độ rộng các cột giúp tụi em nhé.',
        creator_id: '135792',
        creator_name: 'Trần Thị Thu Thảo',
        creator_role: 'TRUONG_CA',
        creator_store: 'AAR_BRV_VTA - 290 Trương Công Định',
        is_starred: true,
        comment_count: 3,
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
        id: 'seed-tk-003',
        ticket_code: 'TK-1003',
        title: 'Đề xuất thêm tính năng gửi tin nhắn nhắc nhở tự động trước khi chốt ca',
        category: 'tinh_nang_moi',
        priority: 'trung_binh',
        status: 'open',
        content: 'Đề xuất hệ thống có thể gửi thông báo hoặc pop-up cảnh báo trước 30 phút khi hết ca để các bạn nhân viên kiểm tra lại số liệu n-1 đã cập nhật đầy đủ chưa ạ.',
        creator_id: '119834',
        creator_name: 'Lê Hoàng Long',
        creator_role: 'QUAN_LY',
        creator_store: 'TGD_BRV_VTA - 290 Trương Công Định',
        is_starred: true,
        is_anonymous: true,
        comment_count: 1,
        created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 6).toISOString()
    },
    {
        id: 'seed-tk-004',
        ticket_code: 'TK-1004',
        title: 'Báo lỗi: Nút xuất ảnh báo cáo bị đơ nhẹ khi danh sách có hơn 30 nhân viên',
        category: 'bao_loi',
        priority: 'khan_cap',
        status: 'open',
        content: 'Em bấm Lưu ảnh báo cáo trong trang Báo cáo hiệu quả nhân viên thì vòng xoay load hơi lâu, khoảng 4 giây mới tải xong ảnh. Nhờ admin kiểm tra tối ưu canvas giúp em.',
        creator_id: '142678',
        creator_name: 'Phạm Hồng Quân',
        creator_role: 'NHAN_VIEN',
        creator_store: 'TGD_BRV_VTA - 290 Trương Công Định',
        is_starred: false,
        comment_count: 0,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
    }
];

export const INITIAL_SEED_COMMENTS: Record<string, TicketComment[]> = {
    'seed-tk-001': [
        {
            id: 'cmt-1',
            ticket_id: 'seed-tk-001',
            author_id: 'ADMIN_01',
            author_name: 'Admin Hệ Thống',
            author_role: 'ADMIN',
            author_store: 'Văn phòng',
            content: 'Chào Minh, bạn vào phân hệ "Tiến độ thi đua" trên thanh menu bên trái, sau đó ở thanh bộ lọc chọn Ngành hàng là "Gia dụng", hệ thống sẽ hiển thị riêng toàn bộ tiến độ Máy giặt & Tủ lạnh nhé!',
            is_admin_reply: true,
            created_at: new Date(Date.now() - 3600000 * 30).toISOString()
        },
        {
            id: 'cmt-2',
            ticket_id: 'seed-tk-001',
            author_id: '124890',
            author_name: 'Nguyễn Văn Minh',
            author_role: 'NHAN_VIEN',
            author_store: 'TGD_BRV_VTA - 290 Trương Công Định',
            content: 'Dạ em xem được rồi ạ, cảm ơn Admin nhiều!',
            is_admin_reply: false,
            created_at: new Date(Date.now() - 3600000 * 26).toISOString()
        }
    ],
    'seed-tk-002': [
        {
            id: 'cmt-3',
            ticket_id: 'seed-tk-002',
            author_id: 'ADMIN_01',
            author_name: 'Admin Hệ Thống',
            author_role: 'ADMIN',
            author_store: 'Văn phòng',
            content: 'Cảm ơn bạn Thảo đã phản hồi. Bên mình đã tiếp nhận và đang tiến hành co gọn padding các ô từ px-3 xuống px-1.5 và rút gọn tên cột. Bản cập nhật sẽ hoàn tất trong hôm nay nhé!',
            is_admin_reply: true,
            created_at: new Date(Date.now() - 3600000 * 8).toISOString()
        },
        {
            id: 'cmt-4',
            ticket_id: 'seed-tk-002',
            author_id: '135792',
            author_name: 'Trần Thị Thu Thảo',
            author_role: 'TRUONG_CA',
            author_store: 'AAR_BRV_VTA - 290 Trương Công Định',
            content: 'Tuyệt vời quá Admin ơi, chúc team ra mắt phiên bản mới mượt mà!',
            is_admin_reply: false,
            created_at: new Date(Date.now() - 3600000 * 5).toISOString()
        }
    ],
    'seed-tk-003': [
        {
            id: 'cmt-5',
            ticket_id: 'seed-tk-003',
            author_id: 'ADMIN_01',
            author_name: 'Admin Hệ Thống',
            author_role: 'ADMIN',
            author_store: 'Văn phòng',
            content: 'Ý tưởng rất hay ạ anh Long. Đội ngũ kỹ thuật sẽ đưa tính năng này vào lộ trình sprint tới.',
            is_admin_reply: true,
            created_at: new Date(Date.now() - 3600000 * 4).toISOString()
        }
    ]
};

export async function checkSupportTicketTablesReady(): Promise<{ exists: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('support_tickets').select('id').limit(1);
        if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('not find')) {
                return { exists: false, error: 'Chưa tạo bảng support_tickets trên Supabase' };
            }
            return { exists: false, error: error.message };
        }
        return { exists: true };
    } catch (e: any) {
        return { exists: false, error: e?.message || 'Không thể kết nối Supabase' };
    }
}

export function getLocalTickets(): SupportTicket[] {
    try {
        const raw = localStorage.getItem(TICKETS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (e) {
        console.warn('Lỗi đọc local tickets:', e);
    }
    return INITIAL_SEED_TICKETS;
}

export function saveLocalTickets(tickets: SupportTicket[]) {
    try {
        localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
    } catch (e) {
        console.warn('Lỗi lưu local tickets:', e);
    }
}

export function getLocalComments(ticketId: string): TicketComment[] {
    try {
        const raw = localStorage.getItem(`${COMMENTS_STORAGE_KEY}_${ticketId}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        console.warn('Lỗi đọc local comments:', e);
    }
    return INITIAL_SEED_COMMENTS[ticketId] || [];
}

export function saveLocalComments(ticketId: string, comments: TicketComment[]) {
    try {
        localStorage.setItem(`${COMMENTS_STORAGE_KEY}_${ticketId}`, JSON.stringify(comments));
    } catch (e) {
        console.warn('Lỗi lưu local comments:', e);
    }
}

export async function fetchSupportTickets(): Promise<{ data: SupportTicket[]; source: 'cloud' | 'local' }> {
    try {
        const { data, error } = await supabase
            .from('support_tickets')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            saveLocalTickets(data as SupportTicket[]);
            return { data: data as SupportTicket[], source: 'cloud' };
        }
    } catch (e) {
        console.warn('Lỗi fetch tickets từ Cloud, dùng local cache:', e);
    }
    return { data: getLocalTickets(), source: 'local' };
}

export async function fetchTicketComments(ticketId: string): Promise<TicketComment[]> {
    try {
        const { data, error } = await supabase
            .from('support_ticket_comments')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        if (!error && data) {
            saveLocalComments(ticketId, data as TicketComment[]);
            return data as TicketComment[];
        }
    } catch (e) {
        console.warn('Lỗi fetch comments từ Cloud:', e);
    }
    return getLocalComments(ticketId);
}

export async function createSupportTicket(ticketData: Omit<SupportTicket, 'id' | 'ticket_code' | 'created_at' | 'updated_at' | 'comment_count'>): Promise<SupportTicket> {
    const codeNumber = Math.floor(1000 + Math.random() * 9000);
    const newTicket: SupportTicket = {
        ...ticketData,
        id: crypto.randomUUID ? crypto.randomUUID() : `tk-${Date.now()}`,
        ticket_code: `TK-${codeNumber}`,
        comment_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabase
            .from('support_tickets')
            .insert([newTicket])
            .select()
            .single();

        if (!error && data) {
            const current = getLocalTickets();
            saveLocalTickets([data as SupportTicket, ...current]);
            return data as SupportTicket;
        }
    } catch (e) {
        console.warn('Lỗi tạo ticket trên Supabase, lưu local:', e);
    }

    const current = getLocalTickets();
    saveLocalTickets([newTicket, ...current]);
    return newTicket;
}

export async function addTicketComment(commentData: Omit<TicketComment, 'id' | 'created_at'>): Promise<TicketComment> {
    const newComment: TicketComment = {
        ...commentData,
        id: crypto.randomUUID ? crypto.randomUUID() : `cmt-${Date.now()}`,
        created_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabase
            .from('support_ticket_comments')
            .insert([newComment])
            .select()
            .single();

        if (!error && data) {
            const list = getLocalComments(commentData.ticket_id);
            saveLocalComments(commentData.ticket_id, [...list, data as TicketComment]);
            // Increment comment_count on ticket
            try {
                await supabase.rpc('increment_ticket_comment_count', { t_id: commentData.ticket_id });
            } catch {
                // Ignore rpc failure if function not yet defined
            }
            return data as TicketComment;
        }
    } catch (e) {
        console.warn('Lỗi gửi comment lên Supabase, lưu local:', e);
    }

    const list = getLocalComments(commentData.ticket_id);
    saveLocalComments(commentData.ticket_id, [...list, newComment]);

    // Update local ticket comment count
    const tickets = getLocalTickets();
    const idx = tickets.findIndex(t => t.id === commentData.ticket_id);
    if (idx !== -1) {
        tickets[idx].comment_count = (tickets[idx].comment_count || 0) + 1;
        tickets[idx].updated_at = new Date().toISOString();
        saveLocalTickets(tickets);
    }

    return newComment;
}

export async function updateTicketStatus(
    ticketId: string,
    status: TicketStatus,
    resolutionNote?: string,
    closedBy?: string
): Promise<boolean> {
    const updates: Partial<SupportTicket> = {
        status,
        updated_at: new Date().toISOString()
    };
    if (status === 'closed' || status === 'resolved') {
        updates.closed_by = closedBy || 'Admin';
        updates.closed_at = new Date().toISOString();
    }
    if (resolutionNote !== undefined) {
        updates.resolution_note = resolutionNote;
    }

    try {
        const { error } = await supabase
            .from('support_tickets')
            .update(updates)
            .eq('id', ticketId);

        if (!error) {
            const tickets = getLocalTickets();
            const idx = tickets.findIndex(t => t.id === ticketId);
            if (idx !== -1) {
                tickets[idx] = { ...tickets[idx], ...updates };
                saveLocalTickets(tickets);
            }
            return true;
        }
    } catch (e) {
        console.warn('Lỗi cập nhật trạng thái trên Supabase:', e);
    }

    const tickets = getLocalTickets();
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx !== -1) {
        tickets[idx] = { ...tickets[idx], ...updates };
        saveLocalTickets(tickets);
        return true;
    }
    return false;
}

export async function toggleStarTicket(ticketId: string, isStarred: boolean): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('support_tickets')
            .update({ is_starred: isStarred, updated_at: new Date().toISOString() })
            .eq('id', ticketId);

        if (!error) {
            const tickets = getLocalTickets();
            const idx = tickets.findIndex(t => t.id === ticketId);
            if (idx !== -1) {
                tickets[idx].is_starred = isStarred;
                saveLocalTickets(tickets);
            }
            return true;
        }
    } catch (e) {
        console.warn('Lỗi toggle star ticket:', e);
    }

    const tickets = getLocalTickets();
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx !== -1) {
        tickets[idx].is_starred = isStarred;
        saveLocalTickets(tickets);
        return true;
    }
    return false;
}

export async function submitTicketRating(
    ticketId: string,
    rating: number,
    ratingComment?: string
): Promise<boolean> {
    const updates = {
        rating,
        rating_comment: ratingComment || null,
        rated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    try {
        const { error } = await supabase
            .from('support_tickets')
            .update(updates)
            .eq('id', ticketId);

        if (!error) {
            const tickets = getLocalTickets();
            const idx = tickets.findIndex(t => t.id === ticketId);
            if (idx !== -1) {
                tickets[idx] = { ...tickets[idx], ...updates };
                saveLocalTickets(tickets);
            }
            return true;
        }
    } catch (e) {
        console.warn('Lỗi đánh giá ticket:', e);
    }

    const tickets = getLocalTickets();
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx !== -1) {
        tickets[idx] = { ...tickets[idx], ...updates };
        saveLocalTickets(tickets);
        return true;
    }
    return false;
}
