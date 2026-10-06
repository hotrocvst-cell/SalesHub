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
    Check
} from 'lucide-react';
import {
    type DailyWorkNote,
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
}

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
    canManage
}: WorkNoteModalProps) {
    if (!isOpen || !targetDate) return null;

    const userRole = currentUser.role || 'NHAN_VIEN';
    const dateKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [assignedStore, setAssignedStore] = useState<string>(() => {
        if (selectedStore && selectedStore !== ALL_ASSIGNED_STORE_KEY && selectedStore !== 'all') {
            return selectedStore;
        }
        return ALL_ASSIGNED_STORE_KEY;
    });

    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Reset form khi targetDate thay đổi
    useEffect(() => {
        setTitle('');
        setContent('');
        setEditingNoteId(null);
        if (selectedStore && selectedStore !== ALL_ASSIGNED_STORE_KEY && selectedStore !== 'all') {
            setAssignedStore(selectedStore);
        } else {
            setAssignedStore(ALL_ASSIGNED_STORE_KEY);
        }
    }, [targetDate, selectedStore]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    };

    // Bắt đầu chỉnh sửa một note đã có
    const handleStartEdit = (note: DailyWorkNote) => {
        setEditingNoteId(note.id);
        setTitle(note.title);
        setContent(note.content || '');
        setAssignedStore(note.store_name);
    };

    // Hủy chỉnh sửa
    const handleCancelEdit = () => {
        setEditingNoteId(null);
        setTitle('');
        setContent('');
    };

    // Lưu (Thêm mới hoặc Cập nhật)
    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!title.trim()) {
            showToast('⚠️ Vui lòng nhập tiêu đề ghi chú / công việc!');
            return;
        }

        if (!canManage) {
            showToast('⛔ Bạn không có quyền cập nhật (Chỉ QL/TC)!');
            return;
        }

        setIsSaving(true);

        if (editingNoteId) {
            // Cập nhật
            const success = await updateDailyNote(editingNoteId, {
                title: title.trim(),
                content: content.trim() || undefined,
                store_name: assignedStore
            });
            setIsSaving(false);
            if (success) {
                showToast('✅ Đã cập nhật ghi chú thành công!');
                setEditingNoteId(null);
                setTitle('');
                setContent('');
                onNotesChanged();
            } else {
                showToast('❌ Cập nhật thất bại!');
            }
        } else {
            // Thêm mới
            const res = await addDailyNote({
                store_name: assignedStore,
                date_key: dateKey,
                title: title.trim(),
                content: content.trim() || undefined,
                created_by_id: currentUser.id,
                created_by_name: currentUser.full_name || 'Quản lý',
                created_by_role: userRole
            });
            setIsSaving(false);
            if (res.success) {
                showToast('🎉 Đã thêm ghi chú công việc mới!');
                setTitle('');
                setContent('');
                onNotesChanged();
            } else {
                showToast(`❌ Thêm thất bại: ${res.error || ''}`);
            }
        }
    };

    // Xóa ghi chú
    const handleDelete = async (id: string) => {
        if (!canManage) return;
        const success = await deleteDailyNote(id);
        if (success) {
            showToast('🗑️ Đã xóa ghi chú!');
            if (editingNoteId === id) {
                handleCancelEdit();
            }
            onNotesChanged();
        } else {
            showToast('❌ Không thể xóa ghi chú!');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* TOAST THÔNG BÁO NHANH TRONG MODAL */}
                {toastMessage && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-60 bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-white/20 animate-in fade-in slide-in-from-top-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* MODAL HEADER */}
                <div className="px-5 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center font-black text-white shrink-0 border border-white/20">
                            <span className="font-mono text-base">{targetDate.getDate()}</span>
                        </div>
                        <div className="min-w-0">
                            <div className="font-black text-sm sm:text-base flex items-center gap-2 truncate">
                                <span>{canManage ? 'Cập Nhật Ghi Chú & Công Việc' : 'Chi Tiết Ghi Chú & Công Việc'}</span>
                            </div>
                            <div className="text-xs text-blue-100 flex items-center gap-2 flex-wrap">
                                <span>
                                    {['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][targetDate.getDay()]}, {targetDate.toLocaleDateString('vi-VN')}
                                </span>
                                {selectedLunar && (
                                    <>
                                        <span>•</span>
                                        <span>Âm lịch: Ngày {selectedLunar.day}/{selectedLunar.month} ({selectedLunar.canChiDay || ''})</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer shrink-0"
                        title="Đóng cửa sổ"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* MODAL BODY */}
                <div className="p-5 overflow-y-auto space-y-5 flex-1">
                    {/* BẢNG THÔNG BÁO CHO NHÂN VIÊN (CHỈ XEM) */}
                    {!canManage && (
                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-3">
                            <Eye className="w-5 h-5 text-amber-600 shrink-0" />
                            <div>
                                <div className="font-black flex items-center gap-1.5">
                                    <span>Chế độ xem dành cho Nhân Viên</span>
                                    <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[10px] font-black uppercase">Chỉ Xem</span>
                                </div>
                                <p className="text-amber-800 text-[11px] mt-0.5">
                                    Bạn đang xem ghi chú & công việc ngày do Quản lý (QL) / Trưởng ca (TC) phụ trách. Quyền cập nhật chỉ áp dụng cho QL/TC.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* FORM CẬP NHẬT GHI CHÚ / CÔNG VIỆC (CHỈ DÀNH CHO QL / TC / ADMIN) */}
                    {canManage && (
                        <form onSubmit={handleSave} className="p-4 rounded-2xl bg-slate-50 border border-blue-100 space-y-3.5 shadow-2xs">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-black text-slate-800 flex items-center gap-1.5">
                                    {editingNoteId ? <Edit2 className="w-3.5 h-3.5 text-blue-600" /> : <Plus className="w-3.5 h-3.5 text-blue-600" />}
                                    <span>{editingNoteId ? 'Chỉnh sửa ghi chú / công việc:' : 'Thêm ghi chú hoặc công việc cần làm mới:'}</span>
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

                            {/* Tiêu đề ghi chú / công việc (BẮT BUỘC - SẼ HIỂN THỊ TRÊN LỊCH TỔNG) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Tiêu đề ghi chú / công việc <span className="text-rose-500">*</span> <span className="text-[10px] text-slate-400 font-normal">(Hiển thị trực tiếp trên ô lịch tổng)</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ví dụ: Họp giao ban đầu ca; Kiểm kho phụ kiện; Chốt doanh số ca tối..."
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 font-bold placeholder:font-normal placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                                    autoFocus
                                />
                            </div>

                            {/* Nội dung chi tiết */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Nội dung chi tiết <span className="text-[10px] text-slate-400 font-normal">(Danh sách việc cần làm, ghi chú bàn giao ca, lưu ý...)</span>
                                </label>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    rows={3}
                                    placeholder="Ghi chú cụ thể các đầu việc cần làm, phân công nhân sự, dặn dò ca làm việc..."
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs resize-none"
                                />
                            </div>

                            {/* Phạm vi áp dụng siêu thị & Nút Lưu */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-200">
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

                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <button
                                        type="submit"
                                        disabled={isSaving || !title.trim()}
                                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                                    >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>{isSaving ? 'Đang lưu...' : (editingNoteId ? 'Cập Nhật' : 'Lưu Ghi Chú')}</span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* DANH SÁCH GHI CHÚ / CÔNG VIỆC CỦA NGÀY NÀY */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs px-0.5">
                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                <span>Ghi chú & Công việc ngày {targetDate.getDate()}/{targetDate.getMonth() + 1} ({dayNotes.length} mục):</span>
                            </span>
                        </div>

                        {dayNotes.length === 0 ? (
                            <div className="p-6 rounded-2xl bg-slate-50/60 border border-dashed border-slate-200 text-center space-y-1">
                                <p className="text-xs font-bold text-slate-600">Ngày này chưa có ghi chú hoặc công việc nào.</p>
                                <p className="text-[11px] text-slate-400">
                                    {canManage ? 'Hãy nhập tiêu đề & nội dung ở trên để lưu ghi chú cho ngày này.' : 'Chưa có ghi chú nào được giao cho siêu thị của bạn.'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {dayNotes.map((note) => (
                                    <div
                                        key={note.id}
                                        className="p-3.5 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-300 transition shadow-2xs space-y-2"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1 min-w-0 flex-1">
                                                {/* Tiêu đề ghi chú (sẽ hiện trên lịch) */}
                                                <div className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                                                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-black">
                                                        📌 {note.title}
                                                    </span>
                                                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold border border-slate-200 truncate max-w-[200px]" title={note.store_name}>
                                                        {note.store_name === ALL_ASSIGNED_STORE_KEY ? 'Toàn nhóm siêu thị' : note.store_name}
                                                    </span>
                                                </div>

                                                {/* Nội dung chi tiết */}
                                                {note.content && (
                                                    <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed pt-1 pl-1">
                                                        {note.content}
                                                    </p>
                                                )}

                                                <div className="text-[10px] text-slate-400 pt-1 flex items-center gap-2">
                                                    <span>Tạo bởi: <b>{note.created_by_name}</b> ({ROLE_LABELS[note.created_by_role as any] || note.created_by_role})</span>
                                                    <span>•</span>
                                                    <span>{new Date(note.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>

                                            {/* Nút thao tác (Chỉ dành cho QL / TC) */}
                                            {canManage && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartEdit(note)}
                                                        className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                                        title="Sửa ghi chú này"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(note.id)}
                                                        className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                                        title="Xóa ghi chú này"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* MODAL FOOTER */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500">
                        {canManage ? '💡 Nhấp đúp vào ngày trên lịch để mở nhanh cửa sổ này.' : 'Chế độ xem dành cho nhân viên.'}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
