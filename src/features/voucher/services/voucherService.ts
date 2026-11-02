import { supabase } from '../../../core/lib/supabase';
import { isStoreMatch } from '../../../core/lib/formatters';
import type {
    VoucherItem,
    VoucherClaimRequest,
    VoucherCampaignSummary,
    VoucherHoardingAlert,
    DenominationStock,
    VoucherDistributionRule,
    VoucherDistributionConfig,
    VoucherCampaignStatusConfig
} from '../types';

export const STORAGE_KEY = 'saleshub_store_vouchers_v1';
export const DISTRIBUTION_CONFIG_STORAGE_KEY = 'saleshub_voucher_distribution_config';
export const CAMPAIGN_STATUS_STORAGE_KEY = 'saleshub_voucher_campaign_statuses';

/**
 * Tự động xóa sạch toàn bộ cache dữ liệu voucher cũ khỏi LocalStorage của thiết bị.
 * Mục đích: Đảm bảo 100% Cloud-Only, không để dữ liệu cũ tồn đọng gây sai lệch tồn kho hay hồi sinh mã đã xóa.
 */
export function cleanupLegacyLocalStorageVouchers(): void {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(DISTRIBUTION_CONFIG_STORAGE_KEY);
            localStorage.removeItem(CAMPAIGN_STATUS_STORAGE_KEY);
        }
    } catch (e) {
        console.warn('Lỗi dọn dẹp cache local voucher:', e);
    }
}

export const DEFAULT_VOUCHER_DISTRIBUTION_CONFIG: VoucherDistributionConfig = {
    rule_type: 'FIFO',
    description: 'Ưu tiên cấp mã nhập kho trước, xuất kho trước (First In First Out)',
    updated_by: 'Hệ thống'
};

export const STORE_VOUCHERS_SQL = `-- ========================================================
-- 1. TẠO BẢNG LƯU TRỮ KHO MÃ VOUCHER TRÊN SUPABASE CLOUD
-- Vui lòng chạy lệnh này trong Supabase Dashboard -> SQL Editor
-- ========================================================
CREATE TABLE IF NOT EXISTS public.store_vouchers (
    id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    campaign_name TEXT NOT NULL,
    denomination NUMERIC NOT NULL,
    code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE',
    expires_at DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    claimed_at TIMESTAMPTZ,
    claimed_by_id TEXT,
    claimed_by_name TEXT,
    claimed_by_store TEXT,
    order_id TEXT,
    used_at TIMESTAMPTZ,
    note TEXT,
    description TEXT
);

-- Kích hoạt RLS & chính sách truy cập công khai/anon
ALTER TABLE public.store_vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_vouchers_all_policy" ON public.store_vouchers;
CREATE POLICY "store_vouchers_all_policy" 
ON public.store_vouchers FOR ALL USING (true) WITH CHECK (true);

-- Đảm bảo tương thích ngược: tự động thêm cột description nếu bảng đã được tạo trước đó
ALTER TABLE public.store_vouchers ADD COLUMN IF NOT EXISTS description TEXT;

-- Index tăng tốc tra cứu dữ liệu
CREATE INDEX IF NOT EXISTS idx_store_vouchers_store_status ON public.store_vouchers(store_name, status);
CREATE INDEX IF NOT EXISTS idx_store_vouchers_code ON public.store_vouchers(code);
CREATE INDEX IF NOT EXISTS idx_store_vouchers_expires ON public.store_vouchers(expires_at);

-- ========================================================
-- 2. TẠO BẢNG LƯU TRỮ CẤU HÌNH QUY TẮC CẤP PHÁT VOUCHER
-- (FIFO: First In First Out / FEFO / LIFO)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.store_voucher_configs (
    config_key TEXT PRIMARY KEY,
    rule_type TEXT NOT NULL DEFAULT 'FIFO',
    description TEXT,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kích hoạt RLS & chính sách truy cập toàn quyền cho bảng store_voucher_configs
ALTER TABLE public.store_voucher_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_voucher_configs_all_policy" ON public.store_voucher_configs;
CREATE POLICY "store_voucher_configs_all_policy" 
ON public.store_voucher_configs FOR ALL USING (true) WITH CHECK (true);

-- Khởi tạo mặc định quy tắc FIFO
INSERT INTO public.store_voucher_configs (config_key, rule_type, description, updated_by)
VALUES ('distribution_rule', 'FIFO', 'Ưu tiên cấp mã nhập kho trước, xuất kho trước (First In First Out)', 'Hệ thống')
ON CONFLICT (config_key) DO NOTHING;

-- ========================================================
-- 3. TẠO BẢNG LƯU TRỮ TRẠNG THÁI CHƯƠNG TRÌNH VOUCHER
-- (Đang hoạt động - còn nạp thêm / Hết mã hoàn toàn - Kết thúc chương trình)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.store_voucher_campaign_statuses (
    id TEXT PRIMARY KEY,
    campaign_name TEXT NOT NULL,
    denomination NUMERIC DEFAULT 0,
    is_ended BOOLEAN DEFAULT false,
    is_hidden BOOLEAN DEFAULT false,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tự động bổ sung cột is_hidden nếu bảng đã được tạo trước đó
ALTER TABLE public.store_voucher_campaign_statuses ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- Kích hoạt RLS & chính sách truy cập toàn quyền cho bảng store_voucher_campaign_statuses
ALTER TABLE public.store_voucher_campaign_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_voucher_campaign_statuses_all_policy" ON public.store_voucher_campaign_statuses;
CREATE POLICY "store_voucher_campaign_statuses_all_policy" 
ON public.store_voucher_campaign_statuses FOR ALL USING (true) WITH CHECK (true);
`;

/**
 * Lấy cấu hình quy tắc phân phối voucher (100% Cloud-Direct Supabase)
 * Mặc định: FIFO (First In, First Out)
 */
export async function getVoucherDistributionConfig(): Promise<VoucherDistributionConfig> {
    try {
        const { data, error } = await supabase
            .from('store_voucher_configs')
            .select('*')
            .eq('config_key', 'distribution_rule')
            .maybeSingle();

        if (!error && data && data.rule_type) {
            return {
                rule_type: data.rule_type as VoucherDistributionRule,
                updated_by: data.updated_by,
                updated_at: data.updated_at,
                description: data.description
            };
        }
    } catch (e) {
        console.warn('Lỗi đọc cấu hình voucher từ Supabase Cloud:', e);
    }
    return DEFAULT_VOUCHER_DISTRIBUTION_CONFIG;
}

/**
 * Lưu cấu hình quy tắc phân phối voucher (100% Cloud Upsert trực tiếp vào Supabase)
 */
export async function saveVoucherDistributionConfig(
    rule: VoucherDistributionRule,
    updatedBy: string
): Promise<{ success: boolean; config: VoucherDistributionConfig; error?: string }> {
    const descriptionMap: Record<VoucherDistributionRule, string> = {
        FIFO: 'Ưu tiên cấp mã nhập kho trước (First In First Out) - Mã cũ nạp trước được xuất trước',
        FEFO: 'Ưu tiên cấp mã có hạn sử dụng gần nhất (First Expired First Out) - Hạn gần cấp trước',
        LIFO: 'Ưu tiên cấp mã mới nạp gần đây nhất (Last In First Out)'
    };

    const newConfig: VoucherDistributionConfig = {
        rule_type: rule,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
        description: descriptionMap[rule] || ''
    };

    try {
        const { error } = await supabase
            .from('store_voucher_configs')
            .upsert({
                config_key: 'distribution_rule',
                rule_type: rule,
                updated_by: updatedBy,
                updated_at: newConfig.updated_at,
                description: newConfig.description
            }, { onConflict: 'config_key' });

        if (error) {
            console.error('Lỗi upsert Supabase store_voucher_configs:', error);
            return { success: false, config: newConfig, error: error.message };
        }
        return { success: true, config: newConfig };
    } catch (e: any) {
        return { success: false, config: newConfig, error: e.message || String(e) };
    }
}

/**
 * Tạo key định danh cho chương trình / mệnh giá
 */
export function getCampaignStatusKey(campaignName: string, denomination?: number): string {
    const cleanCamp = campaignName.trim();
    if (denomination && denomination > 0) {
        return `${cleanCamp}:::${denomination}`;
    }
    return cleanCamp;
}

/**
 * Kiểm tra xem chương trình hoặc mức mệnh giá cụ thể đã kết thúc (hết mã hoàn toàn) hay chưa
 */
export function isCampaignOrDenomEnded(
    statuses: Record<string, VoucherCampaignStatusConfig> | undefined,
    campaignName: string,
    denomination?: number
): boolean {
    if (!statuses) return false;
    const cleanCamp = (campaignName || '').trim();
    if (!cleanCamp) return false;
    const lowerCamp = cleanCamp.toLowerCase();

    // 1. Kiểm tra cấu hình cụ thể cho mệnh giá
    if (denomination && denomination > 0) {
        const specificKey = `${cleanCamp}:::${denomination}`;
        if (statuses[specificKey] && statuses[specificKey].is_ended) {
            return true;
        }
        for (const [k, v] of Object.entries(statuses)) {
            if (k.toLowerCase() === `${lowerCamp}:::${denomination}` && v.is_ended) {
                return true;
            }
        }
    }

    // 2. Kiểm tra cấu hình toàn chương trình (trực tiếp)
    if (statuses[cleanCamp] && statuses[cleanCamp].is_ended) {
        return true;
    }

    // 3. Quét không phân biệt hoa thường ở cấp chương trình
    for (const v of Object.values(statuses)) {
        if (
            (!v.denomination || v.denomination === 0) &&
            v.campaign_name.trim().toLowerCase() === lowerCamp &&
            v.is_ended
        ) {
            return true;
        }
    }

    return false;
}

/**
 * Kiểm tra xem một chương trình hoặc mức mệnh giá cụ thể đã bị ẨN khỏi hệ thống hay chưa
 */
export function isCampaignHidden(
    statuses: Record<string, VoucherCampaignStatusConfig> | undefined,
    campaignName: string,
    denomination?: number
): boolean {
    if (!statuses) return false;
    const cleanCamp = (campaignName || '').trim();
    if (!cleanCamp) return false;
    const lowerCamp = cleanCamp.toLowerCase();

    // 1. Kiểm tra cấu hình ẩn cho mức mệnh giá cụ thể
    if (denomination && denomination > 0) {
        const specificKey = `${cleanCamp}:::${denomination}`;
        if (statuses[specificKey] && statuses[specificKey].is_hidden) {
            return true;
        }
        for (const [k, v] of Object.entries(statuses)) {
            if (k.toLowerCase() === `${lowerCamp}:::${denomination}` && v.is_hidden) {
                return true;
            }
        }
    }

    // 2. Kiểm tra cấu hình ẩn toàn chương trình
    if (statuses[cleanCamp] && statuses[cleanCamp].is_hidden) {
        return true;
    }

    for (const v of Object.values(statuses)) {
        if (
            (!v.denomination || v.denomination === 0) &&
            v.campaign_name.trim().toLowerCase() === lowerCamp &&
            v.is_hidden
        ) {
            return true;
        }
    }

    return false;
}

/**
 * Kiểm tra xem chương trình/mệnh giá đã kết thúc HOẶC bị ẩn hay chưa
 */
export function isCampaignEndedOrHidden(
    statuses: Record<string, VoucherCampaignStatusConfig> | undefined,
    campaignName: string,
    denomination?: number
): boolean {
    return isCampaignHidden(statuses, campaignName, denomination) ||
           isCampaignOrDenomEnded(statuses, campaignName, denomination);
}

/**
 * Lấy danh sách trạng thái chương trình / mệnh giá (100% Cloud-Direct Supabase)
 */
export async function fetchVoucherCampaignStatuses(): Promise<Record<string, VoucherCampaignStatusConfig>> {
    const statusMap: Record<string, VoucherCampaignStatusConfig> = {};

    try {
        const { data, error } = await supabase
            .from('store_voucher_campaign_statuses')
            .select('*');

        if (!error && Array.isArray(data)) {
            data.forEach((row: any) => {
                const key = row.id || getCampaignStatusKey(row.campaign_name, row.denomination);
                statusMap[key] = {
                    id: key,
                    campaign_name: row.campaign_name,
                    denomination: Number(row.denomination) || 0,
                    is_ended: Boolean(row.is_ended),
                    is_hidden: Boolean(row.is_hidden),
                    updated_by: row.updated_by,
                    updated_at: row.updated_at
                };
            });
        } else if (error) {
            console.warn('Lỗi đọc store_voucher_campaign_statuses từ Cloud:', error);
        }
    } catch (e) {
        console.warn('Lỗi kết nối Supabase Cloud khi đọc trạng thái chương trình:', e);
    }

    return statusMap;
}

/**
 * Lưu trạng thái chương trình / mệnh giá (100% Cloud Upsert trực tiếp vào Supabase)
 * isEnded = true: Hết mã hoàn toàn - Kết thúc chương trình
 * isEnded = false: Đang hoạt động - Còn nạp thêm
 */
export async function saveVoucherCampaignStatus(
    campaignName: string,
    denomination: number,
    isEnded: boolean,
    updatedBy: string
): Promise<{ success: boolean; config?: VoucherCampaignStatusConfig; error?: string }> {
    const key = getCampaignStatusKey(campaignName, denomination);

    try {
        // Đọc cấu hình hiện có trên Cloud để bảo toàn trạng thái is_hidden
        const { data: existing } = await supabase
            .from('store_voucher_campaign_statuses')
            .select('is_hidden')
            .eq('id', key)
            .maybeSingle();

        const item: VoucherCampaignStatusConfig = {
            id: key,
            campaign_name: campaignName.trim(),
            denomination: denomination || 0,
            is_ended: isEnded,
            is_hidden: existing?.is_hidden ?? false,
            updated_by: updatedBy,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('store_voucher_campaign_statuses')
            .upsert([item], { onConflict: 'id' });

        if (error) {
            console.warn('Lỗi upsert Supabase store_voucher_campaign_statuses:', error.message);
            return { success: false, error: error.message };
        }

        return { success: true, config: item };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

/**
 * Ẩn / Hiện chương trình áp dụng voucher (100% Cloud-Direct Supabase)
 * isHidden = true: Ẩn chương trình (Lưu trữ lịch sử, không xóa mã, loại trừ khỏi cảnh báo mã hết hạn)
 * isHidden = false: Mở hiển thị lại chương trình
 */
export async function saveVoucherCampaignHiddenStatus(
    campaignName: string,
    isHidden: boolean,
    updatedBy: string
): Promise<{ success: boolean; config?: VoucherCampaignStatusConfig; error?: string }> {
    const cleanCamp = campaignName.trim();
    const key = cleanCamp;

    try {
        const { data: existing } = await supabase
            .from('store_voucher_campaign_statuses')
            .select('is_ended, denomination')
            .eq('id', key)
            .maybeSingle();

        const now = new Date().toISOString();
        const rootItem: VoucherCampaignStatusConfig = {
            id: key,
            campaign_name: cleanCamp,
            denomination: existing?.denomination || 0,
            is_ended: existing?.is_ended ?? true,
            is_hidden: isHidden,
            updated_by: updatedBy,
            updated_at: now
        };

        // 1. Cập nhật cấp chương trình
        const { error: rootErr } = await supabase
            .from('store_voucher_campaign_statuses')
            .upsert([rootItem], { onConflict: 'id' });

        if (rootErr) {
            return { success: false, error: rootErr.message };
        }

        // 2. Cập nhật tất cả mệnh giá con của chương trình này
        await supabase
            .from('store_voucher_campaign_statuses')
            .update({
                is_hidden: isHidden,
                is_ended: isHidden ? true : existing?.is_ended ?? false,
                updated_by: updatedBy,
                updated_at: now
            })
            .ilike('campaign_name', cleanCamp);

        return { success: true, config: rootItem };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

/**
 * Sắp xếp danh sách mã voucher khả dụng theo quy tắc đã định
 * - FIFO: Mã nạp vào kho trước (created_at cũ nhất) xếp lên đầu
 * - FEFO: Mã có hạn sử dụng gần nhất (expires_at nhỏ nhất) xếp lên đầu
 * - LIFO: Mã mới nạp nhất (created_at mới nhất) xếp lên đầu
 */
export function sortVouchersByDistributionRule(
    vouchers: VoucherItem[],
    rule: VoucherDistributionRule = 'FIFO'
): VoucherItem[] {
    return [...vouchers].sort((a, b) => {
        if (rule === 'FIFO') {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            if (timeA !== timeB) return timeA - timeB;
            return (a.id || '').localeCompare(b.id || '');
        }

        if (rule === 'FEFO') {
            const expA = a.expires_at || '9999-12-31';
            const expB = b.expires_at || '9999-12-31';
            if (expA !== expB) return expA.localeCompare(expB);

            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeA - timeB;
        }

        if (rule === 'LIFO') {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            if (timeA !== timeB) return timeB - timeA;
            return (b.id || '').localeCompare(a.id || '');
        }

        return 0;
    });
}

/**
 * Lấy hạn sử dụng mặc định (ngày cuối cùng của tháng hiện tại)
 */
export function getDefaultExpiryDate(): string {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const yyyy = endOfMonth.getFullYear();
    const mm = String(endOfMonth.getMonth() + 1).padStart(2, '0');
    const dd = String(endOfMonth.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export interface SupabaseStorageStatus {
    tableExists: boolean;
    totalCloudRecords: number;
    cloudCount?: number;
    error?: string;
}

/**
 * Kiểm tra trạng thái kết nối và sự tồn tại của bảng store_vouchers trên Supabase
 */
export async function checkSupabaseVoucherTable(): Promise<SupabaseStorageStatus> {
    try {
        const { count, error } = await supabase
            .from('store_vouchers')
            .select('*', { count: 'exact', head: true });

        if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('store_vouchers')) {
                return {
                    tableExists: false,
                    totalCloudRecords: 0,
                    cloudCount: 0,
                    error: 'Bảng "store_vouchers" chưa được tạo trên CLOUD.'
                };
            }
            return {
                tableExists: false,
                totalCloudRecords: 0,
                cloudCount: 0,
                error: error.message
            };
        }

        return {
            tableExists: true,
            totalCloudRecords: count || 0,
            cloudCount: count || 0
        };
    } catch (e: any) {
        return {
            tableExists: false,
            totalCloudRecords: 0,
            cloudCount: 0,
            error: e.message || String(e)
        };
    }
}

/**
 * Hàm tương thích ngược: Dọn dẹp cache LocalStorage cũ
 */
export async function syncLocalVouchersToCloud(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    cleanupLegacyLocalStorageVouchers();
    return { success: true, syncedCount: 0 };
}

/**
 * Hàm tương thích ngược (Deprecated - Không còn sử dụng LocalStorage)
 */
export function getLocalVouchers(): VoucherItem[] {
    cleanupLegacyLocalStorageVouchers();
    return [];
}

/**
 * Hàm tương thích ngược (Deprecated - Không còn sử dụng LocalStorage)
 */
export function setLocalVouchers(_list: VoucherItem[]): void {
    cleanupLegacyLocalStorageVouchers();
}

/**
 * Trích xuất địa chỉ vật lý từ tên siêu thị dạng "[MÃ] - [BRAND] - [ĐỊA CHỈ]"
 */
export function extractStoreAddress(storeName?: string | null): string {
    if (!storeName) return '';
    const parts = storeName.split('-');
    if (parts.length >= 3) {
        return parts.slice(2).join('-').trim().toLowerCase();
    }
    return '';
}

/**
 * Kiểm tra đối chiếu tên siêu thị / cụm siêu thị cho voucher (Phân lập riêng tư theo Cụm)
 * Đảm bảo: Cụm 1 nạp mã thì chỉ nhân viên trong Cụm 1 được xem & sử dụng, Cụm 2 tuyệt đối không thấy!
 */
export function isStoreOrClusterMatch(
    voucherStoreName: string | undefined | null,
    userStoreName?: string | undefined | null,
    accessibleStores?: string[],
    voucherNote?: string,
    voucherCreatedBy?: string,
    currentUserDisplayName?: string,
    voucherClaimedByStore?: string
): boolean {
    if (!voucherStoreName) return false;
    const vStore = voucherStoreName.trim();

    // 1. Tập hợp tất cả các siêu thị thuộc phạm vi Cụm của User
    const clusterStores: string[] = [];
    if (userStoreName && userStoreName !== 'all') {
        clusterStores.push(userStoreName.trim());
    }
    if (accessibleStores && accessibleStores.length > 0) {
        accessibleStores.forEach(s => {
            if (s && s !== 'all' && !clusterStores.some(c => isStoreMatch(c, s))) {
                clusterStores.push(s.trim());
            }
        });
    }

    // Nếu không có bất kỳ thông tin siêu thị nào của User và chọn 'all' -> Dành cho Admin xem toàn hệ thống
    if (clusterStores.length === 0) {
        return true;
    }

    // 2. Khớp trực tiếp tên siêu thị
    if (clusterStores.some(s => isStoreMatch(vStore, s))) {
        return true;
    }

    // 3. Khớp cụm siêu thị qua địa chỉ dùng chung (ví dụ cụm BRV_VTA: 10335 & 111 cùng tại 290 Trương Công Định)
    const addrV = extractStoreAddress(vStore);
    if (addrV && clusterStores.some(s => extractStoreAddress(s) === addrV)) {
        return true;
    }

    // 4. Khớp theo tag Cụm được lưu trong note (ví dụ "[CỤM: 10335 | 111]")
    if (voucherNote && voucherNote.includes('[CỤM:')) {
        const clusterTagMatch = voucherNote.match(/\[CỤM:\s*([^\]]+)\]/i);
        if (clusterTagMatch && clusterTagMatch[1]) {
            const rawClusterList = clusterTagMatch[1].split('|').map(s => s.trim());
            const hasMatch = clusterStores.some(myStore =>
                rawClusterList.some(cStore =>
                    isStoreMatch(cStore, myStore) ||
                    (extractStoreAddress(cStore) && extractStoreAddress(cStore) === extractStoreAddress(myStore))
                )
            );
            if (hasMatch) return true;
        }
    }

    // 5. Khớp theo siêu thị của nhân viên đã nhận mã (claimed_by_store)
    if (voucherClaimedByStore) {
        const addrClaim = extractStoreAddress(voucherClaimedByStore);
        if (clusterStores.some(s => isStoreMatch(voucherClaimedByStore, s) || (addrClaim && addrClaim === extractStoreAddress(s)))) {
            return true;
        }
    }

    // 6. Xử lý các mã cũ đã lỡ nạp chuỗi "Toàn Cụm Siêu Thị" / "Toàn Cụm":
    const isOldClusterString = (
        vStore === 'Toàn Cụm Siêu Thị' ||
        vStore === 'Toàn Cụm' ||
        vStore === 'all' ||
        vStore.toLowerCase().includes('toàn cụm')
    );
    if (isOldClusterString) {
        if (currentUserDisplayName && voucherCreatedBy && currentUserDisplayName.trim().toLowerCase() === voucherCreatedBy.trim().toLowerCase()) {
            return true;
        }
        if (voucherNote) {
            const noteLower = voucherNote.toLowerCase();
            if (clusterStores.some(s => noteLower.includes(s.toLowerCase()) || (extractStoreAddress(s) && noteLower.includes(extractStoreAddress(s))))) {
                return true;
            }
        }
        return false;
    }

    return false;
}

/**
 * Kiểm tra toàn diện một VoucherItem có thuộc Cụm của User hiện tại hay không
 */
export function isVoucherInUserCluster(
    v: VoucherItem,
    userStoreName?: string | null,
    accessibleStores?: string[],
    currentUserDisplayName?: string,
    isAdmin?: boolean
): boolean {
    if (isAdmin && (!userStoreName || userStoreName === 'all')) {
        return true;
    }
    return isStoreOrClusterMatch(
        v.store_name,
        userStoreName,
        accessibleStores,
        v.note,
        v.created_by,
        currentUserDisplayName,
        v.claimed_by_store
    );
}

/**
 * Helper tải trọn vẹn toàn bộ bản ghi voucher từ Cloud (phân trang an toàn)
 */
async function fetchAllCloudVouchers(): Promise<VoucherItem[]> {
    const CHUNK_SIZE = 1000;
    let from = 0;
    const allRecords: VoucherItem[] = [];
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('store_vouchers')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, from + CHUNK_SIZE - 1);

        if (error) {
            console.error('Lỗi truy vấn store_vouchers từ Supabase:', error);
            throw error;
        }

        if (data && data.length > 0) {
            allRecords.push(...(data as VoucherItem[]));
            if (data.length < CHUNK_SIZE) {
                hasMore = false;
            } else {
                from += CHUNK_SIZE;
            }
        } else {
            hasMore = false;
        }
    }

    return allRecords;
}

/**
 * Tải danh sách voucher theo siêu thị / cụm siêu thị (100% Cloud Supabase)
 * Phân lập hoàn toàn quyền riêng tư giữa các Cụm khác nhau
 */
export async function fetchStoreVouchers(
    storeName?: string,
    accessibleStores?: string[],
    currentUserDisplayName?: string,
    isAdmin?: boolean
): Promise<VoucherItem[]> {
    // Tự động dọn dẹp cache LocalStorage cũ
    cleanupLegacyLocalStorageVouchers();

    let cloudList: VoucherItem[] = [];
    try {
        cloudList = await fetchAllCloudVouchers();
    } catch (e) {
        console.warn('Lỗi kết nối Supabase Cloud khi tải voucher:', e);
        return [];
    }

    // Nếu là Admin và chọn xem toàn bộ ('all'): Cho phép xem tất cả
    if (isAdmin && (!storeName || storeName === 'all')) {
        return cloudList;
    }

    // Với mọi trường hợp khác: Luôn lọc nghiêm ngặt theo phạm vi Cụm của người dùng
    return cloudList.filter(v =>
        isVoucherInUserCluster(v, storeName, accessibleStores, currentUserDisplayName, isAdmin)
    );
}

/**
 * Nạp thêm mã voucher vào kho (Kiểm tra trùng lặp và lưu trữ trực tiếp 100% lên Cloud)
 */
export async function importVouchers(params: {
    store_name: string;
    campaign_name: string;
    denomination: number;
    codes: string[];
    created_by: string;
    expires_at?: string;
    cluster_stores?: string[];
    note?: string;
    description?: string;
}): Promise<{
    success: boolean;
    addedCount: number;
    duplicateCount: number;
    cloudSaved?: boolean;
    cloudWarning?: string;
    error?: string;
}> {
    try {
        cleanupLegacyLocalStorageVouchers();

        // 1. Kiểm tra trùng mã trực tiếp từ Cloud để không bao giờ nạp trùng mã
        const { data: codeRows, error: codeErr } = await supabase
            .from('store_vouchers')
            .select('code');

        if (codeErr) {
            return {
                success: false,
                addedCount: 0,
                duplicateCount: 0,
                error: `Không thể kết nối Cloud để kiểm tra mã trùng lặp: ${codeErr.message}`
            };
        }

        const existingCodes = new Set(
            (codeRows || []).map((r: any) => String(r.code || '').trim().toUpperCase())
        );

        const newItems: VoucherItem[] = [];
        let duplicateCount = 0;
        const now = new Date().toISOString();
        const effectiveExpiry = params.expires_at || getDefaultExpiryDate();

        let noteContent = params.note;
        if (params.cluster_stores && params.cluster_stores.length > 0) {
            const clusterTag = `[CỤM: ${params.cluster_stores.join(' | ')}]`;
            noteContent = noteContent ? `${clusterTag} ${noteContent}` : clusterTag;
        }

        for (const raw of params.codes) {
            const clean = raw.trim().toUpperCase();
            if (!clean) continue;

            if (existingCodes.has(clean)) {
                duplicateCount++;
                continue;
            }

            existingCodes.add(clean);
            const item: VoucherItem = {
                id: `vouch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                store_name: params.store_name || 'Toàn Cụm Siêu Thị',
                campaign_name: params.campaign_name.trim(),
                denomination: params.denomination,
                code: clean,
                status: 'AVAILABLE',
                expires_at: effectiveExpiry,
                created_at: now,
                created_by: params.created_by,
                note: noteContent,
                description: params.description?.trim() || undefined
            };
            newItems.push(item);
        }

        // 2. Lưu trực tiếp lên Supabase Cloud theo batch 100 mã
        if (newItems.length > 0) {
            const CHUNK_SIZE = 100;
            for (let i = 0; i < newItems.length; i += CHUNK_SIZE) {
                const chunk = newItems.slice(i, i + CHUNK_SIZE);
                const { error: insertErr } = await supabase.from('store_vouchers').insert(chunk);
                if (insertErr) {
                    return {
                        success: false,
                        addedCount: 0,
                        duplicateCount,
                        error: `Lỗi khi lưu mã vào Supabase Cloud: ${insertErr.message}`
                    };
                }
            }
        }

        return {
            success: true,
            addedCount: newItems.length,
            duplicateCount,
            cloudSaved: true
        };
    } catch (e: any) {
        return { success: false, addedCount: 0, duplicateCount: 0, error: e.message || String(e) };
    }
}

/**
 * Cấp mã voucher cho nhân viên (100% Cloud-Only với Cơ Chế Chống Tranh Chấp Atomic Update)
 * Nhân viên CHỈ được lấy mã trong phạm vi Cụm siêu thị của mình!
 */
export async function claimVoucher(
    req: VoucherClaimRequest
): Promise<{ success: boolean; voucher?: VoucherItem; error?: string }> {
    try {
        cleanupLegacyLocalStorageVouchers();

        // 1. Kiểm tra cấu hình quy tắc phân phối hiện tại từ Cloud (FIFO / FEFO / LIFO)
        const config = await getVoucherDistributionConfig();
        const rule = config.rule_type || 'FIFO';

        // 2. Kiểm tra xem chương trình hoặc mức mệnh giá đã chốt kết thúc hay chưa
        const statuses = await fetchVoucherCampaignStatuses();
        if (isCampaignOrDenomEnded(statuses, req.campaign_name, req.denomination)) {
            return {
                success: false,
                error: `Chương trình "${req.campaign_name}" (mệnh giá ${req.denomination.toLocaleString('vi-VN')}đ) đã hết mã hoàn toàn và chính thức kết thúc chương trình!`
            };
        }

        // 3. Tải các mã khả dụng trực tiếp từ Supabase Cloud
        const todayStr = new Date().toISOString().slice(0, 10);
        const { data: availableRows, error: fetchErr } = await supabase
            .from('store_vouchers')
            .select('*')
            .eq('status', 'AVAILABLE')
            .eq('denomination', req.denomination)
            .ilike('campaign_name', req.campaign_name.trim());

        if (fetchErr) {
            return {
                success: false,
                error: `Lỗi kết nối Cloud khi tìm kiếm mã voucher: ${fetchErr.message}`
            };
        }

        const allAvailable = ((availableRows || []) as VoucherItem[]).filter(v =>
            !v.expires_at || v.expires_at >= todayStr
        );

        // 4. Lọc ứng viên theo Tier
        const matchesCampaignAndDenom = (v: VoucherItem) =>
            v.campaign_name.trim().toLowerCase() === req.campaign_name.trim().toLowerCase() &&
            Number(v.denomination) === Number(req.denomination);

        // Tier 1: Của chính siêu thị nhân viên
        const tier1Candidates = allAvailable.filter(v =>
            isStoreMatch(v.store_name, req.store_name) && matchesCampaignAndDenom(v)
        );

        // Tier 2: Danh sách siêu thị thuộc phân quyền Cụm
        const tier2Candidates = (!tier1Candidates.length && req.accessible_stores && req.accessible_stores.length > 0)
            ? allAvailable.filter(v =>
                req.accessible_stores!.some(s => isStoreMatch(v.store_name, s)) && matchesCampaignAndDenom(v)
            )
            : [];

        // Tier 3: Cụm dùng chung
        const tier3Candidates = (!tier1Candidates.length && !tier2Candidates.length)
            ? allAvailable.filter(v =>
                isStoreOrClusterMatch(
                    v.store_name,
                    req.store_name,
                    req.accessible_stores,
                    v.note,
                    v.created_by,
                    req.employee_name,
                    v.claimed_by_store
                ) && matchesCampaignAndDenom(v)
            )
            : [];

        const candidates = tier1Candidates.length > 0
            ? tier1Candidates
            : (tier2Candidates.length > 0 ? tier2Candidates : tier3Candidates);

        if (candidates.length === 0) {
            return {
                success: false,
                error: `Đã tạm hết mã voucher mệnh giá ${req.denomination.toLocaleString('vi-VN')}đ của chương trình "${req.campaign_name}". Vui lòng liên hệ Quản lý hoặc Trưởng ca để nạp thêm tồn kho!`
            };
        }

        // 5. Sắp xếp theo quy tắc cấp phát (Mặc định: FIFO - Nhập trước cấp trước)
        const sortedCandidates = sortVouchersByDistributionRule(candidates, rule);

        // 6. ATOMIC CLAIM VỚI CHỐNG TRANH CHẤP ĐA THIẾT BỊ (Concurrency Protection)
        // Duyệt lần lượt ứng viên và cập nhật với điều kiện status = 'AVAILABLE'
        const now = new Date().toISOString();
        for (const target of sortedCandidates) {
            const { data: updatedVoucher, error: updateErr } = await supabase
                .from('store_vouchers')
                .update({
                    status: 'CLAIMED',
                    claimed_at: now,
                    claimed_by_id: req.employee_id.trim(),
                    claimed_by_name: req.employee_name.trim(),
                    claimed_by_store: req.store_name.trim(),
                    order_id: req.order_id.trim().toUpperCase()
                })
                .eq('id', target.id)
                .eq('status', 'AVAILABLE') // CHỐT CHẶN BẢO VỆ: Chỉ cấp nếu mã vẫn đang AVAILABLE trên Cloud
                .select()
                .maybeSingle();

            if (!updateErr && updatedVoucher) {
                return { success: true, voucher: updatedVoucher as VoucherItem };
            }
            // Nếu updateErr hoặc updatedVoucher là null, tức mã vừa bị thiết bị khác lấy mất -> Tự động thử mã kế tiếp
        }

        return {
            success: false,
            error: 'Mã voucher vừa được nhận bởi nhân viên khác ngay trước đó! Vui lòng bấm Nhận lại mã để lấy mã kế tiếp.'
        };
    } catch (e: any) {
        return { success: false, error: e.message || 'Lỗi khi cấp mã voucher' };
    }
}

/**
 * Reset mã đã lấy nhưng chưa dùng quay trở về kho chờ (AVAILABLE) trực tiếp trên Cloud
 */
export async function resetClaimedVoucher(
    code: string,
    performedBy: string,
    _storeName?: string,
    _accessibleStores?: string[]
): Promise<{ success: boolean; voucher?: VoucherItem; error?: string }> {
    try {
        cleanupLegacyLocalStorageVouchers();
        const cleanCode = code.trim().toUpperCase();

        // 1. Tải bản ghi mới nhất từ Cloud
        const { data: target, error: findErr } = await supabase
            .from('store_vouchers')
            .select('*')
            .eq('code', cleanCode)
            .maybeSingle();

        if (findErr || !target) {
            return { success: false, error: `Không tìm thấy mã voucher "${cleanCode}" trên Cloud!` };
        }

        // 2. Chặn không cho trả lại mã đã sử dụng hoàn tất trong đơn hàng
        if (target.status === 'USED') {
            return {
                success: false,
                error: `Mã voucher "${cleanCode}" đã được ghi nhận sử dụng hoàn tất trong đơn hàng (${target.order_id || 'đã thanh toán'}), không thể trả lại kho!`
            };
        }

        // 3. Nếu mã đã ở trạng thái AVAILABLE sẵn rồi
        if (target.status === 'AVAILABLE') {
            return {
                success: true,
                voucher: target as VoucherItem
            };
        }

        const prevClaimed = target.claimed_by_name ? ` (NV: ${target.claimed_by_name} - ${target.claimed_by_id || ''} [${target.claimed_by_store || target.store_name}])` : '';
        const prevOrder = target.order_id ? ` (ĐH: ${target.order_id})` : '';
        const resetNote = `[Trả lại kho lúc ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')} bởi ${performedBy}] Trước đó: ${target.status}${prevClaimed}${prevOrder}`;
        const finalNote = target.note ? `${target.note} | ${resetNote}` : resetNote;

        // 4. Cập nhật trực tiếp trên Cloud
        const { data: updated, error: resetErr } = await supabase
            .from('store_vouchers')
            .update({
                status: 'AVAILABLE',
                claimed_at: null,
                claimed_by_id: null,
                claimed_by_name: null,
                claimed_by_store: null,
                order_id: null,
                used_at: null,
                note: finalNote
            })
            .eq('id', target.id)
            .select()
            .maybeSingle();

        if (resetErr || !updated) {
            return { success: false, error: resetErr?.message || 'Lỗi khi reset voucher trên Cloud' };
        }

        return { success: true, voucher: updated as VoucherItem };
    } catch (e: any) {
        return { success: false, error: e.message || 'Lỗi khi reset voucher' };
    }
}

/**
 * Đánh dấu mã đã sử dụng thành công trên hóa đơn thực tế và cập nhật mã đơn hàng mới nếu có trực tiếp trên Cloud
 */
export async function markVoucherUsed(code: string, newOrderId?: string): Promise<{ success: boolean; error?: string }> {
    try {
        cleanupLegacyLocalStorageVouchers();
        const cleanCode = code.trim().toUpperCase();

        const payload: any = {
            status: 'USED',
            used_at: new Date().toISOString()
        };
        if (newOrderId !== undefined) {
            payload.order_id = newOrderId.trim().toUpperCase() || null;
        }

        const { error } = await supabase
            .from('store_vouchers')
            .update(payload)
            .eq('code', cleanCode);

        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Xóa một mã voucher khỏi hệ thống trực tiếp trên Cloud
 */
export async function deleteVoucher(
    idOrCode: string,
    clusterContext?: {
        userStoreName?: string;
        accessibleStores?: string[];
        currentUserDisplayName?: string;
        isAdmin?: boolean;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        cleanupLegacyLocalStorageVouchers();
        const clean = idOrCode.trim();

        // 1. Tìm voucher từ Cloud
        const { data: target, error: findErr } = await supabase
            .from('store_vouchers')
            .select('*')
            .or(`id.eq.${clean},code.ilike.${clean}`)
            .maybeSingle();

        if (findErr || !target) {
            return { success: false, error: 'Không tìm thấy mã voucher để xóa trên Cloud' };
        }

        // 2. Chặn người dùng xóa mã thuộc Cụm khác nếu không phải Admin
        if (clusterContext && !clusterContext.isAdmin) {
            const isOwned = isVoucherInUserCluster(
                target,
                clusterContext.userStoreName,
                clusterContext.accessibleStores,
                clusterContext.currentUserDisplayName,
                false
            );
            if (!isOwned) {
                return { success: false, error: 'Bạn không có quyền xóa mã voucher thuộc Cụm siêu thị khác!' };
            }
        }

        // 3. Xóa trên Supabase Cloud
        const { error: delErr } = await supabase
            .from('store_vouchers')
            .delete()
            .eq('id', target.id);

        if (delErr) {
            return { success: false, error: delErr.message };
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Lỗi khi xóa mã voucher' };
    }
}

/**
 * Xóa nhiều mã voucher theo danh sách id hoặc mã code (Batch delete trực tiếp trên Cloud)
 */
export async function deleteVouchersBatch(
    idsOrCodes: string[],
    clusterContext?: {
        userStoreName?: string;
        accessibleStores?: string[];
        currentUserDisplayName?: string;
        isAdmin?: boolean;
    }
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    try {
        cleanupLegacyLocalStorageVouchers();
        if (!idsOrCodes || idsOrCodes.length === 0) {
            return { success: true, deletedCount: 0 };
        }

        const cleanSet = new Set(idsOrCodes.map(s => s.trim().toUpperCase()));
        const idSet = new Set(idsOrCodes.map(s => s.trim()));
        const allCloud = await fetchAllCloudVouchers();

        let targets = allCloud.filter(v => idSet.has(v.id) || cleanSet.has(v.code.toUpperCase()));
        if (targets.length === 0) {
            return { success: true, deletedCount: 0 };
        }

        // Lọc chỉ giữ lại các mã thuộc Cụm của người dùng nếu không phải Admin
        if (clusterContext && !clusterContext.isAdmin) {
            targets = targets.filter(t =>
                isVoucherInUserCluster(
                    t,
                    clusterContext.userStoreName,
                    clusterContext.accessibleStores,
                    clusterContext.currentUserDisplayName,
                    false
                )
            );
            if (targets.length === 0) {
                return { success: false, deletedCount: 0, error: 'Không có mã nào thuộc quyền quản lý của Cụm bạn để xóa!' };
            }
        }

        const targetIds = targets.map(t => t.id);

        // Xóa trên Supabase Cloud theo chunk 100 mã
        const CHUNK_SIZE = 100;
        for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
            const chunk = targetIds.slice(i, i + CHUNK_SIZE);
            const { error: delErr } = await supabase.from('store_vouchers').delete().in('id', chunk);
            if (delErr) {
                return { success: false, deletedCount: 0, error: delErr.message };
            }
        }

        return { success: true, deletedCount: targets.length };
    } catch (e: any) {
        return { success: false, deletedCount: 0, error: e.message || 'Lỗi khi xóa mã voucher hàng loạt' };
    }
}

/**
 * Xóa vĩnh viễn một hoặc nhiều chương trình PMH đã kết thúc / hết hạn khỏi kho trực tiếp trên Cloud
 * - Xóa tất cả các mã voucher thuộc danh sách chương trình
 * - Xóa cấu hình trạng thái của các chương trình trong store_voucher_campaign_statuses
 */
export async function deleteCampaignsBatch(
    campaignNames: string[],
    clusterContext?: {
        userStoreName?: string;
        accessibleStores?: string[];
        currentUserDisplayName?: string;
        isAdmin?: boolean;
    }
): Promise<{
    success: boolean;
    deletedVoucherCount: number;
    deletedCampaignCount: number;
    totalValue: number;
    error?: string;
}> {
    try {
        cleanupLegacyLocalStorageVouchers();
        if (!campaignNames || campaignNames.length === 0) {
            return { success: true, deletedVoucherCount: 0, deletedCampaignCount: 0, totalValue: 0 };
        }

        const cleanNames = Array.from(new Set(campaignNames.map(c => (c || '').trim()).filter(Boolean)));
        if (cleanNames.length === 0) {
            return { success: true, deletedVoucherCount: 0, deletedCampaignCount: 0, totalValue: 0 };
        }

        const nameSetLower = new Set(cleanNames.map(c => c.toLowerCase()));

        // 1. Quét voucher trên Cloud
        const allVouchers = await fetchAllCloudVouchers();
        let targets = allVouchers.filter(v => nameSetLower.has((v.campaign_name || '').trim().toLowerCase()));

        // Lọc theo cụm / siêu thị nếu không phải Admin
        if (clusterContext && !clusterContext.isAdmin) {
            targets = targets.filter(t =>
                isVoucherInUserCluster(
                    t,
                    clusterContext.userStoreName,
                    clusterContext.accessibleStores,
                    clusterContext.currentUserDisplayName,
                    false
                )
            );
        }

        const totalValue = targets.reduce((sum, v) => sum + (Number(v.denomination) || 0), 0);
        const targetIds = targets.map(v => v.id);

        // 2. Xóa các mã voucher trên Supabase Cloud theo chunk
        if (targetIds.length > 0) {
            const CHUNK_SIZE = 100;
            for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
                const chunk = targetIds.slice(i, i + CHUNK_SIZE);
                try {
                    await supabase.from('store_vouchers').delete().in('id', chunk);
                } catch (err) {
                    console.warn('Lỗi xóa voucher chunk trên Supabase:', err);
                }
            }
        }

        // 3. Xóa trạng thái chương trình trong store_voucher_campaign_statuses trên Supabase
        for (const campName of cleanNames) {
            try {
                await supabase
                    .from('store_voucher_campaign_statuses')
                    .delete()
                    .ilike('campaign_name', campName);
            } catch (err) {
                console.warn('Lỗi xóa campaign status trên Supabase:', err);
            }
        }

        return {
            success: true,
            deletedVoucherCount: targets.length,
            deletedCampaignCount: cleanNames.length,
            totalValue
        };
    } catch (e: any) {
        return {
            success: false,
            deletedVoucherCount: 0,
            deletedCampaignCount: 0,
            totalValue: 0,
            error: e.message || 'Lỗi khi xóa chương trình PMH'
        };
    }
}

/**
 * Xóa vĩnh viễn một chương trình PMH
 */
export async function deleteCampaignVouchers(
    campaignName: string,
    clusterContext?: {
        userStoreName?: string;
        accessibleStores?: string[];
        currentUserDisplayName?: string;
        isAdmin?: boolean;
    }
): Promise<{ success: boolean; deletedCount: number; totalValue: number; error?: string }> {
    const res = await deleteCampaignsBatch([campaignName], clusterContext);
    return {
        success: res.success,
        deletedCount: res.deletedVoucherCount,
        totalValue: res.totalValue,
        error: res.error
    };
}

/**
 * Đổi tên / Chỉnh sửa tên chương trình voucher trên toàn hệ thống trực tiếp trên Cloud
 * - Cập nhật campaign_name của toàn bộ mã voucher thuộc chương trình này
 * - Di chuyển cấu hình trạng thái chương trình sang tên mới trong store_voucher_campaign_statuses
 */
export async function renameVoucherCampaign(
    oldCampaignName: string,
    newCampaignName: string,
    clusterContext?: {
        userStoreName?: string;
        accessibleStores?: string[];
        currentUserDisplayName?: string;
        isAdmin?: boolean;
    }
): Promise<{
    success: boolean;
    updatedVoucherCount: number;
    error?: string;
}> {
    try {
        cleanupLegacyLocalStorageVouchers();
        const cleanOld = (oldCampaignName || '').trim();
        const cleanNew = (newCampaignName || '').trim();

        if (!cleanOld) {
            return { success: false, updatedVoucherCount: 0, error: 'Tên chương trình cũ không hợp lệ!' };
        }
        if (!cleanNew) {
            return { success: false, updatedVoucherCount: 0, error: 'Vui lòng nhập tên chương trình mới!' };
        }
        if (cleanOld.toLowerCase() === cleanNew.toLowerCase()) {
            return { success: false, updatedVoucherCount: 0, error: 'Tên chương trình mới không được trùng với tên cũ!' };
        }

        const oldNameLower = cleanOld.toLowerCase();

        // 1. Quét voucher trên Cloud
        const allVouchers = await fetchAllCloudVouchers();
        let targets = allVouchers.filter(v => (v.campaign_name || '').trim().toLowerCase() === oldNameLower);

        // Lọc theo cụm nếu không phải Admin
        if (clusterContext && !clusterContext.isAdmin) {
            targets = targets.filter(t =>
                isVoucherInUserCluster(
                    t,
                    clusterContext.userStoreName,
                    clusterContext.accessibleStores,
                    clusterContext.currentUserDisplayName,
                    false
                )
            );
        }

        const targetIds = targets.map(t => t.id);

        // 2. Cập nhật trên Supabase Cloud theo chunk 100 mã
        if (targetIds.length > 0) {
            const CHUNK_SIZE = 100;
            for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
                const chunk = targetIds.slice(i, i + CHUNK_SIZE);
                try {
                    await supabase
                        .from('store_vouchers')
                        .update({ campaign_name: cleanNew })
                        .in('id', chunk);
                } catch (err) {
                    console.warn('Lỗi update voucher khi rename:', err);
                }
            }
        }

        // 3. Di chuyển trạng thái chương trình trong store_voucher_campaign_statuses
        const { data: oldStatuses } = await supabase
            .from('store_voucher_campaign_statuses')
            .select('*')
            .ilike('campaign_name', cleanOld);

        if (oldStatuses && oldStatuses.length > 0) {
            const migratedStatuses: VoucherCampaignStatusConfig[] = oldStatuses.map((item: any) => ({
                id: getCampaignStatusKey(cleanNew, item.denomination),
                campaign_name: cleanNew,
                denomination: item.denomination || 0,
                is_ended: Boolean(item.is_ended),
                is_hidden: Boolean(item.is_hidden),
                updated_by: clusterContext?.currentUserDisplayName || 'Quản lý',
                updated_at: new Date().toISOString()
            }));

            // Xóa trạng thái cũ
            await supabase
                .from('store_voucher_campaign_statuses')
                .delete()
                .ilike('campaign_name', cleanOld);

            // Thêm trạng thái mới
            await supabase
                .from('store_voucher_campaign_statuses')
                .upsert(migratedStatuses, { onConflict: 'id' });
        }

        return {
            success: true,
            updatedVoucherCount: targets.length
        };
    } catch (e: any) {
        return {
            success: false,
            updatedVoucherCount: 0,
            error: e.message || 'Lỗi khi đổi tên chương trình voucher'
        };
    }
}

/**
 * Trích xuất danh sách siêu thị được gắn trong tag [CỤM: ...] từ ghi chú voucher
 */
export function extractClusterStoresFromNote(note?: string | null): string[] {
    if (!note) return [];
    const match = note.match(/\[CỤM:\s*([^\]]+)\]/i);
    if (!match || !match[1]) return [];
    return match[1].split('|').map(s => s.trim()).filter(Boolean);
}

/**
 * Cập nhật chuỗi ghi chú với tag [CỤM: ...] mới, bảo toàn nội dung ghi chú người dùng khác
 */
export function formatNoteWithCluster(baseNote?: string | null, clusterStores?: string[]): string {
    const rawNote = baseNote || '';
    const cleaned = rawNote.replace(/\[CỤM:\s*[^\]]+\]/gi, '').trim();
    if (!clusterStores || clusterStores.length === 0) {
        return cleaned;
    }
    const clusterTag = `[CỤM: ${clusterStores.join(' | ')}]`;
    return cleaned ? `${clusterTag} ${cleaned}` : clusterTag;
}

export interface UpdateVoucherParams {
    code?: string;
    campaign_name?: string;
    denomination?: number;
    expires_at?: string;
    status?: VoucherItem['status'];
    store_name?: string;
    cluster_stores?: string[];
    note?: string;
    description?: string;
    resetClaimedInfo?: boolean;
}

/**
 * Cập nhật chỉnh sửa thông tin một mã voucher đơn lẻ trực tiếp trên Cloud
 */
export async function updateVoucher(
    voucherId: string,
    updates: UpdateVoucherParams,
    clusterContext?: {
        userStoreName?: string;
        accessibleStores?: string[];
        currentUserDisplayName?: string;
        isAdmin?: boolean;
    }
): Promise<{ success: boolean; voucher?: VoucherItem; error?: string }> {
    try {
        cleanupLegacyLocalStorageVouchers();

        // 1. Tải bản ghi từ Cloud
        const { data: target, error: targetErr } = await supabase
            .from('store_vouchers')
            .select('*')
            .eq('id', voucherId)
            .maybeSingle();

        if (targetErr || !target) {
            return { success: false, error: 'Không tìm thấy mã voucher cần cập nhật trên Cloud!' };
        }

        // 2. Kiểm tra phân quyền Cụm nếu không phải Admin
        if (clusterContext && !clusterContext.isAdmin) {
            const isOwned = isVoucherInUserCluster(
                target,
                clusterContext.userStoreName,
                clusterContext.accessibleStores,
                clusterContext.currentUserDisplayName,
                false
            );
            if (!isOwned) {
                return { success: false, error: 'Bạn không có quyền chỉnh sửa mã voucher thuộc Cụm siêu thị khác!' };
            }
        }

        // 3. Nếu thay đổi mã code: kiểm tra trùng lặp trên Cloud
        let finalCode = target.code;
        if (updates.code && updates.code.trim()) {
            const cleanNewCode = updates.code.trim().toUpperCase();
            if (cleanNewCode !== target.code.toUpperCase()) {
                const { data: dupRows } = await supabase
                    .from('store_vouchers')
                    .select('id, campaign_name')
                    .ilike('code', cleanNewCode);

                const duplicate = (dupRows || []).find((r: any) => r.id !== target.id);
                if (duplicate) {
                    return {
                        success: false,
                        error: `Mã coupon "${cleanNewCode}" đã tồn tại trong hệ thống (thuộc chương trình "${duplicate.campaign_name}")!`
                    };
                }
                finalCode = cleanNewCode;
            }
        }

        // 4. Xác định ghi chú và tag cụm
        let finalNote = target.note;
        if (updates.cluster_stores !== undefined) {
            finalNote = formatNoteWithCluster(
                updates.note !== undefined ? updates.note : target.note,
                updates.cluster_stores
            );
        } else if (updates.note !== undefined) {
            const currentClusters = extractClusterStoresFromNote(target.note);
            finalNote = formatNoteWithCluster(updates.note, currentClusters.length > 0 ? currentClusters : undefined);
        }

        // 5. Xác định tên siêu thị / kho sở hữu
        let finalStoreName = target.store_name;
        if (updates.store_name) {
            finalStoreName = updates.store_name;
        } else if (updates.cluster_stores && updates.cluster_stores.length > 0) {
            finalStoreName = updates.cluster_stores[0] || 'Toàn Cụm Siêu Thị';
        }

        const willResetClaimed = updates.resetClaimedInfo || (updates.status === 'AVAILABLE' && target.status !== 'AVAILABLE');

        const dbPayload: any = {
            code: finalCode,
            campaign_name: updates.campaign_name !== undefined ? updates.campaign_name.trim() : target.campaign_name,
            denomination: updates.denomination !== undefined ? Number(updates.denomination) : target.denomination,
            expires_at: updates.expires_at !== undefined ? updates.expires_at : target.expires_at,
            status: updates.status !== undefined ? updates.status : target.status,
            store_name: finalStoreName,
            note: finalNote,
            description: updates.description !== undefined ? (updates.description.trim() || null) : target.description,
            claimed_at: willResetClaimed ? null : (target.claimed_at || null),
            claimed_by_id: willResetClaimed ? null : (target.claimed_by_id || null),
            claimed_by_name: willResetClaimed ? null : (target.claimed_by_name || null),
            claimed_by_store: willResetClaimed ? null : (target.claimed_by_store || null),
            order_id: willResetClaimed ? null : (target.order_id || null),
            used_at: willResetClaimed ? null : (target.used_at || null)
        };

        const { data: updated, error: updateErr } = await supabase
            .from('store_vouchers')
            .update(dbPayload)
            .eq('id', voucherId)
            .select()
            .maybeSingle();

        if (updateErr || !updated) {
            return { success: false, error: updateErr?.message || 'Lỗi khi cập nhật mã voucher trên Cloud' };
        }

        return { success: true, voucher: updated as VoucherItem };
    } catch (e: any) {
        return { success: false, error: e.message || 'Lỗi khi cập nhật mã voucher' };
    }
}

export interface UpdateVouchersBatchParams {
    campaign_name?: string;
    denomination?: number;
    expires_at?: string;
    status?: VoucherItem['status'];
    store_name?: string;
    cluster_stores?: string[];
    note?: string;
    description?: string;
    appendNote?: boolean;
    resetClaimedInfo?: boolean;
}

/**
 * Cập nhật hàng loạt nhiều mã voucher trực tiếp trên Cloud
 */
export async function updateVouchersBatch(
    idsOrCodes: string[],
    updates: UpdateVouchersBatchParams,
    clusterContext?: {
        userStoreName?: string;
        accessibleStores?: string[];
        currentUserDisplayName?: string;
        isAdmin?: boolean;
    }
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    try {
        cleanupLegacyLocalStorageVouchers();
        if (!idsOrCodes || idsOrCodes.length === 0) {
            return { success: true, updatedCount: 0 };
        }

        const idSet = new Set(idsOrCodes.map(s => s.trim()));
        const codeSet = new Set(idsOrCodes.map(s => s.trim().toUpperCase()));
        const allCloud = await fetchAllCloudVouchers();

        let targets = allCloud.filter(v => idSet.has(v.id) || codeSet.has(v.code.toUpperCase()));
        if (targets.length === 0) {
            return { success: false, updatedCount: 0, error: 'Không tìm thấy mã voucher nào thỏa mãn để cập nhật!' };
        }

        // Lọc theo phân quyền Cụm nếu không phải Admin
        if (clusterContext && !clusterContext.isAdmin) {
            targets = targets.filter(t =>
                isVoucherInUserCluster(
                    t,
                    clusterContext.userStoreName,
                    clusterContext.accessibleStores,
                    clusterContext.currentUserDisplayName,
                    false
                )
            );
            if (targets.length === 0) {
                return { success: false, updatedCount: 0, error: 'Không có mã nào thuộc quyền quản lý của Cụm bạn để cập nhật!' };
            }
        }

        const updatedList = targets.map(t => {
            let finalNote = t.note;
            if (updates.cluster_stores !== undefined) {
                finalNote = formatNoteWithCluster(
                    updates.note !== undefined
                        ? (updates.appendNote ? `${t.note || ''} ${updates.note}`.trim() : updates.note)
                        : t.note,
                    updates.cluster_stores
                );
            } else if (updates.note !== undefined) {
                const currentClusters = extractClusterStoresFromNote(t.note);
                const rawNote = updates.appendNote ? `${t.note || ''} | ${updates.note}`.trim() : updates.note;
                finalNote = formatNoteWithCluster(rawNote, currentClusters.length > 0 ? currentClusters : undefined);
            }

            let finalStoreName = t.store_name;
            if (updates.store_name) {
                finalStoreName = updates.store_name;
            } else if (updates.cluster_stores && updates.cluster_stores.length > 0) {
                finalStoreName = updates.cluster_stores[0] || 'Toàn Cụm Siêu Thị';
            }

            const willResetClaimed = updates.resetClaimedInfo || (updates.status === 'AVAILABLE' && t.status !== 'AVAILABLE');

            return {
                id: t.id,
                store_name: finalStoreName,
                campaign_name: updates.campaign_name !== undefined ? updates.campaign_name.trim() : t.campaign_name,
                denomination: updates.denomination !== undefined ? Number(updates.denomination) : t.denomination,
                expires_at: updates.expires_at !== undefined ? updates.expires_at : t.expires_at,
                status: updates.status !== undefined ? updates.status : t.status,
                note: finalNote,
                description: updates.description !== undefined ? (updates.description.trim() || null) : t.description,
                claimed_at: willResetClaimed ? null : (t.claimed_at || null),
                claimed_by_id: willResetClaimed ? null : (t.claimed_by_id || null),
                claimed_by_name: willResetClaimed ? null : (t.claimed_by_name || null),
                claimed_by_store: willResetClaimed ? null : (t.claimed_by_store || null),
                order_id: willResetClaimed ? null : (t.order_id || null),
                used_at: willResetClaimed ? null : (t.used_at || null)
            };
        });

        // Upsert theo chunk 100 lên Supabase
        const CHUNK_SIZE = 100;
        for (let idx = 0; idx < updatedList.length; idx += CHUNK_SIZE) {
            const chunk = updatedList.slice(idx, idx + CHUNK_SIZE);
            const { error: upsertErr } = await supabase.from('store_vouchers').upsert(chunk, { onConflict: 'id' });
            if (upsertErr) {
                return { success: false, updatedCount: 0, error: upsertErr.message };
            }
        }

        return { success: true, updatedCount: updatedList.length };
    } catch (e: any) {
        return { success: false, updatedCount: 0, error: e.message || 'Lỗi khi cập nhật mã voucher hàng loạt' };
    }
}

/**
 * Thống kê các chỉ số hết hạn và tồn kho mã voucher
 */
export interface VoucherExpiryStats {
    totalExpired: number;            // Tổng số mã đã hết hạn (chưa hoàn tất dùng)
    expiredAvailable: number;        // Số mã chưa cấp nhưng đã hết hạn (tồn kho chết)
    expiredClaimed: number;          // Số mã đã cấp nhưng chưa dùng mà đã hết hạn
    expiredTotalValue: number;       // Tổng mệnh giá các mã chưa dùng đã hết hạn
    nearExpiryCount: number;         // Số mã sắp hết hạn trong 3 ngày tới
    nearExpiryValue: number;         // Tổng mệnh giá các mã sắp hết hạn
    usedCount: number;               // Số mã đã hoàn tất sử dụng
}

export function getVoucherExpiryStats(
    vouchers: VoucherItem[],
    storeName?: string,
    accessibleStores?: string[],
    currentUserDisplayName?: string,
    isAdmin?: boolean
): VoucherExpiryStats {
    const todayStr = new Date().toISOString().slice(0, 10);
    const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let list = vouchers;
    if (!isAdmin || (storeName && storeName !== 'all')) {
        list = list.filter(v =>
            isVoucherInUserCluster(v, storeName, accessibleStores, currentUserDisplayName, isAdmin)
        );
    }

    let totalExpired = 0;
    let expiredAvailable = 0;
    let expiredClaimed = 0;
    let expiredTotalValue = 0;
    let nearExpiryCount = 0;
    let nearExpiryValue = 0;
    let usedCount = 0;

    list.forEach(v => {
        const denom = Number(v.denomination) || 0;
        if (v.status === 'USED') {
            usedCount++;
            return;
        }

        const isExpired = Boolean(v.expires_at && v.expires_at < todayStr);
        const isNear = Boolean(v.expires_at && !isExpired && v.expires_at <= threeDaysLater);

        if (isExpired) {
            totalExpired++;
            expiredTotalValue += denom;
            if (v.status === 'AVAILABLE') {
                expiredAvailable++;
            } else if (v.status === 'CLAIMED') {
                expiredClaimed++;
            }
        } else if (isNear && v.status === 'AVAILABLE') {
            nearExpiryCount++;
            nearExpiryValue += denom;
        }
    });

    return {
        totalExpired,
        expiredAvailable,
        expiredClaimed,
        expiredTotalValue,
        nearExpiryCount,
        nearExpiryValue,
        usedCount
    };
}

/**
 * Làm sạch kho mã: Dọn dẹp các mã hết hạn hoặc đã sử dụng trực tiếp trên Cloud
 * Có thể chọn XÓA VĨNH VIỄN (DELETE) hoặc CHUYỂN SANG EXPIRED
 */
export async function cleanVouchers(params: {
    type: 'EXPIRED' | 'USED' | 'ALL_INACTIVE';
    mode: 'DELETE' | 'MARK_EXPIRED';
    campaignName?: string;
    storeName?: string;
    accessibleStores?: string[];
    currentUserDisplayName?: string;
    isAdmin?: boolean;
}): Promise<{ success: boolean; affectedCount: number; totalValue: number; error?: string }> {
    try {
        cleanupLegacyLocalStorageVouchers();
        const { type, mode, campaignName, storeName, accessibleStores, currentUserDisplayName, isAdmin } = params;
        const allCloud = await fetchAllCloudVouchers();
        const todayStr = new Date().toISOString().slice(0, 10);

        const matchStore = (v: VoucherItem) => {
            return isVoucherInUserCluster(
                v,
                storeName,
                accessibleStores,
                currentUserDisplayName,
                isAdmin
            );
        };

        const isTarget = (v: VoucherItem) => {
            if (!matchStore(v)) return false;
            if (campaignName && campaignName !== 'ALL' && (v.campaign_name || '').trim().toLowerCase() !== campaignName.trim().toLowerCase()) {
                return false;
            }
            const isExpired = Boolean(v.expires_at && v.expires_at < todayStr);

            if (type === 'EXPIRED') {
                return isExpired && v.status !== 'USED';
            }
            if (type === 'USED') {
                return v.status === 'USED';
            }
            if (type === 'ALL_INACTIVE') {
                return v.status === 'USED' || isExpired;
            }
            return false;
        };

        const targets = allCloud.filter(isTarget);
        if (targets.length === 0) {
            return { success: true, affectedCount: 0, totalValue: 0 };
        }

        const totalValue = targets.reduce((sum, v) => sum + (Number(v.denomination) || 0), 0);
        const targetIds = targets.map(v => v.id);

        if (mode === 'DELETE') {
            const CHUNK_SIZE = 100;
            for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
                const chunk = targetIds.slice(i, i + CHUNK_SIZE);
                await supabase.from('store_vouchers').delete().in('id', chunk);
            }
        } else {
            // Đánh dấu thành EXPIRED
            const toUpdate = targets.map(v => ({
                id: v.id,
                status: 'EXPIRED' as const,
                note: v.note ? `${v.note} | [Quá hạn lúc ${todayStr}]` : `[Quá hạn lúc ${todayStr}]`
            }));

            const CHUNK_SIZE = 100;
            for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
                const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
                await supabase.from('store_vouchers').upsert(chunk, { onConflict: 'id' });
            }
        }

        return { success: true, affectedCount: targets.length, totalValue };
    } catch (e: any) {
        return { success: false, affectedCount: 0, totalValue: 0, error: e.message || 'Lỗi khi làm sạch kho voucher trên Cloud' };
    }
}

/**
 * Tính toán tóm tắt tồn kho mã theo chương trình và từng mệnh giá
 */
export function getCampaignSummaries(
    vouchers: VoucherItem[],
    storeName?: string,
    accessibleStores?: string[],
    currentUserDisplayName?: string,
    isAdmin?: boolean,
    campaignStatuses?: Record<string, VoucherCampaignStatusConfig>
): VoucherCampaignSummary[] {
    let list = vouchers;
    if (!isAdmin || (storeName && storeName !== 'all')) {
        list = list.filter(v =>
            isVoucherInUserCluster(v, storeName, accessibleStores, currentUserDisplayName, isAdmin)
        );
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const map = new Map<string, Map<number, DenominationStock>>();

    list.forEach(v => {
        const cName = v.campaign_name.trim();
        const denom = Number(v.denomination);

        if (!map.has(cName)) {
            map.set(cName, new Map<number, DenominationStock>());
        }

        const denomMap = map.get(cName)!;
        if (!denomMap.has(denom)) {
            const isEnded = isCampaignOrDenomEnded(campaignStatuses, cName, denom);
            const isHidden = isCampaignHidden(campaignStatuses, cName, denom);
            denomMap.set(denom, {
                denomination: denom,
                total: 0,
                available: 0,
                claimed: 0,
                used: 0,
                description: v.description,
                is_ended: isEnded,
                is_hidden: isHidden
            });
        }

        const isExpired = Boolean(v.expires_at && v.expires_at < todayStr);
        const stock = denomMap.get(denom)!;
        if (!stock.description && v.description) {
            stock.description = v.description;
        }
        stock.total++;
        if (v.status === 'AVAILABLE' && !isExpired) stock.available++;
        else if (v.status === 'CLAIMED') stock.claimed++;
        else if (v.status === 'USED') stock.used++;
    });

    const result: VoucherCampaignSummary[] = [];

    map.forEach((denomMap, cName) => {
        const denominations = Array.from(denomMap.values()).sort((a, b) => a.denomination - b.denomination);
        const total_available = denominations.reduce((sum, d) => sum + d.available, 0);
        const total_vouchers = denominations.reduce((sum, d) => sum + d.total, 0);

        const isEntireCampaignEnded = isCampaignOrDenomEnded(campaignStatuses, cName) ||
            (denominations.length > 0 && denominations.every(d => d.is_ended));

        const isHidden = isCampaignHidden(campaignStatuses, cName) ||
            (denominations.length > 0 && denominations.every(d => d.is_hidden));

        result.push({
            campaign_name: cName,
            total_available,
            total_vouchers,
            denominations,
            is_ended: isEntireCampaignEnded,
            is_hidden: isHidden
        });
    });

    return result.sort((a, b) => {
        if (a.is_ended !== b.is_ended) {
            return a.is_ended ? 1 : -1;
        }
        return b.total_available - a.total_available;
    });
}

/**
 * Phân tích và phát hiện rủi ro đầu cơ, tích trữ voucher theo nhân viên
 */
export function analyzeHoardingRisks(
    vouchers: VoucherItem[],
    storeName?: string,
    accessibleStores?: string[]
): VoucherHoardingAlert[] {
    let list = vouchers;
    if (storeName && storeName !== 'all') {
        list = list.filter(v =>
            isStoreOrClusterMatch(v.store_name, storeName, accessibleStores) ||
            (v.claimed_by_store && isStoreOrClusterMatch(v.claimed_by_store, storeName, accessibleStores))
        );
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const empMap = new Map<string, {
        employee_id: string;
        employee_name: string;
        store_name: string;
        claimed_today: VoucherItem[];
        unspent: VoucherItem[];
        total_month: VoucherItem[];
    }>();

    list.forEach(v => {
        if (!v.claimed_by_id) return;
        const empId = v.claimed_by_id.trim();

        if (!empMap.has(empId)) {
            empMap.set(empId, {
                employee_id: empId,
                employee_name: v.claimed_by_name || empId,
                store_name: v.claimed_by_store || v.store_name,
                claimed_today: [],
                unspent: [],
                total_month: []
            });
        }

        const entry = empMap.get(empId)!;
        entry.total_month.push(v);

        if (v.claimed_at && v.claimed_at.startsWith(todayStr)) {
            entry.claimed_today.push(v);
        }

        if (v.status === 'CLAIMED') {
            entry.unspent.push(v);
        }
    });

    const alerts: VoucherHoardingAlert[] = [];

    empMap.forEach(e => {
        const todayCount = e.claimed_today.length;
        const unspentCount = e.unspent.length;
        const totalMonth = e.total_month.length;

        const reasons: string[] = [];
        let risk: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';

        if (todayCount >= 5 && unspentCount >= 5) {
            risk = 'CRITICAL';
            reasons.push(`Lấy ${todayCount} mã trong ngày và đang giữ ${unspentCount} mã chưa dùng`);
        } else if (todayCount >= 3 && unspentCount >= 3) {
            risk = 'WARNING';
            reasons.push(`Lấy ${todayCount} mã trong ngày và đang giữ ${unspentCount} mã chưa dùng`);
        }

        const sortedClaimed = [...e.total_month].sort(
            (a, b) => new Date(b.claimed_at || 0).getTime() - new Date(a.claimed_at || 0).getTime()
        );

        const latest_order_ids = Array.from(new Set(
            sortedClaimed.map(v => v.order_id).filter(Boolean) as string[]
        )).slice(0, 3);

        alerts.push({
            employee_id: e.employee_id,
            employee_name: e.employee_name,
            store_name: e.store_name,
            claimed_today_count: todayCount,
            unspent_count: unspentCount,
            total_month: totalMonth,
            total_claimed_month: totalMonth,
            latest_order_ids,
            latest_claimed_at: sortedClaimed[0]?.claimed_at || '',
            risk_level: risk,
            reasons
        });
    });

    const riskRank = { CRITICAL: 3, WARNING: 2, NORMAL: 1 };
    return alerts.sort((a, b) => {
        const rDiff = riskRank[b.risk_level] - riskRank[a.risk_level];
        if (rDiff !== 0) return rDiff;
        return b.claimed_today_count - a.claimed_today_count;
    });
}
