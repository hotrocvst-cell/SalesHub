import React, { useState, useEffect } from 'react';
import {
    X,
    Calendar,
    Store,
    Trash2,
    Edit2,
    Plus,
    Save,
    Eye,
    Crown,
    Shield,
    User,
    Sparkles,
    FileText,
    Check,
    Repeat,
    Users,
    Tag,
    Clock,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import {
    type DailyWorkNote,
    type WorkTaskType,
    type WorkTaskRecurrence,
    type TargetRoleScope,
    ALL_ASSIGNED_STORE_KEY,
    addDailyNote,
    updateDailyNote,
    deleteDailyNote
} from '../services/dailyNotesService';
import type { CurrentUser } from '../../../shared/contexts/AuthContext';
import type { StoreItem } from '../../../core/lib/storage';
import type { LunarDate } from '../utils/lunarCalendar';
import { ROLE_LABELS } from '../../../core/lib/authService';

interface WorkNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetDate: Date | null;
    selectedLunar: LunarDate | null;
    selectedStore: string;
    userAccessibleStores: string[];
    availableStores: StoreItem[];
    currentUser: CurrentUser;
    dayNotes: DailyWorkNote[];
    onNotesChanged: () => void;
    canManage: boolean;
    editingNote?: DailyWorkNote | null;
}

const TASK_TYPE_OPTIONS: Array<{ key: WorkTaskType; label: string; icon: string }> = [
    { key: 'CONG_VIEC', label: 'Công việc bán hàng', icon: '💼' },
    { key: 'SU_KIEN', label: 'Sự kiện / Thi đua', icon: '🎉' },
    { key: 'NHAC_NHO', label: 'Nhắc nhở trọng tâm', icon: '🔔' },
    { key: 'CUNG_LE', label: 'Cúng mùng 2 / 16 / Thần tài', icon: '🎋' },
    { key: 'HOP_CA', label: 'Họp ca / Giao ban', icon: '🗣️' },
    { key: 'KIEM_KE', label: 'Kiểm kê / Kiểm kho', icon: '📦' },
    { key: 'KHAC', label: 'Khác', icon: '📝' }
];

const TARGET_ROLE_OPTIONS: Array<{ key: TargetRoleScope; label: string; icon: string; desc: string }> = [
    { key: 'ALL', label: 'Toàn siêu thị (Tất cả)', icon: '👥', desc: 'Mọi nhân sự đều thấy' },
    { key: 'QL_TC', label: 'Quản lý & Trưởng ca', icon: '⭐', desc: 'Chỉ cấp quản lý & điều hành' },
    { key: 'QUAN_LY', label: 'Chỉ Quản lý (QL)', icon: '👑', desc: 'Bảo mật riêng cấp Quản lý' },
    { key: 'TRUONG_CA', label: 'Chỉ Trưởng ca (TC)', icon: '🛡️', desc: 'Giao việc cho Trưởng ca' },
    { key: 'NHAN_VIEN', label: 'Nhân viên bán hàng', icon: '👤', desc: 'Dành riêng cho nhân viên' }
];

export default function WorkNoteModal({
    isOpen,
    onClose,
    targetDate,
    selectedLunar,
    selectedStore,
    userAccessibleStores,
    availableStores,
    currentUser,
    dayNotes,
    onNotesChanged,
    canManage,
    editingNote: externalEditingNote
}: WorkNoteModalProps) {
    if (!isOpen || !targetDate) return null;

    const userRole = currentUser.role || 'NHAN_VIEN';
    const dateKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

    // Form states
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [taskType, setTaskType] = useState<WorkTaskType>('CONG_VIEC');
    const [targetRoles, setTargetRoles] = useState<TargetRoleScope>('ALL');
    const [isMultiDay, setIsMultiDay] = useState<boolean>(false);
    const [endDateKey, setEndDateKey] = useState<string>(dateKey);
    const [recurrence, setRecurrence] = useState<WorkTaskRecurrence>('NONE');
    const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
    const [assignedStore, setAssignedStore] = useState<string>(() => {
        if (selectedStore && selectedStore !== ALL_ASSIGNED_STORE_KEY && selectedStore !== 'all') {
            return selectedStore;
        }
        return ALL_ASSIGNED_STORE_KEY;
    });

    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Điền dữ liệu khi mở modal hoặc chọn sửa
    useEffect(() => {
        if (externalEditingNote) {
            handleStartEdit(externalEditingNote);
            return;
        }

        setTitle('');
        setContent('');
        setTaskType('CONG_VIEC');
        setTargetRoles('ALL');
        setIsMultiDay(false);
        setEndDateKey(dateKey);
        setRecurrence('NONE');
        setPriority('NORMAL');
        setEditingNoteId(null);

        if (selectedStore && selectedStore !== ALL_ASSIGNED_STORE_KEY && selectedStore !== 'all') {
            setAssignedStore(selectedStore);
        } else {
            setAssignedStore(ALL_ASSIGNED_STORE_KEY);
        }
    }, [targetDate, selectedStore, externalEditingNote, dateKey]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    };

    // Bắt đầu chỉnh sửa
    const handleStartEdit = (note: DailyWorkNote) => {
        setEditingNoteId(note.id);
        setTitle(note.title);
        setContent(note.content || '');
        setTaskType(note.task_type || 'CONG_VIEC');
        setTargetRoles(note.target_roles || 'ALL');
        setAssignedStore(note.store_name);
        setRecurrence(note.recurrence || 'NONE');
        setPriority(note.priority || 'NORMAL');
        if (note.end_date_key && note.end_date_key > note.date_key) {
            setIsMultiDay(true);
            setEndDateKey(note.end_date_key);
        } else {
            setIsMultiDay(false);
            setEndDateKey(note.date_key);
        }
    };

    // Hủy sửa
    const handleCancelEdit = () => {
        setEditingNoteId(null);
        setTitle('');
        setContent('');
        setTaskType('CONG_VIEC');
        setTargetRoles('ALL');
        setIsMultiDay(false);
        setEndDateKey(dateKey);
        setRecurrence('NONE');
        setPriority('NORMAL');
    };

    // Lưu công việc
    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            showToast('⚠️ Vui lòng nhập tiêu đề công việc / sự kiện!');
            return;
        }

        if (!canManage) {
            showToast('⛔ Bạn không có quyền thêm / sửa công việc (Chỉ QL/TC)!');
            return;
        }

        setIsSaving(true);

        const computedEndDate = isMultiDay && endDateKey >= dateKey ? endDateKey : undefined;

        if (editingNoteId) {
            const success = await updateDailyNote(editingNoteId, {
                title: trimmedTitle,
                content: content.trim() || undefined,
                store_name: assignedStore,
                task_type: taskType,
                target_roles: targetRoles,
                end_date_key: computedEndDate,
                recurrence,
                recurrence_value: recurrence === 'WEEKLY'
                    ? targetDate.getDay()
                    : recurrence === 'MONTHLY_LUNAR'
                        ? (selectedLunar ? selectedLunar.day : targetDate.getDate())
                        : undefined,
                priority
            });
            setIsSaving(false);
            if (success) {
                showToast('✅ Đã cập nhật công việc thành công!');
                handleCancelEdit();
                onNotesChanged();
            } else {
                showToast('❌ Cập nhật thất bại!');
            }
        } else {
            const res = await addDailyNote({
                store_name: assignedStore,
                date_key: dateKey,
                end_date_key: computedEndDate,
                title: trimmedTitle,
                content: content.trim() || undefined,
                task_type: taskType,
                target_roles: targetRoles,
                recurrence,
                recurrence_value: recurrence === 'WEEKLY'
                    ? targetDate.getDay()
                    : recurrence === 'MONTHLY_LUNAR'
                        ? (selectedLunar ? selectedLunar.day : targetDate.getDate())
                        : undefined,
                priority,
                is_completed: false,
                created_by_id: currentUser.id,
                created_by_name: currentUser.full_name || 'Quản lý',
                created_by_role: userRole
            });
            setIsSaving(false);
            if (res.success) {
                showToast('🎉 Đã thêm công việc mới vào lịch!');
                handleCancelEdit();
                onNotesChanged();
            } else {
                showToast(`❌ Thêm thất bại: ${res.error || ''}`);
            }
        }
    };

    // Xóa công việc
    const handleDelete = async (id: string) => {
        if (!canManage) return;
        const success = await deleteDailyNote(id);
        if (success) {
            showToast('🗑️ Đã xóa công việc khỏi lịch!');
            if (editingNoteId === id) handleCancelEdit();
            onNotesChanged();
        } else {
            showToast('❌ Không thể xóa công việc!');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
                {/* TOAST THÔNG BÁO */}
                {toastMessage && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-60 bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-white/20 animate-in fade-in slide-in-from-top-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* MODAL HEADER */}
                <div className="px-5 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center font-black text-white shrink-0 border border-white/20">
                            <span className="font-mono text-base">{targetDate.getDate()}</span>
                        </div>
                        <div className="min-w-0">
                            <div className="font-black text-sm sm:text-base flex items-center gap-2 truncate">
                                <span>{canManage ? 'Cấu Hình Công Việc & Sự Kiện Cần Làm' : 'Chi Tiết Công Việc & Sự Kiện'}</span>
                            </div>
                            <div className="text-xs text-blue-100 flex items-center gap-2 flex-wrap">
                                <span>
                                    {['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][targetDate.getDay()]}, {targetDate.toLocaleDateString('vi-VN')}
                                </span>
                                {selectedLunar && (
                                    <>
                                        <span>•</span>
                                        <span className="font-bold text-amber-300">
                                            Âm lịch: Ngày {selectedLunar.day}/{selectedLunar.month} ({selectedLunar.canChiDay || ''})
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* MODAL BODY */}
                <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
                    {/* CHẾ ĐỘ XEM DÀNH CHO NHÂN VIÊN */}
                    {!canManage && (
                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-3">
                            <Eye className="w-5 h-5 text-amber-600 shrink-0" />
                            <div>
                                <div className="font-black flex items-center gap-1.5">
                                    <span>Chế độ xem dành cho Nhân Viên</span>
                                    <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[10px] font-black uppercase">Chỉ Xem</span>
                                </div>
                                <p className="text-amber-800 text-[11px] mt-0.5">
                                    Bạn đang xem danh sách việc cần làm do Quản lý (QL) / Trưởng ca (TC) phân công.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* FORM CẤU HÌNH CÔNG VIỆC (QL / TC / ADMIN) */}
                    {canManage && (
                        <form onSubmit={handleSave} className="p-4 rounded-2xl bg-slate-50 border border-blue-100 space-y-3.5 shadow-2xs">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-black text-slate-800 flex items-center gap-1.5">
                                    {editingNoteId ? <Edit2 className="w-3.5 h-3.5 text-blue-600" /> : <Plus className="w-3.5 h-3.5 text-blue-600" />}
                                    <span>{editingNoteId ? 'Chỉnh sửa công việc / sự kiện:' : 'Tạo mới công việc / sự kiện cần làm:'}</span>
                                </span>
                                {editingNoteId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="text-[11px] text-slate-500 hover:text-slate-800 font-bold hover:underline"
                                    >
                                        Hủy chế độ sửa
                                    </button>
                                )}
                            </div>

                            {/* 1. Tiêu đề công việc */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Tiêu đề công việc / sự kiện <span className="text-rose-500">*</span>:
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ví dụ: Họp giao ban đầu ca; Cúng thần tài mùng 2; Kiểm kho phụ kiện; Chốt số ca tối..."
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 font-bold placeholder:font-normal placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                                    autoFocus
                                />
                            </div>

                            {/* 2. Loại công việc & Mức độ ưu tiên */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Loại công việc / sự kiện:
                                    </label>
                                    <select
                                        value={taskType}
                                        onChange={(e) => setTaskType(e.target.value as WorkTaskType)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs outline-none cursor-pointer"
                                    >
                                        {TASK_TYPE_OPTIONS.map((opt) => (
                                            <option key={opt.key} value={opt.key}>
                                                {opt.icon} {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Mức độ ưu tiên:
                                    </label>
                                    <select
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value as any)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs outline-none cursor-pointer"
                                    >
                                        <option value="NORMAL">🟢 Bình thường</option>
                                        <option value="HIGH">🟡 Quan trọng</option>
                                        <option value="URGENT">🔴 Khẩn cấp / Cần làm ngay</option>
                                    </select>
                                </div>
                            </div>

                            {/* 3. Người nhận thông báo hoặc xem danh sách (Target Roles) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Đối tượng nhận thông báo & xem danh sách:
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {TARGET_ROLE_OPTIONS.map((r) => {
                                        const isSelected = targetRoles === r.key;
                                        return (
                                            <button
                                                key={r.key}
                                                type="button"
                                                onClick={() => setTargetRoles(r.key)}
                                                className={`p-2 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-blue-50 border-blue-400 text-blue-900 ring-2 ring-blue-200'
                                                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-sm shrink-0">{r.icon}</span>
                                                    <div className="min-w-0">
                                                        <div className="font-extrabold text-[11px] truncate">{r.label}</div>
                                                        <div className="text-[10px] text-slate-400 truncate">{r.desc}</div>
                                                    </div>
                                                </div>
                                                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 4. Thời gian cần làm: 1 ngày vs Nhiều ngày */}
                            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                        Thời gian thực hiện:
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsMultiDay(false)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                                !isMultiDay ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            1 Ngày duy nhất
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsMultiDay(true)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                                isMultiDay ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            Nhiều ngày (Khoảng ngày)
                                        </button>
                                    </div>
                                </div>

                                {isMultiDay && (
                                    <div className="pt-2 flex items-center gap-2 flex-wrap border-t border-slate-100">
                                        <span className="text-slate-500 font-medium text-[11px]">Từ ngày: <b>{dateKey}</b></span>
                                        <span className="text-slate-400">→</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-700 font-bold text-[11px]">Đến ngày:</span>
                                            <input
                                                type="date"
                                                min={dateKey}
                                                value={endDateKey}
                                                onChange={(e) => setEndDateKey(e.target.value)}
                                                className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 outline-none"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 5. Cấu hình lặp lại hàng tuần / hàng tháng */}
                            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <Repeat className="w-3.5 h-3.5 text-amber-600" />
                                    Chu kỳ lặp lại công việc:
                                </label>
                                <select
                                    value={recurrence}
                                    onChange={(e) => setRecurrence(e.target.value as WorkTaskRecurrence)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs outline-none cursor-pointer"
                                >
                                    <option value="NONE">⏹️ Không lặp lại (Chỉ ngày/đợt đã chọn)</option>
                                    <option value="DAILY">🔁 Lặp lại hàng ngày</option>
                                    <option value="WEEKLY">
                                        📅 Lặp lại hàng tuần (Vào mỗi {['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][targetDate.getDay()]})
                                    </option>
                                    <option value="MONTHLY_SOLAR">
                                        🗓️ Lặp lại hàng tháng theo Dương lịch (Vào ngày {targetDate.getDate()} mỗi tháng)
                                    </option>
                                    {selectedLunar && (
                                        <option value="MONTHLY_LUNAR">
                                            🌙 Lặp lại hàng tháng theo Âm lịch (Vào mùng/ngày {selectedLunar.day} Âm lịch mỗi tháng)
                                        </option>
                                    )}
                                </select>
                            </div>

                            {/* 6. Nội dung chi tiết */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Nội dung chi tiết & hướng dẫn thực hiện:
                                </label>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    rows={2}
                                    placeholder="Ghi chú cụ thể các đầu việc cần làm, danh sách việc, phân công người làm, lưu ý..."
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs resize-none"
                                />
                            </div>

                            {/* 7. Phạm vi áp dụng siêu thị & Nút Lưu */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-600 shrink-0">Áp dụng cho:</span>
                                    <div className="relative">
                                        <Store className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        <select
                                            value={assignedStore}
                                            onChange={(e) => setAssignedStore(e.target.value)}
                                            className="pl-7 pr-4 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none cursor-pointer max-w-[240px] truncate"
                                        >
                                            <option value={ALL_ASSIGNED_STORE_KEY}>
                                                🏢 Toàn nhóm siêu thị phụ trách
                                            </option>
                                            {(currentUser.role === 'ADMIN' ? availableStores.map(s => s.name) : userAccessibleStores).map((storeName) => (
                                                <option key={storeName} value={storeName}>
                                                    📍 {storeName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 justify-end">
                                    {editingNoteId && (
                                        <button
                                            type="button"
                                            onClick={handleCancelEdit}
                                            className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                                        >
                                            Hủy
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                                    >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>{editingNoteId ? 'Cập Nhật' : 'Thêm Công Việc'}</span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* DANH SÁCH CÔNG VIỆC TRONG NGÀY ĐANG CHỌN */}
                    <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                <span>Công Việc Ngày {targetDate.getDate()}/{targetDate.getMonth() + 1} ({dayNotes.length} mục):</span>
                            </span>
                        </div>

                        {dayNotes.length === 0 ? (
                            <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                                Chưa có công việc hoặc sự kiện nào được ghi nhận cho ngày này.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {dayNotes.map((note) => {
                                    const isEditing = editingNoteId === note.id;
                                    return (
                                        <div
                                            key={note.id}
                                            className={`p-3.5 rounded-2xl border transition space-y-2 ${
                                                isEditing
                                                    ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-200'
                                                    : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-2xs'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-black text-slate-900 text-xs sm:text-sm">
                                                            {note.title}
                                                        </span>
                                                        {note.priority === 'URGENT' && (
                                                            <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[10px] font-black uppercase">
                                                                Khẩn cấp
                                                            </span>
                                                        )}
                                                        {note.priority === 'HIGH' && (
                                                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                                                Quan trọng
                                                            </span>
                                                        )}
                                                        {note.recurrence && note.recurrence !== 'NONE' && (
                                                            <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center gap-0.5">
                                                                <Repeat className="w-2.5 h-2.5" /> Lặp lại
                                                            </span>
                                                        )}
                                                    </div>

                                                    {note.content && (
                                                        <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                                                            {note.content}
                                                        </p>
                                                    )}
                                                </div>

                                                {canManage && (
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStartEdit(note)}
                                                            className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                                                            title="Sửa công việc này"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(note.id)}
                                                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                                            title="Xóa công việc này"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-100 flex-wrap gap-2">
                                                <span className="font-bold text-slate-600">
                                                    🏢 {note.store_name === ALL_ASSIGNED_STORE_KEY ? 'Toàn nhóm siêu thị' : note.store_name}
                                                </span>
                                                <span>Tạo bởi: <b>{note.created_by_name}</b> ({note.created_by_role})</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
