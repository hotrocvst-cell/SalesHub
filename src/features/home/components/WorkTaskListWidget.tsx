import React, { useMemo } from 'react';
import {
    FileText,
    Plus,
    Check,
    CheckCircle2,
    Calendar,
    Store,
    Trash2,
    Edit2,
    Repeat,
    Sparkles,
    AlertCircle,
    Flame,
    Clock,
    Lock,
    Target,
    Zap
} from 'lucide-react';
import {
    type DailyWorkNote,
    type CalendarSystemEvent,
    ALL_ASSIGNED_STORE_KEY,
    updateDailyNote,
    deleteDailyNote
} from '../services/dailyNotesService';
import type { LunarDate } from '../utils/lunarCalendar';
import type { CurrentUser } from '../../../shared/contexts/AuthContext';
import type { StoreItem } from '../../../core/lib/storage';

interface Props {
    selectedDate: Date;
    selectedLunar: LunarDate;
    isTodaySelected: boolean;
    diffDaysFromToday: number;
    currentDayNotes: DailyWorkNote[];
    systemEvents: CalendarSystemEvent[];
    selectedStore: string;
    onSelectStore: (store: string) => void;
    userAccessibleStores: string[];
    availableStores: StoreItem[];
    currentUser: CurrentUser;
    canManage: boolean;
    onOpenAddModal: () => void;
    onOpenEditModal: (note: DailyWorkNote) => void;
    onNotesChanged: () => void;
    onJumpToday: () => void;
    containerRef?: React.RefObject<HTMLDivElement | null>;
}

export default function WorkTaskListWidget({
    selectedDate,
    selectedLunar,
    isTodaySelected,
    diffDaysFromToday,
    currentDayNotes,
    systemEvents,
    selectedStore,
    onSelectStore,
    userAccessibleStores,
    availableStores,
    currentUser,
    canManage,
    onOpenAddModal,
    onOpenEditModal,
    onNotesChanged,
    onJumpToday,
    containerRef
}: Props) {
    const userRole = currentUser?.role || 'NHAN_VIEN';
    const isStaff = userRole === 'NHAN_VIEN';

    // 1. Tính toán tiến độ tháng & đếm ngược chốt số
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 - 11
    const currentDay = now.getDate();

    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysPassed = currentDay;
    const daysRemaining = Math.max(0, totalDaysInMonth - currentDay);
    const progressPercent = Math.min(100, Math.round((daysPassed / totalDaysInMonth) * 100));
    const currentWeekInMonth = Math.ceil(currentDay / 7);

    // Toggle trạng thái hoàn thành công việc
    const handleToggleComplete = async (note: DailyWorkNote, e: React.MouseEvent) => {
        e.stopPropagation();
        await updateDailyNote(note.id, {
            is_completed: !note.is_completed
        });
        onNotesChanged();
    };

    // Xóa công việc
    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canManage) return;
        await deleteDailyNote(id);
        onNotesChanged();
    };

    // Badge loại công việc
    const getTaskTypeBadge = (type?: string) => {
        switch (type) {
            case 'CUNG_LE':
                return { label: 'Cúng Lễ', color: 'bg-amber-100 text-amber-800 border-amber-200' };
            case 'SU_KIEN':
                return { label: 'Sự Kiện', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
            case 'HOP_CA':
                return { label: 'Họp Ca', color: 'bg-blue-100 text-blue-800 border-blue-200' };
            case 'KIEM_KE':
                return { label: 'Kiểm Kê', color: 'bg-purple-100 text-purple-800 border-purple-200' };
            case 'NHAC_NHO':
                return { label: 'Nhắc Nhở', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' };
            default:
                return { label: 'Bán Hàng', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        }
    };

    return (
        <div
            ref={containerRef}
            className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between h-full space-y-4 scroll-mt-20"
        >
            {/* ============================================================== */}
            {/* KHỐI 1: TIẾN ĐỘ THÁNG & ĐẾM NGƯỢC CHỐT SỐ (GHÉP CHUNG CÙNG THẺ) */}
            {/* ============================================================== */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-3.5 sm:p-4 text-white border border-white/10 shadow-inner space-y-2.5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Hàng trên: Tiêu đề chu kỳ & Badge đếm ngược ngày chốt số */}
                <div className="relative z-10 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center font-black border border-blue-400/20 shrink-0">
                            <Target className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div>
                            <div className="font-black text-xs sm:text-sm text-white flex items-center gap-1.5">
                                <span>Tiến Độ Tháng {currentMonth + 1}</span>
                                <span className="text-[10px] text-blue-300 font-normal">
                                    • Tuần {currentWeekInMonth}
                                </span>
                            </div>
                            <div className="text-[10px] text-slate-300">
                                Chu kỳ 01 - {totalDaysInMonth}/{currentMonth + 1}/{currentYear}
                            </div>
                        </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-mono font-black flex items-center gap-1 shrink-0">
                        <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
                        <span>Còn {daysRemaining} ngày chốt số</span>
                    </span>
                </div>

                {/* Hàng giữa: Thanh tiến độ ngày trong tháng */}
                <div className="relative z-10 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-300">
                            Đã qua: <b className="text-white font-mono">{daysPassed}</b> / {totalDaysInMonth} ngày
                        </span>
                        <span className="text-emerald-400 font-mono font-extrabold">
                            {progressPercent}% thời gian
                        </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-800 p-0.5 border border-white/10 overflow-hidden shadow-inner">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Hàng dưới: 3 chặng kinh doanh thu gọn */}
                <div className="relative z-10 grid grid-cols-3 gap-1.5 pt-1 border-t border-white/10 text-center text-[10px]">
                    <div className={`p-1.5 rounded-xl border transition ${currentDay >= 1 && currentDay <= 10 ? 'bg-blue-500/30 border-blue-400/50 text-blue-100 font-black' : 'bg-black/20 border-white/5 text-slate-400'}`}>
                        <div className="opacity-75 uppercase text-[9px]">Chặng 1 (01-10)</div>
                        <div>🚀 Khởi động</div>
                    </div>

                    <div className={`p-1.5 rounded-xl border transition ${currentDay >= 11 && currentDay <= 20 ? 'bg-amber-500/30 border-amber-400/50 text-amber-100 font-black' : 'bg-black/20 border-white/5 text-slate-400'}`}>
                        <div className="opacity-75 uppercase text-[9px]">Chặng 2 (11-20)</div>
                        <div>⚡ Tăng tốc</div>
                    </div>

                    <div className={`p-1.5 rounded-xl border transition ${currentDay >= 21 ? 'bg-rose-500/30 border-rose-400/50 text-rose-100 font-black animate-pulse' : 'bg-black/20 border-white/5 text-slate-400'}`}>
                        <div className="opacity-75 uppercase text-[9px]">Chặng 3 (21-{totalDaysInMonth})</div>
                        <div>🎯 Về đích</div>
                    </div>
                </div>
            </div>

            {/* ============================================================== */}
            {/* KHỐI 2: HEADER CÔNG VIỆC CẦN LÀM THEO NGÀY ĐANG CHỌN */}
            {/* ============================================================== */}
            <div className="space-y-3 pb-2 border-b border-slate-100">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20 shrink-0">
                            <span className="font-mono text-base">{selectedDate.getDate()}</span>
                        </div>
                        <div className="min-w-0">
                            <div className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2 truncate">
                                <span>
                                    {['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][selectedDate.getDay()]}, {selectedDate.toLocaleDateString('vi-VN')}
                                </span>
                                {isTodaySelected ? (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase shrink-0">
                                        Hôm nay
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={onJumpToday}
                                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer shrink-0"
                                    >
                                        (Về hôm nay)
                                    </button>
                                )}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-amber-700">
                                    Âm lịch: Ngày {selectedLunar.day}/{selectedLunar.month} ({selectedLunar.canChiDay || ''})
                                </span>
                                <span>•</span>
                                <span className="font-medium text-slate-500">
                                    {diffDaysFromToday === 0 ? (
                                        <span className="text-emerald-600 font-bold">🎯 Đang là hôm nay</span>
                                    ) : diffDaysFromToday > 0 ? (
                                        <span>Còn <b className="text-blue-600 font-mono">{diffDaysFromToday}</b> ngày nữa</span>
                                    ) : (
                                        <span>Đã qua <b className="text-slate-600 font-mono">{Math.abs(diffDaysFromToday)}</b> ngày trước</span>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Nút Thêm công việc mới */}
                    {canManage && (
                        <button
                            type="button"
                            onClick={onOpenAddModal}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                            title="Tạo mới công việc cần làm cho ngày này"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Thêm Việc</span>
                        </button>
                    )}
                </div>

                {/* Bộ lọc Siêu thị */}
                <div className="flex items-center justify-between gap-2 text-xs pt-1 flex-wrap">
                    <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>Việc Cần Làm & Sự Kiện ({currentDayNotes.length + systemEvents.length}):</span>
                    </span>

                    {isStaff ? (
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                            🏢 {currentUser?.store_name || 'Siêu thị của bạn'}
                        </span>
                    ) : (
                        <div className="flex items-center gap-1">
                            <Store className="w-3 h-3 text-slate-400 shrink-0" />
                            <select
                                value={selectedStore}
                                onChange={(e) => onSelectStore(e.target.value)}
                                className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer max-w-[200px] truncate"
                            >
                                <option value={ALL_ASSIGNED_STORE_KEY}>
                                    🏢 Toàn nhóm phụ trách
                                </option>
                                {(userRole === 'ADMIN' ? availableStores.map(s => s.name) : userAccessibleStores).map((name) => (
                                    <option key={name} value={name}>
                                        📍 {name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* ============================================================== */}
            {/* KHỐI 3: DANH SÁCH SỰ KIỆN LỊCH VÀ CÔNG VIỆC CẦN LÀM */}
            {/* ============================================================== */}
            <div className="space-y-2.5 flex-1 overflow-y-auto no-scrollbar max-h-[340px]">
                {/* 1. HIỂN THỊ CÁC SỰ KIỆN HỆ THỐNG ĐẶC BIỆT TRONG NGÀY (NẾU CÓ) */}
                {systemEvents.length > 0 && (
                    <div className="space-y-1.5">
                        {systemEvents.map((ev) => (
                            <div
                                key={ev.id}
                                className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 shadow-2xs ${
                                    ev.rule_type === 'LUNAR_DAY'
                                        ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                                        : ev.rule_type === 'SOLAR_LAST_DAY'
                                            ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                                            : 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-xl select-none shrink-0">{ev.icon}</span>
                                    <div className="min-w-0">
                                        <div className="font-black text-xs sm:text-sm truncate flex items-center gap-1.5">
                                            <span>{ev.title}</span>
                                            {ev.rule_type === 'LUNAR_DAY' && (
                                                <span className="text-[9.5px] px-1.5 py-0.2 rounded font-black bg-amber-200/80 text-amber-900 uppercase">
                                                    Âm Lịch
                                                </span>
                                            )}
                                        </div>
                                        {ev.description && (
                                            <p className="text-[11px] opacity-80 line-clamp-1 mt-0.5">
                                                {ev.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 font-black border border-current shrink-0 shadow-2xs">
                                    Sự Kiện Lịch
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* 2. DANH SÁCH CÔNG VIỆC NGHIỆP VỤ DO QUẢN LÝ TẠO */}
                {currentDayNotes.length === 0 && systemEvents.length === 0 ? (
                    <div className="p-5 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-2 text-xs text-slate-500 min-h-[140px]">
                        <span className="text-2xl">☕</span>
                        <span className="font-bold text-slate-700">Chưa có công việc hoặc sự kiện nào trong ngày này</span>
                        <p className="text-[11px] text-slate-400 max-w-xs">
                            {canManage ? 'Bạn có thể bấm nút "+ Thêm Việc" để giao việc hoặc nhắc nhở cho ngày này.' : 'Ngày này không có chỉ đạo đặc biệt, tiếp tục kế hoạch bán hàng thường quy.'}
                        </p>
                        {canManage && (
                            <button
                                type="button"
                                onClick={onOpenAddModal}
                                className="mt-1 px-3 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition cursor-pointer flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" />
                                <span>Thêm công việc ngay</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {currentDayNotes.map((note) => {
                            const typeBadge = getTaskTypeBadge(note.task_type);
                            const isCompleted = Boolean(note.is_completed);

                            return (
                                <div
                                    key={note.id}
                                    onClick={() => onOpenEditModal(note)}
                                    className={`p-3 rounded-2xl border transition shadow-2xs flex flex-col justify-between gap-2 cursor-pointer group ${
                                        isCompleted
                                            ? 'bg-slate-50 border-slate-200 opacity-70'
                                            : 'bg-white hover:bg-blue-50/30 border-slate-200/90 hover:border-blue-300'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2.5">
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            {/* Nút check hoàn thành */}
                                            <button
                                                type="button"
                                                onClick={(e) => handleToggleComplete(note, e)}
                                                className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center transition cursor-pointer shrink-0 ${
                                                    isCompleted
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'border border-slate-300 hover:border-blue-500 text-transparent hover:text-slate-300'
                                                }`}
                                                title={isCompleted ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu đã hoàn thành'}
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>

                                            <div className="space-y-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`font-black text-xs sm:text-sm text-slate-900 ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                                                        {note.title}
                                                    </span>

                                                    {/* Badge Loại công việc */}
                                                    <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-bold border ${typeBadge.color}`}>
                                                        {typeBadge.label}
                                                    </span>

                                                    {/* Khẩn cấp / Quan trọng */}
                                                    {note.priority === 'URGENT' && (
                                                        <span className="text-[9.5px] px-1.5 py-0.2 rounded font-black bg-rose-100 text-rose-700">
                                                            Khẩn cấp
                                                        </span>
                                                    )}
                                                    {note.priority === 'HIGH' && (
                                                        <span className="text-[9.5px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800">
                                                            Quan trọng
                                                        </span>
                                                    )}

                                                    {/* Lặp lại */}
                                                    {note.recurrence && note.recurrence !== 'NONE' && (
                                                        <span className="text-[9.5px] px-1.5 py-0.2 rounded font-bold bg-indigo-100 text-indigo-700 flex items-center gap-0.5">
                                                            <Repeat className="w-2.5 h-2.5" /> Lặp lại
                                                        </span>
                                                    )}
                                                </div>

                                                {note.content && (
                                                    <p className={`text-xs text-slate-600 whitespace-pre-line leading-relaxed line-clamp-2 ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                                                        {note.content}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action buttons (cho Quản lý) */}
                                        {canManage && (
                                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onOpenEditModal(note);
                                                    }}
                                                    className="p-1 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition"
                                                    title="Chỉnh sửa công việc này"
                                                >
                                                    <Edit2 className="w-3 h-3" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDelete(note.id, e)}
                                                    className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                                                    title="Xóa công việc này"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer chi tiết */}
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex-wrap gap-1">
                                        <span className="truncate max-w-[150px] font-bold text-slate-500">
                                            {note.store_name === ALL_ASSIGNED_STORE_KEY ? '🏢 Toàn nhóm siêu thị' : `📍 ${note.store_name}`}
                                        </span>
                                        <span>Tạo bởi: <b>{note.created_by_name}</b></span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
