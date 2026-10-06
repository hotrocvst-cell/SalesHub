import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    Star,
    CalendarDays,
    FileText,
    Store,
    Plus,
    Edit2,
    Trash2,
    Lock,
    Eye,
    Crown,
    Shield,
    User,
    Sparkles,
    MousePointerClick
} from 'lucide-react';
import { getLunarDate } from '../utils/lunarCalendar';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { fetchStores, type StoreItem } from '../../../core/lib/storage';
import {
    type DailyWorkNote,
    ALL_ASSIGNED_STORE_KEY,
    getLocalDailyNotes,
    syncDailyNotes,
    getMonthNotesMap,
    filterNotesForView,
    deleteDailyNote
} from '../services/dailyNotesService';
import WorkNoteModal from './WorkNoteModal';
import { ROLE_LABELS } from '../../../core/lib/authService';

export default function CalendarWidget() {
    const { currentUser, isAuthenticated, isAdmin } = useAuth();
    const today = useMemo(() => new Date(), []);
    const [viewDate, setViewDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
    const [selectedDate, setSelectedDate] = useState<Date>(today);

    // 1. Quản lý danh sách Siêu thị
    const [stores, setStores] = useState<StoreItem[]>([]);
    useEffect(() => {
        let isMounted = true;
        fetchStores().then(res => {
            if (isMounted && res.success && res.data) {
                setStores(res.data);
            }
        });
        return () => { isMounted = false; };
    }, []);

    // Danh sách siêu thị người dùng được phân quyền phụ trách
    const userAccessibleStores = useMemo<string[]>(() => {
        if (isAdmin) {
            return stores.map(s => s.name);
        }
        if (currentUser.accessible_stores && currentUser.accessible_stores.length > 0) {
            return currentUser.accessible_stores;
        }
        return currentUser.store_name ? [currentUser.store_name] : [];
    }, [isAdmin, currentUser, stores]);

    // 2. Siêu thị đang được chọn lọc dữ liệu
    const [selectedStore, setSelectedStore] = useState<string>(() => {
        if (currentUser.role === 'NHAN_VIEN' && currentUser.store_name) {
            return currentUser.store_name;
        }
        return ALL_ASSIGNED_STORE_KEY;
    });

    // Đồng bộ lại selectedStore nếu tài khoản là Nhân Viên
    useEffect(() => {
        if (currentUser.role === 'NHAN_VIEN' && currentUser.store_name) {
            setSelectedStore(currentUser.store_name);
        }
    }, [currentUser]);

    // 3. Dữ liệu Ghi chú / Công việc cần làm
    const [notes, setNotes] = useState<DailyWorkNote[]>(() => getLocalDailyNotes());

    const refreshNotes = useCallback(async () => {
        const synced = await syncDailyNotes();
        setNotes(synced);
    }, []);

    useEffect(() => {
        refreshNotes();
    }, [refreshNotes]);

    // 4. Modal Popup Cập nhật / Xem ghi chú khi nhấp đúp
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTargetDate, setModalTargetDate] = useState<Date | null>(null);

    const handleOpenNoteModal = (date: Date) => {
        setSelectedDate(date);
        setModalTargetDate(date);
        setIsModalOpen(true);
    };

    const handleCloseNoteModal = () => {
        setIsModalOpen(false);
        setModalTargetDate(null);
    };

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth(); // 0 - 11

    function formatDateKey(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // Chuyển sang tháng trước
    const handlePrevMonth = () => {
        setViewDate(new Date(year, month - 1, 1));
    };

    // Chuyển sang tháng kế
    const handleNextMonth = () => {
        setViewDate(new Date(year, month + 1, 1));
    };

    // Quay về tháng hiện tại & ngày hôm nay
    const handleJumpToday = () => {
        const now = new Date();
        setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedDate(now);
    };

    // Tính toán các ngày trong bảng lịch
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const totalDaysInMonth = lastDayOfMonth.getDate();

        let firstDayIndex = firstDayOfMonth.getDay() - 1;
        if (firstDayIndex === -1) firstDayIndex = 6;

        const days = [];

        // 1. Ngày của tháng trước để đệm đủ tuần
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i;
            const fullDate = new Date(year, month - 1, d);
            const lunar = getLunarDate(d, month === 0 ? 12 : month, month === 0 ? year - 1 : year);
            days.push({
                date: fullDate,
                dayNumber: d,
                isCurrentMonth: false,
                lunar
            });
        }

        // 2. Ngày của tháng hiện tại
        for (let d = 1; d <= totalDaysInMonth; d++) {
            const fullDate = new Date(year, month, d);
            const lunar = getLunarDate(d, month + 1, year);
            days.push({
                date: fullDate,
                dayNumber: d,
                isCurrentMonth: true,
                lunar
            });
        }

        // 3. Ngày của tháng sau để làm đầy ô lưới (bội số của 7)
        const remainingSlots = 7 - (days.length % 7);
        if (remainingSlots < 7) {
            for (let d = 1; d <= remainingSlots; d++) {
                const fullDate = new Date(year, month + 1, d);
                const lunar = getLunarDate(d, month === 11 ? 1 : month + 2, month === 11 ? year + 1 : year);
                days.push({
                    date: fullDate,
                    dayNumber: d,
                    isCurrentMonth: false,
                    lunar
                });
            }
        }

        return days;
    }, [year, month]);

    // Bản đồ danh sách ghi chú của từng ngày trong tháng theo Nhóm siêu thị đang chọn
    // (Dùng để hiển thị trực tiếp tiêu đề lên lịch tổng)
    const monthNotesMap = useMemo(() => {
        return getMonthNotesMap(
            notes,
            year,
            month,
            selectedStore,
            userAccessibleStores,
            currentUser.role || 'NHAN_VIEN',
            currentUser.store_name
        );
    }, [notes, year, month, selectedStore, userAccessibleStores, currentUser]);

    // Tổng số lượng ghi chú trong tháng
    const monthNotesTotal = useMemo(() => {
        let count = 0;
        for (const list of Object.values(monthNotesMap)) {
            count += list.length;
        }
        return count;
    }, [monthNotesMap]);

    // Thông tin ngày đang chọn
    const selectedDateKey = formatDateKey(selectedDate);
    const selectedLunar = useMemo(() => {
        return getLunarDate(selectedDate.getDate(), selectedDate.getMonth() + 1, selectedDate.getFullYear());
    }, [selectedDate]);

    const isTodaySelected = useMemo(() => {
        return (
            selectedDate.getDate() === today.getDate() &&
            selectedDate.getMonth() === today.getMonth() &&
            selectedDate.getFullYear() === today.getFullYear()
        );
    }, [selectedDate, today]);

    const diffDaysFromToday = useMemo(() => {
        const t1 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const t2 = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime();
        return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
    }, [selectedDate, today]);

    // Danh sách ghi chú của ngày đang chọn
    const currentDayNotes = useMemo(() => {
        return filterNotesForView(
            notes,
            selectedDateKey,
            selectedStore,
            userAccessibleStores,
            currentUser.role || 'NHAN_VIEN',
            currentUser.store_name
        );
    }, [notes, selectedDateKey, selectedStore, userAccessibleStores, currentUser]);

    // Phân quyền
    const userRole = currentUser.role || 'NHAN_VIEN';
    const isStaff = isAuthenticated && userRole === 'NHAN_VIEN';
    const canManage = isAuthenticated && (userRole === 'ADMIN' || userRole === 'QUAN_LY' || userRole === 'TRUONG_CA');

    const WEEKDAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    // Mốc kinh doanh đặc biệt trong tháng
    const getSpecialDayBadge = (d: number, isCurMonth: boolean, lastDay: number) => {
        if (!isCurMonth) return null;
        if (d === lastDay) return { text: 'Chốt Số Tháng', color: 'bg-rose-100 text-rose-800 border-rose-200' };
        if (d === 1) return { text: 'Khởi Động', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        if (d === 10) return { text: 'Kỳ Lương', color: 'bg-amber-100 text-amber-800 border-amber-200' };
        if (d === 15) return { text: 'Đánh Giá Giữa Kỳ', color: 'bg-blue-100 text-blue-800 border-blue-200' };
        return null;
    };

    const lastDayInMonth = new Date(year, month + 1, 0).getDate();

    // Xóa ghi chú trực tiếp từ danh sách ngày
    const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canManage) return;
        await deleteDailyNote(id);
        refreshNotes();
    };

    return (
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm space-y-6">
            {/* Header: Tiêu đề, chọn tháng/năm, điều hướng */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20 shrink-0">
                        <CalendarIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                Lịch Làm Việc & Ghi Chú
                            </h2>
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider border border-blue-200/70">
                                Tháng {month + 1} / {year}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">
                            Nhấp đúp vào ô ngày để cập nhật.
                        </p>
                    </div>
                </div>

                {/* Bộ điều hướng Tháng / Năm & Nút Về Hôm Nay */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Chọn tháng nhanh */}
                    <select
                        value={month}
                        onChange={(e) => setViewDate(new Date(year, parseInt(e.target.value), 1))}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i}>Tháng {i + 1}</option>
                        ))}
                    </select>

                    {/* Chọn năm */}
                    <select
                        value={year}
                        onChange={(e) => setViewDate(new Date(parseInt(e.target.value), month, 1))}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                    >
                        {[2024, 2025, 2026, 2027, 2028].map(y => (
                            <option key={y} value={y}>Năm {y}</option>
                        ))}
                    </select>

                    <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                            title="Tháng trước"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <button
                            type="button"
                            onClick={handleJumpToday}
                            className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                            title="Quay về ngày hôm nay"
                        >
                            <RotateCcw className="w-3 h-3" />
                            <span>Hôm nay</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                            title="Tháng sau"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Thống kê nhanh tháng & Hướng dẫn thao tác nhấp đúp */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold">
                        <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-semibold">Tổng ngày tháng {month + 1}</div>
                        <div className="font-mono font-black text-slate-900 text-sm">{lastDayInMonth} ngày</div>
                    </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold">
                        <Star className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-semibold">Chốt số tháng</div>
                        <div className="font-mono font-black text-rose-700 text-sm">Ngày {lastDayInMonth}/{month + 1}</div>
                    </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
                        <FileText className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-semibold">Ghi chú trong tháng</div>
                        <div className="font-mono font-black text-amber-800 text-sm">{monthNotesTotal} ghi chú</div>
                    </div>
                </div>

                <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
                        <MousePointerClick className="w-4 h-4" />
                    </div>
                    <div className="leading-tight">
                        <div className="text-[10px] text-blue-600 font-extrabold uppercase">Thao tác nhanh</div>
                        <div className="font-bold text-slate-800 text-xs">
                            {canManage ? 'Nhấp đúp ngày để sửa' : 'Nhấp đúp ngày để xem'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bảng lưới hiển thị lịch các ngày trong tháng */}
            <div className="space-y-2">
                {/* Hàng tiêu đề 7 thứ trong tuần (T2 -> CN) */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-black select-none">
                    {WEEKDAY_NAMES.map((name, idx) => {
                        const isWeekend = idx >= 5;
                        const isSunday = idx === 6;
                        return (
                            <div
                                key={name}
                                className={`py-2 rounded-xl text-xs uppercase tracking-wider ${isSunday
                                        ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                        : isWeekend
                                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                            : 'bg-slate-50 text-slate-600 border border-slate-100'
                                    }`}
                            >
                                {name}
                            </div>
                        );
                    })}
                </div>

                {/* Lưới các ô ngày trong tháng */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {calendarDays.map((item, index) => {
                        const isToday = (
                            item.date.getDate() === today.getDate() &&
                            item.date.getMonth() === today.getMonth() &&
                            item.date.getFullYear() === today.getFullYear()
                        );
                        const isSelected = (
                            item.date.getDate() === selectedDate.getDate() &&
                            item.date.getMonth() === selectedDate.getMonth() &&
                            item.date.getFullYear() === selectedDate.getFullYear()
                        );
                        const dayOfWeek = item.date.getDay(); // 0 is Sunday, 6 is Saturday
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                        const dateKey = formatDateKey(item.date);
                        const dayNotes = monthNotesMap[dateKey] || [];
                        const specialBadge = getSpecialDayBadge(item.dayNumber, item.isCurrentMonth, lastDayInMonth);

                        return (
                            <div
                                key={index}
                                onClick={() => setSelectedDate(item.date)}
                                onDoubleClick={() => handleOpenNoteModal(item.date)}
                                title={canManage ? 'Nhấp đúp để thêm hoặc sửa ghi chú / công việc' : 'Nhấp đúp để xem chi tiết ghi chú'}
                                className={`min-h-[82px] sm:min-h-[104px] p-1.5 sm:p-2 rounded-2xl border transition flex flex-col justify-between cursor-pointer relative select-none group ${!item.isCurrentMonth
                                        ? 'bg-slate-50/50 border-slate-100 text-slate-300 opacity-60 hover:opacity-100'
                                        : isSelected
                                            ? 'bg-blue-50/80 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                                            : isToday
                                                ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                                                : isWeekend
                                                    ? 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200/80'
                                                    : 'bg-white hover:bg-slate-50 border-slate-200/70 shadow-2xs'
                                    }`}
                            >
                                {/* Dòng trên: Số ngày dương & Huy hiệu hôm nay / số lượng ghi chú */}
                                <div className="flex items-start justify-between">
                                    <span className={`font-mono text-sm sm:text-base font-black ${!item.isCurrentMonth
                                            ? 'text-slate-400'
                                            : isToday
                                                ? 'text-amber-700'
                                                : isSelected
                                                    ? 'text-blue-900'
                                                    : dayOfWeek === 0
                                                        ? 'text-rose-600'
                                                        : 'text-slate-800'
                                        }`}>
                                        {item.dayNumber}
                                    </span>

                                    <div className="flex items-center gap-1">
                                        {isToday && (
                                            <span className="px-1.5 py-0.2 rounded-md bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider shadow-2xs">
                                                Nay
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* DÒNG GIỮA: MỐC KINH DOANH & CÁC TIÊU ĐỀ GHI CHÚ / CÔNG VIỆC HIỂN THỊ TRỰC TIẾP TRÊN LỊCH */}
                                <div className="my-0.5 space-y-0.5 min-w-0 overflow-hidden">
                                    {/* Mốc đặc biệt (Khởi Động, Kỳ Lương, Chốt Số Tháng...) */}
                                    {specialBadge && (
                                        <div className="hidden sm:block">
                                            <span className={`px-1 py-0.2 rounded text-[9px] font-bold border truncate block max-w-full text-center ${specialBadge.color}`}>
                                                {specialBadge.text}
                                            </span>
                                        </div>
                                    )}

                                    {/* TIÊU ĐỀ GHI CHÚ / CÔNG VIỆC CỦA NGÀY (HIỂN THỊ TƯƠNG TỰ CÁC MỤC KHỞI ĐỘNG/KỲ LƯƠNG) */}
                                    {dayNotes.slice(0, 2).map((note) => (
                                        <div
                                            key={note.id}
                                            className="hidden sm:block"
                                            title={`${note.title}${note.content ? `\n\nNội dung: ${note.content}` : ''}`}
                                        >
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 truncate block max-w-full text-left transition shadow-2xs">
                                                📌 {note.title}
                                            </span>
                                        </div>
                                    ))}

                                    {/* Trên mobile hiển thị gọn dạng badge nhỏ */}
                                    {dayNotes.length > 0 && (
                                        <div className="sm:hidden">
                                            <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-blue-600 text-white truncate block max-w-full text-center">
                                                📌 {dayNotes[0].title}
                                            </span>
                                        </div>
                                    )}

                                    {/* Nếu có hơn 2 ghi chú trong 1 ngày */}
                                    {dayNotes.length > 2 && (
                                        <div className="text-[8px] font-extrabold text-blue-600 pl-0.5 leading-tight hidden sm:block">
                                            +{dayNotes.length - 2} việc khác...
                                        </div>
                                    )}
                                </div>

                                {/* Dòng dưới: Ngày âm lịch */}
                                <div className="flex items-center justify-between text-[10px] mt-1 pt-1 border-t border-slate-100/60">
                                    <span className={`font-medium truncate ${item.lunar.day === 1 || item.lunar.day === 15
                                            ? 'text-rose-600 font-black'
                                            : 'text-slate-400 font-mono'
                                        }`}>
                                        {item.lunar.lunarLabel}
                                    </span>

                                    {item.lunar.day === 1 && (
                                        <span className="text-[8px] font-black px-1 rounded bg-rose-100 text-rose-700 hidden sm:inline">
                                            Mùng 1
                                        </span>
                                    )}
                                    {item.lunar.day === 15 && (
                                        <span className="text-[8px] font-black px-1 rounded bg-amber-100 text-amber-700 hidden sm:inline">
                                            Rằm
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* KHU VỰC TINH GỌN: CHI TIẾT GHI CHÚ NGÀY ĐANG ĐƯỢC CHỌN & BỘ LỌC SIÊU THỊ */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/80 space-y-4">
                {/* Header ngày được chọn & Nhóm siêu thị phụ trách */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-blue-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                            <span className="text-base font-mono">{selectedDate.getDate()}</span>
                        </div>
                        <div>
                            <div className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                                <span>
                                    {['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][selectedDate.getDay()]}, {selectedDate.toLocaleDateString('vi-VN')}
                                </span>
                                {isTodaySelected && (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase">
                                        Hôm nay
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-2">
                                <span>Âm lịch: <b>Ngày {selectedLunar.day} tháng {selectedLunar.month}{selectedLunar.isLeap ? ' (Nhuận)' : ''}</b> ({selectedLunar.canChiDay})</span>
                                <span>•</span>
                                <span>Năm {selectedLunar.canChiYear}</span>
                                <span>•</span>
                                <span className="font-semibold text-slate-500">
                                    {diffDaysFromToday === 0 ? (
                                        <span className="text-amber-700 font-bold">🎯 Đang là ngày hiện tại</span>
                                    ) : diffDaysFromToday > 0 ? (
                                        <span>Còn <b className="text-blue-700 font-mono text-sm">{diffDaysFromToday}</b> ngày nữa</span>
                                    ) : (
                                        <span>Đã qua <b className="text-slate-700 font-mono text-sm">{Math.abs(diffDaysFromToday)}</b> ngày trước</span>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Bộ lọc Siêu thị đang phụ trách */}
                    <div className="flex items-center gap-2 self-start lg:self-center flex-wrap">
                        {isStaff ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                                <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>Siêu thị: {currentUser.store_name || 'Của bạn'}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 font-extrabold uppercase">Chỉ xem</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <select
                                    value={selectedStore}
                                    onChange={(e) => setSelectedStore(e.target.value)}
                                    className="px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-xs font-bold text-slate-800 outline-none cursor-pointer max-w-[240px] truncate shadow-2xs"
                                >
                                    {userRole === 'ADMIN' && (
                                        <option value={ALL_ASSIGNED_STORE_KEY}>
                                            🌐 Toàn bộ hệ thống ({stores.length} siêu thị)
                                        </option>
                                    )}
                                    {userRole !== 'ADMIN' && (
                                        <option value={ALL_ASSIGNED_STORE_KEY}>
                                            🏢 Toàn nhóm phụ trách ({userAccessibleStores.length} siêu thị)
                                        </option>
                                    )}
                                    {(userRole === 'ADMIN' ? stores.map(s => s.name) : userAccessibleStores).map((storeName) => (
                                        <option key={storeName} value={storeName}>
                                            📍 {storeName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Nút mở popup thêm/sửa ghi chú ngày */}
                        {canManage && (
                            <button
                                type="button"
                                onClick={() => handleOpenNoteModal(selectedDate)}
                                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Cập nhật ghi chú ngày này</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Danh sách ghi chú & công việc ngày */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>Ghi chú công việc ngày {selectedDate.getDate()}/{selectedDate.getMonth() + 1} ({currentDayNotes.length} mục):</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                            {canManage ? '💡 Nhấp đúp vào ngày trên lịch để sửa nhanh' : 'Chế độ xem dành cho nhân viên'}
                        </span>
                    </div>

                    {currentDayNotes.length === 0 ? (
                        <div className="p-4 rounded-xl bg-white/70 border border-dashed border-slate-200 text-center flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
                            <span>Chưa có ghi chú hoặc công việc nào cho ngày này.</span>
                            {canManage && (
                                <button
                                    type="button"
                                    onClick={() => handleOpenNoteModal(selectedDate)}
                                    className="px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition cursor-pointer flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Tạo ghi chú ngay</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {currentDayNotes.map((note) => (
                                <div
                                    key={note.id}
                                    onClick={() => handleOpenNoteModal(selectedDate)}
                                    className="p-3 rounded-xl bg-white border border-slate-200/90 hover:border-blue-300 transition shadow-2xs flex flex-col justify-between gap-2 cursor-pointer group"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="font-black text-slate-900 text-xs sm:text-sm">
                                                📌 {note.title}
                                            </span>
                                            {canManage && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDeleteNote(note.id, e)}
                                                    className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                                                    title="Xóa ghi chú này"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>

                                        {note.content && (
                                            <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed line-clamp-2">
                                                {note.content}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                                        <span className="truncate max-w-[150px]">
                                            {note.store_name === ALL_ASSIGNED_STORE_KEY ? 'Toàn nhóm siêu thị' : note.store_name}
                                        </span>
                                        <span>Bởi: <b>{note.created_by_name}</b></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* POPUP MODAL CẬP NHẬT / XEM CHI TIẾT KHI NHẤP ĐÚP VÀO Ô LỊCH */}
            <WorkNoteModal
                isOpen={isModalOpen}
                onClose={handleCloseNoteModal}
                targetDate={modalTargetDate}
                selectedLunar={modalTargetDate ? getLunarDate(modalTargetDate.getDate(), modalTargetDate.getMonth() + 1, modalTargetDate.getFullYear()) : null}
                selectedStore={selectedStore}
                userAccessibleStores={userAccessibleStores}
                availableStores={stores}
                currentUser={currentUser}
                dayNotes={modalTargetDate ? filterNotesForView(
                    notes,
                    formatDateKey(modalTargetDate),
                    selectedStore,
                    userAccessibleStores,
                    currentUser.role || 'NHAN_VIEN',
                    currentUser.store_name
                ) : []}
                onNotesChanged={refreshNotes}
                canManage={canManage}
            />
        </div>
    );
}
