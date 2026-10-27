import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import {
    fetchGuestAccounts,
    fetchAccountExpirationConfig,
    saveAccountExpirationConfig,
    checkSupabaseGuestConfigsTable,
    generateDefaultGuestAccounts,
    createGuestAccount,
    updateGuestPassword,
    deleteGuestAccount,
    extendGuestDays,
    GUEST_SYSTEM_SQL,
    type AccountExpirationConfig
} from './services/guestTrialService';
import { fetchStores, type StoreItem } from '../../core/lib/storage';
import { adminUpdateUserProfile, type UserProfile } from '../../core/lib/authService';
import { GUEST_DEMO_STORE } from '../../core/lib/guestDemoStoreService';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import GuestKpiCards from './components/guest/GuestKpiCards';
import GuestExpirationConfigCard from './components/guest/GuestExpirationConfigCard';
import GuestAccountTable from './components/guest/GuestAccountTable';
import GuestCreateModal from './components/guest/GuestCreateModal';
import GuestPasswordModal from './components/guest/GuestPasswordModal';
import GuestShareModal from './components/guest/GuestShareModal';
import { Sparkles, Plus, RefreshCw, UserCheck, ShieldAlert } from 'lucide-react';

export default function GuestAccountsPage() {
    const { isAdmin } = useAuth();
    const [guests, setGuests] = useState<UserProfile[]>([]);
    const [config, setConfig] = useState<AccountExpirationConfig>({
        id: 'default_config',
        default_guest_valid_days: 7,
        apply_to_all_accounts: false,
        all_accounts_valid_days: 365,
        is_enabled: true,
        updated_at: new Date().toISOString()
    });
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    // Cloud Status
    const [tableReady, setTableReady] = useState(true);
    const [storageType, setStorageType] = useState<'cloud' | 'local'>('cloud');
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [passwordUser, setPasswordUser] = useState<UserProfile | null>(null);
    const [shareUser, setShareUser] = useState<UserProfile | null>(null);
    const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const showToast = (type: 'success' | 'error', text: string) => {
        setToastMsg({ type, text });
        setTimeout(() => setToastMsg(null), 3000);
    };

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [guestList, cfgRes, storesRes, tblStatus] = await Promise.all([
                fetchGuestAccounts(),
                fetchAccountExpirationConfig(),
                fetchStores(),
                checkSupabaseGuestConfigsTable()
            ]);

            setGuests(guestList);
            setConfig(cfgRes.config);
            const storeItems = storesRes.success && Array.isArray(storesRes.data) ? storesRes.data : [];
            setStores(storeItems);
            setTableReady(tblStatus.exists);
            setStorageType(cfgRes.isCloud ? 'cloud' : 'local');
            setLastSyncTime(new Date());
        } catch (err: any) {
            console.error('Lỗi khi tải dữ liệu tài khoản trải nghiệm:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSaveConfig = async (newCfg: Partial<AccountExpirationConfig>): Promise<boolean> => {
        setIsSavingConfig(true);
        const res = await saveAccountExpirationConfig(newCfg);
        setIsSavingConfig(false);
        if (res.success && res.data) {
            setConfig(res.data);
            return true;
        }
        return false;
    };

    const handleGenerateDefaults = async () => {
        setIsLoading(true);
        const targetStore = GUEST_DEMO_STORE;
        const res = await generateDefaultGuestAccounts(3, config.default_guest_valid_days, targetStore);
        setIsLoading(false);
        if (res.createdCount > 0) {
            showToast('success', `Đã khởi tạo thành công ${res.createdCount} tài khoản trải nghiệm mẫu!`);
            await loadData();
        } else if (res.errors.length > 0) {
            showToast('error', res.errors.join(', '));
        } else {
            showToast('success', '3 tài khoản trải nghiệm mẫu đã tồn tại trên hệ thống!');
        }
    };

    const handleCreateAccount = async (data: {
        email: string;
        full_name: string;
        password?: string;
        valid_days: number;
        store_name?: string;
    }) => {
        const res = await createGuestAccount(data);
        if (res.success) {
            showToast('success', `Đã lưu tài khoản trải nghiệm "${data.email}" thành công!`);
            await loadData();
        }
        return res;
    };

    const handleToggleLock = async (user: UserProfile) => {
        const nextStatus = user.status === 'ACTIVE' ? 'REJECTED' : 'ACTIVE';
        const res = await adminUpdateUserProfile(user.id, {
            status: nextStatus,
            rejection_reason: nextStatus === 'REJECTED' ? 'Admin tạm khóa tài khoản trải nghiệm' : undefined
        });
        if (res.success) {
            showToast('success', `${nextStatus === 'ACTIVE' ? 'Đã mở khóa' : 'Đã tạm khóa'} tài khoản ${user.email}!`);
            await loadData();
        }
    };

    const handleExtendDays = async (user: UserProfile, days: number) => {
        const res = await extendGuestDays(user, days);
        if (res.success) {
            showToast('success', `Đã gia hạn thêm +${days} ngày cho ${user.email}!`);
            await loadData();
        }
    };

    const handleDelete = async (user: UserProfile) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản trải nghiệm "${user.email}"?`)) {
            return;
        }
        const res = await deleteGuestAccount(user.id);
        if (res.success) {
            showToast('success', `Đã xóa tài khoản ${user.email}!`);
            await loadData();
        }
    };

    if (!isAdmin) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
                <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">Quyền Truy Cập Bị Giới Hạn</h3>
                <p className="text-xs text-slate-500">Phân hệ này chỉ khả dụng đối với tài khoản Quản trị viên (Admin).</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-7xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
                            <UserCheck className="w-5 h-5" />
                        </span>
                        <div>
                            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                TÀI KHOẢN TRẢI NGHIỆM (GUEST) &amp; CẤU HÌNH HẠN DÙNG
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Quản lý 1-3 tài khoản trải nghiệm quảng cáo cho khách &amp; cài đặt thời gian hoạt động theo ngày
                            </p>
                        </div>
                    </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={handleGenerateDefaults}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                        title="Tạo nhanh 3 tài khoản trải nghiệm chuẩn mẫu"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Khởi Tạo 3 Tài Khoản Mẫu</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tạo Mới</span>
                    </button>

                    <button
                        type="button"
                        onClick={loadData}
                        disabled={isLoading}
                        className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 transition shadow-2xs cursor-pointer"
                        title="Tải lại dữ liệu"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Cloud Sync Status Banner (Tuân thủ Quy chuẩn 8 & 12) */}
            <CloudDataSyncStatusBanner
                tableName="account_expiration_configs"
                tableReady={tableReady}
                storageType={storageType}
                syncStatus="synced"
                lastSyncTime={lastSyncTime}
                sqlDdl={GUEST_SYSTEM_SQL}
                onSyncNow={loadData}
            />

            {/* Toast Feedback */}
            {toastMsg && (
                <div
                    className={`p-3 rounded-2xl text-xs font-bold transition flex items-center justify-between ${
                        toastMsg.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                >
                    <span>{toastMsg.text}</span>
                    <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                </div>
            )}

            {/* Thẻ chỉ số KPI */}
            <GuestKpiCards guests={guests} config={config} />

            {/* Khối Cài đặt Giới hạn Thời gian Hoạt động theo NGÀY */}
            <GuestExpirationConfigCard
                config={config}
                onSave={handleSaveConfig}
                isSaving={isSavingConfig}
            />

            {/* Danh sách Bảng Tài khoản Trải nghiệm */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-blue-600" />
                        <span>Danh Sách Tài Khoản Trải Nghiệm Khách Hàng ({guests.length}/3)</span>
                    </h3>
                    <span className="text-[11px] text-slate-500">
                        Admin có toàn quyền đổi mật khẩu &amp; sao chép tin nhắn gửi khách
                    </span>
                </div>

                <GuestAccountTable
                    guests={guests}
                    onOpenChangePassword={user => setPasswordUser(user)}
                    onOpenShareMessage={user => setShareUser(user)}
                    onToggleLock={handleToggleLock}
                    onDelete={handleDelete}
                    onExtendDays={handleExtendDays}
                    onGenerateDefaults={handleGenerateDefaults}
                />
            </div>

            {/* Modals */}
            <GuestCreateModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSubmit={handleCreateAccount}
                defaultValidDays={config.default_guest_valid_days}
                stores={stores}
            />

            <GuestPasswordModal
                user={passwordUser}
                onClose={() => setPasswordUser(null)}
                onSubmit={async (userId, newPass) => {
                    const res = await updateGuestPassword(userId, newPass);
                    if (res.success) {
                        showToast('success', 'Đã cập nhật mật khẩu mới thành công!');
                        await loadData();
                    }
                    return res;
                }}
            />

            <GuestShareModal
                user={shareUser}
                onClose={() => setShareUser(null)}
            />
        </div>
    );
}
