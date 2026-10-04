import { supabase } from './supabase';

export type UserRole = 'ADMIN' | 'QUAN_LY' | 'TRUONG_CA' | 'NHAN_VIEN';
export type UserAccountStatus = 'PENDING_ONBOARDING' | 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED';

export interface UserProfile {
    id: string;
    auth_user_id?: string;
    email: string;
    employee_id: string;
    full_name: string;
    phone?: string;
    store_name: string;
    role: UserRole;
    role_title: string;
    status: UserAccountStatus;
    password?: string;
    rejection_reason?: string;
    created_at: string;
    updated_at: string;
}

export interface UserApprovalRequest {
    id: string;
    user_id: string;
    full_name: string;
    email: string;
    phone?: string;
    employee_id?: string;
    requested_role: UserRole;
    store_name: string;
    is_new_store: boolean;
    new_store_code?: string;
    new_store_address?: string;
    assigned_approver_role: 'ADMIN' | 'QUAN_LY';
    approver_store_name?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    reviewed_by?: string;
    review_note?: string;
    reviewed_at?: string;
    created_at: string;
}

export interface SystemNotification {
    id: string;
    target_role: 'ADMIN' | 'QUAN_LY' | 'ALL' | 'USER';
    target_user_id?: string;
    target_store_name?: string;
    title: string;
    message: string;
    type: 'APPROVAL_REQUEST' | 'APPROVAL_RESULT' | 'SYSTEM_ALERT';
    link_path?: string;
    is_read: boolean;
    created_at: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
    ADMIN: 'Quản trị viên (Admin)',
    QUAN_LY: 'Quản lý Siêu thị (QL)',
    TRUONG_CA: 'Trưởng Ca (TC)',
    NHAN_VIEN: 'Nhân viên kinh doanh (NV)'
};

const LOCAL_STORAGE_PROFILES_KEY = 'saleshub_user_profiles_v1';
const LOCAL_STORAGE_REQUESTS_KEY = 'saleshub_approval_requests_v1';
const LOCAL_STORAGE_NOTIFS_KEY = 'saleshub_notifications_v1';

// SQL Script tạo bảng Supabase cho hệ thống tài khoản & xét duyệt
export const AUTH_SYSTEM_SQL = `-- Bảng 1: Hồ sơ người dùng SalesHub
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id TEXT PRIMARY KEY,
    auth_user_id UUID,
    email TEXT UNIQUE NOT NULL,
    employee_id TEXT,
    full_name TEXT NOT NULL,
    phone TEXT,
    store_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'NHAN_VIEN',
    status TEXT NOT NULL DEFAULT 'PENDING_ONBOARDING',
    password TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng 2: Yêu cầu xét duyệt tài khoản & siêu thị
CREATE TABLE IF NOT EXISTS public.user_approval_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    employee_id TEXT,
    requested_role TEXT NOT NULL DEFAULT 'NHAN_VIEN',
    store_name TEXT NOT NULL,
    is_new_store BOOLEAN NOT NULL DEFAULT false,
    new_store_code TEXT,
    new_store_address TEXT,
    assigned_approver_role TEXT NOT NULL DEFAULT 'ADMIN',
    approver_store_name TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    reviewed_by TEXT,
    review_note TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng 3: Thông báo hệ thống & xét duyệt
CREATE TABLE IF NOT EXISTS public.system_notifications (
    id TEXT PRIMARY KEY,
    target_role TEXT NOT NULL DEFAULT 'ADMIN',
    target_user_id TEXT,
    target_store_name TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'APPROVAL_REQUEST',
    link_path TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Bật RLS và phân quyền truy cập
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all user_profiles" ON public.user_profiles;
CREATE POLICY "Allow all user_profiles" ON public.user_profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all user_approval_requests" ON public.user_approval_requests;
CREATE POLICY "Allow all user_approval_requests" ON public.user_approval_requests FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all system_notifications" ON public.system_notifications;
CREATE POLICY "Allow all system_notifications" ON public.system_notifications FOR ALL USING (true);
`;

// ==========================================
// TÀI KHOẢN MẪU ĐỂ TEST NHANH (DEMO ACCOUNTS)
// ==========================================
export const DEMO_USERS: UserProfile[] = [
    {
        id: 'usr_admin_01',
        email: 'admin@saleshub.vn',
        employee_id: 'ADMIN01',
        full_name: 'Quản Trị Viên Hệ Thống',
        phone: '0901234567',
        store_name: 'Hệ Thống SalesHub',
        role: 'ADMIN',
        role_title: 'Quản trị viên (Admin)',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'usr_ql_01',
        email: 'quanly.vta@saleshub.vn',
        employee_id: 'QL9999',
        full_name: 'Trần Văn Quản Lý',
        phone: '0988776655',
        store_name: 'AAR_BRV_VTA - 290 Trương Công Định',
        role: 'QUAN_LY',
        role_title: 'Quản lý Siêu thị',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'usr_tc_01',
        email: 'truongca.vta@saleshub.vn',
        employee_id: 'TC8888',
        full_name: 'Lê Hoàng Trưởng Ca',
        phone: '0977665544',
        store_name: 'AAR_BRV_VTA - 290 Trương Công Định',
        role: 'TRUONG_CA',
        role_title: 'Trưởng Ca',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'usr_nv_01',
        email: 'nhanvien.loan@saleshub.vn',
        employee_id: '260732',
        full_name: 'Nguyễn Thị Hồng Loan',
        phone: '0966554433',
        store_name: 'AAR_BRV_VTA - 290 Trương Công Định',
        role: 'NHAN_VIEN',
        role_title: 'Nhân viên kinh doanh',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

// Helper lưu/đọc LocalStorage
function getLocalProfiles(): UserProfile[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                // Lọc bỏ triệt để các tài khoản mẫu cũ nếu người dùng từng lưu vào local cache
                const demoIds = new Set(['usr_ql_01', 'usr_tc_01', 'usr_nv_01']);
                const demoEmails = new Set([
                    'quanly.vta@saleshub.vn',
                    'truongca.vta@saleshub.vn',
                    'nhanvien.loan@saleshub.vn'
                ]);
                return parsed.filter(u => !demoIds.has(u.id) && !demoEmails.has(u.email?.toLowerCase()));
            }
        }
    } catch (e) {
        console.warn('Lỗi đọc local profiles:', e);
    }
    return [];
}

function saveLocalProfiles(profiles: UserProfile[]) {
    try {
        localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(profiles));
    } catch (e) {
        console.warn('Lỗi lưu local profiles:', e);
    }
}

function getLocalRequests(): UserApprovalRequest[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_REQUESTS_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('Lỗi đọc local requests:', e);
    }
    return [];
}

function saveLocalRequests(requests: UserApprovalRequest[]) {
    try {
        localStorage.setItem(LOCAL_STORAGE_REQUESTS_KEY, JSON.stringify(requests));
    } catch (e) {
        console.warn('Lỗi lưu local requests:', e);
    }
}

function getLocalNotifications(): SystemNotification[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_NOTIFS_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('Lỗi đọc local notifs:', e);
    }
    return [];
}

function saveLocalNotifications(notifs: SystemNotification[]) {
    try {
        localStorage.setItem(LOCAL_STORAGE_NOTIFS_KEY, JSON.stringify(notifs));
    } catch (e) {
        console.warn('Lỗi lưu local notifs:', e);
    }
}

// ==========================================
// 1. TÌM VÀ ĐỒNG BỘ USER PROFILE
// ==========================================
export async function getUserProfile(userIdOrEmail: string): Promise<UserProfile | null> {
    const key = userIdOrEmail.trim().toLowerCase();

    // 1. Thử lấy từ Supabase
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .or(`id.eq.${userIdOrEmail},email.ilike.${key},employee_id.ilike.${key}`)
            .limit(1);

        if (!error && data && data.length > 0) {
            const item = data[0];
            return {
                id: item.id,
                auth_user_id: item.auth_user_id,
                email: item.email,
                employee_id: item.employee_id || '',
                full_name: item.full_name,
                phone: item.phone || '',
                store_name: item.store_name || '',
                role: item.role as UserRole,
                role_title: ROLE_LABELS[item.role as UserRole] || 'Người dùng',
                status: item.status as UserAccountStatus,
                password: item.password,
                rejection_reason: item.rejection_reason,
                created_at: item.created_at,
                updated_at: item.updated_at
            };
        }
    } catch {
        // Fallback sang local cache
    }

    // 2. Fallback sang local cache
    const locals = getLocalProfiles();
    const found = locals.find(u =>
        u.id === userIdOrEmail ||
        u.email.toLowerCase() === key ||
        u.employee_id.toLowerCase() === key
    );
    return found || null;
}

// ==========================================
// ==========================================
// 2. TẠO HỒ SƠ SAU KHI ĐĂNG KÝ
// ==========================================
export async function createUserProfile(params: {
    email: string;
    full_name: string;
    employee_id?: string;
    phone?: string;
    auth_user_id?: string;
    password?: string;
    role?: UserRole;
    store_name?: string;
    status?: UserAccountStatus;
}): Promise<UserProfile> {
    const role = params.role || 'NHAN_VIEN';
    const newProfile: UserProfile = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        auth_user_id: params.auth_user_id,
        email: params.email.trim().toLowerCase(),
        employee_id: params.employee_id?.trim() || '',
        full_name: params.full_name.trim(),
        phone: params.phone?.trim() || '',
        store_name: params.store_name || '',
        role,
        role_title: ROLE_LABELS[role] || 'Nhân viên kinh doanh',
        status: params.status || 'PENDING_APPROVAL',
        password: params.password || '123456',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    // 1. Lưu local cache
    const profiles = getLocalProfiles();
    const existingIndex = profiles.findIndex(p => p.email === newProfile.email);
    if (existingIndex >= 0) {
        profiles[existingIndex] = { ...profiles[existingIndex], ...newProfile, id: profiles[existingIndex].id };
    } else {
        profiles.push(newProfile);
    }
    saveLocalProfiles(profiles);

    // 2. Cố gắng ghi lên Supabase
    try {
        await supabase
            .from('user_profiles')
            .upsert({
                id: newProfile.id,
                email: newProfile.email,
                auth_user_id: newProfile.auth_user_id,
                employee_id: newProfile.employee_id,
                full_name: newProfile.full_name,
                phone: newProfile.phone,
                store_name: newProfile.store_name,
                role: newProfile.role,
                status: newProfile.status,
                password: newProfile.password,
                updated_at: new Date().toISOString()
            }, { onConflict: 'email' });
    } catch {
        // Safe fallback
    }

    return newProfile;
}

// ==========================================
// 3. GỬI YÊU CẦU XÉT DUYỆT ONBOARDING
// (Chọn Siêu thị + Chọn Role + Gợi ý ST mới)
// ==========================================
export async function submitOnboardingRequest(params: {
    user: UserProfile;
    requested_role: UserRole;
    store_name: string;
    is_new_store: boolean;
    new_store_code?: string;
    new_store_address?: string;
    phone?: string;
    employee_id?: string;
}): Promise<{ success: boolean; request: UserApprovalRequest; error?: string }> {
    try {
        const { user, requested_role, store_name, is_new_store, new_store_code, new_store_address, phone, employee_id } = params;

        // Phân quyền xét duyệt:
        // - QL / TC / Siêu thị mới -> Giao ADMIN phê duyệt
        // - NV vào siêu thị đã có -> Giao Quản lý siêu thị (QL) và Admin cùng nắm
        const assigned_approver_role: 'ADMIN' | 'QUAN_LY' = (requested_role === 'NHAN_VIEN' && !is_new_store)
            ? 'QUAN_LY'
            : 'ADMIN';

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const approvalRequest: UserApprovalRequest = {
            id: requestId,
            user_id: user.id,
            full_name: user.full_name,
            email: user.email,
            phone: phone || user.phone || '',
            employee_id: employee_id || user.employee_id || '',
            requested_role,
            store_name,
            is_new_store,
            new_store_code,
            new_store_address,
            assigned_approver_role,
            approver_store_name: assigned_approver_role === 'QUAN_LY' ? store_name : undefined,
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        // 1. Cập nhật trạng thái người dùng -> PENDING_APPROVAL
        const updatedUser: UserProfile = {
            ...user,
            phone: phone || user.phone,
            employee_id: employee_id || user.employee_id,
            store_name,
            role: requested_role,
            role_title: ROLE_LABELS[requested_role],
            status: 'PENDING_APPROVAL',
            updated_at: new Date().toISOString()
        };

        // Lưu local user profile
        const profiles = getLocalProfiles();
        const uIdx = profiles.findIndex(p => p.id === user.id || p.email === user.email);
        if (uIdx >= 0) profiles[uIdx] = updatedUser;
        else profiles.push(updatedUser);
        saveLocalProfiles(profiles);

        // Lưu local request
        const requests = getLocalRequests();
        const existingReqIdx = requests.findIndex(r => r.user_id === user.id || r.email === user.email);
        if (existingReqIdx >= 0) {
            requests[existingReqIdx] = approvalRequest;
        } else {
            requests.unshift(approvalRequest);
        }
        saveLocalRequests(requests);

        // 2. Tạo thông báo notify
        // Luôn luôn tạo 1 thông báo cho ADMIN để Admin nắm toàn quyền xét duyệt hệ thống
        const notifications: SystemNotification[] = [];

        const adminNotifId = `notif_adm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const adminTitle = is_new_store
            ? `Yêu cầu mở Siêu thị mới: ${store_name} (${ROLE_LABELS[requested_role]})`
            : `Yêu cầu tài khoản mới: ${user.full_name} (${ROLE_LABELS[requested_role]} - ${store_name})`;
        const adminMsg = `${user.full_name} (${user.email}) vừa đăng ký vai trò [${ROLE_LABELS[requested_role]}] tại ${store_name}.${is_new_store ? ' Kèm đề xuất thêm mới siêu thị này.' : ''}`;

        notifications.push({
            id: adminNotifId,
            target_role: 'ADMIN',
            title: adminTitle,
            message: adminMsg,
            type: 'APPROVAL_REQUEST',
            link_path: '/quan-tri-he-thong',
            is_read: false,
            created_at: new Date().toISOString()
        });

        // Nếu là NV đăng ký vào siêu thị cụ thể, gửi thêm 1 thông báo cho Quản lý siêu thị
        if (assigned_approver_role === 'QUAN_LY') {
            const qlNotifId = `notif_ql_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            notifications.push({
                id: qlNotifId,
                target_role: 'QUAN_LY',
                target_store_name: store_name,
                title: `Nhân viên mới đăng ký vào Siêu thị: ${user.full_name}`,
                message: `Nhân sự ${user.full_name} (${user.email}) đã đăng ký tài khoản Nhân viên kinh doanh tại siêu thị ${store_name}. Vui lòng xác nhận xét duyệt.`,
                type: 'APPROVAL_REQUEST',
                link_path: '/cau-hinh-sieu-thi-nhan-vien',
                is_read: false,
                created_at: new Date().toISOString()
            });
        }

        const notifs = getLocalNotifications();
        for (const n of notifications) {
            notifs.unshift(n);
        }
        saveLocalNotifications(notifs);

        // 3. Ghi lên Supabase Cloud (Đảm bảo có ID để không bị lỗi Not-Null Constraint)
        try {
            const reqRes = await supabase.from('user_approval_requests').upsert({
                id: approvalRequest.id,
                user_id: user.id,
                full_name: approvalRequest.full_name,
                email: approvalRequest.email,
                phone: approvalRequest.phone || '',
                employee_id: approvalRequest.employee_id || '',
                requested_role: approvalRequest.requested_role,
                store_name: approvalRequest.store_name,
                is_new_store: approvalRequest.is_new_store,
                new_store_code: approvalRequest.new_store_code || '',
                new_store_address: approvalRequest.new_store_address || '',
                assigned_approver_role: approvalRequest.assigned_approver_role,
                approver_store_name: approvalRequest.approver_store_name || '',
                status: 'PENDING',
                created_at: approvalRequest.created_at
            }, { onConflict: 'id' });

            if (reqRes.error) {
                console.warn('Cảnh báo ghi user_approval_requests Supabase:', reqRes.error.message);
            }

            for (const notif of notifications) {
                const notifRes = await supabase.from('system_notifications').insert({
                    id: notif.id,
                    target_role: notif.target_role,
                    target_store_name: notif.target_store_name || null,
                    title: notif.title,
                    message: notif.message,
                    type: notif.type,
                    link_path: notif.link_path,
                    is_read: false,
                    created_at: notif.created_at
                });
                if (notifRes.error) {
                    console.warn('Cảnh báo ghi system_notifications Supabase:', notifRes.error.message);
                }
            }

            await supabase.from('user_profiles').update({
                phone: updatedUser.phone,
                employee_id: updatedUser.employee_id,
                store_name: updatedUser.store_name,
                role: updatedUser.role,
                status: 'PENDING_APPROVAL',
                updated_at: new Date().toISOString()
            }).or(`id.eq.${user.id},email.eq.${user.email}`);
        } catch (e) {
            console.warn('Lỗi ghi Supabase onboarding:', e);
        }

        return { success: true, request: approvalRequest };
    } catch (err: any) {
        console.error('Lỗi submitOnboardingRequest:', err);
        return { success: false, request: null as any, error: err.message || String(err) };
    }
}

// ==========================================
// 4. LẤY DANH SÁCH YÊU CẦU XÉT DUYỆT
// ==========================================
export async function fetchApprovalRequests(filter?: {
    approverRole?: 'ADMIN' | 'QUAN_LY';
    storeName?: string;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}): Promise<UserApprovalRequest[]> {
    let cloudRequests: UserApprovalRequest[] = [];
    try {
        let query = supabase.from('user_approval_requests').select('*').order('created_at', { ascending: false });

        if (filter?.status) {
            query = query.eq('status', filter.status);
        }
        // NẾU LÀ QUẢN LÝ (QUAN_LY): Chỉ lọc các yêu cầu giao cho Quản lý của siêu thị đó
        if (filter?.approverRole === 'QUAN_LY') {
            query = query.eq('assigned_approver_role', 'QUAN_LY');
            if (filter.storeName) {
                query = query.eq('approver_store_name', filter.storeName);
            }
        }
        // NẾU LÀ ADMIN: Admin có quyền tối cao xem và phê duyệt TẤT CẢ các yêu cầu!

        const { data, error } = await query;
        if (!error && data) {
            cloudRequests = data as UserApprovalRequest[];
        }
    } catch (e) {
        console.warn('Lỗi fetchApprovalRequests Supabase:', e);
    }

    // Fallback & Merge cùng LocalStorage
    let localRequests = getLocalRequests();
    if (filter?.status) {
        localRequests = localRequests.filter(r => r.status === filter.status);
    }
    if (filter?.approverRole === 'QUAN_LY') {
        localRequests = localRequests.filter(r => r.assigned_approver_role === 'QUAN_LY' && (!filter.storeName || r.approver_store_name === filter.storeName));
    }

    const cloudIds = new Set(cloudRequests.map(r => r.id));
    const merged = [...cloudRequests, ...localRequests.filter(l => !cloudIds.has(l.id))];
    saveLocalRequests(merged);
    return merged;
}

// ==========================================
// 5. PHÊ DUYỆT HOẶC TỪ CHỐI YÊU CẦU
// (Kế thừa dữ liệu siêu thị nếu đổi QL, thêm ST mới, thêm NV)
// ==========================================
export async function processApprovalRequest(params: {
    requestId: string;
    decision: 'APPROVED' | 'REJECTED';
    reviewerName: string;
    reviewNote?: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { requestId, decision, reviewerName, reviewNote } = params;

        // 1. Tìm request trong local và Supabase
        const requests = getLocalRequests();
        const reqIdx = requests.findIndex(r => r.id === requestId);
        let req = reqIdx >= 0 ? requests[reqIdx] : null;

        if (!req) {
            const { data } = await supabase.from('user_approval_requests').select('*').eq('id', requestId).single();
            if (data) req = data as UserApprovalRequest;
        }

        if (!req) throw new Error('Không tìm thấy yêu cầu xét duyệt #' + requestId);

        // Cập nhật request
        req.status = decision;
        req.reviewed_by = reviewerName;
        req.review_note = reviewNote || '';
        req.reviewed_at = new Date().toISOString();

        if (reqIdx >= 0) {
            requests[reqIdx] = req;
            saveLocalRequests(requests);
        }

        // 2. Cập nhật hồ sơ User Profile
        const profiles = getLocalProfiles();
        const userIdx = profiles.findIndex(p => p.id === req!.user_id || p.email === req!.email);
        if (userIdx >= 0) {
            profiles[userIdx].status = decision === 'APPROVED' ? 'ACTIVE' : 'REJECTED';
            profiles[userIdx].role = req.requested_role;
            profiles[userIdx].role_title = ROLE_LABELS[req.requested_role];
            profiles[userIdx].store_name = req.store_name;
            if (req.phone) profiles[userIdx].phone = req.phone;
            if (req.employee_id) profiles[userIdx].employee_id = req.employee_id;
            if (decision === 'REJECTED') profiles[userIdx].rejection_reason = reviewNote || 'Không được phê duyệt';
            profiles[userIdx].updated_at = new Date().toISOString();
            saveLocalProfiles(profiles);
        }

        // 3. NẾU DUYỆT VÀ LÀ SIÊU THỊ MỚI: Tự động tạo Siêu thị trong bảng stores
        if (decision === 'APPROVED' && req.is_new_store) {
            try {
                await supabase.from('stores').upsert({
                    code: req.new_store_code || `ST_${Date.now().toString().slice(-4)}`,
                    name: req.store_name,
                    address: req.new_store_address || '',
                    is_active: true,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'code' });
            } catch (e) {
                console.warn('Lỗi tự động thêm store mới:', e);
            }
        }

        // 4. NẾU DUYỆT VÀ LÀ NHÂN VIÊN: Tự động thêm nhân viên vào danh sách employees của siêu thị
        if (decision === 'APPROVED' && req.requested_role === 'NHAN_VIEN') {
            try {
                await supabase.from('employees').upsert({
                    employee_id: req.employee_id || `NV_${Date.now().toString().slice(-4)}`,
                    full_name: req.full_name,
                    store_name: req.store_name,
                    role: 'Tư vấn bán hàng',
                    is_active: true,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'employee_id' });
            } catch (e) {
                console.warn('Lỗi tự động cập nhật bảng employees:', e);
            }
        }

        // 5. Gửi thông báo kết quả cho người dùng
        const resultNotif: SystemNotification = {
            id: `notif_res_${Date.now()}`,
            target_role: 'USER',
            target_user_id: req.user_id,
            title: decision === 'APPROVED' ? '🎉 Yêu cầu đã được phê duyệt!' : '⚠️ Yêu cầu chưa được duyệt',
            message: decision === 'APPROVED'
                ? `Chào mừng bạn! Yêu cầu vai trò [${ROLE_LABELS[req.requested_role]}] tại [${req.store_name}] đã được ${reviewerName} phê duyệt.`
                : `Rất tiếc, yêu cầu vai trò [${ROLE_LABELS[req.requested_role]}] tại [${req.store_name}] không được phê duyệt. Lý do: ${reviewNote || 'Chưa đạt yêu cầu'}.`,
            type: 'APPROVAL_RESULT',
            link_path: decision === 'APPROVED' ? '/bc-thang/tong-quan' : '/onboarding',
            is_read: false,
            created_at: new Date().toISOString()
        };

        const notifs = getLocalNotifications();
        notifs.unshift(resultNotif);
        saveLocalNotifications(notifs);

        // 6. Đồng bộ Supabase (Đảm bảo có ID để không lỗi Not-Null)
        try {
            await supabase.from('user_approval_requests').update({
                status: decision,
                reviewed_by: reviewerName,
                review_note: reviewNote || '',
                reviewed_at: new Date().toISOString()
            }).eq('id', requestId);

            await supabase.from('user_profiles').update({
                status: decision === 'APPROVED' ? 'ACTIVE' : 'REJECTED',
                role: req.requested_role,
                store_name: req.store_name,
                rejection_reason: decision === 'REJECTED' ? (reviewNote || 'Không được phê duyệt') : null,
                updated_at: new Date().toISOString()
            }).or(`id.eq.${req.user_id},email.eq.${req.email}`);

            await supabase.from('system_notifications').insert({
                id: resultNotif.id,
                target_role: 'USER',
                target_user_id: req.user_id,
                title: resultNotif.title,
                message: resultNotif.message,
                type: resultNotif.type,
                link_path: resultNotif.link_path,
                is_read: false,
                created_at: resultNotif.created_at
            });
        } catch {
            // Safe fallback
        }

        return { success: true };
    } catch (err: any) {
        console.error('Lỗi processApprovalRequest:', err);
        return { success: false, error: err.message || String(err) };
    }
}

// ==========================================
// 6. LẤY VÀ ĐÁNH DẤU ĐÃ ĐỌC THÔNG BÁO
// ==========================================
export async function fetchSystemNotifications(params: {
    role: UserRole;
    storeName?: string;
    userId?: string;
}): Promise<SystemNotification[]> {
    let cloudNotifs: SystemNotification[] = [];
    try {
        let query = supabase.from('system_notifications').select('*').order('created_at', { ascending: false }).limit(40);

        if (params.role === 'ADMIN') {
            query = query.or('target_role.eq.ADMIN,target_role.eq.ALL');
        } else if (params.role === 'QUAN_LY') {
            query = query.or(`and(target_role.eq.QUAN_LY,target_store_name.eq.${params.storeName}),target_role.eq.ALL,target_user_id.eq.${params.userId}`);
        } else {
            query = query.or(`target_role.eq.ALL,target_user_id.eq.${params.userId}`);
        }

        const { data, error } = await query;
        if (!error && data) cloudNotifs = data as SystemNotification[];
    } catch {
        // Fallback
    }

    const localNotifs = getLocalNotifications().filter(n => {
        if (params.role === 'ADMIN') {
            return n.target_role === 'ADMIN' || n.target_role === 'ALL';
        }
        if (params.role === 'QUAN_LY') {
            return (n.target_role === 'QUAN_LY' && (!n.target_store_name || n.target_store_name === params.storeName)) ||
                   n.target_role === 'ALL' ||
                   n.target_user_id === params.userId;
        }
        return n.target_role === 'ALL' || n.target_user_id === params.userId;
    });

    const cloudIds = new Set(cloudNotifs.map(n => n.id));
    const merged = [...cloudNotifs, ...localNotifs.filter(l => !cloudIds.has(l.id))];
    saveLocalNotifications(merged);
    return merged;
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
    const notifs = getLocalNotifications();
    const item = notifs.find(n => n.id === notificationId);
    if (item) {
        item.is_read = true;
        saveLocalNotifications(notifs);
    }

    try {
        await supabase.from('system_notifications').update({ is_read: true }).eq('id', notificationId);
    } catch {
        // Safe fallback
    }
}

/**
 * Admin duyệt nhanh tài khoản người dùng từ trang Quản lý tài khoản
 */
export async function adminQuickApproveUser(
    user: UserProfile,
    reviewerName: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Cập nhật user profile -> ACTIVE
        const profiles = getLocalProfiles();
        const uIdx = profiles.findIndex(p => p.id === user.id || p.email.toLowerCase() === user.email.toLowerCase());
        if (uIdx !== -1) {
            profiles[uIdx].status = 'ACTIVE';
            profiles[uIdx].rejection_reason = undefined;
            profiles[uIdx].updated_at = new Date().toISOString();
            saveLocalProfiles(profiles);
        }

        // 2. Cập nhật request nếu có
        const requests = getLocalRequests();
        const rIdx = requests.findIndex(r => r.user_id === user.id || r.email.toLowerCase() === user.email.toLowerCase());
        if (rIdx !== -1) {
            requests[rIdx].status = 'APPROVED';
            requests[rIdx].reviewed_by = reviewerName;
            requests[rIdx].reviewed_at = new Date().toISOString();
            requests[rIdx].review_note = 'Đã phê duyệt trực tiếp từ Quản trị tài khoản';
            saveLocalRequests(requests);
        }

        // 3. Tạo thông báo kết quả cho user
        const resultNotif: SystemNotification = {
            id: `notif_res_${Date.now()}`,
            target_role: 'USER',
            target_user_id: user.id,
            title: '🎉 Tài khoản đã được phê duyệt!',
            message: `Tài khoản ${user.email} của bạn đã được ${reviewerName} phê duyệt vào hệ thống SalesHub.`,
            type: 'APPROVAL_RESULT',
            link_path: '/bc-thang/tong-quan',
            is_read: false,
            created_at: new Date().toISOString()
        };
        const notifs = getLocalNotifications();
        notifs.unshift(resultNotif);
        saveLocalNotifications(notifs);

        // 4. Đồng bộ Supabase
        try {
            await supabase.from('user_profiles').update({
                status: 'ACTIVE',
                rejection_reason: null,
                updated_at: new Date().toISOString()
            }).or(`id.eq.${user.id},email.eq.${user.email}`);

            if (rIdx !== -1) {
                await supabase.from('user_approval_requests').update({
                    status: 'APPROVED',
                    reviewed_by: reviewerName,
                    reviewed_at: new Date().toISOString(),
                    review_note: 'Đã phê duyệt trực tiếp từ Quản trị tài khoản'
                }).or(`user_id.eq.${user.id},email.eq.${user.email}`);
            }

            await supabase.from('system_notifications').insert({
                id: resultNotif.id,
                target_role: 'USER',
                target_user_id: user.id,
                title: resultNotif.title,
                message: resultNotif.message,
                type: resultNotif.type,
                link_path: resultNotif.link_path,
                is_read: false,
                created_at: resultNotif.created_at
            });
        } catch {
            // Safe fallback
        }

        return { success: true };
    } catch (err: any) {
        console.error('Lỗi adminQuickApproveUser:', err);
        return { success: false, error: err.message || String(err) };
    }
}

// ==========================================
// 7. QUẢN TRỊ TÀI KHOẢN DÀNH CHO ADMIN
// (Danh sách, Reset mật khẩu, Sửa, Khóa, Xóa, Tạo mới)
// ==========================================

/**
 * Kiểm tra xem bảng user_profiles đã được tạo trên Supabase hay chưa
 */
export async function checkSupabaseUserProfilesTable(): Promise<{ exists: boolean; count: number; error?: string }> {
    try {
        const { count, error } = await supabase
            .from('user_profiles')
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
 * Kiểm tra danh sách các tài khoản đang lưu cục bộ nhưng chưa có trên Supabase Cloud
 */
export async function getUnsyncedUserProfiles(): Promise<{
    unsynced: UserProfile[];
    cloudCount: number;
    error?: string;
}> {
    try {
        const locals = getLocalProfiles();
        const { data, error } = await supabase.from('user_profiles').select('email');
        if (error) {
            return { unsynced: locals, cloudCount: 0, error: error.message };
        }
        const cloudEmails = new Set((data || []).map((r: any) => r.email?.toLowerCase()));
        const unsynced = locals.filter(l => !cloudEmails.has(l.email.toLowerCase()));
        return { unsynced, cloudCount: data?.length || 0 };
    } catch (err: any) {
        return { unsynced: [], cloudCount: 0, error: err.message || String(err) };
    }
}

/**
 * Đồng bộ toàn bộ tài khoản cục bộ lên Supabase Cloud
 */
export async function syncLocalProfilesToCloud(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        const locals = getLocalProfiles();
        if (locals.length === 0) return { success: true, count: 0 };

        const payloads = locals.map(p => ({
            id: p.id,
            auth_user_id: p.auth_user_id || null,
            email: p.email.toLowerCase(),
            employee_id: p.employee_id || '',
            full_name: p.full_name,
            phone: p.phone || '',
            store_name: p.store_name || '',
            role: p.role,
            status: p.status,
            password: p.password || '123456',
            rejection_reason: p.rejection_reason || null,
            created_at: p.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('user_profiles')
            .upsert(payloads, { onConflict: 'email' });

        if (error) throw error;
        return { success: true, count: payloads.length };
    } catch (err: any) {
        console.error('Lỗi syncLocalProfilesToCloud:', err);
        return { success: false, count: 0, error: err.message || String(err) };
    }
}

/**
 * Lấy toàn bộ danh sách tài khoản người dùng
 */
export async function fetchAllUserProfiles(): Promise<UserProfile[]> {
    // 1. Thử lấy từ Supabase
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
            const mapped: UserProfile[] = data.map((item: any) => ({
                id: item.id,
                auth_user_id: item.auth_user_id,
                email: item.email,
                employee_id: item.employee_id || '',
                full_name: item.full_name,
                phone: item.phone || '',
                store_name: item.store_name || '',
                role: item.role as UserRole,
                role_title: ROLE_LABELS[item.role as UserRole] || 'Người dùng',
                status: item.status as UserAccountStatus,
                password: item.password,
                rejection_reason: item.rejection_reason,
                created_at: item.created_at || new Date().toISOString(),
                updated_at: item.updated_at || new Date().toISOString()
            }));

            // Hợp nhất với local cache (tránh ghi đè làm mất tài khoản tạo lúc offline)
            const locals = getLocalProfiles();
            const existingEmails = new Set(mapped.map(m => m.email.toLowerCase()));
            const notInCloud = locals.filter(l => !existingEmails.has(l.email.toLowerCase()));
            const merged = [...mapped, ...notInCloud];

            saveLocalProfiles(merged);
            return merged;
        }
    } catch {
        // Fallback local
    }

    // 2. Lấy từ Local Storage
    return getLocalProfiles();
}

/**
 * Gửi email đặt lại mật khẩu tự động qua Supabase Auth
 * (Chứa liên kết an toàn chuyển về /dat-lai-mat-khau)
 */
export async function sendPasswordResetEmail(
    email: string,
    redirectTo?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const cleanEmail = email.trim().toLowerCase();
        const targetUrl = redirectTo || (typeof window !== 'undefined' ? `${window.location.origin}/dat-lai-mat-khau` : 'http://localhost:5173/dat-lai-mat-khau');

        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: targetUrl
        });

        if (error) {
            console.warn('Cảnh báo resetPasswordForEmail Supabase:', error.message);
            return { success: false, error: error.message };
        }

        // Tạo thông báo kiểm toán trong hệ thống
        const notif: SystemNotification = {
            id: `notif_email_reset_${Date.now()}`,
            target_role: 'USER',
            title: '📩 Email khôi phục mật khẩu đã được gửi',
            message: `Một liên kết đặt lại mật khẩu đã được gửi tự động tới hòm thư ${cleanEmail}. Vui lòng kiểm tra hộp thư đến (hoặc thư mục Spam).`,
            type: 'SYSTEM_ALERT',
            link_path: '/dang-nhap',
            is_read: false,
            created_at: new Date().toISOString()
        };
        const notifs = getLocalNotifications();
        notifs.unshift(notif);
        saveLocalNotifications(notifs);

        try {
            await supabase.from('system_notifications').insert({
                id: notif.id,
                target_role: notif.target_role,
                title: notif.title,
                message: notif.message,
                type: notif.type,
                link_path: notif.link_path,
                is_read: false,
                created_at: notif.created_at
            });
        } catch {
            // Safe fallback
        }

        return { success: true };
    } catch (err: any) {
        console.error('Lỗi sendPasswordResetEmail:', err);
        return { success: false, error: err.message || String(err) };
    }
}

/**
 * Cập nhật mật khẩu mới khi người dùng nhấp vào link trong email
 */
export async function updatePasswordWithSession(newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword.trim()
        });
        if (error) throw error;

        // Cập nhật lại trong user_profiles nếu user có email
        if (data?.user?.email) {
            const profiles = getLocalProfiles();
            const idx = profiles.findIndex(p => p.email.toLowerCase() === data.user!.email!.toLowerCase());
            if (idx !== -1) {
                profiles[idx].password = newPassword.trim();
                saveLocalProfiles(profiles);
            }
            try {
                await supabase.from('user_profiles').update({
                    password: newPassword.trim(),
                    updated_at: new Date().toISOString()
                }).eq('email', data.user.email);
            } catch {
                // Safe fallback
            }
        }

        return { success: true };
    } catch (err: any) {
        console.error('Lỗi updatePasswordWithSession:', err);
        return { success: false, error: err.message || String(err) };
    }
}

/**
 * Reset mật khẩu cho người dùng (Admin cấp mật khẩu mới)
 */
export async function adminResetPassword(
    userIdOrEmail: string,
    newPassword: string
): Promise<{ success: boolean; newPassword: string; error?: string }> {
    try {
        const key = userIdOrEmail.trim().toLowerCase();
        const profiles = getLocalProfiles();
        const idx = profiles.findIndex(p => p.id === userIdOrEmail || p.email.toLowerCase() === key);

        if (idx === -1) {
            throw new Error(`Không tìm thấy tài khoản với định danh: ${userIdOrEmail}`);
        }

        const user = profiles[idx];
        user.password = newPassword.trim();
        user.updated_at = new Date().toISOString();
        profiles[idx] = user;
        saveLocalProfiles(profiles);

        // Tạo thông báo gửi cho người dùng
        const notif: SystemNotification = {
            id: `notif_pwd_${Date.now()}`,
            target_role: 'USER',
            target_user_id: user.id,
            title: '🔑 Mật khẩu đã được Quản trị viên cập nhật',
            message: `Quản trị viên đã đặt lại mật khẩu cho tài khoản ${user.email}. Vui lòng đăng nhập với mật khẩu mới.`,
            type: 'SYSTEM_ALERT',
            link_path: '/dang-nhap',
            is_read: false,
            created_at: new Date().toISOString()
        };
        const notifs = getLocalNotifications();
        notifs.unshift(notif);
        saveLocalNotifications(notifs);

        // Đồng bộ lên Supabase nếu có bảng
        try {
            await supabase
                .from('user_profiles')
                .update({
                    password: newPassword.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('email', user.email.toLowerCase());

            await supabase.from('system_notifications').insert({
                id: notif.id,
                target_role: 'USER',
                target_user_id: user.id,
                title: notif.title,
                message: notif.message,
                type: notif.type,
                link_path: notif.link_path,
                is_read: false,
                created_at: notif.created_at
            });
        } catch {
            // Safe fallback
        }

        return { success: true, newPassword: newPassword.trim() };
    } catch (err: any) {
        console.error('Lỗi adminResetPassword:', err);
        return { success: false, newPassword: '', error: err.message || String(err) };
    }
}

/**
 * Admin chỉnh sửa thông tin tài khoản (Họ tên, Vai trò, Siêu thị, SĐT, Trạng thái...)
 */
export async function adminUpdateUserProfile(
    userId: string,
    updates: Partial<UserProfile>
): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
    try {
        const profiles = getLocalProfiles();
        const idx = profiles.findIndex(p => p.id === userId);

        if (idx === -1) {
            throw new Error(`Không tìm thấy tài khoản ID: ${userId}`);
        }

        const current = profiles[idx];
        const newRole = updates.role || current.role;
        const updated: UserProfile = {
            ...current,
            ...updates,
            role: newRole,
            role_title: ROLE_LABELS[newRole] || current.role_title,
            updated_at: new Date().toISOString()
        };

        profiles[idx] = updated;
        saveLocalProfiles(profiles);

        // Đồng bộ Supabase
        try {
            await supabase
                .from('user_profiles')
                .update({
                    full_name: updated.full_name,
                    phone: updated.phone,
                    employee_id: updated.employee_id,
                    store_name: updated.store_name,
                    role: updated.role,
                    status: updated.status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);
        } catch {
            // Safe fallback
        }

        return { success: true, data: updated };
    } catch (err: any) {
        console.error('Lỗi adminUpdateUserProfile:', err);
        return { success: false, error: err.message || String(err) };
    }
}

/**
 * Admin xóa tài khoản
 */
export async function adminDeleteUserProfile(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const profiles = getLocalProfiles();
        const filtered = profiles.filter(p => p.id !== userId);
        saveLocalProfiles(filtered);

        try {
            await supabase.from('user_profiles').delete().eq('id', userId);
        } catch {
            // Safe fallback
        }

        return { success: true };
    } catch (err: any) {
        console.error('Lỗi adminDeleteUserProfile:', err);
        return { success: false, error: err.message || String(err) };
    }
}

/**
 * Admin tạo mới tài khoản trực tiếp (Kích hoạt ngay, không cần Onboarding chờ duyệt)
 */
export async function adminCreateUserProfile(data: {
    full_name: string;
    email: string;
    password?: string;
    role: UserRole;
    store_name: string;
    phone?: string;
    employee_id?: string;
}): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
    try {
        const email = data.email.trim().toLowerCase();
        const profiles = getLocalProfiles();
        if (profiles.some(p => p.email.toLowerCase() === email)) {
            throw new Error(`Email "${email}" đã tồn tại trên hệ thống.`);
        }

        const newProfile: UserProfile = {
            id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            email,
            employee_id: data.employee_id?.trim() || '',
            full_name: data.full_name.trim(),
            phone: data.phone?.trim() || '',
            store_name: data.store_name.trim(),
            role: data.role,
            role_title: ROLE_LABELS[data.role],
            status: 'ACTIVE',
            password: data.password || '123456',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        profiles.unshift(newProfile);
        saveLocalProfiles(profiles);

        // Lưu vào Supabase
        try {
            await supabase.from('user_profiles').insert({
                id: newProfile.id,
                email: newProfile.email,
                employee_id: newProfile.employee_id,
                full_name: newProfile.full_name,
                phone: newProfile.phone,
                store_name: newProfile.store_name,
                role: newProfile.role,
                status: 'ACTIVE',
                password: newProfile.password,
                updated_at: new Date().toISOString()
            });
        } catch {
            // Safe fallback
        }

        return { success: true, data: newProfile };
    } catch (err: any) {
        console.error('Lỗi adminCreateUserProfile:', err);
        return { success: false, error: err.message || String(err) };
    }
}

