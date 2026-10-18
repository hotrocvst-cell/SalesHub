import { supabase } from './supabase';
import type { UserRole } from '../../shared/contexts/AuthContext';
import type { BadgeColorTheme } from './badgeConfig';

export interface SystemPagePermission {
    id?: string;
    page_key: string;
    page_name: string;
    path: string;
    group_title: string;
    description?: string;
    is_enabled: boolean;
    allowed_roles: UserRole[];
    allowed_stores?: string[]; // MỚI: Danh sách siêu thị được phép sử dụng (trống hoặc có 'ALL' = Tất cả siêu thị)
    order_index: number;
    updated_at?: string;
    // Cấu hình Badge hiển thị trên Sidebar
    badge_enabled?: boolean; // Bật / Tắt hiển thị badge
    badge_text?: string;    // Nội dung chữ (Ví dụ: HOT, NEW, TOP, Admin, RT, Mới,...)
    badge_icon?: string;    // Icon / Emoji (Ví dụ: 🔥, ⚡, ✨, 🏆, 💎, 👑, 🛡️, 🎁, ⭐)
    badge_color?: BadgeColorTheme | string; // Màu sắc / theme (rose, amber, emerald, blue, purple, indigo, slate)
    // Phân quyền Xuất Excel (Mặc định: false - Khóa & Ẩn)
    allow_excel_export?: boolean;
    allowed_excel_roles?: UserRole[];
}

export const DEFAULT_PAGE_PERMISSIONS: SystemPagePermission[] = [
    // TỔNG QUAN
    {
        page_key: 'trang_chu',
        page_name: 'Trang Chủ',
        path: '/',
        group_title: 'TỔNG QUAN',
        description: 'Trang chủ tổng quan hệ thống, lịch tháng âm dương, đồng hồ & thời tiết',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 0,
        badge_enabled: true,
        badge_icon: '✨',
        badge_text: 'Home',
        badge_color: 'blue'
    },
    // BÁO CÁO KINH DOANH
    {
        page_key: 'bc_cum_sieu_thi',
        page_name: 'BC Cụm Siêu Thị',
        path: '/bao-cao-cum-sieu-thi',
        group_title: 'BÁO CÁO KINH DOANH',
        description: 'Báo cáo sức khỏe cụm siêu thị 11 cột, theo dõi lũy kế doanh thu thực, DTQĐ, target vượt trội và trả chậm',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 1,
        badge_enabled: true,
        badge_icon: '💎',
        badge_text: '11 Cột',
        badge_color: 'blue'
    },
    {
        page_key: 'bc_ngay',
        page_name: 'BC Ngày (Realtime)',
        path: '/bc-ngay/tong-quan',
        group_title: 'BÁO CÁO KINH DOANH',
        description: 'Báo cáo doanh thu & sản lượng theo thời gian thực trong ngày',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 2,
        badge_enabled: true,
        badge_icon: '⚡',
        badge_text: 'RT',
        badge_color: 'blue'
    },
    {
        page_key: 'bc_doanh_thu_nv_ngay',
        page_name: 'BC Doanh Thu NV Ngày',
        path: '/bc-ngay-nhan-vien',
        group_title: 'BÁO CÁO KINH DOANH',
        description: 'Báo cáo doanh thu nhân viên ngày, xếp hạng Top 30% và nhắc nhở tăng tốc',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 2,
        badge_enabled: true,
        badge_icon: '⚡',
        badge_text: 'Mới',
        badge_color: 'blue'
    },
    {
        page_key: 'bc_thang',
        page_name: 'BC Tháng (Lũy kế)',
        path: '/bc-thang/tong-quan',
        group_title: 'BÁO CÁO KINH DOANH',
        description: 'Báo cáo tiến độ lũy kế tháng & dự kiến hoàn thành mục tiêu',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 2,
        badge_enabled: false,
        badge_icon: '',
        badge_text: '',
        badge_color: 'blue'
    },
    {
        page_key: 'hieu_qua_nv',
        page_name: 'Hiệu quả NV lũy kế',
        path: '/bao-cao-hieu-qua-nhan-vien',
        group_title: 'BÁO CÁO KINH DOANH',
        description: 'Đánh giá năng suất, doanh thu và thi đua từng nhân sự',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 3,
        badge_enabled: true,
        badge_icon: '⭐',
        badge_text: 'Mới',
        badge_color: 'rose'
    },
    {
        page_key: 'chi_tiet_nv',
        page_name: 'Chi tiết nhân viên',
        path: '/chi-tiet-nhan-vien',
        group_title: 'BÁO CÁO KINH DOANH',
        description: 'Báo cáo chi tiết doanh thu, tiến độ ngành hàng và thi đua từng cá nhân',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 4,
        badge_enabled: true,
        badge_icon: '✨',
        badge_text: 'Mới',
        badge_color: 'rose'
    },
    {
        page_key: 'tong_hop_xep_hang_nv',
        page_name: 'Tổng hợp Xếp hạng NV',
        path: '/tong-hop-xep-hang-nhan-vien',
        group_title: 'SỨC KHỎE NHÂN VIÊN',
        description: 'Báo cáo xếp hạng tổng hợp đa chiều doanh thu và thi đua của nhân viên',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 5,
        badge_enabled: true,
        badge_icon: '🏆',
        badge_text: 'Mới',
        badge_color: 'rose'
    },
    {
        page_key: 'xep_hang_doanh_thu_luy_ke',
        page_name: 'Xếp hạng DT lũy kế',
        path: '/xep-hang-doanh-thu-luy-ke',
        group_title: 'SỨC KHỎE NHÂN VIÊN',
        description: 'Báo cáo xếp hạng doanh thu nhân viên theo lũy kế từ ngày A đến ngày B',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 6,
        badge_enabled: true,
        badge_icon: '⭐',
        badge_text: 'Mới',
        badge_color: 'amber'
    },
    {
        page_key: 'tong_hop_thi_dua',
        page_name: 'Tổng hợp thi đua',
        path: '/tong-hop-thi-dua',
        group_title: 'SỨC KHỎE NHÂN VIÊN',
        description: 'Tổng hợp tiến độ hoàn thành các chương trình thi đua',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 6,
        badge_enabled: true,
        badge_icon: '🔥',
        badge_text: 'Hot',
        badge_color: 'rose'
    },
    {
        page_key: 'tien_do_thi_dua',
        page_name: 'Tiến độ thi đua',
        path: '/tien-do-thi-dua',
        group_title: 'SỨC KHỎE NHÂN VIÊN',
        description: 'Báo cáo tiến độ hoàn thành các chương trình thi đua theo nhân sự và siêu thị',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 7,
        badge_enabled: true,
        badge_icon: '⚡',
        badge_text: 'Mới',
        badge_color: 'rose'
    },
    {
        page_key: 'tra_cuu_thi_dua',
        page_name: 'Tra cứu thi đua',
        path: '/tra-cuu-thi-dua',
        group_title: 'SỨC KHỎE NHÂN VIÊN',
        description: 'Hiển thị và tra cứu thể lệ, định hướng, cách tính và CTKM các chương trình thi đua',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 8,
        badge_enabled: true,
        badge_icon: '✨',
        badge_text: 'Mới',
        badge_color: 'blue'
    },
    {
        page_key: 'nhip_doanh_thu',
        page_name: 'Nhịp Doanh Thu',
        path: '/nhip-doanh-thu',
        group_title: 'BÁO CÁO KINH DOANH',
        description: 'Biểu đồ phân tích nhịp bán và xu hướng dòng tiền',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 5,
        badge_enabled: false,
        badge_icon: '',
        badge_text: '',
        badge_color: 'blue'
    },
    // DỮ LIỆU & PHIÊN LÀM VIỆC
    {
        page_key: 'trang_thai_du_lieu',
        page_name: 'Trạng Thái Dữ Liệu',
        path: '/trang-thai-du-lieu',
        group_title: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
        description: 'Tổng hợp trạng thái cập nhật phiên n-1 của dữ liệu doanh thu, thi đua siêu thị và nhân viên',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 6,
        badge_enabled: true,
        badge_icon: '✨',
        badge_text: 'Mới',
        badge_color: 'emerald'
    },
    {
        page_key: 'cap_nhat_so_lieu',
        page_name: 'Cập nhật số liệu',
        path: '/cap-nhat',
        group_title: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
        description: 'Nạp dữ liệu báo cáo kinh doanh từ Excel hoặc dán nhanh',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 7,
        badge_enabled: false,
        badge_icon: '',
        badge_text: '',
        badge_color: 'emerald'
    },
    {
        page_key: 'cap_nhat_luy_ke_nv',
        page_name: 'Cập nhật số liệu NV',
        path: '/cap-nhat-luy-ke-nhan-vien',
        group_title: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
        description: 'Nạp dữ liệu lũy kế cá nhân nhân viên theo ca/ngày',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 7,
        badge_enabled: true,
        badge_icon: '⚡',
        badge_text: 'Mới',
        badge_color: 'emerald'
    },
    {
        page_key: 'quan_ly_phien_nv',
        page_name: 'Phiên dữ liệu NV',
        path: '/quan-ly-phien-nhan-vien',
        group_title: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
        description: 'Lịch sử và danh sách các phiên cập nhật dữ liệu nhân sự',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 8,
        badge_enabled: false,
        badge_icon: '',
        badge_text: '',
        badge_color: 'emerald'
    },
    {
        page_key: 'quan_ly_du_lieu_st',
        page_name: 'Quản lý bản ghi ST',
        path: '/quan-ly-du-lieu',
        group_title: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
        description: 'Tra cứu, lọc và dọn dẹp các bản ghi số liệu siêu thị',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 9,
        badge_enabled: false,
        badge_icon: '',
        badge_text: '',
        badge_color: 'emerald'
    },
    // TIỆN ÍCH BÁN HÀNG
    {
        page_key: 'cap_ma_voucher',
        page_name: 'Cấp mã voucher',
        path: '/cap-ma-voucher',
        group_title: 'TIỆN ÍCH BÁN HÀNG',
        description: 'Cấp mã voucher ưu đãi bán hàng theo đơn hàng thực tế cho nhân viên',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 10,
        badge_enabled: true,
        badge_icon: '🎁',
        badge_text: 'Hot',
        badge_color: 'amber'
    },
    {
        page_key: 'quan_ly_voucher',
        page_name: 'Quản lý kho voucher',
        path: '/quan-ly-voucher',
        group_title: 'TIỆN ÍCH BÁN HÀNG',
        description: 'Quản trị kho mã voucher, nạp mã mới, double check, cảnh báo đầu cơ và reset mã',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 11,
        badge_enabled: true,
        badge_icon: '🔑',
        badge_text: 'QL',
        badge_color: 'amber',
        allow_excel_export: true,
        allowed_excel_roles: ['ADMIN']
    },
    {
        page_key: 'xmusic_playlist',
        page_name: 'Xmusic Playlist',
        path: '/xmusic-playlist',
        group_title: 'TIỆN ÍCH BÁN HÀNG',
        description: 'Tự động hóa phát nhạc siêu thị XMusicStation, tích hợp Userscript Tampermonkey và danh sách bài hát',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 12,
        badge_enabled: true,
        badge_icon: '🎵',
        badge_text: 'Mới',
        badge_color: 'indigo'
    },
    // HỆ THỐNG & CẤU HÌNH
    {
        page_key: 'cau_hinh_st_nv',
        page_name: 'Cấu hình Siêu thị & NV',
        path: '/cau-hinh-sieu-thi-nhan-vien',
        group_title: 'HỆ THỐNG & CẤU HÌNH',
        description: 'Khai báo danh mục siêu thị, nhân sự và phân ca',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY'],
        order_index: 10,
        badge_enabled: true,
        badge_icon: '👑',
        badge_text: 'Boss',
        badge_color: 'purple'
    },
    {
        page_key: 'cau_hinh_thi_dua',
        page_name: 'Cấu hình thi đua & tính điểm',
        path: '/cau-hinh-thi-dua',
        group_title: 'HỆ THỐNG & CẤU HÌNH',
        description: 'Từ điển thi đua và cấu hình tính điểm theo từng siêu thị',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 11,
        badge_enabled: false,
        badge_icon: '',
        badge_text: '',
        badge_color: 'purple'
    },
    {
        page_key: 'muc_tieu_nv',
        page_name: 'Mục tiêu nhân viên',
        path: '/muc-tieu-nhan-vien',
        group_title: 'HỆ THỐNG & CẤU HÌNH',
        description: 'Thiết lập chỉ tiêu doanh thu và KPI thi đua cho từng nhân sự',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY'],
        order_index: 12,
        badge_enabled: false,
        badge_icon: '',
        badge_text: '',
        badge_color: 'purple'
    },
    {
        page_key: 'quan_ly_tai_khoan',
        page_name: 'Quản lý Tài khoản (User)',
        path: '/quan-ly-tai-khoan',
        group_title: 'HỆ THỐNG & CẤU HÌNH',
        description: 'Quản trị danh sách người dùng, đặt lại mật khẩu và duyệt đăng ký',
        is_enabled: true,
        allowed_roles: ['ADMIN'],
        order_index: 13,
        badge_enabled: true,
        badge_icon: '🛡️',
        badge_text: 'Admin',
        badge_color: 'purple'
    },
    {
        page_key: 'phan_quyen_sieu_thi',
        page_name: 'Phân quyền Siêu thị',
        path: '/phan-quyen-sieu-thi',
        group_title: 'HỆ THỐNG & CẤU HÌNH',
        description: 'Theo dõi & phân quyền danh sách siêu thị được phép xem của các tài khoản',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY'],
        order_index: 14,
        badge_enabled: true,
        badge_icon: '🏢',
        badge_text: 'Mới',
        badge_color: 'purple'
    },
    {
        page_key: 'quan_tri_he_thong',
        page_name: 'Quản trị Hệ Thống (Admin)',
        path: '/quan-tri-he-thong',
        group_title: 'HỆ THỐNG & CẤU HÌNH',
        description: 'Quản lý trạng thái hoạt động & phân quyền các trang tiện ích',
        is_enabled: true,
        allowed_roles: ['ADMIN'],
        order_index: 15,
        badge_enabled: true,
        badge_icon: '⚙️',
        badge_text: 'Cấu hình',
        badge_color: 'purple'
    }
];

/**
 * Danh mục chuẩn 100% các trang thực tế trong hệ thống (App Route Registry)
 * Dùng làm thước đo đối chiếu (Audit) với danh sách đã lưu trên Supabase/LocalStorage
 */
export const APP_SYSTEM_PAGES_REGISTRY: SystemPagePermission[] = DEFAULT_PAGE_PERMISSIONS;

export interface RouteAuditReport {
    totalAppRoutes: number;
    managedRoutesCount: number;
    unmanagedRoutes: SystemPagePermission[];
    coveragePercent: number;
    isFullyAudited: boolean;
}

/**
 * Kiểm toán tính toàn vẹn giữa các trang đang chạy thực tế và danh sách phân quyền
 */
export function auditRouteCoverage(currentPermissions: SystemPagePermission[]): RouteAuditReport {
    const existingPaths = new Set(currentPermissions.map(p => p.path));
    const unmanaged = APP_SYSTEM_PAGES_REGISTRY.filter(def => !existingPaths.has(def.path));
    const managedRoutesCount = APP_SYSTEM_PAGES_REGISTRY.length - unmanaged.length;
    const coveragePercent = Math.round((managedRoutesCount / APP_SYSTEM_PAGES_REGISTRY.length) * 100);

    return {
        totalAppRoutes: APP_SYSTEM_PAGES_REGISTRY.length,
        managedRoutesCount,
        unmanagedRoutes: unmanaged,
        coveragePercent,
        isFullyAudited: unmanaged.length === 0
    };
}

/**
 * Tự động hợp nhất tất cả các trang thực tế còn thiếu vào danh sách phân quyền hiện tại
 */
export function syncMissingPagesToPermissions(currentPermissions: SystemPagePermission[]): SystemPagePermission[] {
    const existingPaths = new Set(currentPermissions.map(p => p.path));
    const existingKeys = new Set(currentPermissions.map(p => p.page_key));
    const toAdd = APP_SYSTEM_PAGES_REGISTRY.filter(
        def => !existingPaths.has(def.path) && !existingKeys.has(def.page_key)
    );

    return [...currentPermissions, ...toAdd].sort((a, b) => a.order_index - b.order_index);
}

const LOCAL_STORAGE_KEY = 'saleshub_system_page_permissions_v1';

export const BADGE_MIGRATION_SQL = `-- CHẠY 4 DÒNG LỆNH NÀY TRONG SUPABASE SQL EDITOR ĐỂ BỔ SUNG CÁC CỘT BADGE CHO SIDEBAR:
ALTER TABLE public.system_page_permissions ADD COLUMN IF NOT EXISTS badge_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.system_page_permissions ADD COLUMN IF NOT EXISTS badge_text TEXT DEFAULT NULL;
ALTER TABLE public.system_page_permissions ADD COLUMN IF NOT EXISTS badge_icon TEXT DEFAULT NULL;
ALTER TABLE public.system_page_permissions ADD COLUMN IF NOT EXISTS badge_color TEXT DEFAULT 'blue';
`;

export const SYSTEM_PAGE_PERMISSIONS_SQL = `-- Chạy lệnh này trong Supabase SQL Editor để tạo bảng phân quyền
CREATE TABLE IF NOT EXISTS public.system_page_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_key TEXT UNIQUE NOT NULL,
    page_name TEXT NOT NULL,
    path TEXT UNIQUE NOT NULL,
    group_title TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    allowed_roles TEXT[] NOT NULL DEFAULT '{"ADMIN"}',
    allowed_stores TEXT[] DEFAULT NULL,
    order_index INTEGER NOT NULL DEFAULT 1,
    badge_enabled BOOLEAN DEFAULT true,
    badge_text TEXT DEFAULT NULL,
    badge_icon TEXT DEFAULT NULL,
    badge_color TEXT DEFAULT 'blue',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bổ sung các cột nếu bảng đã tồn tại từ trước
ALTER TABLE public.system_page_permissions ADD COLUMN IF NOT EXISTS allowed_stores TEXT[] DEFAULT NULL;
ALTER TABLE public.system_page_permissions ADD COLUMN IF NOT EXISTS badge_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.system_page_permissions ADD COLUMN IF NOT EXISTS badge_text TEXT DEFAULT NULL;
ALTER TABLE public.system_page_permissions ADD COLUMN IF NOT EXISTS badge_icon TEXT DEFAULT NULL;
ALTER TABLE public.system_page_permissions ADD COLUMN IF NOT EXISTS badge_color TEXT DEFAULT 'blue';
ALTER TABLE public.system_page_permissions ADD COLUMN IF NOT EXISTS allow_excel_export BOOLEAN DEFAULT false;
ALTER TABLE public.system_page_permissions ADD COLUMN IF NOT EXISTS allowed_excel_roles TEXT[] DEFAULT '{"ADMIN"}';

-- Kích hoạt RLS
ALTER TABLE public.system_page_permissions ENABLE ROW LEVEL SECURITY;

-- Cho phép đọc công khai
DROP POLICY IF EXISTS "Allow read system_page_permissions" ON public.system_page_permissions;
CREATE POLICY "Allow read system_page_permissions" ON public.system_page_permissions FOR SELECT USING (true);

-- Cho phép cập nhật/thêm mới
DROP POLICY IF EXISTS "Allow all system_page_permissions" ON public.system_page_permissions;
CREATE POLICY "Allow all system_page_permissions" ON public.system_page_permissions FOR ALL USING (true);
`;

const LOCAL_BADGES_KEY = 'saleshub_sidebar_badges_custom_v1';

/**
 * Đọc cấu hình phân quyền từ Supabase (fallback sang localStorage và default nếu chưa có bảng)
 */
export async function fetchSystemPagePermissions(): Promise<{ success: boolean; data: SystemPagePermission[]; fromSupabase: boolean; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('system_page_permissions')
            .select('*')
            .order('order_index', { ascending: true });

        if (!error && data && data.length > 0) {
            // Kiểm tra xem dữ liệu từ Supabase đã có các cột badge hay chưa
            const sampleRow = data[0];
            const cloudHasBadge = 'badge_enabled' in sampleRow || 'badge_text' in sampleRow;

            // Đọc custom badges dự phòng từ LocalStorage
            let customBadgeCache: Record<string, any> = {};
            try {
                const raw = localStorage.getItem(LOCAL_BADGES_KEY);
                if (raw) customBadgeCache = JSON.parse(raw);
            } catch {
                // ignore
            }

            const mapped: SystemPagePermission[] = data.map((item: any) => {
                const defaultDef = DEFAULT_PAGE_PERMISSIONS.find(d => d.page_key === item.page_key || d.path === item.path);
                const cachedBadge = customBadgeCache[item.path];

                let badge_enabled = true;
                let badge_text = '';
                let badge_icon = '';
                let badge_color = 'blue';

                if (cloudHasBadge && item.badge_enabled !== undefined) {
                    // Ưu tiên 1: Lấy trực tiếp từ Supabase Cloud khi đã có cột trên database
                    badge_enabled = item.badge_enabled !== null ? Boolean(item.badge_enabled) : false;
                    badge_text = item.badge_text !== null && item.badge_text !== undefined ? String(item.badge_text) : '';
                    badge_icon = item.badge_icon !== null && item.badge_icon !== undefined ? String(item.badge_icon) : '';
                    badge_color = item.badge_color || defaultDef?.badge_color || 'blue';
                } else if (cachedBadge) {
                    // Ưu tiên 2: Giữ nguyên cấu hình người dùng đã lưu vào máy (không để bị đè khi Cloud chưa tạo cột)
                    badge_enabled = cachedBadge.badge_enabled !== false;
                    badge_text = cachedBadge.badge_text ?? '';
                    badge_icon = cachedBadge.badge_icon ?? '';
                    badge_color = cachedBadge.badge_color || 'blue';
                } else if (defaultDef) {
                    // Ưu tiên 3: Mặc định ban đầu của hệ thống
                    badge_enabled = defaultDef.badge_enabled ?? true;
                    badge_text = defaultDef.badge_text || '';
                    badge_icon = defaultDef.badge_icon || '';
                    badge_color = defaultDef.badge_color || 'blue';
                }

                const allow_excel_export = item.allow_excel_export !== undefined && item.allow_excel_export !== null
                    ? Boolean(item.allow_excel_export)
                    : (defaultDef?.allow_excel_export ?? false);

                const allowed_excel_roles = (Array.isArray(item.allowed_excel_roles) && item.allowed_excel_roles.length > 0)
                    ? (item.allowed_excel_roles as UserRole[])
                    : (defaultDef?.allowed_excel_roles || ['ADMIN']);

                return {
                    id: item.id,
                    page_key: item.page_key,
                    page_name: item.page_name,
                    path: item.path,
                    group_title: item.group_title,
                    description: item.description,
                    is_enabled: Boolean(item.is_enabled),
                    allowed_roles: (item.allowed_roles || []) as UserRole[],
                    allowed_stores: Array.isArray(item.allowed_stores) ? item.allowed_stores : undefined,
                    order_index: Number(item.order_index) || 1,
                    updated_at: item.updated_at,
                    badge_enabled,
                    badge_text,
                    badge_icon,
                    badge_color,
                    allow_excel_export,
                    allowed_excel_roles
                };
            });

            // Tự động hợp nhất các trang hệ thống mới trong DEFAULT_PAGE_PERMISSIONS nếu Supabase thiếu
            const existingKeys = new Set(mapped.map(m => m.page_key));
            const existingPaths = new Set(mapped.map(m => m.path));
            const missingDefaults = DEFAULT_PAGE_PERMISSIONS.filter(
                def => !existingKeys.has(def.page_key) && !existingPaths.has(def.path)
            );
            if (missingDefaults.length > 0) {
                mapped.push(...missingDefaults);
                mapped.sort((a, b) => a.order_index - b.order_index);
            }

            // Lưu bản copy vào localStorage để dự phòng
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mapped));
            } catch (e) {
                console.warn('Lỗi lưu cache permissions:', e);
            }

            return { success: true, data: mapped, fromSupabase: true };
        }

        // Nếu bảng chưa có dữ liệu hoặc bảng chưa được tạo trên Supabase, lấy từ cache hoặc defaults
        const local = getLocalPermissions();
        return { success: true, data: local, fromSupabase: false, error: error?.message };
    } catch (err: any) {
        console.warn('Không thể kết nối Supabase system_page_permissions, dùng local cache:', err);
        return { success: true, data: getLocalPermissions(), fromSupabase: false, error: err?.message };
    }
}

/**
 * Kiểm tra xem bảng system_page_permissions và các cột badge đã tồn tại trên Supabase hay chưa
 */
export async function checkSupabasePermissionsTable(): Promise<{ exists: boolean; hasBadgeColumns: boolean; count: number; error?: string }> {
    try {
        const { count, error } = await supabase
            .from('system_page_permissions')
            .select('id', { count: 'exact', head: true });

        if (error) {
            return { exists: false, hasBadgeColumns: false, count: 0, error: error.message };
        }

        // Kiểm tra xem đã có cột badge_enabled trên bảng hay chưa
        const { error: badgeColError } = await supabase
            .from('system_page_permissions')
            .select('badge_enabled')
            .limit(1);

        const hasBadgeColumns = !badgeColError;
        return { exists: true, hasBadgeColumns, count: count ?? 0 };
    } catch (err: any) {
        return { exists: false, hasBadgeColumns: false, count: 0, error: err?.message || String(err) };
    }
}

/**
 * Lưu cấu hình phân quyền lên Supabase và cache local
 */
export async function saveSystemPagePermissions(permissions: SystemPagePermission[]): Promise<{ success: boolean; fromSupabase: boolean; error?: string }> {
    // 1. Luôn lưu cache local trước và lưu riêng bản sao Badge để không bao giờ bị mất khi refresh
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(permissions));

        const customBadges: Record<string, any> = {};
        permissions.forEach(p => {
            customBadges[p.path] = {
                badge_enabled: p.badge_enabled !== false,
                badge_text: p.badge_text ?? '',
                badge_icon: p.badge_icon ?? '',
                badge_color: p.badge_color || 'blue'
            };
        });
        localStorage.setItem(LOCAL_BADGES_KEY, JSON.stringify(customBadges));
    } catch (e) {
        console.warn('Lỗi lưu local permissions:', e);
    }

    // 2. Cố gắng đồng bộ lên Supabase
    try {
        const payloads = permissions.map(p => ({
            page_key: p.page_key,
            page_name: p.page_name,
            path: p.path,
            group_title: p.group_title,
            description: p.description || '',
            is_enabled: Boolean(p.is_enabled),
            allowed_roles: p.allowed_roles,
            allowed_stores: (p.allowed_stores && p.allowed_stores.length > 0) ? p.allowed_stores : null,
            order_index: p.order_index,
            badge_enabled: p.badge_enabled !== undefined ? Boolean(p.badge_enabled) : true,
            badge_text: p.badge_text ? p.badge_text.trim() : null,
            badge_icon: p.badge_icon ? p.badge_icon.trim() : null,
            badge_color: p.badge_color || 'blue',
            allow_excel_export: p.allow_excel_export !== undefined ? Boolean(p.allow_excel_export) : false,
            allowed_excel_roles: (Array.isArray(p.allowed_excel_roles) && p.allowed_excel_roles.length > 0) ? p.allowed_excel_roles : ['ADMIN'],
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('system_page_permissions')
            .upsert(payloads, { onConflict: 'page_key' });

        if (error) {
            console.warn('Cảnh báo khi lưu Supabase system_page_permissions:', error.message);
            // Nếu lỗi do cột badge hoặc excel chưa được tạo trên Supabase
            if (error.message && (error.message.includes('badge_') || error.message.includes('excel') || error.message.includes('column'))) {
                try {
                    const fallbackPayloads = payloads.map(({ badge_enabled, badge_text, badge_icon, badge_color, allow_excel_export, allowed_excel_roles, ...rest }: any) => rest);
                    const { error: fallbackError } = await supabase
                        .from('system_page_permissions')
                        .upsert(fallbackPayloads, { onConflict: 'page_key' });
                    if (!fallbackError) {
                        return {
                            success: true,
                            fromSupabase: false,
                            error: 'Chưa có các cột mở rộng trên Supabase. Đã lưu cấu hình an toàn trên máy này. Hãy chạy lệnh ALTER TABLE để đồng bộ lên Cloud.'
                        };
                    }
                } catch {
                    // Ignore
                }
            }
            return { success: true, fromSupabase: false, error: error.message };
        }

        return { success: true, fromSupabase: true };
    } catch (err: any) {
        console.warn('Lỗi saveSystemPagePermissions Supabase:', err);
        return { success: true, fromSupabase: false, error: err?.message || String(err) };
    }
}

function getLocalPermissions(): SystemPagePermission[] {
    try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        let customBadgeCache: Record<string, any> = {};
        try {
            const raw = localStorage.getItem(LOCAL_BADGES_KEY);
            if (raw) customBadgeCache = JSON.parse(raw);
        } catch {}

        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const currentPaths = new Set(parsed.map((p: any) => p.path));
                const missingDefaults = DEFAULT_PAGE_PERMISSIONS.filter(d => !currentPaths.has(d.path));
                return [...parsed, ...missingDefaults].map(item => {
                    const defaultDef = DEFAULT_PAGE_PERMISSIONS.find(d => d.path === item.path || d.page_key === item.page_key);
                    const cached = customBadgeCache[item.path];
                    const allow_excel_export = item.allow_excel_export !== undefined && item.allow_excel_export !== null
                        ? Boolean(item.allow_excel_export)
                        : (defaultDef?.allow_excel_export ?? false);
                    const allowed_excel_roles = (Array.isArray(item.allowed_excel_roles) && item.allowed_excel_roles.length > 0)
                        ? item.allowed_excel_roles
                        : (defaultDef?.allowed_excel_roles || ['ADMIN']);

                    return {
                        ...item,
                        badge_enabled: cached ? (cached.badge_enabled !== false) : (item.badge_enabled ?? true),
                        badge_text: cached ? (cached.badge_text ?? item.badge_text) : (item.badge_text || ''),
                        badge_icon: cached ? (cached.badge_icon ?? item.badge_icon) : (item.badge_icon || ''),
                        badge_color: cached ? (cached.badge_color || item.badge_color || 'blue') : (item.badge_color || 'blue'),
                        allow_excel_export,
                        allowed_excel_roles
                    };
                });
            }
        }
    } catch (e) {
        console.warn('Lỗi đọc cache local permissions:', e);
    }
    return DEFAULT_PAGE_PERMISSIONS;
}
