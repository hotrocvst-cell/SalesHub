export type TicketCategory =
    | 'huong_dan'          // Hướng dẫn sử dụng / Thắc mắc quy trình
    | 'gop_y_giao_dien'    // Góp ý về giao diện, hiển thị mobile / desktop
    | 'tinh_nang_moi'      // Đề xuất tính năng mới
    | 'bao_loi'            // Báo lỗi hệ thống (Bug report)
    | 'khac';              // Chủ đề khác

export type TicketPriority =
    | 'thap'               // Thấp
    | 'trung_binh'         // Trung bình
    | 'cao'                // Cao
    | 'khan_cap';          // Khẩn cấp

export type TicketStatus =
    | 'open'               // Mới tạo / Chờ tiếp nhận
    | 'in_progress'        // Đang xử lý / Đang theo dõi
    | 'resolved'           // Đã xử lý / Đã giải quyết
    | 'closed';            // Đã đóng hoàn tất

export interface TicketComment {
    id: string;
    ticket_id: string;
    author_id: string;
    author_name: string;
    author_role: string;
    author_store?: string;
    content: string;
    is_admin_reply: boolean;
    is_anonymous?: boolean;
    created_at: string;
}

export interface SupportTicket {
    id: string;
    ticket_code: string;
    title: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    content: string;
    creator_id: string;
    creator_name: string;
    creator_role: string;
    creator_store: string;
    assigned_to?: string;
    is_starred?: boolean;
    is_anonymous?: boolean;
    rating?: number | null; // 1 to 5
    rating_comment?: string | null;
    rated_at?: string | null;
    closed_by?: string | null;
    closed_at?: string | null;
    resolution_note?: string | null;
    comment_count?: number;
    created_at: string;
    updated_at: string;
}

export interface TicketSummaryStats {
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    needsActionCount: number; // open + in_progress
    starredCount: number;
    closedCount: number;
    resolvedCount: number;
    totalRated: number;
    averageRating: number;
    satisfiedRate: number; // % 4 or 5 stars
    categoryCounts: Record<TicketCategory, number>;
}

export const CATEGORY_METADATA: Record<TicketCategory, {
    label: string;
    icon: string;
    colorClass: string;
    bgClass: string;
    borderClass: string;
}> = {
    huong_dan: {
        label: 'Hướng Dẫn Sử Dụng',
        icon: '💡',
        colorClass: 'text-amber-700',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200'
    },
    gop_y_giao_dien: {
        label: 'Góp Ý Giao Diện',
        icon: '🎨',
        colorClass: 'text-purple-700',
        bgClass: 'bg-purple-50',
        borderClass: 'border-purple-200'
    },
    tinh_nang_moi: {
        label: 'Đề Xuất Tính Năng',
        icon: '🚀',
        colorClass: 'text-blue-700',
        bgClass: 'bg-blue-50',
        borderClass: 'border-blue-200'
    },
    bao_loi: {
        label: 'Báo Lỗi Hệ Thống',
        icon: '🐛',
        colorClass: 'text-rose-700',
        bgClass: 'bg-rose-50',
        borderClass: 'border-rose-200'
    },
    khac: {
        label: 'Chủ Đề Khác',
        icon: '💬',
        colorClass: 'text-slate-700',
        bgClass: 'bg-slate-100',
        borderClass: 'border-slate-200'
    }
};

export const PRIORITY_METADATA: Record<TicketPriority, {
    label: string;
    colorClass: string;
    bgClass: string;
    badgeDot: string;
}> = {
    thap: {
        label: 'Thấp',
        colorClass: 'text-slate-600',
        bgClass: 'bg-slate-100',
        badgeDot: 'bg-slate-400'
    },
    trung_binh: {
        label: 'Trung bình',
        colorClass: 'text-blue-700',
        bgClass: 'bg-blue-50',
        badgeDot: 'bg-blue-500'
    },
    cao: {
        label: 'Ưu tiên Cao',
        colorClass: 'text-amber-800',
        bgClass: 'bg-amber-50',
        badgeDot: 'bg-amber-500'
    },
    khan_cap: {
        label: '🚨 Khẩn cấp',
        colorClass: 'text-rose-800',
        bgClass: 'bg-rose-100 font-bold',
        badgeDot: 'bg-rose-600'
    }
};

export const STATUS_METADATA: Record<TicketStatus, {
    label: string;
    colorClass: string;
    bgClass: string;
    borderClass: string;
    icon: string;
}> = {
    open: {
        label: 'Mới tạo',
        colorClass: 'text-blue-700',
        bgClass: 'bg-blue-50',
        borderClass: 'border-blue-200',
        icon: '🔵'
    },
    in_progress: {
        label: 'Đang xử lý',
        colorClass: 'text-amber-700',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        icon: '🟡'
    },
    resolved: {
        label: 'Đã giải quyết',
        colorClass: 'text-emerald-700',
        bgClass: 'bg-emerald-50',
        borderClass: 'border-emerald-200',
        icon: '🟢'
    },
    closed: {
        label: 'Đã đóng',
        colorClass: 'text-slate-600',
        bgClass: 'bg-slate-100',
        borderClass: 'border-slate-300',
        icon: '⚪'
    }
};

export const SATISFACTION_LEVELS = [
    { rating: 5, label: 'Rất hài lòng', icon: '😍', color: 'text-emerald-600' },
    { rating: 4, label: 'Hài lòng', icon: '😊', color: 'text-emerald-500' },
    { rating: 3, label: 'Bình thường', icon: '😐', color: 'text-amber-500' },
    { rating: 2, label: 'Chưa hài lòng', icon: '🙁', color: 'text-orange-500' },
    { rating: 1, label: 'Không hài lòng', icon: '😡', color: 'text-rose-600' }
];
