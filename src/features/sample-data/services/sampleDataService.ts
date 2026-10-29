import { supabase } from '../../../core/lib/supabase';
import type { SampleDataGroup, SampleDataItem } from '../types';

const LOCAL_STORAGE_KEY = 'saleshub_sample_data_groups_cache';

export const SAMPLE_DATA_SQL_DDL = `-- =========================================================================
-- KHỞI TẠO BẢNG DỮ LIỆU MẪU THAM CHIẾU HỆ THỐNG SALES HUB
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.sample_data_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_key TEXT UNIQUE NOT NULL,
    group_title TEXT NOT NULL,
    description TEXT DEFAULT '',
    order_index INTEGER NOT NULL DEFAULT 1,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_by TEXT DEFAULT NULL
);

-- BẬT ROW LEVEL SECURITY
ALTER TABLE public.sample_data_groups ENABLE ROW LEVEL SECURITY;

-- CHÍNH SÁCH BẢO MẬT (ĐỒNG BỘ VỚI HỆ THỐNG SALES HUB)
DROP POLICY IF EXISTS "Cho phép Admin toàn quyền quản lý dữ liệu mẫu" ON public.sample_data_groups;
DROP POLICY IF EXISTS "sample_data_groups_all_policy" ON public.sample_data_groups;

CREATE POLICY "sample_data_groups_all_policy"
    ON public.sample_data_groups
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sample_data_groups_order ON public.sample_data_groups (order_index ASC);
`;

export const DEFAULT_SEED_SAMPLE_GROUPS: SampleDataGroup[] = [
    {
        id: 'seed-realtime-group',
        group_key: 'realtime_report',
        group_title: 'Báo cáo Realtime trong ngày',
        description: 'Dữ liệu mẫu dán vào /bc-ngay/tong-quan để kiểm tra tính toán Target ngày & %HT',
        order_index: 1,
        items: [
            {
                id: 'item-rt-emulation',
                label: 'Dữ liệu Thi đua Realtime',
                sample_text: `BẢO HIỂM THỢ ĐMX	12	15	80.0%
BẢO_HIỂM	5	8	62.5%
ĐIỆN THOẠI & TABLET ANDROID	25	30	83.3%
TABLET ANDROID	4	6	66.7%
GALAXY S.Z	3	5	60.0%
MANGO_iCALLME	8	10	80.0%`,
                note: 'Dữ liệu kiểm tra phân tách BẢO_HIỂM vs BẢO_HIỂM_ĐMX, ICT_ANDROID vs TABLET_ANDROID',
                updated_at: new Date().toISOString()
            },
            {
                id: 'item-rt-revenue',
                label: 'Dữ liệu Doanh thu quy đổi Realtime',
                sample_text: `TỔNG TOÀN CỤM	385.5	450.0	85.7%
10335 - TGDĐ Trương Công Định	125.0	150.0	83.3%
8842 - ĐMX Ba Cu	160.5	180.0	89.2%
1204 - AAR Nguyễn An Ninh	100.0	120.0	83.3%`,
                note: 'Dữ liệu mẫu doanh thu quy đổi (đơn vị triệu đồng)',
                updated_at: new Date().toISOString()
            },
            {
                id: 'item-rt-installment',
                label: 'Dữ liệu Doanh thu trả góp',
                sample_text: `TỔNG TOÀN CỤM	145.2	37.7%
10335 - TGDĐ Trương Công Định	48.5	38.8%
8842 - ĐMX Ba Cu	62.0	38.6%
1204 - AAR Nguyễn An Ninh	34.7	34.7%`,
                note: 'Dữ liệu mẫu doanh thu và % tỷ lệ trả góp',
                updated_at: new Date().toISOString()
            }
        ]
    },
    {
        id: 'seed-cumulative-group',
        group_key: 'cumulative_month',
        group_title: 'Báo cáo Lũy kế tháng & Thi đua nhân sự',
        description: 'Dữ liệu mẫu dùng cho /tong-hop-thi-dua và /xep-hang-doanh-thu-luy-ke',
        order_index: 2,
        items: [
            {
                id: 'item-cum-progress',
                label: 'Báo cáo Tiến độ kinh doanh siêu thị',
                sample_text: `STT	Mã ST	Tên siêu thị	DTQĐ Thực tế	Target Tháng	% Hoàn thành
1	10335	TGD_290_TRUONG_CONG_DINH	1450.5	1800.0	80.6%
2	8842	DMX_45_BA_CU	2100.0	2500.0	84.0%
3	1204	AAR_290_TRUONG_CONG_DINH	980.0	1200.0	81.7%`,
                note: 'Dữ liệu mẫu chốt lũy kế tháng',
                updated_at: new Date().toISOString()
            },
            {
                id: 'item-cum-emp',
                label: 'Thi đua Lũy kế cá nhân nhân viên',
                sample_text: `Mã NV	Họ và Tên	Siêu thị	DTQĐ	Bảo hiểm	ICT Android	Tablet
142857	Nguyễn Phương Nam	10335	185.5	12	8	3
987654	Trần Thị Kim Cúc	8842	210.0	15	10	5
345678	Lê Quang Vinh	1204	160.2	9	7	2`,
                note: 'Dữ liệu mẫu xếp hạng doanh thu và thi đua nhân sự',
                updated_at: new Date().toISOString()
            }
        ]
    },
    {
        id: 'seed-attendance-group',
        group_key: 'work_hours_shifts',
        group_title: 'Giờ công & Phân ca làm việc',
        description: 'Dữ liệu mẫu dùng cho bảng ca trực, tỷ lệ công và kiểm tra sức khỏe nhân viên',
        order_index: 3,
        items: [
            {
                id: 'item-att-shifts',
                label: 'Dữ liệu Chấm công & Giờ công thực tế',
                sample_text: `Mã NV	Họ Tên	Ca trực	Giờ công TT	Công chuẩn	Tỷ lệ công
142857	Nguyễn Phương Nam	Ca 1	192	208	92.3%
987654	Trần Thị Kim Cúc	Ca 2	208	208	100.0%
345678	Lê Quang Vinh	Ca 1	180	208	86.5%`,
                note: 'Dữ liệu tham chiếu giờ công nhân viên',
                updated_at: new Date().toISOString()
            }
        ]
    },
    {
        id: 'seed-inventory-group',
        group_key: 'inventory_balancing',
        group_title: 'Cân tồn kho & Xin hàng',
        description: 'Dữ liệu mẫu dùng cho trang /can-ton-kho',
        order_index: 4,
        items: [
            {
                id: 'item-inv-stock',
                label: 'Danh mục Tồn kho chi tiết',
                sample_text: `Mã SP	Tên sản phẩm	Kho TGDĐ	Kho ĐMX	Kho AAR	Tổng tồn
01358	iPhone 16 Pro Max 256GB	0	3	2	5
02469	Samsung Galaxy S25 Ultra	1	0	2	3
03571	iPad Air M2 11 inch Wifi	0	0	4	4`,
                note: 'Dữ liệu mẫu kiểm tra logic cân đối tồn kho',
                updated_at: new Date().toISOString()
            }
        ]
    }
];

export function getLocalSampleGroups(): SampleDataGroup[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch {
        // ignore
    }
    return DEFAULT_SEED_SAMPLE_GROUPS;
}

export function setLocalSampleGroups(groups: SampleDataGroup[]) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(groups));
    } catch {
        // ignore
    }
}

export async function checkSampleDataTableReady(): Promise<{ isReady: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('sample_data_groups').select('id').limit(1);
        if (error) {
            if (error.code === 'PGRST205' || error.message.includes('relation "public.sample_data_groups" does not exist')) {
                return { isReady: false, error: 'Bảng sample_data_groups chưa được tạo trên Supabase' };
            }
            return { isReady: false, error: error.message };
        }
        return { isReady: true };
    } catch (e: any) {
        return { isReady: false, error: e?.message || 'Không thể kết nối Supabase' };
    }
}

export async function fetchSampleDataGroups(): Promise<{
    groups: SampleDataGroup[];
    source: 'SUPABASE_CLOUD' | 'LOCAL_CACHE';
    isTableReady: boolean;
    error?: string;
}> {
    const local = getLocalSampleGroups();

    try {
        const { data, error } = await supabase
            .from('sample_data_groups')
            .select('*')
            .order('order_index', { ascending: true });

        if (error) {
            const isMissingTable = error.code === 'PGRST205' || error.message.includes('relation "public.sample_data_groups" does not exist');
            return {
                groups: local,
                source: 'LOCAL_CACHE',
                isTableReady: !isMissingTable,
                error: error.message
            };
        }

        if (Array.isArray(data) && data.length > 0) {
            const mapped: SampleDataGroup[] = data.map(d => ({
                id: d.id,
                group_key: d.group_key,
                group_title: d.group_title,
                description: d.description || '',
                order_index: d.order_index || 1,
                items: Array.isArray(d.items) ? d.items : [],
                created_at: d.created_at,
                updated_at: d.updated_at,
                updated_by: d.updated_by
            }));
            setLocalSampleGroups(mapped);
            return {
                groups: mapped,
                source: 'SUPABASE_CLOUD',
                isTableReady: true
            };
        }

        // Nếu bảng trống, khởi tạo dữ liệu mẫu mặc định lên Cloud
        await saveAllSampleDataGroups(DEFAULT_SEED_SAMPLE_GROUPS);
        setLocalSampleGroups(DEFAULT_SEED_SAMPLE_GROUPS);
        return {
            groups: DEFAULT_SEED_SAMPLE_GROUPS,
            source: 'SUPABASE_CLOUD',
            isTableReady: true
        };
    } catch (e: any) {
        return {
            groups: local,
            source: 'LOCAL_CACHE',
            isTableReady: false,
            error: e?.message || 'Lỗi mạng khi tải dữ liệu'
        };
    }
}

export async function saveSampleDataGroup(group: SampleDataGroup, userEmail?: string): Promise<{ success: boolean; error?: string }> {
    const local = getLocalSampleGroups();
    const idx = local.findIndex(g => g.id === group.id || g.group_key === group.group_key);
    const updated = {
        ...group,
        updated_at: new Date().toISOString(),
        updated_by: userEmail || 'ADMIN'
    };

    if (idx >= 0) {
        local[idx] = updated;
    } else {
        local.push(updated);
    }
    setLocalSampleGroups(local);

    try {
        const payload = {
            group_key: updated.group_key,
            group_title: updated.group_title,
            description: updated.description || '',
            order_index: updated.order_index || 1,
            items: updated.items || [],
            updated_at: updated.updated_at,
            updated_by: updated.updated_by
        };

        const { error } = await supabase
            .from('sample_data_groups')
            .upsert([payload], { onConflict: 'group_key' });

        if (error) {
            console.warn('Lỗi ghi Supabase sample_data_groups:', error.message);
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message };
    }
}

export async function saveAllSampleDataGroups(groups: SampleDataGroup[], userEmail?: string): Promise<{ success: boolean; error?: string }> {
    const updatedGroups = groups.map((g, i) => ({
        ...g,
        order_index: i + 1,
        updated_at: new Date().toISOString(),
        updated_by: userEmail || 'ADMIN'
    }));
    setLocalSampleGroups(updatedGroups);

    try {
        const payload = updatedGroups.map(g => ({
            group_key: g.group_key,
            group_title: g.group_title,
            description: g.description || '',
            order_index: g.order_index,
            items: g.items || [],
            updated_at: g.updated_at,
            updated_by: g.updated_by
        }));

        const { error } = await supabase
            .from('sample_data_groups')
            .upsert(payload, { onConflict: 'group_key' });

        if (error) {
            console.warn('Lỗi lưu toàn bộ sample_data_groups lên Cloud:', error.message);
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message };
    }
}

export async function deleteSampleDataGroup(groupKey: string): Promise<{ success: boolean; error?: string }> {
    const local = getLocalSampleGroups().filter(g => g.group_key !== groupKey);
    setLocalSampleGroups(local);

    try {
        const { error } = await supabase
            .from('sample_data_groups')
            .delete()
            .eq('group_key', groupKey);

        if (error) {
            console.warn('Lỗi xóa sample_data_group trên Supabase:', error.message);
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message };
    }
}

