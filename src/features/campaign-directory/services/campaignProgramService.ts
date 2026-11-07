import { supabase } from '../../../core/lib/supabase';
import type { CampaignProgramItem } from '../types';

// Dọn dẹp key cache cũ (nếu có) để đảm bảo 100% sử dụng Cloud, không dùng LocalStorage
try {
    localStorage.removeItem('saleshub_campaign_programs_v1');
} catch {
    // Ignore error in non-browser environment
}

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

/**
 * Kiểm tra tính sẵn sàng của bảng campaign_programs trên Supabase Cloud
 */
export async function checkCampaignProgramTableReady(): Promise<{ exists: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('campaign_programs').select('id').limit(1);
        if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('not find')) {
                return { exists: false, error: 'Chưa tạo bảng campaign_programs trên Cloud' };
            }
            return { exists: false, error: error.message };
        }
        return { exists: true };
    } catch (e: any) {
        return { exists: false, error: e?.message || 'Không thể kết nối Cloud' };
    }
}

/**
 * Nạp danh sách chương trình thi đua trực tiếp 100% từ Supabase Cloud
 * (Tuyệt đối không dùng LocalStorage, không tự ý nạp lại seed data khi Admin đã xóa trống)
 */
export async function fetchCampaignPrograms(): Promise<{
    data: CampaignProgramItem[];
    source: 'cloud';
    cloudReady: boolean;
    error?: string;
}> {
    try {
        const { exists, error: checkErr } = await checkCampaignProgramTableReady();
        if (!exists) {
            return {
                data: [],
                source: 'cloud',
                cloudReady: false,
                error: checkErr || 'Bảng campaign_programs chưa sẵn sàng trên Cloud'
            };
        }

        const { data, error } = await supabase
            .from('campaign_programs')
            .select('*')
            .order('order_index', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped: CampaignProgramItem[] = (data || []).map((d: any) => ({
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

        return { data: mapped, source: 'cloud', cloudReady: true };
    } catch (e: any) {
        console.error('Lỗi nạp chương trình thi đua từ Cloud:', e);
        return {
            data: [],
            source: 'cloud',
            cloudReady: false,
            error: e?.message || 'Không thể nạp dữ liệu từ Cloud'
        };
    }
}

/**
 * Lưu/Cập nhật 1 chương trình thi đua trực tiếp lên Supabase Cloud
 */
export async function saveCampaignProgram(
    item: Partial<CampaignProgramItem>
): Promise<{ success: boolean; data?: CampaignProgramItem; error?: string }> {
    try {
        const now = new Date().toISOString();
        const isUuid = item.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);

        const dbPayload: any = {
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
            start_date: item.start_date || null,
            end_date: item.end_date || null,
            order_index: item.order_index ?? 0,
            is_active: item.is_active !== false,
            updated_at: now,
            created_by: item.created_by || ''
        };

        if (isUuid) {
            dbPayload.id = item.id;
        }

        const { data, error } = await supabase
            .from('campaign_programs')
            .upsert(dbPayload)
            .select('*')
            .single();

        if (error) {
            console.error('Lỗi Supabase khi lưu chương trình:', error);
            return { success: false, error: error.message };
        }

        const savedItem: CampaignProgramItem = {
            id: data.id,
            group_name: data.group_name || 'ICT',
            program_name: data.program_name || '',
            short_name: data.short_name || '',
            mapped_key: data.mapped_key || '',
            orientation: data.orientation || 'Chính',
            calculation_method: data.calculation_method || 'Doanh thu',
            rules: data.rules || '',
            product_status: data.product_status || 'Tất cả (All)',
            opportunity: data.opportunity || '',
            target_period: data.target_period || '',
            start_date: data.start_date || '',
            end_date: data.end_date || '',
            order_index: data.order_index ?? 0,
            is_active: data.is_active !== false,
            created_at: data.created_at,
            updated_at: data.updated_at,
            created_by: data.created_by || ''
        };

        return { success: true, data: savedItem };
    } catch (e: any) {
        console.error('Lỗi ngoại lệ khi lưu chương trình lên Cloud:', e);
        return { success: false, error: e?.message || 'Không thể lưu chương trình lên Cloud' };
    }
}

/**
 * Lưu hàng loạt chương trình thi đua trực tiếp lên Supabase Cloud
 * @param items Danh sách chương trình cần lưu
 * @param replaceAll Nếu true, xóa sạch danh sách cũ trên Cloud trước khi nạp
 */
export async function batchUpsertCampaignPrograms(
    items: CampaignProgramItem[],
    replaceAll: boolean = false
): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        if (replaceAll) {
            const { error: delErr } = await supabase
                .from('campaign_programs')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            if (delErr) {
                console.warn('Lỗi xóa dữ liệu cũ khi replaceAll:', delErr);
            }
        }

        if (items.length === 0) {
            return { success: true, count: 0 };
        }

        const payload = items.map((item, idx) => {
            const isUuid = item.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
            return {
                ...(isUuid ? { id: item.id } : {}),
                group_name: item.group_name || 'ICT',
                program_name: item.program_name || '',
                short_name: item.short_name || '',
                mapped_key: item.mapped_key || '',
                orientation: item.orientation || 'Chính',
                calculation_method: item.calculation_method || 'Doanh thu',
                rules: item.rules || '',
                product_status: item.product_status || 'Tất cả (All)',
                opportunity: item.opportunity || '',
                target_period: item.target_period || '',
                start_date: item.start_date || null,
                end_date: item.end_date || null,
                order_index: item.order_index ?? (idx + 1),
                is_active: item.is_active !== false,
                updated_at: new Date().toISOString()
            };
        });

        const { error } = await supabase.from('campaign_programs').upsert(payload);
        if (error) throw error;

        return { success: true, count: items.length };
    } catch (e: any) {
        console.error('Batch upsert error trên Cloud:', e);
        return { success: false, count: 0, error: e?.message || 'Lỗi lưu hàng loạt lên Cloud' };
    }
}

/**
 * Xóa 1 chương trình thi đua trực tiếp từ Supabase Cloud
 */
export async function deleteCampaignProgram(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('campaign_programs').delete().eq('id', id);
        if (error) {
            console.error('Lỗi xóa trên Cloud:', error);
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (e: any) {
        console.error('Lỗi xóa chương trình trên Cloud:', e);
        return { success: false, error: e?.message || 'Không thể xóa trên Cloud' };
    }
}

/**
 * Nạp thủ công 6 chương trình thi đua mẫu lên Cloud (Chỉ kích hoạt khi Admin chủ động bấm)
 */
export async function seedSampleCampaignPrograms(): Promise<{ success: boolean; count: number; error?: string }> {
    return await batchUpsertCampaignPrograms(INITIAL_SEED_PROGRAMS, false);
}
