import { supabase } from '../../../core/lib/supabase';
import { isStoreMatch } from '../../../core/lib/formatters';
import type {
    VoucherItem,
    VoucherClaimRequest,
    VoucherCampaignSummary,
    VoucherHoardingAlert,
    DenominationStock
} from '../types';

const STORAGE_KEY = 'saleshub_store_vouchers_v1';

export const STORE_VOUCHERS_SQL = `-- ========================================================
-- TẠO BẢNG LƯU TRỮ KHO MÃ VOUCHER TRÊN SUPABASE CLOUD
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
    note TEXT
);

-- Kích hoạt RLS & chính sách truy cập công khai/anon
ALTER TABLE public.store_vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_vouchers_all_policy" ON public.store_vouchers;
CREATE POLICY "store_vouchers_all_policy" 
ON public.store_vouchers FOR ALL USING (true) WITH CHECK (true);

-- Index tăng tốc tra cứu dữ liệu
CREATE INDEX IF NOT EXISTS idx_store_vouchers_store_status ON public.store_vouchers(store_name, status);
CREATE INDEX IF NOT EXISTS idx_store_vouchers_code ON public.store_vouchers(code);
CREATE INDEX IF NOT EXISTS idx_store_vouchers_expires ON public.store_vouchers(expires_at);
`;

/**
 * Lấy ngày cuối cùng của tháng hiện tại dạng YYYY-MM-DD
 * Mặc định: ví dụ hôm nay thuộc tháng 10 -> ngày cuối là 31/10
 */
export function getDefaultExpiryDate(): string {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const yyyy = lastDay.getFullYear();
    const mm = String(lastDay.getMonth() + 1).padStart(2, '0');
    const dd = String(lastDay.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export interface SupabaseStorageStatus {
    isConnected: boolean;
    tableExists: boolean;
    error?: string;
    cloudCount?: number;
}

/**
 * Kiểm tra trạng thái kết nối và sự tồn tại của bảng store_vouchers trên Supabase
 */
export async function checkSupabaseVoucherTable(): Promise<SupabaseStorageStatus> {
    try {
        const { count, error } = await supabase
            .from('store_vouchers')
            .select('id', { count: 'exact', head: true });

        if (error) {
            // Lỗi PGRST205: bảng chưa được tạo trong PostgreSQL
            if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('store_vouchers')) {
                return {
                    isConnected: true,
                    tableExists: false,
                    error: 'Bảng "store_vouchers" chưa được tạo trên Supabase Cloud.'
                };
            }
            return {
                isConnected: false,
                tableExists: false,
                error: error.message
            };
        }

        return {
            isConnected: true,
            tableExists: true,
            cloudCount: count ?? 0
        };
    } catch (err: any) {
        return {
            isConnected: false,
            tableExists: false,
            error: err.message || 'Lỗi kết nối Supabase'
        };
    }
}

/**
 * Đẩy toàn bộ danh sách mã từ LocalStorage lên Supabase Cloud
 */
export async function syncLocalVouchersToCloud(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    try {
        const local = getLocalVouchers();
        if (local.length === 0) {
            return { success: true, syncedCount: 0 };
        }

        const { error } = await supabase.from('store_vouchers').upsert(local, { onConflict: 'id' });
        if (error) {
            return { success: false, syncedCount: 0, error: error.message };
        }

        return { success: true, syncedCount: local.length };
    } catch (e: any) {
        return { success: false, syncedCount: 0, error: e.message || String(e) };
    }
}

/**
 * Đọc toàn bộ danh sách mã từ LocalStorage
 */
export function getLocalVouchers(): VoucherItem[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

/**
 * Lưu danh sách mã vào LocalStorage
 */
export function setLocalVouchers(list: VoucherItem[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
        console.warn('Lỗi ghi LocalStorage voucher:', e);
    }
}

/**
 * Tải danh sách voucher theo siêu thị (Đồng bộ Cloud Supabase + LocalStorage)
 */
export async function fetchStoreVouchers(storeName?: string): Promise<VoucherItem[]> {
    let localList = getLocalVouchers();

    // Thử đồng bộ từ Supabase nếu có kết nối
    try {
        let query = supabase.from('store_vouchers').select('*');
        if (storeName && storeName !== 'all') {
            query = query.eq('store_name', storeName);
        }

        const { data, error } = await query;
        if (!error && data && Array.isArray(data)) {
            const cloudMap = new Map<string, VoucherItem>();
            data.forEach((item: any) => {
                cloudMap.set(item.id, item as VoucherItem);
            });

            // Hợp nhất dữ liệu local chưa sync
            localList.forEach(item => {
                if (!cloudMap.has(item.id)) {
                    cloudMap.set(item.id, item);
                }
            });

            const merged = Array.from(cloudMap.values());
            setLocalVouchers(merged);
            localList = merged;
        }
    } catch (e) {
        // Fallback local
    }

    if (storeName && storeName !== 'all') {
        return localList.filter(v =>
            isStoreMatch(v.store_name, storeName) ||
            (v.claimed_by_store && isStoreMatch(v.claimed_by_store, storeName)) ||
            v.store_name === 'Toàn Cụm Siêu Thị' ||
            v.store_name === 'Toàn Cụm' ||
            v.store_name === 'all'
        );
    }
    return localList;
}

/**
 * Nạp thêm mã voucher vào kho (Hỗ trợ nhiều dòng, lọc trùng lặp, lưu Cloud + Local)
 */
export async function importVouchers(params: {
    store_name: string;
    campaign_name: string;
    denomination: number;
    codes: string[];
    created_by: string;
    expires_at?: string;
}): Promise<{
    success: boolean;
    addedCount: number;
    duplicateCount: number;
    cloudSaved?: boolean;
    cloudWarning?: string;
    error?: string;
}> {
    try {
        const all = getLocalVouchers();
        // Kiểm tra trùng mã trên toàn hệ thống để không cấp trùng mã
        const existingCodes = new Set(all.map(v => v.code.toUpperCase()));

        const newItems: VoucherItem[] = [];
        let duplicateCount = 0;
        const now = new Date().toISOString();
        const effectiveExpiry = params.expires_at || getDefaultExpiryDate();

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
                created_by: params.created_by
            };
            newItems.push(item);
        }

        let cloudSaved = false;
        let cloudWarning: string | undefined;

        if (newItems.length > 0) {
            const updated = [...newItems, ...all];
            setLocalVouchers(updated);

            // Đồng bộ trực tiếp lên Supabase Cloud
            try {
                const { error: cloudErr } = await supabase.from('store_vouchers').upsert(newItems, { onConflict: 'id' });
                if (!cloudErr) {
                    cloudSaved = true;
                } else {
                    if (cloudErr.code === 'PGRST205' || cloudErr.message?.includes('store_vouchers')) {
                        cloudWarning = 'Bảng "store_vouchers" chưa được tạo trên Supabase Cloud! Dữ liệu đã lưu tạm ở máy này.';
                    } else {
                        cloudWarning = `Chưa đồng bộ Cloud: ${cloudErr.message}`;
                    }
                }
            } catch (cloudErr: any) {
                cloudWarning = `Không thể kết nối Supabase Cloud: ${cloudErr.message}`;
            }
        }

        return {
            success: true,
            addedCount: newItems.length,
            duplicateCount,
            cloudSaved,
            cloudWarning
        };
    } catch (e: any) {
        return { success: false, addedCount: 0, duplicateCount: 0, error: e.message || String(e) };
    }
}

/**
 * Cấp mã voucher cho nhân viên (Ràng buộc mã đơn hàng, atomic select)
 * All nhân viên trong cụm đều có thể lấy mã trong kho sẵn có
 */
export async function claimVoucher(
    req: VoucherClaimRequest
): Promise<{ success: boolean; voucher?: VoucherItem; error?: string }> {
    try {
        const all = getLocalVouchers();
        const todayStr = new Date().toISOString().slice(0, 10);
        const isNotExpired = (v: VoucherItem) => !v.expires_at || v.expires_at >= todayStr;

        // 1. Ưu tiên tìm mã riêng của siêu thị nhân viên đang làm việc (nếu có)
        let index = all.findIndex(v =>
            isStoreMatch(v.store_name, req.store_name) &&
            v.campaign_name.trim().toLowerCase() === req.campaign_name.trim().toLowerCase() &&
            Number(v.denomination) === Number(req.denomination) &&
            v.status === 'AVAILABLE' &&
            isNotExpired(v)
        );

        // 2. Nếu siêu thị không có mã riêng, tìm trong kho mã dùng chung cho Toàn Cụm
        if (index === -1) {
            index = all.findIndex(v =>
                (v.store_name === 'Toàn Cụm Siêu Thị' || v.store_name === 'Toàn Cụm' || v.store_name === 'all') &&
                v.campaign_name.trim().toLowerCase() === req.campaign_name.trim().toLowerCase() &&
                Number(v.denomination) === Number(req.denomination) &&
                v.status === 'AVAILABLE' &&
                isNotExpired(v)
            );
        }

        // 3. Fallback: Nếu kho cụm vẫn còn bất kỳ mã nào khả dụng của chương trình & mệnh giá đó, cho phép lấy ngay
        if (index === -1) {
            index = all.findIndex(v =>
                v.campaign_name.trim().toLowerCase() === req.campaign_name.trim().toLowerCase() &&
                Number(v.denomination) === Number(req.denomination) &&
                v.status === 'AVAILABLE' &&
                isNotExpired(v)
            );
        }

        if (index === -1) {
            return {
                success: false,
                error: `Đã hết mã voucher mệnh giá ${req.denomination.toLocaleString('vi-VN')}đ của chương trình "${req.campaign_name}" trong kho cụm!`
            };
        }

        const now = new Date().toISOString();
        const target = all[index];
        const updatedVoucher: VoucherItem = {
            ...target,
            status: 'CLAIMED',
            claimed_at: now,
            claimed_by_id: req.employee_id.trim(),
            claimed_by_name: req.employee_name.trim(),
            claimed_by_store: req.store_name.trim(), // Lưu chính xác tên siêu thị của user thao tác
            order_id: req.order_id.trim().toUpperCase()
        };

        all[index] = updatedVoucher;
        setLocalVouchers(all);

        // Sync Supabase
        try {
            await supabase.from('store_vouchers').upsert([updatedVoucher], { onConflict: 'id' });
        } catch (e) {
            console.warn('Không thể sync ngay với Cloud:', e);
        }

        return { success: true, voucher: updatedVoucher };
    } catch (e: any) {
        return { success: false, error: e.message || 'Lỗi khi cấp mã voucher' };
    }
}

/**
 * Reset mã đã lấy nhưng chưa dùng quay trở về kho chờ (AVAILABLE)
 */
export async function resetClaimedVoucher(
    code: string,
    performedBy: string,
    storeName?: string
): Promise<{ success: boolean; voucher?: VoucherItem; error?: string }> {
    try {
        const all = getLocalVouchers();
        const cleanCode = code.trim().toUpperCase();

        const index = all.findIndex(v => {
            const matchCode = v.code.toUpperCase() === cleanCode;
            if (!matchCode) return false;
            if (storeName && storeName !== 'all') {
                return (
                    isStoreMatch(v.store_name, storeName) ||
                    (v.claimed_by_store && isStoreMatch(v.claimed_by_store, storeName)) ||
                    v.store_name === 'Toàn Cụm Siêu Thị' ||
                    v.store_name === 'Toàn Cụm' ||
                    v.store_name === 'all'
                );
            }
            return true;
        });

        if (index === -1) {
            return { success: false, error: `Không tìm thấy mã voucher "${cleanCode}" trong hệ thống!` };
        }

        const target = all[index];
        const prevClaimed = target.claimed_by_name ? ` (NV: ${target.claimed_by_name} - ${target.claimed_by_id || ''} [${target.claimed_by_store || target.store_name}])` : '';
        const prevOrder = target.order_id ? ` (ĐH: ${target.order_id})` : '';
        const resetNote = `[Reset lúc ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')} bởi ${performedBy}] Trước đó: ${target.status}${prevClaimed}${prevOrder}`;

        const updated: VoucherItem = {
            ...target,
            status: 'AVAILABLE',
            claimed_at: undefined,
            claimed_by_id: undefined,
            claimed_by_name: undefined,
            claimed_by_store: undefined,
            order_id: undefined,
            used_at: undefined,
            note: target.note ? `${target.note} | ${resetNote}` : resetNote
        };

        all[index] = updated;
        setLocalVouchers(all);

        try {
            await supabase.from('store_vouchers').upsert([updated], { onConflict: 'id' });
        } catch (e) {
            console.warn('Sync cloud error on reset:', e);
        }

        return { success: true, voucher: updated };
    } catch (e: any) {
        return { success: false, error: e.message || 'Lỗi khi reset voucher' };
    }
}

/**
 * Đánh dấu mã đã sử dụng thành công trên hóa đơn thực tế
 */
export async function markVoucherUsed(code: string): Promise<{ success: boolean; error?: string }> {
    try {
        const all = getLocalVouchers();
        const cleanCode = code.trim().toUpperCase();
        const index = all.findIndex(v => v.code.toUpperCase() === cleanCode);

        if (index === -1) {
            return { success: false, error: 'Không tìm thấy mã voucher' };
        }

        all[index] = {
            ...all[index],
            status: 'USED',
            used_at: new Date().toISOString()
        };
        setLocalVouchers(all);

        try {
            await supabase.from('store_vouchers').upsert([all[index]], { onConflict: 'id' });
        } catch {
            // silent
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Xóa một mã voucher khỏi hệ thống (Local + Supabase Cloud)
 */
export async function deleteVoucher(idOrCode: string): Promise<{ success: boolean; error?: string }> {
    try {
        const all = getLocalVouchers();
        const clean = idOrCode.trim();
        const target = all.find(v => v.id === clean || v.code.toUpperCase() === clean.toUpperCase());

        if (!target) {
            return { success: false, error: 'Không tìm thấy mã voucher để xóa' };
        }

        const remaining = all.filter(v => v.id !== target.id);
        setLocalVouchers(remaining);

        // Xóa trên Supabase Cloud
        try {
            await supabase.from('store_vouchers').delete().eq('id', target.id);
        } catch (e) {
            console.warn('Lỗi xóa voucher trên Supabase:', e);
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Lỗi khi xóa mã voucher' };
    }
}

/**
 * Xóa nhiều mã voucher theo danh sách id hoặc mã code (Batch delete)
 */
export async function deleteVouchersBatch(idsOrCodes: string[]): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    try {
        if (!idsOrCodes || idsOrCodes.length === 0) {
            return { success: true, deletedCount: 0 };
        }

        const cleanSet = new Set(idsOrCodes.map(s => s.trim().toUpperCase()));
        const idSet = new Set(idsOrCodes.map(s => s.trim()));
        const all = getLocalVouchers();

        const targets = all.filter(v => idSet.has(v.id) || cleanSet.has(v.code.toUpperCase()));
        if (targets.length === 0) {
            return { success: true, deletedCount: 0 };
        }

        const targetIds = targets.map(t => t.id);
        const targetIdSet = new Set(targetIds);

        const remaining = all.filter(v => !targetIdSet.has(v.id));
        setLocalVouchers(remaining);

        // Xóa trên Supabase Cloud
        try {
            await supabase.from('store_vouchers').delete().in('id', targetIds);
        } catch (e) {
            console.warn('Lỗi xóa batch trên Supabase:', e);
        }

        return { success: true, deletedCount: targets.length };
    } catch (e: any) {
        return { success: false, deletedCount: 0, error: e.message || 'Lỗi khi xóa mã voucher hàng loạt' };
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

export function getVoucherExpiryStats(vouchers: VoucherItem[], storeName?: string): VoucherExpiryStats {
    const todayStr = new Date().toISOString().slice(0, 10);
    const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let list = vouchers;
    if (storeName && storeName !== 'all') {
        list = list.filter(v =>
            isStoreMatch(v.store_name, storeName) ||
            (v.claimed_by_store && isStoreMatch(v.claimed_by_store, storeName)) ||
            v.store_name === 'Toàn Cụm Siêu Thị' ||
            v.store_name === 'Toàn Cụm'
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
 * Làm sạch kho mã: Dọn dẹp các mã hết hạn hoặc đã sử dụng
 * Có thể chọn XÓA VĨNH VIỄN (DELETE) hoặc CHUYỂN SANG EXPIRED
 */
export async function cleanVouchers(params: {
    type: 'EXPIRED' | 'USED' | 'ALL_INACTIVE';
    mode: 'DELETE' | 'MARK_EXPIRED';
    storeName?: string;
}): Promise<{ success: boolean; affectedCount: number; totalValue: number; error?: string }> {
    try {
        const { type, mode, storeName } = params;
        const all = getLocalVouchers();
        const todayStr = new Date().toISOString().slice(0, 10);

        const matchStore = (v: VoucherItem) => {
            if (!storeName || storeName === 'all') return true;
            return isStoreMatch(v.store_name, storeName) ||
                (v.claimed_by_store && isStoreMatch(v.claimed_by_store, storeName)) ||
                v.store_name === 'Toàn Cụm Siêu Thị' ||
                v.store_name === 'Toàn Cụm';
        };

        const isTarget = (v: VoucherItem) => {
            if (!matchStore(v)) return false;
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

        const targets = all.filter(isTarget);
        if (targets.length === 0) {
            return { success: true, affectedCount: 0, totalValue: 0 };
        }

        const totalValue = targets.reduce((sum, v) => sum + (Number(v.denomination) || 0), 0);
        const targetIds = targets.map(v => v.id);
        const targetIdSet = new Set(targetIds);

        if (mode === 'DELETE') {
            // Xóa hoàn toàn
            const remaining = all.filter(v => !targetIdSet.has(v.id));
            setLocalVouchers(remaining);

            try {
                await supabase.from('store_vouchers').delete().in('id', targetIds);
            } catch (e) {
                console.warn('Lỗi xóa trên Supabase khi clean:', e);
            }
        } else {
            // Đánh dấu thành EXPIRED
            const updated = all.map(v => {
                if (targetIdSet.has(v.id)) {
                    return {
                        ...v,
                        status: 'EXPIRED' as const,
                        note: v.note ? `${v.note} | [Quá hạn lúc ${todayStr}]` : `[Quá hạn lúc ${todayStr}]`
                    };
                }
                return v;
            });
            setLocalVouchers(updated);

            try {
                const toUpdate = updated.filter(v => targetIdSet.has(v.id));
                await supabase.from('store_vouchers').upsert(toUpdate, { onConflict: 'id' });
            } catch (e) {
                console.warn('Lỗi cập nhật EXPIRED trên Supabase:', e);
            }
        }

        return { success: true, affectedCount: targets.length, totalValue };
    } catch (e: any) {
        return { success: false, affectedCount: 0, totalValue: 0, error: e.message || 'Lỗi khi làm sạch kho voucher' };
    }
}

/**
 * Tính toán tóm tắt tồn kho mã theo chương trình và từng mệnh giá
 */
export function getCampaignSummaries(vouchers: VoucherItem[], storeName?: string): VoucherCampaignSummary[] {
    let list = vouchers;
    if (storeName && storeName !== 'all') {
        list = list.filter(v =>
            v.status === 'AVAILABLE' ||
            isStoreMatch(v.store_name, storeName) ||
            (v.claimed_by_store && isStoreMatch(v.claimed_by_store, storeName)) ||
            v.store_name === 'Toàn Cụm Siêu Thị' ||
            v.store_name === 'Toàn Cụm' ||
            v.store_name === 'all'
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
            denomMap.set(denom, {
                denomination: denom,
                total: 0,
                available: 0,
                claimed: 0,
                used: 0
            });
        }

        const isExpired = Boolean(v.expires_at && v.expires_at < todayStr);
        const stock = denomMap.get(denom)!;
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

        result.push({
            campaign_name: cName,
            total_available,
            total_vouchers,
            denominations
        });
    });

    return result.sort((a, b) => b.total_available - a.total_available);
}

/**
 * Phân tích và phát hiện rủi ro đầu cơ, tích trữ voucher theo nhân viên
 */
export function analyzeHoardingRisks(vouchers: VoucherItem[], storeName?: string): VoucherHoardingAlert[] {
    let list = vouchers;
    if (storeName && storeName !== 'all') {
        list = list.filter(v =>
            isStoreMatch(v.store_name, storeName) ||
            (v.claimed_by_store && isStoreMatch(v.claimed_by_store, storeName)) ||
            v.store_name === 'Toàn Cụm Siêu Thị' ||
            v.store_name === 'Toàn Cụm'
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

        if (todayCount >= 5) {
            risk = 'CRITICAL';
            reasons.push(`Lấy ${todayCount} mã trong ngày (vượt ngưỡng an toàn)`);
        } else if (todayCount >= 3) {
            risk = 'WARNING';
            reasons.push(`Lấy ${todayCount} mã trong hôm nay`);
        }

        if (unspentCount >= 4) {
            risk = 'CRITICAL';
            reasons.push(`Đang giữ ${unspentCount} mã chưa hoàn tất đơn hàng`);
        } else if (unspentCount >= 2 && risk !== 'CRITICAL') {
            risk = 'WARNING';
            reasons.push(`Đang giữ ${unspentCount} mã chưa sử dụng`);
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
            total_claimed_month: totalMonth,
            latest_order_ids,
            latest_claimed_at: sortedClaimed[0]?.claimed_at || '',
            risk_level: risk,
            reasons
        });
    });

    // Ưu tiên hiển thị rủi ro cao trước
    const riskRank = { CRITICAL: 3, WARNING: 2, NORMAL: 1 };
    return alerts.sort((a, b) => {
        const rDiff = riskRank[b.risk_level] - riskRank[a.risk_level];
        if (rDiff !== 0) return rDiff;
        return b.claimed_today_count - a.claimed_today_count;
    });
}
