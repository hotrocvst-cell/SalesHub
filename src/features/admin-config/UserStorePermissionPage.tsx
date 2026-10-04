import { useState, useEffect, useMemo } from 'react';
import { useAuth, type UserRole } from '../../shared/contexts/AuthContext';
import {
    fetchAllUserProfiles,
    adminUpdateUserProfile,
    type UserProfile,
    ROLE_LABELS
} from '../../core/lib/authService';
import { fetchStores, type StoreItem } from '../../core/lib/storage';
import { getShortStoreName, isStoreMatch } from '../../core/lib/formatters';
import {
    Building2,
    Users,
    Shield,
    Crown,
    Star,
    CheckCircle2,
    Search,
    Filter,
    Edit3,
    Check,
    Store,
    Lock,
    Unlock,
    RefreshCw,
    X,
    ChevronRight,
    SlidersHorizontal,
    AlertCircle,
    Info,
    Sparkles
} from 'lucide-react';

export default function UserStorePermissionPage() {
    const { currentUser, isActualAdmin } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [toastMessage, setToastMessage] = useState<string>('');

    // Bộ lọc
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [storeFilter, setStoreFilter] = useState<string>('ALL');
    const [multiStoreFilter, setMultiStoreFilter] = useState<'ALL' | 'MULTI' | 'SINGLE'>('ALL');

    // Modal phân quyền
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [selectedStoreNames, setSelectedStoreNames] = useState<Set<string>>(new Set());
    const [modalSearchStore, setModalSearchStore] = useState<string>('');
    const [isSaving, setIsSaving] = useState<boolean>(false);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [userList, storeRes] = await Promise.all([
                fetchAllUserProfiles(),
                fetchStores()
            ]);
            setUsers(userList);
            if (storeRes.success && storeRes.data) {
                setStores(storeRes.data);
            }
        } catch (e) {
            console.error('Lỗi nạp dữ liệu phân quyền:', e);
            showToast('⚠️ Không thể tải dữ liệu phân quyền');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Mở modal phân quyền
    const handleOpenEditModal = (user: UserProfile) => {
        setEditingUser(user);
        setModalSearchStore('');

        if (user.role === 'ADMIN') {
            // Admin toàn quyền tất cả
            setSelectedStoreNames(new Set(stores.map(s => s.name)));
        } else if (user.accessible_stores && user.accessible_stores.length > 0) {
            setSelectedStoreNames(new Set(user.accessible_stores));
        } else if (user.store_name) {
            setSelectedStoreNames(new Set([user.store_name]));
        } else {
            setSelectedStoreNames(new Set());
        }
    };

    // Toggle chọn/bỏ chọn 1 siêu thị trong modal
    const handleToggleStore = (storeName: string) => {
        if (!editingUser) return;

        // Nếu là nhân viên: chỉ được chọn đúng 1 siêu thị duy nhất
        if (editingUser.role === 'NHAN_VIEN') {
            setSelectedStoreNames(new Set([storeName]));
            return;
        }

        // Với Quản lý / Trưởng ca: hỗ trợ đa siêu thị
        setSelectedStoreNames(prev => {
            const next = new Set(prev);
            if (next.has(storeName)) {
                next.delete(storeName);
            } else {
                next.add(storeName);
            }
            return next;
        });
    };

    // Chọn tất cả siêu thị trong modal
    const handleSelectAllStores = () => {
        setSelectedStoreNames(new Set(stores.map(s => s.name)));
    };

    // Bỏ chọn tất cả siêu thị trong modal
    const handleClearAllStores = () => {
        setSelectedStoreNames(new Set());
    };

    // Chỉ chọn siêu thị đăng ký gốc
    const handleSelectOnlyPrimaryStore = () => {
        if (editingUser?.store_name) {
            setSelectedStoreNames(new Set([editingUser.store_name]));
        }
    };

    // Lưu cập nhật phân quyền
    const handleSavePermissions = async () => {
        if (!editingUser) return;
        setIsSaving(true);

        const storeList = Array.from(selectedStoreNames);
        // Siêu thị chính: lấy siêu thị đầu tiên được chọn hoặc giữ nguyên
        const primaryStore = storeList.length > 0 ? storeList[0] : editingUser.store_name;

        const updates: Partial<UserProfile> = {
            accessible_stores: storeList,
            store_name: primaryStore
        };

        const res = await adminUpdateUserProfile(editingUser.id, updates);
        setIsSaving(false);

        if (res.success && res.data) {
            setUsers(prev => prev.map(u => (u.id === editingUser.id ? res.data! : u)));
            showToast(`✅ Đã lưu phân quyền xem siêu thị cho ${editingUser.full_name}!`);
            setEditingUser(null);
        } else {
            showToast(`❌ Lỗi lưu phân quyền: ${res.error || 'Vui lòng thử lại'}`);
        }
    };

    // Lọc danh sách người dùng hiển thị
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            // 1. Tìm kiếm
            const q = searchQuery.toLowerCase().trim();
            if (q) {
                const matchName = user.full_name?.toLowerCase().includes(q);
                const matchId = user.employee_id?.toLowerCase().includes(q);
                const matchEmail = user.email?.toLowerCase().includes(q);
                const matchPhone = user.phone?.includes(q);
                if (!matchName && !matchId && !matchEmail && !matchPhone) return false;
            }

            // 2. Lọc vai trò
            if (roleFilter !== 'ALL' && user.role !== roleFilter) {
                return false;
            }

            // 3. Lọc theo siêu thị cụ thể (user nào đang xem được siêu thị này?)
            if (storeFilter !== 'ALL') {
                if (user.role === 'ADMIN') {
                    // Admin xem được mọi siêu thị -> giữ lại
                } else {
                    const userStores = user.accessible_stores && user.accessible_stores.length > 0
                        ? user.accessible_stores
                        : (user.store_name ? [user.store_name] : []);
                    const canSeeStore = userStores.some(s => isStoreMatch(s, storeFilter, stores));
                    if (!canSeeStore) return false;
                }
            }

            // 4. Lọc theo chế độ đa shop vs 1 shop
            if (multiStoreFilter === 'MULTI') {
                const count = user.accessible_stores ? user.accessible_stores.length : 1;
                if (user.role !== 'ADMIN' && count < 2) return false;
            } else if (multiStoreFilter === 'SINGLE') {
                const count = user.accessible_stores ? user.accessible_stores.length : 1;
                if (user.role === 'ADMIN' || count > 1) return false;
            }

            return true;
        });
    }, [users, searchQuery, roleFilter, storeFilter, multiStoreFilter, stores]);

    // Thống kê nhanh
    const stats = useMemo(() => {
        const totalUsers = users.length;
        const totalStores = stores.length;
        const managers = users.filter(u => u.role === 'QUAN_LY' || u.role === 'TRUONG_CA');
        const multiStoreManagers = managers.filter(u => (u.accessible_stores?.length || 1) >= 2);
        const staff = users.filter(u => u.role === 'NHAN_VIEN');

        return {
            totalUsers,
            totalStores,
            totalManagers: managers.length,
            multiStoreManagers: multiStoreManagers.length,
            totalStaff: staff.length
        };
    }, [users, stores]);

    // Lọc danh sách siêu thị trong modal
    const modalFilteredStores = useMemo(() => {
        if (!modalSearchStore.trim()) return stores;
        const q = modalSearchStore.toLowerCase().trim();
        return stores.filter(s => s.name.toLowerCase().includes(q));
    }, [stores, modalSearchStore]);

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Toast notification */}
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl border border-slate-700 flex items-center gap-2 animate-in slide-in-from-top-3">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* 1. Header & Title */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-blue-200 text-xs font-black uppercase tracking-wider">
                            <Building2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Quản Trị Phạm Vi Dữ Liệu</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                            Phân Quyền Xem Siêu Thị
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                            Theo dõi và cấu hình danh sách siêu thị được phép xem của từng tài khoản. Quản lý / Trưởng ca có thể xem nhiều siêu thị được phân công, Nhân viên chỉ xem đúng siêu thị đã đăng ký.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={loadData}
                            disabled={isLoading}
                            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-2 border border-white/15 cursor-pointer backdrop-blur-sm"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Làm mới</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Thống kê KPI tổng quan */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Tổng Siêu Thị</span>
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Store className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                        {stats.totalStores}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Siêu thị đang hoạt động</div>
                </div>

                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Tổng Tài Khoản</span>
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-indigo-950 font-mono">
                        {stats.totalUsers}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Tài khoản trong hệ thống</div>
                </div>

                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200 bg-gradient-to-b from-amber-50/30 to-white shadow-xs">
                    <div className="flex items-center justify-between text-amber-700 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Quản Lý & Trưởng Ca</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                            <Crown className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                        {stats.totalManagers}
                    </div>
                    <div className="text-[11px] text-amber-800 font-bold mt-1">
                        {stats.multiStoreManagers} người phụ trách đa siêu thị
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-200 bg-gradient-to-b from-emerald-50/30 to-white shadow-xs">
                    <div className="flex items-center justify-between text-emerald-700 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Nhân Viên Bán Hàng</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                            <Lock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                        {stats.totalStaff}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-bold mt-1">
                        100% cố định theo shop đăng ký
                    </div>
                </div>
            </div>

            {/* 3. Khối quy tắc bảo mật & phân quyền */}
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 text-xs text-blue-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Info className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="font-extrabold text-blue-950 text-sm">Quy tắc phân quyền hiển thị dữ liệu:</div>
                        <p className="text-blue-800 mt-0.5">
                            • <b>Admin:</b> Toàn quyền xem mọi siêu thị | • <b>Quản lý / Trưởng ca:</b> Xem các siêu thị được gán trong danh sách | • <b>Nhân viên:</b> Chỉ xem số liệu siêu thị của mình.
                        </p>
                    </div>
                </div>
            </div>

            {/* 4. Thanh tìm kiếm & Bộ lọc */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm tài khoản theo Họ tên, Mã NV, Email, SĐT..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filter by Role */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
                            <Shield className="w-3.5 h-3.5 text-slate-500" />
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="bg-transparent outline-none cursor-pointer text-slate-800"
                            >
                                <option value="ALL">Tất cả vai trò</option>
                                <option value="ADMIN">Quản trị viên (Admin)</option>
                                <option value="QUAN_LY">Quản lý Siêu thị</option>
                                <option value="TRUONG_CA">Trưởng Ca</option>
                                <option value="NHAN_VIEN">Nhân viên</option>
                            </select>
                        </div>

                        {/* Filter by Store (Ai đang xem siêu thị này?) */}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 max-w-[240px]">
                            <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <select
                                value={storeFilter}
                                onChange={(e) => setStoreFilter(e.target.value)}
                                className="bg-transparent outline-none cursor-pointer text-slate-800 truncate"
                                title="Lọc xem những ai đang được phân quyền xem siêu thị này"
                            >
                                <option value="ALL">Tất cả siêu thị</option>
                                {stores.map(s => (
                                    <option key={s.id} value={s.name}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Filter by Single vs Multi Store */}
                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                            <select
                                value={multiStoreFilter}
                                onChange={(e) => setMultiStoreFilter(e.target.value as any)}
                                className="bg-transparent outline-none cursor-pointer text-slate-800"
                            >
                                <option value="ALL">Tất cả phạm vi</option>
                                <option value="MULTI">Đa siêu thị (&ge; 2 shop)</option>
                                <option value="SINGLE">1 siêu thị duy nhất</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>
                        Hiển thị <b>{filteredUsers.length}</b> / <b>{users.length}</b> tài khoản
                    </span>
                    {(searchQuery || roleFilter !== 'ALL' || storeFilter !== 'ALL' || multiStoreFilter !== 'ALL') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setRoleFilter('ALL');
                                setStoreFilter('ALL');
                                setMultiStoreFilter('ALL');
                            }}
                            className="text-blue-600 hover:underline font-bold cursor-pointer"
                        >
                            Xóa bộ lọc
                        </button>
                    )}
                </div>
            </div>

            {/* 5. Bảng Danh Sách Tài Khoản & Phạm Vi Xem Dữ Liệu */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600 border-collapse">
                        <thead>
                            <tr className="bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider border-b border-slate-800">
                                <th className="py-3.5 px-4 w-12 text-center">STT</th>
                                <th className="py-3.5 px-4 min-w-[200px]">Tài Khoản & Nhân Viên</th>
                                <th className="py-3.5 px-3 w-36">Vai Trò</th>
                                <th className="py-3.5 px-3 min-w-[180px]">Siêu Thị Gốc</th>
                                <th className="py-3.5 px-4 min-w-[280px]">Phạm Vi Siêu Thị Được Xem</th>
                                <th className="py-3.5 px-4 w-28 text-center">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-400">
                                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        <span>Đang tải danh sách phân quyền...</span>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-400">
                                        <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                        <p className="font-bold text-slate-600">Không tìm thấy tài khoản phù hợp</p>
                                        <p className="text-xs text-slate-400 mt-1">Hãy thử thay đổi điều kiện tìm kiếm hoặc bộ lọc.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user, idx) => {
                                    const isAdmin = user.role === 'ADMIN';
                                    const isManager = user.role === 'QUAN_LY';
                                    const isShift = user.role === 'TRUONG_CA';
                                    const isStaff = user.role === 'NHAN_VIEN';

                                    // Danh sách siêu thị user có quyền xem
                                    const accessibleList = user.accessible_stores && user.accessible_stores.length > 0
                                        ? user.accessible_stores
                                        : (user.store_name ? [user.store_name] : []);

                                    const isMulti = !isAdmin && accessibleList.length >= 2;

                                    return (
                                        <tr
                                            key={user.id}
                                            className="hover:bg-slate-50/80 transition duration-150"
                                        >
                                            {/* STT */}
                                            <td className="py-3 px-4 text-center font-bold text-slate-400">
                                                {idx + 1}
                                            </td>

                                            {/* Tài khoản */}
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${
                                                        isAdmin
                                                            ? 'bg-rose-100 text-rose-700'
                                                            : isManager
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : isShift
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                    </div>
                                                    <div className="truncate">
                                                        <div className="font-extrabold text-slate-900 leading-snug truncate">
                                                            {user.employee_id ? `${user.employee_id} - ` : ''}{user.full_name}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 font-mono truncate">
                                                            {user.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Vai trò */}
                                            <td className="py-3 px-3">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                                    isAdmin
                                                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                                        : isManager
                                                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                                        : isShift
                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                                }`}>
                                                    {isAdmin && <Crown className="w-3 h-3 text-purple-600" />}
                                                    {isManager && <Star className="w-3 h-3 text-blue-600" />}
                                                    {isShift && <Shield className="w-3 h-3 text-emerald-600" />}
                                                    <span>{ROLE_LABELS[user.role] || user.role}</span>
                                                </span>
                                            </td>

                                            {/* Siêu thị gốc */}
                                            <td className="py-3 px-3">
                                                <div className="font-semibold text-slate-800 text-xs truncate max-w-[200px]" title={user.store_name}>
                                                    {getShortStoreName(user.store_name) || <span className="text-slate-300 italic">Chưa gán</span>}
                                                </div>
                                            </td>

                                            {/* Phạm vi siêu thị được xem */}
                                            <td className="py-3 px-4">
                                                {isAdmin ? (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-300 text-purple-900 font-black text-xs shadow-2xs">
                                                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                                        <span>Toàn quyền (Tất cả {stores.length} siêu thị)</span>
                                                    </div>
                                                ) : isStaff ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200 shrink-0">
                                                            <Lock className="w-3 h-3 text-slate-400" />
                                                            Cố định shop
                                                        </span>
                                                        <span className="font-bold text-slate-800 text-xs truncate max-w-[220px]" title={user.store_name}>
                                                            {getShortStoreName(user.store_name) || 'Chưa gán'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                                                isMulti
                                                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                                                    : 'bg-blue-100 text-blue-900 border border-blue-200'
                                                            }`}>
                                                                Phụ trách {accessibleList.length} siêu thị
                                                            </span>
                                                        </div>

                                                        {/* Danh sách thẻ tên siêu thị */}
                                                        <div className="flex flex-wrap gap-1 max-w-[340px]">
                                                            {accessibleList.slice(0, 3).map((st, i) => (
                                                                <span
                                                                    key={i}
                                                                    className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold truncate max-w-[150px] border border-slate-200"
                                                                    title={st}
                                                                >
                                                                    {getShortStoreName(st)}
                                                                </span>
                                                            ))}
                                                            {accessibleList.length > 3 && (
                                                                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-black">
                                                                    +{accessibleList.length - 3} shop khác
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Nút thao tác */}
                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditModal(user)}
                                                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer shadow-2xs group"
                                                    title="Chỉnh sửa danh sách siêu thị được phép xem"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition" />
                                                    <span>Phân quyền</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ========================================================= */}
            {/* 6. MODAL PHÂN QUYỀN SIÊU THỊ CHO TÀI KHOẢN                */}
            {/* ========================================================= */}
            {editingUser && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 relative overflow-hidden max-h-[90vh] flex flex-col">
                        {/* Header Modal */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                                    <Store className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-base text-slate-900 leading-snug">
                                        Cấu Hình Phạm Vi Xem Siêu Thị
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Tài khoản: <b className="text-slate-800">{editingUser.employee_id ? `${editingUser.employee_id} - ` : ''}{editingUser.full_name}</b> ({ROLE_LABELS[editingUser.role]})
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingUser(null)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Thông điệp hướng dẫn theo vai trò */}
                        <div className="shrink-0">
                            {editingUser.role === 'NHAN_VIEN' ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
                                    <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-extrabold">Quy định Nhân viên bán hàng:</span> Chỉ được xem dữ liệu của <b>1 siêu thị đăng ký trực tiếp</b>. Chọn siêu thị bên dưới để chuyển đổi nơi làm việc của nhân viên nếu luân chuyển công tác.
                                    </div>
                                </div>
                            ) : editingUser.role === 'ADMIN' ? (
                                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 text-xs text-purple-900 flex items-start gap-2.5">
                                    <Crown className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-extrabold">Quy định Quản trị viên (Admin):</span> Mặc định được toàn quyền xem toàn bộ siêu thị và dữ liệu toàn công ty.
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-900 flex items-start gap-2.5">
                                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-extrabold">Quản lý / Trưởng ca phụ trách đa siêu thị:</span> Tích chọn một hoặc nhiều siêu thị mà nhân sự này được phép xem báo cáo và điều hành.
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Công cụ tìm kiếm & nút chọn nhanh trong Modal */}
                        {editingUser.role !== 'ADMIN' && (
                            <div className="shrink-0 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={modalSearchStore}
                                            onChange={(e) => setModalSearchStore(e.target.value)}
                                            placeholder="Tìm siêu thị theo tên hoặc mã..."
                                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>

                                    {editingUser.role !== 'NHAN_VIEN' && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={handleSelectAllStores}
                                                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold cursor-pointer"
                                            >
                                                Chọn tất cả
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleClearAllStores}
                                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer"
                                            >
                                                Bỏ chọn hết
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                                    <span>
                                        Đã chọn: <b className="text-blue-600 font-mono text-xs">{selectedStoreNames.size}</b> / {stores.length} siêu thị
                                    </span>
                                    {editingUser.store_name && (
                                        <button
                                            type="button"
                                            onClick={handleSelectOnlyPrimaryStore}
                                            className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
                                        >
                                            Chỉ chọn shop gốc ({getShortStoreName(editingUser.store_name)})
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Danh sách lưới siêu thị để tích chọn */}
                        <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-slate-200 min-h-[220px]">
                            {editingUser.role === 'ADMIN' ? (
                                <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                                    <Crown className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                                    <p className="font-extrabold text-slate-800 text-sm">Tài khoản Quản Trị Viên (Admin)</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Admin luôn có quyền truy cập toàn bộ {stores.length} siêu thị và tất cả các phân hệ dữ liệu trên SalesHub.
                                    </p>
                                </div>
                            ) : modalFilteredStores.length === 0 ? (
                                <div className="py-8 text-center text-slate-400">
                                    Không tìm thấy siêu thị phù hợp với "{modalSearchStore}"
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {modalFilteredStores.map(store => {
                                        const isSelected = selectedStoreNames.has(store.name);
                                        const isPrimary = editingUser.store_name === store.name;

                                        return (
                                            <div
                                                key={store.id}
                                                onClick={() => handleToggleStore(store.name)}
                                                className={`p-3 rounded-2xl border text-xs cursor-pointer select-none transition flex items-start gap-2.5 ${
                                                    isSelected
                                                        ? 'bg-blue-50/80 border-blue-400 shadow-2xs'
                                                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                                                }`}
                                            >
                                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                                                    isSelected
                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                        : 'border-slate-300 bg-white'
                                                }`}>
                                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                                </div>

                                                <div className="truncate flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`font-extrabold truncate ${isSelected ? 'text-blue-950' : 'text-slate-800'}`}>
                                                            {store.name}
                                                        </span>
                                                        {isPrimary && (
                                                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-black shrink-0">
                                                                Shop Gốc
                                                            </span>
                                                        )}
                                                    </div>
                                                    {store.address && (
                                                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                                            {store.address}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer Modal Actions */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
                            <button
                                type="button"
                                onClick={() => setEditingUser(null)}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                                Đóng
                            </button>
                            {editingUser.role !== 'ADMIN' && (
                                <button
                                    type="button"
                                    onClick={handleSavePermissions}
                                    disabled={isSaving || selectedStoreNames.size === 0}
                                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Đang lưu...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            <span>Lưu Phân Quyền ({selectedStoreNames.size} siêu thị)</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
