import { supabase } from './supabase';
import type { UserRole } from '../../shared/contexts/AuthContext';

export interface SystemPagePermission {
    id?: string;
    page_key: string;
    page_name: string;
    path: string;
    group_title: string;
    description?: string;
    is_enabled: boolean;
    allowed_roles: UserRole[];
    order_index: number;
    updated_at?: string;
}

export const DEFAULT_PAGE_PERMISSIONS: SystemPagePermission[] = [
    // BÁO CÁO KINH DOANH
    {
        page_key: 'bc_ngay',
        page_name: 'BC Ngày (Realtime)',
        path: '/bc-ngay/tong-quan',
        group_title: 'BÁO CÁO KINH DOANH',
        description: 'Báo cáo doanh thu & sản lượng theo thời gian thực trong ngày',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 1
    },
    {
        page_key: 'bc_doanh_thu_nv_ngay',
        page_name: 'BC Doanh Thu NV Ngày',
        path: '/bc-ngay-nhan-vien',
        group_title: 'BÁO CÁO KINH DOANH',
        description: 'Báo cáo doanh thu nhân viên ngày, xếp hạng Top 30% và nhắc nhở tăng tốc',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 2
    },
    {
        page_key: 'bc_thang',
        page_name: 'BC Tháng (Lũy kế)',
        path: '/bc-thang/tong-quan',
        group_title: 'BÁO CÁO KINH DOANH',
        description: 'Báo cáo tiến độ lũy kế tháng & dự kiến hoàn thành mục tiêu',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 2
    },
    {
        page_key: 'hieu_qua_nv',
        page_name: 'Hiệu quả NV lũy kế',
        path: '/bao-cao-hieu-qua-nhan-vien',
        group_title: 'BÁO CÁO KINH DOANH',
        description: 'Đánh giá năng suất, doanh thu và thi đua từng nhân sự',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 3
    },
    {
        page_key: 'tong_hop_thi_dua',
        page_name: 'Tổng hợp thi đua',
        path: '/tong-hop-thi-dua',
        group_title: 'BÁO CÁO KINH DOANH',
        description: 'Tổng hợp tiến độ hoàn thành các chương trình thi đua trọng điểm',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'],
        order_index: 4
    },
    {
        page_key: 'nhip_doanh_thu',
        page_name: 'Nhịp Doanh Thu',
        path: '/nhip-doanh-thu',
        group_title: 'BÁO CÁO KINH DOANH',
        description: 'Biểu đồ phân tích nhịp bán và xu hướng dòng tiền',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 5
    },
    // DỮ LIỆU & PHIÊN LÀM VIỆC
    {
        page_key: 'cap_nhat_so_lieu',
        page_name: 'Cập nhật số liệu',
        path: '/cap-nhat',
        group_title: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
        description: 'Nạp dữ liệu báo cáo kinh doanh từ Excel hoặc dán nhanh',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 6
    },
    {
        page_key: 'cap_nhat_luy_ke_nv',
        page_name: 'Cập nhật số liệu NV',
        path: '/cap-nhat-luy-ke-nhan-vien',
        group_title: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
        description: 'Nạp dữ liệu lũy kế cá nhân nhân viên theo ca/ngày',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 7
    },
    {
        page_key: 'quan_ly_phien_nv',
        page_name: 'Phiên dữ liệu NV',
        path: '/quan-ly-phien-nhan-vien',
        group_title: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
        description: 'Lịch sử và danh sách các phiên cập nhật dữ liệu nhân sự',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 8
    },
    {
        page_key: 'quan_ly_du_lieu_st',
        page_name: 'Quản lý bản ghi ST',
        path: '/quan-ly-du-lieu',
        group_title: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
        description: 'Tra cứu, lọc và dọn dẹp các bản ghi số liệu siêu thị',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY', 'TRUONG_CA'],
        order_index: 9
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
        order_index: 10
    },
    {
        page_key: 'cau_hinh_thi_dua',
        page_name: 'Từ viết tắt thi đua',
        path: '/cau-hinh-thi-dua',
        group_title: 'HỆ THỐNG & CẤU HÌNH',
        description: 'Từ điển mã gốc báo cáo sang tên viết tắt thân thiện',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY'],
        order_index: 11
    },
    {
        page_key: 'muc_tieu_nv',
        page_name: 'Mục tiêu nhân viên',
        path: '/muc-tieu-nhan-vien',
        group_title: 'HỆ THỐNG & CẤU HÌNH',
        description: 'Thiết lập chỉ tiêu doanh thu và KPI thi đua cho từng nhân sự',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY'],
        order_index: 12
    },
    {
        page_key: 'quan_ly_tai_khoan',
        page_name: 'Quản lý Tài khoản (User)',
        path: '/quan-ly-tai-khoan',
        group_title: 'HỆ THỐNG & CẤU HÌNH',
        description: 'Quản trị danh sách người dùng, đặt lại mật khẩu và duyệt đăng ký',
        is_enabled: true,
        allowed_roles: ['ADMIN'],
        order_index: 13
    },
    {
        page_key: 'phan_quyen_sieu_thi',
        page_name: 'Phân quyền Siêu thị',
        path: '/phan-quyen-sieu-thi',
        group_title: 'HỆ THỐNG & CẤU HÌNH',
        description: 'Theo dõi & phân quyền danh sách siêu thị được phép xem của các tài khoản',
        is_enabled: true,
        allowed_roles: ['ADMIN', 'QUAN_LY'],
        order_index: 14
    },
    {
        page_key: 'quan_tri_he_thong',
        page_name: 'Quản trị Hệ Thống (Admin)',
        path: '/quan-tri-he-thong',
        group_title: 'HỆ THỐNG & CẤU HÌNH',
        description: 'Quản lý trạng thái hoạt động & phân quyền các trang tiện ích',
        is_enabled: true,
        allowed_roles: ['ADMIN'],
        order_index: 15
    }
];

const LOCAL_STORAGE_KEY = 'saleshub_system_page_permissions_v1';

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
    order_index INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Kích hoạt RLS
ALTER TABLE public.system_page_permissions ENABLE ROW LEVEL SECURITY;

-- Cho phép đọc công khai
DROP POLICY IF EXISTS "Allow read system_page_permissions" ON public.system_page_permissions;
CREATE POLICY "Allow read system_page_permissions" ON public.system_page_permissions FOR SELECT USING (true);

-- Cho phép cập nhật/thêm mới
DROP POLICY IF EXISTS "Allow all system_page_permissions" ON public.system_page_permissions;
CREATE POLICY "Allow all system_page_permissions" ON public.system_page_permissions FOR ALL USING (true);
`;

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
            const mapped: SystemPagePermission[] = data.map((item: any) => ({
                id: item.id,
                page_key: item.page_key,
                page_name: item.page_name,
                path: item.path,
                group_title: item.group_title,
                description: item.description,
                is_enabled: Boolean(item.is_enabled),
                allowed_roles: (item.allowed_roles || []) as UserRole[],
                order_index: Number(item.order_index) || 1,
                updated_at: item.updated_at
            }));

            // Tự động hợp nhất các trang hệ thống mới trong DEFAULT_PAGE_PERMISSIONS nếu Supabase thiếu
            const existingKeys = new Set(mapped.map(m => m.page_key));
            const existingPaths = new Set(mapped.map(m => m.path));
            const missingDefaults = DEFAULT_PAGE_PERMISSIONS.filter(
                def => !existingKeys.has(def.page_key) && !existingPaths.has(def.path)
            );
            if (missingDefaults.length > 0) {
                mapped.push(...missingDefaults);
                mapped.sort((a, b) => a.order_index - b.order_index);

                // Đồng bộ bổ sung các trang thiếu lên Supabase trong nền
                try {
                    supabase.from('system_page_permissions').upsert(
                        missingDefaults.map(d => ({
                            page_key: d.page_key,
                            page_name: d.page_name,
                            path: d.path,
                            group_title: d.group_title,
                            description: d.description,
                            is_enabled: d.is_enabled,
                            allowed_roles: d.allowed_roles,
                            order_index: d.order_index
                        })),
                        { onConflict: 'page_key' }
                    ).then(() => {});
                } catch {
                    // Safe fallback
                }
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
 * Kiểm tra xem bảng system_page_permissions đã tồn tại trên Supabase hay chưa
 */
export async function checkSupabasePermissionsTable(): Promise<{ exists: boolean; count: number; error?: string }> {
    try {
        const { count, error } = await supabase
            .from('system_page_permissions')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return { exists: false, count: 0, error: error.message };
        }

        return { exists: true, count: count ?? 0 };
    } catch (err: any) {
        return { exists: false, count: 0, error: err?.message || String(err) };
    }
}

/**
 * Lưu cấu hình phân quyền lên Supabase và cache local
 */
export async function saveSystemPagePermissions(permissions: SystemPagePermission[]): Promise<{ success: boolean; fromSupabase: boolean; error?: string }> {
    // 1. Luôn lưu cache local trước để trải nghiệm người dùng mượt mà ngay lập tức
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(permissions));
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
            order_index: p.order_index,
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('system_page_permissions')
            .upsert(payloads, { onConflict: 'page_key' });

        if (error) {
            console.warn('Cảnh báo khi lưu Supabase system_page_permissions (chưa tạo bảng hoặc lỗi RLS):', error.message);
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
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Đảm bảo các trang mới luôn có mặt trong danh sách
                const currentPaths = new Set(parsed.map((p: any) => p.path));
                const missingDefaults = DEFAULT_PAGE_PERMISSIONS.filter(d => !currentPaths.has(d.path));
                return [...parsed, ...missingDefaults];
            }
        }
    } catch (e) {
        console.warn('Lỗi đọc cache local permissions:', e);
    }
    return DEFAULT_PAGE_PERMISSIONS;
}
