import { supabase } from '../../../core/lib/supabase';
import type { CampaignProgramItem } from '../types';

const STORAGE_KEY = 'saleshub_campaign_programs_v1';

export const CAMPAIGN_PROGRAM_DDL_SQL = `-- 1. TẠO BẢNG CHƯƠNG TRÌNH THI ĐUA NẾU CHƯA CÓ
CREATE TABLE IF NOT EXISTS public.campaign_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name TEXT NOT NULL DEFAULT 'ICT',
    program_name TEXT NOT NULL,
    short_name TEXT DEFAULT '',
    mapped_key TEXT DEFAULT '',
    orientation TEXT NOT NULL DEFAULT 'Chính',
    calculation_method TEXT NOT NULL DEFAULT 'Doanh thu',
    rules TEXT NOT NULL DEFAULT '',
    product_status TEXT NOT NULL DEFAULT 'Tất cả (All)',
    opportunity TEXT DEFAULT '',
    target_period TEXT DEFAULT '',
    start_date DATE,
    end_date DATE,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT DEFAULT ''
);

-- Tự động bổ sung các cột mới nếu đã có bảng trước đó
ALTER TABLE public.campaign_programs ADD COLUMN IF NOT EXISTS short_name TEXT DEFAULT '';
ALTER TABLE public.campaign_programs ADD COLUMN IF NOT EXISTS mapped_key TEXT DEFAULT '';

-- 2. KÍCH HOẠT ROW LEVEL SECURITY (RLS)
ALTER TABLE public.campaign_programs ENABLE ROW LEVEL SECURITY;

-- 3. TẠO POLICIES CHO PHÉP TRUY CẬP ĐẦY ĐỦ
DROP POLICY IF EXISTS "Public view campaign_programs" ON public.campaign_programs;
CREATE POLICY "Public view campaign_programs" ON public.campaign_programs
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all manage campaign_programs" ON public.campaign_programs;
CREATE POLICY "Allow all manage campaign_programs" ON public.campaign_programs
    FOR ALL USING (true) WITH CHECK (true);

-- 4. TẠO CHỈ MỤC INDEX TĂNG TỐC TÌM KIẾM
CREATE INDEX IF NOT EXISTS idx_campaign_programs_group ON public.campaign_programs(group_name);
CREATE INDEX IF NOT EXISTS idx_campaign_programs_active ON public.campaign_programs(is_active);
CREATE INDEX IF NOT EXISTS idx_campaign_programs_order ON public.campaign_programs(order_index);
`;

export const INITIAL_SEED_PROGRAMS: CampaignProgramItem[] = [
    {
        id: 'seed-cp-1',
        group_name: 'ICT',
        program_name: 'Thi Đua iPhone 16 Series Vượt Trội',
        orientation: 'Chính',
        calculation_method: 'DTQĐ',
        rules: 'Thưởng 150.000đ/máy khi đạt 100% target; áp dụng lũy kế toàn bộ phiên bản iPhone 16, 16 Plus, 16 Pro, 16 Pro Max. Nhân đôi điểm thi đua cho ca bán ra trên 3 máy/ngày.',
        product_status: 'Mới',
        opportunity: 'Giảm 2.500.000đ qua VNPAY/MoMo, Trợ giá thu cũ đổi mới lên đến 2.000.000đ, Tặng củ sạc nhanh 20W chính hãng và ốp lưng cao cấp.',
        target_period: 'Tháng 10/2026',
        order_index: 1,
        is_active: true
    },
    {
        id: 'seed-cp-2',
        group_name: 'Phụ kiện',
        program_name: 'Thi Đua Combo Phụ Kiện Kèm SmartPhone',
        orientation: 'Bán kèm',
        calculation_method: 'Số lượng',
        rules: 'Đạt tỷ lệ đính kèm combo (Ốp lưng + Kính cường lực + Củ sạc nhanh) ≥ 45% trên tổng số máy Smartphone bán ra trong kỳ. Thưởng nóng 30.000đ/combo thành công.',
        product_status: 'Mới',
        opportunity: 'Mua kèm điện thoại giảm giá sốc đến 35%, bảo hành 1 đổi 1 trong 12 tháng, dán màn hình miễn phí lần 2.',
        target_period: 'Tháng 10/2026',
        order_index: 2,
        is_active: true
    },
    {
        id: 'seed-cp-3',
        group_name: 'CE',
        program_name: 'Thi Đua Tivi Sony Bravia XR & Màn Hình Lớn',
        orientation: 'Chính',
        calculation_method: 'Doanh thu',
        rules: 'Tính trên doanh thu thực tế các model Tivi Sony từ 55 inch trở lên. Vượt mốc 150 triệu doanh thu thực/tháng thưởng 3% doanh số vượt.',
        product_status: 'Mới',
        opportunity: 'Tặng Loa Soundbar Sony trị giá 3.500.000đ, Miễn phí lắp đặt treo tường, Trả góp 0% lãi suất duyệt hồ sơ 5 phút.',
        target_period: 'Tháng 10/2026',
        order_index: 3,
        is_active: true
    },
    {
        id: 'seed-cp-4',
        group_name: 'Dịch vụ',
        program_name: 'Bảo Hành Mở Rộng & Bảo Hiểm Rơi Vỡ (AIG/MIC)',
        orientation: 'Bán kèm',
        calculation_method: 'SLQĐ',
        rules: 'Tỷ lệ đính kèm gói bảo hành mở rộng / rơi vỡ vào nước đạt tối thiểu 25% trên tổng số thiết bị ICT & CE. Quy đổi 1 hợp đồng = 1.5 đơn vị quy chuẩn.',
        product_status: 'Tất cả (All)',
        opportunity: 'Ưu đãi giảm 20% khi mua gói 2 năm, tặng thêm 1 tháng bảo hiểm mất cắp, hỗ trợ sửa chữa chính hãng tận nhà.',
        target_period: 'Tháng 10/2026',
        order_index: 4,
        is_active: true
    },
    {
        id: 'seed-cp-5',
        group_name: 'Dịch vụ',
        program_name: 'Thu Cũ Đổi Mới Toàn Diện (Trade-In)',
        orientation: 'Phụ',
        calculation_method: 'Số lượng',
        rules: 'Ghi nhận cho mỗi giao dịch thu cũ đổi mới thành công trên hệ thống. Nhân viên thẩm định máy chuẩn xác và chốt máy mới được cộng 100 điểm KPI.',
        product_status: 'Cũ',
        opportunity: 'Trợ giá độc quyền từ hãng lên đến 4.000.000đ cho khách hàng lên đời máy mới, thu mua máy cũ cả rơi vỡ màn hình.',
        target_period: 'Tháng 10/2026',
        order_index: 5,
        is_active: true
    },
    {
        id: 'seed-cp-6',
        group_name: 'Gia dụng',
        program_name: 'Thi Đua Máy Lạnh Inverter & Thiết Bị Gia Đình',
        orientation: 'Chính',
        calculation_method: 'Doanh thu',
        rules: 'Áp dụng cho các dòng máy lạnh Daikin, Panasonic, Casper Inverter tiết kiệm điện. Đạt 10 bộ/tháng nhận huy hiệu Top Chuyên Gia Gia Dụng.',
        product_status: 'Mới',
        opportunity: 'Bao trọn gói công lắp đặt & 5m ống đồng, Tặng 1 lần vệ sinh máy lạnh miễn phí trong năm đầu, Bảo hành máy nén 5 năm.',
        target_period: 'Tháng 10/2026',
        order_index: 6,
        is_active: true
    }
];

export async function checkCampaignProgramTableReady(): Promise<{ exists: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('campaign_programs').select('id').limit(1);
        if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('not find')) {
                return { exists: false, error: 'Chưa tạo bảng campaign_programs trên Supabase' };
            }
            return { exists: false, error: error.message };
        }
        return { exists: true };
    } catch (e: any) {
        return { exists: false, error: e?.message || 'Không thể kết nối Supabase' };
    }
}

export function getLocalCampaignPrograms(): CampaignProgramItem[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn('Lỗi đọc local campaign programs:', e);
    }
    return INITIAL_SEED_PROGRAMS;
}

export function setLocalCampaignPrograms(items: CampaignProgramItem[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
        console.warn('Lỗi lưu local campaign programs:', e);
    }
}

export async function fetchCampaignPrograms(): Promise<{
    data: CampaignProgramItem[];
    source: 'cloud' | 'local';
    cloudReady: boolean;
    error?: string;
}> {
    const localData = getLocalCampaignPrograms();
    try {
        const { exists, error: checkErr } = await checkCampaignProgramTableReady();
        if (!exists) {
            return {
                data: localData,
                source: 'local',
                cloudReady: false,
                error: checkErr
            };
        }

        const { data, error } = await supabase
            .from('campaign_programs')
            .select('*')
            .order('order_index', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            const mapped: CampaignProgramItem[] = data.map((d: any) => ({
                id: d.id,
                group_name: d.group_name || 'ICT',
                program_name: d.program_name || '',
                short_name: d.short_name || '',
                mapped_key: d.mapped_key || '',
                orientation: d.orientation || 'Chính',
                calculation_method: d.calculation_method || 'Doanh thu',
                rules: d.rules || '',
                product_status: d.product_status || 'Tất cả (All)',
                opportunity: d.opportunity || '',
                target_period: d.target_period || '',
                start_date: d.start_date || '',
                end_date: d.end_date || '',
                order_index: d.order_index ?? 0,
                is_active: d.is_active !== false,
                created_at: d.created_at,
                updated_at: d.updated_at,
                created_by: d.created_by || ''
            }));
            setLocalCampaignPrograms(mapped);
            return { data: mapped, source: 'cloud', cloudReady: true };
        } else {
            // Cloud trống -> Tự động nạp seed data lên cloud
            await batchUpsertCampaignPrograms(localData);
            return { data: localData, source: 'local', cloudReady: true };
        }
    } catch (e: any) {
        console.warn('Fallback to local campaign programs:', e);
        return {
            data: localData,
            source: 'local',
            cloudReady: false,
            error: e?.message
        };
    }
}

export async function saveCampaignProgram(
    item: Partial<CampaignProgramItem>
): Promise<{ success: boolean; data?: CampaignProgramItem; error?: string }> {
    const localList = getLocalCampaignPrograms();
    const id = item.id || `cp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const fullItem: CampaignProgramItem = {
        id,
        group_name: item.group_name || 'ICT',
        program_name: item.program_name || 'Chương trình mới',
        short_name: item.short_name || '',
        mapped_key: item.mapped_key || '',
        orientation: item.orientation || 'Chính',
        calculation_method: item.calculation_method || 'Doanh thu',
        rules: item.rules || '',
        product_status: item.product_status || 'Tất cả (All)',
        opportunity: item.opportunity || '',
        target_period: item.target_period || '',
        start_date: item.start_date || '',
        end_date: item.end_date || '',
        order_index: item.order_index ?? (localList.length + 1),
        is_active: item.is_active !== false,
        created_at: item.created_at || now,
        updated_at: now,
        created_by: item.created_by || ''
    };

    // 1. Cập nhật LocalStorage trước để phản hồi tức thì
    const existingIndex = localList.findIndex(x => x.id === id);
    let updatedLocal: CampaignProgramItem[];
    if (existingIndex >= 0) {
        updatedLocal = [...localList];
        updatedLocal[existingIndex] = fullItem;
    } else {
        updatedLocal = [fullItem, ...localList];
    }
    setLocalCampaignPrograms(updatedLocal);

    // 2. Đồng bộ Supabase nếu sẵn sàng
    try {
        const { exists } = await checkCampaignProgramTableReady();
        if (exists) {
            const dbPayload = {
                id: fullItem.id,
                group_name: fullItem.group_name,
                program_name: fullItem.program_name,
                short_name: fullItem.short_name || '',
                mapped_key: fullItem.mapped_key || '',
                orientation: fullItem.orientation,
                calculation_method: fullItem.calculation_method,
                rules: fullItem.rules,
                product_status: fullItem.product_status,
                opportunity: fullItem.opportunity,
                target_period: fullItem.target_period,
                start_date: fullItem.start_date || null,
                end_date: fullItem.end_date || null,
                order_index: fullItem.order_index,
                is_active: fullItem.is_active,
                updated_at: now,
                created_by: fullItem.created_by
            };
            const { error } = await supabase.from('campaign_programs').upsert(dbPayload);
            if (error) console.warn('Supabase upsert failed:', error);
        }
    } catch (e) {
        console.warn('Supabase sync error on save:', e);
    }

    return { success: true, data: fullItem };
}

export async function batchUpsertCampaignPrograms(
    items: CampaignProgramItem[]
): Promise<{ success: boolean; count: number; error?: string }> {
    setLocalCampaignPrograms(items);
    try {
        const { exists } = await checkCampaignProgramTableReady();
        if (exists) {
            const payload = items.map(item => ({
                id: item.id.startsWith('seed-') ? undefined : item.id,
                group_name: item.group_name,
                program_name: item.program_name,
                short_name: item.short_name || '',
                mapped_key: item.mapped_key || '',
                orientation: item.orientation,
                calculation_method: item.calculation_method,
                rules: item.rules,
                product_status: item.product_status,
                opportunity: item.opportunity,
                target_period: item.target_period,
                start_date: item.start_date || null,
                end_date: item.end_date || null,
                order_index: item.order_index,
                is_active: item.is_active,
                updated_at: new Date().toISOString()
            }));
            const { error } = await supabase.from('campaign_programs').upsert(payload);
            if (error) throw error;
        }
        return { success: true, count: items.length };
    } catch (e: any) {
        console.warn('Batch upsert error:', e);
        return { success: true, count: items.length, error: e?.message };
    }
}

export async function deleteCampaignProgram(id: string): Promise<{ success: boolean; error?: string }> {
    const localList = getLocalCampaignPrograms();
    const updated = localList.filter(x => x.id !== id);
    setLocalCampaignPrograms(updated);

    try {
        const { exists } = await checkCampaignProgramTableReady();
        if (exists) {
            await supabase.from('campaign_programs').delete().eq('id', id);
        }
    } catch (e: any) {
        console.warn('Lỗi xóa trên Supabase:', e);
    }
    return { success: true };
}
