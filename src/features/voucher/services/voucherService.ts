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
                    error: 'Bảng "store_vouchers" chưa được tạo trên CLOUD.'
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
 * Kiểm tra đối chiếu tên siêu thị / cụm siêu thị cho voucher
 * Hỗ trợ:
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
    // CHỈ cho phép hiển thị nếu người tạo khớp với Quản lý của cụm này hoặc có nhắc đến shop trong note
    const isOldClusterString = (
        vStore === 'Toàn Cụm Siêu Thị' ||
        vStore === 'Toàn Cụm' ||
        vStore === 'all' ||
        vStore.toLowerCase().includes('toàn cụm')
    );
    if (isOldClusterString) {
        // Khớp theo người nạp (Quản lý tạo mã cho cụm của mình)
        if (currentUserDisplayName && voucherCreatedBy && currentUserDisplayName.trim().toLowerCase() === voucherCreatedBy.trim().toLowerCase()) {
            return true;
        }
        // Khớp nếu note chứa tên hoặc địa chỉ siêu thị trong cụm
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
 * Tải danh sách voucher theo siêu thị / cụm siêu thị (Đồng bộ Cloud Supabase + LocalStorage)
 * Phân lập hoàn toàn quyền riêng tư giữa các Cụm khác nhau
 */
export async function fetchStoreVouchers(
    storeName?: string,
    accessibleStores?: string[],
    currentUserDisplayName?: string,
    isAdmin?: boolean
): Promise<VoucherItem[]> {
    let localList = getLocalVouchers();

    // Đồng bộ từ Supabase nếu có kết nối
    try {
        const { data, error } = await supabase
            .from('store_vouchers')
            .select('*')
            .order('created_at', { ascending: false });

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

    // Nếu là Admin và chọn xem toàn bộ ('all'): Cho phép xem tất cả
    if (isAdmin && (!storeName || storeName === 'all')) {
        return localList;
    }

    // Với mọi trường hợp khác (Quản lý Cụm, Nhân viên, hoặc Admin chọn lọc siêu thị):
    // Luôn lọc nghiêm ngặt theo phạm vi Cụm của người dùng
    return localList.filter(v =>
        isVoucherInUserCluster(v, storeName, accessibleStores, currentUserDisplayName, isAdmin)
    );
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
        const all = getLocalVouchers();
        // Kiểm tra trùng mã trên toàn hệ thống để không cấp trùng mã
        const existingCodes = new Set(all.map(v => v.code.toUpperCase()));

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
                        cloudWarning = 'Bảng "store_vouchers" chưa được tạo trên CLOUD! Dữ liệu đã lưu tạm ở máy này.';
                    } else {
                        cloudWarning = `Chưa đồng bộ Cloud: ${cloudErr.message}`;
                    }
                }
            } catch (cloudErr: any) {
                cloudWarning = `Không thể kết nối CLOUD: ${cloudErr.message}`;
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
 * Nhân viên CHỈ được lấy mã trong phạm vi Cụm siêu thị của mình!
 */
export async function claimVoucher(
    req: VoucherClaimRequest
): Promise<{ success: boolean; voucher?: VoucherItem; error?: string }> {
    try {
        // Đồng bộ dữ liệu mới nhất từ Supabase Cloud để chống tranh chấp mã
        try {
            const { data: cloudData, error: cloudErr } = await supabase
                .from('store_vouchers')
                .select('*')
                .order('created_at', { ascending: false });

            if (!cloudErr && cloudData && Array.isArray(cloudData)) {
                setLocalVouchers(cloudData as VoucherItem[]);
            }
        } catch (e) {
            console.warn('Fallback local khi claim voucher:', e);
        }

        const all = getLocalVouchers();
        const todayStr = new Date().toISOString().slice(0, 10);
        const isNotExpired = (v: VoucherItem) => !v.expires_at || v.expires_at >= todayStr;
        const matchesCampaignAndDenom = (v: VoucherItem) =>
            v.campaign_name.trim().toLowerCase() === req.campaign_name.trim().toLowerCase() &&
            Number(v.denomination) === Number(req.denomination) &&
            v.status === 'AVAILABLE' &&
            isNotExpired(v);

        // 1. Ưu tiên tìm mã riêng của siêu thị nhân viên đang làm việc (nếu có)
        let index = all.findIndex(v =>
            isStoreMatch(v.store_name, req.store_name) && matchesCampaignAndDenom(v)
        );

        // 2. Tìm trong danh sách siêu thị được phân quyền của Cụm (accessible_stores)
        if (index === -1 && req.accessible_stores && req.accessible_stores.length > 0) {
            index = all.findIndex(v =>
                req.accessible_stores!.some(s => isStoreMatch(v.store_name, s)) && matchesCampaignAndDenom(v)
            );
        }

        // 3. Tìm theo Cụm (cùng địa chỉ dùng chung hoặc cùng metadata [CỤM: ...] trong note)
        if (index === -1) {
            index = all.findIndex(v =>
                isStoreOrClusterMatch(
                    v.store_name,
                    req.store_name,
                    req.accessible_stores,
                    v.note,
                    v.created_by,
                    req.employee_name,
                    v.claimed_by_store
                ) && matchesCampaignAndDenom(v)
            );
        }

        if (index === -1) {
            return {
                success: false,
                error: `Đã hết mã voucher mệnh giá ${req.denomination.toLocaleString('vi-VN')}đ của chương trình "${req.campaign_name}" trong kho Cụm của bạn!`
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

        // Đồng bộ trực tiếp lên Supabase Cloud
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
    storeName?: string,
    accessibleStores?: string[]
): Promise<{ success: boolean; voucher?: VoucherItem; error?: string }> {
    try {
        let all = getLocalVouchers();
        const cleanCode = code.trim().toUpperCase();

        // Đồng bộ realtime bản ghi mới nhất từ Supabase Cloud nếu có kết nối
        try {
            const { data: cloudRow } = await supabase
                .from('store_vouchers')
                .select('*')
                .eq('code', cleanCode)
                .maybeSingle();

            if (cloudRow) {
                const cIdx = all.findIndex(v => v.id === cloudRow.id || v.code.toUpperCase() === cleanCode);
                if (cIdx >= 0) {
                    all[cIdx] = cloudRow;
                } else {
                    all.push(cloudRow);
                }
                setLocalVouchers(all);
            }
        } catch (e) {
            console.warn('Không thể kiểm tra cloud trước khi reset:', e);
        }

        // 1. Tìm theo mã và siêu thị/cụm
        let index = all.findIndex(v => {
            const matchCode = v.code.toUpperCase() === cleanCode;
            if (!matchCode) return false;
            if (storeName && storeName !== 'all') {
                return (
                    isStoreOrClusterMatch(v.store_name, storeName, accessibleStores) ||
                    (v.claimed_by_store && isStoreOrClusterMatch(v.claimed_by_store, storeName, accessibleStores))
                );
            }
            return true;
        });

        // 2. Fallback tìm theo mã chính xác nếu không lọc trúng storeName
        if (index === -1) {
            index = all.findIndex(v => v.code.toUpperCase() === cleanCode);
        }

        if (index === -1) {
            return { success: false, error: `Không tìm thấy mã voucher "${cleanCode}" trong hệ thống!` };
        }

        const target = all[index];

        // Chặn không cho trả lại mã đã sử dụng hoàn tất trong đơn hàng
        if (target.status === 'USED') {
            return {
                success: false,
                error: `Mã voucher "${cleanCode}" đã được ghi nhận sử dụng hoàn tất trong đơn hàng (${target.order_id || 'đã thanh toán'}), không thể trả lại kho!`
            };
        }

        // Nếu mã đã ở trạng thái AVAILABLE sẵn rồi
        if (target.status === 'AVAILABLE') {
            return {
                success: true,
                voucher: target
            };
        }

        const prevClaimed = target.claimed_by_name ? ` (NV: ${target.claimed_by_name} - ${target.claimed_by_id || ''} [${target.claimed_by_store || target.store_name}])` : '';
        const prevOrder = target.order_id ? ` (ĐH: ${target.order_id})` : '';
        const resetNote = `[Trả lại kho lúc ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')} bởi ${performedBy}] Trước đó: ${target.status}${prevClaimed}${prevOrder}`;

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

        // Đồng bộ lên Supabase Cloud: Gán các trường claimed/order thành null để Postgres DB xóa sạch dữ liệu cũ
        try {
            const dbPayload = {
                ...updated,
                claimed_at: null,
                claimed_by_id: null,
                claimed_by_name: null,
                claimed_by_store: null,
                order_id: null,
                used_at: null
            };
            await supabase.from('store_vouchers').upsert([dbPayload], { onConflict: 'id' });
        } catch (e) {
            console.warn('Sync cloud error on reset:', e);
        }

        return { success: true, voucher: updated };
    } catch (e: any) {
        return { success: false, error: e.message || 'Lỗi khi reset voucher' };
    }
}

/**
 * Đánh dấu mã đã sử dụng thành công trên hóa đơn thực tế và cập nhật mã đơn hàng mới nếu có
 */
export async function markVoucherUsed(code: string, newOrderId?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const all = getLocalVouchers();
        const cleanCode = code.trim().toUpperCase();
        const index = all.findIndex(v => v.code.toUpperCase() === cleanCode);

        if (index === -1) {
            return { success: false, error: 'Không tìm thấy mã voucher' };
        }

        const finalOrderId = newOrderId !== undefined
            ? (newOrderId.trim().toUpperCase() || undefined)
            : all[index].order_id;

        all[index] = {
            ...all[index],
            status: 'USED',
            order_id: finalOrderId,
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
        const all = getLocalVouchers();
        const clean = idOrCode.trim();
        const target = all.find(v => v.id === clean || v.code.toUpperCase() === clean.toUpperCase());

        if (!target) {
            return { success: false, error: 'Không tìm thấy mã voucher để xóa' };
        }

        // Chặn người dùng xóa mã thuộc Cụm khác nếu không phải Admin
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
        if (!idsOrCodes || idsOrCodes.length === 0) {
            return { success: true, deletedCount: 0 };
        }

        const cleanSet = new Set(idsOrCodes.map(s => s.trim().toUpperCase()));
        const idSet = new Set(idsOrCodes.map(s => s.trim()));
        const all = getLocalVouchers();

        let targets = all.filter(v => idSet.has(v.id) || cleanSet.has(v.code.toUpperCase()));
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
    // Xóa tag CỤM cũ nếu có
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
 * Cập nhật chỉnh sửa thông tin một mã voucher đơn lẻ (Local + Supabase Cloud)
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
        const all = getLocalVouchers();
        const index = all.findIndex(v => v.id === voucherId);

        if (index === -1) {
            return { success: false, error: 'Không tìm thấy mã voucher cần cập nhật!' };
        }

        const target = all[index];

        // Kiểm tra phân quyền Cụm nếu không phải Admin
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

        // Nếu thay đổi mã code: kiểm tra trùng lặp với mã khác
        let finalCode = target.code;
        if (updates.code && updates.code.trim()) {
            const cleanNewCode = updates.code.trim().toUpperCase();
            if (cleanNewCode !== target.code.toUpperCase()) {
                const duplicate = all.find(v => v.id !== target.id && v.code.toUpperCase() === cleanNewCode);
                if (duplicate) {
                    return { success: false, error: `Mã coupon "${cleanNewCode}" đã tồn tại trong hệ thống (thuộc chương trình "${duplicate.campaign_name}")!` };
                }
                finalCode = cleanNewCode;
            }
        }

        // Xác định ghi chú và tag cụm
        let finalNote = target.note;
        if (updates.cluster_stores !== undefined) {
            finalNote = formatNoteWithCluster(
                updates.note !== undefined ? updates.note : target.note,
                updates.cluster_stores
            );
        } else if (updates.note !== undefined) {
            // Giữ lại tag cụm cũ nếu có
            const currentClusters = extractClusterStoresFromNote(target.note);
            finalNote = formatNoteWithCluster(updates.note, currentClusters.length > 0 ? currentClusters : undefined);
        }

        // Xác định tên siêu thị / kho sở hữu
        let finalStoreName = target.store_name;
        if (updates.store_name) {
            finalStoreName = updates.store_name;
        } else if (updates.cluster_stores && updates.cluster_stores.length > 0) {
            // Nếu chọn danh sách cụm mà chưa chỉ định store_name, dùng shop đầu tiên
            finalStoreName = updates.cluster_stores[0] || 'Toàn Cụm Siêu Thị';
        }

        const willResetClaimed = updates.resetClaimedInfo || (updates.status === 'AVAILABLE' && target.status !== 'AVAILABLE');

        const updatedVoucher: VoucherItem = {
            ...target,
            code: finalCode,
            campaign_name: updates.campaign_name !== undefined ? updates.campaign_name.trim() : target.campaign_name,
            denomination: updates.denomination !== undefined ? Number(updates.denomination) : target.denomination,
            expires_at: updates.expires_at !== undefined ? updates.expires_at : target.expires_at,
            status: updates.status !== undefined ? updates.status : target.status,
            store_name: finalStoreName,
            note: finalNote,
            description: updates.description !== undefined ? (updates.description.trim() || undefined) : target.description,
            claimed_at: willResetClaimed ? undefined : target.claimed_at,
            claimed_by_id: willResetClaimed ? undefined : target.claimed_by_id,
            claimed_by_name: willResetClaimed ? undefined : target.claimed_by_name,
            claimed_by_store: willResetClaimed ? undefined : target.claimed_by_store,
            order_id: willResetClaimed ? undefined : target.order_id,
            used_at: willResetClaimed ? undefined : target.used_at
        };

        all[index] = updatedVoucher;
        setLocalVouchers(all);

        // Đồng bộ lên Supabase Cloud
        try {
            const dbPayload = {
                ...updatedVoucher,
                claimed_at: updatedVoucher.claimed_at ?? null,
                claimed_by_id: updatedVoucher.claimed_by_id ?? null,
                claimed_by_name: updatedVoucher.claimed_by_name ?? null,
                claimed_by_store: updatedVoucher.claimed_by_store ?? null,
                order_id: updatedVoucher.order_id ?? null,
                used_at: updatedVoucher.used_at ?? null
            };
            await supabase.from('store_vouchers').upsert([dbPayload], { onConflict: 'id' });
        } catch (e) {
            console.warn('Lỗi sync cloud khi update voucher:', e);
        }

        return { success: true, voucher: updatedVoucher };
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
 * Cập nhật hàng loạt nhiều mã voucher (Local + Supabase Cloud)
 * Hỗ trợ cập nhật đồng loạt: Cụm/Kho được phép sử dụng, CT, Mệnh giá, HSD, Trạng thái, Ghi chú
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
        if (!idsOrCodes || idsOrCodes.length === 0) {
            return { success: true, updatedCount: 0 };
        }

        const idSet = new Set(idsOrCodes.map(s => s.trim()));
        const codeSet = new Set(idsOrCodes.map(s => s.trim().toUpperCase()));
        const all = getLocalVouchers();

        let targets = all.filter(v => idSet.has(v.id) || codeSet.has(v.code.toUpperCase()));
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

        const targetIdSet = new Set(targets.map(t => t.id));
        const updatedList: VoucherItem[] = [];

        for (let i = 0; i < all.length; i++) {
            if (!targetIdSet.has(all[i].id)) continue;

            const t = all[i];

            // 1. Cụm/Kho & Note
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

            // 2. Trạng thái & Reset cấp phát
            const willResetClaimed = updates.resetClaimedInfo || (updates.status === 'AVAILABLE' && t.status !== 'AVAILABLE');

            const updatedItem: VoucherItem = {
                ...t,
                campaign_name: updates.campaign_name !== undefined ? updates.campaign_name.trim() : t.campaign_name,
                denomination: updates.denomination !== undefined ? Number(updates.denomination) : t.denomination,
                expires_at: updates.expires_at !== undefined ? updates.expires_at : t.expires_at,
                status: updates.status !== undefined ? updates.status : t.status,
                store_name: finalStoreName,
                note: finalNote,
                description: updates.description !== undefined ? (updates.description.trim() || undefined) : t.description,
                claimed_at: willResetClaimed ? undefined : t.claimed_at,
                claimed_by_id: willResetClaimed ? undefined : t.claimed_by_id,
                claimed_by_name: willResetClaimed ? undefined : t.claimed_by_name,
                claimed_by_store: willResetClaimed ? undefined : t.claimed_by_store,
                order_id: willResetClaimed ? undefined : t.order_id,
                used_at: willResetClaimed ? undefined : t.used_at
            };

            all[i] = updatedItem;
            updatedList.push(updatedItem);
        }

        setLocalVouchers(all);

        // Đồng bộ Supabase Cloud theo chunk 150 records
        try {
            const dbPayloads = updatedList.map(item => ({
                ...item,
                claimed_at: item.claimed_at ?? null,
                claimed_by_id: item.claimed_by_id ?? null,
                claimed_by_name: item.claimed_by_name ?? null,
                claimed_by_store: item.claimed_by_store ?? null,
                order_id: item.order_id ?? null,
                used_at: item.used_at ?? null
            }));

            for (let idx = 0; idx < dbPayloads.length; idx += 150) {
                const chunk = dbPayloads.slice(idx, idx + 150);
                await supabase.from('store_vouchers').upsert(chunk, { onConflict: 'id' });
            }
        } catch (e) {
            console.warn('Lỗi sync cloud batch update:', e);
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
 * Làm sạch kho mã: Dọn dẹp các mã hết hạn hoặc đã sử dụng
 * Có thể chọn XÓA VĨNH VIỄN (DELETE) hoặc CHUYỂN SANG EXPIRED
 */
export async function cleanVouchers(params: {
    type: 'EXPIRED' | 'USED' | 'ALL_INACTIVE';
    mode: 'DELETE' | 'MARK_EXPIRED';
    storeName?: string;
    accessibleStores?: string[];
    currentUserDisplayName?: string;
    isAdmin?: boolean;
}): Promise<{ success: boolean; affectedCount: number; totalValue: number; error?: string }> {
    try {
        const { type, mode, storeName, accessibleStores, currentUserDisplayName, isAdmin } = params;
        const all = getLocalVouchers();
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
export function getCampaignSummaries(
    vouchers: VoucherItem[],
    storeName?: string,
    accessibleStores?: string[],
    currentUserDisplayName?: string,
    isAdmin?: boolean
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
            denomMap.set(denom, {
                denomination: denom,
                total: 0,
                available: 0,
                claimed: 0,
                used: 0,
                description: v.description
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
            total_month: totalMonth,
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
