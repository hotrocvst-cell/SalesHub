import React, { useState, useMemo } from 'react';
import {
    Tag,
    Check,
    Trash2,
    Plus,
    CheckCircle2,
    Circle,
    Store,
    Shield,
    Crown,
    User,
    Lock,
    Eye,
    AlertCircle,
    Clock,
    Sparkles,
    Calendar,
    Target,
    Flame,
    Filter,
    Edit2,
    X,
    Database,
    Copy,
    ChevronDown
} from 'lucide-react';
import {
    type DailyWorkTarget,
    type TargetCategory,
    type TargetPriority,
    CATEGORY_CONFIG,
    PRIORITY_CONFIG,
    ALL_ASSIGNED_STORE_KEY,
    DAILY_WORK_TARGETS_SQL,
    addDailyTarget,
    deleteDailyTarget,
    toggleDailyTargetComplete,
    updateDailyTarget
} from '../services/dailyNotesService';
import type { CurrentUser } from '../../../shared/contexts/AuthContext';
import type { StoreItem } from '../../../core/lib/storage';
import { ROLE_LABELS } from '../../../core/lib/authService';
import type { LunarDate } from '../utils/lunarCalendar';

interface DailyNotesTargetSectionProps {
    selectedDate: Date;
    selectedLunar: LunarDate;
    selectedStore: string;
    setSelectedStore: (store: string) => void;
    availableStores: StoreItem[];
    userAccessibleStores: string[];
    currentUser: CurrentUser;
    isAuthenticated: boolean;
    targets: DailyWorkTarget[];
    onTargetsChanged: () => void;
}

export default function DailyNotesTargetSection({
    selectedDate,
    selectedLunar,
    selectedStore,
    setSelectedStore,
    availableStores,
    userAccessibleStores,
    currentUser,
    isAuthenticated,
    targets,
    onTargetsChanged
}: DailyNotesTargetSectionProps) {
    // 1. Phân quyền
    const userRole = currentUser.role || 'NHAN_VIEN';
    const isStaff = isAuthenticated && userRole === 'NHAN_VIEN';
    const canManage = isAuthenticated && (userRole === 'ADMIN' || userRole === 'QUAN_LY' || userRole === 'TRUONG_CA');

    // 2. Format ngày
    const dateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    const today = new Date();
    const isToday = (
        selectedDate.getDate() === today.getDate() &&
        selectedDate.getMonth() === today.getMonth() &&
        selectedDate.getFullYear() === today.getFullYear()
    );

    const diffDaysFromToday = useMemo(() => {
        const t1 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const t2 = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime();
        return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
    }, [selectedDate]);

    // 3. State cho việc thêm mục tiêu mới
    const [newTitle, setNewTitle] = useState('');
    const [newCategory, setNewCategory] = useState<TargetCategory>('TARGET');
    const [newPriority, setNewPriority] = useState<TargetPriority>('NORMAL');
    const [newTargetValue, setNewTargetValue] = useState('');
    const [targetStoreScope, setTargetStoreScope] = useState<string>(() => {
        if (selectedStore && selectedStore !== ALL_ASSIGNED_STORE_KEY && selectedStore !== 'all') {
            return selectedStore;
        }
        return ALL_ASSIGNED_STORE_KEY;
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // 4. State lọc & tìm kiếm danh sách mục tiêu
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
    const [filterCategory, setFilterCategory] = useState<string>('ALL');

    // 5. State cho inline edit
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editTargetValue, setEditTargetValue] = useState('');

    // 6. State modal SQL Supabase (dành cho Admin)
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [isCopiedSql, setIsCopiedSql] = useState(false);

    // 7. Xác nhận xóa tất cả
    const [showConfirmClearAll, setShowConfirmClearAll] = useState(false);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    };

    // Danh sách mục tiêu của ngày này thuộc phạm vi siêu thị đang xem
    const dayTargets = useMemo(() => {
        return targets.filter(t => t.date_key === dateKey);
    }, [targets, dateKey]);

    // Lọc theo trạng thái và category
    const filteredTargets = useMemo(() => {
        return dayTargets.filter(t => {
            if (filterStatus === 'ACTIVE' && t.is_completed) return false;
            if (filterStatus === 'COMPLETED' && !t.is_completed) return false;
            if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
            return true;
        });
    }, [dayTargets, filterStatus, filterCategory]);

    // Thống kê tiến độ ngày
    const totalDayTargets = dayTargets.length;
    const completedCount = dayTargets.filter(t => t.is_completed).length;
    const completionRate = totalDayTargets > 0 ? Math.round((completedCount / totalDayTargets) * 100) : 0;
    const urgentCount = dayTargets.filter(t => t.priority === 'HIGH' && !t.is_completed).length;

    // Xử lý Thêm mới
    const handleAddTarget = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newTitle.trim()) {
            showToast('⚠️ Vui lòng nhập nội dung mục tiêu / ghi chú!');
            return;
        }

        if (!canManage) {
            showToast('⛔ Bạn không có quyền thêm mục tiêu (Chỉ QL/TC)!');
            return;
        }

        setIsSubmitting(true);
        const creatorRole = userRole === 'ADMIN' ? 'ADMIN' : (userRole === 'QUAN_LY' ? 'QUAN_LY' : 'TRUONG_CA');
        const creatorName = currentUser.full_name || 'Quản lý';

        const storeToAssign = targetStoreScope === ALL_ASSIGNED_STORE_KEY
            ? ALL_ASSIGNED_STORE_KEY
            : targetStoreScope;

        const res = await addDailyTarget({
            store_name: storeToAssign,
            date_key: dateKey,
            title: newTitle.trim(),
            category: newCategory,
            target_value: newTargetValue.trim() || undefined,
            priority: newPriority,
            is_completed: false,
            created_by_id: currentUser.id,
            created_by_name: creatorName,
            created_by_role: creatorRole
        });

        setIsSubmitting(false);

        if (res.success) {
            setNewTitle('');
            setNewTargetValue('');
            showToast('🎉 Đã thêm mục tiêu / ghi chú mới!');
            onTargetsChanged();
        } else {
            showToast(`❌ Thất bại: ${res.error || 'Lỗi lưu trữ'}`);
        }
    };

    // Xử lý Xóa
    const handleDeleteTarget = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canManage) {
            showToast('⛔ Chỉ QL/TC mới có quyền xóa dữ liệu!');
            return;
        }
        const success = await deleteDailyTarget(id);
        if (success) {
            showToast('🗑️ Đã xóa mục tiêu thành công!');
            onTargetsChanged();
        } else {
            showToast('❌ Không thể xóa mục tiêu!');
        }
    };

    // Xử lý Đổi trạng thái hoàn thành
    const handleToggleComplete = async (id: string) => {
        if (!canManage) {
            showToast('ℹ️ Chế độ xem Nhân viên: Chỉ QL/TC mới có quyền cập nhật trạng thái hoàn thành!');
            return;
        }
        await toggleDailyTargetComplete(id);
        onTargetsChanged();
    };

    // Xử lý Xóa toàn bộ ngày
    const handleClearAllDay = async () => {
        if (!canManage) return;
        for (const t of dayTargets) {
            await deleteDailyTarget(t.id);
        }
        setShowConfirmClearAll(false);
        showToast('🗑️ Đã xóa toàn bộ mục tiêu của ngày này!');
        onTargetsChanged();
    };

    // Bắt đầu chỉnh sửa
    const handleStartEdit = (target: DailyWorkTarget, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canManage) return;
        setEditingId(target.id);
        setEditTitle(target.title);
        setEditTargetValue(target.target_value || '');
    };

    // Lưu chỉnh sửa
    const handleSaveEdit = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!editTitle.trim()) {
            showToast('⚠️ Nội dung không được để trống!');
            return;
        }
        await updateDailyTarget(id, {
            title: editTitle.trim(),
            target_value: editTargetValue.trim() || undefined
        });
        setEditingId(null);
        showToast('✅ Đã cập nhật mục tiêu!');
        onTargetsChanged();
    };

    // Hủy chỉnh sửa
    const handleCancelEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(null);
    };

    // Sao chép SQL
    const handleCopySql = () => {
        navigator.clipboard.writeText(DAILY_WORK_TARGETS_SQL);
        setIsCopiedSql(true);
        showToast('📋 Đã sao chép câu lệnh SQL tạo bảng Supabase!');
        setTimeout(() => setIsCopiedSql(false), 2500);
    };

    return (
        <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/90 shadow-sm space-y-6">
            {/* TOAST THÔNG BÁO NHANH */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs font-bold border border-white/20 animate-in fade-in slide-in-from-bottom-3 duration-200">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* 1. HEADER: NGÀY ĐANG CHỌN & PHÂN QUYỀN / NHÓM SIÊU THỊ PHỤ TRÁCH */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-blue-100">
                {/* Thông tin ngày */}
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex flex-col items-center justify-center font-black shadow-md shadow-blue-500/20 shrink-0">
                        <span className="text-lg font-mono leading-none">{selectedDate.getDate()}</span>
                        <span className="text-[10px] uppercase font-bold text-blue-200">Tháng {selectedDate.getMonth() + 1}</span>
                    </div>

                    <div>
                        <div className="font-black text-slate-900 text-base sm:text-lg flex flex-wrap items-center gap-2">
                            <span>
                                {['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][selectedDate.getDay()]}, {selectedDate.toLocaleDateString('vi-VN')}
                            </span>
                            {isToday && (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
                                    Hôm nay
                                </span>
                            )}
                        </div>

                        <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-2">
                            <span>Âm lịch: <b>Ngày {selectedLunar.day} tháng {selectedLunar.month}{selectedLunar.isLeap ? ' (Nhuận)' : ''}</b> ({selectedLunar.canChiDay})</span>
                            <span>•</span>
                            <span>Năm {selectedLunar.canChiYear}</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-500">
                                {diffDaysFromToday === 0 ? (
                                    <span className="text-amber-700 font-bold">🎯 Ngày làm việc hiện tại</span>
                                ) : diffDaysFromToday > 0 ? (
                                    <span>Còn <b className="text-blue-700 font-mono">{diffDaysFromToday}</b> ngày</span>
                                ) : (
                                    <span>Đã qua <b className="text-slate-700 font-mono">{Math.abs(diffDaysFromToday)}</b> ngày</span>
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Phân quyền tài khoản & Bộ chọn Siêu thị đang phụ trách */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 bg-white/80 p-2.5 rounded-2xl border border-blue-100/90 shadow-2xs">
                    {/* Badge quyền người dùng */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold shrink-0">
                        {userRole === 'ADMIN' ? (
                            <>
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-amber-800">Admin</span>
                            </>
                        ) : userRole === 'QUAN_LY' ? (
                            <>
                                <Crown className="w-3.5 h-3.5 text-blue-600" />
                                <span className="text-blue-800">Quản Lý (QL)</span>
                            </>
                        ) : userRole === 'TRUONG_CA' ? (
                            <>
                                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-800">Trưởng Ca (TC)</span>
                            </>
                        ) : (
                            <>
                                <User className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-slate-700">Nhân Viên (NV)</span>
                            </>
                        )}
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[130px]">
                            {currentUser.full_name || 'Khách'}
                        </span>
                    </div>

                    {/* Bộ lọc Siêu thị phụ trách */}
                    <div className="flex items-center gap-2">
                        {isStaff ? (
                            // Nhân viên: KHÓA CHẶT ở siêu thị được giao, CHỈ XEM
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold" title="Nhân viên chỉ có quyền xem mục tiêu của siêu thị mình">
                                <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                                <span className="truncate max-w-[200px]">Siêu thị: {currentUser.store_name || 'Chưa gán'}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 font-extrabold uppercase ml-1">Chỉ xem</span>
                            </div>
                        ) : (
                            // QL / TC / Admin: Tự do chọn Toàn nhóm hoặc siêu thị cụ thể
                            <div className="relative flex items-center">
                                <Store className="w-3.5 h-3.5 text-blue-600 absolute left-3 pointer-events-none" />
                                <select
                                    value={selectedStore}
                                    onChange={(e) => setSelectedStore(e.target.value)}
                                    className="pl-8 pr-7 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-blue-200 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs transition"
                                >
                                    {/* Với Admin: Xem Toàn Hệ Thống */}
                                    {userRole === 'ADMIN' && (
                                        <option value={ALL_ASSIGNED_STORE_KEY}>
                                            🌐 Toàn bộ hệ thống ({availableStores.length} siêu thị)
                                        </option>
                                    )}

                                    {/* Với QL / TC: Xem Toàn bộ nhóm siêu thị phụ trách */}
                                    {userRole !== 'ADMIN' && (
                                        <option value={ALL_ASSIGNED_STORE_KEY}>
                                            🏢 Toàn nhóm phụ trách ({userAccessibleStores.length > 0 ? userAccessibleStores.length : 1} siêu thị)
                                        </option>
                                    )}

                                    {/* Danh sách từng siêu thị */}
                                    {(userRole === 'ADMIN' ? availableStores.map(s => s.name) : userAccessibleStores).map((storeName) => (
                                        <option key={storeName} value={storeName}>
                                            📍 {storeName}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
                            </div>
                        )}

                        {/* Nút SQL cho Admin */}
                        {userRole === 'ADMIN' && (
                            <button
                                type="button"
                                onClick={() => setShowSqlModal(true)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
                                title="Xem lệnh SQL Supabase cho bảng daily_work_targets"
                            >
                                <Database className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. THANH THỐNG KÊ TIẾN ĐỘ NGÀY & BỘ LỌC TAB */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                {/* Thống kê tiến độ */}
                <div className="flex items-center gap-3 text-xs flex-wrap">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Target className="w-4 h-4 text-blue-600" />
                        <span>Mục tiêu ngày: <b className="text-blue-700 font-mono text-sm">{totalDayTargets}</b> mục</span>
                    </div>

                    <span className="text-slate-300">•</span>

                    <div className="flex items-center gap-1.5 text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Hoàn thành: <b className="text-emerald-700 font-mono">{completedCount}/{totalDayTargets}</b></span>
                        {totalDayTargets > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-[11px] border border-emerald-200">
                                {completionRate}%
                            </span>
                        )}
                    </div>

                    {urgentCount > 0 && (
                        <>
                            <span className="text-slate-300">•</span>
                            <div className="flex items-center gap-1 text-rose-600 font-bold animate-pulse">
                                <Flame className="w-3.5 h-3.5 text-rose-500" />
                                <span>{urgentCount} việc khẩn cấp</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Bộ lọc tab trạng thái & category */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-bold text-slate-600">
                        <button
                            type="button"
                            onClick={() => setFilterStatus('ALL')}
                            className={`px-2.5 py-1 rounded-lg transition ${filterStatus === 'ALL' ? 'bg-white text-blue-700 shadow-2xs' : 'hover:text-slate-900'}`}
                        >
                            Tất cả ({totalDayTargets})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('ACTIVE')}
                            className={`px-2.5 py-1 rounded-lg transition ${filterStatus === 'ACTIVE' ? 'bg-white text-blue-700 shadow-2xs' : 'hover:text-slate-900'}`}
                        >
                            Cần làm ({totalDayTargets - completedCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('COMPLETED')}
                            className={`px-2.5 py-1 rounded-lg transition ${filterStatus === 'COMPLETED' ? 'bg-white text-emerald-700 shadow-2xs' : 'hover:text-slate-900'}`}
                        >
                            Đã xong ({completedCount})
                        </button>
                    </div>

                    {/* Lọc theo phân loại */}
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    >
                        <option value="ALL">Mọi loại mục tiêu</option>
                        <option value="TARGET">🎯 Mục tiêu số</option>
                        <option value="TASK">📋 Giao việc ca</option>
                        <option value="REMINDER">📢 Nhắc nhở ca</option>
                        <option value="CAMPAIGN">🏆 Thi đua</option>
                    </select>
                </div>
            </div>

            {/* 3. KHU VỰC CẬP NHẬT / THÊM MỤC TIÊU MỚI (CHỈ QUẢN LÝ / TRƯỞNG CA) */}
            {canManage ? (
                <form onSubmit={handleAddTarget} className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <Plus className="w-4 h-4 text-blue-600" />
                            <span>Thêm mục tiêu / Ghi chú công việc cho ngày {selectedDate.getDate()}/{selectedDate.getMonth() + 1}:</span>
                        </div>
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                            Quyền cập nhật: {userRole === 'ADMIN' ? 'Admin' : (userRole === 'QUAN_LY' ? 'Quản Lý (QL)' : 'Trưởng Ca (TC)')}
                        </span>
                    </div>

                    {/* Dòng 1: Nội dung chính & Chỉ tiêu */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                        <div className="md:col-span-8">
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="Nhập mục tiêu / nội dung công việc (VD: Họp giao ban 8h30; Đẩy mạnh thi đua iPhone; Chốt chỉ tiêu sim...)"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs font-medium"
                            />
                        </div>

                        <div className="md:col-span-4">
                            <input
                                type="text"
                                value={newTargetValue}
                                onChange={(e) => setNewTargetValue(e.target.value)}
                                placeholder="Chỉ tiêu số (VD: 50 Tr, 10 máy, 5 sim...)"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs font-medium"
                            />
                        </div>
                    </div>

                    {/* Dòng 2: Phân loại, Mức độ ưu tiên, Gán siêu thị & Nút Lưu */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Phân loại Category */}
                            <div className="flex items-center gap-1 text-xs">
                                <span className="text-[11px] text-slate-500 font-bold">Loại:</span>
                                <select
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value as TargetCategory)}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                                >
                                    <option value="TARGET">🎯 Mục tiêu kinh doanh</option>
                                    <option value="TASK">📋 Giao việc ca</option>
                                    <option value="REMINDER">📢 Nhắc nhở ca</option>
                                    <option value="CAMPAIGN">🏆 Thi đua / Thưởng</option>
                                </select>
                            </div>

                            {/* Mức độ ưu tiên Priority */}
                            <div className="flex items-center gap-1 text-xs">
                                <span className="text-[11px] text-slate-500 font-bold">Ưu tiên:</span>
                                <select
                                    value={newPriority}
                                    onChange={(e) => setNewPriority(e.target.value as TargetPriority)}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                                >
                                    <option value="NORMAL">🟢 Tiêu chuẩn</option>
                                    <option value="MEDIUM">🟡 Quan trọng</option>
                                    <option value="HIGH">🔴 Khẩn cấp / Cao</option>
                                </select>
                            </div>

                            {/* Phạm vi áp dụng siêu thị */}
                            <div className="flex items-center gap-1 text-xs">
                                <span className="text-[11px] text-slate-500 font-bold">Gán cho:</span>
                                <select
                                    value={targetStoreScope}
                                    onChange={(e) => setTargetStoreScope(e.target.value)}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer max-w-[200px] truncate"
                                >
                                    <option value={ALL_ASSIGNED_STORE_KEY}>
                                        🌐 Toàn nhóm siêu thị phụ trách
                                    </option>
                                    {(userRole === 'ADMIN' ? availableStores.map(s => s.name) : userAccessibleStores).map((storeName) => (
                                        <option key={storeName} value={storeName}>
                                            📍 {storeName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Nút bấm thêm */}
                        <button
                            type="submit"
                            disabled={isSubmitting || !newTitle.trim()}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            <span>{isSubmitting ? 'Đang lưu...' : 'Thêm Mục Tiêu'}</span>
                        </button>
                    </div>
                </form>
            ) : (
                /* CHẾ ĐỘ XEM DÀNH CHO NHÂN VIÊN (CHỈ XEM, KHÔNG CẬP NHẬT) */
                <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-900 text-xs flex items-center gap-3 shadow-2xs">
                    <Eye className="w-5 h-5 text-amber-600 shrink-0" />
                    <div className="space-y-0.5">
                        <div className="font-black flex items-center gap-2">
                            <span>Chế độ xem dành cho Nhân Viên</span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black uppercase">
                                Chỉ Xem
                            </span>
                        </div>
                        <p className="text-amber-800 leading-relaxed">
                            Bạn đang theo dõi danh sách mục tiêu và ghi chú công việc ngày của siêu thị <b>{currentUser.store_name || 'phụ trách'}</b> do Quản lý (QL) / Trưởng ca (TC) phân công.
                            Phân quyền cập nhật (thêm / xóa) chỉ áp dụng cho tài khoản QL và TC.
                        </p>
                    </div>
                </div>
            )}

            {/* 4. DANH SÁCH CÁC MỤC TIÊU & GHI CHÚ CÔNG VIỆC TRONG NGÀY */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-600" />
                        <span>Danh sách mục tiêu ngày ({filteredTargets.length} mục):</span>
                    </span>

                    {canManage && dayTargets.length > 0 && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowConfirmClearAll(true)}
                                className="text-[11px] text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                            >
                                <Trash2 className="w-3 h-3" />
                                <span>Xóa tất cả</span>
                            </button>
                        </div>
                    )}
                </div>

                {filteredTargets.length === 0 ? (
                    // EMPTY STATE
                    <div className="p-8 rounded-2xl bg-white/70 border border-dashed border-slate-300 text-center space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div className="font-bold text-slate-700 text-sm">
                            {dayTargets.length === 0 ? 'Chưa có mục tiêu cho ngày này' : 'Không có mục tiêu phù hợp với bộ lọc'}
                        </div>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                            {canManage
                                ? 'Hãy nhập vào ô phía trên để phân công mục tiêu doanh số, thi đua hoặc công việc ca cho nhóm siêu thị phụ trách.'
                                : 'Chưa có ghi chú hoặc mục tiêu nào được giao cho siêu thị của bạn trong ngày này.'}
                        </p>
                    </div>
                ) : (
                    // CARDS DANH SÁCH MỤC TIÊU
                    <div className="space-y-2">
                        {filteredTargets.map((target) => {
                            const catCfg = CATEGORY_CONFIG[target.category] || CATEGORY_CONFIG.TARGET;
                            const prioCfg = PRIORITY_CONFIG[target.priority] || PRIORITY_CONFIG.NORMAL;
                            const isBeingEdited = editingId === target.id;

                            return (
                                <div
                                    key={target.id}
                                    className={`p-3.5 sm:p-4 rounded-2xl bg-white border transition shadow-2xs group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                        target.is_completed
                                            ? 'border-emerald-200/80 bg-emerald-50/20'
                                            : target.priority === 'HIGH'
                                            ? 'border-rose-200 bg-rose-50/15'
                                            : 'border-slate-200 hover:border-blue-300'
                                    }`}
                                >
                                    {/* Bên trái: Checkbox + Nội dung + Badges */}
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        {/* Nút check hoàn thành */}
                                        <button
                                            type="button"
                                            disabled={!canManage}
                                            onClick={() => handleToggleComplete(target.id)}
                                            className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition ${
                                                canManage ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                                            } ${
                                                target.is_completed
                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                    : 'border-2 border-slate-300 hover:border-blue-500 text-transparent'
                                            }`}
                                            title={canManage ? (target.is_completed ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu đã hoàn thành') : 'Chỉ xem trạng thái'}
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Nội dung mục tiêu */}
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            {isBeingEdited ? (
                                                <div className="space-y-2">
                                                    <input
                                                        type="text"
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        className="w-full px-3 py-1.5 rounded-xl border border-blue-400 text-xs text-slate-800 outline-none"
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={editTargetValue}
                                                            onChange={(e) => setEditTargetValue(e.target.value)}
                                                            placeholder="Chỉ tiêu số..."
                                                            className="px-3 py-1 rounded-xl border border-slate-300 text-xs text-slate-800 outline-none w-48"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleSaveEdit(target.id, e)}
                                                            className="px-3 py-1 rounded-xl bg-blue-600 text-white text-xs font-bold"
                                                        >
                                                            Lưu
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleCancelEdit}
                                                            className="px-3 py-1 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold"
                                                        >
                                                            Hủy
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-baseline gap-2 flex-wrap">
                                                        <span className={`text-xs sm:text-sm font-bold leading-snug break-words ${
                                                            target.is_completed ? 'line-through text-slate-400' : 'text-slate-900'
                                                        }`}>
                                                            {target.title}
                                                        </span>

                                                        {/* Badge Chỉ tiêu số nếu có */}
                                                        {target.target_value && (
                                                            <span className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 text-xs font-black font-mono border border-amber-200/80 shrink-0">
                                                                🎯 {target.target_value}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Hàng metadata: Phân loại, Ưu tiên, Siêu thị, Người tạo */}
                                                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                                        {/* Badge Loại */}
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold border ${catCfg.bg} ${catCfg.color} ${catCfg.border}`}>
                                                            <span>{catCfg.icon}</span>
                                                            <span>{catCfg.label}</span>
                                                        </span>

                                                        {/* Badge Ưu tiên */}
                                                        {target.priority !== 'NORMAL' && (
                                                            <span className={`px-2 py-0.5 rounded-lg font-bold border text-[10px] uppercase ${prioCfg.badge}`}>
                                                                {prioCfg.label}
                                                            </span>
                                                        )}

                                                        {/* Gán cho Siêu thị nào */}
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold border border-slate-200 truncate max-w-[220px]" title={target.store_name}>
                                                            <Store className="w-3 h-3 text-slate-500 shrink-0" />
                                                            <span className="truncate">
                                                                {target.store_name === ALL_ASSIGNED_STORE_KEY ? 'Toàn nhóm siêu thị' : target.store_name}
                                                            </span>
                                                        </span>

                                                        {/* Người tạo */}
                                                        <span className="text-slate-400 font-medium hidden sm:inline">
                                                            Tạo bởi: <b className="text-slate-600">{target.created_by_name}</b> ({ROLE_LABELS[target.created_by_role as any] || target.created_by_role})
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bên phải: Nút thao tác (Chỉ dành cho QL / TC) */}
                                    {canManage && !isBeingEdited && (
                                        <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => handleStartEdit(target, e)}
                                                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                                title="Sửa nội dung"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteTarget(target.id, e)}
                                                className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                                title="Xóa mục tiêu này"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODAL XÁC NHẬN XÓA TOÀN BỘ */}
            {showConfirmClearAll && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200">
                        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <div className="text-center space-y-1">
                            <h3 className="text-base font-black text-slate-900">Xác nhận xóa toàn bộ mục tiêu?</h3>
                            <p className="text-xs text-slate-500">
                                Thao tác này sẽ xóa toàn bộ {dayTargets.length} mục tiêu / việc cần làm của ngày {selectedDate.getDate()}/{selectedDate.getMonth() + 1}. Thao tác này không thể hoàn tác.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowConfirmClearAll(false)}
                                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAllDay}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition shadow-sm"
                            >
                                Xác nhận xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL SQL SUPABASE DÀNH CHO ADMIN */}
            {showSqlModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 border border-slate-200 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-blue-600" />
                                <h3 className="text-base font-black text-slate-900">Cấu hình Bảng Supabase: daily_work_targets</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowSqlModal(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs text-slate-600">
                            Hệ thống đã tự động lưu trữ và đồng bộ cục bộ (LocalStorage) với khả năng chạy offline 100%. Nếu muốn lưu trữ vĩnh viễn trên Supabase Cloud cho toàn bộ nhân viên truy cập đồng thời, bạn có thể copy và chạy đoạn SQL này tại SQL Editor của Supabase:
                        </p>

                        <div className="relative">
                            <pre className="p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
                                {DAILY_WORK_TARGETS_SQL}
                            </pre>
                            <button
                                type="button"
                                onClick={handleCopySql}
                                className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                <span>{isCopiedSql ? 'Đã sao chép!' : 'Sao chép SQL'}</span>
                            </button>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setShowSqlModal(false)}
                                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
